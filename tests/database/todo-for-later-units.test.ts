import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { DIRECTORY_SCHEMAS, openDirectoryDatabase, PARENT_ROW_OTHER } from "./directory-support.ts";
import {
  COMMUNITY_EVENT,
  GROUP_EVENT,
  insertTodo,
  PARENT_ROW_F1,
  seedTodoWorld,
  uuid,
} from "./todo-support.ts";

/**
 * What later units and the app call (NFR3.7, NFR6.4): the checklist read, the attention flag, the notice facts, the
 * reminder, the removal pair and the load. They are internal, so the checks call them as the schema owner and read the
 * rights of every application role from the catalogue; the signed-in commands and reads are granted to signed-in accounts
 * only.
 */
const INTERNAL = [
  "todo_task_set_attention",
  "checklist_task_done_state",
  "notice_facts_todo",
  "todo_deadline_reminder",
  "todo_removal_preview",
  "todo_removal_apply",
  "todo_can_manage",
  "todo_owner_label",
  "todo_history_add",
  "todo_notify_changed",
  "todo_card_json",
  "my_tasks_week_end",
  "my_tasks_group",
  "todo_history_guard",
];
const SIGNED_IN = [
  "todo_task_save",
  "todo_task_claim",
  "todo_task_give_back",
  "todo_task_free_claim",
  "todo_task_update",
  "todo_task_mark_done",
  "todo_task_undo_done",
  "todo_pull_to_event",
  "todo_list",
  "todo_get",
  "todo_list_for_group",
  "my_tasks_get",
];

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`todo functions for later units in ${schema}`, () => {
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
    const may = async (role: string, fn: string) =>
      (
        await db.query(
          "select bool_and(has_function_privilege($1, p.oid, 'execute')) as e from pg_proc p where p.pronamespace = $2::regnamespace and p.proname = $3",
          [role, schema, fn],
        )
      ).rows[0].e as boolean | null;

    it("refused for every application role: the internal functions have no execute right for anon, signed-in accounts or the service role", async () => {
      for (const fn of INTERNAL) {
        for (const role of ["anon", "authenticated", "service_role"]) {
          assert.equal(await may(role, fn), false, `${role} ${fn}`);
        }
      }
    });

    it("allowed: the commands and reads belong to signed-in accounts only, and the load to the service role only", async () => {
      for (const fn of SIGNED_IN) {
        assert.equal(await may("authenticated", fn), true, fn);
        assert.equal(await may("anon", fn), false, `anon ${fn}`);
      }
      assert.equal(await may("service_role", "migration_load_todo"), true);
      assert.equal(await may("authenticated", "migration_load_todo"), false);
      assert.equal(await may("anon", "migration_load_todo"), false);
    });

    it("a signed-in role really cannot call an internal function", async () => {
      await assert
        .rejects(db.query(`set role authenticated; select ${schema}.todo_deadline_reminder(now())`))
        .finally(() => db.query("reset role"));
      await assert
        .rejects(
          db.query(
            `set role authenticated; select ${schema}.todo_task_set_attention(array[$1::uuid], true)`,
            [uuid(1)],
          ),
        )
        .finally(() => db.query("reset role"));
    });

    it("checklist_task_done_state: reports for each id whether the task exists, is done and its event is closed; an unknown id and an empty list are fine", async () => {
      await db.query("delete from event_checklists");
      const task = async (event: string, title: string, done: boolean) => {
        const head = (
          await db.query(
            "insert into event_checklists (organization_id, event_id) select organization_id, id from events where id = $1 returning id",
            [event],
          )
        ).rows[0].id as string;
        const section = (
          await db.query(
            "insert into event_checklist_sections (organization_id, checklist_id, event_id, position, title, kind) select organization_id, $2, id, 1, 'Teendők', 'parents' from events where id = $1 returning id",
            [event, head],
          )
        ).rows[0].id as string;
        return (
          await db.query(
            "insert into event_checklist_tasks (organization_id, event_id, section_id, position, title, done_at) select organization_id, id, $2, 1, $3, case when $4 then now() end from events where id = $1 returning id",
            [event, section, title, done],
          )
        ).rows[0].id as string;
      };
      const open = await task(COMMUNITY_EVENT, "Nyitott", false);
      const done = await task(GROUP_EVENT, "Kész", true);
      await db.query(
        "update events set starts_at = now() - interval '2 days', ends_at = now() - interval '1 day' where id = $1",
        [GROUP_EVENT],
      );
      const rows = (
        await db.query(
          `select task_id, task_exists, is_done, event_closed from ${schema}.checklist_task_done_state($1::uuid[]) order by task_exists desc, is_done`,
          [[open, done, uuid(9999)]],
        )
      ).rows;
      const byId = new Map(rows.map((r) => [r.task_id as string, r]));
      assert.deepEqual(
        [byId.get(open), byId.get(done), byId.get(uuid(9999))].map((r) => [
          r.task_exists,
          r.is_done,
          r.event_closed,
        ]),
        [
          [true, false, false],
          [true, true, true],
          [false, false, false],
        ],
      );
      assert.equal(
        (await db.query(`select * from ${schema}.checklist_task_done_state(null)`)).rows.length,
        0,
      );
    });

    it("todo_task_set_attention: sets the flag for a list of tasks and returns how many changed; the same call again changes none", async () => {
      const a = await insertTodo(db);
      const b = await insertTodo(db, { attention: true });
      const call = async (flag: boolean) =>
        (
          await db.query(`select ${schema}.todo_task_set_attention($1::uuid[], $2) as n`, [
            [a, b],
            flag,
          ])
        ).rows[0].n as number;
      assert.equal(await call(true), 1);
      assert.equal(await call(true), 0);
      assert.equal(await call(false), 2);
      assert.equal(
        (await db.query(`select ${schema}.todo_task_set_attention(null, true) as n`)).rows[0].n,
        0,
      );
      const version = (await db.query("select version from todo_tasks where id = $1", [a])).rows[0]
        .version;
      assert.equal(version, 3, "each real change bumps the version");
    });

    it("notice_facts_todo: names the topic, the deadline and the page path only, for a parent of the same community", async () => {
      const id = await insertTodo(db, {
        topic: "Tavaszi nagytakarítás",
        deadline: "2027-04-01",
        claimant: PARENT_ROW_F1,
      });
      const rows = (
        await db.query(`select * from ${schema}.notice_facts_todo($1, $2, 'todo_changed')`, [
          id,
          PARENT_ROW_F1,
        ])
      ).rows;
      assert.equal(rows.length, 1);
      assert.deepEqual(
        [rows[0].item_name, rows[0].path, rows[0].full_title, rows[0].detail],
        ["Tavaszi nagytakarítás", `/szulo/teendok/${id}`, null, null],
      );
      const none = (
        await db.query(`select * from ${schema}.notice_facts_todo($1, $2, 'todo_due')`, [
          uuid(9999),
          PARENT_ROW_F1,
        ])
      ).rows;
      assert.equal(none.length, 0);
      const foreign = (
        await db.query(`select * from ${schema}.notice_facts_todo($1, $2, 'todo_due')`, [
          id,
          PARENT_ROW_OTHER,
        ])
      ).rows;
      assert.equal(foreign.length, 0, "another community's parent reads nothing");
    });

    it("the new notice kinds and audit actions exist", async () => {
      const kinds = (
        await db.query(
          "select kind, target_type from notice_kinds where kind in ('todo_changed', 'todo_due') order by kind",
        )
      ).rows;
      assert.deepEqual(kinds, [
        { kind: "todo_changed", target_type: "todo_task" },
        { kind: "todo_due", target_type: "todo_task" },
      ]);
      const def = (
        await db.query(
          "select pg_get_constraintdef(oid) as d from pg_constraint where conname = 'audit_events_action_check' and conrelid = $1::regclass",
          [`${schema}.audit_events`],
        )
      ).rows[0].d as string;
      for (const action of [
        "todo.claim_freed",
        "todo.done_undone",
        "todo.pulled_to_event",
        "todo.removal_applied",
        "todo.migration_loaded",
        "checklist.removal_applied",
      ]) {
        assert.ok(def.includes(action), action);
      }
    });
  });
}
