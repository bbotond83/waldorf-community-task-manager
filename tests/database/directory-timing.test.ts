import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type pg from "pg";
import { DATASET, DATASET_GROUPS, datasetFamily, datasetTask, loadDataset } from "./dataset.ts";
import {
  ADMIN_G1,
  asActor,
  authenticated,
  callFunction,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  GROUP_1,
  nextKey,
  openDirectoryDatabase,
  ORGANIZATION,
  PARENT_F1,
  seedDirectoryWorld,
  SUPER_ADMIN,
  TEACHER_G1,
  uuid,
} from "./directory-support.ts";
import { count } from "./identity-support.ts";
import { report } from "./stack-support.ts";

const TYPICAL = { read: 300, action: 500, dashboard: 500 } as const;
const CEILING_MS = 1500;
const RUNS = 9;
const COMMUNITY_TASKS = 60;

/**
 * Timings of the main reads and actions on the 150-family data set (NFR3.5, NFR4.6 to NFR4.9): reported against
 * the typical targets, failing above the 1500 ms ceiling, and the access-check overhead of U2 re-run with its
 * 200 ms ceiling.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`directory timings in ${schema}`, () => {
    let db: pg.Client;
    let freshTask = "";

    before(async () => {
      db = await openDirectoryDatabase(schema);
      await seedDirectoryWorld(db, schema);
      await loadDataset(db);
      // Community-wide tasks and events on top of the data set (NFR9.1, NFR9.2): they widen every list below.
      await db.query(
        `insert into events (organization_id, title, starts_at, ends_at)
         select $1, 'Közös esemény ' || n, now() + (n || ' days')::interval, now() + (n || ' days')::interval + interval '2 hours'
           from generate_series(1, 20) n`,
        [ORGANIZATION],
      );
      await db.query(
        `insert into tasks (organization_id, title, capacity, starts_at, ends_at, location)
         select $1, 'Közös feladat ' || n, 8, now() + ((n % 60 + 1) || ' days')::interval, now() + ((n % 60 + 1) || ' days')::interval + interval '2 hours', 'Udvar'
           from generate_series(1, ${COMMUNITY_TASKS}) n`,
        [ORGANIZATION],
      );
      await db.query("analyze");
      // Two tasks of group 1 (index 0 of the data set) that family 1 has no place on.
      freshTask = datasetTask(0);
    });
    after(async () => {
      await db.end();
    });

    /** Median of several runs of one call, in milliseconds; reported against its typical target. */
    async function timed(
      label: string,
      typical: number,
      work: () => Promise<unknown>,
    ): Promise<number> {
      // One warm-up call that is not measured: the first call of a function in a new connection pays for
      // plan and cache loading, which says nothing about the steady state a person meets (the measured
      // runs below still all have to stay under the ceiling).
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
        `${label} in ${schema}: median ${median.toFixed(1)} ms, worst ${times[RUNS - 1]!.toFixed(1)} ms (typical target ${typical} ms, fails above ${CEILING_MS} ms)`,
      );
      assert.ok(times[RUNS - 1]! < CEILING_MS, `${label}: ${times[RUNS - 1]!.toFixed(0)} ms`);
      return median;
    }
    const fn = (account: string, sql: string, values: unknown[] = []) =>
      callFunction(db, schema, account, sql, values);
    const taskVersion = async (id: string) =>
      (await db.query("select version from tasks where id = $1", [id])).rows[0].version as number;

    it("holds the data set of the stated size", async () => {
      assert.equal(
        await count(db, "families", `display_name like 'Adat család%'`),
        DATASET.families,
      );
      assert.equal(await count(db, "tasks", `title like 'Adat feladat%'`), DATASET.tasks);
      assert.equal(await count(db, "assignments", `source = 'admin_assign'`), DATASET.assignments);
      assert.equal(DATASET_GROUPS.length, DATASET.groups);
      assert.equal(await count(db, "group_memberships", `parent_id = '${uuid(4000)}'`), 1);
    });

    it("lists a parent's tasks and opens one within the read targets (NFR4.6)", async () => {
      const list = await fn(PARENT_F1, "duty_list()");
      assert.equal(list.state, "success");
      assert.ok(
        (list.items as unknown[]).length >= DATASET.tasks + COMMUNITY_TASKS,
        "every task of the community, the community-wide ones included (BR4.1)",
      );
      await timed("parent task list", TYPICAL.read, () => fn(PARENT_F1, "duty_list()"));
      await timed("parent task detail", TYPICAL.read, () =>
        fn(PARENT_F1, "duty_get($1)", [freshTask]),
      );
    });

    it("reads the teacher schedule of a group within the read target (NFR4.6)", async () => {
      const schedule = await fn(TEACHER_G1, "schedule_get('group', $1, null, null)", [GROUP_1]);
      assert.equal(schedule.state, "success");
      assert.ok((schedule.items as unknown[]).length >= 30);
      await timed("teacher schedule", TYPICAL.read, () =>
        fn(TEACHER_G1, "schedule_get('group', $1, null, null)", [GROUP_1]),
      );
    });

    it("reads the whole community, the community-wide items, the working groups and the family names within the ceiling (NFR9.1, NFR9.2)", async () => {
      const whole = await fn(TEACHER_G1, "schedule_get('all', null, null, null)");
      assert.ok((whole.items as unknown[]).length >= DATASET.tasks + COMMUNITY_TASKS);
      await timed("teacher schedule, whole community", TYPICAL.read, () =>
        fn(TEACHER_G1, "schedule_get('all', null, null, null)"),
      );
      const communityWide = await fn(TEACHER_G1, "schedule_get('community', null, null, null)");
      assert.equal((communityWide.items as unknown[]).length >= COMMUNITY_TASKS, true);
      await timed("teacher schedule, community-wide", TYPICAL.read, () =>
        fn(TEACHER_G1, "schedule_get('community', null, null, null)"),
      );
      await timed("working-group list", TYPICAL.read, () => fn(PARENT_F1, "working_group_list()"));
      await timed("family name list", TYPICAL.read, () => fn(ADMIN_G1, "family_name_list()"));
      await timed("super admin task list", TYPICAL.read, () =>
        asActor(
          db,
          schema,
          authenticated(SUPER_ADMIN),
          async () => (await db.query("select * from tasks")).rows.length,
        ),
      );
    });

    it("reads the admin lists as a group admin through the policies (NFR4.6)", async () => {
      for (const table of ["families", "tasks", "assignments"]) {
        await timed(`admin list of ${table}`, TYPICAL.read, () =>
          asActor(
            db,
            schema,
            authenticated(ADMIN_G1),
            async () => (await db.query(`select * from ${table}`)).rows.length,
          ),
        );
      }
    });

    it("signs up, requests and decides a swap, and cancels within the action targets (NFR4.7)", async () => {
      const signedUp = await timed("sign-up", TYPICAL.action, async () => {
        // each run signs the family up for a new task, then the work is undone as the owner
        await db.query("delete from assignments where family_id = $1", [FAMILY_1]);
        return fn(PARENT_F1, "duty_sign_up($1, $2, $3)", [
          nextKey("t"),
          freshTask,
          await taskVersion(freshTask),
        ]);
      });
      assert.ok(signedUp >= 0);
      await db.query("delete from assignments where family_id = $1", [FAMILY_1]);
      await db.query("delete from change_requests");
      const mine = await fn(PARENT_F1, "duty_sign_up($1, $2, $3)", [
        nextKey("m"),
        freshTask,
        await taskVersion(freshTask),
      ]);
      assert.equal(mine.state, "success");
      const candidates = await fn(PARENT_F1, "swap_candidates($1)", [mine.reference]);
      const partner = (
        candidates.items as { assignment_id: string; assignment_version: number }[]
      )[0]!;
      await timed("swap partner list", TYPICAL.read, () =>
        fn(PARENT_F1, "swap_candidates($1)", [mine.reference]),
      );
      let lastRequest: { state: string; code: string | null } | undefined;
      const requested = await timed("swap request", TYPICAL.action, async () => {
        await db.query("update change_requests set status = 'withdrawn'");
        await db.query("update assignments set status = 'active' where id = $1", [mine.reference]);
        const own = (
          await db.query("select version from assignments where id = $1", [mine.reference])
        ).rows[0].version;
        lastRequest = await fn(PARENT_F1, "swap_request($1, $2, $3, $4, $5)", [
          nextKey("sw"),
          mine.reference,
          own,
          partner.assignment_id,
          partner.assignment_version,
        ]);
        return lastRequest;
      });
      assert.ok(requested >= 0);
      assert.equal(lastRequest?.state, "success", JSON.stringify(lastRequest));
      const open = (await db.query("select id from change_requests where status = 'open'")).rows[0]
        .id as string;
      // The partner may hold a place in any working group now (BR4.3), so a super admin decides.
      const decided = await fn(SUPER_ADMIN, "swap_decide($1, $2, true, null)", [
        nextKey("sd"),
        open,
      ]);
      assert.equal(decided.state, "success");
      await timed("approval decision", TYPICAL.action, async () => {
        const mineNow = (
          await db.query(
            "select id, version from assignments where family_id = $1 and status = 'active' limit 1",
            [FAMILY_1],
          )
        ).rows[0];
        await db.query("update change_requests set status = 'withdrawn' where status = 'open'");
        const cancelled = await fn(PARENT_F1, "cancellation_request($1, $2, $3, null)", [
          nextKey("cn"),
          mineNow.id,
          mineNow.version,
        ]);
        return fn(SUPER_ADMIN, "cancellation_decide($1, $2, false, null)", [
          nextKey("cd"),
          cancelled.reference,
        ]);
      });
    });

    it("saves records, tasks and settings within the action targets (NFR4.7)", async () => {
      await timed("family save", TYPICAL.action, async () => {
        const version = (
          await db.query("select version from families where id = $1", [datasetFamily(1)])
        ).rows[0].version;
        return fn(SUPER_ADMIN, "directory_save($1, $2::jsonb)", [
          nextKey("ds"),
          JSON.stringify({
            family_id: datasetFamily(1),
            expected_version: version,
            display_name: "Adat család 1",
          }),
        ]);
      });
      await timed("task save", TYPICAL.action, async () => {
        const task = datasetTask(5);
        const version = await taskVersion(task);
        const row = (
          await db.query("select group_id, title, starts_at, ends_at from tasks where id = $1", [
            task,
          ])
        ).rows[0];
        return fn(SUPER_ADMIN, "task_save($1, $2::jsonb)", [
          nextKey("ts"),
          JSON.stringify({
            id: task,
            expected_version: version,
            group_id: row.group_id,
            title: row.title,
            capacity: 8,
            starts_at: row.starts_at,
            ends_at: row.ends_at,
          }),
        ]);
      });
      await timed("settings save", TYPICAL.action, async () => {
        const settings = await fn(SUPER_ADMIN, "settings_get()");
        return fn(SUPER_ADMIN, "settings_save($1, $2, true, 'duty')", [
          nextKey("st"),
          settings.version,
        ]);
      });
    });

    it("counts the dashboard and lists the lifecycle within their targets (NFR4.8)", async () => {
      await db.query(
        "update families set status = 'archived', archived_at = now() - interval '60 days' where display_name like 'Adat család %' and id <> $1",
        [datasetFamily(0)],
      );
      const list = await fn(SUPER_ADMIN, "lifecycle_list(null)");
      assert.equal(list.state, "success");
      assert.ok((list.items as unknown[]).length >= DATASET.families - 1);
      await timed("dashboard", TYPICAL.dashboard, () => fn(SUPER_ADMIN, "dashboard_get()"));
      await timed("lifecycle list", TYPICAL.dashboard, () =>
        fn(SUPER_ADMIN, "lifecycle_list(null)"),
      );
    });

    it("keeps the access-check overhead of U2 under its 200 ms ceiling on the data set (NFR4.9)", async () => {
      const median = async (sql: string) => {
        const times: number[] = [];
        for (let run = 0; run < 30; run += 1) {
          const started = performance.now();
          await asActor(db, schema, authenticated(ADMIN_G1), () => db.query(sql));
          times.push(performance.now() - started);
        }
        return times.sort((a, b) => a - b)[15]!;
      };
      const plain = await median("select count(*) from families");
      const checked = await median(
        "select count(*) from families where current_session_is_active() and directory_reaches_family(organization_id, id)",
      );
      report(
        `access checks in ${schema}: median ${plain.toFixed(2)} ms plain, ${checked.toFixed(2)} ms with extra checks, overhead ${(checked - plain).toFixed(2)} ms (target 50 ms, fails above 200 ms)`,
      );
      assert.ok(checked - plain < 200);
    });
  });
}
