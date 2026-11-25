import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { DIRECTORY_SCHEMAS, openDirectoryDatabase } from "./directory-support.ts";
import {
  insertTodo,
  noticeRows,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  seedTodoWorld,
  uuid,
} from "./todo-support.ts";

/**
 * The daily deadline reminder (C9; BR188.2), called as the schema owner with a chosen moment: once per claimant and
 * deadline, from three days before the deadline up to the deadline, and the same on the two clock-change weeks.
 */
type Counts = { created: number; skipped: number; detail: string | null };

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`todo reminder in ${schema}`, () => {
    let db: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedTodoWorld(db, schema);
    });
    const run = async (at: string) =>
      (await db.query(`select ${schema}.todo_deadline_reminder($1::timestamptz) as r`, [at]))
        .rows[0].r as Counts;
    const reminders = async (parent: string) => (await noticeRows(db, parent, "todo_due")).length;

    it("registered as a daily check at lock step 4 (the missing rights are checked in todo-for-later-units)", async () => {
      const row = (
        await db.query(
          "select run_kind, is_active, lock_step, function_name from timed_check_registry where check_name = 'todo_deadline_reminder'",
        )
      ).rows[0];
      assert.deepEqual(row, {
        run_kind: "daily",
        is_active: true,
        lock_step: 4,
        function_name: "todo_deadline_reminder",
      });
    });

    it("window edges: nothing four days before, one notice from three days before, none after the deadline", async () => {
      const id = await insertTodo(db, { claimant: PARENT_ROW_F1, deadline: "2027-06-10" });
      assert.equal((await run("2027-06-06T12:00:00+02:00")).created, 0, "four days before");
      assert.equal((await run("2027-06-07T12:00:00+02:00")).created, 1, "three days before");
      assert.equal(await reminders(PARENT_ROW_F1), 1);
      const row = (
        await db.query("select target_type, target_ref from notifications where kind = 'todo_due'")
      ).rows[0];
      assert.deepEqual([row.target_type, row.target_ref], ["todo_task", id]);
      assert.equal((await run("2027-06-11T12:00:00+02:00")).created, 0, "after the deadline");
    });

    it("timing: with 600 claimed tasks all in the window, the check finishes in under 1 second (NFR9.16)", async () => {
      await db.query(
        `insert into todo_tasks (organization_id, owner_group_id, topic, deadline, claimant_parent_id, claimed_at, status)
         select g.organization_id, g.id, 'Mérés ' || n, date '2027-06-10', $1::uuid, now(), 'in_progress'
           from generate_series(1, 600) n cross join (select * from groups limit 1) g`,
        [PARENT_ROW_F1],
      );
      const start = performance.now();
      const counts = await run("2027-06-08T08:00:00+02:00");
      const ms = performance.now() - start;
      assert.equal(counts.created, 600);
      assert.ok(ms < 1000, `the check took ${ms} ms`);
    });

    it("the deadline day itself is inside the window", async () => {
      await insertTodo(db, { claimant: PARENT_ROW_F1, deadline: "2027-06-10" });
      assert.equal((await run("2027-06-10T09:00:00+02:00")).created, 1);
    });

    it("run twice: the second run and every later day in the window add nothing", async () => {
      await insertTodo(db, { claimant: PARENT_ROW_F1, deadline: "2027-06-10" });
      assert.equal((await run("2027-06-08T08:00:00+02:00")).created, 1);
      assert.equal((await run("2027-06-08T08:05:00+02:00")).created, 0);
      assert.equal((await run("2027-06-09T08:00:00+02:00")).created, 0);
      assert.equal(await reminders(PARENT_ROW_F1), 1);
    });

    it("a new claimant is reminded once, and moving the deadline allows one new reminder for the new date", async () => {
      const id = await insertTodo(db, { claimant: PARENT_ROW_F1, deadline: "2027-06-10" });
      await run("2027-06-08T08:00:00+02:00");
      await db.query("update todo_tasks set claimant_parent_id = $2 where id = $1", [
        id,
        PARENT_ROW_F2,
      ]);
      assert.equal((await run("2027-06-08T09:00:00+02:00")).created, 1);
      assert.deepEqual([await reminders(PARENT_ROW_F1), await reminders(PARENT_ROW_F2)], [1, 1]);
      await db.query("update todo_tasks set deadline = '2027-06-11' where id = $1", [id]);
      assert.equal((await run("2027-06-09T09:00:00+02:00")).created, 1);
      assert.equal(await reminders(PARENT_ROW_F2), 2);
    });

    it("no reminder without a deadline, without a claimant, for a done task or for a claimant who is gone", async () => {
      await insertTodo(db, { claimant: PARENT_ROW_F1 });
      await insertTodo(db, { deadline: "2027-06-10" });
      await insertTodo(db, { claimant: PARENT_ROW_F1, deadline: "2027-06-10", status: "done" });
      await insertTodo(db, { claimant: uuid(9777), deadline: "2027-06-10" });
      const answer = await run("2027-06-08T08:00:00+02:00");
      assert.deepEqual([answer.created, answer.skipped, answer.detail], [0, 1, null]);
    });

    it("one failing task is named in the detail and the others still get their notice", async () => {
      const bad = await insertTodo(db, {
        id: uuid(9801),
        claimant: PARENT_ROW_F1,
        deadline: "2027-06-10",
      });
      await insertTodo(db, { id: uuid(9802), claimant: PARENT_ROW_F2, deadline: "2027-06-10" });
      await db.query(
        `create function ${schema}.u12_fail_notice() returns trigger language plpgsql as $f$ begin raise exception 'forced failure'; end $f$`,
      );
      await db.query(
        `create trigger u12_fail before insert on ${schema}.notifications for each row when (new.target_ref = '${bad}') execute function ${schema}.u12_fail_notice()`,
      );
      try {
        const answer = await run("2027-06-08T08:00:00+02:00");
        assert.equal(answer.created, 1);
        assert.equal(answer.detail, `failed: ${bad}`);
        assert.equal(await reminders(PARENT_ROW_F2), 1);
      } finally {
        await db.query(`drop trigger u12_fail on ${schema}.notifications`);
        await db.query(`drop function ${schema}.u12_fail_notice()`);
      }
    });

    it("the clock-change weeks are ordinary: the window opens on the Budapest date, spring and autumn", async () => {
      // Spring: the clocks go forward on Sunday 2027-03-28; the deadline is the Monday after.
      await insertTodo(db, { id: uuid(9801), claimant: PARENT_ROW_F1, deadline: "2027-03-29" });
      assert.equal((await run("2027-03-25T23:30:00+01:00")).created, 0, "the 25th");
      assert.equal((await run("2027-03-26T00:30:00+01:00")).created, 1, "the 26th");
      // Autumn: the clocks go back on Sunday 2026-10-25; the deadline is the Monday after.
      await insertTodo(db, { id: uuid(9802), claimant: PARENT_ROW_F2, deadline: "2026-10-26" });
      assert.equal((await run("2026-10-22T23:30:00+02:00")).created, 0, "the 22nd");
      assert.equal((await run("2026-10-23T00:30:00+02:00")).created, 1, "the 23rd");
    });
  });
}
