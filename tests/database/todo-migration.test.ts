import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { DIRECTORY_SCHEMAS, ORGANIZATION, openDirectoryDatabase } from "./directory-support.ts";
import { asServiceRole, callAs } from "./identity-support.ts";
import { failureOf } from "./stack-support.ts";
import {
  auditRows,
  FAMILY_2,
  GROUP_1,
  historyOf,
  seedTodoWorld,
  SUPER_ADMIN,
  PARENT_F1,
} from "./todo-support.ts";

/**
 * The one-off load of the migration script (C17, BR190.2): service role only, once per source key, field name only on a
 * bad row. The sheet below is invented; the repository holds no workbook, and the script that reads one is a later unit's.
 */
const SHEET: [string, Record<string, unknown>][] = [
  [
    "sor-1",
    { topic: "Kerítés javítása", owner_group_name: "Boróka", priority: 1, deadline: "2027-05-01" },
  ],
  [
    "sor-2",
    {
      topic: "Családi teendő",
      owner_family_id: FAMILY_2,
      description: "Leírás",
      materials: "Festék",
    },
  ],
  [
    "sor-3",
    {
      topic: "Régi, kész",
      owner_group_name: "Napraforgó",
      status: "done",
      done_date: "2026-11-02",
    },
  ],
  [
    "sor-4",
    { topic: "Halasztott", owner_group_name: "Boróka", status: "postponed", note: "Tavasszal" },
  ],
];

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`todo migration load in ${schema}`, () => {
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
    const load = (source: string, todo: unknown, actor = asServiceRole) =>
      callAs(db, schema, actor, "migration_load_todo($1, $2, $3::jsonb)", [
        source,
        ORGANIZATION,
        JSON.stringify(todo),
      ]);
    const count = async () =>
      (await db.query("select count(*)::int as n from todo_tasks")).rows[0].n as number;

    it("loads the invented sheet and creates nothing the second time", async () => {
      const first = [];
      for (const [source, row] of SHEET) {
        const answer = await load(source, row);
        assert.equal(answer.state, "success", `${source} ${JSON.stringify(answer)}`);
        first.push(answer.reference);
      }
      assert.equal(await count(), 4);
      for (const [index, [source, row]] of SHEET.entries()) {
        const again = await load(source, row);
        assert.deepEqual(
          [again.state, again.code, again.reference],
          ["success", "replayed", first[index]],
        );
      }
      assert.equal(await count(), 4);
      assert.equal((await auditRows(db, "todo.migration_loaded")).length, 4);
    });

    it("stores owners, fields and status as sent: a group by name, a family by key, a done row with the sheet's date and nobody on the mark", async () => {
      const ids: Record<string, string> = {};
      for (const [source, row] of SHEET) {
        ids[source] = (await load(source, row)).reference!;
      }
      const row = async (id: string) =>
        (
          await db.query(
            `select owner_group_id, owner_family_id, status, priority, deadline::text as deadline, claimant_parent_id, done_by_parent_id,
                    to_char(done_at at time zone 'Europe/Budapest', 'YYYY-MM-DD') as done_day, description, materials, note
               from todo_tasks where id = $1`,
            [id],
          )
        ).rows[0];
      const group = await row(ids["sor-1"]!);
      assert.deepEqual(
        [group.owner_group_id, group.owner_family_id, group.status, group.priority, group.deadline],
        [GROUP_1, null, "open", 1, "2027-05-01"],
      );
      const family = await row(ids["sor-2"]!);
      assert.deepEqual(
        [family.owner_group_id, family.owner_family_id, family.description, family.materials],
        [null, FAMILY_2, "Leírás", "Festék"],
      );
      const done = await row(ids["sor-3"]!);
      assert.deepEqual(
        [done.status, done.done_day, done.claimant_parent_id, done.done_by_parent_id],
        ["done", "2026-11-02", null, null],
      );
      assert.deepEqual(
        (await historyOf(db, ids["sor-1"]!)).map((h) => [
          h.change,
          h.actor_kind,
          h.changed_by_parent_id,
        ]),
        [["migrated", "system", null]],
      );
      assert.equal((await row(ids["sor-4"]!)).note, "Tavasszal");
    });

    it("a sheet row in progress is stored as open, because the load sets no claimant and in progress needs one", async () => {
      const answer = await load("sor-folyamatban", {
        topic: "Folyamatban lévő",
        owner_group_name: "Boróka",
        status: "in_progress",
      });
      assert.equal(answer.state, "success", JSON.stringify(answer));
      const row = (
        await db.query("select status, claimant_parent_id from todo_tasks where id = $1", [
          answer.reference,
        ])
      ).rows[0];
      assert.deepEqual([row.status, row.claimant_parent_id], ["open", null]);
      assert.deepEqual(
        (await historyOf(db, answer.reference!)).map((h) => [h.change, h.to_status]),
        [["migrated", "open"]],
      );
    });

    it("a done row without a date gets the load date and is absent from the default list but present in the full one", async () => {
      const id = (
        await load("sor-5", {
          topic: "Kész dátum nélkül",
          owner_group_name: "Boróka",
          status: "done",
        })
      ).reference!;
      const doneAt = (
        await db.query("select done_at is not null as d from todo_tasks where id = $1", [id])
      ).rows[0].d;
      assert.equal(doneAt, true);
      const list = async (hidden: boolean) =>
        (
          await callAs(
            db,
            schema,
            { role: "authenticated", account: PARENT_F1 },
            "todo_list($1, null, null, null, false)",
            [hidden],
          )
        ).items as unknown[];
      assert.equal((await list(false)).length, 0);
      assert.equal((await list(true)).length, 1);
    });

    it("a bad row is refused naming the field only, creates nothing, and the next rows load", async () => {
      const bad: [string, Record<string, unknown>, string, string | undefined][] = [
        ["bad-1", { owner_group_name: "Boróka" }, "topic", undefined],
        ["bad-2", { topic: "T" }, "owner", "one_required"],
        ["bad-3", { topic: "T", owner_group_name: "Nincs ilyen csoport" }, "owner", "not_found"],
        [
          "bad-4",
          { topic: "T", owner_group_name: "Boróka", owner_family_id: FAMILY_2 },
          "owner",
          "one_only",
        ],
        [
          "bad-5",
          { topic: "T", owner_group_name: "Boróka", status: "kitalált" },
          "status",
          undefined,
        ],
        ["bad-6", { topic: "T", owner_group_name: "Boróka", priority: 7 }, "priority", undefined],
        [
          "bad-7",
          {
            topic: "T",
            owner_group_name: "Boróka",
            not_before: "2027-02-02",
            deadline: "2027-02-01",
          },
          "not_before",
          "not_before_after_deadline",
        ],
        [
          "bad-8",
          { topic: "T", owner_group_name: "Boróka", status: "postponed" },
          "note",
          "required",
        ],
        [
          "bad-9",
          { topic: "T", owner_group_name: "Boróka", deadline: "nem dátum" },
          "deadline",
          undefined,
        ],
        [
          "bad-10",
          { topic: "T", owner_family_id: "99999999-0000-4000-8000-000000000999" },
          "owner",
          "not_found",
        ],
      ];
      for (const [source, row, field, reason] of bad) {
        const answer = await load(source, row);
        assert.equal(answer.state, "validation", source);
        assert.equal(answer.field, field, source);
        if (reason) {
          assert.equal(answer.reason, reason, source);
        }
        assert.equal(
          JSON.stringify(answer).includes("Nincs ilyen csoport"),
          false,
          "no cell value in the answer",
        );
      }
      assert.equal(await count(), 0);
      assert.equal((await load("sor-1", SHEET[0]![1])).state, "success");
      assert.equal(await count(), 1);
      for (const [source] of bad) {
        assert.equal(
          (
            await db.query("select count(*)::int as n from todo_tasks where source_key = $1", [
              source,
            ])
          ).rows[0].n,
          0,
        );
      }
    });

    it("refused: only the service role may call it; a signed-in account and an anonymous caller are refused and nothing is created", async () => {
      for (const account of [SUPER_ADMIN, PARENT_F1]) {
        const failure = await failureOf(() =>
          callAs(
            db,
            schema,
            { role: "authenticated", account },
            "migration_load_todo($1, $2, $3::jsonb)",
            ["sor-9", ORGANIZATION, JSON.stringify(SHEET[0]![1])],
          ),
        );
        assert.ok(failure === undefined || failure.code === "42501", account);
      }
      const anon = await failureOf(() =>
        callAs(db, schema, { role: "anon" }, "migration_load_todo($1, $2, $3::jsonb)", [
          "sor-9",
          ORGANIZATION,
          JSON.stringify(SHEET[0]![1]),
        ]),
      );
      assert.equal(anon?.code, "42501");
      assert.equal(await count(), 0);
      const request = await load("", SHEET[0]![1]);
      assert.deepEqual([request.state, request.code], ["validation", "request_invalid"]);
      assert.equal((await load("sor-10", null)).state, "validation");
    });
  });
}
