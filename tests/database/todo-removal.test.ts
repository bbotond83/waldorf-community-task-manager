import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { DIRECTORY_SCHEMAS, openDirectoryDatabase } from "./directory-support.ts";
import {
  ADMIN_G1,
  auditRows,
  caller,
  claim,
  FAMILY_2,
  historyOf,
  insertTodo,
  markDone,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  seedTodoWorld,
  todoRow,
  update,
} from "./todo-support.ts";

/**
 * Removing a parent or a family (C16, BR190.1): names are cleared, a removed person's open claim is released and the task
 * flagged, a removed family's open tasks are flagged, and preview and apply return the same two counts.
 */
type Counts = { to_clear: number; to_flag: number };

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`todo removal in ${schema}`, () => {
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
    const preview = async (kind: string, id: string) =>
      (await db.query(`select ${schema}.todo_removal_preview($1, $2) as r`, [kind, id])).rows[0]
        .r as Counts;
    const apply = async (kind: string, id: string) =>
      (await db.query(`select ${schema}.todo_removal_apply($1, $2) as r`, [kind, id])).rows[0]
        .r as Counts;

    it("a parent: an open claim is released and flagged, a claim on a done task and the done mark lose the person, history names are cleared, and preview equals apply", async () => {
      const open = await insertTodo(db, { topic: "Nyitott" });
      const finished = await insertTodo(db, { topic: "Befejezett" });
      await claim(call, PARENT_F1, open, 1);
      await claim(call, PARENT_F1, finished, 1);
      await markDone(call, PARENT_F1, finished, 2);
      const other = await insertTodo(db, { topic: "Másé" });
      await claim(call, PARENT_F2, other, 1);

      const planned = await preview("parent", PARENT_ROW_F1);
      assert.deepEqual(planned, { to_clear: 5, to_flag: 1 });
      const applied = await apply("parent", PARENT_ROW_F1);
      assert.deepEqual(applied, planned);

      const released = await todoRow(db, open);
      assert.deepEqual(
        [
          released.claimant_parent_id,
          released.claimed_at,
          released.needs_attention,
          released.status,
          released.version,
        ],
        [null, null, true, "open", 3],
      );
      assert.deepEqual(
        (await historyOf(db, open)).map((h) => [h.change, h.actor_kind, h.changed_by_parent_id]),
        [
          ["claimed", "parent", null],
          ["claimant_removed", "system", null],
        ],
      );
      const kept = await todoRow(db, finished);
      assert.deepEqual(
        [kept.status, kept.claimant_parent_id, kept.done_by_parent_id, kept.needs_attention],
        ["done", null, null, false],
      );
      assert.equal(
        (await todoRow(db, other)).claimant_parent_id,
        PARENT_ROW_F2,
        "another parent untouched",
      );
      const named = await db.query(
        "select count(*)::int as n from todo_task_history where changed_by_parent_id = $1",
        [PARENT_ROW_F1],
      );
      assert.equal(named.rows[0].n, 0);
      const audit = await auditRows(db, "todo.removal_applied");
      assert.equal(audit.length, 1);
      assert.match(audit[0]!.details ?? "", /^cleared:5:flagged:1$/);
    });

    it("a postponed task keeps its status when its claimant is removed", async () => {
      const id = await insertTodo(db);
      await claim(call, PARENT_F1, id, 1);
      await update(call, PARENT_F1, id, "postponed", "Később", 2);
      await apply("parent", PARENT_ROW_F1);
      const row = await todoRow(db, id);
      assert.deepEqual(
        [row.status, row.claimant_parent_id, row.needs_attention],
        ["postponed", null, true],
      );
    });

    it("a family: its open tasks are flagged, its done tasks are not, and the parents' names are cleared; the flagged tasks are readable through the list", async () => {
      const mine = await insertTodo(db, {
        topic: "Családi nyitott",
        group: null,
        family: FAMILY_2,
      });
      const done = await insertTodo(db, {
        topic: "Családi kész",
        group: null,
        family: FAMILY_2,
        status: "done",
      });
      const claimed = await insertTodo(db, { topic: "Csoportos" });
      await claim(call, PARENT_F2, claimed, 1);
      const planned = await preview("family", FAMILY_2);
      assert.deepEqual(planned, { to_clear: 2, to_flag: 2 });
      assert.deepEqual(await apply("family", FAMILY_2), planned);
      assert.equal((await todoRow(db, mine)).needs_attention, true);
      assert.equal((await todoRow(db, done)).needs_attention, false);
      const flagged = await call(ADMIN_G1, "todo_list($1, $2, $3, $4, $5)", [
        true,
        null,
        null,
        null,
        true,
      ]);
      assert.deepEqual((flagged.items as { topic: string }[]).map((i) => i.topic).sort(), [
        "Családi nyitott",
        "Csoportos",
      ]);
      const card = (await call(ADMIN_G1, "todo_get($1)", [claimed])).item as Record<
        string,
        unknown
      >;
      assert.equal(card.claimant_display_name, null);
      const label = ((await call(ADMIN_G1, "todo_get($1)", [mine])).item as Record<string, unknown>)
        .owner_label;
      assert.equal(typeof label, "string");
    });

    it("nothing to do: an unknown subject, another kind and a parent holding nothing return zero counts and change nothing", async () => {
      await insertTodo(db);
      const zero = { to_clear: 0, to_flag: 0 };
      assert.deepEqual(await apply("parent", "00000000-0000-4000-8000-0000000000aa"), zero);
      assert.deepEqual(await apply("group", PARENT_ROW_F1), zero);
      assert.deepEqual(await preview("group", PARENT_ROW_F1), zero);
      assert.deepEqual(await preview("parent", PARENT_ROW_F1), zero);
      assert.deepEqual(await apply("parent", PARENT_ROW_F1), zero);
      assert.equal(
        (await db.query("select count(*)::int as n from todo_tasks where needs_attention")).rows[0]
          .n,
        0,
      );
    });

    it("repeated click: applying twice clears once, and the second preview shows nothing left", async () => {
      const id = await insertTodo(db);
      await claim(call, PARENT_F1, id, 1);
      assert.deepEqual(await apply("parent", PARENT_ROW_F1), { to_clear: 2, to_flag: 1 });
      assert.deepEqual(await preview("parent", PARENT_ROW_F1), { to_clear: 0, to_flag: 0 });
      assert.deepEqual(await apply("parent", PARENT_ROW_F1), { to_clear: 0, to_flag: 0 });
      assert.equal(
        (await historyOf(db, id)).filter((h) => h.change === "claimant_removed").length,
        1,
      );
    });

    it("an administrator's next save of a flagged task clears the flag, and history rows are never deleted", async () => {
      const id = await insertTodo(db);
      await claim(call, PARENT_F1, id, 1);
      await apply("parent", PARENT_ROW_F1);
      const saved = await call(ADMIN_G1, "todo_task_save($1, $2::jsonb)", [
        "rm-save",
        JSON.stringify({ id, expected_version: 3, topic: "Kerítés javítása" }),
      ]);
      assert.equal(saved.state, "success", JSON.stringify(saved));
      assert.equal((await todoRow(db, id)).needs_attention, false);
      assert.deepEqual(
        (await historyOf(db, id)).map((h) => h.change),
        ["claimed", "claimant_removed", "edited"],
      );
    });

    it("not reachable: a signed-in role cannot call either function", async () => {
      for (const fn of ["todo_removal_apply", "todo_removal_preview"]) {
        await assert
          .rejects(
            db.query(`set role authenticated; select ${schema}.${fn}('parent', $1)`, [
              PARENT_ROW_F1,
            ]),
          )
          .finally(() => db.query("reset role"));
      }
    });
  });
}
