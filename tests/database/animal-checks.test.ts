import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  callFunction,
  DIRECTORY_SCHEMAS,
  FAMILY_2,
  GROUP_1,
  nextKey,
  openDirectoryDatabase,
  ORGANIZATION,
  SUPER_ADMIN,
  YEAR_1,
} from "./directory-support.ts";
import { setChangeover, setStanding } from "./rota-full-support.ts";
import { PARENT_ROW_ADMIN_G1 } from "./working-groups-support.ts";
import {
  FAMILY_1,
  noticesOf,
  runCheck,
  seedAnimalWorld,
  slotAfter,
  sundayNoon,
  wednesdayNoon,
} from "./animal-support.ts";

/**
 * The two daily checks (W5, W6; BR84, BR85), called as the schema owner with a chosen moment. The first run makes the
 * messages, a second run of the same day makes none (once keys). Recipients are asked of the database, so the tests
 * state who is told, not which rows exist.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`animal daily checks in ${schema}`, () => {
    let db: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(() => seedAnimalWorld(db, schema));

    const familyOf = async (parent: string) =>
      String(
        (await db.query("select family_id from parents where id = $1", [parent])).rows[0].family_id,
      );
    const fill = async (duty: string, family: string) =>
      db.query(
        "insert into assignments (organization_id, task_id, family_id, source) values ($1, $2, $3, 'admin_assign')",
        [ORGANIZATION, duty, family],
      );
    const dutiesOn = async (date: string) =>
      (
        await db.query(
          "select s.duty_id from animal_slots s where s.slot_date = $1 order by s.part",
          [date],
        )
      ).rows.map((r) => String(r.duty_id));
    const addDays = async (date: string, days: number) =>
      String(
        (await db.query("select to_char($1::date + $2::integer, 'YYYY-MM-DD') as d", [date, days]))
          .rows[0].d,
      );
    const setAlertGroup = async () => {
      const calendar = await callFunction(db, schema, SUPER_ADMIN, "animal_calendar_get($1)", [
        YEAR_1,
      ]);
      const saved = await callFunction(
        db,
        schema,
        SUPER_ADMIN,
        "animal_calendar_save($1, $2, $3, $4, $5, $6)",
        [nextKey("cal"), YEAR_1, "07:30", "16:00", GROUP_1, calendar.version],
      );
      assert.equal(saved.state, "success", JSON.stringify(saved));
    };

    describe("empty slots", () => {
      it("tells each family once about the free slots of the next three days (allowed, repeated click)", async () => {
        const { moment } = await sundayNoon(db);
        const first = await runCheck(db, schema, "animal_empty_slots_check", moment);
        assert.ok(first.created > 0, JSON.stringify(first));
        const told = await noticesOf(db, "animal_empty_slots");
        assert.equal(
          new Set(told.map((n) => n.parent_id)).size,
          told.length,
          "one notice per parent",
        );
        assert.ok(told.every((n) => n.target_ref === YEAR_1));
        const again = await runCheck(db, schema, "animal_empty_slots_check", moment);
        assert.equal(again.created, 0);
        assert.equal((await noticesOf(db, "animal_empty_slots")).length, told.length);
      });

      it("lists only what is still free when the message is read", async () => {
        const { moment, monday } = await sundayNoon(db);
        await runCheck(db, schema, "animal_empty_slots_check", moment);
        const told = await noticesOf(db, "animal_empty_slots");
        const [morning, afternoon] = await dutiesOn(monday);
        await fill(morning!, FAMILY_1);
        const facts = await db.query(
          `select * from ${schema}.animal_notice_facts($1, $2, 'animal_empty_slots')`,
          [YEAR_1, told[0]!.parent_id],
        );
        assert.equal(facts.rows[0].path, "/szulo/allatok");
        assert.ok(String(facts.rows[0].detail).startsWith("Még üres:"));
        assert.ok(afternoon);
      });

      it("sends nothing about a full window and leaves out families that may not hold the day (refused)", async () => {
        const { moment, monday } = await sundayNoon(db);
        await setChangeover(db, "2026-10-01");
        await setStanding(db, schema, FAMILY_2, "leaving");
        await runCheck(db, schema, "animal_empty_slots_check", moment);
        const families = new Set(
          await Promise.all(
            (await noticesOf(db, "animal_empty_slots")).map((n) => familyOf(n.parent_id)),
          ),
        );
        assert.ok(families.size > 0);
        assert.ok(!families.has(FAMILY_2), "a leaving family is not asked after the changeover");
        const tuesday = await addDays(monday, 1);
        const wednesday = await addDays(monday, 2);
        for (const date of [monday, tuesday, wednesday]) {
          for (const duty of await dutiesOn(date)) {
            await fill(duty, FAMILY_1);
          }
        }
        await db.query("delete from notifications");
        await db.query("delete from email_deliveries");
        const none = await runCheck(db, schema, "animal_empty_slots_check", moment);
        assert.equal(none.created, 0, JSON.stringify(none));
      });

      it("alerts the alert group's coordinators the day before, and only while a slot of that day is free", async () => {
        await setAlertGroup();
        const { moment, monday } = await sundayNoon(db);
        await runCheck(db, schema, "animal_empty_slots_check", moment);
        const alerted = (await noticesOf(db, "animal_empty_slots_alert")).map((n) => n.parent_id);
        assert.ok(alerted.includes(PARENT_ROW_ADMIN_G1), JSON.stringify(alerted));
        await db.query("delete from notifications where kind = 'animal_empty_slots_alert'");
        for (const duty of await dutiesOn(monday)) {
          await fill(duty, FAMILY_1);
        }
        await runCheck(db, schema, "animal_empty_slots_check", moment);
        assert.equal((await noticesOf(db, "animal_empty_slots_alert")).length, 0);
      });
    });

    describe("monthly fair-share reminder", () => {
      it("reminds the families below their share once a month and records the round (allowed, repeated click)", async () => {
        for (let i = 0; i < 6; i += 1) {
          await fill((await slotAfter(db, 3, "morning", i)).duty_id, FAMILY_1);
        }
        const moment = await wednesdayNoon(db);
        const first = await runCheck(db, schema, "animal_fair_share_check", moment);
        assert.ok(first.created > 0, JSON.stringify(first));
        const reminded = await Promise.all(
          (await noticesOf(db, "animal_fair_share")).map((n) => familyOf(n.parent_id)),
        );
        assert.ok(!reminded.includes(FAMILY_1), "the family above its share is not reminded");
        assert.ok(reminded.includes(FAMILY_2));
        const rounds = await db.query(
          "select families_reminded, average_at_round from animal_fair_share_rounds",
        );
        assert.equal(rounds.rows.length, 1);
        assert.ok(Number(rounds.rows[0].average_at_round) > 0);
        const again = await runCheck(db, schema, "animal_fair_share_check", moment);
        assert.equal(again.created, 0);
        assert.equal((await db.query("select 1 from animal_fair_share_rounds")).rows.length, 1);
      });

      it("words the reminder with the family's own count, share and the average, naming nobody else", async () => {
        for (let i = 0; i < 6; i += 1) {
          await fill((await slotAfter(db, 3, "morning", i)).duty_id, FAMILY_1);
        }
        await runCheck(db, schema, "animal_fair_share_check", await wednesdayNoon(db));
        const note = (await noticesOf(db, "animal_fair_share"))[0]!;
        const facts = await db.query(
          `select * from ${schema}.animal_notice_facts($1, $2, 'animal_fair_share')`,
          [YEAR_1, note.parent_id],
        );
        const detail = String(facts.rows[0].detail);
        assert.match(
          detail,
          /^Eddig 0 időpontot vállaltatok; a ti méltányos részetek \d+,\d, az átlag \d+,\d\.$/,
        );
      });

      it("does not remind a family that may not hold the day", async () => {
        for (let i = 0; i < 6; i += 1) {
          await fill((await slotAfter(db, 3, "morning", i)).duty_id, FAMILY_1);
        }
        await setChangeover(db, "2026-10-01");
        await setStanding(db, schema, FAMILY_2, "leaving");
        await runCheck(db, schema, "animal_fair_share_check", await wednesdayNoon(db));
        const reminded = await Promise.all(
          (await noticesOf(db, "animal_fair_share")).map((n) => familyOf(n.parent_id)),
        );
        assert.ok(!reminded.includes(FAMILY_2));
      });

      it("records the round even when nobody is below a share", async () => {
        const moment = await wednesdayNoon(db);
        const none = await runCheck(db, schema, "animal_fair_share_check", moment);
        assert.equal(none.created, 0);
        assert.equal((await db.query("select 1 from animal_fair_share_rounds")).rows.length, 1);
      });

      it("lets the two checks run in the daily registry at step 4 (allowed)", async () => {
        const rows = await db.query(
          "select check_name, lock_step, run_kind, is_active from timed_check_registry where added_by = 'u8-animal-care' order by check_name",
        );
        assert.deepEqual(
          rows.rows.map((r) => [r.check_name, r.lock_step, r.run_kind, r.is_active]),
          [
            ["animal_empty_slots", 4, "daily", true],
            ["animal_fair_share", 4, "daily", true],
          ],
        );
      });
    });
  });
}
