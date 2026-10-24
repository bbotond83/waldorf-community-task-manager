import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  asActor,
  authenticated,
  CO_PARENT_F1,
  countAs,
  DEACTIVATED,
  FAMILY_1,
  openDirectoryDatabase,
  ORGANIZATION,
  OTHER_ORGANIZATION,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_CO,
  PARENT_ROW_DEACTIVATED,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  PARENT_ROW_OTHER,
  PARENT_ROW_SIGNED_OUT,
  seedDirectoryWorld,
  SIGNED_OUT,
  SUPER_ADMIN,
  uuid,
  VIEWERS,
  type ViewerName,
} from "./directory-support.ts";
import { insertJob, insertNotification, NOTIFICATION_SCHEMAS } from "./notifications-support.ts";
import { ensureAccount, failureOf } from "./stack-support.ts";

const TASK_A = uuid(9101);
const TASK_B = uuid(9102);
/** The account linked to the second organization's parent row (the seed leaves that parent unlinked). */
const OTHER_PARENT_ACCOUNT = "bbbbbbbb-0000-4000-8000-000000000041";

const NOTIFICATION_TABLES = [
  "notifications",
  "reminder_jobs",
  "reminder_recipients",
  "reminder_attempts",
] as const;

/**
 * Notifications schema: constraints, indexes, the policies per caller, cross-organization isolation and
 * the privilege list (BR40, NFR1.43, NFR1.52, NFR1.53, NFR3.13).
 */
