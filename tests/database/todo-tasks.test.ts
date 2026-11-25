import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { DIRECTORY_SCHEMAS, openDirectoryDatabase } from "./directory-support.ts";
import {
  ADMIN_G1,
  ADMIN_G2,
  caller,
  FAMILY_1,
  FAMILY_2,
  GROUP_1,
  GROUP_2,
  historyOf,
  insertTodo,
  newTask,
  nextKey,
  noticeRows,
  outcome,
  PARENT_F1,
  PARENT_ROW_F1,
  save,
  seedTodoWorld,
  SUPER_ADMIN,
  TEACHER_G1,
  todoRow,
  OUTSIDER,
} from "./todo-support.ts";
import { openDatabase } from "./stack-support.ts";

/**
 * todo_task_save (W1; BR180.2, BR181.1 to BR181.3, NFR1, NFR3, NFR5) on the fixed list: allowed, refused, out of reach,
 * outdated screen, repeated click and two people at once. The table constraints are tried as the schema owner.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`todo save in ${schema}`, () => {
    let db: pg.Client;
    let other: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
      other = await openDatabase();
    });
    after(async () => {
      await other.end();
      await db.end();
    });
    beforeEach(async () => {
      await seedTodoWorld(db, schema);
    });
    const call = caller(() => db, schema);

    it("allowed: a coordinator adds a task to their own group, which starts open at version 1 with one history row", async () => {
      const made = await save(call, ADMIN_G1, newTask({ priority: 2, deadline: "2027-03-01" }));
      assert.equal(made.state, "success", JSON.stringify(made));
      const row = await todoRow(db, made.reference!);
      assert.deepEqual([row.status, row.version, row.owner_group_id], ["open", 1, GROUP_1]);
      assert.deepEqual(
        (await historyOf(db, row.id)).map((h) => [h.change, h.to_status, h.actor_kind]),
        [["created", "open", "parent"]],
      );
    });

    it("allowed: a super admin adds a family-owned task and moves a task to another group; saving bumps the version and clears the flag", async () => {
      const family = await save(call, SUPER_ADMIN, {
        owner_family_id: FAMILY_2,
        topic: "Családi teendő",
      });
      assert.equal(family.state, "success", JSON.stringify(family));
      const id = await insertTodo(db, { group: GROUP_1, attention: true });
      const moved = await save(call, SUPER_ADMIN, {
        id,
        expected_version: 1,
        owner_group_id: GROUP_2,
        topic: "Kerítés javítása",
      });
      assert.equal(moved.state, "success", JSON.stringify(moved));
      const row = await todoRow(db, id);
      assert.deepEqual([row.owner_group_id, row.version, row.needs_attention], [GROUP_2, 2, false]);
    });

    it("refused: a coordinator of another group, a family-owned task by a coordinator, a parent, a teacher and an outsider", async () => {
      for (const account of [ADMIN_G2, PARENT_F1, TEACHER_G1, OUTSIDER]) {
        const answer = await save(call, account, newTask());
        assert.equal(answer.state, "denied", account);
      }
      const family = await save(call, ADMIN_G1, { owner_family_id: FAMILY_2, topic: "Nem szabad" });
      assert.equal(family.state, "denied");
      const id = await insertTodo(db, { group: GROUP_1 });
      const edit = await save(call, ADMIN_G2, { id, expected_version: 1, topic: "Más csoport" });
      assert.equal(edit.state, "denied");
      assert.equal((await todoRow(db, id)).topic, "Kerítés javítása");
    });

    it("hand-over allowed: a super admin gives a flagged family-owned task to another family; the flag clears, the version bumps and one edited row is kept", async () => {
      const id = await insertTodo(db, { family: FAMILY_1, group: null, attention: true });
      const handed = await save(call, SUPER_ADMIN, {
        id,
        expected_version: 1,
        owner_family_id: FAMILY_2,
        topic: "Kerítés javítása",
      });
      assert.equal(handed.state, "success", JSON.stringify(handed));
      const row = await todoRow(db, id);
      assert.deepEqual(
        [row.owner_family_id, row.owner_group_id, row.version, row.needs_attention],
        [FAMILY_2, null, 2, false],
      );
      assert.deepEqual(
        (await historyOf(db, id)).map((h) => h.change),
        ["edited"],
      );
    });

    it("hand-over refused: a coordinator, a parent of the family, a teacher and an outsider cannot hand a family's task over, and nothing changes", async () => {
      const id = await insertTodo(db, { family: FAMILY_1, group: null, attention: true });
      for (const account of [ADMIN_G1, PARENT_F1, TEACHER_G1, OUTSIDER]) {
        const answer = await save(call, account, {
          id,
          expected_version: 1,
          owner_family_id: FAMILY_2,
          topic: "Kerítés javítása",
        });
        assert.equal(answer.state, "denied", account);
      }
      const row = await todoRow(db, id);
      assert.deepEqual(
        [row.owner_family_id, row.version, row.needs_attention],
        [FAMILY_1, 1, true],
      );
    });

    it("hand-over out of reach: a made-up family and a removed family are refused by name, and the owner stays", async () => {
      const id = await insertTodo(db, { family: FAMILY_1, group: null, attention: true });
      const unknown = await save(call, SUPER_ADMIN, {
        id,
        expected_version: 1,
        owner_family_id: "99999999-0000-4000-8000-000000000999",
        topic: "Kerítés javítása",
      });
      assert.deepEqual(
        [unknown.state, unknown.field, unknown.reason],
        ["validation", "owner", "not_found"],
      );
      await db.query("update families set status = 'archived', archived_at = now() where id = $1", [
        FAMILY_2,
      ]);
      const removed = await save(call, SUPER_ADMIN, {
        id,
        expected_version: 1,
        owner_family_id: FAMILY_2,
        topic: "Kerítés javítása",
      });
      assert.deepEqual(
        [removed.state, removed.field, removed.reason],
        ["validation", "owner", "not_found"],
      );
      assert.equal((await todoRow(db, id)).owner_family_id, FAMILY_1);
    });

    it("hand-over outdated screen and repeated click: a stale version changes nothing, the same key hands over once", async () => {
      const id = await insertTodo(db, { family: FAMILY_1, group: null, attention: true });
      const key = nextKey("handover");
      const handed = await save(
        call,
        SUPER_ADMIN,
        { id, expected_version: 1, owner_family_id: FAMILY_2, topic: "Kerítés javítása" },
        key,
      );
      assert.equal(handed.state, "success", JSON.stringify(handed));
      const again = await save(
        call,
        SUPER_ADMIN,
        { id, expected_version: 1, owner_family_id: FAMILY_2, topic: "Kerítés javítása" },
        key,
      );
      assert.deepEqual([again.state, again.code], ["success", "replayed"]);
      assert.equal(again.version, 2, "a repeated key answers with the current version");
      const stale = await save(call, SUPER_ADMIN, {
        id,
        expected_version: 1,
        owner_family_id: FAMILY_1,
        topic: "Kerítés javítása",
      });
      assert.deepEqual(outcome(stale), ["conflict", "VERSION_CONFLICT"]);
      const row = await todoRow(db, id);
      assert.deepEqual([row.owner_family_id, row.version], [FAMILY_2, 2]);
      assert.equal((await historyOf(db, id)).length, 1);
    });

    it("hand-over of a claimed task allowed: a claim held by a parent of another family ends, the task is open again, the claimant is told once and the history shows it", async () => {
      const id = await insertTodo(db, { family: FAMILY_1, group: null, claimant: PARENT_ROW_F1 });
      const body = {
        id,
        expected_version: 1,
        owner_family_id: FAMILY_2,
        topic: "Kerítés javítása",
      };
      const key = nextKey("handover-claimed");
      const handed = await save(call, SUPER_ADMIN, body, key);
      assert.equal(handed.state, "success", JSON.stringify(handed));
      const row = await todoRow(db, id);
      assert.deepEqual(
        [row.owner_family_id, row.status, row.claimant_parent_id, row.claimed_at, row.version],
        [FAMILY_2, "open", null, null, 2],
      );
      // Both rows are written in one transaction, so their order is not defined; the pair is.
      assert.deepEqual((await historyOf(db, id)).map((h) => [h.change, h.to_status]).sort(), [
        ["claim_freed", "open"],
        ["edited", "open"],
      ]);
      assert.equal((await noticeRows(db, PARENT_ROW_F1, "todo_changed")).length, 1);
      // The repeated click changes and sends nothing more.
      const again = await save(call, SUPER_ADMIN, body, key);
      assert.deepEqual([again.state, again.code, again.version], ["success", "replayed", 2]);
      assert.equal((await historyOf(db, id)).length, 2);
      assert.equal((await noticeRows(db, PARENT_ROW_F1, "todo_changed")).length, 1);
    });

    it("hand-over of a claimed task: a postponed task stays postponed, a claim of the new family stays, a done task keeps its mark", async () => {
      const postponed = await insertTodo(db, {
        family: FAMILY_1,
        group: null,
        claimant: PARENT_ROW_F1,
        status: "postponed",
        note: "Később",
      });
      const moved = await save(call, SUPER_ADMIN, {
        id: postponed,
        expected_version: 1,
        owner_family_id: FAMILY_2,
        topic: "Kerítés javítása",
        status: "postponed",
        note: "Később",
      });
      assert.equal(moved.state, "success", JSON.stringify(moved));
      const releasedRow = await todoRow(db, postponed);
      assert.deepEqual([releasedRow.status, releasedRow.claimant_parent_id], ["postponed", null]);

      // A group task claimed by a parent of family 1 and given to family 1: the claim stays.
      const own = await insertTodo(db, { group: GROUP_1, claimant: PARENT_ROW_F1 });
      const kept = await save(call, SUPER_ADMIN, {
        id: own,
        expected_version: 1,
        owner_family_id: FAMILY_1,
        topic: "Kerítés javítása",
        status: "in_progress",
      });
      assert.equal(kept.state, "success", JSON.stringify(kept));
      const keptRow = await todoRow(db, own);
      assert.deepEqual(
        [keptRow.status, keptRow.claimant_parent_id, keptRow.owner_family_id],
        ["in_progress", PARENT_ROW_F1, FAMILY_1],
      );
      assert.deepEqual(
        (await historyOf(db, own)).map((h) => h.change),
        ["edited"],
      );

      // A done task keeps its claimant record and its done mark.
      const done = await insertTodo(db, {
        family: FAMILY_1,
        group: null,
        claimant: PARENT_ROW_F1,
        status: "done",
        doneBy: PARENT_ROW_F1,
      });
      const doneMoved = await save(call, SUPER_ADMIN, {
        id: done,
        expected_version: 1,
        owner_family_id: FAMILY_2,
        topic: "Kerítés javítása",
        status: "done",
      });
      assert.equal(doneMoved.state, "success", JSON.stringify(doneMoved));
      const doneRow = await todoRow(db, done);
      assert.deepEqual(
        [doneRow.status, doneRow.claimant_parent_id, doneRow.done_by_parent_id],
        ["done", PARENT_ROW_F1, PARENT_ROW_F1],
      );
    });

    it("hand-over of a claimed task refused or out of reach or outdated: a coordinator, a removed family and a stale version leave the claim alone", async () => {
      const id = await insertTodo(db, { family: FAMILY_1, group: null, claimant: PARENT_ROW_F1 });
      const body = {
        id,
        expected_version: 1,
        owner_family_id: FAMILY_2,
        topic: "Kerítés javítása",
      };
      assert.equal((await save(call, ADMIN_G1, body)).state, "denied");
      await db.query("update families set status = 'archived', archived_at = now() where id = $1", [
        FAMILY_2,
      ]);
      const removed = await save(call, SUPER_ADMIN, body);
      assert.deepEqual(
        [removed.state, removed.field, removed.reason],
        ["validation", "owner", "not_found"],
      );
      await db.query("update families set status = 'active', archived_at = null where id = $1", [
        FAMILY_2,
      ]);
      const stale = await save(call, SUPER_ADMIN, { ...body, expected_version: 7 });
      assert.deepEqual(outcome(stale), ["conflict", "VERSION_CONFLICT"]);
      const row = await todoRow(db, id);
      assert.deepEqual(
        [row.owner_family_id, row.claimant_parent_id, row.status, row.version],
        [FAMILY_1, PARENT_ROW_F1, "in_progress", 1],
      );
      assert.equal((await historyOf(db, id)).length, 0);
    });

    it("refused: a coordinator cannot move a task to another group, and a new task needs exactly one owner", async () => {
      const id = await insertTodo(db, { group: GROUP_1 });
      const move = await save(call, ADMIN_G1, {
        id,
        expected_version: 1,
        owner_group_id: GROUP_2,
        topic: "Kerítés javítása",
      });
      assert.equal(move.state, "denied");
      const none = await save(call, ADMIN_G1, { topic: "Gazdátlan" });
      assert.deepEqual(
        [none.state, none.field, none.reason],
        ["validation", "owner", "one_required"],
      );
      const both = await save(call, SUPER_ADMIN, {
        topic: "Kettős",
        owner_group_id: GROUP_1,
        owner_family_id: FAMILY_2,
      });
      assert.deepEqual([both.field, both.reason], ["owner", "one_only"]);
    });

    it("plain text: markup in the topic, description, materials and note is stored and read back unchanged (NFR1.10)", async () => {
      const markup = {
        topic: "<b>Pad</b> & <script>alert(1)</script>",
        description: "<img src=x onerror=alert(1)>",
        materials: "<a href='x'>léc</a>",
        note: "<i>jegyzet</i>",
      };
      const made = await save(call, ADMIN_G1, newTask(markup));
      assert.equal(made.state, "success", JSON.stringify(made));
      const row = (
        await db.query("select topic, description, materials, note from todo_tasks where id = $1", [
          made.reference,
        ])
      ).rows[0];
      assert.deepEqual(row, markup);
    });

    it("a right lost while signed in applies at the next request: a coordinator whose grant ended is refused (NFR3.30)", async () => {
      const first = await save(call, ADMIN_G1, newTask());
      assert.equal(first.state, "success", JSON.stringify(first));
      await db.query("update app_role_grants set revoked_at = now() where subject_id = $1", [
        ADMIN_G1,
      ]);
      const second = await save(call, ADMIN_G1, newTask({ topic: "Másik" }));
      assert.equal(second.state, "denied");
      assert.equal((await db.query("select count(*)::int as n from todo_tasks")).rows[0].n, 1);
    });

    it("refused: field limits name the field, a postponed task needs a note, a new task cannot start done or in progress", async () => {
      const cases: [Record<string, unknown>, string][] = [
        [{ topic: "" }, "topic"],
        [{ topic: "x".repeat(201) }, "topic"],
        [{ priority: 4 }, "priority"],
        [{ description: "d".repeat(2001) }, "description"],
        [{ materials: "m".repeat(501) }, "materials"],
        [{ note: "n".repeat(1001) }, "note"],
        [{ deadline: "nem dátum" }, "deadline"],
        [{ status: "kitalált" }, "status"],
      ];
      for (const [extra, field] of cases) {
        const answer = await save(call, ADMIN_G1, newTask(extra));
        assert.deepEqual(
          [answer.state, answer.field],
          ["validation", field],
          JSON.stringify(extra),
        );
      }
      const late = await save(
        call,
        ADMIN_G1,
        newTask({ not_before: "2027-05-02", deadline: "2027-05-01" }),
      );
      assert.deepEqual([late.field, late.reason], ["not_before", "not_before_after_deadline"]);
      const postponed = await save(call, ADMIN_G1, newTask({ status: "postponed" }));
      assert.deepEqual([postponed.field, postponed.reason], ["note", "required"]);
      for (const status of ["done", "in_progress"]) {
        const answer = await save(call, ADMIN_G1, newTask({ status }));
        assert.deepEqual(outcome(answer), ["validation", "status_not_allowed"], status);
      }
      const count = (await db.query("select count(*)::int as n from todo_tasks")).rows[0].n;
      assert.equal(count, 0, "no refused save left a row");
    });

    it("refused: saving never sets done, a done task keeps its status, and an unclaimed task cannot be in progress", async () => {
      const open = await insertTodo(db);
      const toDone = await save(call, ADMIN_G1, {
        id: open,
        expected_version: 1,
        topic: "Kerítés javítása",
        status: "done",
      });
      assert.deepEqual(outcome(toDone), ["validation", "status_not_allowed"]);
      const noClaimant = await save(call, ADMIN_G1, {
        id: open,
        expected_version: 1,
        topic: "Kerítés javítása",
        status: "in_progress",
      });
      assert.deepEqual(outcome(noClaimant), ["validation", "status_not_allowed"]);
      const done = await insertTodo(db, { status: "done" });
      const reopen = await save(call, ADMIN_G1, {
        id: done,
        expected_version: 1,
        topic: "Kerítés javítása",
        status: "open",
      });
      assert.deepEqual(outcome(reopen), ["validation", "status_not_allowed"]);
      const fix = await save(call, ADMIN_G1, {
        id: done,
        expected_version: 1,
        topic: "Kerítés javítása",
        note: "Javított megjegyzés",
        status: "done",
      });
      assert.equal(fix.state, "success", JSON.stringify(fix));
      assert.equal((await todoRow(db, done)).status, "done");
    });

    it("out of reach: an unknown id and a task of another community are refused without detail", async () => {
      const unknown = await save(call, ADMIN_G1, {
        id: "99999999-0000-4000-8000-000000000999",
        expected_version: 1,
        topic: "Nincs",
      });
      assert.equal(unknown.state, "denied");
      const foreign = await save(call, SUPER_ADMIN, {
        id: "99999999-0000-4000-8000-000000000998",
        expected_version: 1,
        topic: "Nincs",
      });
      assert.deepEqual(
        [foreign.state, foreign.field, foreign.reason],
        ["validation", "id", "not_found"],
      );
    });

    it("outdated screen: a stale version overwrites nothing", async () => {
      const id = await insertTodo(db);
      const first = await save(call, ADMIN_G1, { id, expected_version: 1, topic: "Első" });
      assert.equal(first.state, "success");
      const stale = await save(call, SUPER_ADMIN, { id, expected_version: 1, topic: "Második" });
      assert.deepEqual(outcome(stale), ["conflict", "VERSION_CONFLICT"]);
      assert.equal((await todoRow(db, id)).topic, "Első");
      const missing = await save(call, ADMIN_G1, { id, topic: "Nincs verzió" });
      assert.deepEqual([missing.state, missing.field], ["validation", "expected_version"]);
    });

    it("repeated click: the same key saves once, the same key with other content is a conflict", async () => {
      const key = nextKey("rep");
      const one = await save(call, ADMIN_G1, newTask(), key);
      const two = await save(call, ADMIN_G1, newTask(), key);
      assert.deepEqual(
        [two.state, two.code, two.reference],
        ["success", "replayed", one.reference],
      );
      const clash = await save(call, ADMIN_G1, newTask({ topic: "Más" }), key);
      assert.deepEqual(outcome(clash), ["conflict", "idempotency_key_reused"]);
      assert.equal((await db.query("select count(*)::int as n from todo_tasks")).rows[0].n, 1);
    });

    it("two people at once: two managers saving the same version, one succeeds and the other reads a version conflict", async () => {
      const id = await insertTodo(db);
      const second = caller(() => other, schema);
      const answers = await Promise.all([
        save(call, ADMIN_G1, { id, expected_version: 1, topic: "A" }),
        save(second, SUPER_ADMIN, { id, expected_version: 1, topic: "B" }),
      ]);
      assert.deepEqual(answers.map((a) => a.state).sort(), ["conflict", "success"]);
      assert.equal((await todoRow(db, id)).version, 2);
    });

    it("table rules as the schema owner: one owner, a done time exactly when done, not-before not after the deadline, a unique source key, no history change", async () => {
      const failing = async (sql: string, values: unknown[] = []) => {
        await db.query("savepoint s");
        try {
          await db.query(sql, values);
          assert.fail(`should have been refused: ${sql}`);
        } catch (error) {
          assert.ok(
            (error as { code?: string }).code?.startsWith("23"),
            String((error as Error).message),
          );
        } finally {
          await db.query("rollback to savepoint s");
        }
      };
      await db.query("begin");
      try {
        const id = await insertTodo(db);
        await failing("update todo_tasks set owner_family_id = $2 where id = $1", [id, FAMILY_2]);
        await failing("update todo_tasks set status = 'done' where id = $1", [id]);
        await failing("update todo_tasks set done_at = now() where id = $1", [id]);
        await failing(
          "update todo_tasks set not_before = '2027-02-02', deadline = '2027-02-01' where id = $1",
          [id],
        );
        await failing("update todo_tasks set claimant_parent_id = $2 where id = $1", [
          id,
          PARENT_F1,
        ]);
        await db.query("update todo_tasks set source_key = 'k1' where id = $1", [id]);
        const twin = await insertTodo(db);
        await failing("update todo_tasks set source_key = 'k1' where id = $1", [twin]);
        await db.query(
          "insert into todo_task_history (task_id, change, actor_kind, changed_by_parent_id) values ($1, 'edited', 'parent', $2)",
          [id, "99999999-0000-4000-8000-000000000777"],
        );
        await failing("update todo_task_history set change = 'created' where task_id = $1", [id]);
        await failing("delete from todo_task_history where task_id = $1", [id]);
      } finally {
        await db.query("rollback");
      }
    });
  });
}
