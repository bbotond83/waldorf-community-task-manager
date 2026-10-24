import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  ADMIN_G2,
  asActor,
  authenticated,
  callFunction,
  CO_PARENT_F1,
  FAMILY_1,
  FAMILY_2,
  FAMILY_NO_GROUP,
  GROUP_1,
  nextKey,
  OTHER_ADMIN,
  OUTSIDER,
  ORGANIZATION,
  OTHER_ORGANIZATION,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_CO,
  PARENT_ROW_DEACTIVATED,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  PARENT_ROW_SIGNED_OUT,
  REQUEST_1,
  seedCoordinationWorld,
  SIGNED_OUT,
  SUPER_ADMIN,
  TASK_1,
  TASK_2,
  TASK_3,
  TEACHER_G1,
  uuid,
  ASSIGNMENT_F1_T1,
  ASSIGNMENT_F2_T3,
  openDirectoryDatabase,
} from "./directory-support.ts";
import { insertJob, insertNotification, NOTIFICATION_SCHEMAS } from "./notifications-support.ts";
import { failureOf, openDatabase } from "./stack-support.ts";

type Item = {
  id: string;
  title: string;
  link: string;
  is_read: boolean;
  timing: string;
  provider_status: string;
};

type Job = {
  id: string;
  threshold: string;
  status: string;
  attempt: number;
  version: number;
};

/**
 * Notification and reminder functions on the real stack: the parent's list and mark-as-read, the planner,
 * the simulated tick, the admin's list and retry, and the callers of each (BR40.2 to BR40.8, NFR6.21,
 * NFR6.22, NFR3.14).
 */