for (const schema of NOTIFICATION_SCHEMAS) {
  describe(`notifications schema in ${schema}`, () => {
    let db: pg.Client;

    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedDirectoryWorld(db, schema);
    });

    const code = async (sql: string, values: unknown[] = []) =>
      (await failureOf(() => db.query(sql, values)))?.code;

    /** Notices for every parent row of the seed: two for the first parent, one for each of the others. */
    async function seedNotices() {
      await ensureAccount(db, { id: OTHER_PARENT_ACCOUNT, organization: OTHER_ORGANIZATION });
      await db.query("update parents set account_id = $1 where id = $2", [
        OTHER_PARENT_ACCOUNT,
        PARENT_ROW_OTHER,
      ]);
      const own = await insertNotification(db, { parent: PARENT_ROW_F1, task: TASK_A });
      await insertNotification(db, { parent: PARENT_ROW_F1, task: TASK_B, kind: "place_removed" });
      await insertNotification(db, { parent: PARENT_ROW_CO, task: TASK_A });
      await insertNotification(db, { parent: PARENT_ROW_F2, task: TASK_A });
      await insertNotification(db, { parent: PARENT_ROW_DEACTIVATED, task: TASK_A });
      await insertNotification(db, { parent: PARENT_ROW_SIGNED_OUT, task: TASK_A });
      await insertNotification(db, {
        parent: PARENT_ROW_OTHER,
        task: TASK_A,
        organization: OTHER_ORGANIZATION,
      });
      return own;
    }

    it("keeps the dedupe key unique, so a replay can never create a second notice", async () => {
      await insertNotification(db, { parent: PARENT_ROW_F1, key: "same-key" });
      assert.equal(
        await code(
          `insert into notifications (organization_id, parent_id, kind, target_type, target_ref, task_id, task_starts_at, dedupe_key)
           values ($1, $2, 'sign_up_confirmed', 'task', $3, $3, now(), 'same-key')`,
          [ORGANIZATION, PARENT_ROW_CO, TASK_A],
        ),
        "23505",
      );
    });

    it("accepts only the seven kinds and the two target types, and ties a reminder kind to a job", async () => {
      const insert = (kind: string, targetType: string, job: string | null) =>
        code(
          `insert into notifications (organization_id, parent_id, kind, target_type, target_ref, task_id, task_starts_at, reminder_job_id, dedupe_key)
           values ($1, $2, $3, $4, $5, $5, now(), $6, $7)`,
          [ORGANIZATION, PARENT_ROW_F1, kind, targetType, TASK_A, job, `k-${Math.random()}`],
        );
      const job = await insertJob(db, { task: TASK_A, status: "sent" });
      for (const kind of [
        "sign_up_confirmed",
        "swap_requested",
        "swap_decided",
        "cancellation_decided",
        "place_removed",
      ]) {
        assert.equal(await insert(kind, "task", null), undefined, kind);
      }
      for (const kind of ["reminder_7d", "reminder_24h"]) {
        assert.equal(await insert(kind, "task", job), undefined, kind);
        assert.equal(await insert(kind, "task", null), "23514", `${kind} needs a job`);
      }
      assert.equal(
        await insert("sign_up_confirmed", "task", job),
        "23514",
        "an event notice has no job",
      );
      assert.equal(await insert("shout", "task", null), "23514");
      assert.equal(await insert("sign_up_confirmed", "family", null), "23514");
    });

    it("keeps a notification, a recipient and an attempt in the organization of their job (composite keys)", async () => {
      const job = await insertJob(db, { task: TASK_A, status: "sent" });
      assert.equal(
        await code(
          `insert into notifications (organization_id, parent_id, kind, target_type, target_ref, task_id, task_starts_at, reminder_job_id, dedupe_key)
           values ($1, $2, 'reminder_24h', 'task', $3, $3, now(), $4, 'cross-1')`,
          [OTHER_ORGANIZATION, PARENT_ROW_OTHER, TASK_A, job],
        ),
        "23503",
      );
      assert.equal(
        await code(
          "insert into reminder_recipients (organization_id, reminder_job_id, family_id) values ($1, $2, $3)",
          [OTHER_ORGANIZATION, job, FAMILY_1],
        ),
        "23503",
      );
      assert.equal(
        await code(
          "insert into reminder_attempts (organization_id, reminder_job_id, attempt_number, outcome) values ($1, $2, 1, 'simulated_sent')",
          [OTHER_ORGANIZATION, job],
        ),
        "23503",
      );
      assert.equal(
        await code(
          "insert into reminder_recipients (organization_id, reminder_job_id, family_id) values ($1, $2, $3)",
          [ORGANIZATION, job, FAMILY_1],
        ),
        undefined,
      );
    });

    it("allows one live job per task and threshold, and a new one once the old one is stale or cancelled (BR40.4)", async () => {
      const first = await insertJob(db, { task: TASK_A, threshold: "24h" });
      await assert.rejects(insertJob(db, { task: TASK_A, threshold: "24h", status: "sent" }), {
        code: "23505",
      });
      // The other threshold and another task are separate causes.
      await insertJob(db, { task: TASK_A, threshold: "7d" });
      await insertJob(db, { task: TASK_B, threshold: "24h" });
      await db.query("update reminder_jobs set status = 'stale' where id = $1", [first]);
      await insertJob(db, { task: TASK_A, threshold: "24h" });
      await db.query(
        "update reminder_jobs set status = 'cancelled' where task_id = $1 and threshold = '24h' and status = 'queued'",
        [TASK_A],
      );
      await insertJob(db, { task: TASK_A, threshold: "24h" });
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from reminder_jobs where task_id = $1 and threshold = '24h'",
            [TASK_A],
          )
        ).rows[0].n,
        3,
        "stale and cancelled jobs stay as history",
      );
    });

    it("limits a job's status, threshold and attempt count, and numbers the attempts one to three, once each (BR40.6)", async () => {
      const bad = (column: string, value: string) =>
        code(
          `insert into reminder_jobs (organization_id, task_id, threshold, task_starts_at, scheduled_for, correlation_id, ${column})
           values ($1, $2, '24h', now(), now(), 'corr-abcdef', $3)`,
          [ORGANIZATION, uuid(9200 + Math.floor(Math.random() * 1000)), value],
        );
      assert.equal(await bad("status", "paused"), "23514");
      assert.equal(await bad("attempt", "4"), "23514");
      assert.equal(await bad("attempt", "-1"), "23514");
      assert.equal(
        await code(
          "insert into reminder_jobs (organization_id, task_id, threshold, task_starts_at, scheduled_for, correlation_id) values ($1, $2, '48h', now(), now(), 'corr-abcdef')",
          [ORGANIZATION, TASK_A],
        ),
        "23514",
      );
      assert.equal(
        await code(
          "insert into reminder_jobs (organization_id, task_id, threshold, task_starts_at, scheduled_for, correlation_id) values ($1, $2, '24h', now(), now(), 'Has A Space')",
          [ORGANIZATION, TASK_A],
        ),
        "23514",
        "the correlation id is a short lower-case token",
      );
      const job = await insertJob(db, { task: TASK_A });
      const attempt = (number: number, outcome = "simulated_retry") =>
        code(
          "insert into reminder_attempts (organization_id, reminder_job_id, attempt_number, outcome) values ($1, $2, $3, $4)",
          [ORGANIZATION, job, number, outcome],
        );
      assert.equal(await attempt(1), undefined);
      assert.equal(await attempt(1), "23505", "an attempt number is used once");
      assert.equal(await attempt(2), undefined);
      assert.equal(await attempt(3, "simulated_failed"), undefined);
      assert.equal(await attempt(4), "23514", "at most three attempts per job");
      assert.equal(await attempt(0), "23514");
      const other = await insertJob(db, { task: TASK_B });
      assert.equal(
        await code(
          "insert into reminder_attempts (organization_id, reminder_job_id, attempt_number, outcome) values ($1, $2, 1, 'delivered')",
          [ORGANIZATION, other],
        ),
        "23514",
        "only the three simulated outcomes exist",
      );
    });

    it("keeps one recipient row per job and family, and raises the job version on every accepted update", async () => {
      const job = await insertJob(db, { task: TASK_A });
      await db.query(
        "insert into reminder_recipients (organization_id, reminder_job_id, family_id) values ($1, $2, $3)",
        [ORGANIZATION, job, FAMILY_1],
      );
      assert.equal(
        await code(
          "insert into reminder_recipients (organization_id, reminder_job_id, family_id) values ($1, $2, $3)",
          [ORGANIZATION, job, FAMILY_1],
        ),
        "23505",
      );
      assert.equal(
        await code(
          "insert into reminder_recipients (organization_id, reminder_job_id, family_id, status) values ($1, $2, $3, 'gone')",
          [ORGANIZATION, job, uuid(9300)],
        ),
        "23514",
      );
      const before = (await db.query("select version from reminder_jobs where id = $1", [job]))
        .rows[0].version as number;
      await db.query("update reminder_jobs set status = 'sent', attempt = 1 where id = $1", [job]);
      const after = (await db.query("select version from reminder_jobs where id = $1", [job]))
        .rows[0].version as number;
      assert.equal(after, before + 1);
    });

    it("has the indexes the policies and functions need (NFR3.13)", async () => {
      const indexes = (
        await db.query(
          "select tablename, indexdef from pg_indexes where schemaname = current_schema() and tablename = any($1)",
          [[...NOTIFICATION_TABLES]],
        )
      ).rows as { tablename: string; indexdef: string }[];
      const has = (table: string, fragment: string) =>
        indexes.some((row) => row.tablename === table && row.indexdef.includes(fragment));
      assert.ok(has("notifications", "(parent_id, created_at DESC)"), "the parent's list");
      assert.ok(has("notifications", "(dedupe_key)"), "the dedupe key");
      assert.ok(has("notifications", "(task_id)"), "notices by task");
      assert.ok(has("reminder_jobs", "UNIQUE INDEX reminder_jobs_one_live"), "one live job");
      assert.ok(
        has("reminder_jobs", "(task_id, threshold)") &&
          indexes
            .find((row) => row.indexdef.includes("reminder_jobs_one_live"))!
            .indexdef.includes("stale"),
        "the live job is unique per task and threshold, stale and cancelled excluded",
      );
      assert.ok(has("reminder_jobs", "(status, scheduled_for)"), "due jobs");
      assert.ok(
        has("reminder_recipients", "(reminder_job_id, family_id)"),
        "recipients by job and family",
      );
      assert.ok(has("reminder_recipients", "(family_id, status)"), "recipients by family");
      assert.ok(has("reminder_attempts", "(reminder_job_id, attempt_number)"), "attempts by job");
    });

    /** Rows each viewer sees of the seeded notices: only the parent whose notice it is sees any (NFR1.43). */
    const NOTICES_SEEN: Record<ViewerName, number> = {
      parent: 2,
      coParent: 1,
      parentOther: 1,
      teacher: 0,
      adminSame: 0,
      adminOther: 0,
      super: 0,
      nogrant: 0,
      deactivated: 0,
      signedOut: 0,
      otherOrganizationAdmin: 0,
    };

    it("shows each role exactly its own notices: a parent sees their own rows, nobody else sees any, an admin sees none (BR40.2, NFR1.43)", async () => {
      await seedNotices();
      for (const [viewer, rows] of Object.entries(NOTICES_SEEN) as [ViewerName, number][]) {
        assert.equal(
          await countAs(db, schema, VIEWERS[viewer], "notifications"),
          rows,
          `notifications as ${viewer}`,
        );
      }
      assert.equal(await countAs(db, schema, OTHER_PARENT_ACCOUNT, "notifications"), 1);
      const anon = await failureOf(() =>
        asActor(db, schema, { role: "anon" }, () => db.query("select count(*) from notifications")),
      );
      assert.equal(anon?.code, "42501", "the signed-out data API role has no table right");
    });

    it("lets a parent set read_at on their own notice only, and nothing else of any notice (BR40.3)", async () => {
      const own = await seedNotices();
      const foreign = (
        await db.query("select id from notifications where parent_id = $1", [PARENT_ROW_F2])
      ).rows[0].id as string;
      const update = (account: string, id: string, set = "read_at = now()") =>
        asActor(
          db,
          schema,
          authenticated(account),
          async () =>
            (await db.query(`update notifications set ${set} where id = $1`, [id])).rowCount,
        );
      assert.equal(await update(PARENT_F1, foreign), 0, "another parent's notice is not updatable");
      assert.equal(await update(CO_PARENT_F1, own), 0, "not even the co-parent's");
      assert.equal(await update(VIEWERS.adminSame, own), 0);
      assert.equal(await update(PARENT_F1, own), 1);
      assert.ok(
        (await db.query("select read_at from notifications where id = $1", [own])).rows[0].read_at,
      );
      for (const set of [
        "kind = 'place_removed'",
        "parent_id = '" + PARENT_ROW_F2 + "'",
        "task_id = gen_random_uuid()",
      ]) {
        const failure = await failureOf(() => update(PARENT_F1, own, set));
        assert.equal(failure?.code, "42501", set);
      }
      const insert = await failureOf(() =>
        asActor(db, schema, authenticated(PARENT_F1), () =>
          db.query(
            `insert into notifications (organization_id, parent_id, kind, target_type, target_ref, task_id, task_starts_at, dedupe_key)
             values ($1, $2, 'sign_up_confirmed', 'task', $3, $3, now(), 'self-made')`,
            [ORGANIZATION, PARENT_ROW_F1, TASK_A],
          ),
        ),
      );
      assert.equal(insert?.code, "42501", "a parent cannot write a notice");
      const remove = await failureOf(() =>
        asActor(db, schema, authenticated(PARENT_F1), () =>
          db.query("delete from notifications where id = $1", [own]),
        ),
      );
      assert.equal(remove?.code, "42501", "a parent cannot delete a notice");
    });

    it("sets read_at once: it can neither be changed nor cleared afterwards, by anyone (BR40.3)", async () => {
      const own = await seedNotices();
      await db.query("update notifications set read_at = now() where id = $1", [own]);
      const first = (await db.query("select read_at from notifications where id = $1", [own]))
        .rows[0].read_at as Date;
      assert.equal(
        await code("update notifications set read_at = now() + interval '1 hour' where id = $1", [
          own,
        ]),
        "23514",
      );
      assert.equal(
        await code("update notifications set read_at = null where id = $1", [own]),
        "23514",
      );
      assert.equal(
        await code("update notifications set read_at = read_at where id = $1", [own]),
        undefined,
        "writing the same time again is harmless",
      );
      const again = (await db.query("select read_at from notifications where id = $1", [own]))
        .rows[0].read_at as Date;
      assert.equal(again.getTime(), first.getTime());
    });

    it("gives no role any direct right on the reminder tables, super admins included (BR40.8)", async () => {
      await seedNotices();
      const job = await insertJob(db, { task: TASK_A });
      await db.query(
        "insert into reminder_recipients (organization_id, reminder_job_id, family_id) values ($1, $2, $3)",
        [ORGANIZATION, job, FAMILY_1],
      );
      for (const table of ["reminder_jobs", "reminder_recipients", "reminder_attempts"]) {
        for (const viewer of [
          "parent",
          "teacher",
          "adminSame",
          "super",
          "otherOrganizationAdmin",
        ] as const) {
          const failure = await failureOf(() =>
            asActor(db, schema, authenticated(VIEWERS[viewer]), () =>
              db.query(`select * from ${table}`),
            ),
          );
          assert.equal(failure?.code, "42501", `${table} as ${viewer}`);
        }
        const write = await failureOf(() =>
          asActor(db, schema, authenticated(SUPER_ADMIN), () => db.query(`delete from ${table}`)),
        );
        assert.equal(write?.code, "42501", `${table} delete as super admin`);
      }
    });

    it("gives the service-role key and the signed-out role no table right on any notification table (NFR1.52)", async () => {
      for (const role of ["service_role", "anon"] as const) {
        for (const table of NOTIFICATION_TABLES) {
          for (const sql of [
            `select count(*) from ${table}`,
            `delete from ${table}`,
            `update ${table} set id = id`,
          ]) {
            const failure = await failureOf(() =>
              asActor(db, schema, { role }, () => db.query(sql)),
            );
            assert.equal(failure?.code, "42501", `${role}: ${sql}`);
          }
        }
      }
      const rights = (
        await db.query(
          `select t.table_name, has_table_privilege('service_role', quote_ident(t.table_schema) || '.' || quote_ident(t.table_name), 'select,insert,update,delete') as service,
                  has_table_privilege('anon', quote_ident(t.table_schema) || '.' || quote_ident(t.table_name), 'select,insert,update,delete') as anon,
                  has_table_privilege('authenticated', quote_ident(t.table_schema) || '.' || quote_ident(t.table_name), 'insert,delete,truncate') as writes
             from information_schema.tables t
            where t.table_schema = current_schema() and t.table_name = any($1) order by 1`,
          [[...NOTIFICATION_TABLES]],
        )
      ).rows;
      assert.equal(rights.length, 4);
      for (const row of rights) {
        assert.deepEqual(
          [row.service, row.anon, row.writes],
          [false, false, false],
          String(row.table_name),
        );
      }
    });

    it("grants a signed-in account select on notifications and update of read_at only, no other column (privilege list)", async () => {
      const columns = (
        await db.query(
          `select column_name,
                  has_column_privilege('authenticated', quote_ident(current_schema()) || '.notifications', column_name, 'update') as can_update,
                  has_column_privilege('authenticated', quote_ident(current_schema()) || '.notifications', column_name, 'select') as can_select
             from information_schema.columns
            where table_schema = current_schema() and table_name = 'notifications' order by ordinal_position`,
        )
      ).rows;
      assert.ok(columns.length >= 11);
      for (const column of columns) {
        assert.equal(column.can_select, true, `select ${column.column_name}`);
        assert.equal(
          column.can_update,
          column.column_name === "read_at",
          `update ${column.column_name}`,
        );
      }
      const grants = (
        await db.query(
          "select has_function_privilege('authenticated', 'notification_actor_parent()', 'execute') as authenticated, has_function_privilege('anon', 'notification_actor_parent()', 'execute') as anon, has_function_privilege('service_role', 'notification_actor_parent()', 'execute') as service",
        )
      ).rows[0];
      assert.deepEqual(grants, { authenticated: true, anon: false, service: false });
    });

    it("isolates organizations: a parent reads nothing of another organization and the other organization's parent reads only their own (NFR1.53)", async () => {
      await seedNotices();
      assert.equal(
        await countAs(
          db,
          schema,
          PARENT_F1,
          "notifications",
          `organization_id = '${OTHER_ORGANIZATION}'`,
        ),
        0,
      );
      assert.equal(
        await countAs(
          db,
          schema,
          OTHER_PARENT_ACCOUNT,
          "notifications",
          `organization_id = '${ORGANIZATION}'`,
        ),
        0,
      );
      assert.equal(await countAs(db, schema, SUPER_ADMIN, "notifications"), 0);
      const actorParent = (account: string) =>
        asActor(
          db,
          schema,
          authenticated(account),
          async () =>
            (await db.query("select notification_actor_parent() as id")).rows[0].id as
              string | null,
        );
      assert.equal(await actorParent(PARENT_F1), PARENT_ROW_F1);
      assert.equal(await actorParent(OTHER_PARENT_ACCOUNT), PARENT_ROW_OTHER);
      assert.equal(
        await actorParent(SUPER_ADMIN),
        null,
        "an admin without a parent row has no reader id",
      );
      assert.equal(await actorParent(PARENT_F2), PARENT_ROW_F2);
    });

    it("stops reading for a deactivated account, an account without a session and an archived parent (BR40.2)", async () => {
      await seedNotices();
      assert.equal(await countAs(db, schema, DEACTIVATED, "notifications"), 0);
      assert.equal(await countAs(db, schema, SIGNED_OUT, "notifications"), 0);
      assert.equal(await countAs(db, schema, PARENT_F1, "notifications"), 2);
      await db.query("update parents set status = 'archived' where id = $1", [PARENT_ROW_F1]);
      assert.equal(await countAs(db, schema, PARENT_F1, "notifications"), 0);
    });
  });
}
