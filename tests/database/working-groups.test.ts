import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { DATASET, loadDataset } from "./dataset.ts";
import {
  CO_PARENT_F1,
  DEACTIVATED,
  DIRECTORY_SCHEMAS,
  nextKey,
  openDirectoryDatabase,
  OTHER_ADMIN,
  OUTSIDER,
  SIGNED_OUT,
  TEACHER_G1,
  GROUP_OTHER,
} from "./directory-support.ts";
import { asActor, count, failureOf } from "./identity-support.ts";
import { openDatabase, report, uuid } from "./stack-support.ts";
import {
  addMemberWithoutAccount,
  ADMIN_G1,
  ADMIN_G2,
  auditFor,
  caller,
  FAMILY_1,
  FAMILY_ADMIN_G1,
  GROUP_1,
  GROUP_2,
  GROUP_ARCHIVED,
  groupAdminWithoutMembership,
  MEMBERSHIP_ADMIN_G1,
  MEMBERSHIP_ADMIN_G2,
  MEMBERSHIP_F1,
  MEMBERSHIP_F2,
  membershipRow,
  openGrants,
  ORGANIZATION,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_ADMIN_G1,
  PARENT_ROW_CO,
  PARENT_ROW_F1,
  PARENT_ROW_NO_ACCOUNT,
  seedGroupWorld,
  SUPER_ADMIN,
} from "./working-groups-support.ts";

/**
 * The database rules of U4, working groups (BR40 to BR44), each on the fixed list of the unit's test plan:
 * allowed, refused, out of reach, outdated screen, repeated click, two at once. The cases that do not exist for a
 * rule, and why:
 *
 * - join, outdated screen: the command carries no version, so there is no screen it could be stale against;
 * - BR41.7 (the old grant path), outdated screen and two at once: the function refuses before it reads or writes any
 *   row, so there is neither a version to compare nor a state two callers could race over;
 * - BR41.8 (the invariant), everything but "allowed": it is a property of the data, checked after every writer here
 *   and under load in working-groups-races.test.ts;
 * - BR42 (the page) and BR43 (the facts): reads, so no stale screen, no repeated click and no race to lose;
 * - BR43.1 and BR44 (internal functions), out of reach: nobody signed in can execute them, checked directly.
 *
 * The four 50-run race tests live in working-groups-races.test.ts so they can be run on their own.
 */
