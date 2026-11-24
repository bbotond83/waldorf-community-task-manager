import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ASSIGNMENT_F1_T1,
  callFunction,
  DIRECTORY_SCHEMAS,
  nextKey,
  openDirectoryDatabase,
  OUTSIDER,
  PARENT_F2,
  FAMILY_2,
  uuid,
  YEAR_1,
} from "./directory-support.ts";
import { setChangeover, setStanding } from "./rota-full-support.ts";
import {
  activePlace,
  ADMIN_G1,
  refused,
  seedAnimalWorld,
  setStart,
  signUp,
  slotAfter,
  SUPER_ADMIN,
  PARENT_F1,
  PARENT_SIX,
  FAMILY_1,
  TEACHER_G1,
} from "./animal-support.ts";

/**
 * Signing up for a slot and giving it up (W2, W3; BR81, BR82; Give-up 1 to 5): allowed, refused, out of reach,
 * outdated screen and repeated click. The two-people-at-once cases are in `animal-slot-races.test.ts`.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`animal sign-up and give-up in ${schema}`, () => {
    let db: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(() => seedAnimalWorld(db, schema));

    const giveUp = (account: string, place: string, version: number, key = nextKey("gu")) =>
      callFunction(db, schema, account, "slot_give_up($1, $2, $3)", [key, place, version]);
    const list = (account: string, from: string | null = null, weeks = 2) =>
      callFunction(db, schema, account, "animal_slots_list($1, $2, $3)", [YEAR_1, from, weeks]);

    it("lists the coming slots with the holder's family name only (allowed)", async () => {
      const slot = await slotAfter(db, 3);
      assert.equal((await signUp(db, schema, PARENT_F1, slot.duty_id)).state, "success");
      const result = await list(PARENT_F2, slot.slot_date, 1);
      assert.equal(result.state, "success");
      const rows = result.slots as Record<string, unknown>[];
      const row = rows.find((r) => r.duty_id === slot.duty_id)!;
      assert.equal(row.mine, false);
      assert.equal(row.can_give_up, false);
      assert.ok(row.family_name);
      assert.ok(!JSON.stringify(row).includes("@") && !/\+36/.test(JSON.stringify(row)));
      const own = (
        (await list(PARENT_F1, slot.slot_date, 1)).slots as Record<string, unknown>[]
      ).find((r) => r.duty_id === slot.duty_id)!;
      assert.equal(own.mine, true);
      assert.equal(own.can_give_up, true);
      const free = rows.find((r) => r.duty_id !== slot.duty_id && r.place_id === null)!;
      assert.equal(free.family_name, null);
      assert.equal((await list(OUTSIDER)).state, "denied");
    });

    it("lets a teacher read the slots with no action offered (the read-only teacher page)", async () => {
      const slot = await slotAfter(db, 3);
      await signUp(db, schema, PARENT_F1, slot.duty_id);
      const result = await list(TEACHER_G1, slot.slot_date, 1);
      assert.equal(result.state, "success", JSON.stringify(result));
      const rows = result.slots as Record<string, unknown>[];
      const row = rows.find((r) => r.duty_id === slot.duty_id)!;
      assert.equal(row.mine, false);
      assert.equal(row.can_give_up, false);
      assert.ok(row.family_name);
      assert.ok(!JSON.stringify(rows).includes("@") && !/\+36/.test(JSON.stringify(rows)));
    });

    it("signs a family up once, and a second family finds the slot taken", async () => {
      const slot = await slotAfter(db, 3);
      const first = await signUp(db, schema, PARENT_F1, slot.duty_id);
      assert.equal(first.state, "success", JSON.stringify(first));
      const stale = await callFunction(db, schema, PARENT_F2, "duty_sign_up($1, $2, $3)", [
        nextKey("su"),
        slot.duty_id,
        slot.version,
      ]);
      assert.equal(stale.state, "invalidated");
      refused(await signUp(db, schema, PARENT_F2, slot.duty_id), "conflict", "DUTY_FULL");
      assert.equal((await activePlace(db, slot.duty_id))?.family_id, FAMILY_1);
    });

    it("applies the changeover rule on the slot's date (refused)", async () => {
      const slot = await slotAfter(db, 3);
      await setChangeover(db, "2026-10-01");
      await setStanding(db, schema, FAMILY_2, "leaving");
      const result = await signUp(db, schema, PARENT_F2, slot.duty_id);
      assert.equal(result.code, "DUTY_INELIGIBLE", JSON.stringify(result));
      const row = (
        (await list(PARENT_F2, slot.slot_date, 1)).slots as Record<string, unknown>[]
      ).find((r) => r.duty_id === slot.duty_id)!;
      assert.equal(row.may_hold, false);
    });

    it("gives up a slot more than 24 hours ahead and frees it (Give-up 1)", async () => {
      const slot = await slotAfter(db, 3);
      await signUp(db, schema, PARENT_F1, slot.duty_id);
      const place = (await activePlace(db, slot.duty_id))!;
      const done = await giveUp(PARENT_F1, place.id, place.version);
      assert.equal(done.state, "success", JSON.stringify(done));
      assert.equal(await activePlace(db, slot.duty_id), undefined);
      assert.equal((await signUp(db, schema, PARENT_F2, slot.duty_id)).state, "success");
    });

    it("refuses within 24 hours, after the start, in a swap, and for another family's slot (Give-up 2 to 4)", async () => {
      const slot = await slotAfter(db, 3);
      await signUp(db, schema, PARENT_F1, slot.duty_id);
      const place = (await activePlace(db, slot.duty_id))!;

      const stranger = await giveUp(PARENT_F2, place.id, place.version);
      const missing = await giveUp(PARENT_F2, uuid(999999), 1);
      refused(stranger, "denied", "authorization_denied");
      assert.deepEqual(
        [stranger.state, stranger.code, stranger.reference],
        [missing.state, missing.code, missing.reference],
        "not yours and made-up answer alike",
      );
      assert.equal((await giveUp(OUTSIDER, place.id, place.version)).state, "denied");
      assert.equal((await giveUp(SUPER_ADMIN, place.id, place.version)).state, "denied");
      assert.equal((await giveUp(ADMIN_G1, place.id, place.version)).state, "denied");
      assert.equal((await giveUp(TEACHER_G1, place.id, place.version)).state, "denied");

      await db.query("update assignments set status = 'swap_pending' where id = $1", [place.id]);
      const swapped = (await activePlace(db, slot.duty_id))!;
      refused(await giveUp(PARENT_F1, place.id, swapped.version), "conflict", "REQUEST_CONFLICT");
      await db.query("update assignments set status = 'active' where id = $1", [place.id]);

      await setStart(db, slot.duty_id, "5 hours");
      const late = (await activePlace(db, slot.duty_id))!;
      refused(await giveUp(PARENT_F1, place.id, late.version), "conflict", "SLOT_GIVE_UP_TOO_LATE");
      await setStart(db, slot.duty_id, "-1 hour");
      const started = (await activePlace(db, slot.duty_id))!;
      refused(await giveUp(PARENT_F1, place.id, started.version), "conflict", "DUTY_CLOSED");
      assert.equal((await activePlace(db, slot.duty_id))?.family_id, FAMILY_1, "nothing changed");
    });

    it("refuses a place that is not a slot (refused)", async () => {
      const row = await db.query("select status, version from assignments where id = $1", [
        ASSIGNMENT_F1_T1,
      ]);
      assert.ok(row.rows[0]);
      await db.query("update assignments set status = 'active' where id = $1", [ASSIGNMENT_F1_T1]);
      const version = Number(
        (await db.query("select version from assignments where id = $1", [ASSIGNMENT_F1_T1]))
          .rows[0].version,
      );
      refused(
        await giveUp(PARENT_F1, ASSIGNMENT_F1_T1, version),
        "conflict",
        "SLOT_NOT_RELEASABLE",
      );
    });

    it("refuses an outdated page and does nothing for a repeated click", async () => {
      const slot = await slotAfter(db, 3);
      await signUp(db, schema, PARENT_F1, slot.duty_id);
      const place = (await activePlace(db, slot.duty_id))!;
      refused(await giveUp(PARENT_F1, place.id, place.version + 7), "conflict", "VERSION_CONFLICT");
      const key = nextKey("same");
      assert.equal((await giveUp(PARENT_F1, place.id, place.version, key)).state, "success");
      assert.equal((await giveUp(PARENT_F1, place.id, place.version, key)).code, "replayed");
      refused(await giveUp(PARENT_F1, place.id, place.version), "conflict", "VERSION_CONFLICT");
      assert.equal(await activePlace(db, slot.duty_id), undefined);
      const other = await slotAfter(db, 3, "afternoon");
      await signUp(db, schema, PARENT_SIX, other.duty_id);
      assert.ok(await activePlace(db, other.duty_id), "another family's slot is untouched");
    });
  });
}
