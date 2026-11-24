import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { DIRECTORY_SCHEMAS, openDirectoryDatabase } from "./directory-support.ts";
import {
  caller,
  claimDirect,
  COMMUNITY_EVENT,
  GROUP_EVENT,
  idsOf,
  rowsOf,
  seedEventWorld,
  seedSampleChecklist,
} from "./checklist-support.ts";
import { openDatabase } from "./stack-support.ts";
import { ADMIN_G1, PARENT_ROW_F1, PARENT_ROW_F2 } from "./working-groups-support.ts";

/** The functions U11 offers to U12 (checklist_add_task, BR170.5) and to U10's event notices (checklist_claimant_ids, BR170.6). */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`checklist functions for later units in ${schema}`, () => {
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
      await seedEventWorld(db, schema);
      await db.query("delete from checklist_templates");
    });

    const add = async (
      event: string,
      task: unknown,
      ref: string | null,
      claimant: unknown = null,
      client: pg.Client = db,
    ) =>
      (
        await client.query(
          `select ${schema}.checklist_add_task($1, $2::jsonb, $3, $4::jsonb) as id`,
          [event, JSON.stringify(task), ref, claimant === null ? null : JSON.stringify(claimant)],
        )
      ).rows[0].id as string;
    const T = { section_title: "Teendők", title: "Csomagolás" };
    const familyOf = async (parent: string) =>
      (await db.query("select family_id from parents where id = $1", [parent])).rows[0]
        .family_id as string;

    it("allowed: the first call makes the checklist head, the section and the task; the same source reference returns the same task", async () => {
      const first = await add(COMMUNITY_EVENT, { ...T, place: "Terem", priority: 2 }, "todo:1");
      assert.equal((await rowsOf(db, "event_checklist_tasks")).length, 1);
      assert.equal((await rowsOf(db, "event_checklists")).length, 1);
      assert.equal(await add(COMMUNITY_EVENT, { ...T, title: "Más" }, "todo:1"), first);
      assert.equal((await rowsOf(db, "event_checklist_tasks")).length, 1);
      const second = await add(COMMUNITY_EVENT, { ...T, title: "Második" }, "todo:2");
      assert.notEqual(second, first);
      assert.equal(
        (await rowsOf(db, "event_checklist_sections")).length,
        1,
        "same section title reuses the section",
      );
    });
    it("allowed: an active parent claimant or a typed name becomes the task's claim; an inactive parent leaves it unclaimed", async () => {
      await add(COMMUNITY_EVENT, T, "a", { parent_id: PARENT_ROW_F1 });
      await add(COMMUNITY_EVENT, { ...T, title: "B" }, "b", { typed_name: "Vendég Vince" });
      await db.query("update parents set status = 'archived' where id = $1", [PARENT_ROW_F2]);
      await add(COMMUNITY_EVENT, { ...T, title: "C" }, "c", { parent_id: PARENT_ROW_F2 });
      const claims = await rowsOf(db, "checklist_claims");
      assert.equal(claims.length, 2);
      assert.equal(claims.find((c) => c.typed_name)!.parent_id, null);
    });
    it("allowed: it works on an event that already has a copied checklist, after the last section", async () => {
      await seedSampleChecklist(
        caller(() => db, schema),
        ADMIN_G1,
        GROUP_EVENT,
        true,
        db,
      );
      const before = (await idsOf(db, GROUP_EVENT)).sections.length;
      await add(GROUP_EVENT, T, "x");
      assert.equal((await idsOf(db, GROUP_EVENT)).sections.length, before + 1);
    });
    it("refused: a missing event, a finished or cancelled event, a missing title or an over-long field write nothing", async () => {
      await assert.rejects(add("00000000-0000-4000-8000-0000000000aa", T, "z"));
      await assert.rejects(add("00000000-0000-4000-8000-0000000000aa", T, "z"));
      await db.query("update events set status = 'cancelled' where id = $1", [COMMUNITY_EVENT]);
      await assert.rejects(add(COMMUNITY_EVENT, T, "q"));
      await db.query("update events set status = 'planned' where id = $1", [COMMUNITY_EVENT]);
      await assert.rejects(add(COMMUNITY_EVENT, { section_title: "S" }, "q"));
      await assert.rejects(add(COMMUNITY_EVENT, { ...T, place: "x".repeat(201) }, "q"));
      assert.equal((await rowsOf(db, "event_checklist_tasks")).length, 0);
    });
    it("not reachable: a signed-in role cannot call it", async () => {
      await assert
        .rejects(
          db.query(
            `set role authenticated; select ${schema}.checklist_add_task($1, $2::jsonb, null, null)`,
            [COMMUNITY_EVENT, JSON.stringify(T)],
          ),
        )
        .finally(() => db.query("reset role"));
    });
    it("two people at once: two calls with one source reference make one task", async () => {
      const [a, b] = await Promise.all([
        add(COMMUNITY_EVENT, T, "race"),
        add(COMMUNITY_EVENT, T, "race", null, other),
      ]);
      assert.equal(a, b);
      assert.equal((await rowsOf(db, "event_checklist_tasks")).length, 1);
    });

    describe("claimant ids", () => {
      const ids = async (event: string) =>
        (
          await db.query(`select unnest(${schema}.checklist_claimant_ids($1)) as id`, [event])
        ).rows.map((r) => r.id as string);
      it("lists each active claiming parent once, skips typed names and inactive parents, and is empty with no checklist", async () => {
        assert.deepEqual(await ids(COMMUNITY_EVENT), []);
        const a = await add(COMMUNITY_EVENT, T, "1");
        const b = await add(COMMUNITY_EVENT, { ...T, title: "B" }, "2");
        await claimDirect(db, a, PARENT_ROW_F1, await familyOf(PARENT_ROW_F1));
        await claimDirect(db, b, PARENT_ROW_F1, await familyOf(PARENT_ROW_F1));
        await claimDirect(db, b, null, null, "Vendég");
        await claimDirect(db, b, PARENT_ROW_F2, await familyOf(PARENT_ROW_F2));
        assert.deepEqual(
          (await ids(COMMUNITY_EVENT)).sort(),
          [PARENT_ROW_F1, PARENT_ROW_F2].sort(),
        );
        await db.query("update parents set status = 'archived' where id = $1", [PARENT_ROW_F2]);
        assert.deepEqual(await ids(COMMUNITY_EVENT), [PARENT_ROW_F1]);
        assert.deepEqual(await ids(GROUP_EVENT), []);
      });
    });
  });
}
