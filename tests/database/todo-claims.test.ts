import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { DIRECTORY_SCHEMAS, openDirectoryDatabase } from "./directory-support.ts";
import {
  ADMIN_G1,
  ADMIN_G2,
  auditRows,
  caller,
  claim,
  CO_PARENT_F1,
  FAMILY_2,
  freeClaim,
  GROUP_1,
  giveBack,
  historyOf,
  insertTodo,
  markDone,
  noticeRows,
  outcome,
  OUTSIDER,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_ADMIN_G1,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  save,
  seedTodoWorld,
  SUPER_ADMIN,
  TEACHER_G1,
  todoRow,
  undoDone,
  update,
  nextKey,
} from "./todo-support.ts";

/**
 * Claim, give back, free, update, done and undo (W2 to W3; BR182.1 to BR183.3, BR188.1, NFR1, NFR3, NFR10) on the fixed
 * list. The claimant is a parent with a family; a family-owned task belongs to that family only.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`todo claims in ${schema}`, () => {
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
    const call = caller(() => db, schema);
    const notices = async (parent: string) => (await noticeRows(db, parent, "todo_changed")).length;

    it("allowed: a parent claims a group's task whether or not they are in the group; it goes in progress and the version rises", async () => {
      const id = await insertTodo(db);
      const answer = await claim(call, PARENT_F2, id, 1);
      assert.equal(answer.state, "success", JSON.stringify(answer));
      const row = await todoRow(db, id);
      assert.deepEqual(
        [row.status, row.claimant_parent_id, row.version, row.claimed_at !== null],
        ["in_progress", PARENT_ROW_F2, 2, true],
      );
      assert.deepEqual(
        (await historyOf(db, id)).map((h) => [h.change, h.from_status, h.to_status]),
        [["claimed", "open", "in_progress"]],
      );
    });

    it("refused: another parent, even of the claimant's family, reads that it is taken before any version check", async () => {
      const id = await insertTodo(db);
      await claim(call, PARENT_F1, id, 1);
      for (const account of [PARENT_F2, CO_PARENT_F1]) {
        const answer = await claim(call, account, id, 1);
        assert.deepEqual(outcome(answer), ["conflict", "TODO_CLAIMED"], account);
      }
      assert.equal((await todoRow(db, id)).claimant_parent_id, PARENT_ROW_F1);
    });

    it("refused: a teacher, a super admin without a family and a caller with no family cannot claim", async () => {
      const id = await insertTodo(db);
      for (const account of [TEACHER_G1, SUPER_ADMIN, OUTSIDER]) {
        const answer = await claim(call, account, id, 1);
        assert.equal(answer.state, "denied", account);
      }
      assert.equal((await todoRow(db, id)).claimant_parent_id, null);
    });

    it("refused: a task that is done, not yet due or stale cannot be claimed", async () => {
      const done = await insertTodo(db, { status: "done" });
      assert.deepEqual(outcome(await claim(call, PARENT_F1, done, 1)), ["conflict", "TODO_DONE"]);
      const future = await insertTodo(db, { notBefore: "2099-01-01" });
      assert.deepEqual(outcome(await claim(call, PARENT_F1, future, 1)), [
        "conflict",
        "TODO_NOT_YET",
      ]);
      const stale = await insertTodo(db);
      assert.deepEqual(outcome(await claim(call, PARENT_F1, stale, 7)), [
        "conflict",
        "VERSION_CONFLICT",
      ]);
    });

    it("out of reach: a family-owned task is claimed by that family only, and another family gets the same answer as for an unknown task", async () => {
      const own = await insertTodo(db, { group: null, family: FAMILY_2 });
      const wrong = await claim(call, PARENT_F1, own, 1);
      const unknown = await claim(call, PARENT_F1, "99999999-0000-4000-8000-000000000999", 1);
      assert.deepEqual(outcome(wrong), outcome(unknown));
      assert.equal(wrong.state, "denied");
      assert.equal((await claim(call, PARENT_F2, own, 1)).state, "success");
    });

    it("give back: only the claimant, only before done; a task with no claimant says so; in progress goes back to open", async () => {
      const id = await insertTodo(db);
      await claim(call, PARENT_F1, id, 1);
      assert.equal((await giveBack(call, PARENT_F2, id, 2)).state, "denied");
      assert.equal(
        (await giveBack(call, ADMIN_G1, id, 2)).state,
        "denied",
        "a manager frees, not gives back",
      );
      assert.equal((await giveBack(call, PARENT_F1, id, 9)).code, "VERSION_CONFLICT");
      assert.equal((await giveBack(call, PARENT_F1, id, 2)).state, "success");
      const row = await todoRow(db, id);
      assert.deepEqual(
        [row.status, row.claimant_parent_id, row.claimed_at, row.version],
        ["open", null, null, 3],
      );
      assert.deepEqual(outcome(await giveBack(call, PARENT_F1, id, 3)), [
        "conflict",
        "TODO_NOT_CLAIMED",
      ]);
    });

    it("free a claim: the owner group's coordinator or a super admin frees it and the claimant is told; another coordinator is refused; the audit holds no name", async () => {
      const id = await insertTodo(db);
      await claim(call, PARENT_F1, id, 1);
      assert.equal((await freeClaim(call, ADMIN_G2, id, 2)).state, "denied");
      assert.equal((await freeClaim(call, PARENT_F2, id, 2)).state, "denied");
      const freed = await freeClaim(call, ADMIN_G1, id, 2);
      assert.equal(freed.state, "success", JSON.stringify(freed));
      assert.equal((await todoRow(db, id)).claimant_parent_id, null);
      assert.equal(await notices(PARENT_ROW_F1), 1);
      const rows = await auditRows(db, "todo.claim_freed");
      assert.equal(rows.length, 1);
      assert.match(rows[0]!.details ?? "", /^[a-z0-9_.:-]*$/);
      assert.equal(rows[0]!.target_id, id);
      assert.deepEqual(outcome(await freeClaim(call, ADMIN_G1, id, 3)), [
        "conflict",
        "TODO_NOT_CLAIMED",
      ]);
    });

    it("repeated click on an audited change: freeing a claim twice with the same key writes one audit entry and one notice (NFR4.18)", async () => {
      const id = await insertTodo(db);
      await claim(call, PARENT_F1, id, 1);
      const key = nextKey("fr");
      assert.equal((await freeClaim(call, ADMIN_G1, id, 2, key)).state, "success");
      const again = await freeClaim(call, ADMIN_G1, id, 2, key);
      assert.deepEqual([again.state, again.code], ["success", "replayed"]);
      assert.equal((await auditRows(db, "todo.claim_freed")).length, 1);
      assert.equal(await notices(PARENT_ROW_F1), 1);
    });

    it("repeated click on each command answers with the current version (the claim, give back, free, update, done and undo)", async () => {
      const id = await insertTodo(db);
      const cKey = nextKey("rc");
      assert.equal((await claim(call, PARENT_F1, id, 1, cKey)).version, 2);
      assert.deepEqual(
        [
          (await claim(call, PARENT_F1, id, 1, cKey)).code,
          (await claim(call, PARENT_F1, id, 1, cKey)).version,
        ],
        ["replayed", 2],
      );
      const uKey = nextKey("ru");
      assert.equal((await update(call, PARENT_F1, id, "postponed", "Később", 2, uKey)).version, 3);
      assert.equal((await update(call, PARENT_F1, id, "postponed", "Később", 2, uKey)).version, 3);
      const dKey = nextKey("rd");
      assert.equal((await markDone(call, PARENT_F1, id, 3, dKey)).version, 4);
      assert.equal((await markDone(call, PARENT_F1, id, 3, dKey)).version, 4);
      const nKey = nextKey("rn");
      assert.equal((await undoDone(call, PARENT_F1, id, 4, nKey)).version, 5);
      assert.equal((await undoDone(call, PARENT_F1, id, 4, nKey)).version, 5);
      const gKey = nextKey("rg");
      assert.equal((await giveBack(call, PARENT_F1, id, 5, gKey)).version, 6);
      assert.equal((await giveBack(call, PARENT_F1, id, 5, gKey)).version, 6);
      await claim(call, PARENT_F1, id, 6);
      const fKey = nextKey("rf");
      assert.equal((await freeClaim(call, ADMIN_G1, id, 7, fKey)).version, 8);
      assert.equal((await freeClaim(call, ADMIN_G1, id, 7, fKey)).version, 8);
    });

    it("update: the claimant postpones with a note; a postponed task needs one; a manager's status change notifies, a note-only edit does not", async () => {
      const id = await insertTodo(db);
      await claim(call, PARENT_F1, id, 1);
      const noNote = await update(call, PARENT_F1, id, "postponed", null, 2);
      assert.deepEqual([noNote.field, noNote.reason], ["note", "required"]);
      assert.equal(
        (await update(call, PARENT_F2, id, "postponed", "Nem az enyém", 2)).state,
        "denied",
      );
      assert.equal(
        (await update(call, PARENT_F1, id, "postponed", "Jövő héten", 2)).state,
        "success",
      );
      const row = await todoRow(db, id);
      assert.deepEqual([row.status, row.note, row.version], ["postponed", "Jövő héten", 3]);
      assert.equal(await notices(PARENT_ROW_F1), 0, "the claimant's own change sends nothing");
      assert.equal((await update(call, ADMIN_G1, id, null, "Megjegyzés", 3)).state, "success");
      assert.equal(await notices(PARENT_ROW_F1), 0, "a note-only edit sends nothing");
      assert.equal(
        (await update(call, ADMIN_G1, id, "in_progress", "Megjegyzés", 4)).state,
        "success",
      );
      assert.equal(await notices(PARENT_ROW_F1), 1);
      const open = await update(call, ADMIN_G1, id, "open", "Megjegyzés", 5);
      assert.deepEqual(
        outcome(open),
        ["validation", "status_not_allowed"],
        "open needs the claim freed first",
      );
    });

    it("done: the claimant or a manager marks it with who and when; a super admin with no parent record is told why; a second press from an old screen is refused", async () => {
      const id = await insertTodo(db);
      await claim(call, PARENT_F1, id, 1);
      assert.equal((await markDone(call, PARENT_F2, id, 2)).state, "denied");
      assert.deepEqual(outcome(await markDone(call, SUPER_ADMIN, id, 2)), [
        "denied",
        "no_parent_record",
      ]);
      assert.equal((await markDone(call, PARENT_F1, id, 2)).state, "success");
      const row = await todoRow(db, id);
      assert.deepEqual(
        [
          row.status,
          row.done_by_parent_id,
          row.claimant_parent_id,
          row.done_at !== null,
          row.version,
        ],
        ["done", PARENT_ROW_F1, PARENT_ROW_F1, true, 3],
      );
      assert.deepEqual(outcome(await markDone(call, ADMIN_G1, id, 2)), ["conflict", "TODO_DONE"]);
      assert.equal(await notices(PARENT_ROW_F1), 0);
    });

    it("undo done: the one who marked it or a manager reopens it, others are refused, an open task says it is not done; audited without names", async () => {
      const id = await insertTodo(db);
      await claim(call, PARENT_F1, id, 1);
      await markDone(call, PARENT_F1, id, 2);
      assert.equal((await undoDone(call, PARENT_F2, id, 3)).state, "denied");
      assert.equal((await undoDone(call, ADMIN_G2, id, 3)).state, "denied");
      const undone = await undoDone(call, ADMIN_G1, id, 3);
      assert.equal(undone.state, "success", JSON.stringify(undone));
      const row = await todoRow(db, id);
      assert.deepEqual(
        [row.status, row.done_at, row.done_by_parent_id],
        ["in_progress", null, null],
      );
      assert.equal(await notices(PARENT_ROW_F1), 1, "a manager's undo tells the claimant");
      assert.deepEqual(outcome(await undoDone(call, ADMIN_G1, id, 4)), [
        "conflict",
        "TODO_NOT_DONE",
      ]);
      const rows = await auditRows(db, "todo.done_undone");
      assert.equal(rows.length, 1);
      assert.match(rows[0]!.details ?? "", /^[a-z0-9_.:-]*$/);
    });

    it("repeated click: the same key claims, gives back and marks done once", async () => {
      const id = await insertTodo(db);
      const key = nextKey("dbl");
      const first = await claim(call, PARENT_F1, id, 1, key);
      const again = await claim(call, PARENT_F1, id, 1, key);
      assert.deepEqual(
        [again.state, again.code, again.reference],
        ["success", "replayed", first.reference],
      );
      assert.equal((await todoRow(db, id)).version, 2);
      const doneKey = nextKey("dn");
      await markDone(call, PARENT_F1, id, 2, doneKey);
      await markDone(call, PARENT_F1, id, 2, doneKey);
      assert.equal((await historyOf(db, id)).filter((h) => h.change === "marked_done").length, 1);
    });

    it("timings: with 600 tasks in the community, claim, update, done, undo and give back each answer in under 1 second (NFR9.14)", async () => {
      await db.query(
        `insert into todo_tasks (organization_id, owner_group_id, topic, priority, deadline)
         select g.organization_id, g.id, 'Mérés ' || n, (n % 3) + 1, current_date + (n % 40)
           from generate_series(1, 600) n cross join (select * from groups where id = $1) g`,
        [GROUP_1],
      );
      const id = await insertTodo(db);
      const steps = [
        ["claim", () => claim(call, PARENT_F1, id, 1)],
        ["update", () => update(call, PARENT_F1, id, "in_progress", "Folyamatban", 2)],
        ["done", () => markDone(call, PARENT_F1, id, 3)],
        ["undo", () => undoDone(call, PARENT_F1, id, 4)],
        ["give back", () => giveBack(call, PARENT_F1, id, 5)],
      ] as const;
      for (const [label, run] of steps) {
        const start = performance.now();
        const answer = await run();
        const ms = performance.now() - start;
        assert.equal(answer.state, "success", `${label}: ${JSON.stringify(answer)}`);
        assert.ok(ms < 1000, `${label} took ${ms} ms`);
      }
      assert.equal((await todoRow(db, id)).version, 6);
    });

    it("a family's co-parent can finish nothing of the claimant's, and a manager who is also a parent can claim", async () => {
      const id = await insertTodo(db);
      await claim(call, PARENT_F1, id, 1);
      assert.equal((await markDone(call, CO_PARENT_F1, id, 2)).state, "denied");
      const other = await insertTodo(db, { topic: "Másik" });
      assert.equal((await claim(call, ADMIN_G1, other, 1)).state, "success");
      assert.equal((await todoRow(db, other)).claimant_parent_id, PARENT_ROW_ADMIN_G1);
    });

    it("saving a task the claimant holds tells them for a field change but not for a new task", async () => {
      const made = await save(call, ADMIN_G1, {
        owner_group_id: (await todoRow(db, await insertTodo(db))).owner_group_id,
        topic: "Új",
      });
      assert.equal(made.state, "success");
      assert.equal(await notices(PARENT_ROW_F1), 0);
      const id = await insertTodo(db);
      await claim(call, PARENT_F1, id, 1);
      await save(call, ADMIN_G1, { id, expected_version: 2, topic: "Átnevezve" });
      assert.equal(await notices(PARENT_ROW_F1), 1);
      await save(call, ADMIN_G1, {
        id,
        expected_version: 3,
        topic: "Átnevezve",
        note: "Csak megjegyzés",
      });
      assert.equal(await notices(PARENT_ROW_F1), 1);
    });
  });
}
