import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import type { AdminOperation, DomainOutcome } from "../../src/application/index.ts";
import { createAdminPort, createParentPort } from "../../src/data/index.ts";
import { createSignInService } from "../../src/identity/service.ts";
import { createDatabaseClient, type DatabaseClient } from "../../src/runtime/database/client.ts";
import {
  ADMIN_G1,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  FAMILY_2,
  nextKey,
  openDirectoryDatabase,
  ORGANIZATION,
  OUTSIDER,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  seedCoordinationWorld,
  SUPER_ADMIN,
  TASK_1,
  TASK_3,
} from "./directory-support.ts";
import { insertJob, insertNotification } from "./notifications-support.ts";
import { stackSettings } from "./stack-support.ts";

const settings = stackSettings();
const apiUrl = settings.apiUrl.replace(/\/$/, "");
const SESSION_SECRET = `test-secret-${randomBytes(24).toString("hex")}`;
const PASSWORD = `Pw-${randomBytes(6).toString("hex")}-1`;

const ACCOUNTS = {
  parent: PARENT_F1,
  parentOther: PARENT_F2,
  adminSame: ADMIN_G1,
  super: SUPER_ADMIN,
  outsider: OUTSIDER,
} as const;
type Who = keyof typeof ACCOUNTS;
type Result = DomainOutcome<unknown> & { code?: string };

function must<T>(value: T | undefined | null, what: string): T {
  assert.ok(value !== undefined && value !== null, what);
  return value;
}

