import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  callFunction,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  nextKey,
  openDirectoryDatabase,
  OUTSIDER,
  PARENT_F1,
  SUPER_ADMIN,
  YEAR_1,
  YEAR_OTHER,
} from "./directory-support.ts";
import { openDatabase } from "./stack-support.ts";
import {
  ADMIN_G1,
  auditOf,
  CARE_GROUP,
  createSlots,
  noticesOf,
  refused,
  seedAnimalWorld,
  signUp,
  slotAfter,
  TEACHER_G1,
} from "./animal-support.ts";

/**
 * The year's calendar and slots (W1; BR80.1 to BR80.5, BR89.1): allowed, refused, out of reach, outdated screen,
 * repeated click and two people at once. All data is invented.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`animal calendar and slots in ${schema}`, () => {
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
    beforeEach(() => seedAnimalWorld(db, schema, { slots: false }));

    const get = (account: string, year = YEAR_1) =>
      callFunction(db, schema, account, "animal_calendar_get($1)", [year]);
    const save = (
      account: string,
      morning: string,
      afternoon: string,
      group: string | null,
      version: number,
      key = nextKey("cal"),
      year = YEAR_1,
    ) =>
      callFunction(db, schema, account, "animal_calendar_save($1, $2, $3, $4, $5, $6)", [
        key,
        year,
        morning,
        afternoon,
        group,
        version,
      ]);
    const slotCount = async () =>
      Number((await db.query("select count(*)::int as n from animal_slots")).rows[0].n);

    it("shows the defaults before a calendar exists (allowed)", async () => {
      const result = await get(SUPER_ADMIN);
      assert.equal(result.state, "success");
      assert.equal(result.exists, false);
      assert.equal(result.morning_start, "07:30");
      assert.equal(result.afternoon_start, "16:00");
      assert.equal(result.care_group_id, CARE_GROUP);
      assert.equal(result.version, 0);
    });

    it("creates two slots on every weekday of every school week, breaks included, and none twice", async () => {
      const first = await createSlots(db, schema);
      const added = Number(first.added);
      const weeks = Number(
        (await db.query(`select count(*)::int as n from ${schema}.school_weeks($1)`, [YEAR_1]))
          .rows[0].n,
      );
      assert.equal(
        added,
        weeks * 10 - (await outsideYear()),
        "two slots per weekday of every week",
      );
      assert.equal(await slotCount(), added);
      const second = await createSlots(db, schema);
      assert.equal(second.added, 0);
      assert.equal(await slotCount(), added);
      const bad = await db.query(
        "select count(*)::int as n from animal_slots s join tasks t on t.id = s.duty_id where t.origin_kind <> 'animal_slot' or t.capacity <> 1 or t.group_id is not null or extract(isodow from s.slot_date) > 5",
      );
      assert.equal(bad.rows[0].n, 0);
      const times = await db.query(
        "select distinct to_char(t.starts_at at time zone 'Europe/Budapest', 'HH24:MI') as t from animal_slots s join tasks t on t.id = s.duty_id order by 1",
      );
      assert.deepEqual(
        times.rows.map((r) => r.t),
        ["07:30", "16:00"],
      );
      assert.equal((await auditOf(db, "animal_slots.created")).length, 2);
    });

    /** Weekdays of the school weeks that fall outside the year's own dates are not made. */
    async function outsideYear(): Promise<number> {
      const row = await db.query(
        `select count(*)::int as n from ${schema}.school_weeks($1) w cross join generate_series(0, 4) o(n)
          join school_years y on y.id = $1
          where w.week_start + o.n not between y.starts_on and y.ends_on`,
        [YEAR_1],
      );
      return Number(row.rows[0].n) * 2;
    }

    it("leaves existing slots and their families alone when slots are created again (repeated click)", async () => {
      await createSlots(db, schema);
      const slot = await slotAfter(db, 3);
      assert.equal((await signUp(db, schema, PARENT_F1, slot.duty_id)).state, "success");
      const key = nextKey("again");
      const one = await callFunction(db, schema, SUPER_ADMIN, "animal_slots_create($1, $2)", [
        key,
        YEAR_1,
      ]);
      const two = await callFunction(db, schema, SUPER_ADMIN, "animal_slots_create($1, $2)", [
        key,
        YEAR_1,
      ]);
      assert.equal(one.state, "success");
      assert.equal(two.code, "replayed");
      const held = await db.query(
        "select count(*)::int as n from assignments where task_id = $1 and status <> 'removed'",
        [slot.duty_id],
      );
      assert.equal(held.rows[0].n, 1);
    });

    it("refuses everyone but a super admin (refused, out of reach)", async () => {
      for (const account of [PARENT_F1, ADMIN_G1, TEACHER_G1, OUTSIDER]) {
        assert.equal((await get(account)).state, "denied", account);
        assert.equal(
          (
            await callFunction(db, schema, account, "animal_slots_create($1, $2)", [
              nextKey("x"),
              YEAR_1,
            ])
          ).state,
          "denied",
          account,
        );
        assert.equal((await save(account, "07:30", "16:00", null, 0)).state, "denied", account);
      }
      assert.equal(await slotCount(), 0);
      const foreign = await get(SUPER_ADMIN, YEAR_OTHER);
      assert.equal(foreign.state, "denied");
    });

    it("saves the times and the alert group, and refuses bad input", async () => {
      const made = await save(SUPER_ADMIN, "08:00", "15:30", CARE_GROUP, 0);
      assert.equal(made.state, "success", JSON.stringify(made));
      assert.equal(made.version, 1);
      const read = await get(SUPER_ADMIN);
      assert.deepEqual(
        [read.morning_start, read.afternoon_start, read.care_group_id],
        ["08:00", "15:30", CARE_GROUP],
      );
      refused(
        await save(SUPER_ADMIN, "16:00", "07:30", null, 1),
        "validation",
        "ANIMAL_TIMES_INVALID",
      );
      refused(
        await save(SUPER_ADMIN, "07:30", "07:30", null, 1),
        "validation",
        "ANIMAL_TIMES_INVALID",
      );
      refused(
        await save(SUPER_ADMIN, "07:30", "16:00", "cccccccc-0000-4000-8000-000000000999", 1),
        "validation",
        "ANIMAL_GROUP_INVALID",
      );
      assert.equal((await auditOf(db, "animal_calendar.saved")).length, 1);
    });

    it("refuses a save made on an outdated screen", async () => {
      assert.equal((await save(SUPER_ADMIN, "08:00", "15:30", null, 0)).state, "success");
      refused(await save(SUPER_ADMIN, "08:15", "15:30", null, 0), "conflict", "VERSION_CONFLICT");
      assert.equal((await save(SUPER_ADMIN, "08:15", "15:30", null, 1)).state, "success");
    });

    it("moves the slots from tomorrow on when a time changes and tells each holding family once", async () => {
      await createSlots(db, schema);
      const calendar = await get(SUPER_ADMIN);
      const future = await slotAfter(db, 3);
      const near = await slotAfter(db, 3, "afternoon");
      assert.equal((await signUp(db, schema, PARENT_F1, future.duty_id)).state, "success");
      const result = await save(SUPER_ADMIN, "08:00", "16:00", null, Number(calendar.version));
      assert.equal(result.state, "success", JSON.stringify(result));
      const moved = await db.query(
        "select to_char(starts_at at time zone 'Europe/Budapest', 'HH24:MI') as a, to_char(ends_at - starts_at, 'HH24:MI') as len from tasks where id = $1",
        [future.duty_id],
      );
      assert.deepEqual([moved.rows[0].a, moved.rows[0].len], ["08:00", "01:00"]);
      const untouched = await db.query(
        "select to_char(starts_at at time zone 'Europe/Budapest', 'HH24:MI') as a from tasks where id = $1",
        [near.duty_id],
      );
      assert.equal(untouched.rows[0].a, "16:00");
      const notices = await noticesOf(db, "animal_slot_time_changed");
      assert.ok(notices.length >= 1);
      assert.equal(
        new Set(notices.map((n) => n.parent_id)).size,
        notices.length,
        "one notice per parent",
      );
      assert.ok(notices.every((n) => n.target_ref === YEAR_1));
      const families = await db.query("select distinct family_id from parents where id = any($1)", [
        notices.map((n) => n.parent_id),
      ]);
      assert.deepEqual(
        families.rows.map((r) => r.family_id),
        [FAMILY_1],
      );
    });

    it("lets one of two simultaneous first saves create the calendar and tells the other it is outdated (two people at once)", async () => {
      for (let run = 0; run < 8; run += 1) {
        await db.query("delete from animal_calendars");
        const answers = await Promise.all([
          callFunction(db, schema, SUPER_ADMIN, "animal_calendar_save($1, $2, $3, $4, $5, $6)", [
            nextKey("race"),
            YEAR_1,
            "07:30",
            "16:00",
            null,
            0,
          ]),
          callFunction(other, schema, SUPER_ADMIN, "animal_calendar_save($1, $2, $3, $4, $5, $6)", [
            nextKey("race"),
            YEAR_1,
            "08:00",
            "15:30",
            null,
            0,
          ]),
        ]);
        assert.equal(
          answers.filter((a) => a.state === "success").length,
          1,
          `run ${run}: ${JSON.stringify(answers)}`,
        );
        const loser = answers.find((a) => a.state !== "success")!;
        refused(loser, "conflict", "VERSION_CONFLICT");
        const calendars = await db.query("select count(*)::int as n from animal_calendars");
        assert.equal(calendars.rows[0].n, 1);
      }
    });

    it("answers a repeated save click with the first answer and changes nothing twice (repeated click)", async () => {
      const key = nextKey("cal");
      const first = await save(SUPER_ADMIN, "08:00", "15:30", CARE_GROUP, 0, key);
      assert.equal(first.state, "success", JSON.stringify(first));
      const again = await save(SUPER_ADMIN, "08:00", "15:30", CARE_GROUP, 0, key);
      assert.equal(again.state, "success");
      assert.equal(again.code, "replayed");
      assert.equal((await auditOf(db, "animal_calendar.saved")).length, 1);
    });

    it("lets one of two simultaneous creations add the slots (two people at once)", async () => {
      const calls = await Promise.all([
        callFunction(db, schema, SUPER_ADMIN, "animal_slots_create($1, $2)", [
          nextKey("race"),
          YEAR_1,
        ]),
        callFunction(other, schema, SUPER_ADMIN, "animal_slots_create($1, $2)", [
          nextKey("race"),
          YEAR_1,
        ]),
      ]);
      assert.deepEqual(
        calls.map((c) => c.state),
        ["success", "success"],
      );
      assert.equal(calls.filter((c) => Number(c.added) > 0).length, 1, JSON.stringify(calls));
      const duplicates = await db.query(
        "select count(*)::int as n from (select calendar_id, slot_date, part from animal_slots group by 1, 2, 3 having count(*) > 1) d",
      );
      assert.equal(duplicates.rows[0].n, 0);
    });

    it("keeps the daily slots out of the teacher schedule, which lists the community's tasks (regression)", async () => {
      assert.equal((await createSlots(db, schema)).state, "success");
      const slots = await db.query(
        "select count(*)::int as n from tasks where origin_kind = 'animal_slot'",
      );
      assert.ok(slots.rows[0].n > 0, "slots exist");
      const schedule = (await callFunction(
        db,
        schema,
        TEACHER_G1,
        "schedule_get('all', null, null, null)",
        [],
      )) as unknown as {
        state: string;
        items: { id: string }[];
      };
      assert.equal(schedule.state, "success", JSON.stringify(schedule));
      const slotIds = new Set(
        (await db.query("select id from tasks where origin_kind = 'animal_slot'")).rows.map((r) =>
          String(r.id),
        ),
      );
      assert.equal(schedule.items.filter((item) => slotIds.has(item.id)).length, 0);
    });
  });
}
