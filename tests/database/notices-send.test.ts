import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  ADMIN_G1,
  asActor,
  authenticated,
  FAMILY_OTHER,
  OTHER_ORGANIZATION,
  ORGANIZATION,
  openDirectoryDatabase,
  PARENT_F1,
  PARENT_ROW_CO,
  PARENT_ROW_DEACTIVATED,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  PARENT_ROW_OTHER,
  REQUEST_1,
  seedCoordinationWorld,
  SUPER_ADMIN,
  TASK_1,
  TEACHER_G1,
} from "./directory-support.ts";
import { NOTIFICATION_SCHEMAS } from "./notifications-support.ts";
import { bindSchema, ensureAccount, failureOf, openDatabase } from "./stack-support.ts";

const ROTA_PLAN_MISSING = "99999999-0000-4000-8000-000000000001";

/**
 * The internal notice function (C8, BR50) on the real stack: it queues one notice and one email delivery for each
 * named parent who is active and has an active account, never contacts a mail server and stores no address. It is
 * called by feature functions inside their own transaction, so no application role can call it; the cases below
 * call it as the schema owner, which counts as the system caller, and check that every application role is refused.
 *
 * The fixed list: allowed; refused; out of reach; outdated screen (not meaningful for notice_send: an internal function
 * with no screen; the function has no screen and
 * takes no version, the registries it reads are written by migration only); repeated click (the same once key);
 * two at once.
 */
