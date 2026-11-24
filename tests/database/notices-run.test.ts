import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  asActor,
  authenticated,
  FAMILY_1,
  FAMILY_2,
  FAMILY_NO_GROUP,
  openDirectoryDatabase,
  ORGANIZATION,
  PARENT_F1,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  seedCoordinationWorld,
  SUPER_ADMIN,
  TASK_1,
  TASK_2,
  TASK_3,
  TEACHER_G1,
} from "./directory-support.ts";
import {
  insertDelivery,
  insertJob,
  insertNotification,
  NOTIFICATION_SCHEMAS,
} from "./notifications-support.ts";
import { bindSchema, failureOf, openDatabase } from "./stack-support.ts";

type Check = {
  check: string;
  outcome: string;
  created: number;
  skipped: number;
  error_code: string | null;
};
type Run = { state: string; code: string | null; reference: string; checks: Check[] };

const SERVICE = { role: "service_role" as const };

/**
 * The timed run on the real stack: one function call runs every registered check of its kind in `lock_step` then name
 * order, each in its own sub-block, and writes one run record and one record per check (BR52). The duty-reminder check
 * moves each due job once and creates the notices; housekeeping prunes by age and never decides what is due, so
 * pruning can never cause a resend (NFR1.7).
 *
 * The fixed list: allowed; refused; out of reach; outdated screen (not meaningful: the run is called by the timer, not
 * from a screen, and takes no version); repeated click (the second run on one day, BR52.5); two at once.
 */
