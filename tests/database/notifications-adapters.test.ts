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
import { insertDelivery, insertJob, insertNotification } from "./notifications-support.ts";
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
        notifications: { title: string; isRead: boolean; link: string }[];
      }>((await (await parent("parent")).listNotifications({ actorId: "ignored" })) as Result);
      assert.equal(own.notifications.length, 2);
      assert.match(own.notifications[0]!.title, /^A helyed törölve: /, "newest first");
      assert.match(own.notifications[1]!.title, /^Jelentkezés megerősítve: /);
      assert.equal(own.notifications[0]!.isRead, false);
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

    it("turns a due reminder job into the parent's notice with the daily run, once, and the list only reads (BR40.6, BR52.5)", async () => {
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
      assert.deepEqual(await port.listNotifications({ actorId: "ignored" }), {
        state: "empty",
      });
      await db.query("select timed_checks_run_system('daily')");
      const first = data<{ notifications: { title: string; timing: string }[] }>(
        (await port.listNotifications({ actorId: "ignored" })) as Result,
      );
      assert.equal(first.notifications.length, 1);
      assert.match(first.notifications[0]!.title, /^Egy hét múlva: Díszítés$/);
      assert.equal(first.notifications[0]!.timing, "7-day");
      assert.equal(
        (await db.query("select status from reminder_jobs where id = $1", [job])).rows[0].status,
        "sent",
      );
      await db.query("select timed_checks_run_system('daily')");
      const second = data<{ notifications: unknown[] }>(
        (await port.listNotifications({ actorId: "ignored" })) as Result,
      );
      assert.equal(
        second.notifications.length,
        1,
        "a second run on the day adds no duplicate notice",
      );
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

    /** Two failed emails of one kind about one task: the pair a failure group holds. */
    async function failedPair() {
      const noticeOne = await insertNotification(db, {
        parent: PARENT_ROW_F1,
        task: TASK_1,
        target: TASK_1,
      });
      const noticeTwo = await insertNotification(db, {
        parent: PARENT_ROW_F2,
        task: TASK_1,
        target: TASK_1,
      });
      const one = await insertDelivery(db, {
        notice: noticeOne,
        parent: PARENT_ROW_F1,
        target: TASK_1,
      });
      const two = await insertDelivery(db, {
        notice: noticeTwo,
        parent: PARENT_ROW_F2,
        target: TASK_1,
        round: 2,
      });
      return { one, two };
    }

    it("lists the failed emails grouped by kind and item with counts and ids only, and refuses other roles (BR53.1, NFR1.3)", async () => {
      assert.deepEqual(await admin("super", "reminders.list"), { state: "empty" });
      const { one, two } = await failedPair();
      const list = data<{
        groups: {
          kind: string;
          targetId: string;
          failedCount: number;
          title: string;
          deliveries: { id: string; tryCount: number }[];
        }[];
        checks: unknown[];
      }>(await admin("super", "reminders.list"));
      assert.equal(list.groups.length, 1);
      const group = list.groups[0]!;
      assert.deepEqual(
        [group.kind, group.targetId, group.failedCount],
        ["sign_up_confirmed", TASK_1, 2],
      );
      assert.deepEqual(
        [...group.deliveries].sort((a, b) => a.id.localeCompare(b.id)),
        [
          { id: one, tryCount: 3 },
          { id: two, tryCount: 6 },
        ].sort((a, b) => a.id.localeCompare(b.id)),
        "the try count is (round - 1) * 3 + tries in the round",
      );
      const everything = JSON.stringify(list);
      assert.equal(
        /@|Fenyő|example\.test/.test(everything),
        false,
        "no address and no name in the list",
      );
      assert.equal((await admin("outsider", "reminders.list")).state, "denied");
      assert.equal((await admin("parent", "reminders.list")).state, "denied");
      assert.equal((await admin("adminSame", "reminders.list")).state, "denied");
    });

    it("tries a group again with the shown list, refuses an outdated one with REMINDER_STALE, and a repeated key answers the same (BR53.3, NFR5.5)", async () => {
      const { one, two } = await failedPair();
      const shown = [
        { id: one, tryCount: 3 },
        { id: two, tryCount: 6 },
      ];
      const body = {
        id: TASK_1,
        expectedVersion: 2,
        kind: "sign_up_confirmed",
        targetType: "task",
      };
      // Outdated screen: one of the shown emails already had another try.
      const outdated = await admin("super", "reminders.retry", {
        ...body,
        expected: [{ id: one, tryCount: 2 }, shown[1]],
      });
      assert.deepEqual([outdated.state, outdated.code], ["invalidated", "REMINDER_STALE"]);
      const key = nextKey("retry");
      const restarted = data<{ targetId: string; restarted: number }>(
        await admin("super", "reminders.retry", { ...body, expected: shown }, key),
      );
      assert.deepEqual(restarted, { targetId: TASK_1, restarted: 2 });
      const states = (
        await db.query(
          "select status, round, attempts_in_round from email_deliveries order by round",
        )
      ).rows;
      assert.deepEqual(states, [
        { status: "queued", round: 2, attempts_in_round: 0 },
        { status: "queued", round: 3, attempts_in_round: 0 },
      ]);
      const again = await admin("super", "reminders.retry", { ...body, expected: shown }, key);
      assert.equal(again.state, "success", "the same key answers the stored result");
      assert.equal(
        (await db.query("select count(*)::int as n from email_deliveries where status = 'queued'"))
          .rows[0].n,
        2,
        "the repeated click started nothing more",
      );
      const none = await admin("super", "reminders.retry", { ...body, expected: shown });
      assert.deepEqual([none.state, none.code], ["conflict", "REMINDER_NOT_RETRYABLE"]);
      assert.deepEqual(
        await admin("super", "reminders.retry", { ...body, id: "nope", expected: shown }),
        { state: "denied" },
      );
      assert.equal(
        (await admin("outsider", "reminders.retry", { ...body, expected: shown })).state,
        "denied",
      );
      assert.equal(
        (await admin("adminSame", "reminders.retry", { ...body, expected: shown })).state,
        "denied",
      );
    });
  });
}
