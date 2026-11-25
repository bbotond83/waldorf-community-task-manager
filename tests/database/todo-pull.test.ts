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
  COMMUNITY_EVENT,
  GROUP_1,
  GROUP_EVENT,
  historyOf,
  insertTodo,
  json,
  nextKey,
  outcome,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_F1,
  seedTodoWorld,
  SUPER_ADMIN,
  TEACHER_G1,
  todoRow,
  uuid,
} from "./todo-support.ts";
import { openDatabase } from "./stack-support.ts";

/**
 * Pulling to-do tasks into an event's checklist (W3; BR185.1, BR185.2; C15) on the fixed list. The event is a group event:
 * its coordinator manages it, the coordinator of another group does not.
 */
const EVENT_NOT_THERE = uuid(9999);
const CANCELLED = uuid(9504);
const PAST = uuid(9503);

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`todo pull in ${schema}`, () => {
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
    const pull = (
      account: string,
      event: string,
      ids: string[],
      versions: number[],
      key = nextKey("pl"),
      via: ReturnType<typeof caller> = call,
    ) =>
      via(account, "todo_pull_to_event($1, $2, $3::uuid[], $4::integer[])", [
        key,
        event,
        ids,
        versions,
      ]);
    const checklistTasks = async (event: string) =>
      (
        await db.query(
          `select t.id, t.title, t.priority, t.materials, t.source_ref, s.title as section, s.kind
             from event_checklist_tasks t join event_checklist_sections s on s.id = t.section_id
            where t.event_id = $1 order by t.title`,
          [event],
        )
      ).rows as {
        id: string;
        title: string;
        priority: number | null;
        materials: string | null;
        source_ref: string;
        section: string;
        kind: string;
      }[];
    const links = async () =>
      (await db.query("select task_id, event_id, checklist_task_id from todo_event_links")).rows;

    it("allowed: the event's coordinator pulls open tasks into the parents' section \"Teendők\"; the originals stay unchanged; one history row and one audit row", async () => {
      const a = await insertTodo(db, { topic: "Pad festése", priority: 1 });
      const b = await insertTodo(db, { topic: "Fák metszése" });
      const answer = await pull(ADMIN_G1, GROUP_EVENT, [a, b], [1, 1]);
      assert.equal(answer.state, "success", JSON.stringify(answer));
      assert.deepEqual([answer.added, answer.already_on_list, answer.claimants_carried], [2, 0, 0]);
      const tasks = await checklistTasks(GROUP_EVENT);
      assert.deepEqual(
        tasks.map((t) => [t.title, t.section, t.kind, t.priority]),
        [
          ["Fák metszése", "Teendők", "parents", null],
          ["Pad festése", "Teendők", "parents", 1],
        ],
      );
      assert.deepEqual(tasks.map((t) => t.source_ref).sort(), [a, b].sort());
      for (const id of [a, b]) {
        const row = await todoRow(db, id);
        assert.deepEqual([row.status, row.version, row.claimant_parent_id], ["open", 1, null]);
        assert.deepEqual(
          (await historyOf(db, id)).map((h) => [h.change, h.event_id]),
          [["pulled_to_event", GROUP_EVENT]],
        );
      }
      assert.equal((await links()).length, 2);
      const audit = await auditRows(db, "todo.pulled_to_event");
      assert.equal(audit.length, 1);
      assert.match(audit[0]!.details ?? "", /^[a-z0-9_.:-]*$/);
    });

    it("allowed: a claimed task's claimant comes along as the first helper; a long materials text is cut for the checklist only", async () => {
      const id = await insertTodo(db, { claimant: PARENT_ROW_F1 });
      await db.query("update todo_tasks set materials = $2 where id = $1", [id, "m".repeat(450)]);
      const version = (await todoRow(db, id)).version;
      const answer = await pull(SUPER_ADMIN, COMMUNITY_EVENT, [id], [version]);
      assert.equal(answer.state, "success", JSON.stringify(answer));
      assert.equal(answer.claimants_carried, 1);
      const [task] = await checklistTasks(COMMUNITY_EVENT);
      assert.equal(task!.materials!.length, 300);
      const helpers = await db.query("select parent_id from checklist_claims where task_id = $1", [
        task!.id,
      ]);
      assert.deepEqual(
        helpers.rows.map((r) => r.parent_id),
        [PARENT_ROW_F1],
      );
      const row = await todoRow(db, id);
      const kept = (
        await db.query("select char_length(materials)::int as n from todo_tasks where id = $1", [
          id,
        ])
      ).rows[0].n;
      assert.deepEqual([row.version, row.claimant_parent_id, kept], [version, PARENT_ROW_F1, 450]);
    });

    it("out of reach: another group's coordinator, a parent and a teacher are refused and write nothing", async () => {
      const id = await insertTodo(db);
      for (const account of [ADMIN_G2, PARENT_F1, TEACHER_G1]) {
        const answer = await pull(account, GROUP_EVENT, [id], [1]);
        assert.equal(answer.state, "denied", account);
      }
      assert.equal((await checklistTasks(GROUP_EVENT)).length, 0);
      assert.equal((await links()).length, 0);
    });

    it("refused: a closed event, a done task, more than 50, none, a repeated id and an unknown task", async () => {
      const id = await insertTodo(db);
      for (const event of [CANCELLED, PAST]) {
        assert.deepEqual(outcome(await pull(SUPER_ADMIN, event, [id], [1])), [
          "conflict",
          "EVENT_CLOSED",
        ]);
      }
      const done = await insertTodo(db, { status: "done" });
      assert.deepEqual(outcome(await pull(ADMIN_G1, GROUP_EVENT, [done], [1])), [
        "conflict",
        "TODO_DONE",
      ]);
      const many = Array.from({ length: 51 }, (_, i) => uuid(9100 + i));
      assert.deepEqual(
        outcome(
          await pull(
            ADMIN_G1,
            GROUP_EVENT,
            many,
            many.map(() => 1),
          ),
        ),
        ["validation", "too_many_tasks"],
      );
      assert.deepEqual(outcome(await pull(ADMIN_G1, GROUP_EVENT, [], [])), [
        "validation",
        "request_invalid",
      ]);
      assert.deepEqual(outcome(await pull(ADMIN_G1, GROUP_EVENT, [id, id], [1, 1])), [
        "validation",
        "request_invalid",
      ]);
      assert.deepEqual(outcome(await pull(ADMIN_G1, GROUP_EVENT, [id], [1, 2])), [
        "validation",
        "request_invalid",
      ]);
      const unknown = await pull(ADMIN_G1, GROUP_EVENT, [uuid(9300)], [1]);
      assert.deepEqual(
        [unknown.state, unknown.field, unknown.reason],
        ["validation", "todo_ids", "not_found"],
      );
      const noEvent = await pull(SUPER_ADMIN, EVENT_NOT_THERE, [id], [1]);
      assert.notEqual(noEvent.state, "success");
      assert.equal((await links()).length, 0);
    });

    it("outdated screen: a changed task fails the whole pull and leaves no checklist task, link or history", async () => {
      const fresh = await insertTodo(db, { id: uuid(9801), topic: "Friss" });
      const changed = await insertTodo(db, { id: uuid(9802), topic: "Megváltozott" });
      await claim(call, PARENT_F2, changed, 1);
      const answer = await pull(ADMIN_G1, GROUP_EVENT, [fresh, changed], [1, 1]);
      assert.deepEqual(outcome(answer), ["conflict", "VERSION_CONFLICT"]);
      assert.equal((await checklistTasks(GROUP_EVENT)).length, 0);
      assert.equal((await links()).length, 0);
      assert.equal((await historyOf(db, fresh)).length, 0);
      assert.equal((await auditRows(db, "todo.pulled_to_event")).length, 0);
    });

    it("all or nothing: a done task later in the list rolls back the tasks pulled before it", async () => {
      const first = await insertTodo(db, { id: uuid(9801), topic: "Első" });
      const second = await insertTodo(db, { id: uuid(9802), topic: "Kész", status: "done" });
      const answer = await pull(ADMIN_G1, GROUP_EVENT, [first, second], [1, 1]);
      assert.deepEqual(outcome(answer), ["conflict", "TODO_DONE"]);
      assert.equal((await checklistTasks(GROUP_EVENT)).length, 0);
      assert.equal((await links()).length, 0);
    });

    it("repeated click: the same key pulls once; the same task again adds nothing and skips the version check", async () => {
      const id = await insertTodo(db);
      const key = nextKey("same");
      const first = await pull(ADMIN_G1, GROUP_EVENT, [id], [1], key);
      const replay = await pull(ADMIN_G1, GROUP_EVENT, [id], [1], key);
      assert.deepEqual([replay.state, replay.code], ["success", "replayed"]);
      assert.equal(first.state, "success");
      await claim(call, PARENT_F2, id, 1);
      const again = await pull(ADMIN_G1, GROUP_EVENT, [id], [1]);
      assert.equal(again.state, "success", JSON.stringify(again));
      assert.deepEqual([again.added, again.already_on_list], [0, 1]);
      assert.equal((await checklistTasks(GROUP_EVENT)).length, 1);
      assert.equal(
        (await historyOf(db, id)).filter((h) => h.change === "pulled_to_event").length,
        1,
      );
    });

    it("timings: with 600 tasks in the community, pulling 50 into an event finishes in under 2 seconds (NFR9.15)", async () => {
      await db.query(
        `insert into todo_tasks (organization_id, owner_group_id, topic, priority, deadline)
         select g.organization_id, g.id, 'Mérés ' || n, (n % 3) + 1, current_date + (n % 40)
           from generate_series(1, 600) n cross join (select * from groups where id = $1) g`,
        [GROUP_1],
      );
      const ids = (
        await db.query("select id from todo_tasks order by topic, id limit 50")
      ).rows.map((row) => row.id as string);
      assert.equal(ids.length, 50);
      const start = performance.now();
      const answer = await pull(
        ADMIN_G1,
        GROUP_EVENT,
        ids,
        ids.map(() => 1),
      );
      const ms = performance.now() - start;
      assert.equal(answer.state, "success", JSON.stringify(answer));
      assert.equal(answer.added, 50);
      assert.ok(ms < 2000, `the pull of 50 took ${ms} ms`);
    });

    it("a link whose checklist task is gone is ignored: the task is pulled again and the old link is replaced", async () => {
      const id = await insertTodo(db);
      assert.equal((await pull(ADMIN_G1, GROUP_EVENT, [id], [1])).state, "success");
      await db.query("delete from event_checklist_tasks where event_id = $1", [GROUP_EVENT]);
      const again = await pull(ADMIN_G1, GROUP_EVENT, [id], [1]);
      assert.deepEqual([again.state, again.added], ["success", 1]);
      assert.equal((await links()).length, 1);
      assert.equal((await checklistTasks(GROUP_EVENT)).length, 1);
    });

    it("two pulls at once: the event lock lets one add and the other find it already on the list", async () => {
      for (let round = 0; round < 5; round += 1) {
        await db.query("truncate todo_event_links, todo_task_history, todo_tasks cascade");
        await db.query("delete from event_checklists");
        const id = await insertTodo(db);
        const answers = await Promise.all([
          pull(ADMIN_G1, GROUP_EVENT, [id], [1], nextKey("x"), call),
          pull(
            SUPER_ADMIN,
            GROUP_EVENT,
            [id],
            [1],
            nextKey("y"),
            caller(() => other, schema),
          ),
        ]);
        assert.deepEqual(
          answers.map((a) => a.state),
          ["success", "success"],
          `round ${round}`,
        );
        assert.equal(
          answers.reduce((sum, a) => sum + (a.added as number), 0),
          1,
          `round ${round}`,
        );
        assert.equal((await links()).length, 1);
        assert.equal((await checklistTasks(GROUP_EVENT)).length, 1);
      }
    });

    it("a pull against a claim at once: either the pull wins (and the claim follows) or the claim wins (and the pull reads a version conflict); never a half result", async () => {
      for (let round = 0; round < 8; round += 1) {
        await db.query("truncate todo_event_links, todo_task_history, todo_tasks cascade");
        await db.query("delete from event_checklists");
        const id = await insertTodo(db);
        const [pulled, claimed] = await Promise.all([
          pull(ADMIN_G1, GROUP_EVENT, [id], [1], nextKey("p"), call),
          claim(
            caller(() => other, schema),
            PARENT_F1,
            id,
            1,
          ),
        ]);
        assert.ok(["success", "conflict"].includes(pulled.state), `round ${round}`);
        assert.equal(claimed.state, "success", `round ${round}`);
        assert.equal((await links()).length, pulled.state === "success" ? 1 : 0);
        assert.equal(
          (await checklistTasks(GROUP_EVENT)).length,
          pulled.state === "success" ? 1 : 0,
        );
        if (pulled.state === "conflict") {
          assert.equal(pulled.code, "VERSION_CONFLICT");
        }
      }
    });

    it("free of deadlocks with U11's checklist commands: pulls racing claims and done marks on the same event never fail on a lock", async () => {
      const seed = await insertTodo(db, { id: uuid(9801), topic: "Első" });
      assert.equal((await pull(ADMIN_G1, GROUP_EVENT, [seed], [1])).state, "success");
      const checklistTask = (await checklistTasks(GROUP_EVENT))[0]!.id;
      const second = caller(() => other, schema);
      for (let round = 0; round < 8; round += 1) {
        const extra = await insertTodo(db, { topic: `Újabb ${round}` });
        const answers = await Promise.all([
          pull(ADMIN_G1, GROUP_EVENT, [extra], [1], nextKey("pd"), call),
          second(PARENT_F2, "checklist_claim($1, $2, null, null)", [nextKey("cc"), checklistTask]),
          second(ADMIN_G1, "checklist_get($1)", [GROUP_EVENT]),
        ]);
        for (const answer of answers) {
          assert.notEqual(answer.state, undefined);
          assert.ok(!json(answer).includes("deadlock"), json(answer));
        }
        assert.equal(answers[0]!.state, "success", `round ${round}`);
        await db.query("delete from checklist_claims");
      }
    });
  });
}
