import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { DIRECTORY_SCHEMAS, openDirectoryDatabase } from "./directory-support.ts";
import {
  auditRows,
  caller,
  claimDirect,
  GROUP_EVENT,
  idsOf,
  rowsOf,
  seedEventWorld,
  seedSampleChecklist,
} from "./checklist-support.ts";
import { ADMIN_G1, PARENT_ROW_F1, PARENT_ROW_F2 } from "./working-groups-support.ts";

/** Removing a parent or a family (C16, BR170.4): open claims free their place, the rest become "korábbi tag". */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`checklist removal in ${schema}`, () => {
    let db: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedEventWorld(db, schema);
      await db.query("delete from checklist_templates");
      await seedSampleChecklist(
        caller(() => db, schema),
        ADMIN_G1,
        GROUP_EVENT,
        true,
        db,
      );
    });

    const apply = async (kind: string, id: string) =>
      (await db.query(`select ${schema}.checklists_removal_apply($1, $2) as r`, [kind, id])).rows[0]
        .r as { to_clear: number; to_flag: number };
    const preview = async (kind: string, id: string) =>
      (await db.query(`select ${schema}.checklists_removal_preview($1, $2) as r`, [kind, id]))
        .rows[0].r as { to_clear: number; to_flag: number };
    const familyOf = async (parent: string) =>
      (await db.query("select family_id from parents where id = $1", [parent])).rows[0]
        .family_id as string;

    it("allowed: a parent's open claims are deleted, a claim on a done task keeps its row without the parent, and the done mark loses its parent", async () => {
      const all = await idsOf(db, GROUP_EVENT);
      const family = await familyOf(PARENT_ROW_F1);
      await claimDirect(db, all.task("Székek bevitele"), PARENT_ROW_F1, family);
      const doneClaim = await claimDirect(db, all.task("Süti sütése"), PARENT_ROW_F1, family);
      await db.query(
        "update event_checklist_tasks set done_at = now(), done_by_parent_id = $2 where id = $1",
        [all.task("Süti sütése"), PARENT_ROW_F1],
      );
      await claimDirect(
        db,
        all.task("Székek bevitele"),
        PARENT_ROW_F2,
        await familyOf(PARENT_ROW_F2),
      );
      assert.equal((await preview("parent", PARENT_ROW_F1)).to_clear, 3);
      assert.equal((await apply("parent", PARENT_ROW_F1)).to_clear, 3);
      const claims = await rowsOf(db, "checklist_claims");
      assert.equal(claims.length, 2);
      const kept = claims.find((c) => c.id === doneClaim)!;
      assert.deepEqual([kept.parent_id, kept.family_id], [null, null]);
      assert.equal(
        (await rowsOf(db, "event_checklist_tasks", "done_by_parent_id is not null")).length,
        0,
      );
      assert.equal(
        claims.filter((c) => c.parent_id === PARENT_ROW_F2).length,
        1,
        "another parent untouched",
      );
      assert.equal((await auditRows(db, "checklist.removal_applied")).length, 1);
    });
    it("allowed: removing a family clears the claims of all its parents; a finished event keeps its claims anonymised", async () => {
      const all = await idsOf(db, GROUP_EVENT);
      const family = await familyOf(PARENT_ROW_F1);
      await claimDirect(db, all.task("Székek bevitele"), PARENT_ROW_F1, family);
      await db.query(
        "update events set starts_at = now() - interval '2 hours', ends_at = now() - interval '1 hour' where id = $1",
        [GROUP_EVENT],
      );
      await apply("family", family);
      const claims = await rowsOf(db, "checklist_claims");
      assert.equal(claims.length, 1);
      assert.deepEqual([claims[0]!.parent_id, claims[0]!.family_id], [null, null]);
    });
    it("refused / nothing to do: an unknown subject, another kind and a parent with no claims change nothing", async () => {
      assert.deepEqual(await apply("parent", "00000000-0000-4000-8000-0000000000aa"), {
        to_clear: 0,
        to_flag: 0,
      });
      assert.deepEqual(await apply("group", PARENT_ROW_F1), { to_clear: 0, to_flag: 0 });
      assert.deepEqual(await preview("group", PARENT_ROW_F1), { to_clear: 0, to_flag: 0 });
      assert.deepEqual(await apply("parent", PARENT_ROW_F1), { to_clear: 0, to_flag: 0 });
    });
    it("repeated click: applying twice clears once", async () => {
      const all = await idsOf(db, GROUP_EVENT);
      await claimDirect(
        db,
        all.task("Székek bevitele"),
        PARENT_ROW_F1,
        await familyOf(PARENT_ROW_F1),
      );
      assert.equal((await apply("parent", PARENT_ROW_F1)).to_clear, 1);
      assert.equal((await apply("parent", PARENT_ROW_F1)).to_clear, 0);
    });
    it("not reachable: a signed-in role cannot call either function", async () => {
      for (const fn of ["checklists_removal_apply", "checklists_removal_preview"]) {
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
