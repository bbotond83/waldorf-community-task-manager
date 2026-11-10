import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  callFunction,
  DIRECTORY_SCHEMAS,
  nextKey,
  openDirectoryDatabase,
  OTHER_ADMIN,
  PARENT_F1,
  seedCoordinationWorld,
  SUPER_ADMIN,
  TEACHER_G1,
  YEAR_1,
  YEAR_OTHER,
} from "./directory-support.ts";
import { count } from "./identity-support.ts";
import { makeDraft, publish, readPlan } from "./rota-support.ts";
import { openDatabase } from "./stack-support.ts";

/** The fixed-list tests of BR20.1 to BR20.5 (the school calendar), by the names of the Unit's test list. */
const BREAK_WEEK = "2026-12-21";
const SECOND_BREAK_WEEK = "2027-02-08";

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`school calendar in ${schema}`, () => {
    let db: pg.Client;
    let second: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
      second = await openDatabase();
    });
    after(async () => {
      await second.end();
      await db.end();
    });
    beforeEach(() => seedCoordinationWorld(db, schema));

    const call = (account: string, sql: string, values: unknown[]) =>
      callFunction(db, schema, account, sql, values);
    const callSecond = (account: string, sql: string, values: unknown[]) =>
      callFunction(second, schema, account, sql, values);
    const addBreak = (account: string, week: string, year = YEAR_1, key = nextKey("break")) =>
      call(account, "break_week_add($1, $2, $3, $4)", [key, year, week, "Szünet"]);
    const saveYear = (account: string, extra: object, key = nextKey("year"), id = YEAR_1) =>
      call(account, "structure_save($1, 'school_year', $2::jsonb)", [
        key,
        JSON.stringify({
          id,
          expected_version: 1,
          name: "2026/2027",
          starts_on: "2026-09-01",
          ends_on: "2027-06-30",
          ...extra,
        }),
      ]);
    const changeover = async (year = YEAR_1) =>
      String(
        (
          await db.query(
            "select to_char(changeover_date, 'YYYY-MM-DD') as d from school_years where id = $1",
            [year],
          )
        ).rows[0].d,
      );

    it("BR20.1 allowed", async () => {
      const added = await addBreak(SUPER_ADMIN, BREAK_WEEK);
      assert.equal(added.state, "success");
      assert.equal(await count(db, "break_weeks", `school_year_id = '${YEAR_1}'`), 1);
    });

    it("BR20.1 refused non-Monday, outside year, duplicate", async () => {
      const notMonday = await addBreak(SUPER_ADMIN, "2026-12-22");
      assert.deepEqual([notMonday.state, notMonday.code], ["validation", "BREAK_WEEK_INVALID"]);
      const outside = await addBreak(SUPER_ADMIN, "2025-01-06");
      assert.deepEqual([outside.state, outside.code], ["validation", "BREAK_WEEK_INVALID"]);
      const garbage = await addBreak(SUPER_ADMIN, "not-a-date");
      assert.equal(garbage.code, "BREAK_WEEK_INVALID");
      assert.equal((await addBreak(SUPER_ADMIN, BREAK_WEEK)).state, "success");
      const duplicate = await addBreak(SUPER_ADMIN, BREAK_WEEK);
      assert.deepEqual([duplicate.state, duplicate.code], ["validation", "BREAK_WEEK_EXISTS"]);
      assert.equal(await count(db, "break_weeks"), 1);
    });

    it("BR20.1 other community", async () => {
      const refused = await addBreak(OTHER_ADMIN, BREAK_WEEK, YEAR_1);
      assert.deepEqual([refused.state, refused.code], ["denied", "authorization_denied"]);
      const missing = await addBreak(SUPER_ADMIN, BREAK_WEEK, YEAR_OTHER);
      assert.equal(missing.state, "denied");
      assert.equal(await count(db, "break_weeks"), 0);
    });

    it("BR20.1 repeat", async () => {
      const key = nextKey("break");
      const first = await addBreak(SUPER_ADMIN, BREAK_WEEK, YEAR_1, key);
      const again = await addBreak(SUPER_ADMIN, BREAK_WEEK, YEAR_1, key);
      assert.deepEqual(
        [again.state, again.code, again.reference],
        ["success", "replayed", first.reference],
      );
      assert.equal(await count(db, "break_weeks"), 1);
    });

    it("BR20.1 two adds", async () => {
      const [a, b] = await Promise.all([
        addBreak(SUPER_ADMIN, BREAK_WEEK),
        callSecond(SUPER_ADMIN, "break_week_add($1, $2, $3, $4)", [
          nextKey("break"),
          YEAR_1,
          BREAK_WEEK,
          "Szünet",
        ]),
      ]);
      assert.deepEqual([a.state, b.state].sort(), ["success", "validation"]);
      assert.equal(await count(db, "break_weeks"), 1);
    });

    it("BR20.2 super admin", async () => {
      const added = await addBreak(SUPER_ADMIN, BREAK_WEEK);
      const week = String(added.reference);
      const removed = await call(SUPER_ADMIN, "break_week_remove($1, $2, $3)", [
        nextKey("remove"),
        week,
        1,
      ]);
      assert.equal(removed.state, "success");
      assert.equal(await count(db, "break_weeks"), 0);
    });

    it("BR20.2 parent, teacher, group admin refused", async () => {
      const added = await addBreak(SUPER_ADMIN, BREAK_WEEK);
      for (const account of [PARENT_F1, TEACHER_G1, ADMIN_G1]) {
        const add = await addBreak(account, SECOND_BREAK_WEEK);
        assert.deepEqual([add.state, add.code], ["denied", "authorization_denied"]);
        const remove = await call(account, "break_week_remove($1, $2, $3)", [
          nextKey("remove"),
          String(added.reference),
          1,
        ]);
        assert.equal(remove.state, "denied");
        const read = await call(account, "school_calendar_get($1)", [YEAR_1]);
        assert.equal(read.state, "denied");
      }
      assert.equal(await count(db, "break_weeks"), 1);
    });

    it("BR20.2 other community", async () => {
      const added = await addBreak(SUPER_ADMIN, BREAK_WEEK);
      const remove = await call(OTHER_ADMIN, "break_week_remove($1, $2, $3)", [
        nextKey("remove"),
        String(added.reference),
        1,
      ]);
      assert.deepEqual([remove.state, remove.code], ["denied", "authorization_denied"]);
      const made = await call(SUPER_ADMIN, "break_week_remove($1, $2, $3)", [
        nextKey("remove"),
        "00000000-0000-4000-8000-0000000000ff",
        1,
      ]);
      assert.equal(made.state, "denied");
      assert.equal(await count(db, "break_weeks"), 1);
    });

    it("BR20.3 default and change", async () => {
      assert.equal(await changeover(), "2027-07-01");
      const changed = await saveYear(SUPER_ADMIN, { changeover_date: "2027-06-15" });
      assert.equal(changed.state, "success");
      assert.equal(await changeover(), "2027-06-15");
      // An absent date keeps the stored one.
      const kept = await saveYear(SUPER_ADMIN, { name: "2026/2027 tanév", expected_version: 2 });
      assert.equal(kept.state, "success");
      assert.equal(await changeover(), "2027-06-15");
    });

    it("BR20.3 before start refused, refused while a plan exists", async () => {
      const early = await saveYear(SUPER_ADMIN, { changeover_date: "2026-08-01" });
      assert.deepEqual([early.state, early.code], ["validation", "field_invalid"]);
      assert.equal(await changeover(), "2027-07-01");
      await makeDraft(db, schema);
      const dates = await saveYear(SUPER_ADMIN, { ends_on: "2027-06-25" });
      assert.deepEqual([dates.state, dates.code], ["conflict", "ROTA_PLAN_EXISTS"]);
      const nameOnly = await saveYear(SUPER_ADMIN, { name: "Új név" });
      assert.equal(nameOnly.state, "success");
    });

    it("BR20.3 other community", async () => {
      const refused = await saveYear(OTHER_ADMIN, { changeover_date: "2027-06-15" });
      assert.notEqual(refused.state, "success");
      assert.equal(await changeover(), "2027-07-01");
    });

    it("BR20.3 stale version", async () => {
      const stale = await saveYear(SUPER_ADMIN, {
        expected_version: 9,
        changeover_date: "2027-06-15",
      });
      assert.deepEqual([stale.state, stale.code], ["conflict", "VERSION_CONFLICT"]);
      assert.equal(await changeover(), "2027-07-01");
    });

    it("BR20.3 repeat", async () => {
      const key = nextKey("year");
      const first = await saveYear(SUPER_ADMIN, { changeover_date: "2027-06-15" }, key);
      const again = await saveYear(SUPER_ADMIN, { changeover_date: "2027-06-15" }, key);
      assert.deepEqual([again.state, again.code], ["success", "replayed"]);
      assert.equal(again.reference, first.reference);
    });

    it("BR20.3 two editors", async () => {
      const body = (date: string) =>
        JSON.stringify({
          id: YEAR_1,
          expected_version: 1,
          name: "2026/2027",
          starts_on: "2026-09-01",
          ends_on: "2027-06-30",
          changeover_date: date,
        });
      const [a, b] = await Promise.all([
        call(SUPER_ADMIN, "structure_save($1, 'school_year', $2::jsonb)", [
          nextKey("year"),
          body("2027-06-10"),
        ]),
        callSecond(SUPER_ADMIN, "structure_save($1, 'school_year', $2::jsonb)", [
          nextKey("year"),
          body("2027-06-11"),
        ]),
      ]);
      assert.deepEqual([a.state, b.state].sort(), ["conflict", "success"]);
    });

    it("BR20.4 break week reads as no duty", async () => {
      await addBreak(SUPER_ADMIN, BREAK_WEEK);
      const view = (await call(SUPER_ADMIN, "school_calendar_get($1)", [YEAR_1])) as unknown as {
        state: string;
        items: { week_start: string; is_break: boolean }[];
        school_year: { changeover_date: string };
      };
      assert.equal(view.state, "success");
      assert.equal(view.items.find((w) => w.week_start === BREAK_WEEK)?.is_break, true);
      assert.equal(view.items.filter((w) => w.is_break).length, 1);
      assert.equal(view.school_year.changeover_date, "2027-07-01");
      // The first and last school weeks are Monday weeks that contain a weekday of the year.
      assert.equal(view.items[0]?.week_start, "2026-08-31");
      assert.equal(view.items.at(-1)?.week_start, "2027-06-28");
      // The helper the rota reads gives the same answer.
      const week = await db.query(
        "select is_break from school_weeks($1) where week_start = $2::date",
        [YEAR_1, BREAK_WEEK],
      );
      assert.equal(week.rows[0].is_break, true);
      assert.equal(
        (
          await db.query("select school_year_for('2026-12-24', $1) as id", [
            "aaaaaaaa-0000-4000-8000-000000000001",
          ])
        ).rows[0].id,
        YEAR_1,
      );
    });

    it("BR20.5 duty stays, warning shown", async () => {
      const draft = await makeDraft(db, schema);
      const published = await publish(db, schema, draft);
      assert.equal(published.state, "success", JSON.stringify(published));
      const duties = await count(db, "tasks", "origin_kind = 'rota_week'");
      const filled = (await readPlan(db, schema)).items.find((w) => w.week_start === BREAK_WEEK);
      assert.ok(filled?.family_id);
      const added = await addBreak(SUPER_ADMIN, BREAK_WEEK);
      assert.equal(added.state, "success");
      assert.equal(await count(db, "tasks", "origin_kind = 'rota_week'"), duties);
      const view = (await call(SUPER_ADMIN, "school_calendar_get($1)", [YEAR_1])) as unknown as {
        warnings: { week_start: string; family_display_name: string }[];
      };
      assert.deepEqual(
        view.warnings.map((w) => w.week_start),
        [BREAK_WEEK],
      );
      assert.ok(view.warnings[0]?.family_display_name);
    });

    it("BR20.5 repeat", async () => {
      const draft = await makeDraft(db, schema);
      await publish(db, schema, draft);
      const key = nextKey("break");
      await addBreak(SUPER_ADMIN, BREAK_WEEK, YEAR_1, key);
      const again = await addBreak(SUPER_ADMIN, BREAK_WEEK, YEAR_1, key);
      assert.equal(again.code, "replayed");
      assert.equal(await count(db, "break_weeks"), 1);
    });
  });
}
