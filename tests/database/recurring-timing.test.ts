import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  GROUP_1,
  GROUP_2,
  nextKey,
  ORGANIZATION,
  openDirectoryDatabase,
  PARENT_F1,
  PARENT_ROW_F1,
  uuid,
} from "./directory-support.ts";
import {
  dayOffset,
  insertSchedule,
  mondayAfter,
  publishWeeks,
  recurringCalls,
  seedRecurringWorld,
} from "./recurring-support.ts";
import { report } from "./stack-support.ts";

/**
 * Timings of the recurring-duty commands and reads on a school year of data: sixty group schedules with a weekly
 * occurrence over forty weeks, family schedules, a rota-week schedule on a published plan (NFR9.1: group page, family
 * page, duty card, save and mark done under 2 seconds). Each call is the median of five runs after one warm-up call
 * and fails above its ceiling. The daily check is timed in recurring-check.test.ts.
 */
const RUNS = 5;
const SCHEDULES = 60;

for (const schema of DIRECTORY_SCHEMAS) {
  describe(`recurring timings in ${schema}`, () => {
    let db: pg.Client;
    const DUTY_CARD = uuid(99040);
    const MARK_IDS = Array.from({ length: RUNS + 1 }, (_, n) => uuid(97000 + n));
    // The generated schedules have ids of this shape; the first and second belong to the first group.
    const generated = (n: number) =>
      `00000000-0000-4000-8000-${String(980000 + n).padStart(12, "0")}`;

    before(async () => {
      db = await openDirectoryDatabase(schema);
      await seedRecurringWorld(db, schema);
      await db.query(
        `insert into recurring_schedules (id, organization_id, title, category, owner_kind, working_group_id, interval_kind,
           interval_count, start_date)
         select ('00000000-0000-4000-8000-' || lpad((980000 + n)::text, 12, '0'))::uuid, $1, 'Munka ' || n,
                'kategória ' || (n % 6), 'group', case when n % 3 = 0 then $3::uuid else $2::uuid end, 'weeks', 1,
                (now() at time zone 'Europe/Budapest')::date - 140
           from generate_series(1, $4) n`,
        [ORGANIZATION, GROUP_1, GROUP_2, SCHEDULES],
      );
      await db.query(
        `insert into recurring_occurrences (organization_id, schedule_id, due_date, status, done_by_parent_id, done_at)
         select s.organization_id, s.id, (now() at time zone 'Europe/Budapest')::date + k * 7,
                case when k < -2 then 'done' else 'open' end,
                case when k < -2 then $1::uuid end, case when k < -2 then now() - interval '30 days' end
           from recurring_schedules s cross join generate_series(-20, 20) k`,
        [PARENT_ROW_F1],
      );
      // Family schedules of the first family and a rota-week schedule on a published water week.
      for (let n = 0; n < 8; n += 1) {
        await insertSchedule(db, {
          id: uuid(96000 + n),
          kind: "family",
          family: FAMILY_1,
          title: `Családi munka ${n}`,
        });
      }
      await db.query(
        `insert into recurring_occurrences (organization_id, schedule_id, due_date, status)
         select s.organization_id, s.id, (now() at time zone 'Europe/Budapest')::date + k * 7, 'open'
           from recurring_schedules s cross join generate_series(-3, 10) k where s.owner_kind = 'family'`,
      );
      const monday = await mondayAfter(db, 0);
      const [waterWeek] = await publishWeeks(db, [{ monday, family: FAMILY_1 }]);
      await insertSchedule(db, {
        id: uuid(96100),
        kind: "rota_week",
        job: "water_carrying",
        interval: 4,
      });
      // The water week's duty card and its bottle-cleaning occurrence (the line the card shows).
      await db.query(
        `insert into tasks (id, organization_id, title, category, capacity, starts_at, ends_at, origin_kind, origin_id)
         values ($1, $2, 'Vízhordás', 'rota', 1, now(), now() + interval '1 hour', 'rota_week', $3)`,
        [DUTY_CARD, ORGANIZATION, waterWeek],
      );
      await db.query(
        `insert into recurring_occurrences (organization_id, schedule_id, due_date, status, rota_week_id)
         values ($1, $2, $3::date, 'open', $4)`,
        [ORGANIZATION, uuid(96100), monday, waterWeek],
      );
      for (const id of MARK_IDS) {
        await db.query(
          `insert into recurring_occurrences (id, organization_id, schedule_id, due_date, status)
           select $1, organization_id, id, $3::date, 'open' from recurring_schedules where id = $2`,
          [id, generated(1), await dayOffset(db, 400 + MARK_IDS.indexOf(id))],
        );
      }
      await db.query("analyze");
    });
    after(async () => {
      await db.end();
    });

    const calls = recurringCalls(() => db, schema);

    async function timed(label: string, ceiling: number, work: (run: number) => Promise<unknown>) {
      await work(0);
      const times: number[] = [];
      for (let run = 1; run <= RUNS; run += 1) {
        const started = performance.now();
        await work(run);
        times.push(performance.now() - started);
      }
      times.sort((a, b) => a - b);
      const median = times[Math.floor(RUNS / 2)]!;
      report(
        `${label} in ${schema}: median ${median.toFixed(1)} ms, worst ${times[RUNS - 1]!.toFixed(1)} ms (fails above ${ceiling} ms)`,
      );
      assert.ok(median < ceiling, `${label}: median ${median.toFixed(0)} ms`);
    }

    it("reads the group page, the family page and a duty card within 2 seconds (NFR9.1)", async () => {
      await timed("recurring_list_for_group", 2000, async () => {
        const result = await calls.fn(PARENT_F1, "recurring_list_for_group($1)", [GROUP_1]);
        assert.equal(result.state, "success");
      });
      await timed("recurring_my_occurrences", 2000, async () => {
        const result = await calls.fn(PARENT_F1, "recurring_my_occurrences()");
        assert.equal(result.state, "success");
      });
      await timed("recurring_occurrence_get", 2000, async () => {
        const result = await calls.fn(PARENT_F1, "recurring_occurrence_get($1)", [MARK_IDS[0]]);
        assert.equal(result.state, "success");
      });
      await timed("recurring_bottle_for_duty (duty card)", 2000, async () => {
        const result = await calls.fn(PARENT_F1, "recurring_bottle_for_duty($1)", [DUTY_CARD]);
        assert.equal(result.state, "success", JSON.stringify(result));
      });
    });

    it("saves a schedule and marks a duty done within 2 seconds, the save making today's occurrence (NFR9.1)", async () => {
      await timed("recurring_schedule_save (new)", 2000, async () => {
        const result = await calls.save(ADMIN_G1, {
          kind: "group",
          group: GROUP_1,
          key: nextKey("t"),
          start: await dayOffset(db, 0),
        });
        assert.equal(result.state, "success", JSON.stringify(result));
      });
      await timed("recurring_schedule_save (change)", 2000, async (run) => {
        const result = await calls.save(ADMIN_G1, {
          id: generated(2),
          version: run + 1,
          kind: "group",
          group: GROUP_1,
          title: `Átírt ${run}`,
          interval: 1 + run,
          start: await dayOffset(db, 0),
        });
        assert.equal(result.state, "success", JSON.stringify(result));
      });
      await timed("recurring_occurrence_mark_done", 2000, async (run) => {
        const result = await calls.done(PARENT_F1, MARK_IDS[run]!, 1);
        assert.equal(result.state, "success", JSON.stringify(result));
      });
    });
  });
}
