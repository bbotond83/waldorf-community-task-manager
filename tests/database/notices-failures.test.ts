import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  asActor,
  callFunction,
  FAMILY_1,
  FAMILY_2,
  EVENT_1,
  GROUP_1,
  nextKey,
  openDirectoryDatabase,
  ORGANIZATION,
  OTHER_ADMIN,
  OTHER_ORGANIZATION,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_CO,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  PARENT_ROW_OTHER,
  REQUEST_1,
  seedCoordinationWorld,
  SUPER_ADMIN,
  TASK_1,
  TASK_3,
  TEACHER_G1,
  YEAR_1,
} from "./directory-support.ts";
import {
  insertDelivery,
  insertJob,
  insertNotification,
  NOTIFICATION_SCHEMAS,
} from "./notifications-support.ts";
import { bindSchema, ensureAccount, openDatabase } from "./stack-support.ts";

type Entry = { id: string; try_count: number };
type Group = {
  kind: string;
  target_type: string;
  target_id: string;
  failed_count: number;
  reason: string | null;
  title: string;
  deliveries: Entry[];
};
type Answer = {
  state: string;
  code: string | null;
  reference?: string | null;
  restarted?: number;
  groups?: Group[];
  checks?: Record<string, unknown>[];
};

const OTHER_PARENT_ACCOUNT = "bbbbbbbb-0000-4000-8000-0000000000f2";
const PLAN = "99999999-0000-4000-8000-000000000002";

/**
 * The super admin's failure list and Try again on the real stack (BR53, BR54). The list holds counts, kinds and
 * delivery ids only; Try again sends back the (delivery id, try count) list the screen showed and refuses with
 * REMINDER_STALE when any of those emails has changed since, so a click on an outdated screen changes nothing.
 *
 * The fixed list: allowed; refused; out of reach (another community, other roles); outdated screen; repeated click;
 * two admins at once. The last test is the shared leak test: it has a case for every registered target type, so a
 * type added later fails it until its notice has been checked for leaks (NFR1.3, NFR10.4).
 */
