import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type pg from "pg";
import {
  DATASET,
  datasetTask,
  loadDataset,
  loadNotificationDataset,
  NOTIFICATION_DATASET,
} from "./dataset.ts";
import {
  ADMIN_G1,
  asActor,
  authenticated,
  callFunction,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  nextKey,
  openDirectoryDatabase,
  PARENT_F1,
  PARENT_ROW_F1,
  seedDirectoryWorld,
  SUPER_ADMIN,
} from "./directory-support.ts";
import { asServiceRole, count } from "./identity-support.ts";
import { report } from "./stack-support.ts";

const TYPICAL = { read: 300, action: 500 } as const;
const CEILING_MS = 1500;
const RUNS = 9;
const SECONDS = (milliseconds: number) => (milliseconds / 1000).toFixed(2);

/**
 * Timings of the database side of Notifications (U4, reworked in U5) on the 300-task data set with 3000 notifications and 600 reminder jobs
 * (NFR3.12, NFR4.12 to NFR4.15), reported against the typical targets and failing above their ceilings. The
 * timings of U3's use cases and of U2's access checks are also re-run here with U4's tables and hooks present;
 * `directory-timing.test.ts` of U3 runs the same checks again as part of the directory suite (NFR4.14, NFR4.15).
 * A warm-up call precedes every measurement and no ceiling is relaxed.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`notification timings in ${schema}`, () => {
    let db: pg.Client;

    before(async () => {
      db = await openDirectoryDatabase(schema);
      await seedDirectoryWorld(db, schema);
      await loadDataset(db);
      await loadNotificationDataset(db, PARENT_ROW_F1);
      await db.query("analyze");
    });
    after(async () => {
      await db.end();
    });

    /** Median of several runs of one call after one warm-up call, reported against its typical target. */
    async function timed(
      label: string,
      typical: number,
      work: () => Promise<unknown>,
      ceiling = CEILING_MS,
    ): Promise<number> {
      await work();
      const times: number[] = [];
      for (let run = 0; run < RUNS; run += 1) {
        const started = performance.now();
        await work();
        times.push(performance.now() - started);
      }
      times.sort((a, b) => a - b);
      const median = times[Math.floor(RUNS / 2)]!;
      report(
        `${label} in ${schema}: median ${median.toFixed(1)} ms, worst ${times[RUNS - 1]!.toFixed(1)} ms (typical target ${typical} ms, fails above ${ceiling} ms)`,
      );
      assert.ok(times[RUNS - 1]! < ceiling, `${label}: ${times[RUNS - 1]!.toFixed(0)} ms`);
      return median;
    }
    const fn = (account: string, sql: string, values: unknown[] = []) =>
      callFunction(db, schema, account, sql, values);

    it("holds the data set of the stated size (NFR3.12)", async () => {
      assert.equal(await count(db, "notifications"), NOTIFICATION_DATASET.notifications);
      assert.equal(
        await count(db, "notifications", `parent_id = '${PARENT_ROW_F1}'`),
        NOTIFICATION_DATASET.heavyParent,
      );
      assert.equal(await count(db, "reminder_jobs"), NOTIFICATION_DATASET.jobs);
      assert.equal(
        await count(
          db,
          "reminder_jobs",
          "status = 'queued' and due_on <= (now() at time zone 'Europe/Budapest')::date",
        ),
        600,
      );
      assert.equal(await count(db, "reminder_recipients"), DATASET.tasks * 2 * 5);
      assert.equal(await count(db, "tasks", `title like 'Adat feladat%'`), DATASET.tasks);
    });

    it("lists a parent's notifications, marks one read and lists the reminders within the read targets (NFR4.12)", async () => {
      const list = await fn(PARENT_F1, "notification_list()");
      assert.equal(list.state, "success");
      assert.equal((list.items as unknown[]).length, 50, "the list is one page of the 50 newest");
      await timed("notification list of the busiest parent", TYPICAL.read, () =>
        fn(PARENT_F1, "notification_list()"),
      );
      const first = (list.items as { id: string }[])[0]!.id;
      await timed("mark as read", TYPICAL.read, () =>
        fn(PARENT_F1, "notification_mark_read($1)", [first]),
      );
      const problems = await fn(SUPER_ADMIN, "delivery_problems_list()");
      assert.equal(problems.state, "success");
      await timed("delivery problems list of a super admin", TYPICAL.read, () =>
        fn(SUPER_ADMIN, "delivery_problems_list()"),
      );
      const refused = await fn(ADMIN_G1, "delivery_problems_list()");
      assert.equal(refused.state, "denied");
      await timed("dashboard", TYPICAL.action, () => fn(SUPER_ADMIN, "dashboard_get()"));
    });

    it("runs the daily checks on 600 due jobs within the 30-second ceiling, and the list stays within the read target afterwards (NFR9.4)", async () => {
      const started = performance.now();
      const run = await asActor(db, schema, asServiceRole, async () => {
        const result = await db.query("select timed_checks_run_system('daily') as result");
        return result.rows[0].result as {
          state: string;
          checks: { check: string; created: number; outcome: string }[];
        };
      });
      const elapsed = performance.now() - started;
      assert.equal(run.state, "success");
      assert.deepEqual(
        run.checks.map((check) => check.outcome),
        Array(11).fill("success"),
        "all eleven daily checks ran without failing (the two animal-care checks come first, then the nine of the earlier units)",
      );
      report(
        `daily run on ${NOTIFICATION_DATASET.jobs} due jobs in ${schema}: ${SECONDS(elapsed)} s (fails above 30 s)`,
      );
      assert.ok(elapsed < 30_000, `the daily run took ${elapsed.toFixed(0)} ms`);
      assert.equal(
        await count(db, "reminder_jobs", "status = 'queued'"),
        0,
        "every due job was decided",
      );
      assert.ok((await count(db, "reminder_jobs", "status = 'sent'")) > 0);
      const again = await asActor(db, schema, asServiceRole, async () => {
        const result = await db.query("select timed_checks_run_system('daily') as result");
        return result.rows[0].result as { checks: { check: string; created: number }[] };
      });
      const reminders = again.checks.find((check) => check.check === "duty_reminders");
      assert.equal(reminders?.created, 0, "a second run on the same day has nothing to do");
      await timed("notification list after the run", TYPICAL.read, () =>
        fn(PARENT_F1, "notification_list()"),
      );
    });

    it("keeps U3's use cases within their targets with the notice and job writes added (NFR4.14)", async () => {
      // The parent's family signs up for a task each run: a place, a notice and the jobs.
      const task = datasetTask(0);
      await timed("sign-up with notice and job writes", TYPICAL.action, async () => {
        await db.query("delete from assignments where family_id = $1", [FAMILY_1]);
        const version = (await db.query("select version from tasks where id = $1", [task])).rows[0]
          .version;
        const result = await fn(PARENT_F1, "duty_sign_up($1, $2, $3)", [
          nextKey("t"),
          task,
          version,
        ]);
        assert.equal(result.state, "success");
        return result;
      });
      await timed("task save with the reminder planner", TYPICAL.action, async () => {
        const row = (
          await db.query(
            "select group_id, title, starts_at, ends_at, version from tasks where id = $1",
            [datasetTask(5)],
          )
        ).rows[0];
        const saved = await fn(SUPER_ADMIN, "task_save($1, $2::jsonb)", [
          nextKey("ts"),
          JSON.stringify({
            id: datasetTask(5),
            expected_version: row.version,
            group_id: row.group_id,
            title: row.title,
            capacity: 8,
            starts_at: row.starts_at,
            ends_at: row.ends_at,
          }),
        ]);
        assert.equal(saved.state, "success");
        return saved;
      });
    });

    it("keeps the access-check overhead under its 200 ms ceiling with U4's tables and policies on the data set (NFR4.15)", async () => {
      const median = async (account: string, sql: string) => {
        const times: number[] = [];
        for (let run = 0; run < 30; run += 1) {
          const started = performance.now();
          await asActor(db, schema, authenticated(account), () => db.query(sql));
          times.push(performance.now() - started);
        }
        return times.sort((a, b) => a - b)[15]!;
      };
      const plain = await median(PARENT_F1, "select count(*) from notifications");
      const checked = await median(
        PARENT_F1,
        "select count(*) from notifications where current_session_is_active() and parent_id = (select notification_actor_parent())",
      );
      report(
        `access checks of U4's tables in ${schema}: notifications ${plain.toFixed(2)} ms plain, ${checked.toFixed(2)} ms checked (overhead target 50 ms, fails above 200 ms)`,
      );
      assert.ok(checked - plain < 200, `the overhead was ${(checked - plain).toFixed(1)} ms`);
    });

    it("answers the notice list and the failure list in under 2 seconds on 10,000 deliveries, and every lookup uses its index (NFR9.1, NFR9.6)", async () => {
      // 10,000 more notices of the busiest parent's community, each with a delivery: mostly finished, some queued,
      // some claimed and 300 failed, spread over the dataset's tasks so the failure groups are many.
      await db.query(
        `insert into notifications (organization_id, parent_id, kind, target_type, target_ref, task_id, task_starts_at, dedupe_key)
         select t.organization_id, $1::uuid, 'sign_up_confirmed', 'task', t.id, t.id, t.starts_at, 'index-' || n
           from generate_series(1, 10000) n
           join tasks t on t.id = ('cccccccc-0000-4000-8000-' || lpad((3000 + n % ${DATASET.tasks})::text, 12, '0'))::uuid`,
        [PARENT_ROW_F1],
      );
      await db.query(
        `insert into email_deliveries (organization_id, notice_id, parent_id, kind, target_type, target_id, item_date, status,
                                       round, attempts_in_round, next_attempt_at, claimed_at, last_attempt_at, finished_at)
         select n.organization_id, n.id, n.parent_id, n.kind, n.target_type, n.target_ref, current_date,
                s.status, 1, s.attempts, now() - interval '1 hour',
                case when s.status = 'sending' then now() - interval '5 minutes' end,
                case when s.attempts > 0 then now() end,
                case when s.status in ('sent', 'failed') then now() end
           from (select n.*, row_number() over (order by n.id) as r from notifications n where n.dedupe_key like 'index-%') n
           cross join lateral (select case when n.r <= 300 then 'failed' when n.r <= 600 then 'queued'
                                           when n.r <= 700 then 'sending' else 'sent' end as status,
                                      case when n.r <= 300 then 3 when n.r <= 600 then 0 when n.r <= 700 then 1 else 1 end as attempts) s`,
      );
      await db.query("analyze");
      await timed("notice list with 13,000 notices", TYPICAL.read, () =>
        fn(PARENT_F1, "notification_list()"),
      );
      const problems = await fn(SUPER_ADMIN, "delivery_problems_list()");
      assert.equal(problems.state, "success");
      assert.ok((problems.groups as unknown[]).length > 0);
      await timed("failure list on 10,000 deliveries", TYPICAL.read, () =>
        fn(SUPER_ADMIN, "delivery_problems_list()"),
      );
      // With sequential scans switched off, each lookup the functions make must still be answered by its index.
      await db.query("set enable_seqscan = off");
      try {
        const lookups: [string, string][] = [
          [
            "email_deliveries_due",
            "select id from email_deliveries d where d.status in ('queued', 'retry_wait') and d.next_attempt_at <= now() order by d.next_attempt_at, d.id limit 10",
          ],
          [
            "email_deliveries_claimed",
            "select id from email_deliveries d where d.status = 'sending' and d.claimed_at < now() - interval '10 minutes' order by d.id",
          ],
          [
            "email_deliveries_failed_group",
            "select d.kind, d.target_type, d.target_id, count(*) from email_deliveries d where d.status = 'failed' group by d.kind, d.target_type, d.target_id",
          ],
          [
            "email_deliveries_parent",
            `select id from email_deliveries d where d.parent_id = '${PARENT_ROW_F1}'`,
          ],
          [
            "reminder_jobs_due",
            "select id from reminder_jobs j where j.status = 'queued' and j.due_on <= current_date order by j.id",
          ],
        ];
        for (const [index, sql] of lookups) {
          const plan = (await db.query(`explain ${sql}`)).rows
            .map((row) => row["QUERY PLAN"])
            .join("\n");
          assert.ok(plan.includes(index), `${index} answers its lookup:\n${plan}`);
          assert.equal(/Seq Scan/.test(plan), false, `no sequential scan for ${index}`);
        }
      } finally {
        await db.query("reset enable_seqscan");
      }
    });
  });
}