type Result = Awaited<ReturnType<ReturnType<typeof caller>>>;
type Member = {
  membership_id: string;
  parent_id: string;
  full_name: string;
  phone?: string;
  email?: string;
  is_coordinator: boolean;
  is_self: boolean;
  version?: number;
};
type Page = Result & {
  group: {
    id: string;
    name: string;
    description: string;
    school_year_id: string;
    school_year_name: string;
  };
  has_coordinator: boolean;
  caller_is_parent: boolean;
  own_membership: { id: string; version: number } | null;
  members: Member[];
};

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`working groups in ${schema}`, () => {
    let db: pg.Client;
    let second: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
      second = await openDatabase();
    });
    after(async () => {
      await second.end();
      await db.end();
    });
    beforeEach(() => seedGroupWorld(db, schema));

    const call = caller(() => db, schema);
    const callSecond = caller(() => second, schema);
    const join = (account: string, group: string, key = nextKey("join")) =>
      call(account, "working_group_join($1, $2)", [key, group]);
    const leave = (account: string, membership: string, version: number, key = nextKey("leave")) =>
      call(account, "working_group_leave($1, $2, $3)", [key, membership, version]);
    const appoint = (account: string, membership: string, version: number, key = nextKey("app")) =>
      call(account, "coordinator_appoint($1, $2, $3)", [key, membership, version]);
    const revoke = (account: string, membership: string, version: number, key = nextKey("rev")) =>
      call(account, "coordinator_revoke($1, $2, $3)", [key, membership, version]);
    const detail = async (account: string, group: string) =>
      (await call(account, "working_group_detail($1)", [group])) as Page;
    const outcome = (result: Result) => [result.state, result.code];
    const versionOf = async (membership: string) => (await membershipRow(db, membership))!.version;
    const canManage = async (account: string, group: string) =>
      (await call(account, "can_manage_group($1)", [group])) as unknown as boolean;
    /** The membership id a parent got by joining (read from the result, then checked against the row). */
    async function joined(account: string, group: string): Promise<string> {
      const result = await join(account, group);
      assert.equal(result.state, "success");
      return result.reference!;
    }
    const authVersion = async (account: string) =>
      (
        await db.query(
          "select authorization_version from app_authorization_versions where subject_id = $1",
          [account],
        )
      ).rows[0].authorization_version as number;
    const notices = async (parent: string, kind: string) =>
      (
        await db.query(
          "select id, target_type, target_ref from notifications where parent_id = $1 and kind = $2",
          [parent, kind],
        )
      ).rows as { id: string; target_type: string; target_ref: string }[];
    const emails = async (parent: string, kind: string) =>
      (
        await db.query("select status from email_deliveries where parent_id = $1 and kind = $2", [
          parent,
          kind,
        ])
      ).rows as { status: string }[];

    describe("the migration shape", () => {
      it("gives every membership a version of 1, an end reason only when ended, and one end_admin", async () => {
        assert.equal(await count(db, "group_memberships", "version = 1 and end_reason is null"), 5);
        await assert.rejects(
          db.query(
            "update group_memberships set status = 'ended', ended_at = now() where id = $1",
            [MEMBERSHIP_F1],
          ),
          { code: "23514" },
        );
        await assert.rejects(
          db.query("update group_memberships set end_reason = 'left' where id = $1", [
            MEMBERSHIP_F1,
          ]),
          { code: "23514" },
        );
        const functions = await db.query(
          "select count(*)::int as n from pg_proc where proname = 'end_admin' and pronamespace = $1::regnamespace",
          [schema],
        );
        assert.equal(functions.rows[0].n, 1);
      });
    });

    describe("BR40.1 to BR40.3 join", () => {
      it("allowed: a parent joins an active group and is a member at once; other memberships stay", async () => {
        const first = await join(CO_PARENT_F1, GROUP_1);
        assert.deepEqual(outcome(first), ["success", null]);
        assert.equal(first.version, 1);
        const row = await membershipRow(db, first.reference!);
        assert.deepEqual(
          [row!.parent_id, row!.group_id, row!.status, row!.version, row!.end_reason],
          [PARENT_ROW_CO, GROUP_1, "active", 1, null],
        );
        // BR40.2: a second group changes nothing about the first.
        const other = await join(CO_PARENT_F1, GROUP_2);
        assert.equal(other.state, "success");
        assert.equal(
          await count(
            db,
            "group_memberships",
            `parent_id = '${PARENT_ROW_CO}' and status = 'active'`,
          ),
          2,
        );
        assert.equal((await membershipRow(db, first.reference!))!.status, "active");
        const page = await detail(CO_PARENT_F1, GROUP_1);
        assert.equal(page.own_membership!.id, first.reference);
        assert.deepEqual(await groupAdminWithoutMembership(db), []);
      });
      it("allowed: a coordinator of another group joins as a parent", async () => {
        assert.equal((await join(ADMIN_G1, GROUP_2)).state, "success");
      });
      it("refused: an archived, missing or other-community group gives one answer", async () => {
        for (const group of [GROUP_ARCHIVED, uuid(9999), GROUP_OTHER]) {
          assert.deepEqual(outcome(await join(CO_PARENT_F1, group)), [
            "denied",
            "GROUP_UNAVAILABLE",
          ]);
        }
        assert.equal(await count(db, "group_memberships", `parent_id = '${PARENT_ROW_CO}'`), 0);
      });
      it("refused: a teacher, a super admin without a parent, and callers without a session or a parent right", async () => {
        for (const account of [TEACHER_G1, SUPER_ADMIN, OUTSIDER]) {
          assert.deepEqual(outcome(await join(account, GROUP_1)), [
            "denied",
            "authorization_denied",
          ]);
        }
        for (const account of [DEACTIVATED, SIGNED_OUT]) {
          assert.deepEqual(outcome(await join(account, GROUP_1)), ["denied", "session_inactive"]);
        }
        assert.deepEqual(outcome(await join(CO_PARENT_F1, null as unknown as string)), [
          "validation",
          "request_invalid",
        ]);
      });
      it("out of reach: a parent of another community cannot join this one", async () => {
        assert.deepEqual(outcome(await join(OTHER_ADMIN, GROUP_1)), [
          "denied",
          "authorization_denied",
        ]);
      });
      it("repeated click: the same key returns the stored result and makes one membership", async () => {
        const key = nextKey("double");
        const first = await join(CO_PARENT_F1, GROUP_1, key);
        const again = await join(CO_PARENT_F1, GROUP_1, key);
        assert.deepEqual(outcome(again), ["success", "replayed"]);
        assert.equal(again.reference, first.reference);
        assert.equal(await count(db, "group_memberships", `parent_id = '${PARENT_ROW_CO}'`), 1);
        const reused = await join(CO_PARENT_F1, GROUP_2, key);
        assert.deepEqual(outcome(reused), ["conflict", "idempotency_key_reused"]);
      });
      it("repeated join with a new key: success with ALREADY_MEMBER and the existing membership", async () => {
        const first = await join(PARENT_F1, GROUP_1);
        assert.deepEqual(outcome(first), ["success", "ALREADY_MEMBER"]);
        assert.equal(first.reference, MEMBERSHIP_F1);
        assert.equal(
          await count(
            db,
            "group_memberships",
            `parent_id = '${PARENT_ROW_F1}' and group_id = '${GROUP_1}'`,
          ),
          1,
        );
      });
      it("two at once: two joins of one parent leave one membership; two parents both become members", async () => {
        const answers = await Promise.all([
          join(CO_PARENT_F1, GROUP_1),
          callSecond(CO_PARENT_F1, "working_group_join($1, $2)", [nextKey("join"), GROUP_1]),
        ]);
        assert.deepEqual(
          answers.map((answer) => answer.state),
          ["success", "success"],
        );
        assert.deepEqual(
          answers.map((answer) => answer.code).sort(),
          ["ALREADY_MEMBER", null].sort(),
        );
        assert.equal(answers[0].reference, answers[1].reference);
        assert.equal(
          await count(
            db,
            "group_memberships",
            `parent_id = '${PARENT_ROW_CO}' and status = 'active'`,
          ),
          1,
        );
        const both = await Promise.all([
          join(ADMIN_G2, GROUP_1),
          callSecond(PARENT_F2, "working_group_join($1, $2)", [nextKey("join"), GROUP_1]),
        ]);
        assert.deepEqual(both.map(outcome), [
          ["success", null],
          ["success", null],
        ]);
        assert.equal(
          await count(db, "group_memberships", `group_id = '${GROUP_1}' and status = 'active'`),
          5,
        );
      });
    });

    describe("BR40.4 to BR40.6 leave", () => {
      it("allowed: a member leaves; the row ends with the reason left, claims stay, the list drops them", async () => {
        const assignments = await count(db, "assignments", "family_id = '" + FAMILY_1 + "'");
        const result = await leave(PARENT_F1, MEMBERSHIP_F1, 1);
        assert.deepEqual(outcome(result), ["success", null]);
        const row = await membershipRow(db, MEMBERSHIP_F1);
        assert.deepEqual([row!.status, row!.end_reason, row!.version], ["ended", "left", 2]);
        assert.ok(row!.ended_at);
        assert.equal(await count(db, "assignments", "family_id = '" + FAMILY_1 + "'"), assignments);
        const page = await detail(ADMIN_G1, GROUP_1);
        assert.deepEqual(
          page.members.map((member) => member.parent_id),
          [PARENT_ROW_ADMIN_G1],
        );
        // Joining again makes a new membership; the ended row never comes back (entities.md).
        const again = await join(PARENT_F1, GROUP_1);
        assert.notEqual(again.reference, MEMBERSHIP_F1);
        assert.equal((await membershipRow(db, MEMBERSHIP_F1))!.status, "ended");
      });
      it("allowed: a coordinator who leaves loses the right in the same step, audited with the reason left_group", async () => {
        const before = await authVersion(ADMIN_G1);
        assert.equal(await canManage(ADMIN_G1, GROUP_1), true);
        const result = await leave(ADMIN_G1, MEMBERSHIP_ADMIN_G1, 1);
        assert.equal(result.state, "success");
        assert.deepEqual(await openGrants(db, ADMIN_G1), []);
        assert.equal(
          await canManage(ADMIN_G1, GROUP_1),
          false,
          "refused from the very next request",
        );
        assert.ok((await authVersion(ADMIN_G1)) > before);
        const events = await auditFor(db, ADMIN_G1, "role.revoke");
        assert.deepEqual(
          events.map((event) => [event.outcome, event.details, event.group_id]),
          [["success", "grant:group_admin:left_group", GROUP_1]],
        );
        assert.deepEqual(
          await notices(PARENT_ROW_ADMIN_G1, "coordinator_revoked"),
          [],
          "they acted themself: no notice",
        );
        assert.deepEqual(await groupAdminWithoutMembership(db), []);
      });
      it("allowed: leaving a group a super admin has archived", async () => {
        await db.query("update groups set status = 'archived' where id = $1", [GROUP_1]);
        assert.equal((await leave(PARENT_F1, MEMBERSHIP_F1, 1)).state, "success");
        assert.equal((await membershipRow(db, MEMBERSHIP_F1))!.status, "ended");
      });
      it("refused: a membership that already ended; a missing version", async () => {
        assert.equal((await leave(PARENT_F1, MEMBERSHIP_F1, 1)).state, "success");
        assert.deepEqual(outcome(await leave(PARENT_F1, MEMBERSHIP_F1, 2)), [
          "conflict",
          "NOT_A_MEMBER",
        ]);
        assert.deepEqual(
          outcome(await leave(PARENT_F2, MEMBERSHIP_F2, null as unknown as number)),
          ["validation", "request_invalid"],
        );
      });
      it("out of reach: someone else's membership and a missing one give the same denied result", async () => {
        const others = await leave(PARENT_F1, MEMBERSHIP_F2, 1);
        const missing = await leave(PARENT_F1, uuid(9998), 1);
        assert.deepEqual(outcome(others), ["denied", "authorization_denied"]);
        assert.deepEqual(others, { ...missing }, "the same envelope, down to the reference");
        for (const account of [SUPER_ADMIN, TEACHER_G1, OUTSIDER]) {
          assert.deepEqual(outcome(await leave(account, MEMBERSHIP_F1, 1)), [
            "denied",
            "authorization_denied",
          ]);
        }
        assert.equal((await membershipRow(db, MEMBERSHIP_F2))!.status, "active");
      });
      it("outdated screen: an appointment or a revocation since the page was loaded raises the version", async () => {
        // The member's page showed version 1; the super admin appoints and the parent's old page is stale.
        assert.equal((await appoint(SUPER_ADMIN, MEMBERSHIP_F1, 1)).state, "success");
        assert.deepEqual(outcome(await leave(PARENT_F1, MEMBERSHIP_F1, 1)), [
          "conflict",
          "VERSION_CONFLICT",
        ]);
        assert.equal((await membershipRow(db, MEMBERSHIP_F1))!.status, "active");
        assert.equal((await openGrants(db, PARENT_F1, GROUP_1)).length, 1);
        // The same after a revocation.
        assert.equal((await revoke(SUPER_ADMIN, MEMBERSHIP_F1, 2)).state, "success");
        assert.deepEqual(outcome(await leave(PARENT_F1, MEMBERSHIP_F1, 2)), [
          "conflict",
          "VERSION_CONFLICT",
        ]);
        assert.equal((await leave(PARENT_F1, MEMBERSHIP_F1, 3)).state, "success");
      });
      it("repeated click: the same key returns the stored result", async () => {
        const key = nextKey("leave");
        assert.equal((await leave(PARENT_F1, MEMBERSHIP_F1, 1, key)).state, "success");
        assert.deepEqual(outcome(await leave(PARENT_F1, MEMBERSHIP_F1, 1, key)), [
          "success",
          "replayed",
        ]);
        assert.equal((await membershipRow(db, MEMBERSHIP_F1))!.version, 2);
      });
      it("two at once: leave against appoint, and leave against revoke, end in one consistent state", async () => {
        const first = await Promise.all([
          leave(PARENT_F1, MEMBERSHIP_F1, 1),
          callSecond(SUPER_ADMIN, "coordinator_appoint($1, $2, $3)", [
            nextKey("app"),
            MEMBERSHIP_F1,
            1,
          ]),
        ]);
        const [left, appointed] = first;
        const row = await membershipRow(db, MEMBERSHIP_F1);
        if (left.state === "success") {
          assert.deepEqual(outcome(appointed), ["validation", "NOT_A_MEMBER"]);
          assert.equal(row!.status, "ended");
          assert.deepEqual(await openGrants(db, PARENT_F1), []);
        } else {
          assert.deepEqual(outcome(left), ["conflict", "VERSION_CONFLICT"]);
          assert.equal(appointed.state, "success");
          assert.equal(row!.status, "active");
          assert.equal((await openGrants(db, PARENT_F1)).length, 1);
        }
        assert.deepEqual(await groupAdminWithoutMembership(db), []);
        // Revoke against leave, on the coordinator of the second group.
        const second_ = await Promise.all([
          leave(ADMIN_G2, MEMBERSHIP_ADMIN_G2, 1),
          callSecond(SUPER_ADMIN, "coordinator_revoke($1, $2, $3)", [
            nextKey("rev"),
            MEMBERSHIP_ADMIN_G2,
            1,
          ]),
        ]);
        const [leftToo, revoked] = second_;
        if (leftToo.state === "success") {
          assert.deepEqual(outcome(revoked), ["conflict", "NOT_A_MEMBER"]);
        } else {
          assert.deepEqual(outcome(leftToo), ["conflict", "VERSION_CONFLICT"]);
          assert.equal(revoked.state, "success");
        }
        assert.deepEqual(await openGrants(db, ADMIN_G2), []);
        assert.deepEqual(await groupAdminWithoutMembership(db), []);
      });
    });

    describe("BR41.1 to BR41.6 appoint and revoke", () => {
      it("allowed: appoint a member, with several coordinators; revoke; a notice and an email each time", async () => {
        const membership = await joined(CO_PARENT_F1, GROUP_1);
        const appointed = await appoint(SUPER_ADMIN, membership, 1);
        assert.deepEqual(outcome(appointed), ["success", null]);
        assert.equal(appointed.version, 2);
        assert.equal((await membershipRow(db, membership))!.version, 2);
        // The existing coordinator keeps the right; the page lists both with the label.
        assert.equal((await openGrants(db, CO_PARENT_F1, GROUP_1)).length, 1);
        assert.equal((await openGrants(db, ADMIN_G1, GROUP_1)).length, 1);
        const page = await detail(PARENT_F1, GROUP_1);
        assert.deepEqual(
          page.members
            .filter((member) => member.is_coordinator)
            .map((member) => member.parent_id)
            .sort(),
          [PARENT_ROW_ADMIN_G1, PARENT_ROW_CO].sort(),
        );
        assert.equal(page.has_coordinator, true);
        const audit = await auditFor(db, CO_PARENT_F1, "role.grant");
        assert.deepEqual(
          audit.map((event) => [
            event.outcome,
            event.details,
            event.group_id,
            event.actor_account_id,
          ]),
          [["success", "grant:group_admin", GROUP_1, SUPER_ADMIN]],
        );
        assert.equal((await notices(PARENT_ROW_CO, "coordinator_appointed")).length, 1);
        assert.equal((await emails(PARENT_ROW_CO, "coordinator_appointed")).length, 1);
        assert.equal(await canManage(CO_PARENT_F1, GROUP_1), true);
        assert.deepEqual(await groupAdminWithoutMembership(db), []);

        const revoked = await revoke(SUPER_ADMIN, membership, 2);
        assert.deepEqual(outcome(revoked), ["success", null]);
        assert.equal(
          (await membershipRow(db, membership))!.status,
          "active",
          "the member stays in the group",
        );
        assert.equal((await membershipRow(db, membership))!.version, 3);
        assert.equal(
          await canManage(CO_PARENT_F1, GROUP_1),
          false,
          "refused from the very next request",
        );
        const events = await auditFor(db, CO_PARENT_F1, "role.revoke");
        assert.deepEqual(
          events.map((event) => event.details),
          ["grant:group_admin:revoked"],
        );
        assert.equal((await notices(PARENT_ROW_CO, "coordinator_revoked")).length, 1);
        assert.deepEqual(await groupAdminWithoutMembership(db), []);
      });
      it("allowed: appointing and then revoking one grant sends two notices and two emails, with the group link only", async () => {
        const membership = await joined(CO_PARENT_F1, GROUP_1);
        assert.equal((await appoint(SUPER_ADMIN, membership, 1)).state, "success");
        assert.equal((await revoke(SUPER_ADMIN, membership, 2)).state, "success");
        const all = await db.query(
          "select kind, dedupe_key, target_type, target_ref from notifications where parent_id = $1 and kind like 'coordinator_%' order by kind",
          [PARENT_ROW_CO],
        );
        assert.deepEqual(
          all.rows.map((row) => row.kind),
          ["coordinator_appointed", "coordinator_revoked"],
        );
        assert.ok(
          all.rows.every(
            (row) => row.target_type === "working_group" && row.target_ref === GROUP_1,
          ),
        );
        assert.equal(new Set(all.rows.map((row) => row.dedupe_key)).size, 2);
        assert.equal((await emails(PARENT_ROW_CO, "coordinator_appointed")).length, 1);
        assert.equal((await emails(PARENT_ROW_CO, "coordinator_revoked")).length, 1);
        const list = (await call(CO_PARENT_F1, "notification_list()")) as unknown as {
          items: { title: string; link: string; text: string | null }[];
        };
        assert.deepEqual(list.items.map((item) => item.title).sort(), [
          "Koordinátor lettél: Boróka",
          "Megszűnt a koordinátori jogod: Boróka",
        ]);
        assert.ok(list.items.every((item) => item.link === `/szulo/munkacsoportok/${GROUP_1}`));
        assert.ok(
          list.items.every((item) => item.text === null),
          "nothing but the title and the link",
        );
      });
      it("allowed: revoking in an archived group is allowed; appointing there is not", async () => {
        const membership = await joined(CO_PARENT_F1, GROUP_1);
        assert.equal((await appoint(SUPER_ADMIN, membership, 1)).state, "success");
        await db.query("update groups set status = 'archived' where id = $1", [GROUP_1]);
        assert.equal((await revoke(SUPER_ADMIN, membership, 2)).state, "success");
        assert.deepEqual(outcome(await appoint(SUPER_ADMIN, membership, 3)), [
          "denied",
          "GROUP_UNAVAILABLE",
        ]);
        assert.deepEqual(await groupAdminWithoutMembership(db), []);
      });
      it("refused: NOT_A_MEMBER, ACCOUNT_REQUIRED, ALREADY_COORDINATOR, NOT_COORDINATOR, GROUP_UNAVAILABLE", async () => {
        // Left meanwhile.
        const membership = await joined(CO_PARENT_F1, GROUP_1);
        assert.equal((await leave(CO_PARENT_F1, membership, 1)).state, "success");
        assert.deepEqual(outcome(await appoint(SUPER_ADMIN, membership, 2)), [
          "validation",
          "NOT_A_MEMBER",
        ]);
        assert.deepEqual(outcome(await revoke(SUPER_ADMIN, membership, 2)), [
          "conflict",
          "NOT_A_MEMBER",
        ]);
        // A member with no sign-in account.
        await addMemberWithoutAccount(db);
        assert.deepEqual(outcome(await appoint(SUPER_ADMIN, uuid(9423), 1)), [
          "validation",
          "ACCOUNT_REQUIRED",
        ]);
        assert.equal(
          await count(db, "app_role_grants", "role = 'group_admin' and revoked_at is null"),
          2,
        );
        // A member of an inactive family.
        await db.query(
          "update families set status = 'archived', archived_at = now() where id = $1",
          [FAMILY_1],
        );
        assert.deepEqual(outcome(await appoint(SUPER_ADMIN, MEMBERSHIP_F1, 1)), [
          "validation",
          "ACCOUNT_REQUIRED",
        ]);
        await db.query("update families set status = 'active', archived_at = null where id = $1", [
          FAMILY_1,
        ]);
        // Already a coordinator, and not a coordinator.
        assert.deepEqual(outcome(await appoint(SUPER_ADMIN, MEMBERSHIP_ADMIN_G1, 1)), [
          "conflict",
          "ALREADY_COORDINATOR",
        ]);
        assert.deepEqual(outcome(await revoke(SUPER_ADMIN, MEMBERSHIP_F1, 1)), [
          "conflict",
          "NOT_COORDINATOR",
        ]);
        // The group is not available: a missing membership, and a membership of another community.
        assert.deepEqual(outcome(await appoint(SUPER_ADMIN, uuid(9999), 1)), [
          "denied",
          "GROUP_UNAVAILABLE",
        ]);
        assert.deepEqual(outcome(await revoke(SUPER_ADMIN, uuid(9999), 1)), [
          "denied",
          "GROUP_UNAVAILABLE",
        ]);
        const other = (
          await db.query("select id from group_memberships where group_id = $1", [GROUP_OTHER])
        ).rows[0].id as string;
        assert.deepEqual(outcome(await appoint(SUPER_ADMIN, other, 1)), [
          "denied",
          "GROUP_UNAVAILABLE",
        ]);
        assert.deepEqual(outcome(await revoke(SUPER_ADMIN, other, 1)), [
          "denied",
          "GROUP_UNAVAILABLE",
        ]);
        assert.deepEqual(outcome(await appoint(SUPER_ADMIN, null as unknown as string, 1)), [
          "validation",
          "request_invalid",
        ]);
        // Nothing above changed a right or sent a notice.
        assert.equal((await notices(PARENT_ROW_CO, "coordinator_appointed")).length, 0);
        assert.deepEqual(await groupAdminWithoutMembership(db), []);
      });
      it("out of reach: a parent, a teacher and a coordinator of the same group are denied and audited, whatever they send", async () => {
        for (const account of [PARENT_F1, TEACHER_G1, ADMIN_G1, ADMIN_G2, OUTSIDER]) {
          assert.deepEqual(outcome(await appoint(account, MEMBERSHIP_F1, 1)), [
            "denied",
            "authorization_denied",
          ]);
          assert.deepEqual(outcome(await revoke(account, MEMBERSHIP_ADMIN_G1, 1)), [
            "denied",
            "authorization_denied",
          ]);
        }
        // A super admin of another community reaches no membership of this one.
        assert.deepEqual(outcome(await appoint(OTHER_ADMIN, MEMBERSHIP_F1, 1)), [
          "denied",
          "GROUP_UNAVAILABLE",
        ]);
        assert.deepEqual(outcome(await revoke(OTHER_ADMIN, MEMBERSHIP_ADMIN_G1, 1)), [
          "denied",
          "GROUP_UNAVAILABLE",
        ]);
        assert.deepEqual(outcome(await appoint(DEACTIVATED, MEMBERSHIP_F1, 1)), [
          "denied",
          "session_inactive",
        ]);
        assert.equal((await openGrants(db, PARENT_F1)).length, 0);
        assert.equal((await openGrants(db, ADMIN_G1)).length, 1);
        assert.equal((await membershipRow(db, MEMBERSHIP_F1))!.version, 1);
        const denied = await db.query(
          "select action from audit_events where outcome = 'denied' and actor_account_id = $1 order by occurred_at",
          [ADMIN_G1],
        );
        assert.deepEqual(
          denied.rows.map((row) => row.action),
          ["role.grant", "role.revoke"],
        );
      });
      it("outdated screen: a stale version is refused and nothing changes", async () => {
        assert.deepEqual(outcome(await appoint(SUPER_ADMIN, MEMBERSHIP_F1, 7)), [
          "conflict",
          "VERSION_CONFLICT",
        ]);
        assert.equal((await openGrants(db, PARENT_F1)).length, 0);
        assert.equal((await appoint(SUPER_ADMIN, MEMBERSHIP_F1, 1)).state, "success");
        assert.deepEqual(outcome(await revoke(SUPER_ADMIN, MEMBERSHIP_F1, 1)), [
          "conflict",
          "VERSION_CONFLICT",
        ]);
        assert.equal((await openGrants(db, PARENT_F1)).length, 1);
        assert.deepEqual(
          outcome(await appoint(SUPER_ADMIN, MEMBERSHIP_F1, null as unknown as number)),
          ["validation", "request_invalid"],
        );
      });
      it("repeated click: the same key returns the stored result and sends one notice", async () => {
        const key = nextKey("app");
        assert.equal((await appoint(SUPER_ADMIN, MEMBERSHIP_F1, 1, key)).state, "success");
        assert.deepEqual(outcome(await appoint(SUPER_ADMIN, MEMBERSHIP_F1, 1, key)), [
          "success",
          "replayed",
        ]);
        assert.equal((await notices(PARENT_ROW_F1, "coordinator_appointed")).length, 1);
        assert.equal(await versionOf(MEMBERSHIP_F1), 2);
        const revokeKey = nextKey("rev");
        assert.equal((await revoke(SUPER_ADMIN, MEMBERSHIP_F1, 2, revokeKey)).state, "success");
        assert.deepEqual(outcome(await revoke(SUPER_ADMIN, MEMBERSHIP_F1, 2, revokeKey)), [
          "success",
          "replayed",
        ]);
        assert.equal((await notices(PARENT_ROW_F1, "coordinator_revoked")).length, 1);
      });
      it("two at once: two appointments of one member, and two revocations of one coordinator", async () => {
        const appointments = await Promise.all([
          appoint(SUPER_ADMIN, MEMBERSHIP_F1, 1),
          callSecond(SUPER_ADMIN, "coordinator_appoint($1, $2, $3)", [
            nextKey("app"),
            MEMBERSHIP_F1,
            1,
          ]),
        ]);
        assert.deepEqual(appointments.map((result) => result.state).sort(), [
          "conflict",
          "success",
        ]);
        assert.equal(
          appointments.find((result) => result.state === "conflict")!.code,
          "ALREADY_COORDINATOR",
        );
        assert.equal((await openGrants(db, PARENT_F1)).length, 1);
        assert.equal((await notices(PARENT_ROW_F1, "coordinator_appointed")).length, 1);
        const revocations = await Promise.all([
          revoke(SUPER_ADMIN, MEMBERSHIP_F1, 2),
          callSecond(SUPER_ADMIN, "coordinator_revoke($1, $2, $3)", [
            nextKey("rev"),
            MEMBERSHIP_F1,
            2,
          ]),
        ]);
        assert.deepEqual(revocations.map((result) => result.state).sort(), ["conflict", "success"]);
        assert.equal(
          revocations.find((result) => result.state === "conflict")!.code,
          "NOT_COORDINATOR",
        );
        assert.equal((await openGrants(db, PARENT_F1)).length, 0);
        assert.equal((await notices(PARENT_ROW_F1, "coordinator_revoked")).length, 1);
      });
    });

    describe("BR41.7 the old grant path", () => {
      it("refused: group_admin cannot be added or revoked through the general function", async () => {
        const add = await call(
          SUPER_ADMIN,
          "grant_change($1, 'add', $2, 'group_admin', 'group', $3)",
          [nextKey("g"), PARENT_F1, GROUP_1],
        );
        assert.deepEqual(outcome(add), ["validation", "GRANT_USE_COORDINATOR_ACTION"]);
        const end = await call(
          SUPER_ADMIN,
          "grant_change($1, 'revoke', $2, 'group_admin', 'group', $3)",
          [nextKey("g"), ADMIN_G1, GROUP_1],
        );
        assert.deepEqual(outcome(end), ["validation", "GRANT_USE_COORDINATOR_ACTION"]);
        assert.equal((await openGrants(db, PARENT_F1)).length, 0);
        assert.equal((await openGrants(db, ADMIN_G1)).length, 1);
      });
      it("allowed: the other roles keep working through it", async () => {
        const result = await call(
          SUPER_ADMIN,
          "grant_change($1, 'add', $2, 'kindergarten_teacher', 'organization', $3)",
          [nextKey("g"), PARENT_F2, ORGANIZATION],
        );
        assert.equal(result.state, "success");
        const revoked = await call(
          SUPER_ADMIN,
          "grant_change($1, 'revoke', $2, 'kindergarten_teacher', 'organization', $3)",
          [nextKey("g"), PARENT_F2, ORGANIZATION],
        );
        assert.equal(revoked.state, "success");
      });
      it("out of reach: a non-admin is denied first, even when naming group_admin", async () => {
        for (const account of [PARENT_F1, ADMIN_G1, TEACHER_G1]) {
          const result = await call(
            account,
            "grant_change($1, 'add', $2, 'group_admin', 'group', $3)",
            [nextKey("g"), PARENT_F1, GROUP_1],
          );
          assert.deepEqual(outcome(result), ["denied", "authorization_denied"]);
        }
      });
      it("repeated click: the same key returns the stored refusal", async () => {
        const key = nextKey("g");
        const sql = "grant_change($1, 'add', $2, 'group_admin', 'group', $3)";
        await call(SUPER_ADMIN, sql, [key, PARENT_F1, GROUP_1]);
        assert.deepEqual(outcome(await call(SUPER_ADMIN, sql, [key, PARENT_F1, GROUP_1])), [
          "validation",
          "replayed",
        ]);
      });
    });

    describe("BR41.8 the invariant", () => {
      it("holds after every writer: join, appoint, revoke, leave and the removal step", async () => {
        const check = async (label: string) =>
          assert.deepEqual(await groupAdminWithoutMembership(db), [], `after ${label}`);
        await check("the world");
        const membership = await joined(CO_PARENT_F1, GROUP_1);
        await check("join");
        await appoint(SUPER_ADMIN, membership, 1);
        await check("appoint");
        await revoke(SUPER_ADMIN, membership, 2);
        await check("revoke");
        await appoint(SUPER_ADMIN, membership, 3);
        await leave(CO_PARENT_F1, membership, 4);
        await check("leave");
        await db.query("select working_groups_removal_apply('family', $1)", [FAMILY_ADMIN_G1]);
        await check("removal");
        assert.deepEqual(await openGrants(db, ADMIN_G1), []);
      });
      it("the helper can see a broken state", async () => {
        await db.query(
          "update group_memberships set status = 'ended', ended_at = now(), end_reason = 'left' where id = $1",
          [MEMBERSHIP_ADMIN_G1],
        );
        assert.equal((await groupAdminWithoutMembership(db)).length, 1);
      });
    });

    describe("BR42.1 to BR42.5 the group page", () => {
      it("allowed: every signed-in role reads an active group; the caller's own membership and the buttons' facts", async () => {
        for (const account of [
          PARENT_F1,
          CO_PARENT_F1,
          ADMIN_G1,
          ADMIN_G2,
          SUPER_ADMIN,
          TEACHER_G1,
        ]) {
          const page = await detail(account, GROUP_1);
          assert.equal(page.state, "success", account);
          assert.deepEqual(
            [page.group.id, page.group.name, page.group.school_year_name, page.has_coordinator],
            [GROUP_1, "Boróka", "2026/2027", true],
          );
          assert.deepEqual(
            page.members.map((member) => member.full_name),
            ["Első Koordinátor", "Fenyő Anna"],
          );
        }
        const parent = await detail(PARENT_F1, GROUP_1);
        assert.deepEqual(
          [parent.caller_is_parent, parent.own_membership],
          [true, { id: MEMBERSHIP_F1, version: 1 }],
        );
        const notMember = await detail(CO_PARENT_F1, GROUP_1);
        assert.deepEqual([notMember.caller_is_parent, notMember.own_membership], [true, null]);
        for (const account of [SUPER_ADMIN, TEACHER_G1]) {
          const page = await detail(account, GROUP_1);
          assert.deepEqual(
            [page.caller_is_parent, page.own_membership],
            [false, null],
            "no button for them",
          );
        }
      });
      it("refused: signed out, without a grant, without a session; never an empty page", async () => {
        assert.deepEqual(outcome(await detail(OUTSIDER, GROUP_1)), [
          "denied",
          "authorization_denied",
        ]);
        for (const account of [DEACTIVATED, SIGNED_OUT]) {
          assert.deepEqual(outcome(await detail(account, GROUP_1)), ["denied", "session_inactive"]);
        }
        const anonymous = await asActor(db, schema, { role: "anon" }, async () => {
          try {
            await db.query("select working_group_detail($1)", [GROUP_1]);
            return "allowed";
          } catch (error) {
            return (error as { code?: string }).code;
          }
        });
        assert.equal(anonymous, "42501");
      });
      it("out of reach: an archived, missing or other-community group gives one answer", async () => {
        for (const group of [GROUP_ARCHIVED, uuid(9999), GROUP_OTHER]) {
          for (const account of [PARENT_F1, SUPER_ADMIN, TEACHER_G1]) {
            assert.deepEqual(outcome(await detail(account, group)), [
              "denied",
              "GROUP_UNAVAILABLE",
            ]);
          }
        }
        assert.deepEqual(outcome(await detail(OTHER_ADMIN, GROUP_1)), [
          "denied",
          "GROUP_UNAVAILABLE",
        ]);
      });
      it("the 'who sees what' matrix: name for all, phone and email only where the directory allows", async () => {
        await joined(CO_PARENT_F1, GROUP_1);
        await addMemberWithoutAccount(db);
        // Anna shares; the first coordinator does not; Béla (the co-parent) ticks the box but is not shared by default.
        await db.query("update parent_profiles set sharing_consent = true where parent_id = $1", [
          PARENT_ROW_F1,
        ]);
        await db.query("update parent_profiles set sharing_consent = false where parent_id = $1", [
          PARENT_ROW_ADMIN_G1,
        ]);
        await db.query("update parent_profiles set sharing_consent = false where parent_id = $1", [
          PARENT_ROW_CO,
        ]);
        await db.query(
          "insert into parent_profiles (parent_id, organization_id, email_on_record, phone) values ($1, $2, 'koordinator@example.test', '+36 30 111 2222') on conflict (parent_id) do nothing",
          [PARENT_ROW_ADMIN_G1, ORGANIZATION],
        );
        const contacts = (page: Page) =>
          Object.fromEntries(
            page.members.map((member) => [
              member.parent_id,
              [member.phone ?? null, member.email ?? null],
            ]),
          );
        const hidden = [null, null];
        // A parent viewer (not a member of the account-less one): shared Anna visible, others hidden, self visible.
        const asBela = contacts(await detail(CO_PARENT_F1, GROUP_1));
        assert.deepEqual(asBela[PARENT_ROW_F1], [
          "+36 30 111 2222",
          `identity.${PARENT_F1}@example.test`,
        ]);
        assert.deepEqual(asBela[PARENT_ROW_ADMIN_G1], hidden);
        assert.notDeepEqual(asBela[PARENT_ROW_CO], hidden, "themself");
        assert.deepEqual(
          asBela[PARENT_ROW_NO_ACCOUNT],
          hidden,
          "ticked, but no active account: not shared",
        );
        // A coordinator is a parent for this purpose: the same.
        const asCoordinator = contacts(await detail(ADMIN_G1, GROUP_1));
        assert.notDeepEqual(asCoordinator[PARENT_ROW_F1], hidden);
        assert.notDeepEqual(asCoordinator[PARENT_ROW_ADMIN_G1], hidden);
        assert.deepEqual(asCoordinator[PARENT_ROW_CO], hidden);
        assert.deepEqual(asCoordinator[PARENT_ROW_NO_ACCOUNT], hidden);
        // Teachers and super admins see everyone's.
        for (const account of [TEACHER_G1, SUPER_ADMIN]) {
          const everyone = contacts(await detail(account, GROUP_1));
          for (const [id, value] of Object.entries(everyone))
            assert.notDeepEqual(value, hidden, id);
        }
        // Only the super admin gets the version; nobody gets a profile field or a child.
        const page = await detail(SUPER_ADMIN, GROUP_1);
        assert.ok(page.members.every((member) => typeof member.version === "number"));
        for (const account of [PARENT_F1, TEACHER_G1]) {
          assert.ok(
            (await detail(account, GROUP_1)).members.every(
              (member) => member.version === undefined,
            ),
          );
        }
        const allowedKeys = [
          "membership_id",
          "parent_id",
          "full_name",
          "is_coordinator",
          "is_self",
          "email",
          "phone",
          "version",
        ];
        for (const account of [PARENT_F1, TEACHER_G1, SUPER_ADMIN]) {
          for (const member of (await detail(account, GROUP_1)).members) {
            assert.ok(
              Object.keys(member).every((key) => allowedKeys.includes(key)),
              Object.keys(member).join(),
            );
          }
        }
        assert.ok(
          !JSON.stringify(await detail(SUPER_ADMIN, GROUP_1)).includes("Fenyő Gergő"),
          "no child",
        );
      });
      it("the directory and the group page show the same phone and email for the same viewer and member", async () => {
        await joined(CO_PARENT_F1, GROUP_1);
        await addMemberWithoutAccount(db);
        await db.query("update parent_profiles set sharing_consent = true where parent_id = $1", [
          PARENT_ROW_F1,
        ]);
        const parentIds = [
          PARENT_ROW_F1,
          PARENT_ROW_ADMIN_G1,
          PARENT_ROW_CO,
          PARENT_ROW_NO_ACCOUNT,
        ];
        for (const viewer of [PARENT_F1, CO_PARENT_F1, ADMIN_G1, TEACHER_G1, SUPER_ADMIN]) {
          const directory = (await call(viewer, "directory_list()")) as unknown as {
            items: { parents: { id: string; phone?: string; email?: string }[] }[];
          };
          const listed = new Map(
            directory.items
              .flatMap((family) => family.parents)
              .map((parent) => [parent.id, parent]),
          );
          const page = await detail(viewer, GROUP_1);
          for (const member of page.members) {
            assert.ok(parentIds.includes(member.parent_id));
            const entry = listed.get(member.parent_id)!;
            assert.deepEqual(
              [member.phone ?? null, member.email ?? null],
              [entry.phone ?? null, entry.email ?? null],
              `${viewer} reading ${member.parent_id}`,
            );
          }
        }
      });
      it("the no-coordinator notice and who can manage an empty group", async () => {
        assert.equal((await detail(PARENT_F1, GROUP_1)).has_coordinator, true);
        assert.equal((await revoke(SUPER_ADMIN, MEMBERSHIP_ADMIN_G1, 1)).state, "success");
        const page = await detail(PARENT_F1, GROUP_1);
        assert.equal(page.has_coordinator, false);
        assert.deepEqual(
          page.members.map((member) => member.is_coordinator),
          [false, false],
        );
        assert.equal(await canManage(SUPER_ADMIN, GROUP_1), true);
        assert.equal(await canManage(ADMIN_G1, GROUP_1), false);
        assert.equal(await canManage(PARENT_F1, GROUP_1), false);
      });
      it("a coordinator whose parent or family is no longer active is not listed as one, nor is a removed member", async () => {
        await db.query("update parents set status = 'archived' where id = $1", [
          PARENT_ROW_ADMIN_G1,
        ]);
        const page = await detail(PARENT_F1, GROUP_1);
        assert.deepEqual(
          page.members.map((member) => member.parent_id),
          [PARENT_ROW_F1],
        );
        assert.equal(page.has_coordinator, false);
      });
      it("an empty group lists no one and still answers", async () => {
        await db.query(
          "update group_memberships set status = 'ended', ended_at = now(), end_reason = 'left' where group_id = $1",
          [GROUP_2],
        );
        const page = await detail(TEACHER_G1, GROUP_2);
        assert.deepEqual([page.state, page.members, page.has_coordinator], ["success", [], false]);
      });
    });

    describe("BR43.1 the facts for other units", () => {
      it("allowed: ids only, ordered, and the coordinators among the members; nothing for an unknown group", async () => {
        const membership = await joined(CO_PARENT_F1, GROUP_1);
        await appoint(SUPER_ADMIN, membership, 1);
        const members = (await db.query("select group_members($1) as ids", [GROUP_1])).rows[0]
          .ids as string[];
        const coordinators = (await db.query("select group_coordinators($1) as ids", [GROUP_1]))
          .rows[0].ids as string[];
        assert.deepEqual(members, [PARENT_ROW_F1, PARENT_ROW_CO, PARENT_ROW_ADMIN_G1].sort());
        assert.deepEqual(coordinators, [PARENT_ROW_CO, PARENT_ROW_ADMIN_G1].sort());
        assert.deepEqual(
          (await db.query("select group_members($1) as ids", [uuid(9999)])).rows[0].ids,
          [],
        );
        assert.deepEqual(
          (await db.query("select group_coordinators($1) as ids", [uuid(9999)])).rows[0].ids,
          [],
        );
        // The facts name a group by id and are for other units' functions: another community's group answers for itself.
        assert.deepEqual(
          (await db.query("select group_coordinators($1) as ids", [GROUP_OTHER])).rows[0].ids,
          [],
        );
        // A removed parent, an inactive family and an ended membership drop out.
        await db.query("update parents set status = 'archived' where id = $1", [PARENT_ROW_CO]);
        assert.deepEqual(
          (await db.query("select group_coordinators($1) as ids", [GROUP_1])).rows[0].ids,
          [PARENT_ROW_ADMIN_G1],
        );
        await db.query(
          "update families set status = 'archived', archived_at = now() where id = $1",
          [FAMILY_ADMIN_G1],
        );
        assert.deepEqual(
          (await db.query("select group_members($1) as ids", [GROUP_1])).rows[0].ids,
          [PARENT_ROW_F1],
        );
      });
      it("out of reach: no signed-in role can execute the facts, the removal steps or the helpers", async () => {
        const internal = [
          "group_members($1)",
          "group_coordinators($1)",
          "working_groups_removal_preview('parent', $1)",
          "working_groups_removal_apply('parent', $1)",
          "directory_parent_shares($1)",
          "directory_parent_email($1)",
          "end_admin($1, $1)",
          "end_admin($1, $1, 'revoked')",
          "grant_admin($1, $1)",
          "notice_facts_working_group($1, $1, 'coordinator_revoked')",
        ];
        for (const role of ["authenticated", "anon", "service_role"] as const) {
          for (const sql of internal) {
            const error = await failureOf(() =>
              asActor(
                db,
                schema,
                { role, account: role === "anon" ? undefined : SUPER_ADMIN },
                () => db.query(`select ${sql}`, [GROUP_1]),
              ),
            );
            assert.ok(
              error?.code === "42501" || error?.code === "42883",
              `${role} ${sql}: ${error?.code ?? "allowed"}`,
            );
          }
        }
      });
    });

    describe("BR44.1 and BR44.2 the removal steps", () => {
      const preview = async (kind: string, id: string) =>
        (await db.query("select working_groups_removal_preview($1, $2) as r", [kind, id])).rows[0]
          .r as { to_clear: number; to_flag: number };
      const apply = async (kind: string, id: string) =>
        (await db.query("select working_groups_removal_apply($1, $2) as r", [kind, id])).rows[0]
          .r as { to_clear: number; to_flag: number };

      it("allowed: a coordinator, a member without a grant, a parent without an account", async () => {
        await addMemberWithoutAccount(db);
        assert.deepEqual(await preview("parent", PARENT_ROW_ADMIN_G1), { to_clear: 2, to_flag: 0 });
        assert.deepEqual(await preview("parent", PARENT_ROW_F1), { to_clear: 1, to_flag: 0 });
        assert.deepEqual(await preview("parent", PARENT_ROW_NO_ACCOUNT), {
          to_clear: 1,
          to_flag: 0,
        });
        assert.deepEqual(await apply("parent", PARENT_ROW_ADMIN_G1), { to_clear: 2, to_flag: 0 });
        assert.deepEqual(await apply("parent", PARENT_ROW_F1), { to_clear: 1, to_flag: 0 });
        assert.deepEqual(await apply("parent", PARENT_ROW_NO_ACCOUNT), { to_clear: 1, to_flag: 0 });
        const row = await membershipRow(db, MEMBERSHIP_ADMIN_G1);
        assert.deepEqual([row!.status, row!.end_reason, row!.version], ["ended", "removed", 2]);
        assert.deepEqual(await openGrants(db, ADMIN_G1), []);
        const events = await auditFor(db, ADMIN_G1, "role.revoke");
        assert.deepEqual(
          events.map((event) => event.details),
          ["grant:group_admin:removed"],
        );
        assert.deepEqual(
          await notices(PARENT_ROW_ADMIN_G1, "coordinator_revoked"),
          [],
          "no notice",
        );
        assert.deepEqual(await groupAdminWithoutMembership(db), []);
      });
      it("allowed: a family, summed over its parents; unknown subjects count zero", async () => {
        await joined(CO_PARENT_F1, GROUP_2);
        assert.deepEqual(await preview("family", FAMILY_1), { to_clear: 2, to_flag: 0 });
        assert.deepEqual(await apply("family", FAMILY_1), { to_clear: 2, to_flag: 0 });
        assert.equal(
          await count(
            db,
            "group_memberships",
            `parent_id in ('${PARENT_ROW_F1}', '${PARENT_ROW_CO}') and status = 'active'`,
          ),
          0,
        );
        assert.deepEqual(await preview("family", uuid(9999)), { to_clear: 0, to_flag: 0 });
        assert.deepEqual(await apply("parent", uuid(9999)), { to_clear: 0, to_flag: 0 });
        assert.deepEqual(await apply("household", FAMILY_1), { to_clear: 0, to_flag: 0 });
      });
      it("repeated click: applying twice ends nothing twice", async () => {
        assert.deepEqual(await apply("parent", PARENT_ROW_ADMIN_G1), { to_clear: 2, to_flag: 0 });
        assert.deepEqual(await apply("parent", PARENT_ROW_ADMIN_G1), { to_clear: 0, to_flag: 0 });
        assert.equal((await auditFor(db, ADMIN_G1, "role.revoke")).length, 1);
        assert.equal((await membershipRow(db, MEMBERSHIP_ADMIN_G1))!.version, 2);
      });
      it("the whole removal of a coordinator, with U4's block before U3's: nothing is left behind", async () => {
        const membership = await joined(CO_PARENT_F1, GROUP_1);
        await appoint(SUPER_ADMIN, membership, 1);
        assert.deepEqual(await preview("parent", PARENT_ROW_CO), { to_clear: 2, to_flag: 0 });
        await db.query("begin");
        try {
          await apply("parent", PARENT_ROW_CO);
          await db.query("select directory_removal_apply('parent', $1)", [PARENT_ROW_CO]);
          await db.query("commit");
        } catch (error) {
          await db.query("rollback");
          throw error;
        }
        assert.deepEqual(await openGrants(db, CO_PARENT_F1), []);
        assert.equal((await membershipRow(db, membership))!.end_reason, "removed");
        assert.deepEqual(await groupAdminWithoutMembership(db), []);
        assert.equal(
          (await db.query("select account_id from parents where id = $1", [PARENT_ROW_CO])).rows[0]
            .account_id,
          null,
        );
      });
      it("two at once: join against the removal of the same parent ends with no active membership or a refused join", async () => {
        const raced = await Promise.all([
          join(CO_PARENT_F1, GROUP_1),
          (async () => {
            await second.query("begin");
            try {
              await second.query(`set local search_path to "${schema}", pg_catalog`);
              const result = await second.query(
                "select working_groups_removal_apply('parent', $1) as r",
                [PARENT_ROW_CO],
              );
              await second.query("select directory_removal_apply('parent', $1)", [PARENT_ROW_CO]);
              await second.query("commit");
              return result.rows[0].r;
            } catch (error) {
              await second.query("rollback");
              throw error;
            }
          })(),
        ]);
        const [joinResult] = raced;
        assert.ok(["success", "denied"].includes(joinResult.state));
        assert.equal(
          await count(
            db,
            "group_memberships",
            `parent_id = '${PARENT_ROW_CO}' and status = 'active'`,
          ),
          0,
        );
        assert.deepEqual(await groupAdminWithoutMembership(db), []);
      });
    });

    describe("the family lifecycle ends coordinator rights (BR41.8, NFR11.4)", () => {
      it("a deleted family's coordinator loses the right first, with the reason removed and no notice", async () => {
        await db.query("update parents set status = 'archived' where family_id = $1", [
          FAMILY_ADMIN_G1,
        ]);
        await db.query(
          "update families set status = 'archived', archived_at = now() - interval '40 days' where id = $1",
          [FAMILY_ADMIN_G1],
        );
        const version = (
          await db.query("select version from families where id = $1", [FAMILY_ADMIN_G1])
        ).rows[0].version as number;
        const result = await call(SUPER_ADMIN, "lifecycle_run($1, $2, $3, true)", [
          nextKey("lc"),
          FAMILY_ADMIN_G1,
          version,
        ]);
        assert.equal(result.state, "success");
        assert.deepEqual(await openGrants(db, ADMIN_G1), []);
        const events = await auditFor(db, ADMIN_G1, "role.revoke");
        assert.deepEqual(
          events.map((event) => event.details),
          ["grant:group_admin:removed"],
        );
        assert.equal(
          await count(db, "group_memberships", `parent_id = '${PARENT_ROW_ADMIN_G1}'`),
          0,
        );
        assert.deepEqual(await notices(PARENT_ROW_ADMIN_G1, "coordinator_revoked"), []);
        assert.deepEqual(await groupAdminWithoutMembership(db), []);
        assert.equal(await canManage(ADMIN_G1, GROUP_1), false);
      });
    });

    describe("timing on the large data set (NFR9.9, NFR9.10)", () => {
      it("reads a group page of about 40 members and runs the commands inside the 2-second target", async () => {
        await loadDataset(db);
        await db.query(
          `insert into group_memberships (organization_id, parent_id, group_id)
           select $1, ('cccccccc-0000-4000-8000-' || lpad((4000 + n)::text, 12, '0'))::uuid, $2
             from generate_series(0, ${DATASET.families - 1}) n
            where n % 10 <> 0 and n < 45
           on conflict do nothing`,
          [ORGANIZATION, GROUP_1],
        );
        await db.query("analyze");
        const members = (await detail(SUPER_ADMIN, GROUP_1)).members.length;
        assert.ok(members >= 40, `${members} members`);
        const timed = async (label: string, work: () => Promise<Result>) => {
          const started = performance.now();
          const result = await work();
          const elapsed = performance.now() - started;
          report(`${label} in ${schema}: ${elapsed.toFixed(0)} ms`);
          assert.ok(elapsed < 2000, `${label}: ${elapsed.toFixed(0)} ms`);
          return result;
        };
        await detail(PARENT_F1, GROUP_1);
        for (const viewer of [PARENT_F1, TEACHER_G1, SUPER_ADMIN]) {
          const page = (await timed(`group page for ${viewer.slice(-2)}`, () =>
            call(viewer, "working_group_detail($1)", [GROUP_1]),
          )) as Page;
          assert.equal(page.state, "success");
        }
        const fresh = await timed("join", () => join(CO_PARENT_F1, GROUP_1));
        assert.equal(fresh.state, "success");
        const appointed = await timed("appoint", () => appoint(SUPER_ADMIN, fresh.reference!, 1));
        assert.equal(appointed.state, "success");
        assert.equal(
          (await timed("revoke", () => revoke(SUPER_ADMIN, fresh.reference!, 2))).state,
          "success",
        );
        assert.equal(
          (await timed("leave", () => leave(CO_PARENT_F1, fresh.reference!, 3))).state,
          "success",
        );
      });
    });
  });
}
