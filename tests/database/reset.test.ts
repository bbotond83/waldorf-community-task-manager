import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { connectPostgres } from "../../scripts/db/postgres.ts";
import { main as resetMain, resetSchema } from "../../scripts/db/reset.ts";
import { seedSchema } from "../../scripts/db/seed.ts";
import { buildSeedPlan, SEED_PASSWORDS, seedAccount } from "../../scripts/db/seed/index.ts";
import { resetWorkerData, workerAccountEmail } from "../../scripts/db/worker.ts";
import { insertRow, insertRun, insertStaged } from "./import-support.ts";
import { insertJob } from "./notifications-support.ts";
import {
  dumpSchema,
  forbiddenInOutput,
  realSeedDeps,
  rowCount,
  runScript,
  schemaUsers,
} from "./seed-support.ts";
import {
  lockSchemas,
  openDatabase,
  prepareSchema,
  SYSTEM_ACCOUNT,
  bindSchema,
  uuid,
} from "./stack-support.ts";

/**
 * The reset command against the real local stack (NFR6.28, NFR1.64, NFR6.29): a clean schema, only the schema's own
 * sign-in users removed, the expiry and tick functions run first, one transaction, and no secret in the output.
 */
const [A, B] = ["worker_3", "worker_4"] as const;
/** Sign-in users that a reset of worker_3 must leave alone: another schema, another namespace, a longer name. */
const BYSTANDERS = [
  "worker_4.keepme@example.test",
  "identity.keepme@example.test",
  "worker_30.keepme@example.test",
];

