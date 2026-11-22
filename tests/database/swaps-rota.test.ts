import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  callFunction,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  FAMILY_2,
  openDirectoryDatabase,
  PARENT_F1,
  PARENT_F2,
  SUPER_ADMIN,
} from "./directory-support.ts";
import {
  PLACE_F1_T1,
  placeRow,
  refused,
  requestRow,
  seedSwapWorld,
  swapCalls,
} from "./swaps-support.ts";
import { PARENT_NG } from "./rota-full-support.ts";
import { publishedWeekend, slotOf, type WeekendWorld } from "./weekend-picks-support.ts";

/**
 * Swaps and cancellations on rota duties (BR71.4, BR72.3, BR73.1, BR76.3, BR77.1; C11): the rota and the weekend pick follow.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`rota duty changes in ${schema}`, () => {
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

    const rotaPlace = async (weekRowId: string) =>
      String(
        (
          await db.query(
            "select a.id from assignments a join tasks t on t.id = a.task_id where t.origin_kind = 'rota_week' and t.origin_id = $1 and a.status <> 'removed'",
            [weekRowId],
          )
        ).rows[0].id,
      );
    const rotaFamily = async (weekRowId: string) =>
      (await db.query("select family_id, empty_reason from rota_weeks where id = $1", [weekRowId]))
        .rows[0] as {
        family_id: string | null;
        empty_reason: string | null;
      };

    it("exchanges two rota duties and the rota follows the places", async () => {
      const indoor = await rotaPlace(world.indoor.id);
      const front = await rotaPlace(world.front.id);
      const made = await calls.request(PARENT_F1, indoor, front);
      assert.equal(made.state, "success", JSON.stringify(made));
      const done = await calls.respond(PARENT_F2, String(made.reference), true);
      assert.equal(done.state, "success", JSON.stringify(done));
      assert.equal((await rotaFamily(world.indoor.id)).family_id, FAMILY_2);
      assert.equal((await rotaFamily(world.front.id)).family_id, FAMILY_1);
      assert.equal((await placeRow(db, indoor)).family_id, FAMILY_2);
    });

    it("refuses a swap that would give one family two rota jobs in a week (C11)", async () => {
      const front = await rotaPlace(world.front.id);
      const result = await calls.request(PARENT_F1, PLACE_F1_T1, front);
      assert.equal(result.state, "conflict", JSON.stringify(result));
      assert.equal(result.code, "ROTA_SAME_WEEK_CLASH");
      assert.equal((await placeRow(db, PLACE_F1_T1)).status, "active");
    });

    it("refuses a swap of a weekend slot duty, which follows its week (SWAP_SLOT_FOLLOWS_WEEK)", async () => {
      const slot = await slotOf(db, world, "saturday_opening");
      const result = await calls.request(PARENT_NG, slot.place_id, PLACE_F1_T1);
      refused(result, "conflict", "SWAP_SLOT_FOLLOWS_WEEK");
    });

    it("approves a cancellation of a rota duty: the week is left empty as cancelled, by a super admin only", async () => {
      const indoor = await rotaPlace(world.indoor.id);
      const made = await calls.cancel(PARENT_F1, indoor);
      assert.equal(made.state, "success", JSON.stringify(made));
      const id = String(made.reference);
      assert.equal((await calls.decide(ADMIN_G1, id, true)).state, "denied");
      const done = await calls.decide(SUPER_ADMIN, id, true);
      assert.equal(done.state, "success", JSON.stringify(done));
      assert.deepEqual(await rotaFamily(world.indoor.id), {
        family_id: null,
        empty_reason: "cancelled",
      });
      assert.equal((await requestRow(db, id)).status, "approved");
    });

    it("rejects a cancellation of a rota duty and leaves the rota alone", async () => {
      const indoor = await rotaPlace(world.indoor.id);
      const id = String((await calls.cancel(PARENT_F1, indoor)).reference);
      assert.equal((await calls.decide(SUPER_ADMIN, id, false)).state, "success");
      assert.equal((await rotaFamily(world.indoor.id)).family_id, FAMILY_1);
    });

    it("lists the duty and place version behind each published week for a super admin only", async () => {
      const read = (account: string) => callFunction(db, schema, account, "rota_week_duties()", []);
      const items = (await read(SUPER_ADMIN)).items as {
        week_id: string;
        duty_id: string;
        place_version: number;
      }[];
      const indoor = items.find((item) => item.week_id === world.indoor.id);
      assert.ok(indoor, JSON.stringify(items));
      assert.equal(indoor.duty_id, (await placeRow(db, await rotaPlace(world.indoor.id))).task_id);
      assert.equal(
        indoor.place_version,
        (await placeRow(db, await rotaPlace(world.indoor.id))).version,
      );
      assert.equal((await read(ADMIN_G1)).state, "denied");
      assert.equal((await read(PARENT_F1)).state, "denied");
    });

    it("reassigns a rota duty and refuses a weekend slot duty", async () => {
      const indoor = await rotaPlace(world.indoor.id);
      const version = (await placeRow(db, indoor)).version;
      const taskId = String((await placeRow(db, indoor)).task_id);
      assert.equal((await calls.reassign(ADMIN_G1, taskId, version, FAMILY_2)).state, "denied");
      refused(
        await calls.reassign(SUPER_ADMIN, taskId, version, FAMILY_2),
        "conflict",
        "ROTA_SAME_WEEK_CLASH",
      );
      const slotTask = String(
        (await db.query("select id from tasks where origin_kind = 'weekend_slot' limit 1")).rows[0]
          .id,
      );
      refused(
        await calls.reassign(SUPER_ADMIN, slotTask, 1, FAMILY_2),
        "conflict",
        "SWAP_SLOT_FOLLOWS_WEEK",
      );
    });
  });
}
