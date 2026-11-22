import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  FAMILY_2,
  GROUP_1,
  openDirectoryDatabase,
  ORGANIZATION,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_CO,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  uuid,
  YEAR_1,
} from "./directory-support.ts";
import { asActor, asServiceRole, count, failureOf } from "./identity-support.ts";
import {
  dayOffset,
  FAMILY_GONE,
  insertOccurrence,
  insertSchedule,
  mondayAfter,
  noticesFor,
  OCC,
  occurrenceRow,
  occurrencesOf,
  publishWeeks,
  recurringCalls,
  SCHEDULE_F1,
  SCHEDULE_G1,
  SCHEDULE_WATER,
  scheduleRow,
  seedRecurringWorld,
} from "./recurring-support.ts";
import { openDatabase, report } from "./stack-support.ts";
import { PARENT_ROW_ADMIN_G1 } from "./working-groups-support.ts";

/**
 * The daily check of U9 (W7; BR143, BR148, BR149, D-REL-1; NFR5.5, NFR5.6, NFR7.5 to NFR7.7, NFR9.3, NFR10.1). It is
 * called as the schema owner with a chosen moment, the way the daily run of U5 reaches it.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`recurring daily check in ${schema}`, () => {
    let db: pg.Client;
    let one: pg.Client;
    let two: pg.Client;
    before(async () => {
      db = await openDirectoryDatabase(schema);
      one = await openDatabase();
      two = await openDatabase();
    });
    after(async () => {
      await one.end();
      await two.end();
      await db.end();
    });
    beforeEach(async () => {
      await seedRecurringWorld(db, schema);
    });

    const calls = recurringCalls(() => db, schema);
    /** The check at 09:00 (or another time) Budapest time on a date, on a given connection. */
    const run = async (date: string, time = "09:00", client: pg.Client = db) => {
      const result = await client.query(
        `select ${schema}.recurring_due_check((($1::date)::text || ' ' || $2::text)::timestamp at time zone 'Europe/Budapest') as r`,
        [date, time],
      );
      return result.rows[0].r as { created: number; skipped: number; detail: string | null };
    };
    /** A schedule whose own due dates are far away, so only the occurrences a test inserts matter. */
    const quiet = async (id: string, options: Parameters<typeof insertSchedule>[1] = {}) =>
      insertSchedule(db, { id, start: await dayOffset(db, 700), interval: 52, ...options });
    const noticeCount = async (parent: string, kind: string) =>
      (await noticesFor(db, parent, kind)).length;
    const deliveries = () => count(db, "email_deliveries");

    describe("the notice window (D-REL-1, BR148)", () => {
      const cases: { runs: number[]; due: number; overdue: number }[] = [
        { runs: [0, 1, 2], due: 1, overdue: 0 },
        { runs: [0, 3, 4], due: 1, overdue: 1 },
        { runs: [2], due: 1, overdue: 0 },
        { runs: [3], due: 0, overdue: 1 },
        { runs: [3, 4, 5, 9], due: 0, overdue: 1 },
        { runs: [1, 2, 3], due: 1, overdue: 1 },
        { runs: [2, 3], due: 1, overdue: 1 },
        { runs: [0, 0], due: 1, overdue: 0 },
        { runs: [-1], due: 0, overdue: 0 },
        { runs: [60], due: 0, overdue: 1 },
        { runs: [61], due: 0, overdue: 0 },
        { runs: [3, 61], due: 0, overdue: 1 },
      ];
      for (const item of cases) {
        it(`runs on days ${item.runs.join(", ")} after the due date: ${item.due} due and ${item.overdue} overdue notice`, async () => {
          const due = await dayOffset(db, 10);
          await quiet(SCHEDULE_G1, { group: GROUP_1 });
          await insertOccurrence(db, { id: OCC(1), schedule: SCHEDULE_G1, due });
          for (const day of item.runs) await run(await dayOffset(db, 10 + day));
          assert.equal(await noticeCount(PARENT_ROW_ADMIN_G1, "recurring_due"), item.due);
          assert.equal(await noticeCount(PARENT_ROW_ADMIN_G1, "recurring_overdue"), item.overdue);
          assert.equal(
            await deliveries(),
            item.due + item.overdue,
            "one queued email for each notice",
          );
          const row = (await occurrenceRow(db, OCC(1)))!;
          assert.equal(row.due_notice_sent_at !== null, item.due === 1);
          assert.equal(row.overdue_notice_sent_at !== null, item.overdue === 1);
        });
      }

      it("switching a schedule on creates no occurrence by itself; the next daily run does (BR144.2)", async () => {
        const today = await dayOffset(db, 0);
        const id = await insertSchedule(db, {
          id: SCHEDULE_G1,
          group: GROUP_1,
          start: today,
          active: false,
        });
        assert.equal((await calls.setActive(ADMIN_G1, id, 1, true)).state, "success");
        assert.equal(await count(db, "recurring_occurrences"), 0, "the switch makes none");
        await run(today);
        assert.equal(await count(db, "recurring_occurrences"), 3, "today and the two weeks ahead");
      });

      it("a run never changes the version of an occurrence a person may have open", async () => {
        await quiet(SCHEDULE_G1, { group: GROUP_1 });
        await insertOccurrence(db, {
          id: OCC(1),
          schedule: SCHEDULE_G1,
          due: await dayOffset(db, 0),
        });
        await run(await dayOffset(db, 0));
        assert.equal((await occurrenceRow(db, OCC(1)))!.version, 1);
      });

      it("a schedule saved after the day's run is picked up by the next run, once (W7)", async () => {
        const today = await dayOffset(db, 0);
        assert.deepEqual(await run(today), { created: 0, skipped: 0, detail: null });
        const saved = await calls.save(ADMIN_G1, {
          kind: "group",
          group: GROUP_1,
          start: today,
          interval: 52,
        });
        assert.equal(saved.state, "success", JSON.stringify(saved));
        const first = await run(today, "18:00");
        assert.equal(first.created, 1);
        assert.deepEqual(await run(today, "19:00"), { created: 0, skipped: 0, detail: null });
        assert.equal(await noticeCount(PARENT_ROW_ADMIN_G1, "recurring_due"), 1);
      });

      it("nothing is sent for a finished occurrence, a switched-off schedule, an archived group or a removed family", async () => {
        const today = await dayOffset(db, 0);
        await quiet(SCHEDULE_G1, { group: GROUP_1 });
        await insertOccurrence(db, {
          id: OCC(1),
          schedule: SCHEDULE_G1,
          due: today,
          status: "done",
          doneBy: PARENT_ROW_F1,
        });
        await insertOccurrence(db, {
          id: OCC(2),
          schedule: SCHEDULE_G1,
          due: await dayOffset(db, -1),
          status: "skipped",
        });
        await quiet(uuid(99010), { group: GROUP_1, active: false });
        await insertOccurrence(db, { id: OCC(3), schedule: uuid(99010), due: today });
        await quiet(SCHEDULE_F1, { kind: "family", family: FAMILY_GONE });
        await insertOccurrence(db, { id: OCC(4), schedule: SCHEDULE_F1, due: today });
        await db.query("update groups set status = 'archived' where id = $1", [GROUP_1]);
        const result = await run(today);
        assert.deepEqual(result, { created: 0, skipped: 0, detail: null });
        assert.equal(await count(db, "notifications"), 0);
      });
    });

    describe("making the occurrences (BR143)", () => {
      it("makes the occurrences up to 14 days ahead by start date and interval, and a second run makes none", async () => {
        const today = await dayOffset(db, 0);
        await insertSchedule(db, {
          id: SCHEDULE_G1,
          group: GROUP_1,
          start: await dayOffset(db, -14),
          interval: 1,
        });
        await insertSchedule(db, {
          id: uuid(99010),
          group: GROUP_1,
          start: await dayOffset(db, -14),
          interval: 2,
        });
        const first = await run(today);
        assert.equal(first.created >= 5, true, JSON.stringify(first));
        assert.deepEqual(
          (await occurrencesOf(db, SCHEDULE_G1)).map((o) => o.due_date),
          [await dayOffset(db, 0), await dayOffset(db, 7), await dayOffset(db, 14)],
        );
        assert.deepEqual(
          (await occurrencesOf(db, uuid(99010))).map((o) => o.due_date),
          [await dayOffset(db, 0), await dayOffset(db, 14)],
        );
        const second = await run(today, "15:00");
        assert.equal(second.created, 0);
        assert.equal(
          await count(db, "recurring_occurrences", "due_date < current_date"),
          0,
          "never in the past",
        );
      });

      it("keeps to the season and does not move other dates (BR142.1)", async () => {
        const month = Number((await dayOffset(db, 0)).slice(5, 7));
        const other = month === 12 ? 1 : month + 1;
        await insertSchedule(db, {
          id: SCHEDULE_G1,
          group: GROUP_1,
          start: await dayOffset(db, 0),
          interval: 1,
          from: other,
          to: other,
        });
        await run(await dayOffset(db, 0));
        const dues = (await occurrencesOf(db, SCHEDULE_G1)).map((o) =>
          Number(o.due_date.slice(5, 7)),
        );
        assert.ok(
          dues.every((m) => m === other),
          JSON.stringify(dues),
        );
      });

      it("makes the occurrence of a family schedule and tells both parents of the family and nobody else (BR149.1, NFR10.1)", async () => {
        const today = await dayOffset(db, 0);
        await insertSchedule(db, {
          id: SCHEDULE_F1,
          kind: "family",
          family: FAMILY_1,
          start: today,
          interval: 52,
        });
        await run(today);
        assert.equal(await noticeCount(PARENT_ROW_F1, "recurring_due"), 1);
        assert.equal(await noticeCount(PARENT_ROW_CO, "recurring_due"), 1);
        assert.equal(await noticeCount(PARENT_ROW_F2, "recurring_due"), 0);
        assert.equal(await noticeCount(PARENT_ROW_ADMIN_G1, "recurring_due"), 0);
      });
    });

    describe("who is told (BR149)", () => {
      it("a group's coordinators are told; with no coordinator its active members are", async () => {
        const today = await dayOffset(db, 0);
        await quiet(SCHEDULE_G1, { group: GROUP_1 });
        await insertOccurrence(db, { id: OCC(1), schedule: SCHEDULE_G1, due: today });
        await run(today);
        assert.equal(await noticeCount(PARENT_ROW_ADMIN_G1, "recurring_due"), 1);
        assert.equal(await noticeCount(PARENT_ROW_F1, "recurring_due"), 0);
        await insertOccurrence(db, {
          id: OCC(2),
          schedule: SCHEDULE_G1,
          due: await dayOffset(db, -1),
        });
        await db.query(
          "update app_role_grants set revoked_at = now() where subject_id = $1 and role = 'group_admin'",
          [ADMIN_G1],
        );
        await run(today, "10:00");
        assert.equal(await noticeCount(PARENT_ROW_F1, "recurring_due"), 1, "the member is told");
        assert.equal(await noticeCount(PARENT_ROW_ADMIN_G1, "recurring_due"), 2, "a member too");
      });

      it("a rota-week duty goes to the family that holds the week on the day, however the week moved (swap, cancellation, reassignment)", async () => {
        const monday = await mondayAfter(db, 0);
        await publishWeeks(db, [{ monday, family: FAMILY_1 }]);
        await quiet(SCHEDULE_WATER, { kind: "rota_week", job: "water_carrying", interval: 4 });
        await insertOccurrence(db, { id: OCC(1), schedule: SCHEDULE_WATER, due: monday });
        // Moved to the second family before the notice: the second family is told, the first is not.
        await db.query("update rota_weeks set family_id = $1 where week_start = $2", [
          FAMILY_2,
          monday,
        ]);
        await run(monday);
        assert.equal(await noticeCount(PARENT_ROW_F2, "recurring_due"), 1);
        assert.equal(await noticeCount(PARENT_ROW_F1, "recurring_due"), 0);
        // Reassigned again before the overdue notice: it follows the week.
        await db.query("update rota_weeks set family_id = $1 where week_start = $2", [
          FAMILY_1,
          monday,
        ]);
        const overdueDay = (
          await db.query("select to_char($1::date + 3, 'YYYY-MM-DD') as d", [monday])
        ).rows[0].d as string;
        await run(overdueDay);
        assert.equal(await noticeCount(PARENT_ROW_F1, "recurring_overdue"), 1);
        assert.equal(await noticeCount(PARENT_ROW_F2, "recurring_overdue"), 0);
      });

      it("a week that nobody holds makes no occurrence and no notice; a family with no sign-in account is counted as skipped", async () => {
        const monday = await mondayAfter(db, 0);
        await publishWeeks(db, [{ monday, family: null }]);
        await insertSchedule(db, {
          id: SCHEDULE_WATER,
          kind: "rota_week",
          job: "water_carrying",
          interval: 1,
          start: monday,
        });
        await run(monday);
        assert.equal(await count(db, "recurring_occurrences"), 0);
        await db.query(
          "update rota_weeks set family_id = $1, empty_reason = null where week_start = $2",
          [FAMILY_GONE, monday],
        );
        await insertOccurrence(db, { id: OCC(1), schedule: SCHEDULE_WATER, due: monday });
        const result = await run(monday, "10:00");
        assert.equal(result.skipped, 1);
        assert.equal(await count(db, "notifications"), 0);
      });

      it("the texts say the title and the due date and link to the page; no other family, no person who marked it, no contact detail (NFR10.1)", async () => {
        const today = await dayOffset(db, 0);
        await quiet(SCHEDULE_G1, { group: GROUP_1, title: "Kerti munka" });
        await insertOccurrence(db, { id: OCC(1), schedule: SCHEDULE_G1, due: today });
        await insertOccurrence(db, {
          id: OCC(2),
          schedule: SCHEDULE_G1,
          due: await dayOffset(db, -5),
          status: "done",
          doneBy: PARENT_ROW_F1,
        });
        await run(today);
        const list = await calls.fn(ADMIN_G1, "notification_list()");
        const items = (
          list as unknown as { items: { title: string; text: string; link: string }[] }
        ).items;
        const mine = items.filter((item) => item.title.includes("Kerti munka"));
        assert.equal(mine.length, 1);
        const [d] = today.split("-");
        assert.ok(mine[0]!.title.startsWith("Esedékes:"), mine[0]!.title);
        assert.equal(mine[0]!.text, `Esedékes: ${d}. ${today.slice(5, 7)}. ${today.slice(8, 10)}.`);
        assert.equal(mine[0]!.link, `/szulo/munkacsoportok/${GROUP_1}/ismetlodo`);
        const text = JSON.stringify(items);
        for (const forbidden of ["Fenyő", "@", "+36", "korábbi"])
          assert.ok(!text.includes(forbidden), forbidden);
        const other = await calls.fn(PARENT_F2, "notification_list()");
        assert.equal((other as unknown as { items: unknown[] }).items.length, 0);
        const family = await calls.fn(PARENT_F1, "notification_list()");
        assert.equal((family as unknown as { items: unknown[] }).items.length, 0);
      });
    });

    describe("the clock and the calendar (NFR7.6, NFR7.7)", () => {
      it("the day is the Budapest day: just before and after midnight, in both clock-change weeks", async () => {
        const probe = async (due: string, moment: string) => {
          await db.query("delete from notifications");
          await db.query("delete from recurring_occurrences");
          await db.query("delete from recurring_schedules");
          await quiet(SCHEDULE_G1, { group: GROUP_1 });
          await insertOccurrence(db, { id: OCC(1), schedule: SCHEDULE_G1, due });
          await db.query(`select ${schema}.recurring_due_check($1::timestamptz)`, [moment]);
          return await noticeCount(PARENT_ROW_ADMIN_G1, "recurring_due");
        };
        // Spring: 2027-03-28 loses an hour at 02:00 (UTC+1 becomes UTC+2).
        assert.equal(
          await probe("2027-03-28", "2027-03-27T22:59:59Z"),
          0,
          "23:59:59 the day before",
        );
        assert.equal(await probe("2027-03-28", "2027-03-27T23:00:00Z"), 1, "00:00:00 on the day");
        assert.equal(
          await probe("2027-03-28", "2027-03-28T21:59:59Z"),
          1,
          "23:59:59 on the day (UTC+2)",
        );
        // The next day is day 1 and sends nothing new for a fresh occurrence that is due the day before.
        // Autumn: 2026-10-25 has 25 hours and ends at 23:00 UTC.
        assert.equal(
          await probe("2026-10-25", "2026-10-24T21:59:59Z"),
          0,
          "23:59:59 the day before (UTC+2)",
        );
        assert.equal(await probe("2026-10-25", "2026-10-24T22:00:00Z"), 1, "00:00:00 on the day");
        assert.equal(
          await probe("2026-10-25", "2026-10-25T22:59:59Z"),
          1,
          "23:59:59 on the day (UTC+1)",
        );
        // Just after UTC midnight in winter is already the next Budapest day.
        assert.equal(await probe("2027-01-11", "2027-01-10T23:30:00Z"), 1);
      });

      it("whole weeks are counted in dates, so the week of a clock change is neither shorter nor longer", async () => {
        await insertSchedule(db, {
          id: SCHEDULE_G1,
          group: GROUP_1,
          start: "2027-03-15",
          interval: 1,
        });
        await run("2027-03-20");
        assert.deepEqual(
          (await occurrencesOf(db, SCHEDULE_G1)).map((o) => o.due_date),
          ["2027-03-22", "2027-03-29"],
        );
        await run("2027-10-23", "09:00");
        assert.ok((await occurrencesOf(db, SCHEDULE_G1)).some((o) => o.due_date === "2027-10-25"));
      });

      it("a republished plan that adds or removes a water week moves the future occurrences nobody was told about (BR143.2)", async () => {
        const monday = await mondayAfter(db, 0);
        const week = async (n: number) =>
          (await db.query("select to_char($1::date + $2::int, 'YYYY-MM-DD') as d", [monday, n * 7]))
            .rows[0].d as string;
        await publishWeeks(db, [
          { monday, family: FAMILY_1 },
          { monday: await week(2), family: FAMILY_1 },
        ]);
        await insertSchedule(db, {
          id: SCHEDULE_WATER,
          kind: "rota_week",
          job: "water_carrying",
          interval: 2,
          start: monday,
        });
        await run(monday);
        assert.deepEqual(
          (await occurrencesOf(db, SCHEDULE_WATER)).map((o) => o.due_date),
          [monday],
        );
        // A week is added in between: the third published week now counts as number 3 and is due.
        await publishWeeks(db, [{ monday: await week(1), family: FAMILY_2 }]);
        await run(monday, "12:00");
        assert.deepEqual(
          (await occurrencesOf(db, SCHEDULE_WATER)).map((o) => o.due_date),
          [monday, await week(2)],
        );
        // A week is taken out again: the later occurrence nobody was told about goes, the first stays.
        await db.query("delete from rota_weeks where week_start = $1 and job = 'water_carrying'", [
          await week(1),
        ]);
        await run(monday, "13:00");
        assert.deepEqual(
          (await occurrencesOf(db, SCHEDULE_WATER)).map((o) => o.due_date),
          [monday],
        );
        // One somebody was told about stays.
        await insertOccurrence(db, {
          id: OCC(9),
          schedule: SCHEDULE_WATER,
          due: await week(2),
          dueNotice: new Date().toISOString(),
        });
        await run(monday, "14:00");
        assert.ok((await occurrencesOf(db, SCHEDULE_WATER)).some((o) => o.id === OCC(9)));
      });

      it("the count of water weeks starts again with the plan of the next school year (NFR7.7)", async () => {
        const year2 = uuid(99020);
        await db.query(
          "insert into school_years (id, organization_id, name, starts_on, ends_on) values ($1, $2, '2027/2028', '2027-09-01', '2028-06-30')",
          [year2, ORGANIZATION],
        );
        const insertPlan = async (year: string, mondays: string[]) => {
          const plan = await db.query(
            "insert into rota_plans (organization_id, school_year_id, status, published_at, published_by) values ($1, $2, 'published', now(), 'bbbbbbbb-0000-4000-8000-000000000001') returning id",
            [ORGANIZATION, year],
          );
          for (const monday of mondays) {
            await db.query(
              "insert into rota_weeks (organization_id, plan_id, job, week_start, family_id) values ($1, $2, 'water_carrying', $3, $4)",
              [ORGANIZATION, plan.rows[0].id, monday, FAMILY_1],
            );
          }
        };
        await insertPlan(YEAR_1, ["2027-06-14", "2027-06-21", "2027-06-28"]);
        await insertPlan(year2, ["2027-09-06", "2027-09-13", "2027-09-20"]);
        const schedule = await insertSchedule(db, {
          id: SCHEDULE_WATER,
          kind: "rota_week",
          job: "water_carrying",
          interval: 2,
          start: "2027-06-01",
        });
        const dates = await db.query(
          `select to_char(d.due_date, 'YYYY-MM-DD') as d from recurring_due_dates((select s from recurring_schedules s where s.id = $1), '2027-06-01', '2027-09-30') d order by 1`,
          [schedule],
        );
        assert.deepEqual(
          dates.rows.map((r) => r.d),
          ["2027-06-14", "2027-06-28", "2027-09-06", "2027-09-20"],
        );
        await run("2027-09-06");
        assert.deepEqual(
          (await occurrencesOf(db, schedule)).map((o) => o.due_date),
          ["2027-09-06", "2027-09-20"],
        );
      });
    });

    describe("two at once (NFR5.5, NFR5.6)", () => {
      it("two runs at the same moment make every occurrence and every notice once, 20 times", async () => {
        for (let attempt = 0; attempt < 20; attempt += 1) {
          await db.query("delete from notifications");
          await db.query("delete from recurring_occurrences");
          await db.query("delete from recurring_schedules");
          const today = await dayOffset(db, 0);
          await insertSchedule(db, { id: SCHEDULE_G1, group: GROUP_1, start: today, interval: 1 });
          await insertSchedule(db, {
            id: SCHEDULE_F1,
            kind: "family",
            family: FAMILY_1,
            start: today,
            interval: 1,
          });
          const [a, b] = await Promise.all([run(today, "09:00", one), run(today, "09:00", two)]);
          assert.equal(a.detail, null, `run ${attempt}`);
          assert.equal(b.detail, null, `run ${attempt}`);
          assert.equal((await occurrencesOf(db, SCHEDULE_G1)).length, 3, `run ${attempt}`);
          assert.equal((await occurrencesOf(db, SCHEDULE_F1)).length, 3, `run ${attempt}`);
          assert.equal(
            await noticeCount(PARENT_ROW_ADMIN_G1, "recurring_due"),
            1,
            `run ${attempt}`,
          );
          assert.equal(await noticeCount(PARENT_ROW_F1, "recurring_due"), 1, `run ${attempt}`);
          assert.equal(await noticeCount(PARENT_ROW_CO, "recurring_due"), 1, `run ${attempt}`);
        }
      });

      it("the check against a switch-off leaves every occurrence and notice once and the schedule consistent, 20 times", async () => {
        for (let attempt = 0; attempt < 20; attempt += 1) {
          await db.query("delete from notifications");
          await db.query("delete from recurring_occurrences");
          await db.query("delete from recurring_schedules");
          const today = await dayOffset(db, 0);
          await insertSchedule(db, { id: SCHEDULE_G1, group: GROUP_1, start: today, interval: 1 });
          const [checked, off] = await Promise.all([
            run(today, "09:00", one),
            recurringCalls(() => two, schema).setActive(ADMIN_G1, SCHEDULE_G1, 1, false),
          ]);
          assert.equal(checked.detail, null, `run ${attempt}`);
          assert.equal(off.state, "success", JSON.stringify(off));
          const rows = await occurrencesOf(db, SCHEDULE_G1);
          assert.ok(new Set(rows.map((r) => r.due_date)).size === rows.length, `run ${attempt}`);
          const later = rows.filter((r) => r.due_date > today);
          assert.ok(
            later.every((r) => r.status === "skipped"),
            `run ${attempt}: ${JSON.stringify(rows)}`,
          );
          assert.ok(
            (await noticeCount(PARENT_ROW_ADMIN_G1, "recurring_due")) <= 1,
            `run ${attempt}`,
          );
          assert.equal((await scheduleRow(db, SCHEDULE_G1))!.is_active, false);
        }
      });
    });

    describe("a failure stays with its schedule (NFR7.5)", () => {
      it("a schedule that fails is named in the detail and rolled back alone; the others and the other checks still run", async () => {
        const today = await dayOffset(db, 0);
        await insertSchedule(db, { id: SCHEDULE_G1, group: GROUP_1, start: today, interval: 52 });
        await insertSchedule(db, {
          id: SCHEDULE_F1,
          kind: "family",
          family: FAMILY_1,
          start: today,
          interval: 52,
        });
        await db.query(
          "create function rec_fail_one() returns trigger language plpgsql as $f$ begin if new.schedule_id = '" +
            SCHEDULE_G1 +
            "' then raise exception 'boom'; end if; return new; end $f$",
        );
        await db.query(
          "create trigger rec_fail_one before insert on recurring_occurrences for each row execute function rec_fail_one()",
        );
        try {
          const result = await run(today);
          assert.equal(result.detail, `failed: ${SCHEDULE_G1}`);
          assert.equal((await occurrencesOf(db, SCHEDULE_G1)).length, 0);
          assert.equal((await occurrencesOf(db, SCHEDULE_F1)).length, 1);
          assert.equal(await noticeCount(PARENT_ROW_F1, "recurring_due"), 1);
          // Through the daily run of U5 the check is recorded with the schedule id and the run goes on.
          const full = await asActor(
            db,
            schema,
            asServiceRole,
            async () =>
              (
                await db.query("select timed_checks_run_system('daily', $1::timestamptz) as r", [
                  `${today}T07:00:00Z`,
                ])
              ).rows[0].r as {
                checks: { check: string; outcome: string; detail: string | null }[];
              },
          );
          const mine = full.checks.find((c) => c.check === "recurring_duties")!;
          assert.equal(mine.outcome, "success");
          assert.equal(mine.detail, `failed: ${SCHEDULE_G1}`);
          assert.ok(full.checks.every((c) => c.outcome !== "failed"));
          assert.ok(full.checks.length > 1, "the other checks ran too");
          // Nobody, not even the service role, can call the check itself.
          const direct = await failureOf(() =>
            asActor(db, schema, asServiceRole, () => db.query("select recurring_due_check(now())")),
          );
          assert.equal(direct?.code, "42501");
        } finally {
          await db.query("drop trigger rec_fail_one on recurring_occurrences");
          await db.query("drop function rec_fail_one()");
        }
        const healed = await run(today, "10:00");
        assert.equal(healed.detail, null);
        assert.equal((await occurrencesOf(db, SCHEDULE_G1)).length, 1);
      });

      it("a failed email leaves the check intact: nothing here contacts a mail server, and a rerun adds nothing", async () => {
        const today = await dayOffset(db, 0);
        await quiet(SCHEDULE_G1, { group: GROUP_1 });
        await insertOccurrence(db, { id: OCC(1), schedule: SCHEDULE_G1, due: today });
        await run(today);
        await db.query(
          "update email_deliveries set status = 'failed', attempts_in_round = 3, finished_at = now()",
        );
        const again = await run(today, "11:00");
        assert.deepEqual(again, { created: 0, skipped: 0, detail: null });
        assert.equal(await noticeCount(PARENT_ROW_ADMIN_G1, "recurring_due"), 1);
      });
    });

    describe("timing on a school year of data (NFR9.3)", () => {
      it("the first run with every schedule due is under 5 seconds and a second run under 2 seconds, median of five", async () => {
        const today = await dayOffset(db, 0);
        await db.query(
          `insert into recurring_schedules (id, organization_id, title, category, owner_kind, working_group_id, interval_kind,
             interval_count, start_date)
           select ('00000000-0000-4000-8000-' || lpad((970000 + n)::text, 12, '0'))::uuid, $1, 'Munka ' || n, 'kert', 'group', $2, 'weeks', 1, $3::date - 140
             from generate_series(1, 60) n`,
          [ORGANIZATION, GROUP_1, today],
        );
        await db.query(
          `insert into recurring_schedules (id, organization_id, title, category, owner_kind, family_id, interval_kind,
             interval_count, start_date)
           select ('00000000-0000-4000-8000-' || lpad((971000 + n)::text, 12, '0'))::uuid, $1, 'Családi munka ' || n, 'kert', 'family', $2, 'weeks', 1, $3::date - 140
             from generate_series(1, 20) n`,
          [ORGANIZATION, FAMILY_1, today],
        );
        await db.query(
          `insert into recurring_occurrences (organization_id, schedule_id, due_date, status)
           select s.organization_id, s.id, $1::date + k * 7, 'open' from recurring_schedules s cross join generate_series(-20, -1) k`,
          [today],
        );
        await db.query("analyze");
        const first: number[] = [];
        for (let round = 0; round < 5; round += 1) {
          await db.query("delete from notifications");
          await db.query(
            "update recurring_occurrences set due_notice_sent_at = null, overdue_notice_sent_at = null",
          );
          const started = performance.now();
          const result = await run(today);
          first.push(performance.now() - started);
          assert.equal(result.detail, null);
        }
        first.sort((x, y) => x - y);
        const second: number[] = [];
        for (let round = 0; round < 5; round += 1) {
          const started = performance.now();
          await run(today, "10:00");
          second.push(performance.now() - started);
        }
        second.sort((x, y) => x - y);
        report(
          `recurring_due_check in ${schema}: first run median ${first[2]!.toFixed(0)} ms, second run median ${second[2]!.toFixed(0)} ms`,
        );
        assert.ok(first[2]! < 5000, `first run ${first[2]!.toFixed(0)} ms`);
        assert.ok(second[2]! < 2000, `second run ${second[2]!.toFixed(0)} ms`);
        assert.ok((await count(db, "notifications")) > 0);
      });
    });
  });
}