describe("reset on the real stack", () => {
  let db: pg.Client;

  const seed = async (schema: string) => {
    return seedSchema(realSeedDeps().deps, { schema, size: "small" });
  };
  const tableNames = async (schema: string) =>
    (
      await db.query("select tablename from pg_tables where schemaname = $1 order by tablename", [
        schema,
      ])
    ).rows.map((row) => String(row.tablename));

  before(async () => {
    db = await openDatabase();
    await lockSchemas(db, [A, B]);
    for (const schema of [A, B]) await prepareSchema(db, schema);
  });
  after(async () => {
    await db.query("delete from auth.users where email = any($1)", [BYSTANDERS]);
    await db.end();
  });
  beforeEach(async () => {
    for (const schema of [A, B]) {
      await bindSchema(db, schema);
      await resetWorkerData(db, schema);
    }
    await db.query("delete from auth.users where email = any($1)", [BYSTANDERS]);
  });

  it("leaves every table empty except the reference data, the audit log included", async () => {
    await seed(A);
    const plan = buildSeedPlan(A, "small");
    await db.query(
      `insert into "${A}".audit_events (actor_account_id, actor_role, action, target_type, target_id, organization_id, outcome)
       values ($1, 'system', 'role.grant', 'account', $2, $3, 'success')`,
      [SYSTEM_ACCOUNT, uuid(1), plan.organization.id],
    );
    await db.query(
      `insert into "${A}".lifecycle_holds (target_type, target_id, organization_id, reason, placed_by_account_id)
       values ('child', $1, $2, 'legal_hold:case_1', $3)`,
      [uuid(2), plan.organization.id, SYSTEM_ACCOUNT],
    );
    await db.query(`insert into "${A}".sign_in_attempts (email_hash) values (repeat('a', 64))`);
    const { deps, lines } = realSeedDeps();
    assert.equal(await resetMain(["--schema", A], deps), 0, lines.join("\n"));
    for (const table of await tableNames(A)) {
      if (table === "sheet_registry") continue;
      assert.equal(await rowCount(db, A, table), 0, `${table} is empty after the reset`);
    }
    assert.equal(await rowCount(db, A, "sheet_registry"), 17, "the reference data stays");
    assert.deepEqual(await schemaUsers(db, A), []);
  });

  it("removes only the schema's own sign-in users and leaves another schema's data and accounts untouched", async () => {
    await seed(A);
    await seed(B);
    for (const email of BYSTANDERS) {
      await db.query(
        "insert into auth.users (id, aud, role, email, created_at, updated_at) values (gen_random_uuid(), 'authenticated', 'authenticated', $1, now(), now())",
        [email],
      );
    }
    const untouched = await dumpSchema(db, B);
    const { deps, lines } = realSeedDeps();
    assert.equal(await resetMain(["--schema", A], deps), 0, lines.join("\n"));
    assert.deepEqual(await schemaUsers(db, A), []);
    assert.deepEqual(await dumpSchema(db, B), untouched);
    const remaining = (
      await db.query("select email from auth.users where email = any($1) order by email", [
        BYSTANDERS,
      ])
    ).rows.map((row) => row.email);
    assert.deepEqual(remaining, [...BYSTANDERS].sort());
  });

  it("uses the owner connection of DATABASE_URL, never the data service connection (NFR6.28)", async () => {
    // The connection every database test and the commands open is the owner's: it can empty tables and remove
    // sign-in users, which the data service roles of the application cannot.
    const role = (
      await db.query(
        `select current_user::text as name,
                has_table_privilege(current_user, '"${A}".organizations', 'TRUNCATE') as can_truncate,
                has_table_privilege('authenticated', '"${A}".organizations', 'TRUNCATE') as service_can,
                has_table_privilege('service_role', '"${A}".organizations', 'TRUNCATE') as key_can`,
      )
    ).rows[0];
    assert.equal(role.name, "postgres");
    assert.equal(role.can_truncate, true);
    assert.equal(role.service_can, false);
    assert.equal(role.key_can, false);
    await seed(A);
    const { deps, lines } = realSeedDeps();
    assert.equal(await resetMain(["--schema", A], deps), 0, lines.join("\n"));
    assert.equal(await rowCount(db, A, "organizations"), 0);
  });

  it("shares the address namespace of db:worker: an account made the worker way is removed, another schema's is not", async () => {
    await seed(A);
    const mine = workerAccountEmail(A, "made-by-the-worker-command");
    const theirs = workerAccountEmail(B, "made-by-the-worker-command");
    for (const email of [mine, theirs]) {
      await db.query(
        "insert into auth.users (id, aud, role, email, created_at, updated_at) values (gen_random_uuid(), 'authenticated', 'authenticated', $1, now(), now())",
        [email],
      );
    }
    try {
      assert.ok(seedAccount(A, "super-admin").email.startsWith(`${A}.`));
      const { deps, lines } = realSeedDeps();
      assert.equal(await resetMain(["--schema", A], deps), 0, lines.join("\n"));
      const left = (
        await db.query("select email from auth.users where email = any($1) order by email", [
          [mine, theirs],
        ])
      ).rows.map((row) => row.email);
      assert.deepEqual(left, [theirs]);
    } finally {
      await db.query("delete from auth.users where email = any($1)", [[mine, theirs]]);
    }
  });

  it("runs the expiry and tick functions first, with effect, and only then empties the schema", async () => {
    await seed(A);
    // The helpers below insert into unqualified tables: bind the connection to the schema under test first.
    await bindSchema(db, A);
    const plan = buildSeedPlan(A, "small");
    const organization = plan.organization.id;
    const admin = seedAccount(A, "super-admin");
    // A due reminder job on a seeded task, and an import run past its seven days with a staged row.
    const task = plan.tasks[0]!;
    const startsAt = (await db.query(`select starts_at from "${A}".tasks where id = $1`, [task.id]))
      .rows[0].starts_at as Date;
    const job = await insertJob(db, {
      task: task.id,
      organization,
      status: "queued",
      startsAt: startsAt.toISOString(),
      scheduledFor: new Date(Date.now() - 60_000).toISOString(),
    });
    const run = await insertRun(db, { startedBy: admin.id, organization, status: "previewed" });
    await db.query(
      `update "${A}".import_runs set created_at = now() - interval '8 days', expires_at = now() - interval '1 hour' where id = $1`,
      [run],
    );
    await insertRow(db, { run, row: 2, organization });
    await insertStaged(db, { run, row: 2, organization });

    const seen: Record<string, unknown> = {};
    const { deps, lines } = realSeedDeps({
      connect: async (url) => {
        const client = await connectPostgres(url);
        const query = client.query.bind(client);
        client.query = async (sql: string, values?: unknown[]) => {
          if (sql === "begin") {
            // The emptying starts now: what the functions did must already be there.
            seen.job = (
              await db.query(`select status from "${A}".reminder_jobs where id = $1`, [job])
            ).rows[0]?.status;
            seen.run = (
              await db.query(`select status from "${A}".import_runs where id = $1`, [run])
            ).rows[0]?.status;
            seen.staged = await rowCount(db, A, "import_staged_rows");
            seen.attempts = await rowCount(db, A, "reminder_attempts");
          }
          return query(sql, values);
        };
        return client;
      },
    });
    assert.equal(await resetMain(["--schema", A], deps), 0, lines.join("\n"));
    assert.deepEqual(seen, { job: "sent", run: "expired", staged: 0, attempts: 1 });
    assert.match(lines[0]!, /^RESET ok schema=worker_3 organizations_processed=1$/);
    assert.equal(await rowCount(db, A, "reminder_jobs"), 0);
    assert.equal(await rowCount(db, A, "import_runs"), 0);
  });

  it("changes nothing when the emptying fails: the schema and its accounts are as they were", async () => {
    await seed(A);
    const before = await dumpSchema(db, A);
    const { deps, lines } = realSeedDeps({
      connect: async (url) => {
        const client = await connectPostgres(url);
        const query = client.query.bind(client);
        client.query = async (sql: string, values?: unknown[]) => {
          if (sql.startsWith("delete from auth.users")) throw new Error("injected failure");
          return query(sql, values);
        };
        return client;
      },
    });
    assert.equal(await resetMain(["--schema", A], deps), 1);
    assert.match(lines[0]!, /^RESET FAILED step=empty schema=worker_3: injected failure/);
    assert.deepEqual(
      await dumpSchema(db, A),
      before,
      "the truncate was rolled back with the failed deletion",
    );
  });

  it("is repeatable: a second reset of an empty schema succeeds and changes nothing", async () => {
    await seed(A);
    const first = realSeedDeps();
    assert.equal(await resetMain(["--schema", A], first.deps), 0, first.lines.join("\n"));
    const emptied = await dumpSchema(db, A);
    const second = realSeedDeps();
    assert.equal(await resetMain(["--schema", A], second.deps), 0, second.lines.join("\n"));
    assert.match(second.lines[0]!, /organizations_processed=0$/);
    assert.deepEqual(await dumpSchema(db, A), emptied);
  });

  it("keeps the audit log append-only after a reset: updates and deletes are refused again", async () => {
    await seed(A);
    await resetSchema(realSeedDeps().deps, { schema: A });
    await bindSchema(db, A);
    await db.query(
      `insert into audit_events (actor_account_id, actor_role, action, target_type, target_id, organization_id, outcome)
       values ($1, 'system', 'role.grant', 'account', $2, $3, 'success')`,
      [SYSTEM_ACCOUNT, uuid(3), uuid(4)],
    );
    for (const statement of ["update audit_events set details = 'x'", "delete from audit_events"]) {
      await assert.rejects(() => db.query(statement), /append-only/);
    }
  });

  it("refuses a schema that is not allowed, a missing stack setting and a hosted address, changing nothing", async () => {
    await seed(A);
    const before = await dumpSchema(db, A);
    const bad = realSeedDeps();
    assert.equal(await resetMain(["--schema", "auth"], bad.deps), 1);
    assert.match(bad.lines[0]!, /^RESET FAILED step=schema /);
    const hosted = realSeedDeps({
      environment: {
        DATABASE_URL: "postgresql://postgres:x@example.test:5432/postgres",
        SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_ANON_KEY: "public-key-for-tests",
        SUPABASE_SERVICE_ROLE_KEY: "service-key-for-tests",
      },
      readFile: () => undefined,
    });
    assert.equal(await resetMain(["--schema", A], hosted.deps), 1);
    assert.match(hosted.lines[0]!, /FAILED step=settings/);
    assert.deepEqual(await dumpSchema(db, A), before);
  });

  it("never prints a password, a key, a database password or a personal value (the real command, as its own process)", async () => {
    await seed(A);
    const plan = buildSeedPlan(A, "small");
    const result = await runScript("scripts/db/reset.ts", ["--schema", A]);
    assert.equal(result.status, 0, result.output);
    const lines = result.output.split("\n").filter((line) => line.startsWith("RESET "));
    assert.equal(lines.length, 1);
    assert.match(lines[0]!, /^RESET ok schema=worker_3 organizations_processed=1$/);
    assert.match(result.output, /TIMING reset\(worker_3\)/);
    const forbidden = forbiddenInOutput([
      ...Object.values(SEED_PASSWORDS),
      ...plan.accounts.map((account) => account.email),
      ...plan.parents.map((parent) => parent.name),
      ...plan.families.map((family) => family.name),
    ]);
    for (const value of forbidden) assert.ok(!result.output.includes(value));
    assert.equal(await rowCount(db, A, "families"), 0);
  });

  it("returns the number of organizations it ran the functions for", async () => {
    await seed(B);
    const result = await resetSchema(realSeedDeps().deps, { schema: B });
    assert.deepEqual([result.schema, result.organizations], [B, 1]);
  });
});
