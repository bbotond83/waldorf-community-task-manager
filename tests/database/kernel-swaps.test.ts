import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  ADMIN_G2,
  ASSIGNMENT_F1_T1,
  ASSIGNMENT_OTHER,
  CO_PARENT_F1,
  callFunction,
  DEACTIVATED,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  FAMILY_2,
  FAMILY_NO_GROUP,
  GROUP_1,
  nextKey,
  OTHER_ADMIN,
  openDirectoryDatabase,
  ORGANIZATION,
  OUTSIDER,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  REQUEST_1,
  seedCoordinationWorld,
  SUPER_ADMIN,
  TASK_1,
  TASK_2,
  TEACHER_G1,
  uuid,
} from "./directory-support.ts";
import { auditEvents, count } from "./identity-support.ts";
import { openDatabase } from "./stack-support.ts";

type Result = Awaited<ReturnType<typeof callFunction>>;

const A_F2_T2 = uuid(851);
const A_F3_T4 = uuid(852);
const TASK_4 = uuid(815);
const TASK_5 = uuid(816);
const A_X_T1 = uuid(854);
const A_Y_T5 = uuid(855);
const FAMILY_X = uuid(861);
const FAMILY_Y = uuid(862);

/**
 * Swaps and cancellations: the partner list, each actor and each stale case, both confirmations, decline,
 * the admin's decision with its audit event, withdrawing, the refusals and the lock order (BR31.4 to BR31.6,
 * NFR1.33, NFR3.8).
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`swap and cancellation use cases in ${schema}`, () => {
    let db: pg.Client;

    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedCoordinationWorld(db, schema);
      // The swap world: family 1 holds an active place on task 1, family 2 (now also a member of group 1)
      // an active place on task 2; the seeded cancellation request of family 1 is withdrawn.
      await db.query(
        "insert into group_memberships (organization_id, family_id, group_id) values ($1, $2, $3), ($1, $4, $3)",
        [ORGANIZATION, FAMILY_2, GROUP_1, FAMILY_NO_GROUP],
      );
      await db.query("update change_requests set status = 'withdrawn' where id = $1", [REQUEST_1]);
      await db.query("update assignments set status = 'active' where id = $1", [ASSIGNMENT_F1_T1]);
      await db.query("update tasks set capacity = 3 where id = $1", [TASK_2]);
      await db.query(
        "insert into assignments (id, organization_id, task_id, family_id, parent_id, source) values ($1, $2, $3, $4, $5, 'parent_sign_up')",
        [A_F2_T2, ORGANIZATION, TASK_2, FAMILY_2, PARENT_ROW_F2],
      );
    });

    const asg = async (id: string) =>
      (
        await db.query(
          "select task_id, family_id, status, version from assignments where id = $1",
          [id],
        )
      ).rows[0] as { task_id: string; family_id: string; status: string; version: number };
    const request = async (id: string) =>
      (await db.query("select * from change_requests where id = $1", [id])).rows[0] as Record<
        string,
        unknown
      >;
    const taskVersion = async (id: string) =>
      (await db.query("select version from tasks where id = $1", [id])).rows[0].version as number;
    const fn = (account: string, sql: string, values: unknown[] = []): Promise<Result> =>
      callFunction(db, schema, account, sql, values);
    const candidates = (account: string, assignment: string) =>
      fn(account, "swap_candidates($1)", [assignment]);
    const requestSwap = async (
      account: string,
      source = ASSIGNMENT_F1_T1,
      target = A_F2_T2,
      overrides: { sourceVersion?: number; targetVersion?: number } = {},
    ) =>
      fn(account, "swap_request($1, $2, $3, $4, $5, $6)", [
        nextKey("sw"),
        source,
        overrides.sourceVersion ?? (await asg(source)).version,
        target,
        overrides.targetVersion ?? (await asg(target)).version,
        "Időpont-ütközés",
      ]);
    const respond = (account: string, id: string, accept: boolean, version: number | null = null) =>
      fn(account, "swap_respond($1, $2, $3, $4)", [nextKey("rs"), id, accept, version]);
    const withdraw = (account: string, id: string) =>
      fn(account, "swap_withdraw($1, $2)", [nextKey("wd"), id]);
    const cancel = async (account: string, assignment = ASSIGNMENT_F1_T1, version?: number) =>
      fn(account, "cancellation_request($1, $2, $3, $4)", [
        nextKey("cn"),
        assignment,
        version ?? (await asg(assignment)).version,
        "Beteg lettem",
      ]);
    const decideSwap = (
      account: string,
      id: string,
      approve: boolean,
      version: number | null = null,
    ) => fn(account, "swap_decide($1, $2, $3, $4)", [nextKey("sd"), id, approve, version]);
    const decideCancellation = (
      account: string,
      id: string,
      approve: boolean,
      version: number | null = null,
    ) => fn(account, "cancellation_decide($1, $2, $3, $4)", [nextKey("cd"), id, approve, version]);
    const refused = (result: Result, state: string, code: string) =>
      assert.deepEqual([result.state, result.code], [state, code]);

    /** A third family with a place on a task of its own, to be the source of a second request. */
    async function thirdFamily() {
      await db.query(
        `insert into tasks (id, organization_id, group_id, title, capacity, starts_at, ends_at, location)
         values ($1, $2, $3, 'Takarítás', 2, now() + interval '9 days', now() + interval '9 days 2 hours', 'Terem')`,
        [TASK_4, ORGANIZATION, GROUP_1],
      );
      await db.query(
        "insert into assignments (id, organization_id, task_id, family_id, source) values ($1, $2, $3, $4, 'admin_assign')",
        [A_F3_T4, ORGANIZATION, TASK_4, FAMILY_NO_GROUP],
      );
    }

    it("lists only the other families' active places on other open tasks of the group, with title, date and family name (BR31.4)", async () => {
      await thirdFamily();
      const result = await candidates(PARENT_F1, ASSIGNMENT_F1_T1);
      assert.equal(result.state, "success");
      const items = result.items as Record<string, unknown>[];
      assert.deepEqual(
        items.map((entry) => entry.assignment_id),
        [A_F3_T4, A_F2_T2],
        "in the order of the task start",
      );
      const partner = items.find((entry) => entry.assignment_id === A_F2_T2)!;
      assert.deepEqual(Object.keys(partner).sort(), [
        "assignment_id",
        "assignment_version",
        "family_display_name",
        "starts_at",
        "task_id",
        "title",
      ]);
      assert.equal(partner.title, "Kerti munka");
      assert.equal(partner.family_display_name, "Napraforgó család");
      assert.equal(JSON.stringify(result).includes("csilla@example.test"), false);
      // The family's own other places, pending places, started and other groups' tasks do not appear.
      await db.query("update assignments set status = 'swap_pending' where id = $1", [A_F3_T4]);
      assert.deepEqual(
        ((await candidates(PARENT_F1, ASSIGNMENT_F1_T1)).items as { assignment_id: string }[]).map(
          (entry) => entry.assignment_id,
        ),
        [A_F2_T2],
      );
      await db.query(
        "update tasks set starts_at = now() - interval '1 hour', ends_at = now() where id = $1",
        [TASK_2],
      );
      assert.deepEqual((await candidates(PARENT_F1, ASSIGNMENT_F1_T1)).items, []);
    });

    it("refuses the partner list for another family's assignment, a foreign one and a family-less account", async () => {
      refused(await candidates(PARENT_F2, ASSIGNMENT_F1_T1), "denied", "authorization_denied");
      refused(await candidates(PARENT_F1, uuid(99999)), "validation", "assignment_not_found");
      refused(await candidates(PARENT_F1, ASSIGNMENT_OTHER), "validation", "assignment_not_found");
      refused(await candidates(OUTSIDER, ASSIGNMENT_F1_T1), "denied", "no_family");
      refused(await candidates(DEACTIVATED, ASSIGNMENT_F1_T1), "denied", "session_inactive");
      await db.query("update assignments set status = 'swap_pending' where id = $1", [
        ASSIGNMENT_F1_T1,
      ]);
      refused(await candidates(PARENT_F1, ASSIGNMENT_F1_T1), "conflict", "REQUEST_DUPLICATE");
    });

    it("stores a swap request with the requester confirmed, makes the source pending and shows it to both families (BR31.4)", async () => {
      const before = await asg(ASSIGNMENT_F1_T1);
      const target = await asg(A_F2_T2);
      const result = await requestSwap(PARENT_F1);
      assert.equal(result.state, "success");
      assert.equal(result.assignment_version, before.version + 1);
      const row = await request(result.reference!);
      assert.deepEqual(
        [
          row.kind,
          row.status,
          row.source_confirmed,
          row.target_confirmed,
          row.requested_by_parent_id,
        ],
        ["swap", "open", true, false, PARENT_ROW_F1],
      );
      assert.deepEqual(
        [row.assignment_id, row.target_assignment_id, row.source_task_id, row.target_task_id],
        [ASSIGNMENT_F1_T1, A_F2_T2, TASK_1, TASK_2],
      );
      assert.deepEqual(
        [row.source_assignment_version, row.target_assignment_version],
        [before.version + 1, target.version],
      );
      assert.equal((await asg(ASSIGNMENT_F1_T1)).status, "swap_pending");
      const incoming = (await fn(PARENT_F2, "swap_incoming()")).items as Record<string, unknown>[];
      assert.equal(incoming.length, 1);
      assert.deepEqual(
        [
          incoming[0]!.direction,
          incoming[0]!.kind,
          incoming[0]!.own_task_title,
          incoming[0]!.partner_task_title,
          incoming[0]!.partner_family_name,
        ],
        ["incoming", "swap", "Kerti munka", "Sütés", "Fenyő család"],
      );
      for (const account of [PARENT_F1, CO_PARENT_F1]) {
        const outgoing = (await fn(account, "swap_incoming()")).items as Record<string, unknown>[];
        assert.deepEqual(
          [outgoing[0]!.direction, outgoing[0]!.own_task_title, outgoing[0]!.partner_family_name],
          ["outgoing", "Sütés", "Napraforgó család"],
        );
      }
      assert.deepEqual((await fn(OUTSIDER, "swap_incoming()")).code, "no_family");
      assert.equal(await count(db, "audit_events"), 0, "asking for a swap writes no audit event");
    });

    it("refuses forged and invalid swap requests with the stored codes and changes nothing (NFR1.33)", async () => {
      refused(
        await requestSwap(PARENT_F2, ASSIGNMENT_F1_T1, A_F2_T2),
        "denied",
        "authorization_denied",
      );
      refused(
        await requestSwap(PARENT_F1, ASSIGNMENT_F1_T1, ASSIGNMENT_F1_T1),
        "validation",
        "assignment_not_found",
      );
      refused(
        await requestSwap(PARENT_F1, A_F2_T2, ASSIGNMENT_F1_T1),
        "denied",
        "authorization_denied",
      );
      refused(
        await requestSwap(PARENT_F1, ASSIGNMENT_F1_T1, uuid(99999), { targetVersion: 1 }),
        "validation",
        "assignment_not_found",
      );
      refused(
        await requestSwap(PARENT_F1, ASSIGNMENT_F1_T1, ASSIGNMENT_OTHER, { targetVersion: 1 }),
        "validation",
        "assignment_not_found",
      );
      refused(
        await requestSwap(PARENT_F1, ASSIGNMENT_F1_T1, A_F2_T2, { sourceVersion: 99 }),
        "invalidated",
        "REQUEST_VERSION_STALE",
      );
      refused(
        await requestSwap(PARENT_F1, ASSIGNMENT_F1_T1, A_F2_T2, { targetVersion: 99 }),
        "invalidated",
        "REQUEST_VERSION_STALE",
      );
      refused(await requestSwap(OUTSIDER), "denied", "no_family");
      refused(await requestSwap(DEACTIVATED), "denied", "session_inactive");
      // Same family on both sides, the same task, another group, a started task, a duplicate place.
      await db.query(
        "insert into assignments (id, organization_id, task_id, family_id, source) values ($1, $2, $3, $4, 'admin_assign')",
        [uuid(870), ORGANIZATION, TASK_2, FAMILY_1],
      );
      refused(
        await requestSwap(PARENT_F1, ASSIGNMENT_F1_T1, uuid(870)),
        "conflict",
        "REQUEST_CONFLICT",
      );
      refused(
        await requestSwap(PARENT_F1, ASSIGNMENT_F1_T1, A_F2_T2),
        "conflict",
        "DUTY_ALREADY_ASSIGNED",
      );
      await db.query("update assignments set status = 'removed' where id = $1", [uuid(870)]);
      await db.query(
        "update tasks set starts_at = now() - interval '1 hour', ends_at = now() where id = $1",
        [TASK_2],
      );
      refused(await requestSwap(PARENT_F1), "conflict", "DUTY_CLOSED");
      await db.query(
        "update tasks set starts_at = now() + interval '3 days', ends_at = now() + interval '4 days' where id = $1",
        [TASK_2],
      );
      await db.query(
        "update group_memberships set status = 'ended', ended_at = now() where family_id = $1 and group_id = $2",
        [FAMILY_2, GROUP_1],
      );
      refused(await requestSwap(PARENT_F1), "conflict", "DUTY_INELIGIBLE");
      assert.equal(await count(db, "change_requests", "kind = 'swap'"), 0);
      assert.equal((await asg(ASSIGNMENT_F1_T1)).status, "active");
    });

    it("refuses a second request on the same place and a place that is already pending", async () => {
      assert.equal((await requestSwap(PARENT_F1)).state, "success");
      refused(await cancel(PARENT_F1, ASSIGNMENT_F1_T1, 1), "conflict", "REQUEST_DUPLICATE");
      refused(
        await requestSwap(CO_PARENT_F1, ASSIGNMENT_F1_T1, A_F2_T2, { sourceVersion: 1 }),
        "conflict",
        "REQUEST_DUPLICATE",
      );
      await thirdFamily();
      // The pending source cannot be the partner of another family's request.
      const wanted = await asg(ASSIGNMENT_F1_T1);
      refused(
        await fn(PARENT_F2, "swap_request($1, $2, $3, $4, $5)", [
          nextKey(),
          A_F2_T2,
          1,
          ASSIGNMENT_F1_T1,
          wanted.version,
        ]),
        "conflict",
        "REQUEST_CONFLICT",
      );
      assert.equal(await count(db, "change_requests", "kind = 'swap' and status = 'open'"), 1);
    });

    it("exchanges the two places when the other family confirms, with no admin and no audit event (answer Q1)", async () => {
      const made = await requestSwap(PARENT_F1);
      const taskVersions = [await taskVersion(TASK_1), await taskVersion(TASK_2)];
      const confirmed = await respond(PARENT_F2, made.reference!, true);
      assert.deepEqual([confirmed.state, confirmed.outcome], ["success", "applied"]);
      const source = await asg(ASSIGNMENT_F1_T1);
      const target = await asg(A_F2_T2);
      assert.deepEqual(
        [source.task_id, source.status, source.family_id],
        [TASK_2, "active", FAMILY_1],
      );
      assert.deepEqual(
        [target.task_id, target.status, target.family_id],
        [TASK_1, "active", FAMILY_2],
      );
      const row = await request(made.reference!);
      assert.deepEqual(
        [row.status, row.target_confirmed, row.decided_by_account_id],
        ["applied", true, null],
      );
      assert.deepEqual(
        [await taskVersion(TASK_1), await taskVersion(TASK_2)],
        [taskVersions[0]! + 1, taskVersions[1]! + 1],
      );
      assert.equal(await count(db, "audit_events"), 0, "a confirmation is not an approval");
      refused(await respond(PARENT_F2, made.reference!, true), "conflict", "SWAP_REQUEST_NOT_OPEN");
    });

    it("withdraws every other open request on an exchanged place so one place is never exchanged twice", async () => {
      await thirdFamily();
      const first = await requestSwap(PARENT_F1);
      // Family 3 asks for the same partner place at the same time (inserted as the owner).
      const partner = await asg(A_F2_T2);
      await db.query("update assignments set status = 'swap_pending' where id = $1", [A_F3_T4]);
      const third = await asg(A_F3_T4);
      await db.query(
        `insert into change_requests (id, organization_id, assignment_id, target_assignment_id, kind, requested_by_parent_id,
           source_task_id, source_assignment_version, target_task_id, target_assignment_version)
         values ($1, $2, $3, $4, 'swap', $5, $6, $7, $8, $9)`,
        [
          uuid(880),
          ORGANIZATION,
          A_F3_T4,
          A_F2_T2,
          PARENT_ROW_F1,
          TASK_4,
          third.version,
          TASK_2,
          partner.version,
        ],
      );
      assert.equal((await respond(PARENT_F2, first.reference!, true)).state, "success");
      assert.equal((await request(uuid(880))).status, "withdrawn");
      assert.equal(
        (await asg(A_F3_T4)).status,
        "active",
        "the other requester's place is active again",
      );
      refused(
        await decideSwap(SUPER_ADMIN, uuid(880), true),
        "conflict",
        "APPROVAL_ALREADY_DECIDED",
      );
    });

    it("withdraws the request and returns the source when the other family declines (W7)", async () => {
      const made = await requestSwap(PARENT_F1);
      refused(await respond(PARENT_F1, made.reference!, false), "denied", "authorization_denied");
      refused(await respond(OUTSIDER, made.reference!, false), "denied", "no_family");
      refused(
        await respond(PARENT_F2, made.reference!, false, 99),
        "invalidated",
        "REQUEST_VERSION_STALE",
      );
      refused(await respond(PARENT_F2, uuid(99999), false), "validation", "request_not_found");
      const declined = await respond(PARENT_F2, made.reference!, false);
      assert.deepEqual([declined.state, declined.outcome], ["success", "declined"]);
      assert.equal((await request(made.reference!)).status, "withdrawn");
      assert.equal((await asg(ASSIGNMENT_F1_T1)).status, "active");
      assert.equal((await asg(A_F2_T2)).task_id, TASK_2, "nothing was exchanged");
      refused(await respond(PARENT_F2, made.reference!, true), "conflict", "SWAP_REQUEST_NOT_OPEN");
    });

    it("keeps the request open for the admin when a confirmation can no longer be applied (SWAP_CANNOT_BE_APPLIED)", async () => {
      const cases: [string, () => Promise<unknown>][] = [
        [
          "the target task started",
          () =>
            db.query(
              "update tasks set starts_at = now() - interval '1 hour', ends_at = now() where id = $1",
              [TASK_2],
            ),
        ],
        [
          "the target place changed",
          () => db.query("update assignments set updated_at = now() where id = $1", [A_F2_T2]),
        ],
        [
          "the source place changed",
          () =>
            db.query("update assignments set updated_at = now() where id = $1", [ASSIGNMENT_F1_T1]),
        ],
        [
          "the target place moved",
          async () => {
            await db.query(
              `insert into tasks (id, organization_id, group_id, title, capacity, starts_at, ends_at, location)
             values ($1, $2, $3, 'Új feladat', 2, now() + interval '8 days', now() + interval '8 days 2 hours', 'Terem')`,
              [TASK_5, ORGANIZATION, GROUP_1],
            );
            await db.query("update assignments set task_id = $2 where id = $1", [A_F2_T2, TASK_5]);
          },
        ],
        [
          "the family left the group",
          () =>
            db.query(
              "update group_memberships set status = 'ended', ended_at = now() where family_id = $1 and group_id = $2",
              [FAMILY_2, GROUP_1],
            ),
        ],
        [
          "a duplicate place appeared",
          () =>
            db.query(
              "insert into assignments (organization_id, task_id, family_id, source) values ($1, $2, $3, 'admin_assign')",
              [ORGANIZATION, TASK_2, FAMILY_1],
            ),
        ],
        [
          "the target task was closed",
          () => db.query("update tasks set status = 'closed' where id = $1", [TASK_2]),
        ],
      ];
      for (const [label, change] of cases) {
        await beforeEachReset();
        const made = await requestSwap(PARENT_F1);
        await change();
        const answer = await respond(PARENT_F2, made.reference!, true);
        refused(answer, "conflict", "SWAP_CANNOT_BE_APPLIED");
        assert.equal((await request(made.reference!)).status, "open", label);
        assert.equal((await asg(ASSIGNMENT_F1_T1)).status, "swap_pending", label);
        // The requester can still withdraw it.
        assert.equal((await withdraw(PARENT_F1, made.reference!)).state, "success", label);
        assert.equal((await asg(ASSIGNMENT_F1_T1)).status, "active", label);
      }
    });

    async function beforeEachReset() {
      await seedCoordinationWorld(db, schema);
      await db.query(
        "insert into group_memberships (organization_id, family_id, group_id) values ($1, $2, $3), ($1, $4, $3)",
        [ORGANIZATION, FAMILY_2, GROUP_1, FAMILY_NO_GROUP],
      );
      await db.query("update change_requests set status = 'withdrawn' where id = $1", [REQUEST_1]);
      await db.query("update assignments set status = 'active' where id = $1", [ASSIGNMENT_F1_T1]);
      await db.query("update tasks set capacity = 3 where id = $1", [TASK_2]);
      await db.query(
        "insert into assignments (id, organization_id, task_id, family_id, parent_id, source) values ($1, $2, $3, $4, $5, 'parent_sign_up')",
        [A_F2_T2, ORGANIZATION, TASK_2, FAMILY_2, PARENT_ROW_F2],
      );
    }

    it("lets only the requester's family withdraw an open request, swap or cancellation (BR31.4)", async () => {
      const swap = await requestSwap(PARENT_F1);
      refused(await withdraw(PARENT_F2, swap.reference!), "denied", "authorization_denied");
      refused(await withdraw(OUTSIDER, swap.reference!), "denied", "no_family");
      refused(await withdraw(PARENT_F1, uuid(99999)), "validation", "request_not_found");
      assert.equal((await withdraw(CO_PARENT_F1, swap.reference!)).state, "success");
      assert.deepEqual(
        [(await request(swap.reference!)).status, (await asg(ASSIGNMENT_F1_T1)).status],
        ["withdrawn", "active"],
      );
      refused(await withdraw(PARENT_F1, swap.reference!), "conflict", "SWAP_REQUEST_NOT_OPEN");
      const cancellation = await cancel(PARENT_F1);
      assert.equal((await withdraw(PARENT_F1, cancellation.reference!)).state, "success");
      assert.equal((await asg(ASSIGNMENT_F1_T1)).status, "active");
      const open = (await fn(PARENT_F1, "swap_incoming()")).items as unknown[];
      assert.deepEqual(open, []);
    });

    it("stores a cancellation request, keeps the place taken, and refuses duplicates, stale versions, foreign places and started tasks (BR31.6)", async () => {
      const taken = await count(db, "assignments", `task_id = '${TASK_1}' and status <> 'removed'`);
      const made = await cancel(PARENT_F1);
      assert.equal(made.state, "success");
      const row = await request(made.reference!);
      assert.deepEqual(
        [row.kind, row.status, row.assignment_id, row.target_assignment_id, row.reason],
        ["cancellation", "open", ASSIGNMENT_F1_T1, null, "Beteg lettem"],
      );
      assert.equal((await asg(ASSIGNMENT_F1_T1)).status, "cancellation_pending");
      assert.equal(
        await count(db, "assignments", `task_id = '${TASK_1}' and status <> 'removed'`),
        taken,
        "the place stays taken",
      );
      refused(await cancel(PARENT_F1), "conflict", "REQUEST_DUPLICATE");
      await withdraw(PARENT_F1, made.reference!);
      refused(
        await cancel(PARENT_F1, ASSIGNMENT_F1_T1, 99),
        "invalidated",
        "REQUEST_VERSION_STALE",
      );
      refused(await cancel(PARENT_F2, ASSIGNMENT_F1_T1), "denied", "authorization_denied");
      refused(await cancel(PARENT_F1, uuid(99999), 1), "validation", "assignment_not_found");
      refused(await cancel(OUTSIDER), "denied", "no_family");
      await db.query(
        "update tasks set starts_at = now() - interval '1 hour', ends_at = now() where id = $1",
        [TASK_1],
      );
      refused(await cancel(PARENT_F1), "conflict", "DUTY_CLOSED");
      assert.equal(await count(db, "audit_events"), 0);
    });

    it("lets an admin in reach approve an unconfirmed swap, exchanging the places and writing approval.approve (BR31.5)", async () => {
      const made = await requestSwap(PARENT_F1);
      for (const account of [ADMIN_G2, PARENT_F1, PARENT_F2, TEACHER_G1, OUTSIDER, OTHER_ADMIN]) {
        const answer = await decideSwap(account, made.reference!, true);
        assert.ok(["denied", "validation"].includes(answer.state), `${account}: ${answer.state}`);
      }
      assert.equal(await count(db, "audit_events"), 0, "a refused decision writes no event");
      assert.equal(
        (await decideSwap(ADMIN_G1, made.reference!, true, 99)).code,
        "APPROVAL_INVALIDATED",
      );
      const approved = await decideSwap(ADMIN_G1, made.reference!, true);
      assert.deepEqual([approved.state, approved.outcome], ["success", "approved"]);
      assert.equal((await asg(ASSIGNMENT_F1_T1)).task_id, TASK_2);
      assert.equal((await asg(A_F2_T2)).task_id, TASK_1);
      const row = await request(made.reference!);
      assert.deepEqual([row.status, row.decided_by_account_id], ["approved", ADMIN_G1]);
      assert.ok(row.decided_at);
      const events = await auditEvents(db);
      assert.deepEqual(
        events.map((event) => [
          event.action,
          event.outcome,
          event.actor_account_id,
          event.actor_role,
          event.target_type,
          event.target_id,
          event.group_id,
          event.details,
        ]),
        [
          [
            "approval.approve",
            "success",
            ADMIN_G1,
            "group_admin",
            "change_request",
            made.reference,
            GROUP_1,
            "swap",
          ],
        ],
      );
      refused(
        await decideSwap(SUPER_ADMIN, made.reference!, true),
        "conflict",
        "APPROVAL_ALREADY_DECIDED",
      );
    });

    it("rejects a request with approval.reject, returns the source to active, and tells a changed request from a decided one", async () => {
      const made = await requestSwap(PARENT_F1);
      const rejected = await decideSwap(SUPER_ADMIN, made.reference!, false);
      assert.deepEqual([rejected.state, rejected.outcome], ["success", "rejected"]);
      assert.deepEqual(
        [(await request(made.reference!)).status, (await asg(ASSIGNMENT_F1_T1)).status],
        ["rejected", "active"],
      );
      const [event] = await auditEvents(db);
      assert.deepEqual(
        [event!.action, event!.actor_role, event!.group_id],
        ["approval.reject", "super_admin", GROUP_1],
      );
      // A request whose place changed meanwhile is invalidated, not decided.
      const again = await requestSwap(PARENT_F1);
      await db.query("update assignments set updated_at = now() where id = $1", [A_F2_T2]);
      refused(
        await decideSwap(ADMIN_G1, again.reference!, true),
        "invalidated",
        "APPROVAL_INVALIDATED",
      );
      refused(
        await decideSwap(ADMIN_G1, again.reference!, false),
        "invalidated",
        "APPROVAL_INVALIDATED",
      );
      assert.equal((await request(again.reference!)).status, "open");
      assert.equal(await count(db, "audit_events"), 1, "only the one decision was audited");
    });

    it("approves or rejects a cancellation, freeing the place or keeping it, each with its audit event", async () => {
      const made = await cancel(PARENT_F1);
      refused(
        await decideSwap(SUPER_ADMIN, made.reference!, true),
        "validation",
        "request_not_found",
      );
      refused(
        await decideCancellation(ADMIN_G2, made.reference!, true),
        "denied",
        "authorization_denied",
      );
      const approved = await decideCancellation(ADMIN_G1, made.reference!, true);
      assert.equal(approved.state, "success");
      assert.equal((await asg(ASSIGNMENT_F1_T1)).status, "removed");
      assert.equal(
        await count(db, "assignments", `task_id = '${TASK_1}' and status <> 'removed'`),
        0,
        "the place is free",
      );
      const second = await cancel(PARENT_F2, A_F2_T2);
      const rejected = await decideCancellation(SUPER_ADMIN, second.reference!, false);
      assert.equal(rejected.state, "success");
      assert.equal((await asg(A_F2_T2)).status, "active");
      assert.deepEqual(
        (await auditEvents(db)).map((event) => [event.action, event.details]),
        [
          ["approval.approve", "cancellation"],
          ["approval.reject", "cancellation"],
        ],
      );
      refused(
        await decideCancellation(SUPER_ADMIN, second.reference!, true),
        "conflict",
        "APPROVAL_ALREADY_DECIDED",
      );
    });

    it("returns the stored answer for a repeated decision key and writes one audit event (NFR6.11)", async () => {
      const made = await requestSwap(PARENT_F1);
      const key = nextKey("same-decision");
      const first = await fn(ADMIN_G1, "swap_decide($1, $2, true, null)", [key, made.reference]);
      const again = await fn(ADMIN_G1, "swap_decide($1, $2, true, null)", [key, made.reference]);
      assert.deepEqual([first.state, again.state, again.code], ["success", "success", "replayed"]);
      assert.equal(await count(db, "audit_events"), 1);
      assert.equal(
        (await fn(ADMIN_G1, "swap_decide($1, $2, false, null)", [key, made.reference])).code,
        "idempotency_key_reused",
      );
    });

    it("keeps the places exact when two exchanges that cross the same tasks run at the same time, without a deadlock (NFR3.8)", async () => {
      const connections = [await openDatabase(), await openDatabase()];
      try {
        for (let round = 0; round < 4; round += 1) {
          await beforeEachReset();
          // Two more families, each with a place on the two tasks; request 1 asks A1 <-> A2, request 2 asks
          // Y <-> X in the opposite direction over the same two tasks.
          await db.query("update tasks set capacity = 4 where id in ($1, $2)", [TASK_1, TASK_2]);
          await db.query(
            "insert into families (id, organization_id, display_name) values ($1, $3, 'X család'), ($2, $3, 'Y család')",
            [FAMILY_X, FAMILY_Y, ORGANIZATION],
          );
          await db.query(
            "insert into group_memberships (organization_id, family_id, group_id) values ($1, $2, $4), ($1, $3, $4)",
            [ORGANIZATION, FAMILY_X, FAMILY_Y, GROUP_1],
          );
          await db.query(
            "insert into parents (organization_id, family_id, display_name) values ($1, $2, 'X szülő'), ($1, $3, 'Y szülő')",
            [ORGANIZATION, FAMILY_X, FAMILY_Y],
          );
          await db.query(
            "insert into assignments (id, organization_id, task_id, family_id, source) values ($1, $3, $4, $5, 'admin_assign'), ($2, $3, $6, $7, 'admin_assign')",
            [A_X_T1, A_Y_T5, ORGANIZATION, TASK_1, FAMILY_X, TASK_2, FAMILY_Y],
          );
          const first = await requestSwap(PARENT_F1);
          // The second request is stored as the owner: Y (on task 2) asks X (on task 1).
          await db.query("update assignments set status = 'swap_pending' where id = $1", [A_Y_T5]);
          const y = await asg(A_Y_T5);
          const x = await asg(A_X_T1);
          await db.query(
            `insert into change_requests (id, organization_id, assignment_id, target_assignment_id, kind, requested_by_parent_id,
               source_task_id, source_assignment_version, target_task_id, target_assignment_version)
             values ($1, $2, $3, $4, 'swap', $5, $6, $7, $8, $9)`,
            [
              uuid(881),
              ORGANIZATION,
              A_Y_T5,
              A_X_T1,
              PARENT_ROW_F1,
              TASK_2,
              y.version,
              TASK_1,
              x.version,
            ],
          );
          const answers = await Promise.all([
            callFunction(connections[0]!, schema, ADMIN_G1, "swap_decide($1, $2, true, null)", [
              nextKey("cross"),
              first.reference,
            ]),
            callFunction(connections[1]!, schema, SUPER_ADMIN, "swap_decide($1, $2, true, null)", [
              nextKey("cross"),
              uuid(881),
            ]),
          ]);
          assert.deepEqual(
            answers.map((answer) => answer.state),
            ["success", "success"],
            `round ${round}`,
          );
          assert.deepEqual(
            [
              (await asg(ASSIGNMENT_F1_T1)).task_id,
              (await asg(A_F2_T2)).task_id,
              (await asg(A_Y_T5)).task_id,
              (await asg(A_X_T1)).task_id,
            ],
            [TASK_2, TASK_1, TASK_1, TASK_2],
            `round ${round}`,
          );
          assert.equal(
            await count(db, "assignments", `task_id = '${TASK_1}' and status <> 'removed'`),
            2,
          );
        }
      } finally {
        await Promise.all(connections.map((connection) => connection.end()));
      }
    });

    it("lets only one of two concurrent decisions exchange the same place", async () => {
      await thirdFamily();
      const connections = [await openDatabase(), await openDatabase()];
      try {
        const first = await requestSwap(PARENT_F1);
        await db.query("update assignments set status = 'swap_pending' where id = $1", [A_F3_T4]);
        const third = await asg(A_F3_T4);
        const partner = await asg(A_F2_T2);
        await db.query(
          `insert into change_requests (id, organization_id, assignment_id, target_assignment_id, kind, requested_by_parent_id,
             source_task_id, source_assignment_version, target_task_id, target_assignment_version)
           values ($1, $2, $3, $4, 'swap', $5, $6, $7, $8, $9)`,
          [
            uuid(882),
            ORGANIZATION,
            A_F3_T4,
            A_F2_T2,
            PARENT_ROW_F1,
            TASK_4,
            third.version,
            TASK_2,
            partner.version,
          ],
        );
        const answers = await Promise.all([
          callFunction(connections[0]!, schema, ADMIN_G1, "swap_decide($1, $2, true, null)", [
            nextKey("one"),
            first.reference,
          ]),
          callFunction(connections[1]!, schema, SUPER_ADMIN, "swap_decide($1, $2, true, null)", [
            nextKey("two"),
            uuid(882),
          ]),
        ]);
        assert.equal(answers.filter((answer) => answer.state === "success").length, 1);
        const loser = answers.find((answer) => answer.state !== "success")!;
        assert.equal(loser.code, "APPROVAL_ALREADY_DECIDED");
        assert.equal(await count(db, "change_requests", "status = 'open'"), 0);
        assert.equal(await count(db, "audit_events", "action = 'approval.approve'"), 1);
        const places = (
          await db.query(
            "select task_id, count(*)::int as n from assignments where status <> 'removed' group by task_id",
          )
        ).rows;
        assert.ok(places.every((row) => row.n <= 3));
      } finally {
        await Promise.all(connections.map((connection) => connection.end()));
      }
    });
  });
}
