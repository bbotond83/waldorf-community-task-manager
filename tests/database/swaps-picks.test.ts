import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  callFunction,
  DIRECTORY_SCHEMAS,
  openDirectoryDatabase,
  PARENT_F1,
  SUPER_ADMIN,
} from "./directory-support.ts";
import { FAMILY_SIX } from "./rota-full-support.ts";
import { placeRow, refused, requestRow, seedSwapWorld, swapCalls } from "./swaps-support.ts";
import {
  futureWeek,
  pickCommand,
  pickInvariantProblems,
  publishedWeekend,
  slotOf,
  type WeekendWorld,
} from "./weekend-picks-support.ts";

/**
 * Duty changes follow the weekend picks (C11, BR76.1 to BR76.3, BR74.1): a pick moves with a reassignment, goes back to
 * the weekend family when the picking family's week is cancelled, stays alone once the Saturday has begun, and a week
 * emptied by a cancellation can be handed to a family again (place_add). After each case the pick-and-place rule is
 * checked with a query.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`duty changes and weekend picks in ${schema}`, () => {
    let db: pg.Client;
    let calls: ReturnType<typeof swapCalls>;
    let world: WeekendWorld;

    before(async () => {
      db = await openDirectoryDatabase(schema);
      calls = swapCalls(db, schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedSwapWorld(db, schema);
      world = await publishedWeekend(db, schema);
    });

    const dutyOf = async (weekRowId: string) =>
      (
        await db.query(
          "select t.id as duty_id, a.id as place_id, a.version from tasks t join assignments a on a.task_id = t.id and a.status <> 'removed' where t.origin_kind = 'rota_week' and t.origin_id = $1",
          [weekRowId],
        )
      ).rows[0] as { duty_id: string; place_id: string; version: number };
    const pickCount = async () =>
      Number((await db.query("select count(*) from weekend_picks")).rows[0].count);
    const pickSlot = async (slot = "sunday_opening") => {
      const before = await slotOf(db, world, slot);
      const done = await pickCommand(
        db,
        schema,
        PARENT_F1,
        world.indoor.id,
        slot,
        before.place_version,
      );
      assert.equal(done.state, "success", JSON.stringify(done));
    };

    it("moves the pick with the picking week when an administrator hands the week to another family", async () => {
      await pickSlot();
      const duty = await dutyOf(world.indoor.id);
      const done = await calls.reassign(SUPER_ADMIN, duty.duty_id, duty.version, FAMILY_SIX);
      assert.equal(done.state, "success", JSON.stringify(done));
      const slot = await slotOf(db, world, "sunday_opening");
      assert.equal(slot.family_id, FAMILY_SIX);
      assert.equal(slot.source, "weekend_pick");
      assert.equal(await pickCount(), 1);
      assert.deepEqual(await pickInvariantProblems(db), []);
    });

    it("returns the picked slot to the weekend family when the picking week is cancelled (never to nobody)", async () => {
      await pickSlot();
      const duty = await dutyOf(world.indoor.id);
      const made = await calls.cancel(PARENT_F1, duty.place_id);
      assert.equal(made.state, "success", JSON.stringify(made));
      const done = await calls.decide(SUPER_ADMIN, String(made.reference), true);
      assert.equal(done.state, "success", JSON.stringify(done));
      const slot = await slotOf(db, world, "sunday_opening");
      assert.equal(slot.family_id, world.weekend.family);
      assert.equal(slot.source, "rota_publish");
      assert.equal(await pickCount(), 0);
      assert.deepEqual(await pickInvariantProblems(db), []);
    });

    it("leaves a pick alone when a cancellation is rejected", async () => {
      await pickSlot();
      const duty = await dutyOf(world.indoor.id);
      const made = await calls.cancel(PARENT_F1, duty.place_id);
      assert.equal(
        (await calls.decide(SUPER_ADMIN, String(made.reference), false)).state,
        "success",
      );
      assert.equal((await slotOf(db, world, "sunday_opening")).source, "weekend_pick");
      assert.equal(await pickCount(), 1);
    });

    it("moves the unpicked slots with the weekend family when the shelter place is handed over (C11)", async () => {
      const shelter = await slotOf(db, world, "shelter_cleaning");
      await db.query("select rota_adjust_picks_after_change($1::jsonb)", [
        JSON.stringify([{ place_id: shelter.place_id, new_family_id: FAMILY_SIX }]),
      ]);
      assert.equal((await slotOf(db, world, "saturday_opening")).family_id, FAMILY_SIX);
      assert.deepEqual(await pickInvariantProblems(db), []);
    });

    it("refuses to leave a weekend place without a family (raised error, nothing changes)", async () => {
      const slot = await slotOf(db, world, "shelter_cleaning");
      await assert.rejects(
        db.query("select rota_adjust_picks_after_change($1::jsonb)", [
          JSON.stringify([{ place_id: slot.place_id, new_family_id: null }]),
        ]),
        /never left without a family/,
      );
      assert.equal((await placeRow(db, slot.place_id)).family_id, world.weekend.family);
    });

    it("hands a week emptied by a cancellation to a family again, through place_add (BR74.1)", async () => {
      const duty = await dutyOf(world.indoor.id);
      const made = await calls.cancel(PARENT_F1, duty.place_id);
      assert.equal(
        (await calls.decide(SUPER_ADMIN, String(made.reference), true)).state,
        "success",
      );
      assert.equal((await requestRow(db, String(made.reference))).status, "approved");
      const listed = (
        (await callFunction(db, schema, SUPER_ADMIN, "rota_week_duties()", [])).items as {
          week_id: string;
          duty_id: string;
          place_version: number;
        }[]
      ).find((item) => item.week_id === world.indoor.id);
      assert.ok(listed, "the emptied week is listed");
      assert.equal(listed.duty_id, duty.duty_id);
      const version = Number(
        (await db.query("select version from tasks where id = $1", [duty.duty_id])).rows[0].version,
      );
      assert.equal(listed.place_version, version);
      refused(
        await calls.reassign(SUPER_ADMIN, duty.duty_id, version + 5, FAMILY_SIX),
        "conflict",
        "VERSION_CONFLICT",
      );
      assert.equal(
        (await calls.reassign(ADMIN_G1, duty.duty_id, version, FAMILY_SIX)).state,
        "denied",
      );
      const done = await calls.reassign(SUPER_ADMIN, duty.duty_id, version, FAMILY_SIX);
      assert.equal(done.state, "success", JSON.stringify(done));
      const week = (
        await db.query("select family_id, empty_reason from rota_weeks where id = $1", [
          world.indoor.id,
        ])
      ).rows[0];
      assert.deepEqual(week, { family_id: FAMILY_SIX, empty_reason: null });
      assert.equal((await placeRow(db, String(done.reference))).family_id, FAMILY_SIX);
      assert.deepEqual(await pickInvariantProblems(db), []);
    });
  });

  describe(`duty changes after the Saturday in ${schema}`, () => {
    let db: pg.Client;
    let past: WeekendWorld;
    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedSwapWorld(db, schema);
      past = await publishedWeekend(db, schema, { week: await futureWeek(db, -14) });
    });
    const dutyOf = async (weekRowId: string) =>
      (
        await db.query(
          "select a.id as place_id from tasks t join assignments a on a.task_id = t.id and a.status <> 'removed' where t.origin_kind = 'rota_week' and t.origin_id = $1",
          [weekRowId],
        )
      ).rows[0] as { place_id: string };
    const pickCount = async () =>
      Number((await db.query("select count(*) from weekend_picks")).rows[0].count);

    it("leaves a pick alone once the Saturday of that weekend has begun", async () => {
      const slot = await slotOf(db, past, "sunday_opening");
      const indoor = await dutyOf(past.indoor.id);
      await db.query(
        "insert into weekend_picks (organization_id, rota_week_id, weekend_slot_id, source) select w.organization_id, w.id, s.id, 'family' from rota_weeks w, weekend_slots s where w.id = $1 and s.weekend_week_id = $2 and s.slot = 'sunday_opening'",
        [past.indoor.id, past.weekend.id],
      );
      await db.query(
        "update assignments set source = 'weekend_pick', family_id = $2 where id = $1",
        [slot.place_id, past.indoor.family],
      );
      await db.query("select rota_adjust_picks_after_change($1::jsonb)", [
        JSON.stringify([{ place_id: indoor.place_id, new_family_id: null }]),
      ]);
      const after = await slotOf(db, past, "sunday_opening");
      assert.deepEqual([after.family_id, after.source], [past.indoor.family, "weekend_pick"]);
      assert.equal(await pickCount(), 1);
    });

    it("leaves a week that has started out of the hand-over list", async () => {
      const items = (await callFunction(db, schema, SUPER_ADMIN, "rota_week_duties()", []))
        .items as { week_id: string }[];
      assert.equal(
        items.some((item) => item.week_id === past.indoor.id),
        false,
      );
    });
  });
}
