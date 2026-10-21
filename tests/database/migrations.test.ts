import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";
import pg from "pg";
import { loadToolingSettings } from "../../scripts/db/common.ts";
import {
  FRESH_SCHEMA_SETTINGS,
  main as migrateMain,
  type MigrateDeps,
  defaultMigrateDeps,
} from "../../scripts/db/migrate.ts";
import {
  applyMigrations,
  checksumOf,
  readMigrationFiles,
  TRACKING_SCHEMA,
} from "../../scripts/db/runner.ts";
import { ACKNOWLEDGE_ALL_INTERFACES, defaultStackDeps } from "../../scripts/db/stack.ts";
import { main as startMain } from "../../scripts/db/start.ts";
import { bootstrapSql } from "../../scripts/db/worker.ts";
import {
  lockSchemas,
  openDatabase,
  report,
  root,
  serviceKey,
  stackSettings,
} from "./stack-support.ts";

const migrations = readMigrationFiles(`${root}supabase/migrations`);
const QUIET = () => {};
const run = (client: pg.Client, schema: string, extra: typeof migrations = []) =>
  applyMigrations({
    client,
    schema,
    files: [...migrations, ...extra],
    log: QUIET,
    now: () => Date.now(),
    freshSchemaSettings: FRESH_SCHEMA_SETTINGS,
  });

