import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  ADMIN_G2,
  ASSIGNMENT_F1_T1,
  ASSIGNMENT_F2_T3,
  asActor,
  authenticated,
  CO_PARENT_F1,
  callFunction,
  DEACTIVATED,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  FAMILY_2,
  FAMILY_NO_GROUP,
  nextKey,
  OTHER_ADMIN,
  openDirectoryDatabase,
  OUTSIDER,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_F1,
  REQUEST_1,
  seedCoordinationWorld,
  SUPER_ADMIN,
  TASK_1,
  TASK_2,
  TASK_3,
  TASK_OTHER,
  TEACHER_G1,
  uuid,
} from "./directory-support.ts";
import { count } from "./identity-support.ts";

type Result = Awaited<ReturnType<typeof callFunction>>;
type Duty = {
  id: string;
  title: string;
  due_at: string;
  location: string;
  version: number;
  signup_open: boolean;
  state: string;
  assignment_id: string | null;
  assignment_version: number | null;
  allergen_note?: string | null;
  own_contribution_note?: string | null;
};

/**
 * The parent's task list and detail, signing up, and the admin's assign and remove: the states, the fixed
 * order of the checks, the stored codes, the reach of every role, repeated keys (BR31.2, BR31.7, BR31.9,
 * BR31.11, BR32.6, NFR1.26, NFR6.11, NFR6.12).
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`sign-up and listing use cases in ${schema}`, () => {
    let db: pg.Client;

    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedCoordinationWorld(db, schema);
    });

    const list = (account: string) => callFunction(db, schema, account, "duty_list()");
    const get = (account: string, task: string) =>
      callFunction(db, schema, account, "duty_get($1)", [task]);
    const signUp = (account: string, task: string, version: number, key = nextKey("su")) =>
      callFunction(db, schema, account, "duty_sign_up($1, $2, $3)", [key, task, version]);
    const assign = (account: string, task: string, family: string, version: number) =>
      callFunction(db, schema, account, "assignment_assign($1, $2, $3, $4)", [
        nextKey("as"),
        task,
        family,
        version,
      ]);
    const remove = (account: string, assignment: string, version: number) =>
      callFunction(db, schema, account, "assignment_remove($1, $2, $3)", [
        nextKey("rm"),
        assignment,
        version,
      ]);
    const items = (result: Result) => result.items as Duty[];
    const item = (result: Result) => result.item as Duty;
    const one = async (sql: string, values: unknown[] = []) =>
      (await db.query(sql, values)).rows[0] as Record<string, unknown>;
    const taskVersion = async (task: string) =>
      (await one("select version from tasks where id = $1", [task])).version as number;
    const places = async (task: string) =>
      count(db, "assignments", `task_id = '${task}' and status <> 'removed'`);

    it("lists every open task of the community, whichever group owns it, and the family's own places with the state, version and place (BR31.11, BR4.1)", async () => {
      const first = await list(PARENT_F1);
      assert.equal(first.state, "success");
      assert.deepEqual(
        items(first).map((duty) => [duty.title, duty.state, duty.assignment_id !== null]),
        [
          ["Sütés", "cancellation-pending", true],
          ["Kerti munka", "available", false],
          ["Díszítés", "available", false],
        ],
      );
      const own = items(first)[0]!;
      assert.equal(own.assignment_id, ASSIGNMENT_F1_T1);
      assert.equal(own.assignment_version, 1);
      assert.equal(own.version, 1);
      assert.equal(own.location, "Konyha");
      assert.deepEqual(Object.keys(own).sort(), [
        "assignment_id",
        "assignment_version",
        "due_at",
        "id",
        "location",
        "signup_open",
        "state",
        "title",
        "version",
      ]);
      const other = await list(PARENT_F2);
      assert.deepEqual(
        items(other).map((duty) => [duty.id, duty.state]),
        [
          [TASK_1, "available"],
          [TASK_2, "available"],
          [TASK_3, "assigned"],
        ],
      );
      assert.deepEqual(
        items(await list(CO_PARENT_F1)),
        items(first),
        "the co-parent sees the family's list",
      );
    });

    it("maps every state: available, full, assigned, swap-pending and cancellation-pending", async () => {
      const ownTask = async () =>
        items(await list(PARENT_F2)).find((duty) => duty.id === TASK_3)!.state;
      // assigned: the second family's place; swap-pending and cancellation-pending by status
      assert.equal(await ownTask(), "assigned");
      await db.query("update assignments set status = 'swap_pending' where id = $1", [
        ASSIGNMENT_F2_T3,
      ]);
      assert.equal(await ownTask(), "swap-pending");
      assert.equal(items(await list(PARENT_F1))[0]!.state, "cancellation-pending");
      await db.query("update assignments set status = 'active' where id = $1", [ASSIGNMENT_F1_T1]);
      assert.equal(items(await list(PARENT_F1))[0]!.state, "assigned");
      // available, then full once the places are taken by other families
      assert.equal(items(await list(PARENT_F1))[1]!.state, "available");
      assert.equal((await signUp(PARENT_F2, TASK_2, 1)).state, "success");
      assert.equal(items(await list(PARENT_F1))[1]!.state, "full");
      // A task of any working group is readable to every family (BR4.1).
      assert.equal(item(await get(PARENT_F1, TASK_3)).state, "available");
      assert.equal(item(await get(PARENT_F1, TASK_2)).state, "full");
    });

    it("answers a missing task and another community's task alike, and opens everything the list shows", async () => {
      assert.deepEqual(
        [await get(PARENT_F1, uuid(99999)), await get(PARENT_F1, TASK_OTHER)].map((result) => [
          result.state,
          result.code,
        ]),
        [
          ["validation", "duty_not_found"],
          ["validation", "duty_not_found"],
        ],
        "indistinguishable from a task that does not exist",
      );
      // Everything the list shows can still be opened: tasks of the groups, and a place held elsewhere.
      for (const duty of items(await list(PARENT_F1))) {
        assert.equal((await get(PARENT_F1, duty.id)).state, "success", duty.title);
      }
      assert.equal(
        item(await get(PARENT_F2, TASK_3)).state,
        "assigned",
        "its own place is readable",
      );
    });

    it("returns the detail with the allergen note and the own contribution note only to the assigned family (BR31.8, BR31.9)", async () => {
      const own = item(await get(PARENT_F1, TASK_1));
      assert.equal(own.allergen_note, "mogyoró");
      assert.equal(own.own_contribution_note, "Almás pite");
      assert.equal(own.assignment_id, ASSIGNMENT_F1_T1);
      // A family without a place: no allergen note and no contribution note.
      const bystander = item(await get(PARENT_F2, TASK_1));
      assert.equal(bystander.state, "available");
      assert.equal(bystander.allergen_note ?? null, null);
      assert.equal(bystander.own_contribution_note ?? null, null);
      assert.equal(JSON.stringify(bystander).includes("mogyoró"), false);
      assert.equal(JSON.stringify(bystander).includes("Almás pite"), false);
      // Another family's note never shows up in the list either.
      assert.equal(JSON.stringify(await list(PARENT_F2)).includes("Almás pite"), false);
      // A task without an event has no allergen note.
      assert.equal(item(await get(PARENT_F1, TASK_2)).allergen_note ?? null, null);
    });

    it("treats a missing, cancelled or foreign task as not found, and refuses accounts without a family or a session", async () => {
      await db.query("update tasks set status = 'cancelled' where id = $1", [TASK_2]);
      for (const task of [TASK_2, uuid(99999), TASK_OTHER]) {
        const result = await get(PARENT_F1, task);
        assert.deepEqual([result.state, result.code], ["validation", "duty_not_found"], task);
      }
      assert.equal(
        items(await list(PARENT_F1)).some((duty) => duty.id === TASK_2),
        false,
      );
      for (const account of [OUTSIDER, TEACHER_G1, SUPER_ADMIN]) {
        assert.deepEqual(
          [(await list(account)).state, (await list(account)).code],
          ["denied", "no_family"],
          account,
        );
        assert.equal((await get(account, TASK_1)).code, "no_family");
        assert.equal((await signUp(account, TASK_2, 1)).code, "no_family");
      }
      const dead = await list(DEACTIVATED);
      assert.deepEqual([dead.state, dead.code], ["denied", "session_inactive"]);
      await db.query("update families set status = 'archived', archived_at = now() where id = $1", [
        FAMILY_1,
      ]);
      assert.equal((await list(PARENT_F1)).code, "no_family", "an archived family has no list");
    });

    it("signs a family up, raising the task version, with the parent who signed up (BR31.2)", async () => {
      const result = await signUp(PARENT_F2, TASK_2, 1);
      assert.equal(result.state, "success");
      assert.deepEqual([result.version, result.task_version], [1, 2]);
      const row = await one(
        "select family_id, parent_id, source, status, task_id from assignments where id = $1",
        [result.reference],
      );
      assert.deepEqual(row, {
        family_id: FAMILY_2,
        parent_id: uuid(603),
        source: "parent_sign_up",
        status: "active",
        task_id: TASK_2,
      });
      assert.equal(await taskVersion(TASK_2), 2);
      assert.equal(item(await get(PARENT_F2, TASK_2)).state, "assigned");
      assert.equal(await count(db, "audit_events"), 0, "a sign-up writes no audit event");
    });

    it("runs the checks in the fixed order and returns the first failure (BR31.2)", async () => {
      // 1. a stale version beats a closed task
      await db.query("update tasks set status = 'closed' where id = $1", [TASK_2]);
      const stale = await signUp(PARENT_F1, TASK_2, 7);
      assert.deepEqual([stale.state, stale.code], ["invalidated", "DUTY_VERSION_STALE"]);
      // 2. a closed task beats an existing place
      await db.query("update tasks set status = 'closed' where id = $1", [TASK_1]);
      const closed = await signUp(PARENT_F1, TASK_1, await taskVersion(TASK_1));
      assert.deepEqual([closed.state, closed.code], ["conflict", "DUTY_CLOSED"]);
      await db.query("update tasks set status = 'open' where id = $1", [TASK_1]);
      // a task that has started is closed too (answer Q2)
      await db.query(
        "update tasks set starts_at = now() - interval '1 hour', ends_at = now() where id = $1",
        [TASK_1],
      );
      assert.equal(
        (await signUp(PARENT_F1, TASK_1, await taskVersion(TASK_1))).code,
        "DUTY_CLOSED",
      );
      await db.query(
        "update tasks set starts_at = now() + interval '1 day', ends_at = now() + interval '2 days' where id = $1",
        [TASK_1],
      );
      // 3. an existing place
      const already = await signUp(PARENT_F1, TASK_1, await taskVersion(TASK_1));
      assert.deepEqual([already.state, already.code], ["conflict", "DUTY_ALREADY_ASSIGNED"]);
      // 4. full (the working group plays no part, BR4.1)
      await db.query("update tasks set status = 'open' where id = $1", [TASK_2]);
      await db.query("update tasks set capacity = 1 where id = $1", [TASK_1]);
      const full = await signUp(PARENT_F2, TASK_1, await taskVersion(TASK_1));
      assert.deepEqual([full.state, full.code], ["conflict", "DUTY_FULL"]);
      assert.equal(await places(TASK_1), 1, "no refusal created a place");
      assert.equal(await count(db, "audit_events"), 0);
    });

    it("refuses an unknown or foreign task and a missing version without changing anything", async () => {
      const unknown = await signUp(PARENT_F1, uuid(99999), 1);
      assert.deepEqual([unknown.state, unknown.code], ["validation", "duty_not_found"]);
      assert.equal((await signUp(PARENT_F1, TASK_OTHER, 1)).code, "duty_not_found");
      const missing = await callFunction(db, schema, PARENT_F1, "duty_sign_up($1, $2, null)", [
        nextKey(),
        TASK_2,
      ]);
      assert.deepEqual([missing.state, missing.field], ["validation", "expected_version"]);
      assert.equal(await places(TASK_2), 0);
    });

    it("returns the stored success for a repeated key and does not store a refusal (NFR6.11)", async () => {
      const key = nextKey("repeat");
      const first = await signUp(PARENT_F2, TASK_2, 1, key);
      const again = await signUp(PARENT_F2, TASK_2, 1, key);
      assert.deepEqual([first.state, again.state, again.code], ["success", "success", "replayed"]);
      assert.equal(again.reference, first.reference);
      assert.equal(await places(TASK_2), 1);
      assert.equal(await taskVersion(TASK_2), 2, "the repeat changed nothing more");
      const reused = await signUp(PARENT_F2, TASK_1, 1, key);
      assert.deepEqual([reused.state, reused.code], ["conflict", "idempotency_key_reused"]);
      // A refusal is not stored: the corrected request with the same key succeeds.
      const refusalKey = nextKey("refused");
      assert.equal((await signUp(PARENT_F2, TASK_1, 9, refusalKey)).code, "DUTY_VERSION_STALE");
      assert.equal((await signUp(PARENT_F2, TASK_1, 1, refusalKey)).state, "success");
    });

    it("lets an admin of the group give a place to a family of the group, with the same checks and no override (BR31.7)", async () => {
      const stale = await assign(ADMIN_G1, TASK_1, FAMILY_NO_GROUP, 5);
      assert.deepEqual([stale.state, stale.code], ["conflict", "VERSION_CONFLICT"]);
      const given = await assign(ADMIN_G1, TASK_1, FAMILY_NO_GROUP, 1);
      assert.deepEqual([given.state, given.version, given.task_version], ["success", 1, 2]);
      const row = await one(
        "select family_id, parent_id, source, status from assignments where id = $1",
        [given.reference],
      );
      assert.deepEqual(row, {
        family_id: FAMILY_NO_GROUP,
        parent_id: null,
        source: "admin_assign",
        status: "active",
      });
      const twice = await assign(ADMIN_G1, TASK_1, FAMILY_NO_GROUP, 2);
      assert.deepEqual([twice.state, twice.code], ["conflict", "DUTY_ALREADY_ASSIGNED"]);
      await db.query("update tasks set capacity = 2 where id = $1", [TASK_1]);
      const full = await assign(SUPER_ADMIN, TASK_1, FAMILY_2, 3);
      assert.deepEqual([full.state, full.code], ["conflict", "ASSIGNMENT_CAPACITY_FULL"]);
      assert.equal(await places(TASK_1), 2, "capacity is never exceeded");
      assert.equal(await count(db, "audit_events"), 0, "assigning writes no audit event");
    });

    it("refuses assigning to anyone who does not reach the group, and for a family or task of another organization", async () => {
      for (const account of [ADMIN_G2, PARENT_F1, CO_PARENT_F1, TEACHER_G1, OUTSIDER]) {
        const result = await assign(account, TASK_2, FAMILY_NO_GROUP, 1);
        assert.deepEqual([result.state, result.code], ["denied", "authorization_denied"], account);
      }
      assert.equal(
        (await assign(DEACTIVATED, TASK_2, FAMILY_NO_GROUP, 1)).code,
        "session_inactive",
      );
      const foreignTask = await assign(OTHER_ADMIN, TASK_2, FAMILY_NO_GROUP, 1);
      assert.equal(
        foreignTask.state,
        "validation",
        "a task and family of another organization are not found",
      );
      const foreignTaskOwnFamily = await assign(SUPER_ADMIN, TASK_OTHER, FAMILY_NO_GROUP, 1);
      assert.deepEqual(
        [foreignTaskOwnFamily.state, foreignTaskOwnFamily.field],
        ["validation", "task_id"],
      );
      const foreignFamily = await assign(SUPER_ADMIN, TASK_2, uuid(505), 1);
      assert.deepEqual(
        [foreignFamily.state, foreignFamily.field, foreignFamily.reason],
        ["validation", "family_id", "not_found"],
      );
      await db.query("update families set status = 'archived', archived_at = now() where id = $1", [
        FAMILY_NO_GROUP,
      ]);
      assert.equal((await assign(SUPER_ADMIN, TASK_2, FAMILY_NO_GROUP, 1)).reason, "archived");
      assert.equal(await places(TASK_2), 0);
    });

    it("removes a place for an admin in reach, frees it, withdraws the open request and raises the versions (BR31.7)", async () => {
      const stale = await remove(ADMIN_G1, ASSIGNMENT_F1_T1, 9);
      assert.deepEqual([stale.state, stale.code], ["conflict", "VERSION_CONFLICT"]);
      for (const account of [ADMIN_G2, PARENT_F1, TEACHER_G1, OUTSIDER]) {
        assert.equal((await remove(account, ASSIGNMENT_F1_T1, 1)).state, "denied", account);
      }
      const removed = await remove(ADMIN_G1, ASSIGNMENT_F1_T1, 1);
      assert.deepEqual([removed.state, removed.version, removed.task_version], ["success", 2, 2]);
      assert.equal(
        (await one("select status from assignments where id = $1", [ASSIGNMENT_F1_T1])).status,
        "removed",
      );
      assert.equal(
        (await one("select status from change_requests where id = $1", [REQUEST_1])).status,
        "withdrawn",
      );
      assert.equal(await places(TASK_1), 0, "the place is free again");
      const again = await remove(ADMIN_G1, ASSIGNMENT_F1_T1, 2);
      assert.deepEqual(
        [again.state, again.code],
        ["conflict", "VERSION_CONFLICT"],
        "removed is final",
      );
      assert.equal((await remove(OTHER_ADMIN, ASSIGNMENT_F1_T1, 1)).state, "validation");
      // The family can take a new place on the same task afterwards.
      assert.equal((await signUp(PARENT_F1, TASK_1, 2)).state, "success");
    });

    it("lists the parent's own tasks only through the functions: a parent reads no event or task table row (BR31.9)", async () => {
      for (const table of ["tasks", "events"]) {
        const rows = await asActor(
          db,
          schema,
          authenticated(PARENT_F1),
          async () => (await db.query(`select id from ${table}`)).rows.length,
        );
        assert.equal(rows, 0, table);
      }
      assert.ok(PARENT_ROW_F1);
    });
  });
}