for (const schema of NOTIFICATION_SCHEMAS) {
  describe(`notification and reminder functions in ${schema}`, () => {
    let db: pg.Client;
    const extra: pg.Client[] = [];

    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await Promise.all(extra.map((client) => client.end()));
      await db.end();
    });
    beforeEach(async () => {
      await seedCoordinationWorld(db, schema);
    });

    const call = (account: string, sql: string, values: unknown[] = []) =>
      callFunction(db, schema, account, sql, values);
    const items = async (account: string) =>
      (await call(account, "notification_list()")).items as Item[];
    const plan = (task: string) => db.query("select reminder_plan($1)", [task]);
    const jobsOf = async (task: string): Promise<Job[]> =>
      (
        await db.query(
          "select id, threshold, status, attempt, version from reminder_jobs where task_id = $1 order by threshold, created_at",
          [task],
        )
      ).rows as Job[];
    const live = async (task: string) =>
      (await jobsOf(task)).filter((job) => !["stale", "cancelled"].includes(job.status));
    const recipients = async (job: string, status = "active") =>
      (
        await db.query(
          "select family_id from reminder_recipients where reminder_job_id = $1 and status = $2 order by family_id",
          [job, status],
        )
      ).rows.map((row) => row.family_id as string);
    const makeDue = (task: string) =>
      db.query(
        "update reminder_jobs set scheduled_for = now() - interval '1 minute' where task_id = $1 and status in ('queued', 'retrying')",
        [task],
      );
    const runTick = (account = PARENT_F1) => call(account, "reminder_run_due()");
    const noticeCount = async (parent: string, kind?: string) =>
      (
        await db.query(
          "select count(*)::int as n from notifications where parent_id = $1 and ($2::text is null or kind = $2)",
          [parent, kind ?? null],
        )
      ).rows[0].n as number;

    it("lists only the signed-in parent's own notifications, newest first, with Hungarian titles and links (BR40.2)", async () => {
      assert.deepEqual(await items(PARENT_F1), [], "the empty state");
      const older = await insertNotification(db, {
        parent: PARENT_ROW_F1,
        task: TASK_1,
        target: TASK_1,
        createdAt: "2026-01-01T10:00:00Z",
      });
      const newer = await insertNotification(db, {
        parent: PARENT_ROW_F1,
        kind: "place_removed",
        task: TASK_2,
        target: TASK_2,
        createdAt: "2026-01-02T10:00:00Z",
      });
      await insertNotification(db, { parent: PARENT_ROW_CO, task: TASK_1, target: TASK_1 });
      await insertNotification(db, { parent: PARENT_ROW_F2, task: TASK_3, target: TASK_3 });
      const own = await items(PARENT_F1);
      assert.deepEqual(
        own.map((item) => item.id),
        [newer, older],
      );
      assert.equal(own[0]!.title, "A helyed törölve: Kerti munka");
      assert.equal(own[0]!.link, `/szulo/feladatok/${TASK_2}`);
      assert.equal(own[1]!.title, "Jelentkezés megerősítve: Sütés");
      assert.equal(own[1]!.is_read, false);
      assert.equal((await items(PARENT_F2)).length, 1);
      assert.equal((await items(CO_PARENT_F1)).length, 1);
      for (const account of [SUPER_ADMIN, ADMIN_G1, TEACHER_G1, OUTSIDER]) {
        assert.deepEqual(
          await items(account),
          [],
          `${account} has no linked parent: the empty state`,
        );
      }
      const signedOut = await call(SIGNED_OUT, "notification_list()");
      assert.deepEqual([signedOut.state, signedOut.code], ["denied", "session_inactive"]);
    });

    it("maps every kind to its title and link, and a decision to the outcome of its request (BR40.2)", async () => {
      await db.query(
        "update change_requests set kind = 'swap', target_assignment_id = $2, target_task_id = $3, target_assignment_version = 1 where id = $1",
        [REQUEST_1, ASSIGNMENT_F2_T3, TASK_3],
      );
      const decide = (status: string) =>
        db.query(
          "update change_requests set status = $1, decided_by_account_id = $2, decided_at = now() where id = $3",
          [status, SUPER_ADMIN, REQUEST_1],
        );
      const notice = (kind: string) =>
        insertNotification(db, {
          parent: PARENT_ROW_F1,
          kind,
          targetType: "change_request",
          target: REQUEST_1,
          task: TASK_1,
        });
      const titleOf = async (id: string) =>
        (await items(PARENT_F1)).find((item) => item.id === id)!;
      const requested = await notice("swap_requested");
      const swapDecided = await notice("swap_decided");
      const cancellationDecided = await notice("cancellation_decided");
      assert.equal((await titleOf(requested)).title, "Cserekérés érkezett: Sütés");
      assert.equal((await titleOf(requested)).link, "/szulo/cserek");
      assert.equal(
        (await titleOf(swapDecided)).title,
        "Csere döntés: Sütés",
        "an undecided request",
      );
      await decide("approved");
      assert.equal((await titleOf(swapDecided)).title, "Csere jóváhagyva: Sütés");
      assert.equal((await titleOf(cancellationDecided)).title, "Lemondás jóváhagyva: Sütés");
      await db.query("update change_requests set status = 'applied' where id = $1", [REQUEST_1]);
      assert.equal((await titleOf(swapDecided)).title, "Csere jóváhagyva: Sütés");
      await db.query("update change_requests set status = 'withdrawn' where id = $1", [REQUEST_1]);
      assert.equal(
        (await titleOf(swapDecided)).title,
        "Csere elutasítva: Sütés",
        "a declined swap",
      );
      assert.equal(
        (await titleOf(swapDecided)).timing,
        "within-threshold",
        "a decision is not cancelled by its request's end",
      );
      await decide("rejected");
      assert.equal((await titleOf(cancellationDecided)).title, "Lemondás elutasítva: Sütés");
      assert.equal((await titleOf(cancellationDecided)).link, "/szulo/cserek");
      for (const reminder of [
        ["reminder_7d", "Egy hét múlva: Sütés"],
        ["reminder_24h", "Holnap: Sütés"],
      ] as const) {
        const job = await insertJob(db, {
          task: TASK_1,
          threshold: reminder[0] === "reminder_7d" ? "7d" : "24h",
          status: "sent",
          startsAt: undefined,
        });
        await db.query(
          "update reminder_jobs set task_starts_at = (select starts_at from tasks where id = $2) where id = $1",
          [job, TASK_1],
        );
        const id = await insertNotification(db, {
          parent: PARENT_ROW_F1,
          kind: reminder[0],
          task: TASK_1,
          target: TASK_1,
          job,
        });
        await db.query(
          "update notifications set task_starts_at = (select starts_at from tasks where id = $2) where id = $1",
          [id, TASK_1],
        );
        const found = (await items(PARENT_F1)).find((item) => item.id === id)!;
        assert.equal(found.title, reminder[1]);
        assert.equal(found.link, `/szulo/feladatok/${TASK_1}`);
        assert.equal(found.timing, reminder[0] === "reminder_7d" ? "7-day" : "24-hour");
        assert.equal(found.provider_status, "simulated-sent");
        await db.query("delete from notifications where id = $1", [id]);
        await db.query("delete from reminder_jobs where id = $1", [job]);
      }
    });

    it("maps timing and provider status for event notices and for every job status (BR40.2)", async () => {
      const event = await insertNotification(db, {
        parent: PARENT_ROW_F1,
        task: TASK_1,
        target: TASK_1,
      });
      const one = async (id: string) => (await items(PARENT_F1)).find((item) => item.id === id)!;
      assert.deepEqual(
        [(await one(event)).timing, (await one(event)).provider_status],
        ["within-threshold", "simulated-sent"],
      );
      await db.query("update tasks set status = 'cancelled' where id = $1", [TASK_1]);
      assert.equal((await one(event)).timing, "cancelled", "the task is cancelled");
      await db.query("update tasks set status = 'open' where id = $1", [TASK_1]);

      // A swap request that was withdrawn reads as cancelled, a request that was applied does not.
      await db.query("update change_requests set status = 'withdrawn' where id = $1", [REQUEST_1]);
      const swapNotice = await insertNotification(db, {
        parent: PARENT_ROW_F1,
        kind: "swap_requested",
        targetType: "change_request",
        target: REQUEST_1,
        task: TASK_1,
      });
      assert.equal((await one(swapNotice)).timing, "cancelled");
      await db.query("update change_requests set status = 'open' where id = $1", [REQUEST_1]);
      assert.equal((await one(swapNotice)).timing, "within-threshold");

      const expectations: [string, string, string][] = [
        ["sent", "simulated-sent", "24-hour"],
        ["queued", "simulated-retry", "24-hour"],
        ["retryable", "simulated-retry", "24-hour"],
        ["retrying", "simulated-retry", "24-hour"],
        ["terminal", "simulated-cancelled", "24-hour"],
        ["stale", "simulated-cancelled", "stale"],
        ["cancelled", "simulated-cancelled", "cancelled"],
      ];
      for (const [status, provider, timing] of expectations) {
        await db.query("delete from notifications where kind = 'reminder_24h'");
        await db.query("delete from reminder_jobs");
        const job = await insertJob(db, { task: TASK_1, status });
        const id = await insertNotification(db, {
          parent: PARENT_ROW_F1,
          kind: "reminder_24h",
          task: TASK_1,
          target: TASK_1,
          job,
        });
        await db.query(
          "update notifications set task_starts_at = (select starts_at from tasks where id = $2) where id = $1",
          [id, TASK_1],
        );
        const found = await one(id);
        assert.deepEqual([found.provider_status, found.timing], [provider, timing], status);
      }
      // A moved start makes a reminder stale even while its job still says sent.
      await db.query("delete from notifications");
      await db.query("delete from reminder_jobs");
      const sent = await insertJob(db, { task: TASK_1, status: "sent" });
      const reminder = await insertNotification(db, {
        parent: PARENT_ROW_F1,
        kind: "reminder_7d",
        task: TASK_1,
        target: TASK_1,
        job: sent,
      });
      await db.query(
        "update notifications set task_starts_at = (select starts_at from tasks where id = $2) where id = $1",
        [reminder, TASK_1],
      );
      await db.query(
        "update tasks set starts_at = starts_at + interval '2 hours', ends_at = ends_at + interval '2 hours' where id = $1",
        [TASK_1],
      );
      assert.equal((await one(reminder)).timing, "stale");
    });

    it("marks a notification read once, keeps the first time, and denies another parent's or a missing one (BR40.3)", async () => {
      const id = await insertNotification(db, {
        parent: PARENT_ROW_F1,
        task: TASK_1,
        target: TASK_1,
      });
      const foreign = await insertNotification(db, {
        parent: PARENT_ROW_F2,
        task: TASK_3,
        target: TASK_3,
      });
      const first = await call(PARENT_F1, "notification_mark_read($1)", [id]);
      assert.deepEqual(
        [first.state, first.reference, first.link],
        ["success", id, `/szulo/feladatok/${TASK_1}`],
      );
      const readAt = (await db.query("select read_at from notifications where id = $1", [id]))
        .rows[0].read_at as Date;
      assert.ok(readAt);
      const second = await call(PARENT_F1, "notification_mark_read($1)", [id]);
      assert.equal(second.state, "success");
      assert.equal(
        (
          (await db.query("select read_at from notifications where id = $1", [id])).rows[0]
            .read_at as Date
        ).getTime(),
        readAt.getTime(),
        "a repeat keeps the first time",
      );
      assert.equal((await items(PARENT_F1))[0]!.is_read, true);
      for (const [account, target] of [
        [PARENT_F1, foreign],
        [CO_PARENT_F1, id],
        [SUPER_ADMIN, id],
        [PARENT_F1, uuid(9999)],
      ] as const) {
        const denied = await call(account, "notification_mark_read($1)", [target]);
        assert.deepEqual(
          [denied.state, denied.code],
          ["denied", "authorization_denied"],
          `${account} ${target}`,
        );
      }
      assert.equal(
        (await db.query("select read_at from notifications where id = $1", [foreign])).rows[0]
          .read_at,
        null,
        "another parent's notice was not changed",
      );
      assert.equal(
        (await call(SIGNED_OUT, "notification_mark_read($1)", [id])).code,
        "session_inactive",
      );
    });

    it("plans a 7-day and a 24-hour job for the families of the task, once, and a second plan changes nothing (BR40.4)", async () => {
      await plan(TASK_1);
      const jobs = await live(TASK_1);
      assert.deepEqual(
        jobs.map((job) => job.threshold),
        ["24h", "7d"],
      );
      for (const job of jobs) {
        assert.equal(job.status, "queued");
        assert.deepEqual(await recipients(job.id), [FAMILY_1]);
      }
      const times = (
        await db.query(
          `select threshold, scheduled_for = task_starts_at - (case threshold when '7d' then interval '168 hours' else interval '24 hours' end) as exact,
                  task_starts_at = (select starts_at from tasks where id = task_id) as start_matches, correlation_id
             from reminder_jobs where task_id = $1 order by threshold`,
          [TASK_1],
        )
      ).rows;
      assert.deepEqual(
        times.map((row) => [row.exact, row.start_matches]),
        [
          [true, true],
          [true, true],
        ],
      );
      assert.match(times[0].correlation_id as string, /^[0-9a-f]{12}$/);
      assert.equal(String(times[0].correlation_id).includes(FAMILY_1), false);
      const before = (await db.query("select id, version from reminder_jobs order by id")).rows;
      await plan(TASK_1);
      await plan(TASK_1);
      assert.deepEqual(
        (await db.query("select id, version from reminder_jobs order by id")).rows,
        before,
      );
      assert.equal(
        (await db.query("select count(*)::int as n from reminder_recipients")).rows[0].n,
        2,
      );
    });

    it("plans from instants only: across the spring and the autumn clock change the offsets stay exactly 168 and 24 hours (BR40.4, N4)", async () => {
      // Budapest moves its clocks on the last Sunday of March and October. A task on such a Sunday, planned a
      // week and a day ahead, would be an hour off if the offsets were computed on local clock times.
      for (const [start, label] of [
        ["2027-03-28 12:00:00+02", "spring forward (2027-03-28)"],
        ["2027-10-31 08:00:00+01", "fall back (2027-10-31)"],
        ["2027-03-29 01:30:00+02", "the day after the change"],
      ] as const) {
        await db.query("delete from reminder_recipients");
        await db.query("delete from reminder_jobs");
        await db.query(
          "update tasks set starts_at = $2::timestamptz, ends_at = $2::timestamptz + interval '2 hours' where id = $1",
          [TASK_1, start],
        );
        await plan(TASK_1);
        const rows = (
          await db.query(
            `select threshold,
                    extract(epoch from (task_starts_at - scheduled_for))::int as seconds_before
               from reminder_jobs where task_id = $1 order by threshold`,
            [TASK_1],
          )
        ).rows;
        assert.deepEqual(
          rows.map((row) => [row.threshold, row.seconds_before]),
          [
            ["24h", 24 * 3600],
            ["7d", 168 * 3600],
          ],
          label,
        );
      }
    });

    it("creates a missed threshold immediately and once, and plans nothing for a started, closed or cancelled task (BR40.4, N2)", async () => {
      await db.query(
        "update tasks set starts_at = now() + interval '20 hours', ends_at = now() + interval '22 hours' where id = $1",
        [TASK_1],
      );
      await plan(TASK_1);
      const due = (
        await db.query(
          "select threshold, scheduled_for <= now() as immediate from reminder_jobs where task_id = $1 order by threshold",
          [TASK_1],
        )
      ).rows;
      assert.deepEqual(
        due.map((row) => [row.threshold, row.immediate]),
        [
          ["24h", true],
          ["7d", true],
        ],
      );
      await plan(TASK_1);
      assert.equal((await jobsOf(TASK_1)).length, 2, "once");
      // The same task, now started, closed or cancelled, has none; a started task's queued jobs are cancelled.
      for (const [set, label] of [
        ["starts_at = now() - interval '1 hour'", "started"],
        ["starts_at = now() + interval '5 days', status = 'closed'", "closed"],
        ["status = 'cancelled'", "cancelled"],
      ] as const) {
        await db.query("delete from reminder_recipients");
        await db.query("delete from reminder_jobs");
        await db.query(
          "update tasks set status = 'open', starts_at = now() + interval '5 days', ends_at = now() + interval '5 days 2 hours' where id = $1",
          [TASK_1],
        );
        await plan(TASK_1);
        assert.equal((await live(TASK_1)).length, 2, `${label}: planned while open`);
        await db.query(`update tasks set ${set} where id = $1`, [TASK_1]);
        await plan(TASK_1);
        assert.equal((await live(TASK_1)).length, 0, `${label}: its queued jobs are cancelled`);
        await plan(TASK_1);
        assert.equal(
          (await jobsOf(TASK_1)).filter((job) => job.status === "queued").length,
          0,
          label,
        );
      }
    });

    it("follows the reminder setting: off cancels the jobs, on plans them again, the scope picks the recipient families (BR40.4, BR40.5)", async () => {
      await db.query(
        "insert into reminder_settings (organization_id, enabled, recipient_scope) values ($1, false, 'duty')",
        [ORGANIZATION],
      );
      await plan(TASK_1);
      assert.equal((await jobsOf(TASK_1)).length, 0, "switched off: no job is planned");
      await db.query("update reminder_settings set enabled = true where organization_id = $1", [
        ORGANIZATION,
      ]);
      await plan(TASK_1);
      const [job24] = await live(TASK_1);
      assert.deepEqual(
        await recipients(job24!.id),
        [FAMILY_1],
        "duty: the family that holds the place",
      );
      await db.query("update reminder_settings set enabled = false where organization_id = $1", [
        ORGANIZATION,
      ]);
      await plan(TASK_1);
      assert.equal((await live(TASK_1)).length, 0, "switched off again: live jobs are cancelled");
      assert.ok((await jobsOf(TASK_1)).every((job) => job.status === "cancelled"));
      // Group scope: every active family of the task's group, with or without a place.
      await db.query(
        "update reminder_settings set enabled = true, recipient_scope = 'group' where organization_id = $1",
        [ORGANIZATION],
      );
      await db.query(
        "insert into group_memberships (organization_id, family_id, group_id) values ($1, $2, $3)",
        [ORGANIZATION, FAMILY_NO_GROUP, GROUP_1],
      );
      await plan(TASK_1);
      const grouped = await live(TASK_1);
      assert.deepEqual(await recipients(grouped[0]!.id), [FAMILY_1, FAMILY_NO_GROUP].sort());
      // Back to duty: the extra family becomes removed, and it stays as history.
      await db.query(
        "update reminder_settings set recipient_scope = 'duty' where organization_id = $1",
        [ORGANIZATION],
      );
      await plan(TASK_1);
      assert.deepEqual(await recipients(grouped[0]!.id), [FAMILY_1]);
      assert.deepEqual(await recipients(grouped[0]!.id, "removed"), [FAMILY_NO_GROUP]);
      // The only place goes: the job has no active recipient and is cancelled; no new job is planned.
      await db.query("update assignments set status = 'removed' where id = $1", [ASSIGNMENT_F1_T1]);
      await plan(TASK_1);
      assert.equal((await live(TASK_1)).length, 0);
      await plan(TASK_1);
      assert.equal((await live(TASK_1)).length, 0);
    });

    it("makes the old job stale and plans a new one when the start changes, even after the old one was sent (BR40.5, N6)", async () => {
      await plan(TASK_1);
      const [old24, old7] = await live(TASK_1);
      await db.query("update reminder_jobs set status = 'sent', attempt = 1 where id = $1", [
        old24!.id,
      ]);
      await db.query(
        "update tasks set starts_at = starts_at + interval '1 day', ends_at = ends_at + interval '1 day' where id = $1",
        [TASK_1],
      );
      await plan(TASK_1);
      const after = await jobsOf(TASK_1);
      assert.equal(after.filter((job) => job.status === "stale").length, 2);
      const fresh = after.filter((job) => !["stale", "cancelled"].includes(job.status));
      assert.deepEqual(
        fresh.map((job) => job.status),
        ["queued", "queued"],
      );
      assert.ok(fresh.every((job) => ![old24!.id, old7!.id].includes(job.id)));
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from reminder_jobs j join tasks t on t.id = j.task_id where j.status = 'queued' and j.task_starts_at = t.starts_at",
          )
        ).rows[0].n,
        2,
      );
    });

    it("runs a due job once: success, an attempt, one in-app notice per linked parent and no duplicates on a repeat (BR40.6, NFR6.22)", async () => {
      // A second family on the task whose only parent has no sign-in account gets no notice.
      const lonely = uuid(9400);
      await db.query(
        "insert into families (id, organization_id, display_name) values ($1, $2, 'Magányos család')",
        [lonely, ORGANIZATION],
      );
      await db.query(
        "insert into group_memberships (organization_id, family_id, group_id) values ($1, $2, $3)",
        [ORGANIZATION, lonely, GROUP_1],
      );
      await db.query(
        "insert into parents (organization_id, family_id, display_name) values ($1, $2, 'Magányos Márta')",
        [ORGANIZATION, lonely],
      );
      await db.query(
        "insert into assignments (organization_id, task_id, family_id, source) values ($1, $2, $3, 'admin_assign')",
        [ORGANIZATION, TASK_1, lonely],
      );
      await plan(TASK_1);
      const notDue = await runTick();
      assert.deepEqual([notDue.state, notDue.run], ["success", 0], "nothing is due yet");
      await makeDue(TASK_1);
      const tick = await runTick();
      assert.deepEqual([tick.state, tick.run, tick.sent, tick.failed], ["success", 2, 2, 0]);
      assert.deepEqual(
        (await jobsOf(TASK_1)).map((job) => [job.status, job.attempt]),
        [
          ["sent", 1],
          ["sent", 1],
        ],
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from reminder_attempts where outcome = 'simulated_sent'",
          )
        ).rows[0].n,
        2,
      );
      for (const parent of [
        PARENT_ROW_F1,
        PARENT_ROW_CO,
        PARENT_ROW_DEACTIVATED,
        PARENT_ROW_SIGNED_OUT,
      ]) {
        assert.equal(await noticeCount(parent, "reminder_7d"), 1, `${parent} 7d`);
        assert.equal(await noticeCount(parent, "reminder_24h"), 1, `${parent} 24h`);
      }
      assert.equal(await noticeCount(PARENT_ROW_F2), 0, "a family without a place gets nothing");
      assert.equal(
        (await db.query("select count(*)::int as n from notifications")).rows[0].n,
        8,
        "the unlinked parent got none",
      );
      const mine = (await items(PARENT_F1)).filter(
        (item) => item.title.startsWith("Egy hét") || item.title.startsWith("Holnap"),
      );
      assert.deepEqual(
        mine.map((item) => [item.timing, item.provider_status]).sort(),
        [
          ["24-hour", "simulated-sent"],
          ["7-day", "simulated-sent"],
        ].sort(),
      );
      const again = await runTick();
      assert.deepEqual(
        [again.run, (await db.query("select count(*)::int as n from notifications")).rows[0].n],
        [0, 8],
      );
      assert.equal(
        (await db.query("select count(*)::int as n from reminder_attempts")).rows[0].n,
        2,
      );
    });

    it("fails a delivery up to three times, creates the notices at the first run even when it failed, and ends terminal (BR40.6, BR40.7)", async () => {
      await plan(TASK_1);
      // Only the 24-hour job is followed here: the 7-day job is cancelled.
      await db.query(
        "update reminder_jobs set status = 'cancelled' where task_id = $1 and threshold = '7d'",
        [TASK_1],
      );
      await makeDue(TASK_1);
      // The test seam: the database session asks the simulated delivery to fail (never an application role).
      const tickFailing = () =>
        asActor(db, schema, authenticated(PARENT_F1), async () => {
          await db.query("select set_config('app.reminder_simulate', 'fail', true)");
          return (await db.query("select reminder_run_due() as result")).rows[0].result as Record<
            string,
            unknown
          >;
        });
      const retry = async () => {
        const [job] = await jobsOf(TASK_1);
        return call(ADMIN_G1, "reminder_retry($1, $2, $3)", [
          nextKey("retry"),
          job!.id,
          job!.version,
        ]);
      };
      assert.equal((await tickFailing()).failed, 1);
      let [job] = await jobsOf(TASK_1);
      assert.deepEqual([job!.status, job!.attempt], ["retryable", 1]);
      assert.equal(
        await noticeCount(PARENT_ROW_F1, "reminder_24h"),
        1,
        "the notice exists although the first attempt failed",
      );
      assert.equal((await retry()).state, "success");
      [job] = await jobsOf(TASK_1);
      assert.equal(job!.status, "retrying");
      assert.equal((await tickFailing()).failed, 1);
      [job] = await jobsOf(TASK_1);
      assert.deepEqual([job!.status, job!.attempt], ["retryable", 2]);
      assert.equal((await retry()).state, "success");
      await tickFailing();
      [job] = await jobsOf(TASK_1);
      assert.deepEqual([job!.status, job!.attempt], ["terminal", 3]);
      assert.deepEqual(
        (
          await db.query(
            "select attempt_number, outcome from reminder_attempts order by attempt_number",
          )
        ).rows,
        [
          { attempt_number: 1, outcome: "simulated_retry" },
          { attempt_number: 2, outcome: "simulated_retry" },
          { attempt_number: 3, outcome: "simulated_failed" },
        ],
      );
      assert.equal(
        await noticeCount(PARENT_ROW_F1, "reminder_24h"),
        1,
        "no second notice for the retries",
      );
      const noMore = await retry();
      assert.deepEqual([noMore.state, noMore.code], ["conflict", "REMINDER_NOT_RETRYABLE"]);
      assert.equal((await runTick()).run, 0, "a terminal job never runs again");
      const shown = (await items(PARENT_F1)).find((item) => item.title.startsWith("Holnap"))!;
      assert.equal(shown.provider_status, "simulated-cancelled");
    });

    it("answers a retry with the stored codes: not retryable, stale version, denied outside reach, unknown job, and a repeated key (BR40.7, NFR6.20, NFR6.21)", async () => {
      await plan(TASK_1);
      const [job] = await live(TASK_1);
      const retry = (account: string, id: string, version: number | null, key = nextKey("r")) =>
        call(account, "reminder_retry($1, $2, $3)", [key, id, version]);
      const queued = await retry(ADMIN_G1, job!.id, job!.version);
      assert.deepEqual([queued.state, queued.code], ["conflict", "REMINDER_NOT_RETRYABLE"]);
      await db.query("update reminder_jobs set status = 'retryable', attempt = 1 where id = $1", [
        job!.id,
      ]);
      const version = (await jobsOf(TASK_1)).find((entry) => entry.id === job!.id)!.version;
      const stale = await retry(ADMIN_G1, job!.id, version - 1);
      assert.deepEqual([stale.state, stale.code], ["invalidated", "REMINDER_STALE"]);
      for (const account of [PARENT_F1, TEACHER_G1, ADMIN_G2, OTHER_ADMIN, SIGNED_OUT]) {
        const denied = await retry(account, job!.id, version);
        assert.ok(["denied", "validation"].includes(denied.state), `${account}: ${denied.state}`);
        assert.notEqual(denied.state, "success");
      }
      assert.equal(
        (await retry(ADMIN_G2, job!.id, version)).state,
        "denied",
        "a group admin of another group",
      );
      assert.equal((await retry(ADMIN_G1, uuid(9998), version)).code, "reminder_not_found");
      assert.equal((await retry(ADMIN_G1, job!.id, null)).code, "field_invalid");
      assert.equal(
        (await jobsOf(TASK_1)).find((entry) => entry.id === job!.id)!.status,
        "retryable",
        "nothing changed so far",
      );
      const key = nextKey("same");
      const done = await retry(ADMIN_G1, job!.id, version, key);
      assert.deepEqual(
        [done.state, done.status, done.version],
        ["success", "retrying", version + 1],
      );
      const replay = await retry(ADMIN_G1, job!.id, version, key);
      assert.deepEqual([replay.state, replay.code], ["success", "replayed"]);
      const reused = await retry(ADMIN_G1, uuid(9998), version, key);
      assert.equal(reused.code, "idempotency_key_reused");
    });

    it("lists one row per task and threshold with counts only, filtered by status and by the admin's reach (BR40.8, NFR1.57)", async () => {
      await plan(TASK_1);
      await plan(TASK_3);
      await db.query("update tasks set title = $2 where id = $1", [
        TASK_1,
        "<img src=x onerror=alert(1)> Sütés",
      ]);
      await db.query(
        "update reminder_jobs set status = 'stale' where task_id = $1 and threshold = '7d'",
        [TASK_1],
      );
      await plan(TASK_1);
      const listAs = async (account: string, status?: string) =>
        (await call(account, "reminder_list($1)", [status ?? null])).items as Record<
          string,
          unknown
        >[];
      const superRows = await listAs(SUPER_ADMIN);
      assert.equal(
        superRows.length,
        4,
        "one row per task and threshold, the stale one replaced by the live one",
      );
      assert.equal(new Set(superRows.map((row) => `${row.task_id}|${row.threshold}`)).size, 4);
      const row = superRows.find((entry) => entry.task_id === TASK_1 && entry.threshold === "24h")!;
      assert.equal(
        row.title,
        "<img src=x onerror=alert(1)> Sütés — 24 órás emlékeztető",
        "the title is data; escaping is the screen's job",
      );
      assert.equal(row.recipient_summary, "1 kijelölt család");
      assert.equal(row.provider_label, "Szimulált kézbesítés");
      assert.deepEqual([row.status, row.attempt, row.recipient_count], ["queued", 0, 1]);
      const text = JSON.stringify(superRows);
      for (const secret of [
        "Fenyő",
        "Napraforgó",
        "example.test",
        FAMILY_1,
        FAMILY_2,
        PARENT_ROW_F1,
      ]) {
        assert.equal(text.includes(secret), false, `no ${secret} in the list`);
      }
      assert.equal(
        (await listAs(ADMIN_G1)).length,
        2,
        "the group admin reaches the first group only",
      );
      assert.equal((await listAs(ADMIN_G2)).length, 2);
      assert.equal((await listAs(SUPER_ADMIN, "sent")).length, 0);
      await db.query("update reminder_jobs set status = 'sent' where task_id = $1", [TASK_3]);
      assert.equal((await listAs(SUPER_ADMIN, "sent")).length, 2);
      await db.query(
        "update reminder_recipients set status = 'removed' where reminder_job_id in (select id from reminder_jobs where task_id = $1)",
        [TASK_3],
      );
      assert.equal((await listAs(ADMIN_G2, "sent"))[0]!.recipient_summary, "Nincs aktív címzett");
      for (const account of [PARENT_F1, TEACHER_G1, OUTSIDER]) {
        const result = await call(account, "reminder_list($1)", [null]);
        assert.equal(result.state, "denied", account);
      }
      // The super admin of the other organization is an admin there: the list is theirs, and empty.
      const foreignAdmin = await call(OTHER_ADMIN, "reminder_list($1)", [null]);
      assert.deepEqual([foreignAdmin.state, foreignAdmin.items], ["success", []]);
      assert.equal((await call(SIGNED_OUT, "reminder_list($1)", [null])).code, "session_inactive");
      assert.equal(
        (await call(SUPER_ADMIN, "reminder_list($1)", ["paused"])).code,
        "status_invalid",
      );
    });

    it("lets any member tick their own organization, denies another's, and gives the system caller its own function (callers paragraph)", async () => {
      await plan(TASK_1);
      await makeDue(TASK_1);
      const otherOrganization = await call(PARENT_F2, "reminder_run_due($1)", [OTHER_ORGANIZATION]);
      assert.deepEqual(
        [otherOrganization.state, otherOrganization.code],
        ["denied", "authorization_denied"],
      );
      assert.equal(
        (await call(OTHER_ADMIN, "reminder_run_due($1)", [ORGANIZATION])).state,
        "denied",
      );
      assert.equal((await call(SIGNED_OUT, "reminder_run_due()")).code, "session_inactive");
      assert.equal(
        (await db.query("select count(*)::int as n from reminder_attempts")).rows[0].n,
        0,
        "denied ticks recorded nothing",
      );
      const own = await call(PARENT_F2, "reminder_run_due($1)", [ORGANIZATION]);
      assert.deepEqual(
        [own.state, own.run],
        ["success", 2],
        "a parent of another family may tick the organization",
      );
      // The system caller: the service-role key, with an organization; nobody else may execute it.
      await db.query("update reminder_jobs set status = 'queued', attempt = 0 where task_id = $1", [
        TASK_1,
      ]);
      await db.query("delete from reminder_attempts");
      const system = await asActor(
        db,
        schema,
        { role: "service_role" },
        async () =>
          (await db.query("select reminder_run_due_system($1) as result", [ORGANIZATION])).rows[0]
            .result as Record<string, unknown>,
      );
      assert.deepEqual([system.state, system.run], ["success", 2]);
      const unknown = await asActor(
        db,
        schema,
        { role: "service_role" },
        async () =>
          (await db.query("select reminder_run_due_system($1) as result", [uuid(1)])).rows[0]
            .result as Record<string, unknown>,
      );
      assert.equal(unknown.code, "organization_not_found");
      for (const sql of ["select reminder_run_due_system($1)"]) {
        const failure = await failureOf(() =>
          asActor(db, schema, authenticated(SUPER_ADMIN), () => db.query(sql, [ORGANIZATION])),
        );
        assert.equal(
          failure?.code,
          "42501",
          "a signed-in account cannot execute the system function",
        );
      }
      const anon = await failureOf(() =>
        asActor(db, schema, { role: "anon" }, () => db.query("select reminder_run_due()")),
      );
      assert.equal(anon?.code, "42501");
      const serviceMember = await failureOf(() =>
        asActor(db, schema, { role: "service_role" }, () => db.query("select reminder_run_due()")),
      );
      assert.equal(serviceMember?.code, "42501", "the member tick is not for the service role");
    });

    it("drops a due job whose task started, was cancelled or moved, instead of delivering a wrong reminder (BR40.6)", async () => {
      await plan(TASK_1);
      await plan(TASK_3);
      await plan(TASK_2);
      await db.query(
        "insert into assignments (organization_id, task_id, family_id, source) values ($1, $2, $3, 'admin_assign')",
        [ORGANIZATION, TASK_2, FAMILY_1],
      );
      await plan(TASK_2);
      await db.query("update reminder_jobs set scheduled_for = now() - interval '1 minute'");
      await db.query(
        "update tasks set starts_at = now() - interval '1 minute', ends_at = now() + interval '1 hour' where id = $1",
        [TASK_1],
      );
      await db.query("update tasks set status = 'cancelled' where id = $1", [TASK_3]);
      await db.query(
        "update tasks set starts_at = starts_at + interval '3 hours', ends_at = ends_at + interval '3 hours' where id = $1",
        [TASK_2],
      );
      const tick = await runTick();
      assert.deepEqual([tick.run, tick.dropped], [0, 6]);
      assert.ok((await jobsOf(TASK_1)).every((job) => job.status === "cancelled"));
      assert.ok((await jobsOf(TASK_3)).every((job) => job.status === "cancelled"));
      assert.ok((await jobsOf(TASK_2)).every((job) => job.status === "stale"));
      assert.equal((await db.query("select count(*)::int as n from notifications")).rows[0].n, 0);
    });

    it("records exactly one attempt and one notice set per due job when two ticks run at the same time (NFR3.14, NFR6.22)", async () => {
      const second = await openDatabase();
      extra.push(second);
      await second.query(`set search_path to "${schema}", pg_catalog`);
      const tasks: string[] = [];
      for (let index = 0; index < 6; index += 1) {
        const task = uuid(9500 + index);
        tasks.push(task);
        await db.query(
          `insert into tasks (id, organization_id, group_id, title, capacity, starts_at, ends_at, location)
           values ($1, $2, $3, $4, 2, now() + interval '4 days', now() + interval '4 days 2 hours', 'Terem')`,
          [task, ORGANIZATION, GROUP_1, `Párhuzamos ${index}`],
        );
        await db.query(
          "insert into assignments (organization_id, task_id, family_id, source) values ($1, $2, $3, 'admin_assign')",
          [ORGANIZATION, task, FAMILY_1],
        );
        await plan(task);
        await makeDue(task);
      }
      const results = await Promise.all([
        callFunction(db, schema, PARENT_F1, "reminder_run_due()"),
        callFunction(second, schema, PARENT_F2, "reminder_run_due()"),
        callFunction(second, schema, CO_PARENT_F1, "reminder_run_due()"),
      ]);
      assert.ok(results.every((result) => result.state === "success"));
      assert.equal(
        results.reduce((sum, result) => sum + (result.run as number), 0),
        12,
        "each job was run by exactly one tick",
      );
      assert.equal(
        (await db.query("select count(*)::int as n from reminder_attempts")).rows[0].n,
        12,
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from reminder_jobs where status = 'sent' and attempt = 1",
          )
        ).rows[0].n,
        12,
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from notifications where parent_id = $1 and kind in ('reminder_7d', 'reminder_24h')",
            [PARENT_ROW_F1],
          )
        ).rows[0].n,
        12,
      );
      const duplicates = await db.query(
        "select dedupe_key from notifications group by dedupe_key having count(*) > 1",
      );
      assert.equal(duplicates.rowCount, 0);
    });
  });
}
