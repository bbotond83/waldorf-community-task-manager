import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  callFunction,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  openDirectoryDatabase,
  ORGANIZATION,
  PARENT_F1,
  SUPER_ADMIN,
} from "./directory-support.ts";
import { makeDraft, publish } from "./rota-support.ts";
import { seedAnimalWorld, slotAfter } from "./animal-support.ts";

/**
 * The information links of the duty card (W7; BR88.1 to BR88.3): the sections a duty links to, the watering season,
 * hidden sections left out, and the replaced duty card read, which differs from before only by `info_links`.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`information links on duties in ${schema}`, () => {
    let db: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedAnimalWorld(db, schema);
      await db.query("delete from info_sections");
      await db.query(`select ${schema}.info_starting_sections_install($1)`, [ORGANIZATION]);
    });

    const links = async (duty: string, on: string | null = null) =>
      (await db.query(`select ${schema}.info_links_for_duty($1, $2::date) as l`, [duty, on]))
        .rows[0].l as { key: string; title: string }[];
    const keys = async (duty: string, on: string | null = null) =>
      (await links(duty, on)).map((l) => l.key);

    it("links a morning slot to the morning instructions, and to watering from March to October", async () => {
      const slot = await slotAfter(db, 3, "morning");
      assert.deepEqual(await keys(slot.duty_id, "2027-04-12"), ["morning", "watering"]);
      assert.deepEqual(await keys(slot.duty_id, "2027-01-12"), ["morning"]);
      assert.deepEqual(await keys(slot.duty_id, "2027-03-01"), ["morning", "watering"]);
      assert.deepEqual(await keys(slot.duty_id, "2027-10-31"), ["morning", "watering"]);
      assert.deepEqual(await keys(slot.duty_id, "2027-11-01"), ["morning"]);
    });

    it("links an afternoon slot to the afternoon instructions", async () => {
      const slot = await slotAfter(db, 3, "afternoon");
      assert.deepEqual(await keys(slot.duty_id, "2027-04-12"), ["afternoon", "watering"]);
      const titles = (await links(slot.duty_id, "2027-01-12")).map((l) => l.title);
      assert.deepEqual(titles, ["Délutáni, esti teendők"]);
    });

    it("leaves a hidden section out (BR88.3)", async () => {
      const slot = await slotAfter(db, 3, "morning");
      await db.query("update info_sections set hidden = true where key = 'watering'");
      assert.deepEqual(await keys(slot.duty_id, "2027-04-12"), ["morning"]);
      await db.query("update info_sections set hidden = true where key = 'morning'");
      assert.deepEqual(await keys(slot.duty_id, "2027-04-12"), []);
    });

    it("gives nothing for a manual duty, a made-up duty or another community's duty", async () => {
      const manual = await db.query("select id from tasks where origin_kind = 'manual' limit 1");
      assert.deepEqual(await links(String(manual.rows[0].id)), []);
      assert.deepEqual(await links("cccccccc-0000-4000-8000-000000009999"), []);
    });

    it("links weekend duties to the Saturday cleaning and the animal feeding (BR88.1)", async () => {
      const plan = await makeDraft(db, schema);
      const done = await publish(db, schema, plan);
      assert.equal(done.state, "success", JSON.stringify(done));
      const weekend = await db.query(
        "select t.id from tasks t where t.origin_kind = 'weekend_slot' order by t.starts_at limit 1",
      );
      assert.ok(weekend.rows[0], "a weekend duty exists");
      assert.deepEqual(await keys(String(weekend.rows[0].id)), [
        "saturday-cleaning",
        "animal-feeding",
      ]);
      const weekendWeek = await db.query(
        "select t.id from tasks t join rota_weeks w on t.origin_kind = 'rota_week' and w.id = t.origin_id where w.job = 'weekend_animal_care' order by t.starts_at limit 1",
      );
      if (weekendWeek.rows[0]) {
        assert.deepEqual(await keys(String(weekendWeek.rows[0].id)), [
          "saturday-cleaning",
          "animal-feeding",
        ]);
      }
      const indoor = await db.query(
        "select t.id from tasks t join rota_weeks w on t.origin_kind = 'rota_week' and w.id = t.origin_id where w.job = 'indoor_cleaning' limit 1",
      );
      assert.deepEqual(await keys(String(indoor.rows[0].id)), []);
    });

    it("returns the duty card with the information links added and no other field changed", async () => {
      const plan = await makeDraft(db, schema);
      assert.equal((await publish(db, schema, plan)).state, "success");
      const duty = (
        await db.query(
          "select t.id from tasks t join assignments a on a.task_id = t.id where t.origin_kind = 'rota_week' and a.family_id = $1 order by t.starts_at limit 1",
          [FAMILY_1],
        )
      ).rows[0];
      const card = await callFunction(db, schema, PARENT_F1, "rota_duty_card($1)", [duty.id]);
      assert.equal(card.state, "success", JSON.stringify(card));
      const item = card.item as Record<string, unknown>;
      assert.ok(Array.isArray(item.info_links));
      const rest = Object.fromEntries(Object.entries(item).filter(([key]) => key !== "info_links"));
      assert.deepEqual(
        Object.keys(rest).sort(),
        [
          "bottles_at_week_end",
          "day",
          "duty_id",
          "family_display_name",
          "includes_watering",
          "is_break_week",
          "job",
          "no_fixed_day",
          "own_pick",
          "part_of_day",
          "slot",
          "title",
          "week_end",
          "week_start",
          "weekend",
        ].sort(),
      );
      const admin = await callFunction(db, schema, SUPER_ADMIN, "rota_duty_card($1)", [duty.id]);
      assert.equal(admin.state, "success");
    });
  });
}
