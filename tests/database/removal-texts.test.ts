import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  DIRECTORY_SCHEMAS,
  openDirectoryDatabase,
  PARENT_ROW_F1,
  REQUEST_1,
} from "./directory-support.ts";
import {
  BOOK_OWNED,
  CHECK_TASK_DONE,
  CHECK_TASK_OPEN,
  OCC_SKIPPED_OTHER,
  OCC_SKIPPED_OWN,
  OCC_SWITCHED_OFF,
  removeFamily,
  removeParent,
  REQUEST_DECIDED,
  REQUEST_OTHER,
  seedRemovalWorld,
  succeeded,
  TODO_CLAIMED,
} from "./removal-support.ts";

/**
 * The texts a removed person wrote are emptied; a text someone else wrote and the texts of shared work stay (U14;
 * BR204.2, NFR1.3; owner answers NFR Q1). One test per kind of text, for a parent removal and for a family removal.
 * These are parts of the removal commands, whose refusals are in removal-commands.test.ts.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`removal: the removed person's texts in ${schema}`, () => {
    let db: pg.Client;

    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedRemovalWorld(db, schema);
    });

    const texts = async (sql: string, values: unknown[] = []) =>
      (await db.query(sql, values)).rows.map((row) => row.t as string | null);

    for (const [name, remove] of [
      ["parent", () => removeParent(db, schema)],
      ["family", () => removeFamily(db, schema)],
    ] as const) {
      describe(`${name} removal`, () => {
        beforeEach(async () => {
          succeeded(await remove());
        });

        it("empties the removed person's event sign-up note and keeps another family's", async () => {
          assert.deepEqual(
            await texts("select note as t from event_signups order by note nulls first"),
            [null, "más megjegyzés a jelentkezéshez"],
          );
        });

        it("replaces the removed person's food offer with a dash and keeps another family's", async () => {
          assert.deepEqual(
            await texts('select text as t from food_offers order by text collate "C"'),
            ["más szörp", "—"],
          );
        });

        it("empties the note on the removed person's checklist claim and keeps another family's", async () => {
          assert.deepEqual(
            await texts(
              "select note as t from checklist_claims where task_id = any ($1::uuid[]) order by note nulls first",
              [[CHECK_TASK_OPEN, CHECK_TASK_DONE]],
            ),
            [null, "más jegyzet"],
          );
        });

        it("replaces the skip reason the removed person gave, and keeps another's and the fixed switch-off reason", async () => {
          const reasons = async (id: string) =>
            (
              await texts("select skipped_reason as t from recurring_occurrences where id = $1", [
                id,
              ])
            )[0];
          assert.equal(await reasons(OCC_SKIPPED_OWN), "—");
          assert.equal(await reasons(OCC_SKIPPED_OTHER), "más ok a kihagyásra");
          assert.equal(await reasons(OCC_SWITCHED_OFF), "kikapcsolva");
        });

        it("empties the reasons on the removed person's cancellation requests and keeps another family's", async () => {
          const reason = async (id: string) =>
            (await texts("select reason as t from change_requests where id = $1", [id]))[0];
          assert.equal(await reason(REQUEST_1), null);
          assert.equal(await reason(REQUEST_DECIDED), null);
          assert.equal(await reason(REQUEST_OTHER), "más indok");
        });

        it("keeps the texts of shared work", async () => {
          assert.deepEqual(
            await texts("select note as t from todo_tasks where id = $1", [TODO_CLAIMED]),
            ["közös leírás a feladatról"],
          );
          assert.deepEqual(
            await texts("select description as t from books where id = $1", [BOOK_OWNED]),
            ["közös könyvleírás"],
          );
        });

        it("leaves no text of the removed person anywhere", async () => {
          for (const table of [
            "event_signups",
            "food_offers",
            "checklist_claims",
            "recurring_occurrences",
            "change_requests",
          ]) {
            const left = await db.query(
              `select count(*)::int as n from ${table} t where to_jsonb(t)::text like '%saját%'`,
            );
            assert.equal(left.rows[0].n, 0, table);
          }
        });
      });
    }

    it("a co-parent's own texts stay when the other parent is removed", async () => {
      await db.query(
        "update event_signups set note = 'társszülő megjegyzése' where parent_id <> $1 and note like 'más%'",
        [PARENT_ROW_F1],
      );
      succeeded(await removeParent(db, schema));
      assert.ok(
        (await texts("select note as t from event_signups")).includes("társszülő megjegyzése"),
      );
    });
  });
}