for (const schema of NOTIFICATION_SCHEMAS) {
  describe(`notice_send in ${schema}`, () => {
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

    const send = async (
      parents: string[],
      kind = "sign_up_confirmed",
      target: string = TASK_1,
      key = "once-a",
      targetType = "task",
      client: pg.Client = db,
    ) =>
      (
        await client.query("select notice_send($1::uuid[], $2, $3, $4, $5) as made", [
          parents,
          kind,
          targetType,
          target,
          key,
        ])
      ).rows[0].made as number;
    const rows = async (sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows;
    const refusedCode = async (work: () => Promise<unknown>) => {
      const error = (await failureOf(work)) as
        (Error & { code?: string; detail?: string }) | undefined;
      assert.equal(error?.code, "U3R00", "a refusal is raised through U3R00");
      return (JSON.parse(error?.detail ?? "{}") as { code?: string }).code;
    };

    it("allowed: queues one notice and one email delivery per active parent with an account, and stores no address (BR50.1, NFR1.2)", async () => {
      const made = await send([PARENT_ROW_F1, PARENT_ROW_F2, PARENT_ROW_CO]);
      assert.equal(made, 3);
      const notices = await rows(
        "select parent_id, kind, target_type, target_ref, task_id, organization_id, dedupe_key from notifications order by parent_id",
      );
      assert.equal(notices.length, 3);
      for (const notice of notices) {
        assert.equal(notice.kind, "sign_up_confirmed");
        assert.equal(notice.target_ref, TASK_1);
        assert.equal(notice.task_id, TASK_1);
        assert.equal(notice.organization_id, ORGANIZATION);
      }
      const deliveries = await rows(
        `select d.status, d.round, d.attempts_in_round, d.kind, d.target_id, d.item_date::text as item_date,
                (select (t.starts_at at time zone 'Europe/Budapest')::date::text from tasks t where t.id = d.target_id) as task_date
           from email_deliveries d order by d.parent_id`,
      );
      assert.equal(deliveries.length, 3);
      for (const delivery of deliveries) {
        assert.deepEqual(
          [delivery.status, delivery.round, delivery.attempts_in_round],
          ["queued", 1, 0],
        );
        assert.equal(
          delivery.item_date,
          delivery.task_date,
          "the item's Budapest date is kept at send time",
        );
      }
      const everything = JSON.stringify(
        await rows(
          "select to_jsonb(n) as n, (select to_jsonb(d) from email_deliveries d where d.notice_id = n.id) as d from notifications n",
        ),
      );
      assert.equal(
        /@|example\.test|Fenyő|Napraforgó/.test(everything),
        false,
        "no address and no name is stored",
      );
      assert.equal(
        (await rows("select count(*)::int as n from email_attempts"))[0]!.n,
        0,
        "nothing was tried",
      );
    });

    it("allowed: a notice about a change request and the rota notice carry their own target and no task link (BR50.4)", async () => {
      assert.equal(
        await send(
          [PARENT_ROW_F1],
          "cancellation_decided",
          REQUEST_1,
          "once-req",
          "change_request",
        ),
        1,
      );
      assert.equal(
        await send([PARENT_ROW_F1], "rota_published", ROTA_PLAN_MISSING, "once-rota", "rota_plan"),
        1,
      );
      const found = await rows(
        "select kind, target_type, task_id from notifications order by kind",
      );
      assert.deepEqual(
        found.map((row) => [row.kind, row.target_type, row.task_id === null]),
        [
          ["cancellation_decided", "change_request", false],
          ["rota_published", "rota_plan", true],
        ],
      );
    });

    it("refused: an unknown kind, an unknown target type, a kind on the wrong target, a missing or extra job, an empty list and a missing key raise U3R00 and write nothing (BR50.3)", async () => {
      const cases: [string, () => Promise<unknown>][] = [
        ["NOTICE_KIND_UNKNOWN", () => send([PARENT_ROW_F1], "no_such_kind")],
        [
          "NOTICE_TARGET_UNKNOWN",
          () => send([PARENT_ROW_F1], "sign_up_confirmed", TASK_1, "k", "no_such_target"),
        ],
        [
          "NOTICE_REQUEST_INVALID",
          () => send([PARENT_ROW_F1], "rota_published", TASK_1, "k", "task"),
        ],
        ["NOTICE_REQUEST_INVALID", () => send([PARENT_ROW_F1], "reminder_24h")],
        [
          "NOTICE_REQUEST_INVALID",
          async () =>
            db.query(
              "select notice_send_core($1::uuid[], 'sign_up_confirmed', 'task', $2, 'k', gen_random_uuid())",
              [[PARENT_ROW_F1], TASK_1],
            ),
        ],
        ["NOTICE_REQUEST_INVALID", () => send([], "sign_up_confirmed")],
        ["NOTICE_REQUEST_INVALID", () => send([PARENT_ROW_F1], "sign_up_confirmed", TASK_1, "")],
        [
          "NOTICE_REQUEST_INVALID",
          () => send([PARENT_ROW_F1], "sign_up_confirmed", ROTA_PLAN_MISSING),
        ],
      ];
      for (const [code, work] of cases) assert.equal(await refusedCode(work), code, code);
      assert.equal((await rows("select count(*)::int as n from notifications"))[0]!.n, 0);
      assert.equal((await rows("select count(*)::int as n from email_deliveries"))[0]!.n, 0);
    });

    it("refused: no application role can call notice_send, its facts, the checks or the housekeeping, and no one writes the registries (NFR3.1, NFR3.7)", async () => {
      const calls = [
        "select notice_send(array[$1::uuid], 'sign_up_confirmed', 'task', $2::uuid, 'k')",
        "select notice_facts_task($2::uuid, $1::uuid, 'sign_up_confirmed')",
        "select notice_facts_working_group($2::uuid, $1::uuid, 'coordinator_appointed')",
        "select notice_describe('sign_up_confirmed', 'task', $2::uuid, $1::uuid)",
        "select duty_reminders_due_check(now())",
        "select housekeeping_due_check(now())",
      ];
      const registries = [
        "insert into notice_kinds (kind, target_type, title_prefix, label, added_by) values ('extra_kind', 'task', 'x', 'x', 'T')",
        "insert into notice_targets (target_type, facts_function, added_by) values ('extra_target', 'notice_facts_task', 'T')",
        "insert into timed_check_registry (check_name, function_name, run_kind, lock_step, added_by) values ('extra_check', 'housekeeping_due_check', 'daily', 1, 'T')",
        "update notice_kinds set label = 'x'",
        "delete from timed_check_registry",
      ];
      const roles = [
        { role: "anon" as const },
        authenticated(PARENT_F1),
        authenticated(TEACHER_G1),
        authenticated(ADMIN_G1),
        authenticated(SUPER_ADMIN),
        { role: "service_role" as const },
      ];
      for (const actor of roles) {
        for (const sql of calls) {
          const error = await failureOf(() =>
            asActor(db, schema, actor, () =>
              db.query(sql, sql.includes("$1") ? [PARENT_ROW_F1, TASK_1] : []),
            ),
          );
          assert.equal(error?.code, "42501", `${actor.role}: ${sql}`);
        }
        for (const sql of registries) {
          const error = await failureOf(() => asActor(db, schema, actor, () => db.query(sql)));
          assert.equal(
            (error as { code?: string } | undefined)?.code,
            "42501",
            `${actor.role}: ${sql}`,
          );
        }
      }
      // Eight kinds of U5, the two coordinator kinds that U4 registered, the six of U6 the three event kinds of U10, the two library kinds of U13, the two recurring-duty kinds of U9 the two checklist kinds of U11, the four animal-care kinds of U8 and the two to-do kinds of U12.
      assert.equal((await rows("select count(*)::int as n from notice_kinds"))[0]!.n, 36);
    });

    it("refused: a registry name with a quote or a capital is refused by the name pattern (NFR3.7)", async () => {
      for (const sql of [
        `insert into notice_kinds (kind, target_type, title_prefix, label, added_by) values ('bad"kind', 'task', 'x', 'x', 'T')`,
        `insert into notice_kinds (kind, target_type, title_prefix, label, added_by) values ('Bad_kind', 'task', 'x', 'x', 'T')`,
        `insert into notice_targets (target_type, facts_function, added_by) values ('t2', 'f"; drop table notifications; --', 'T')`,
        `insert into timed_check_registry (check_name, function_name, run_kind, lock_step, added_by) values ('c2', 'f(); --', 'daily', 1, 'T')`,
        `insert into timed_check_registry (check_name, function_name, run_kind, lock_step, added_by) values ('c3', 'housekeeping_due_check', 'daily', 0, 'T')`,
      ]) {
        const error = await failureOf(() => db.query(sql));
        assert.equal(error?.code, "23514", sql);
      }
    });

    it("out of reach: an archived parent, a parent without an account, a deactivated account and a parent of another community get no notice and no email (NFR3.2)", async () => {
      await db.query("update parents set status = 'archived' where id = $1", [PARENT_ROW_CO]);
      assert.equal(await send([PARENT_ROW_CO, PARENT_ROW_DEACTIVATED, PARENT_ROW_OTHER]), 0);
      assert.equal((await rows("select count(*)::int as n from notifications"))[0]!.n, 0);
      assert.equal((await rows("select count(*)::int as n from email_deliveries"))[0]!.n, 0);
    });

    it("out of reach: a system call takes the community from the parent, not from the call (NFR3.2)", async () => {
      const account = "bbbbbbbb-0000-4000-8000-0000000000f1";
      await ensureAccount(db, { id: account, organization: OTHER_ORGANIZATION });
      await db.query("update parents set account_id = $2 where id = $1", [
        PARENT_ROW_OTHER,
        account,
      ]);
      assert.equal(await send([PARENT_ROW_F1, PARENT_ROW_OTHER]), 2);
      const found = await rows(
        "select parent_id, organization_id from notifications order by parent_id",
      );
      const byParent = new Map(
        found.map((row) => [row.parent_id as string, row.organization_id as string]),
      );
      assert.equal(byParent.get(PARENT_ROW_F1), ORGANIZATION);
      assert.equal(byParent.get(PARENT_ROW_OTHER), OTHER_ORGANIZATION);
      const deliveries = await rows("select parent_id, organization_id from email_deliveries");
      for (const delivery of deliveries) {
        assert.equal(delivery.organization_id, byParent.get(delivery.parent_id as string));
      }
      assert.ok(FAMILY_OTHER, "the other community's family exists in the fixture");
    });

    it("repeated click: the same once key creates nothing more for the same parent, and a new parent under it still gets a notice (BR50.2)", async () => {
      assert.equal(await send([PARENT_ROW_F1]), 1);
      assert.equal(await send([PARENT_ROW_F1]), 0);
      assert.equal(
        await send([PARENT_ROW_F1, PARENT_ROW_F2]),
        1,
        "only the parent without a notice under the key",
      );
      assert.equal(
        await send([PARENT_ROW_F1], "sign_up_confirmed", TASK_1, "once-b"),
        1,
        "another key is another event",
      );
      assert.equal((await rows("select count(*)::int as n from notifications"))[0]!.n, 3);
      assert.equal((await rows("select count(*)::int as n from email_deliveries"))[0]!.n, 3);
    });

    it("two at once: two callers sending under one key create one notice and one email per parent (NFR5.3)", async () => {
      for (let round = 0; round < 5; round += 1) {
        const key = `race-${round}`;
        const made = await Promise.all([
          send([PARENT_ROW_F1, PARENT_ROW_F2], "sign_up_confirmed", TASK_1, key, "task", db),
          send([PARENT_ROW_F1, PARENT_ROW_F2], "sign_up_confirmed", TASK_1, key, "task", second),
        ]);
        assert.equal(made[0]! + made[1]!, 2, `round ${round}: two notices in all`);
      }
      assert.equal((await rows("select count(*)::int as n from notifications"))[0]!.n, 10);
      assert.equal(
        (
          await rows(
            "select count(*)::int as n from (select notice_id from email_deliveries group by notice_id having count(*) > 1) x",
          )
        )[0]!.n,
        0,
        "one email per notice",
      );
    });
  });
}