for (const schema of NOTIFICATION_SCHEMAS) {
  describe(`the timed run in ${schema}`, () => {
    let db: pg.Client;
    let second: pg.Client;

    before(async () => {
      db = await openDirectoryDatabase(schema);
      second = await openDatabase();
      await bindSchema(second, schema);
    });
    after(async () => {
      await db.end();
      await second.end();
    });
    beforeEach(async () => {
      await seedCoordinationWorld(db, schema);
    });

    const run = (kind = "daily", client: pg.Client = db) =>
      asActor(client, schema, SERVICE, async () => {
        const result = await client.query("select timed_checks_run_system($1) as result", [kind]);
        return result.rows[0].result as Run;
      });
    const count = async (table: string, where = "true") =>
      (await db.query(`select count(*)::int as n from ${table} where ${where}`)).rows[0]
        .n as number;
    /** A due job for a task and a threshold, naming the family as its recipient. */
    async function job(task: string, threshold: "7d" | "24h", family = FAMILY_1) {
      const id = await insertJob(db, { task, threshold });
      await db.query(
        "update reminder_jobs set task_starts_at = (select starts_at from tasks where id = $2) where id = $1",
        [id, task],
      );
      await db.query(
        "insert into reminder_recipients (organization_id, reminder_job_id, family_id) values ($1, $2, $3)",
        [ORGANIZATION, id, family],
      );
      return id;
    }
    const status = async (id: string) =>
      (await db.query("select status from reminder_jobs where id = $1", [id])).rows[0]
        .status as string;
    const reminders = (answer: Run) =>
      answer.checks.find((check) => check.check === "duty_reminders")!;
    const activeParents = async (family: string) =>
      (
        await db.query(
          `select count(*)::int as n from parents p join accounts a on a.id = p.account_id
            where p.family_id = $1 and p.status = 'active' and a.status = 'active'`,
          [family],
        )
      ).rows[0].n as number;

    it("allowed: the daily run sends each due job once, creates a notice and an email for each active parent, and records the run and its checks (BR52.1, BR52.2)", async () => {
      const first = await job(TASK_1, "7d", FAMILY_1);
      const other = await job(TASK_3, "24h", FAMILY_2);
      const answer = await run();
      assert.equal(answer.state, "success");
      assert.deepEqual(
        answer.checks.map((check) => [check.check, check.outcome]),
        [
          // U8's two animal-care checks: the empty-slot warnings and the monthly fair-share reminder.
          ["animal_empty_slots", "success"],
          ["animal_fair_share", "success"],
          // U11's two checks: the unclaimed-task alert and the lead-time notice.
          ["checklist_unclaimed_alert", "success"],
          ["duty_reminders", "success"],
          ["event_lead_notice", "success"],
          ["housekeeping", "success"],
          // The lending library's daily return reminder (U13) and the checks of the rota unit (U6), registered in the
          // same run.
          ["library_return_due", "success"],
          // The recurring duties' daily check (U9).
          ["recurring_duties", "success"],
          ["rota_week_reminder", "success"],
          ["swap_expiry", "success"],
          ["weekend_picks_reminder", "success"],
        ],
      );
      assert.equal(reminders(answer).created, 2);
      assert.equal(await status(first), "sent");
      assert.equal(await status(other), "sent");
      const expected = (await activeParents(FAMILY_1)) + (await activeParents(FAMILY_2));
      assert.equal(
        await count("notifications", "kind in ('reminder_7d', 'reminder_24h')"),
        expected,
      );
      assert.equal(await count("email_deliveries", "status = 'queued'"), expected);
      const titles = (
        await db.query("select kind, reminder_job_id from notifications order by kind, parent_id")
      ).rows;
      assert.ok(titles.every((row) => [first, other].includes(row.reminder_job_id)));
      assert.equal(await count("timed_runs", "run_kind = 'daily' and finished_at is not null"), 1);
      assert.deepEqual(
        (
          await db.query(
            "select check_name, outcome, created from timed_check_runs order by check_name",
          )
        ).rows,
        [
          { check_name: "animal_empty_slots", outcome: "success", created: 0 },
          { check_name: "animal_fair_share", outcome: "success", created: 0 },
          { check_name: "checklist_unclaimed_alert", outcome: "success", created: 0 },
          { check_name: "duty_reminders", outcome: "success", created: 2 },
          { check_name: "event_lead_notice", outcome: "success", created: 0 },
          { check_name: "housekeeping", outcome: "success", created: 0 },
          { check_name: "library_return_due", outcome: "success", created: 0 },
          { check_name: "recurring_duties", outcome: "success", created: 0 },
          { check_name: "rota_week_reminder", outcome: "success", created: 0 },
          { check_name: "swap_expiry", outcome: "success", created: 0 },
          { check_name: "weekend_picks_reminder", outcome: "success", created: 0 },
        ],
      );
    });

    it("allowed: a 24-hour job supersedes the 7-day job of the same task, a moved task makes its job stale and a task that has started cancels it (BR53.2)", async () => {
      const week = await job(TASK_1, "7d");
      const day = await job(TASK_1, "24h");
      const moved = await job(TASK_2, "24h");
      await db.query(
        "update tasks set starts_at = starts_at + interval '1 day', ends_at = ends_at + interval '1 day' where id = $1",
        [TASK_2],
      );
      const started = await job(TASK_3, "24h", FAMILY_2);
      await db.query(
        "update tasks set starts_at = now() - interval '1 hour', ends_at = now() + interval '1 hour' where id = $1",
        [TASK_3],
      );
      const answer = await run();
      assert.equal(reminders(answer).created, 1, "only the 24-hour job of the first task is sent");
      assert.equal(reminders(answer).skipped, 3);
      assert.deepEqual(
        [await status(week), await status(day), await status(moved), await status(started)],
        ["skipped", "sent", "stale", "cancelled"],
      );
    });

    it("refused: no application role can run the checks, and a run kind that is not registered is a validation error (NFR3.1)", async () => {
      for (const actor of [
        { role: "anon" as const },
        authenticated(PARENT_F1),
        authenticated(TEACHER_G1),
        authenticated(ADMIN_G1),
        authenticated(SUPER_ADMIN),
      ]) {
        const error = await failureOf(() =>
          asActor(db, schema, actor, () => db.query("select timed_checks_run_system('daily')")),
        );
        assert.equal(error?.code, "42501", actor.role);
      }
      assert.equal(await count("timed_runs"), 0, "nothing was recorded");
      for (const kind of ["weekly", ""]) {
        const answer = await run(kind);
        assert.deepEqual([answer.state, answer.code], ["validation", "run_kind_invalid"]);
      }
      assert.equal(await count("timed_runs"), 0, "a refused run leaves no record");
    });

    it("friday_noon: runs the checks registered for it (U6's alert only) and still leaves a run record (BR52.2)", async () => {
      const answer = await run("friday_noon");
      assert.equal(answer.state, "success");
      assert.deepEqual(
        answer.checks.map((check) => [check.check, check.outcome, check.created]),
        [["weekend_picks_alert", "success", 0]],
      );
      assert.equal(await count("timed_runs", "run_kind = 'friday_noon'"), 1);
    });

    it("every check runs in its own block, in lock_step then name order: a failing and a missing check are recorded and the rest still run (BR52.2, NFR5.7)", async () => {
      await db.query(
        `create function test_ok_check(p_now timestamptz) returns jsonb language sql as $$ select '{"created": 0, "skipped": 0}'::jsonb $$;
         create function test_broken_check(p_now timestamptz) returns jsonb language plpgsql as $$ begin
           insert into notifications (id) values (null); return '{}'::jsonb; end $$`,
      );
      try {
        await db.query(
          `insert into timed_check_registry (check_name, function_name, run_kind, lock_step, added_by) values
             ('zz_step1', 'test_ok_check', 'daily', 1, 'test'),
             ('aa_step4', 'test_ok_check', 'daily', 4, 'test'),
             ('broken_step2', 'test_broken_check', 'daily', 2, 'test'),
             ('missing_step3', 'test_no_such_function', 'daily', 3, 'test')`,
        );
        const dueJob = await job(TASK_1, "7d");
        const answer = await run();
        assert.equal(answer.state, "success", "one failing check does not fail the run");
        assert.deepEqual(
          answer.checks.map((check) => [check.check, check.outcome]),
          [
            ["zz_step1", "success"],
            ["broken_step2", "failed"],
            ["missing_step3", "missing"],
            ["aa_step4", "success"],
            ["animal_empty_slots", "success"],
            ["animal_fair_share", "success"],
            ["checklist_unclaimed_alert", "success"],
            ["duty_reminders", "success"],
            ["event_lead_notice", "success"],
            ["housekeeping", "success"],
            ["library_return_due", "success"],
            ["recurring_duties", "success"],
            ["rota_week_reminder", "success"],
            ["swap_expiry", "success"],
            ["weekend_picks_reminder", "success"],
          ],
        );
        const broken = answer.checks.find((check) => check.check === "broken_step2")!;
        assert.equal(broken.error_code, "23502", "only the error class is kept");
        assert.equal(
          await status(dueJob),
          "sent",
          "the reminder check still ran after the failure",
        );
        const stored = JSON.stringify((await db.query("select * from timed_check_runs")).rows);
        assert.equal(
          /null value|violates|notifications/.test(stored),
          false,
          "no database message is kept",
        );
      } finally {
        await db.query("delete from timed_check_registry where added_by = 'test'");
        await db.query(
          "drop function if exists test_ok_check(timestamptz), test_broken_check(timestamptz)",
        );
      }
    });

    it("a check record is written once: it cannot be changed afterwards (BR52.7)", async () => {
      await run();
      const error = await failureOf(() =>
        db.query("update timed_check_runs set outcome = 'failed'"),
      );
      assert.equal(error?.code, "23514");
      assert.equal(await count("timed_check_runs", "outcome <> 'success'"), 0);
    });

    it("out of reach: a job whose family has no parent with an account sends no notice and no email, and a job of a family nobody belongs to is still decided (BR50.1)", async () => {
      const lonely = await job(TASK_1, "7d", FAMILY_NO_GROUP);
      const answer = await run();
      assert.equal(await status(lonely), "sent");
      assert.equal(reminders(answer).created, 1);
      assert.equal(await count("notifications"), 0);
      assert.equal(await count("email_deliveries"), 0);
    });

    it("repeated click: the second run on one day creates nothing more, and a job that was already decided is not decided again (BR52.5)", async () => {
      await job(TASK_1, "7d");
      const first = await run();
      assert.equal(reminders(first).created, 1);
      const notices = await count("notifications");
      const second = await run();
      assert.equal(reminders(second).created, 0);
      assert.equal(reminders(second).skipped, 0);
      assert.equal(await count("notifications"), notices);
      assert.equal(await count("timed_runs"), 2, "every run is recorded");
    });

    it("two at once: two overlapping runs send each job and notice once, with no deadlock, over repeated rounds (NFR5.3, NFR5.4, NFR5.7)", async () => {
      for (let round = 0; round < 5; round += 1) {
        await db.query(
          "truncate reminder_recipients, reminder_jobs, email_deliveries, notifications cascade",
        );
        const jobs = [
          await job(TASK_1, "7d", FAMILY_1),
          await job(TASK_1, "24h", FAMILY_2),
          await job(TASK_2, "7d", FAMILY_1),
          await job(TASK_3, "24h", FAMILY_2),
        ];
        const answers = await Promise.all([run("daily", db), run("daily", second)]);
        assert.ok(answers.every((answer) => answer.state === "success"));
        assert.ok(
          answers.every((answer) => answer.checks.every((check) => check.outcome === "success")),
        );
        const total = answers.reduce((sum, answer) => sum + reminders(answer).created, 0);
        assert.equal(
          total,
          3,
          `round ${round}: each job decided once (one of the four is skipped)`,
        );
        for (const id of jobs) assert.ok(["sent", "skipped"].includes(await status(id)));
        const duplicates = (
          await db.query(
            "select count(*)::int as n from (select dedupe_key from notifications group by dedupe_key having count(*) > 1) x",
          )
        ).rows[0].n;
        assert.equal(duplicates, 0, "no notice twice");
        assert.equal(
          await count("email_deliveries"),
          await count("notifications"),
          "one email per notice",
        );
      }
    });

    it("housekeeping prunes deliveries and tries 90 days after they finish and run and check records after 30 days, and the next run creates no new notice (BR52.8, NFR1.5, NFR1.7)", async () => {
      await job(TASK_1, "7d");
      await run();
      const notices = await count("notifications");
      assert.ok(notices > 0);
      const notice = await insertNotification(db, { parent: PARENT_ROW_F1, key: "old-1" });
      const noticeNew = await insertNotification(db, { parent: PARENT_ROW_F2, key: "old-2" });
      const old = await insertDelivery(db, {
        notice,
        parent: PARENT_ROW_F1,
        status: "sent",
        attempts: 1,
      });
      const recent = await insertDelivery(db, {
        notice: noticeNew,
        parent: PARENT_ROW_F2,
        status: "failed",
      });
      await db.query(
        "insert into email_attempts (delivery_id, round, attempt_number, outcome) values ($1, 1, 1, 'sent')",
        [old],
      );
      // The run moment is moved 31 days on: the first email finished 60 days before now (91 days at that moment),
      // the second 50 days before (81 days), and the records of the run above are 31 days old.
      await db.query(
        "update email_deliveries set finished_at = now() - interval '60 days' where id = $1",
        [old],
      );
      await db.query(
        "update email_deliveries set finished_at = now() - interval '50 days' where id = $1",
        [recent],
      );
      const pruned = (
        await db.query("select housekeeping_due_check(now() + interval '31 days') as r")
      ).rows[0].r as {
        deleted_deliveries: number;
      };
      assert.equal(pruned.deleted_deliveries, 1);
      assert.equal(await count("email_deliveries", `id = '${old}'`), 0, "the old email is pruned");
      assert.equal(
        await count("email_attempts", `delivery_id = '${old}'`),
        0,
        "and its tries with it",
      );
      assert.equal(await count("email_deliveries", `id = '${recent}'`), 1, "a younger one is kept");
      assert.equal(
        await count("timed_check_runs"),
        0,
        "the check records of the first run are pruned",
      );
      assert.equal(await count("timed_runs"), 0, "and the run record with them");
      const again = await run();
      assert.equal(reminders(again).created, 0);
      assert.equal(
        await count("notifications", "kind in ('reminder_7d', 'reminder_24h')"),
        notices,
        "pruning created no notice",
      );
    });
  });
}
