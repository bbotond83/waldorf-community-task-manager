import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { DIRECTORY_SCHEMAS, openDirectoryDatabase } from "./directory-support.ts";
import {
  ADMIN_G1,
  caller,
  claim,
  FAMILY_1,
  FAMILY_2,
  freeClaim,
  historyOf,
  insertTodo,
  markDone,
  nextKey,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_F1,
  save,
  seedTodoWorld,
  SUPER_ADMIN,
  todoRow,
} from "./todo-support.ts";
import { FAMILY_ADMIN_G1 as FAMILY_3 } from "./identity-support.ts";
import { openDatabase } from "./stack-support.ts";

/**
 * Two people at once on a to-do task (NFR3, NFR5): the task row lock decides who passes, never a client-side queue.
 * Each racer uses its own connection.
 */
const RUNS = 10;

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`todo races in ${schema}`, () => {
    let db: pg.Client;
    let pool: pg.Client[];
    before(async () => {
      db = await openDirectoryDatabase(schema);
      pool = await Promise.all(Array.from({ length: 2 }, () => openDatabase()));
    });
    after(async () => {
      await Promise.all(pool.map((connection) => connection.end()));
      await db.end();
    });
    beforeEach(async () => {
      await seedTodoWorld(db, schema);
    });
    const racer = (index: number) => caller(() => pool[index]!, schema);
    const states = (answers: { state: string }[]) => answers.map((answer) => answer.state).sort();

    it("two parents claiming at once: one succeeds and the other is told it is taken", async () => {
      for (let round = 0; round < RUNS; round += 1) {
        const id = await insertTodo(db);
        const answers = await Promise.all([
          claim(racer(0), PARENT_F1, id, 1),
          claim(racer(1), PARENT_F2, id, 1),
        ]);
        assert.deepEqual(states(answers), ["conflict", "success"], `round ${round}`);
        assert.equal(answers.find((a) => a.state === "conflict")!.code, "TODO_CLAIMED");
        assert.equal((await historyOf(db, id)).filter((h) => h.change === "claimed").length, 1);
      }
    });

    it("repeated click: the same parent pressing twice with two keys claims once", async () => {
      for (let round = 0; round < RUNS; round += 1) {
        const id = await insertTodo(db);
        const answers = await Promise.all([
          claim(racer(0), PARENT_F1, id, 1, nextKey(`a${round}`)),
          claim(racer(1), PARENT_F1, id, 1, nextKey(`b${round}`)),
        ]);
        assert.deepEqual(states(answers), ["conflict", "success"], `round ${round}`);
        assert.equal((await todoRow(db, id)).version, 2);
      }
    });

    it("done against free-claim: exactly one wins and the end state is consistent", async () => {
      for (let round = 0; round < RUNS; round += 1) {
        const id = await insertTodo(db, { claimant: PARENT_ROW_F1 });
        const answers = await Promise.all([
          markDone(racer(0), PARENT_F1, id, 1),
          freeClaim(racer(1), ADMIN_G1, id, 1),
        ]);
        assert.deepEqual(
          states(answers).filter((s) => s === "success").length,
          1,
          `round ${round}`,
        );
        const row = await todoRow(db, id);
        if (row.status === "done") {
          assert.equal(row.claimant_parent_id, PARENT_ROW_F1);
        } else {
          assert.deepEqual([row.status, row.claimant_parent_id, row.done_at], ["open", null, null]);
        }
      }
    });

    it("done against edit: one succeeds and the other reads a conflict, never both", async () => {
      for (let round = 0; round < RUNS; round += 1) {
        const id = await insertTodo(db, { claimant: PARENT_ROW_F1 });
        const answers = await Promise.all([
          markDone(racer(0), PARENT_F1, id, 1),
          save(racer(1), ADMIN_G1, { id, expected_version: 1, topic: "Átírva" }),
        ]);
        assert.deepEqual(states(answers), ["conflict", "success"], `round ${round}`);
        assert.equal((await todoRow(db, id)).version, 2);
      }
    });

    it("two hand-overs at once: two super admins handing a family's task to different families, one succeeds and the other reads a version conflict", async () => {
      for (let round = 0; round < RUNS; round += 1) {
        const id = await insertTodo(db, { family: FAMILY_1, group: null, attention: true });
        const answers = await Promise.all([
          save(racer(0), SUPER_ADMIN, {
            id,
            expected_version: 1,
            owner_family_id: FAMILY_2,
            topic: "Kerítés javítása",
          }),
          save(racer(1), SUPER_ADMIN, {
            id,
            expected_version: 1,
            owner_family_id: FAMILY_3,
            topic: "Kerítés javítása",
          }),
        ]);
        assert.deepEqual(states(answers), ["conflict", "success"], `round ${round}`);
        const row = await todoRow(db, id);
        assert.equal(row.version, 2);
        assert.equal(row.needs_attention, false);
        assert.ok([FAMILY_2, FAMILY_3].includes(row.owner_family_id!), `round ${round}`);
      }
    });

    it("two hand-overs of a claimed task at once: one succeeds, the claim ends once and the other reads a version conflict", async () => {
      for (let round = 0; round < RUNS; round += 1) {
        const id = await insertTodo(db, { family: FAMILY_1, group: null, claimant: PARENT_ROW_F1 });
        const answers = await Promise.all([
          save(racer(0), SUPER_ADMIN, {
            id,
            expected_version: 1,
            owner_family_id: FAMILY_2,
            topic: "Kerítés javítása",
          }),
          save(racer(1), SUPER_ADMIN, {
            id,
            expected_version: 1,
            owner_family_id: FAMILY_3,
            topic: "Kerítés javítása",
          }),
        ]);
        assert.deepEqual(states(answers), ["conflict", "success"], `round ${round}`);
        const row = await todoRow(db, id);
        assert.deepEqual([row.status, row.claimant_parent_id], ["open", null], `round ${round}`);
        assert.equal(
          (await historyOf(db, id)).filter((h) => h.change === "claim_freed").length,
          1,
          `round ${round}`,
        );
      }
    });

    it("a hand-over waits for a family removal that holds the family row, then reads the family as gone", async () => {
      const id = await insertTodo(db, { family: FAMILY_1, group: null, attention: true });
      await pool[0]!.query("begin");
      await pool[0]!.query(`select 1 from ${schema}.families where id = $1 for update`, [FAMILY_2]);
      const waiting = save(racer(1), SUPER_ADMIN, {
        id,
        expected_version: 1,
        owner_family_id: FAMILY_2,
        topic: "Kerítés javítása",
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
      await pool[0]!.query(
        `update ${schema}.families set status = 'archived', archived_at = now() where id = $1`,
        [FAMILY_2],
      );
      await pool[0]!.query("commit");
      const answer = await waiting;
      assert.deepEqual(
        [answer.state, answer.field, answer.reason],
        ["validation", "owner", "not_found"],
      );
      assert.equal((await todoRow(db, id)).owner_family_id, FAMILY_1);
    });

    it("claim against a removal: a parent removed first leaves no claim; a claim made first is released by the removal", async () => {
      // Removal first: it holds the task row while the parent record changes, the claim waits and then sees the change.
      const first = await insertTodo(db);
      await pool[0]!.query("begin");
      await pool[0]!.query(`select 1 from ${schema}.todo_tasks where id = $1 for update`, [first]);
      await pool[0]!.query(`update ${schema}.parents set status = 'archived' where id = $1`, [
        PARENT_ROW_F1,
      ]);
      const waiting = claim(racer(1), PARENT_F1, first, 1);
      await new Promise((resolve) => setTimeout(resolve, 400));
      await pool[0]!.query("commit");
      const refused = await waiting;
      assert.equal(refused.state, "denied");
      assert.equal((await todoRow(db, first)).claimant_parent_id, null);
      await db.query("update parents set status = 'active' where id = $1", [PARENT_ROW_F1]);

      // Claim first: the removal then releases it and flags the task.
      const second = await insertTodo(db);
      assert.equal((await claim(racer(1), PARENT_F1, second, 1)).state, "success");
      await db.query(`select ${schema}.todo_removal_apply('parent', $1)`, [PARENT_ROW_F1]);
      const row = await todoRow(db, second);
      assert.deepEqual(
        [row.claimant_parent_id, row.needs_attention, row.status],
        [null, true, "open"],
      );
    });
  });
}
