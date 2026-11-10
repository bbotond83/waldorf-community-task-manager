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
import { count } from "./identity-support.ts";
import { report } from "./stack-support.ts";

const TYPICAL = { read: 300, action: 500 } as const;
const CEILING_MS = 1500;
const RUNS = 9;
const SECONDS = (milliseconds: number) => (milliseconds / 1000).toFixed(2);

/**
 * Timings of the database side of U4 on the 300-task data set with 3000 notifications and 600 reminder jobs
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
        await count(db, "reminder_jobs", "status = 'queued' and scheduled_for < now()"),
        600,
      );
      assert.equal(await count(db, "reminder_recipients"), DATASET.tasks * 2 * 5);
      assert.equal(await count(db, "tasks", `title like 'Adat feladat%'`), DATASET.tasks);
    });

    it("lists a parent's notifications, marks one read and lists the reminders within the read targets (NFR4.12)", async () => {
      const list = await fn(PARENT_F1, "notification_list()");
      assert.equal(list.state, "success");
      assert.equal((list.items as unknown[]).length, NOTIFICATION_DATASET.heavyParent);
      await timed("notification list of the busiest parent", TYPICAL.read, () =>
        fn(PARENT_F1, "notification_list()"),
      );
      const first = (list.items as { id: string }[])[0]!.id;
      await timed("mark as read", TYPICAL.read, () =>
        fn(PARENT_F1, "notification_mark_read($1)", [first]),
      );
      const reminders = await fn(SUPER_ADMIN, "reminder_list(null)");
      assert.equal((reminders.items as unknown[]).length, NOTIFICATION_DATASET.jobs);
      await timed("reminders list of a super admin", TYPICAL.read, () =>
        fn(SUPER_ADMIN, "reminder_list(null)"),
      );
      await timed("reminders list of a group admin", TYPICAL.read, () =>
        fn(ADMIN_G1, "reminder_list('queued')"),
      );
      await timed("dashboard", TYPICAL.action, () => fn(SUPER_ADMIN, "dashboard_get()"));
    });

    it("runs the tick on 600 due jobs within its ceiling, and the list stays within the read target afterwards (NFR4.13)", async () => {
      const started = performance.now();
      const tick = await fn(PARENT_F1, "reminder_run_due()");
      const elapsed = performance.now() - started;
      assert.equal(tick.state, "success");
      assert.equal(tick.run, NOTIFICATION_DATASET.jobs);
      report(
        `reminder tick on ${NOTIFICATION_DATASET.jobs} due jobs in ${schema}: ${SECONDS(elapsed)} s (typical target 2 s, fails above 10 s)`,
      );
      assert.ok(elapsed < 10_000, `the tick took ${elapsed.toFixed(0)} ms`);
      assert.equal(await count(db, "reminder_jobs", "status = 'sent'"), NOTIFICATION_DATASET.jobs);
      assert.equal(await count(db, "reminder_attempts"), NOTIFICATION_DATASET.jobs);
      const again = await fn(PARENT_F1, "reminder_run_due()");
      assert.equal(again.run, 0, "a second tick has nothing to do");
      await timed("notification list after the tick", TYPICAL.read, () =>
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
  });
}
