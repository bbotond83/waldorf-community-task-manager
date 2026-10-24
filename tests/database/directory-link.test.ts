import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  callFunction,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  FAMILY_2,
  nextKey,
  openDirectoryDatabase,
  ORGANIZATION,
  OUTSIDER,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  seedCoordinationWorld,
  SUPER_ADMIN,
  TASK_1,
  uuid,
} from "./directory-support.ts";
import {
  asServiceRole,
  auditEvents,
  callAs,
  count,
  sessionIdFor,
  tokenHashFor,
} from "./identity-support.ts";
import { openDatabase } from "./stack-support.ts";

type Result = Awaited<ReturnType<typeof callFunction>>;

const PARENT_NEW = uuid(610);
const PARENT_NEW_2 = uuid(611);

/**
 * Linking an accepted invitation to its target parent in one transaction, the refusals that leave the
 * invitation pending, and the races for one link (BR30.3, BR32.3, NFR3.11, NFR6.10).
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`invitation link for a parent in ${schema}`, () => {
    let db: pg.Client;

    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedCoordinationWorld(db, schema);
      // Two parents without an account: the targets of the invitations.
      await db.query(
        "insert into parents (id, organization_id, family_id, display_name) values ($1, $3, $4, 'Fenyő Gábor'), ($2, $3, $5, 'Napraforgó Hajnal')",
        [PARENT_NEW, PARENT_NEW_2, ORGANIZATION, FAMILY_1, FAMILY_2],
      );
    });

    const email = (tag: string) => `${schema}.${tag}@example.test`;
    const create = (
      email: string,
      label: string,
      target: string | null,
      family = FAMILY_1,
      role = "parent",
      scopeType = "family",
    ): Promise<Result> =>
      callFunction(db, schema, SUPER_ADMIN, "invitation_create($1, $2, $3, $4, $5, $6, $7)", [
        nextKey("inv"),
        email,
        role,
        scopeType,
        family,
        tokenHashFor(label),
        target,
      ]);
    const service = (client: pg.Client, sql: string, values: unknown[]) =>
      callAs(client, schema, asServiceRole, sql, values);
    const reserve = (client: pg.Client, label: string) =>
      service(client, "invitation_reserve($1, $2)", [nextKey("rv"), tokenHashFor(label)]);
    const signInUser = async (address: string, invitationId: string) => {
      const id = randomUUID();
      await db.query(
        "insert into auth.users (id, aud, role, email, raw_app_meta_data, created_at, updated_at) values ($1, 'authenticated', 'authenticated', $2, $3, now(), now())",
        [id, address, JSON.stringify({ invitation_id: invitationId })],
      );
      return id;
    };
    const accept = (client: pg.Client, invitation: string, user: string) =>
      service(client, "invitation_accept($1, $2, $3)", [nextKey("ac"), invitation, user]);
    const status = async (invitation: string) =>
      (await db.query("select status, reserved_at from invitations where id = $1", [invitation]))
        .rows[0] as {
        status: string;
        reserved_at: unknown;
      };
    const accountOf = async (parent: string) =>
      (await db.query("select account_id from parents where id = $1", [parent])).rows[0]
        .account_id as string | null;

    async function invited(tag: string, target: string | null, family = FAMILY_1) {
      const address = email(tag);
      const made = await create(address, tag, target, family);
      assert.equal(made.state, "success", `${tag}: ${made.code}`);
      const reserved = await reserve(db, tag);
      assert.equal(reserved.state, "success");
      return { id: made.reference!, user: await signInUser(address, made.reference!), address };
    }

    it("creates the account, the grant and the link in one transaction, and the parent then sees their family's tasks (W14)", async () => {
      const { id, user } = await invited("link", PARENT_NEW);
      const accepted = await accept(db, id, user);
      assert.equal(accepted.state, "success");
      assert.equal(await accountOf(PARENT_NEW), user);
      assert.equal(await count(db, "accounts", `id = '${user}'`), 1);
      assert.equal(
        await count(
          db,
          "app_role_grants",
          `subject_id = '${user}' and role = 'parent' and scope_id = '${FAMILY_1}' and revoked_at is null`,
        ),
        1,
      );
      assert.equal((await status(id)).status, "accepted");
      assert.deepEqual(
        (await auditEvents(db)).map((event) => [event.action, event.target_id, event.actor_role]),
        [["role.grant", id, "system"]],
      );
      await db.query(
        "insert into auth.sessions (id, user_id, created_at, updated_at, refreshed_at) values ($1, $2, now(), now(), now() at time zone 'utc')",
        [sessionIdFor(user), user],
      );
      const list = await callFunction(db, schema, user, "duty_list()");
      assert.equal(list.state, "success");
      assert.ok(
        (list.items as { id: string }[]).some((item) => item.id === TASK_1),
        "the new parent sees the family's tasks",
      );
    });

    it("links nothing for an invitation without a target parent and still grants the family role", async () => {
      const { id, user } = await invited("untargeted", null);
      assert.equal((await accept(db, id, user)).state, "success");
      assert.equal(await count(db, "parents", `account_id = '${user}'`), 0);
      assert.equal(await count(db, "app_role_grants", `subject_id = '${user}'`), 1);
    });

    it("refuses a target that is already linked, leaves the invitation pending and creates nothing (BR30.3)", async () => {
      const { id, user } = await invited("taken", PARENT_ROW_F1);
      const refused = await accept(db, id, user);
      assert.deepEqual([refused.state, refused.code], ["conflict", "PARENT_ALREADY_LINKED"]);
      assert.deepEqual(
        [(await status(id)).status, (await status(id)).reserved_at],
        ["pending", null],
      );
      assert.equal(await count(db, "accounts", `id = '${user}'`), 0);
      assert.equal(await count(db, "app_role_grants", `subject_id = '${user}'`), 0);
      assert.notEqual(await accountOf(PARENT_ROW_F1), user);
      assert.equal(await count(db, "audit_events"), 0);
    });

    it("refuses a target that became archived, or whose family did, and leaves the invitation pending", async () => {
      const first = await invited("archived-parent", PARENT_NEW);
      await db.query("update parents set status = 'archived' where id = $1", [PARENT_NEW]);
      const refusedParent = await accept(db, first.id, first.user);
      assert.deepEqual([refusedParent.state, refusedParent.code], ["conflict", "TARGET_INVALID"]);
      assert.equal((await status(first.id)).status, "pending");
      const second = await invited("archived-family", PARENT_NEW_2, FAMILY_2);
      await db.query("update families set status = 'archived', archived_at = now() where id = $1", [
        FAMILY_2,
      ]);
      const refusedFamily = await accept(db, second.id, second.user);
      assert.deepEqual([refusedFamily.state, refusedFamily.code], ["conflict", "TARGET_INVALID"]);
      assert.equal((await status(second.id)).status, "pending");
      assert.equal(await count(db, "accounts", `id in ('${first.user}', '${second.user}')`), 0);
    });

    it("refuses a wrong target when the invitation is created: another family, a missing parent, an archived parent, a teacher invitation (BR32.3)", async () => {
      const cases: [string, Promise<Result>][] = [
        ["a parent of another family", create(email("t1"), "t1", PARENT_ROW_F2)],
        ["a missing parent", create(email("t2"), "t2", uuid(99999))],
        [
          "a teacher invitation with a target",
          create(email("t3"), "t3", PARENT_NEW, uuid(101), "kindergarten_teacher", "group"),
        ],
      ];
      for (const [label, pending] of cases) {
        const result = await pending;
        assert.deepEqual([result.state, result.code], ["validation", "target_not_found"], label);
      }
      await db.query("update parents set status = 'archived' where id = $1", [PARENT_NEW]);
      assert.equal(
        (await create(email("t4"), "t4", PARENT_NEW)).code,
        "target_not_found",
        "an archived parent",
      );
      assert.equal(await count(db, "invitations"), 0, "no invitation was stored");
      assert.equal(
        (await create(email("t5"), "t5", PARENT_NEW_2, FAMILY_2)).state,
        "success",
        "a parent of the family is a valid target",
      );
    });

    it("ends with exactly one link when two invitations for the same parent are accepted at the same time (NFR3.11)", async () => {
      const connections = [await openDatabase(), await openDatabase()];
      try {
        // Two addresses, so both invitations for the same parent are open at once.
        const a = await invited("race-a", PARENT_NEW);
        const b = await invited("race-b", PARENT_NEW);
        const answers = await Promise.all([
          accept(connections[0]!, a.id, a.user),
          accept(connections[1]!, b.id, b.user),
        ]);
        assert.equal(answers.filter((answer) => answer.state === "success").length, 1);
        const loser = answers.find((answer) => answer.state !== "success")!;
        assert.deepEqual([loser.state, loser.code], ["conflict", "PARENT_ALREADY_LINKED"]);
        const winner = answers[0]!.state === "success" ? a : b;
        const other = winner === a ? b : a;
        assert.equal(await accountOf(PARENT_NEW), winner.user);
        assert.equal(await count(db, "accounts", `id in ('${a.user}', '${b.user}')`), 1);
        assert.equal((await status(other.id)).status, "pending");
        assert.equal((await status(winner.id)).status, "accepted");
      } finally {
        await Promise.all(connections.map((connection) => connection.end()));
      }
    });

    it("ends with exactly one link when a super admin links the same account to two parents at the same time (BR30.3)", async () => {
      const connections = [await openDatabase(), await openDatabase()];
      try {
        const family = async (id: string) =>
          (await db.query("select version from families where id = $1", [id])).rows[0]
            .version as number;
        const link = (
          client: pg.Client,
          familyId: string,
          version: number,
          parent: string,
          name: string,
        ) =>
          callFunction(client, schema, SUPER_ADMIN, "directory_save($1, $2::jsonb)", [
            nextKey("lk"),
            JSON.stringify({
              family_id: familyId,
              expected_version: version,
              display_name: "Család",
              parents: [
                { id: parent, expected_version: 1, display_name: name, account_id: OUTSIDER },
              ],
            }),
          ]);
        const answers = await Promise.all([
          link(connections[0]!, FAMILY_1, await family(FAMILY_1), PARENT_NEW, "Fenyő Gábor"),
          link(
            connections[1]!,
            FAMILY_2,
            await family(FAMILY_2),
            PARENT_NEW_2,
            "Napraforgó Hajnal",
          ),
        ]);
        assert.equal(answers.filter((answer) => answer.state === "success").length, 1);
        assert.equal(
          answers.find((answer) => answer.state !== "success")!.code,
          "ACCOUNT_ALREADY_LINKED",
        );
        assert.equal(await count(db, "parents", `account_id = '${OUTSIDER}'`), 1);
      } finally {
        await Promise.all(connections.map((connection) => connection.end()));
      }
    });

    it("rolls the whole acceptance back when a later step fails: no account, no grant, no link (NFR6.10)", async () => {
      const { id, user } = await invited("rollback", PARENT_NEW);
      await db.query(
        `create function refuse_account_insert() returns trigger language plpgsql as $$ begin
           raise exception 'injected failure' using errcode = 'XX000'; end $$`,
      );
      await db.query(
        "create trigger refuse_account_insert before insert on accounts for each row execute function refuse_account_insert()",
      );
      try {
        const failure = await accept(db, id, user).then(
          () => undefined,
          (error: Error & { code?: string }) => error,
        );
        assert.equal(failure?.code, "XX000");
      } finally {
        await db.query("drop trigger refuse_account_insert on accounts");
        await db.query("drop function refuse_account_insert()");
      }
      assert.equal(await accountOf(PARENT_NEW), null, "the link was rolled back with the rest");
      assert.equal(await count(db, "app_role_grants", `subject_id = '${user}'`), 0);
      assert.equal(await count(db, "accounts", `id = '${user}'`), 0);
      assert.equal(
        (await status(id)).status,
        "accepting",
        "the reservation is still the caller's to release",
      );
      assert.equal(await count(db, "audit_events"), 0);
    });

    it("keeps the accept function out of reach of every role but the service role (BR2.23)", async () => {
      const rows = (
        await db.query(
          `select p.proname, has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
                  has_function_privilege('service_role', p.oid, 'execute') as service_role
             from pg_proc p where p.pronamespace = current_schema()::regnamespace
              and p.proname in ('invitation_accept', 'invitation_accept_parent') order by 1`,
        )
      ).rows;
      assert.deepEqual(rows, [
        { proname: "invitation_accept", authenticated: false, service_role: true },
        { proname: "invitation_accept_parent", authenticated: false, service_role: false },
      ]);
    });
  });
}