for (const schema of NOTIFICATION_SCHEMAS) {
  describe(`the failure list and Try again in ${schema}`, () => {
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

    const call = (account: string, sql: string, values: unknown[] = [], client: pg.Client = db) =>
      callFunction(client, schema, account, sql, values) as Promise<Answer>;
    const list = (account = SUPER_ADMIN, client: pg.Client = db) =>
      call(account, "delivery_problems_list()", [], client);
    const retry = (
      account: string,
      group: { kind: string; target: string },
      expected: Entry[],
      key = nextKey("retry"),
      client: pg.Client = db,
    ) =>
      call(
        account,
        "delivery_retry($1, $2, 'task', $3, $4::jsonb)",
        [key, group.kind, group.target, JSON.stringify(expected)],
        client,
      );
    const rows = async (sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows;
    /** Failed emails of one kind about one task, one per parent given. Returns the delivery ids. */
    async function fail(
      parents: string[],
      options: { kind?: string; target?: string; round?: number; organization?: string } = {},
    ) {
      const ids: string[] = [];
      for (const parent of parents) {
        const notice = await insertNotification(db, {
          parent,
          kind: options.kind ?? "sign_up_confirmed",
          task: options.target ?? TASK_1,
          target: options.target ?? TASK_1,
          key: `fail-${parent}-${ids.length}-${Math.random()}`,
          organization: options.organization,
        });
        ids.push(
          await insertDelivery(db, {
            notice,
            parent,
            kind: options.kind ?? "sign_up_confirmed",
            target: options.target ?? TASK_1,
            round: options.round,
            organization: options.organization,
          }),
        );
      }
      return ids;
    }
    const group = { kind: "sign_up_confirmed", target: TASK_1 };
    const count = async (table: string) =>
      (await rows(`select count(*)::int as n from ${table}`))[0]!.n as number;
    const status = async (id: string) =>
      (await rows("select status from email_deliveries where id = $1", [id]))[0]!.status as string;

    it("allowed: the failed emails come as one group per kind and item with counts and delivery ids, newest first (BR53.1)", async () => {
      assert.deepEqual(await list(), {
        ...(await list()),
        state: "success",
        groups: [],
        checks: [],
      });
      const [one, two] = await fail([PARENT_ROW_F1, PARENT_ROW_F2]);
      await fail([PARENT_ROW_F2], { kind: "place_removed", target: TASK_3 });
      const answer = await list();
      assert.equal(answer.state, "success");
      assert.equal(answer.groups!.length, 2);
      const grouped = answer.groups!.find((entry) => entry.kind === "sign_up_confirmed")!;
      assert.equal(grouped.failed_count, 2);
      assert.equal(grouped.reason, null, "no try is on record, so no reason is shown");
      assert.deepEqual(grouped.deliveries.map((entry) => entry.id).sort(), [one!, two!].sort());
      assert.ok(grouped.deliveries.every((entry) => entry.try_count === 3));
      assert.match(grouped.title, /^Jelentkezés megerősítve – \d{4}\. \d{2}\. \d{2}\.$/);
    });

    it("allowed: the group shows the reason class of the latest failed try and never a server text (BR54.2)", async () => {
      const [one] = await fail([PARENT_ROW_F1]);
      await db.query(
        `insert into email_attempts (delivery_id, round, attempt_number, outcome, reason_code, occurred_at) values
           ($1, 1, 1, 'failed', 'mail_rejected', now() - interval '2 hours'),
           ($1, 1, 2, 'failed', 'mail_unavailable', now() - interval '1 hour')`,
        [one],
      );
      const group = (await list()).groups![0]!;
      assert.equal(group.reason, "mail_unavailable");
      assert.deepEqual(Object.keys(group).sort(), [
        "deliveries",
        "failed_count",
        "item_date",
        "kind",
        "kind_label",
        "latest_try_at",
        "reason",
        "target_id",
        "target_type",
        "title",
      ]);
    });

    it("allowed: a group of more than 500 failed emails can be retried in one call; more than 5000 is refused with its own code", async () => {
      const parents = Array.from({ length: 501 }, () => PARENT_ROW_F1);
      await fail(parents);
      const shown = (await list()).groups![0]!.deliveries;
      assert.equal(shown.length, 501);
      const answer = await retry(SUPER_ADMIN, group, shown);
      assert.equal(answer.state, "success");
      assert.equal((answer as { restarted?: number }).restarted, 501);
      const fake = Array.from({ length: 5001 }, (_, index) => ({
        id: `33333333-0000-4000-8000-${String(index).padStart(12, "0")}`,
        try_count: 3,
      }));
      const refused = await retry(SUPER_ADMIN, group, fake);
      assert.equal(refused.state, "validation");
      assert.equal(refused.code, "REMINDER_TOO_LARGE");
    });

    it("allowed: Try again restarts the listed emails in a new round and the failure leaves the list (BR53.3)", async () => {
      const ids = await fail([PARENT_ROW_F1, PARENT_ROW_F2], { round: 1 });
      const shown = (await list()).groups![0]!.deliveries;
      const answer = await retry(SUPER_ADMIN, group, shown);
      assert.equal(answer.state, "success");
      assert.equal(answer.restarted, 2);
      for (const id of ids) assert.equal(await status(id), "queued");
      const restarted = await rows(
        "select round, attempts_in_round, finished_at from email_deliveries order by id",
      );
      assert.ok(
        restarted.every(
          (row) => row.round === 2 && row.attempts_in_round === 0 && row.finished_at === null,
        ),
      );
      assert.deepEqual((await list()).groups, []);
    });

    it("refused: a parent, a teacher, a group coordinator and a signed-out caller get denied on the list and on Try again (NFR3.1)", async () => {
      const [id] = await fail([PARENT_ROW_F1]);
      const shown = [{ id: id!, try_count: 3 }];
      for (const account of [PARENT_F1, TEACHER_G1, ADMIN_G1]) {
        assert.equal((await list(account)).state, "denied", account);
        assert.equal((await retry(account, group, shown)).state, "denied", account);
      }
      assert.equal(await status(id!), "failed", "nothing was restarted");
      const signedOut = await asActor(
        db,
        schema,
        { role: "authenticated", account: SUPER_ADMIN, session: null },
        async () => {
          const result = await db.query("select delivery_problems_list() as result");
          return result.rows[0].result as Answer;
        },
      );
      assert.equal(signedOut.state, "denied");
    });

    it("refused: a bad list is a validation error and a group with nothing failed is REMINDER_NOT_RETRYABLE (BR53.3)", async () => {
      const [id] = await fail([PARENT_ROW_F1]);
      for (const bad of [[], [{ id: "not-a-uuid", try_count: 3 }], [{ id: id, try_count: "x" }]]) {
        const answer = await call(SUPER_ADMIN, "delivery_retry($1, $2, 'task', $3, $4::jsonb)", [
          nextKey("bad"),
          group.kind,
          group.target,
          JSON.stringify(bad),
        ]);
        assert.equal(answer.state, "validation", JSON.stringify(bad));
      }
      const noKey = await call(SUPER_ADMIN, "delivery_retry('', $1, 'task', $2, $3::jsonb)", [
        group.kind,
        group.target,
        JSON.stringify([{ id, try_count: 3 }]),
      ]);
      assert.deepEqual([noKey.state, noKey.code], ["validation", "idempotency_key_invalid"]);
      const nothing = await retry(SUPER_ADMIN, { kind: "place_removed", target: TASK_3 }, [
        { id: id!, try_count: 3 },
      ]);
      assert.deepEqual([nothing.state, nothing.code], ["conflict", "REMINDER_NOT_RETRYABLE"]);
      assert.equal(await status(id!), "failed");
    });

    it("out of reach: another community's failures are not listed and its group cannot be restarted by this community's admin, and the other way round (NFR3.2)", async () => {
      await ensureAccount(db, { id: OTHER_PARENT_ACCOUNT, organization: OTHER_ORGANIZATION });
      await db.query("update parents set account_id = $2 where id = $1", [
        PARENT_ROW_OTHER,
        OTHER_PARENT_ACCOUNT,
      ]);
      const [mine] = await fail([PARENT_ROW_F1]);
      const [theirs] = await fail([PARENT_ROW_OTHER], {
        organization: OTHER_ORGANIZATION,
        kind: "place_removed",
      });
      const own = await list(SUPER_ADMIN);
      assert.deepEqual(
        own.groups!.map((entry) => entry.kind),
        ["sign_up_confirmed"],
      );
      const foreign = await list(OTHER_ADMIN);
      assert.deepEqual(
        foreign.groups!.map((entry) => entry.kind),
        ["place_removed"],
      );
      const across = await retry(OTHER_ADMIN, group, [{ id: mine!, try_count: 3 }]);
      assert.deepEqual([across.state, across.code], ["conflict", "REMINDER_NOT_RETRYABLE"]);
      const back = await retry(SUPER_ADMIN, { kind: "place_removed", target: TASK_1 }, [
        { id: theirs!, try_count: 3 },
      ]);
      assert.deepEqual([back.state, back.code], ["conflict", "REMINDER_NOT_RETRYABLE"]);
      assert.equal(await status(mine!), "failed");
      assert.equal(await status(theirs!), "failed");
    });

    it("outdated screen: a listed email that has had another try, or is no longer failed, makes Try again refuse with REMINDER_STALE and change nothing (BR53.3)", async () => {
      const [one, two] = await fail([PARENT_ROW_F1, PARENT_ROW_F2]);
      const shown = (await list()).groups![0]!.deliveries;
      await db.query("update email_deliveries set round = 2 where id = $1", [one]);
      const changed = await retry(SUPER_ADMIN, group, shown);
      assert.deepEqual([changed.state, changed.code], ["invalidated", "REMINDER_STALE"]);
      await db.query("update email_deliveries set round = 1 where id = $1", [one]);
      await db.query(
        "update email_deliveries set status = 'sent', attempts_in_round = 1 where id = $1",
        [two],
      );
      const gone = await retry(SUPER_ADMIN, group, shown);
      assert.deepEqual([gone.state, gone.code], ["invalidated", "REMINDER_STALE"]);
      assert.equal(await status(one!), "failed", "a stale click restarts nothing");
    });

    it("a failure that joined after the screen was drawn stays failed while the listed ones restart (BR53.3)", async () => {
      const [one, two] = await fail([PARENT_ROW_F1, PARENT_ROW_F2]);
      const shown = (await list()).groups![0]!.deliveries;
      const [late] = await fail([PARENT_ROW_CO]);
      const answer = await retry(SUPER_ADMIN, group, shown);
      assert.equal(answer.restarted, 2);
      assert.equal(await status(one!), "queued");
      assert.equal(await status(two!), "queued");
      assert.equal(await status(late!), "failed", "the new failure waits for its own click");
      assert.equal((await list()).groups![0]!.failed_count, 1);
    });

    it("repeated click: the same key answers the stored result and restarts nothing again (NFR5.5)", async () => {
      const ids = await fail([PARENT_ROW_F1, PARENT_ROW_F2]);
      const shown = (await list()).groups![0]!.deliveries;
      const key = nextKey("same");
      const first = await retry(SUPER_ADMIN, group, shown, key);
      assert.equal(first.state, "success");
      for (const id of ids) {
        await db.query(
          "update email_deliveries set status = 'failed', attempts_in_round = 3, round = round where id = $1",
          [id],
        );
      }
      const again = await retry(SUPER_ADMIN, group, shown, key);
      assert.deepEqual([again.state, again.code], ["success", "replayed"]);
      for (const id of ids)
        assert.equal(await status(id), "failed", "the repeat did not restart them");
      const reused = await retry(
        SUPER_ADMIN,
        { kind: "place_removed", target: TASK_1 },
        shown,
        key,
      );
      assert.deepEqual([reused.state, reused.code], ["conflict", "idempotency_key_reused"]);
    });

    it("two at once: two admins pressing Try again start one round, over repeated rounds with no deadlock (NFR5.6)", async () => {
      for (let round = 0; round < 5; round += 1) {
        await db.query("truncate email_deliveries, notifications cascade");
        const ids = await fail([PARENT_ROW_F1, PARENT_ROW_F2]);
        const shown = (await list()).groups![0]!.deliveries;
        const answers = await Promise.all([
          retry(SUPER_ADMIN, group, shown, nextKey("a"), db),
          retry(SUPER_ADMIN, group, shown, nextKey("b"), second),
        ]);
        assert.deepEqual(
          answers.map((answer) => answer.state).sort(),
          ["conflict", "success"],
          `round ${round}`,
        );
        for (const id of ids) assert.equal(await status(id), "queued");
        const rounds = await rows("select distinct round from email_deliveries");
        assert.deepEqual(
          rounds.map((row) => row.round),
          [2],
          "one round was started, not two",
        );
      }
    });

    it("a failed or missing check of the last 30 days is listed with its error class, an older one is not (BR52.7)", async () => {
      const run = (
        await rows("insert into timed_runs (run_kind, run_at) values ('daily', now()) returning id")
      )[0]!.id as string;
      const old = (
        await rows(
          "insert into timed_runs (run_kind, run_at) values ('daily', now() - interval '40 days') returning id",
        )
      )[0]!.id as string;
      await db.query(
        `insert into timed_check_runs (run_id, check_name, run_kind, started_at, outcome, error_code) values
           ($1, 'duty_reminders', 'daily', now(), 'failed', '40001'),
           ($1, 'housekeeping', 'daily', now(), 'success', null),
           ($1, 'other_check', 'daily', now(), 'missing', null),
           ($2, 'duty_reminders', 'daily', now() - interval '40 days', 'failed', '40001')`,
        [run, old],
      );
      const answer = await list();
      assert.deepEqual(answer.checks!.map((check) => [check.check_name, check.outcome]).sort(), [
        ["duty_reminders", "failed"],
        ["other_check", "missing"],
      ]);
      assert.equal(
        (await list(OTHER_ADMIN)).state,
        "success",
        "any super admin reads the same run records",
      );
    });

    it("the shared leak test: for every registered target type, a reader sees nothing of another family, and the failure list holds no address, no name and no phone (NFR1.3, NFR10.4)", async () => {
      // One notice per kind of each registered target type, for a parent of family 1 and a parent of family 2.
      await db.query(
        `insert into rota_plans (id, organization_id, school_year_id, status, published_at, published_by)
         values ($1, $2, $3, 'published', now(), $4)`,
        [PLAN, ORGANIZATION, YEAR_1, SUPER_ADMIN],
      );
      await db.query(
        `insert into rota_weeks (organization_id, plan_id, week_start, family_id) values
           ($1, $2, '2026-12-07', $3), ($1, $2, '2026-12-14', $4)`,
        [ORGANIZATION, PLAN, FAMILY_1, FAMILY_2],
      );
      const BOOK = "99999999-0000-4000-8000-000000000003";
      await db.query(
        `insert into books (id, organization_id, title, authors, owner_name, source_key)
         values ($1, $2, 'Mese a leak tesztből', 'Kitalált Szerző', 'Kitalált Gazda', 'leak-test')`,
        [BOOK, ORGANIZATION],
      );
      const RECURRING_SCHEDULE = "99999999-0000-4000-8000-000000000004";
      const RECURRING_OCCURRENCE = "99999999-0000-4000-8000-000000000005";
      await db.query(
        `insert into recurring_schedules (id, organization_id, title, category, owner_kind, working_group_id, interval_kind,
           interval_count, start_date)
         values ($1, $2, 'Kitalált ismétlődő munka', 'kert', 'group', $3, 'weeks', 1, '2026-12-07')`,
        [RECURRING_SCHEDULE, ORGANIZATION, GROUP_1],
      );
      await db.query(
        `insert into recurring_occurrences (id, organization_id, schedule_id, due_date) values ($1, $2, $3, '2026-12-07')`,
        [RECURRING_OCCURRENCE, ORGANIZATION, RECURRING_SCHEDULE],
      );
      const TODO_TASK = "99999999-0000-4000-8000-000000000006";
      await db.query(
        `insert into todo_tasks (id, organization_id, owner_group_id, topic, deadline)
         values ($1, $2, $3, 'Kitalált teendő a leak tesztből', '2026-12-07')`,
        [TODO_TASK, ORGANIZATION, GROUP_1],
      );
      const targets: Record<string, string> = {
        todo_task: TODO_TASK,
        animal_signup: YEAR_1,
        recurring_duty: RECURRING_OCCURRENCE,
        book: BOOK,
        task: TASK_1,
        change_request: REQUEST_1,
        rota_plan: PLAN,
        working_group: GROUP_1,
        event: EVENT_1,
      };
      const registered = (
        await rows("select target_type from notice_targets order by target_type")
      ).map((row) => row.target_type as string);
      for (const type of registered) {
        assert.ok(targets[type], `the leak test has a case for the registered target type ${type}`);
      }
      const kinds = await rows("select kind, target_type from notice_kinds order by kind");
      for (const kind of kinds) {
        const name = String(kind.kind);
        const job = name.startsWith("reminder_")
          ? await insertJob(db, { task: TASK_1, threshold: name === "reminder_7d" ? "7d" : "24h" })
          : null;
        await db.query("select notice_send_core($1::uuid[], $2, $3, $4, $5, $6)", [
          [PARENT_ROW_F1, PARENT_ROW_F2],
          name,
          kind.target_type,
          targets[kind.target_type as string],
          `leak-${name}`,
          job,
        ]);
      }
      assert.equal(
        await count("notifications"),
        kinds.length * 2,
        "every kind reached both parents",
      );
      await db.query(
        "update email_deliveries set status = 'failed', attempts_in_round = 3, last_attempt_at = now(), finished_at = now(), claimed_at = null",
      );

      /** Everything that names or reaches a person of one family: names, addresses and phone numbers. */
      const personal = async (families: string[]) =>
        (
          await rows(
            `select display_name as v from families where id = any ($1)
             union select display_name from parents where family_id = any ($1)
             union select display_name from children where family_id = any ($1)
             union select a.email from parents p join accounts a on a.id = p.account_id where p.family_id = any ($1)
             union select pp.email_on_record from parents p join parent_profiles pp on pp.parent_id = p.id where p.family_id = any ($1)
             union select pp.phone from parents p join parent_profiles pp on pp.parent_id = p.id where p.family_id = any ($1)`,
            [families],
          )
        )
          .map((row) => String(row.v))
          .filter((value) => value.length > 2);

      const ownList = await call(PARENT_F2, "notification_list()");
      assert.equal(ownList.state, "success");
      const seen = JSON.stringify(ownList);
      const items = (ownList as unknown as { items: { title: string; text: string | null }[] })
        .items;
      assert.equal(items.length, kinds.length, "the reader sees one notice per kind");
      for (const value of await personal([FAMILY_1])) {
        assert.equal(
          seen.includes(value),
          false,
          `family 1 is not in family 2 notice list: ${value}`,
        );
      }
      assert.equal(/@|\+36/.test(seen), false, "no address or phone in a notice list");
      const rota = items.find((item) => item.title === "Közzétették a beosztást")!;
      assert.ok(rota.text!.includes("12. 14."), "the reader sees the weeks of their own family");
      assert.equal(rota.text!.includes("12. 07."), false, "and not the weeks of another family");

      const failures = await list();
      assert.equal(failures.groups!.length, kinds.length);
      const everything = JSON.stringify(failures);
      for (const value of await personal([FAMILY_1, FAMILY_2])) {
        assert.equal(
          everything.includes(value),
          false,
          `no personal data in the failure list: ${value}`,
        );
      }
      assert.equal(/@|\+36/.test(everything), false, "no address or phone in the failure list");
    });
  });
}
