import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  ASSIGNMENT_F1_T1,
  ASSIGNMENT_F2_T3,
  ASSIGNMENT_OTHER,
  callFunction,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  FAMILY_2,
  FAMILY_NO_GROUP,
  nextKey,
  openDirectoryDatabase,
  ORGANIZATION,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_F1,
  seedCoordinationWorld,
  SUPER_ADMIN,
  TASK_2,
  TASK_3,
  TASK_OTHER,
  uuid,
} from "./directory-support.ts";
import { count } from "./identity-support.ts";
import { bindSchema, openDatabase } from "./stack-support.ts";

/** The fixed-list tests of BR4.1 to BR4.4, by the names of the Unit's test plan. */
const COMMUNITY_TASK = uuid(95001);
const SWAP_SOURCE = uuid(95002);

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`community duties in ${schema}`, () => {
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
    beforeEach(async () => {
      await seedCoordinationWorld(db, schema);
      await db.query(
        "insert into tasks (id, organization_id, group_id, title, capacity, starts_at, ends_at) values ($1, $2, null, 'Közös feladat', 2, now() + interval '9 days', now() + interval '9 days 2 hours')",
        [COMMUNITY_TASK, ORGANIZATION],
      );
    });

    const call = (account: string, sql: string, values: unknown[] = []) =>
      callFunction(db, schema, account, sql, values);
    const callSecond = (account: string, sql: string, values: unknown[] = []) =>
      callFunction(second, schema, account, sql, values);
    const signUp = (account: string, task: string, version: number, key = nextKey("sign")) =>
      call(account, "duty_sign_up($1, $2, $3)", [key, task, version]);
    const assign = (
      account: string,
      task: string,
      family: string,
      version: number,
      key = nextKey("as"),
    ) => call(account, "assignment_assign($1, $2, $3, $4)", [key, task, family, version]);

    it("BR4.1 any group", async () => {
      const list = await call(PARENT_F1, "duty_list()");
      const ids = (list.items as { id: string; state: string }[]).map((item) => item.id);
      assert.ok(ids.includes(TASK_3) && ids.includes(COMMUNITY_TASK));
      assert.ok(!(list.items as { state: string }[]).some((item) => item.state === "ineligible"));
      assert.equal((await signUp(PARENT_F1, TASK_3, 1)).state, "success");
      assert.equal((await signUp(PARENT_F1, COMMUNITY_TASK, 1)).state, "success");
    });
    it("BR4.1 full, closed refused", async () => {
      await db.query(
        "insert into assignments (organization_id, task_id, family_id, source) values ($1, $2, $3, 'admin_assign')",
        [ORGANIZATION, TASK_2, FAMILY_2],
      );
      assert.equal((await signUp(PARENT_F1, TASK_2, 1)).code, "DUTY_FULL");
      await db.query("update tasks set status = 'closed', version = 1 where id = $1", [
        COMMUNITY_TASK,
      ]);
      const closed = await signUp(PARENT_F1, COMMUNITY_TASK, 1);
      assert.ok(["DUTY_CLOSED", "DUTY_VERSION_STALE"].includes(String(closed.code)));
    });
    it("BR4.1 other community", async () => {
      const result = await signUp(PARENT_F1, TASK_OTHER, 1);
      assert.deepEqual([result.state, result.code], ["validation", "duty_not_found"]);
    });
    it("BR4.1 stale version", async () => {
      assert.equal((await signUp(PARENT_F1, TASK_3, 99)).code, "DUTY_VERSION_STALE");
    });
    it("BR4.1 repeat", async () => {
      const key = nextKey("repeat");
      const first = await signUp(PARENT_F1, TASK_3, 1, key);
      const again = await signUp(PARENT_F1, TASK_3, 1, key);
      assert.deepEqual([again.reference, again.code], [first.reference, "replayed"]);
    });
    it("BR4.1 last place race", async () => {
      const results = await Promise.all([
        signUp(PARENT_F1, TASK_2, 1),
        callSecond(PARENT_F2, "duty_sign_up($1, $2, $3)", [nextKey("b"), TASK_2, 1]),
      ]);
      assert.equal(results.filter((result) => result.state === "success").length, 1);
      assert.equal(
        await count(db, "assignments", `task_id = '${TASK_2}' and status <> 'removed'`),
        1,
      );
    });

    it("BR4.2 allowed", async () => {
      const result = await assign(ADMIN_G1, TASK_2, FAMILY_NO_GROUP, 1);
      assert.equal(result.state, "success");
      assert.equal((await assign(SUPER_ADMIN, COMMUNITY_TASK, FAMILY_2, 1)).state, "success");
    });
    it("BR4.2 archived family refused", async () => {
      await db.query("update families set status = 'archived', archived_at = now() where id = $1", [
        FAMILY_2,
      ]);
      const result = await assign(ADMIN_G1, TASK_2, FAMILY_2, 1);
      assert.deepEqual(
        [result.state, result.field, result.reason],
        ["validation", "family_id", "archived"],
      );
    });
    it("BR4.2 other group's task", async () => {
      assert.equal((await assign(ADMIN_G1, TASK_3, FAMILY_1, 1)).state, "denied");
      assert.equal((await assign(ADMIN_G1, COMMUNITY_TASK, FAMILY_1, 1)).state, "denied");
    });
    it("BR4.2 stale version", async () => {
      assert.equal((await assign(ADMIN_G1, TASK_2, FAMILY_1, 99)).code, "VERSION_CONFLICT");
    });
    it("BR4.2 repeat", async () => {
      const key = nextKey("repeat");
      const first = await assign(ADMIN_G1, TASK_2, FAMILY_1, 1, key);
      const again = await assign(ADMIN_G1, TASK_2, FAMILY_1, 1, key);
      assert.deepEqual([again.reference, again.code], [first.reference, "replayed"]);
    });
    it("BR4.2 last place race", async () => {
      const results = await Promise.all([
        assign(ADMIN_G1, TASK_2, FAMILY_1, 1),
        callSecond(SUPER_ADMIN, "assignment_assign($1, $2, $3, $4)", [
          nextKey("b"),
          TASK_2,
          FAMILY_2,
          1,
        ]),
      ]);
      assert.equal(results.filter((result) => result.state === "success").length, 1);
      assert.equal(
        await count(db, "assignments", `task_id = '${TASK_2}' and status <> 'removed'`),
        1,
      );
    });

    /** A place of the first family on group 1's second task, to swap with the second family's place in group 2. */
    const addSource = () =>
      db.query(
        "insert into assignments (id, organization_id, task_id, family_id, parent_id, source) values ($1, $2, $3, $4, $5, 'admin_assign')",
        [SWAP_SOURCE, ORGANIZATION, TASK_2, FAMILY_1, PARENT_ROW_F1],
      );
    const swap = (
      account: string,
      source: string,
      target: string,
      version = 1,
      key = nextKey("swap"),
    ) => call(account, "swap_request($1, $2, $3, $4, 1)", [key, source, version, target]);

    it("BR4.3 allowed", async () => {
      await addSource();
      assert.equal((await swap(PARENT_F1, SWAP_SOURCE, ASSIGNMENT_F2_T3)).state, "success");
      const candidates = await call(PARENT_F2, "swap_candidates($1)", [ASSIGNMENT_F2_T3]);
      assert.equal(candidates.state, "success");
    });
    it("BR4.3 pending refused", async () => {
      const result = await swap(PARENT_F2, ASSIGNMENT_F2_T3, ASSIGNMENT_F1_T1);
      assert.deepEqual([result.state, result.code], ["conflict", "REQUEST_CONFLICT"]);
    });
    it("BR4.3 other community", async () => {
      await addSource();
      const result = await swap(PARENT_F1, SWAP_SOURCE, ASSIGNMENT_OTHER);
      assert.deepEqual([result.state, result.code], ["validation", "assignment_not_found"]);
    });
    it("BR4.3 stale version", async () => {
      await addSource();
      const result = await swap(PARENT_F1, SWAP_SOURCE, ASSIGNMENT_F2_T3, 99);
      assert.equal(result.code, "REQUEST_VERSION_STALE");
    });
    it("BR4.3 repeat", async () => {
      await addSource();
      const key = nextKey("repeat");
      const first = await swap(PARENT_F1, SWAP_SOURCE, ASSIGNMENT_F2_T3, 1, key);
      const again = await swap(PARENT_F1, SWAP_SOURCE, ASSIGNMENT_F2_T3, 1, key);
      assert.deepEqual([again.reference, again.code], [first.reference, "replayed"]);
    });
    it("BR4.3 two proposals", async () => {
      await addSource();
      const sql = "swap_request($1, $2, 1, $3, 1)";
      const results = await Promise.all([
        call(PARENT_F1, sql, [nextKey("a"), SWAP_SOURCE, ASSIGNMENT_F2_T3]),
        callSecond(PARENT_F1, sql, [nextKey("b"), SWAP_SOURCE, ASSIGNMENT_F2_T3]),
      ]);
      assert.equal(results.filter((result) => result.state === "success").length, 1);
      assert.equal(
        await count(db, "change_requests", `assignment_id = '${SWAP_SOURCE}' and status = 'open'`),
        1,
      );
    });

    const recipients = async (task: string) =>
      (
        await db.query(
          `select distinct r.family_id from reminder_recipients r join reminder_jobs j on j.id = r.reminder_job_id
            where j.task_id = $1 and r.status = 'active' order by r.family_id`,
          [task],
        )
      ).rows.map((row) => row.family_id as string);
    const useGroupRecipients = async () => {
      await bindSchema(db, schema);
      await db.query(
        `insert into reminder_settings (organization_id, recipient_scope) values ($1, 'group')
         on conflict (organization_id, threshold) do update set recipient_scope = 'group'`,
        [ORGANIZATION],
      );
    };

    it("BR4.4 group, community", async () => {
      await useGroupRecipients();
      await db.query("select reminder_plan($1)", [TASK_2]);
      assert.deepEqual(await recipients(TASK_2), [FAMILY_1]);
      await db.query("select reminder_plan($1)", [COMMUNITY_TASK]);
      const active = await db.query(
        "select id from families where organization_id = $1 and status = 'active' order by id",
        [ORGANIZATION],
      );
      assert.deepEqual(
        await recipients(COMMUNITY_TASK),
        active.rows.map((row) => row.id),
      );
    });
    it("BR4.4 plan twice", async () => {
      await useGroupRecipients();
      await db.query("select reminder_plan($1)", [TASK_2]);
      const jobs = await count(db, "reminder_jobs", `task_id = '${TASK_2}'`);
      await db.query("select reminder_plan($1)", [TASK_2]);
      assert.equal(await count(db, "reminder_jobs", `task_id = '${TASK_2}'`), jobs);
    });
  });
}