describe("migrations on the real local stack", () => {
  let db: pg.Client;

  before(async () => {
    db = await openDatabase();
    await lockSchemas(db, ["public", "worker_4"]);
  });
  after(async () => {
    await db.end();
  });

  it("applies every file to an empty database with no manual step, and a second run changes nothing", async () => {
    const name = "migrations_empty_test";
    await db.query(`drop database if exists ${name} with (force)`);
    await db.query(`create database ${name}`);
    const url = new URL(stackSettings().databaseUrl);
    url.pathname = `/${name}`;
    const empty = new pg.Client({ connectionString: url.toString() });
    await empty.connect();
    try {
      // The sign-in service owns this schema on the real stack; an empty database needs its function.
      await empty.query(
        `create schema auth;
         create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
         create function auth.jwt() returns jsonb language sql stable as $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
         create table auth.users (id uuid primary key, email text, email_change text, banned_until timestamptz, raw_app_meta_data jsonb, created_at timestamptz);
         create table auth.sessions (id uuid primary key, user_id uuid not null references auth.users (id) on delete cascade, created_at timestamptz, refreshed_at timestamp, not_after timestamptz)`,
      );
      const first = await run(empty, "public");
      assert.deepEqual(
        first.applied,
        migrations.map((file) => file.name),
      );
      const snapshot = async () =>
        (
          await empty.query(
            "select (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public') as functions, (select count(*) from pg_tables where schemaname = 'public') as tables, (select count(*) from pg_policies where schemaname = 'public') as policies",
          )
        ).rows[0];
      const before = await snapshot();
      const second = await run(empty, "public");
      assert.deepEqual(second.applied, []);
      assert.deepEqual(
        second.upToDate,
        migrations.map((file) => file.name),
      );
      assert.deepEqual(await snapshot(), before);
    } finally {
      await empty.end();
      await db.query(`drop database if exists ${name} with (force)`);
    }
  });

  it("applies every file to a worker schema without creating anything in the default schema", async () => {
    const tablesIn = async (schema: string) =>
      (
        await db.query("select tablename from pg_tables where schemaname = $1 order by tablename", [
          schema,
        ])
      ).rows.map((row) => row.tablename);
    const publicBefore = await tablesIn("public");
    await db.query("drop schema if exists worker_4 cascade");
    await db.query(
      `delete from ${TRACKING_SCHEMA}.applied_migrations where schema_name = 'worker_4'`,
    );
    for (const statement of bootstrapSql("worker_4")) await db.query(statement);
    const started = performance.now();
    const result = await run(db, "worker_4");
    const seconds = (performance.now() - started) / 1000;
    report(`migrations applied to a fresh worker schema in ${seconds.toFixed(2)} s (target 30 s)`);
    assert.equal(result.applied.length, migrations.length);
    const tables = await tablesIn("worker_4");
    for (const table of [
      "app_role_grants",
      "audit_events",
      "idempotency_records",
      "lifecycle_holds",
    ]) {
      assert.ok(tables.includes(table), table);
    }
    assert.deepEqual(await tablesIn("public"), publicBefore);
    const tracked = await db.query(
      `select filename, checksum from ${TRACKING_SCHEMA}.applied_migrations where schema_name = 'worker_4' order by filename`,
    );
    assert.deepEqual(
      tracked.rows,
      migrations.map((file) => ({ filename: file.name, checksum: file.checksum })),
    );
  });

  for (const schema of ["public", "worker_4"]) {
    it(`pins the search path of every function in ${schema} to its own schema and the system catalogue`, async () => {
      const result = await db.query(
        "select proname, prosecdef, proconfig from pg_proc where pronamespace = $1::regnamespace order by proname",
        [schema],
      );
      assert.ok(
        result.rows.filter((row) => row.prosecdef).length >= 10,
        "elevated functions exist",
      );
      for (const row of result.rows) {
        const pinned = (row.proconfig as string[] | null)?.find((entry) =>
          entry.startsWith("search_path="),
        );
        assert.ok(pinned, `${row.proname} has no pinned search path`);
        assert.equal(pinned.replace(/"/g, ""), `search_path=${schema}, pg_catalog`, row.proname);
      }
    });
  }

  it("follows the table conventions: uuid keys generated by the database, scope columns, versions (BR3.1)", async () => {
    const column = async (table: string, name: string) =>
      (
        await db.query(
          "select data_type, column_default from information_schema.columns where table_schema = 'public' and table_name = $1 and column_name = $2",
          [table, name],
        )
      ).rows[0];
    for (const table of ["audit_events", "idempotency_records", "lifecycle_holds"]) {
      const id = await column(table, "id");
      assert.equal(id?.data_type, "uuid", table);
      assert.match(String(id?.column_default), /gen_random_uuid\(\)/, table);
      const key = await db.query(
        "select a.attname from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey) where i.indrelid = $1::regclass and i.indisprimary",
        [`public.${table}`],
      );
      assert.deepEqual(
        key.rows.map((row) => row.attname),
        ["id"],
        table,
      );
    }
    assert.equal((await column("audit_events", "organization_id"))?.data_type, "uuid");
    assert.equal((await column("audit_events", "group_id"))?.data_type, "uuid");
    assert.equal((await column("lifecycle_holds", "organization_id"))?.data_type, "uuid");
    assert.equal((await column("lifecycle_holds", "version"))?.data_type, "integer");
    assert.equal(
      (await column("lifecycle_holds", "updated_at"))?.data_type,
      "timestamp with time zone",
    );
  });

  it("gives application roles no rights on the platform tables and none on the internal functions", async () => {
    for (const role of ["anon", "authenticated", "service_role"]) {
      for (const table of ["audit_events", "idempotency_records", "lifecycle_holds"]) {
        for (const privilege of ["select", "insert", "update", "delete"]) {
          const result = await db.query(
            "select has_table_privilege($1, $2::regclass, $3) as allowed",
            [role, `public.${table}`, privilege],
          );
          // U2 settles U1's open item: admins read the audit events through a read policy (BR2.15).
          const readsAudit =
            role === "authenticated" && table === "audit_events" && privilege === "select";
          assert.equal(result.rows[0].allowed, readsAudit, `${role} ${privilege} ${table}`);
        }
      }
      for (const fn of [
        "platform_audit_write(text,text,uuid,uuid,uuid,text,text)",
        "platform_idempotency_check(text,text,text)",
        "platform_idempotency_store(text,text,text,text,uuid)",
        "platform_finish_operation(text,text,text,text,text,uuid,uuid,uuid,text,uuid,text,text)",
      ]) {
        const result = await db.query(
          "select has_function_privilege($1, $2::regprocedure, 'execute') as allowed",
          [role, `public.${fn}`],
        );
        assert.equal(result.rows[0].allowed, false, `${role} ${fn}`);
      }
    }
    const rows = await db.query(
      "select relname, relrowsecurity from pg_class where oid = any(array['audit_events'::regclass, 'idempotency_records'::regclass, 'lifecycle_holds'::regclass])",
    );
    assert.equal(rows.rows.length, 3);
    assert.ok(rows.rows.every((row) => row.relrowsecurity === true));
    const policies = await db.query(
      "select tablename, cmd, array_agg(roles::text) as roles from pg_policies where schemaname = 'public' and tablename in ('audit_events', 'idempotency_records', 'lifecycle_holds') group by tablename, cmd",
    );
    // Only the audit read policy exists (U2, BR2.15): select for signed-in accounts, no write policy.
    assert.deepEqual(
      policies.rows.map((row) => `${row.tablename}:${row.cmd}`),
      ["audit_events:SELECT"],
    );
  });

  it("lets signed-in accounts call only the named hold functions", async () => {
    const allowed = async (role: string, fn: string) =>
      (
        await db.query(
          "select has_function_privilege($1, $2::regprocedure, 'execute') as allowed",
          [role, `public.${fn}`],
        )
      ).rows[0].allowed;
    for (const fn of [
      "lifecycle_hold_place(text,text,uuid,uuid,text)",
      "lifecycle_hold_release(text,uuid,integer)",
    ]) {
      assert.equal(await allowed("authenticated", fn), true);
      // U2 changes this on purpose (BR2.23): the service-role key has no execute right on them.
      assert.equal(await allowed("service_role", fn), false);
      assert.equal(await allowed("anon", fn), false);
    }
    // Cleanup runs through the owner connection (seed, reset, operator), not through the key.
    assert.equal(await allowed("service_role", "platform_cleanup_expired()"), false);
    assert.equal(await allowed("authenticated", "platform_cleanup_expired()"), false);
  });

  it("refuses a file with a hard-coded schema name, names it, and applies nothing", async () => {
    const before = (
      await db.query(`select count(*)::int as n from ${TRACKING_SCHEMA}.applied_migrations`)
    ).rows[0].n;
    const sql = "create table public.hard_coded_probe (id int);";
    await assert.rejects(
      run(db, "worker_4", [{ name: "99990101_hard_coded.sql", sql, checksum: checksumOf(sql) }]),
      (error: Error & { detail?: Record<string, string> }) => {
        assert.equal(error.detail?.file, "99990101_hard_coded.sql");
        return true;
      },
    );
    assert.equal(
      (await db.query(`select count(*)::int as n from ${TRACKING_SCHEMA}.applied_migrations`))
        .rows[0].n,
      before,
    );
    assert.equal(
      (await db.query("select to_regclass('public.hard_coded_probe') as probe")).rows[0].probe,
      null,
    );
  });

  it("stops at a failing file, names it, and leaves the earlier files recorded", async () => {
    const sql = "create table failing_probe (id int); select 1/0;";
    await assert.rejects(
      run(db, "worker_4", [{ name: "99990102_failing.sql", sql, checksum: checksumOf(sql) }]),
      (error: Error & { step?: string; detail?: Record<string, string> }) => {
        assert.equal(error.step, "apply");
        assert.equal(error.detail?.file, "99990102_failing.sql");
        return true;
      },
    );
    assert.equal(
      (await db.query("select to_regclass('worker_4.failing_probe') as probe")).rows[0].probe,
      null,
    );
    const tracked = await db.query(
      `select count(*)::int as n from ${TRACKING_SCHEMA}.applied_migrations where schema_name = 'worker_4'`,
    );
    assert.equal(tracked.rows[0].n, migrations.length);
  });

  it("fixed the reserved-word alias in the first migration (FR1.2)", () => {
    const first = readFileSync(`${root}supabase/migrations/20260806_access_rls.sql`, "utf8");
    assert.equal(/\bgrant\.[a-z_]+/i.test(first), false);
    assert.equal(/\bapp_role_grants\s+grant\b/i.test(first), false);
  });

  it("starts and migrates end to end with the real commands, and prints no key or password (NFR1.8)", async () => {
    const lines: string[] = [];
    const log = (line: string) => lines.push(line);
    const stack = {
      ...defaultStackDeps(),
      log,
      environment: { ...process.env, [ACKNOWLEDGE_ALL_INTERFACES]: "1" },
    };
    assert.equal(await startMain([], stack), 0);
    const settings = loadToolingSettings({
      environment: {},
      readFile: (path) => {
        try {
          return readFileSync(`${root}${path}`, "utf8");
        } catch {
          return undefined;
        }
      },
    });
    const migrate: MigrateDeps = {
      ...defaultMigrateDeps(),
      log,
      migrationsDirectory: `${root}supabase/migrations`,
    };
    assert.equal(await migrateMain([], migrate), 0);
    assert.equal(await migrateMain([], migrate), 0);
    const output = lines.join("\n");
    for (const secret of [
      settings.publicKey,
      serviceKey(),
      settings.databaseUrl,
      "postgres:postgres",
    ]) {
      assert.equal(output.includes(secret), false, "a secret appeared in the command output");
    }
    assert.ok(lines.some((line) => /^TIMING start /.test(line)));
    assert.ok(lines.filter((line) => /^TIMING migrate\(public\)/.test(line)).length === 2);
    assert.ok(lines.some((line) => line.includes("0 applied")));
  });
});
