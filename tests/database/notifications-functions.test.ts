import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  callFunction,
  CO_PARENT_F1,
  FAMILY_1,
  FAMILY_NO_GROUP,
  GROUP_1,
  OUTSIDER,
  ORGANIZATION,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_CO,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
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

type Item = {
  id: string;
  title: string;
  link: string | null;
  is_read: boolean;
  timing: string;
};

type Job = {
  id: string;
  threshold: string;
  status: string;
  version: number;
};

/**
 * Notification and reminder functions on the real stack: the parent's list and mark-as-read and the planner with its
 * due dates (BR40.2 to BR40.5, BR50.4, BR50.5, BR53.1, BR53.2). The daily run, the delivery pass and the failure screen
 * have their own files (notices-*.test.ts).
 */
for (const schema of NOTIFICATION_SCHEMAS) {
  describe(`notification and reminder functions in ${schema}`, () => {
    let db: pg.Client;

    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
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
          "select id, threshold, status, version from reminder_jobs where task_id = $1 order by threshold, created_at",
          [task],
        )
      ).rows as Job[];
    const live = async (task: string) =>
      (await jobsOf(task)).filter((job) => !["stale", "cancelled", "skipped"].includes(job.status));
    const recipients = async (job: string, status = "active") =>
      (
        await db.query(
          "select family_id from reminder_recipients where reminder_job_id = $1 and status = $2 order by family_id",
          [job, status],
        )
      ).rows.map((row) => row.family_id as string);

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
        await db.query("delete from notifications where id = $1", [id]);
        await db.query("delete from reminder_jobs where id = $1", [job]);
      }
    });

    it("maps timing for event notices and for every job status (BR40.2)", async () => {
      const event = await insertNotification(db, {
        parent: PARENT_ROW_F1,
        task: TASK_1,
        target: TASK_1,
      });
      const one = async (id: string) => (await items(PARENT_F1)).find((item) => item.id === id)!;
      assert.equal((await one(event)).timing, "within-threshold");
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

      const expectations: [string, string][] = [
        ["sent", "24-hour"],
        ["queued", "24-hour"],
        ["skipped", "24-hour"],
        ["stale", "stale"],
        ["cancelled", "cancelled"],
      ];
      for (const [status, timing] of expectations) {
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
        assert.equal(found.timing, timing, status);
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
          `select threshold, due_on = (task_starts_at at time zone 'Europe/Budapest')::date - (case threshold when '7d' then 7 else 1 end) as exact,
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

    it("plans from the Budapest calendar date: across the clock changes the due dates stay 7 and 1 days before the duty (BR53.2)", async () => {
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
                    ((task_starts_at at time zone 'Europe/Budapest')::date - due_on) as days_before
               from reminder_jobs where task_id = $1 order by threshold`,
            [TASK_1],
          )
        ).rows;
        assert.deepEqual(
          rows.map((row) => [row.threshold, row.days_before]),
          [
            ["24h", 1],
            ["7d", 7],
          ],
          label,
        );
      }
    });

    it("plans a missed threshold with a due date that has passed, once, and plans nothing for a started, closed or cancelled task (BR40.4, N2)", async () => {
      await db.query(
        "update tasks set starts_at = now() + interval '20 hours', ends_at = now() + interval '22 hours' where id = $1",
        [TASK_1],
      );
      await plan(TASK_1);
      const due = (
        await db.query(
          "select threshold, due_on <= (now() at time zone 'Europe/Budapest')::date as immediate from reminder_jobs where task_id = $1 order by threshold",
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
        "insert into parents (id, organization_id, family_id, display_name) values ($1, $2, $3, 'Csoporttag Géza')",
        [uuid(9410), ORGANIZATION, FAMILY_NO_GROUP],
      );
      await db.query(
        "insert into group_memberships (organization_id, parent_id, group_id) values ($1, $2, $3)",
        [ORGANIZATION, uuid(9410), GROUP_1],
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
      await db.query("update reminder_jobs set status = 'sent' where id = $1", [old24!.id]);
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
  });
}