/**
 * The notification and reminder adapters against the real local stack, with real sign-in tokens (NFR2.26,
 * NFR6.23). Nothing is mocked: the data API, the row-level policies, the functions and the sign-in service are
 * the stack's own.
 */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`notification and reminder adapters in ${schema}`, () => {
    let db: pg.Client;
    const database = createDatabaseClient({
      url: apiUrl,
      publicKey: settings.publicKey,
      sessionSecret: SESSION_SECRET,
      schema,
    });
    const service = createSignInService({ url: apiUrl, publicKey: settings.publicKey });
    const tokens = new Map<string, string>();

    async function asPerson(who: Who): Promise<DatabaseClient> {
      const account = ACCOUNTS[who];
      let token = tokens.get(account);
      if (!token) {
        // Bare seeded identities get the service's instance and a password hash by SQL (the service's own
        // password change would end the sessions other test files hold for the same shared identities).
        await db.query(
          `update auth.users set instance_id = '00000000-0000-0000-0000-000000000000',
                  encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')),
                  email_confirmed_at = coalesce(email_confirmed_at, now()),
                  confirmation_token = coalesce(confirmation_token, ''),
                  recovery_token = coalesce(recovery_token, ''),
                  email_change_token_new = coalesce(email_change_token_new, ''),
                  email_change = coalesce(email_change, ''),
                  raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb),
                  raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
            where id = $1`,
          [account, PASSWORD],
        );
        const signedIn = await service.passwordSignIn(`identity.${account}@example.test`, PASSWORD);
        assert.ok(signedIn.ok, `the sign-in service accepts ${who}`);
        token = signedIn.value.accessToken;
        tokens.set(account, token);
      }
      return database.forSession(token);
    }

    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedCoordinationWorld(db, schema);
    });

    const admin = async (
      who: Who,
      operation: AdminOperation,
      payload: Record<string, unknown> = {},
      key = nextKey("adm"),
    ) => {
      const port = createAdminPort(await asPerson(who));
      return (await port.execute<unknown>({
        actorId: ACCOUNTS[who],
        operation,
        scope: { id: ORGANIZATION, type: "organization", organizationId: ORGANIZATION },
        payload,
        idempotencyKey: key,
      })) as Result;
    };
    const parent = async (who: Who) => createParentPort(await asPerson(who));
    const data = <T>(result: Result): T => {
      assert.equal(result.state, "success", JSON.stringify(result));
      return (result as { data: T }).data;
    };

    it("lists only the signed-in parent's own notifications, newest first, with the display fields of the model (BR40.2)", async () => {
      await insertNotification(db, {
        parent: PARENT_ROW_F1,
        kind: "sign_up_confirmed",
        task: TASK_1,
        target: TASK_1,
        createdAt: new Date(Date.now() - 3_600_000).toISOString(),
      });
      await insertNotification(db, {
        parent: PARENT_ROW_F1,
        kind: "place_removed",
        task: TASK_1,
        target: TASK_1,
      });
      await insertNotification(db, {
        parent: PARENT_ROW_F2,
        kind: "sign_up_confirmed",
        task: TASK_3,
        target: TASK_3,
      });
      const own = data<{
        notifications: { title: string; isRead: boolean; link: string; providerStatus: string }[];
      }>((await (await parent("parent")).listNotifications({ actorId: "ignored" })) as Result);
      assert.equal(own.notifications.length, 2);
      assert.match(own.notifications[0]!.title, /^A helyed törölve: /, "newest first");
      assert.match(own.notifications[1]!.title, /^Jelentkezés megerősítve: /);
      assert.equal(own.notifications[0]!.isRead, false);
      assert.equal(own.notifications[0]!.providerStatus, "simulated-sent");
      assert.match(own.notifications[0]!.link, /^\/szulo\//);
      const other = data<{ notifications: unknown[] }>(
        (await (await parent("parentOther")).listNotifications({ actorId: "ignored" })) as Result,
      );
      assert.equal(other.notifications.length, 1, "each parent sees their own notices only");
    });

    it("answers the empty state to a parent with no notices and denied to a caller who is not a parent of the organization (BR40.2)", async () => {
      assert.deepEqual(await (await parent("parent")).listNotifications({ actorId: "ignored" }), {
        state: "empty",
      });
      const denied = await (await parent("outsider")).listNotifications({ actorId: "ignored" });
      assert.ok(
        ["empty", "denied"].includes(denied.state),
        "an account with no linked parent has nothing to list",
      );
    });

    it("runs the lazy tick when the list opens: a due reminder job becomes the parent's notice, once (BR40.6)", async () => {
      const job = await insertJob(db, { task: TASK_3, threshold: "7d" });
      // The task's own start, to the microsecond (a JavaScript date would round it and make the job stale).
      await db.query(
        "update reminder_jobs set task_starts_at = (select starts_at from tasks where id = $2) where id = $1",
        [job, TASK_3],
      );
      await db.query(
        "insert into reminder_recipients (organization_id, reminder_job_id, family_id) values ($1, $2, $3)",
        [ORGANIZATION, job, FAMILY_2],
      );
      const port = await parent("parentOther");
      const first = data<{
        notifications: { title: string; timing: string; providerStatus: string }[];
      }>((await port.listNotifications({ actorId: "ignored" })) as Result);
      assert.equal(first.notifications.length, 1);
      assert.match(first.notifications[0]!.title, /^Egy hét múlva: Díszítés$/);
      assert.equal(first.notifications[0]!.timing, "7-day");
      assert.equal(first.notifications[0]!.providerStatus, "simulated-sent");
      assert.equal(
        (await db.query("select status from reminder_jobs where id = $1", [job])).rows[0].status,
        "sent",
      );
      const second = data<{ notifications: unknown[] }>(
        (await port.listNotifications({ actorId: "ignored" })) as Result,
      );
      assert.equal(second.notifications.length, 1, "the tick is idempotent: no duplicate notice");
    });

    it("marks a notice read once and again, and another parent's notice, an unknown one and a malformed id read as denied (BR40.3)", async () => {
      const mine = await insertNotification(db, {
        parent: PARENT_ROW_F1,
        task: TASK_1,
        target: TASK_1,
      });
      const theirs = await insertNotification(db, {
        parent: PARENT_ROW_F2,
        task: TASK_3,
        target: TASK_3,
      });
      const port = await parent("parent");
      const first = (await port.markNotificationRead({
        actorId: PARENT_F1,
        notificationId: mine,
      })) as Result;
      assert.match(data<{ link: string }>(first).link, /^\/szulo\//);
      const readAt = (await db.query("select read_at from notifications where id = $1", [mine]))
        .rows[0].read_at;
      assert.ok(readAt);
      await port.markNotificationRead({ actorId: PARENT_F1, notificationId: mine });
      assert.deepEqual(
        (await db.query("select read_at from notifications where id = $1", [mine])).rows[0].read_at,
        readAt,
        "the first time is kept",
      );
      for (const id of [theirs, "11111111-1111-4111-8111-111111111111", "../etc/passwd"]) {
        assert.deepEqual(
          await port.markNotificationRead({ actorId: PARENT_F1, notificationId: id }),
          { state: "denied" },
        );
      }
      assert.equal(
        (await db.query("select read_at from notifications where id = $1", [theirs])).rows[0]
          .read_at,
        null,
        "the other parent's notice is untouched",
      );
    });

    it("lists the reminder jobs an admin reaches with counts and no names, filters by status, and refuses other roles (BR40.8)", async () => {
      const startsAt = (await db.query("select starts_at from tasks where id = $1", [TASK_1]))
        .rows[0].starts_at;
      const retryable = await insertJob(db, {
        task: TASK_1,
        threshold: "24h",
        status: "retryable",
        attempt: 1,
        startsAt,
        scheduledFor: new Date(Date.now() + 3_600_000).toISOString(),
      });
      await db.query(
        "insert into reminder_recipients (organization_id, reminder_job_id, family_id) values ($1, $2, $3)",
        [ORGANIZATION, retryable, FAMILY_1],
      );
      const all = data<{
        jobs: { id: string; status: string; recipientSummary: string; providerLabel: string }[];
      }>(await admin("super", "reminders.list"));
      const row = must(
        all.jobs.find((job) => job.id === retryable),
        "the job is listed",
      );
      assert.equal(row.status, "retryable");
      assert.equal(row.recipientSummary, "1 kijelölt család");
      assert.equal(row.providerLabel, "Szimulált kézbesítés");
      assert.equal(JSON.stringify(all).includes("Fenyő"), false, "no family name in the list");
      const filtered = data<{ jobs: { status: string }[] }>(
        await admin("super", "reminders.list", { status: "retryable" }),
      );
      assert.ok(
        filtered.jobs.length >= 1 && filtered.jobs.every((job) => job.status === "retryable"),
      );
      assert.equal(
        (await admin("super", "reminders.list", { status: "nonsense" })).state,
        "validation",
      );
      assert.equal((await admin("outsider", "reminders.list")).state, "denied");
      assert.equal((await admin("parent", "reminders.list")).state, "denied");
    });

    it("retries a retryable job with the codes REMINDER_NOT_RETRYABLE and REMINDER_STALE, and a repeated key answers the same (BR40.7, BR42.3)", async () => {
      const startsAt = (await db.query("select starts_at from tasks where id = $1", [TASK_1]))
        .rows[0].starts_at;
      const job = await insertJob(db, {
        task: TASK_1,
        status: "retryable",
        attempt: 1,
        startsAt,
        scheduledFor: new Date(Date.now() + 3_600_000).toISOString(),
      });
      const version = (await db.query("select version from reminder_jobs where id = $1", [job]))
        .rows[0].version as number;
      const stale = await admin("super", "reminders.retry", {
        id: job,
        expectedVersion: version + 5,
      });
      assert.deepEqual([stale.state, stale.code], ["invalidated", "REMINDER_STALE"]);
      const key = nextKey("retry");
      const retried = data<{ jobId: string; status: string }>(
        await admin("super", "reminders.retry", { id: job, expectedVersion: version }, key),
      );
      assert.deepEqual(retried, { jobId: job, status: "retry-scheduled" });
      assert.equal(
        (await db.query("select status from reminder_jobs where id = $1", [job])).rows[0].status,
        "retrying",
      );
      const again = await admin(
        "super",
        "reminders.retry",
        { id: job, expectedVersion: version },
        key,
      );
      assert.equal(again.state, "success", "the same key answers the stored result");
      const notRetryable = await admin("super", "reminders.retry", {
        id: job,
        expectedVersion: version + 1,
      });
      assert.deepEqual(
        [notRetryable.state, notRetryable.code],
        ["conflict", "REMINDER_NOT_RETRYABLE"],
      );
      assert.deepEqual(
        await admin("super", "reminders.retry", { id: "nope", expectedVersion: 1 }),
        { state: "denied" },
      );
      assert.equal(
        (await admin("outsider", "reminders.retry", { id: job, expectedVersion: 1 })).state,
        "denied",
      );
    });
  });
}
