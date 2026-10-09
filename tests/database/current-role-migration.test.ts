import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { readFile, access } from "node:fs/promises";
import {
  createRoleDatabase,
  postgresBinaries,
} from "../../scripts/verification/current-role-database.ts";

const baseline = await readFile(
  new URL("./fixtures/current-role-baseline.sql", import.meta.url),
  "utf8",
);
const migration = await readFile(
  new URL("../../supabase/migrations/20261006_current_roles.sql", import.meta.url),
  "utf8",
);
const issuer = "SET waldorf.authoritative_issuer_baseline='verified-v1';\n";
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
let cluster: Awaited<ReturnType<typeof createRoleDatabase>>;
let sequence = 0;
const fixture = async () => {
  const name = `case_${++sequence}`;
  await cluster.query(`CREATE DATABASE ${name}`);
  await cluster.query(baseline, name);
  return {
    query: (sql: string) => cluster.query(sql, name),
    migrate: (sql = migration, prefix = issuer) => cluster.query(prefix + sql, name),
  };
};
type Fixture = Awaited<ReturnType<typeof fixture>>;
const snapshot = (db: Fixture) =>
  db.query(`SELECT jsonb_build_object(
 'grants',(SELECT jsonb_agg(to_jsonb(g) ORDER BY id) FROM app_role_grants g),
 'versions',(SELECT jsonb_agg(to_jsonb(v) ORDER BY subject_id) FROM app_authorization_versions v),
 'users',(SELECT jsonb_agg(to_jsonb(u) ORDER BY id) FROM fixture_users u),
 'families',(SELECT jsonb_agg(to_jsonb(f) ORDER BY id) FROM app_families f),
 'assignments',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM app_assignments a),
 'imports',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM app_import_runs i),
 'audit',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM app_audit_events a),
 'business',(SELECT jsonb_agg(to_jsonb(b) ORDER BY id) FROM fixture_business b),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY tablename,policyname) FROM pg_policies p WHERE schemaname='public'),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(conname,pg_get_constraintdef(oid)) ORDER BY conname) FROM pg_constraint WHERE connamespace='public'::regnamespace),
 'functions',(SELECT jsonb_agg(jsonb_build_array(proname,prosrc) ORDER BY proname) FROM pg_proc WHERE pronamespace='public'::regnamespace),
 'evidence_exists',to_regclass('app_role_conversion_evidence') IS NOT NULL)`);
const actor = (subject: number, sql: string) =>
  `SET ROLE authenticated; SET request.jwt.claim.sub='${id(subject)}'; ${sql}`;

describe(
  "actual disposable PostgreSQL18 migration (no deployed target)",
  { timeout: 120000 },
  () => {
    before(async () => {
      cluster = await createRoleDatabase();
      console.log(`DISPOSABLE_DATABASE_VERSION ${cluster.version}`);
    });
    after(async () => {
      if (cluster) {
        await cluster.close();
        await assert.rejects(access(cluster.temporary));
      }
    });

    it("unmodified migration preserves all nonrole, user activity, business and historical records", async () => {
      const db = await fixture();
      const original = JSON.parse(await snapshot(db));
      await db.migrate();
      const current = JSON.parse(await snapshot(db));
      for (const key of ["users", "families", "assignments", "imports", "audit", "business"])
        assert.deepEqual(current[key], original[key]);
      assert.equal(current.grants.length, original.grants.length);
      for (let n = 0; n < original.grants.length; n++) {
        const old = original.grants[n];
        const role =
          old.role === "read_only_staff"
            ? "kindergarten_teacher"
            : old.role === "kindergarten_admin"
              ? "super_admin"
              : old.role;
        assert.deepEqual(current.grants[n], { ...old, role });
      }
      assert.equal(await db.query("SELECT count(*) FROM app_role_conversion_evidence"), "6");
      assert.equal(
        await db.query(
          "SELECT count(DISTINCT (subject_id,role,scope_type,scope_id,organization_id)) FROM app_role_grants WHERE subject_id='" +
            id(101) +
            "' AND revoked_at IS NULL",
        ),
        "1",
      );
    });

    it("increments each changed subject once and initializes only missing supported generation to2", async () => {
      const db = await fixture();
      await db.migrate();
      const versions = JSON.parse(
        await db.query(
          "SELECT jsonb_object_agg(subject_id,authorization_version) FROM app_authorization_versions",
        ),
      );
      for (const n of [101, 102, 103, 104, 105]) assert.equal(versions[id(n)], 8);
      for (const n of [106, 107, 108]) assert.equal(versions[id(n)], 7);
      assert.equal(versions[id(109)], 2);
    });

    it("repeat migration creates zero conversion/version/history changes", async () => {
      const db = await fixture();
      await db.migrate();
      const first = await snapshot(db);
      const evidence = await db.query(
        "SELECT jsonb_agg(to_jsonb(e) ORDER BY grant_id) FROM app_role_conversion_evidence e",
      );
      await db.migrate();
      assert.equal(await snapshot(db), first);
      assert.equal(
        await db.query(
          "SELECT jsonb_agg(to_jsonb(e) ORDER BY grant_id) FROM app_role_conversion_evidence e",
        ),
        evidence,
      );
    });

    it("issuer/schema/role/scope/version/overflow preconditions fail atomically", async () => {
      for (const [preparation, prefix, reason] of [
        ["", "", "authoritative issuer"],
        [
          "ALTER TABLE app_families ALTER COLUMN scope_id DROP NOT NULL",
          issuer,
          "nullable required",
        ],
        [
          "ALTER TABLE app_authorization_versions ALTER COLUMN authorization_version SET DEFAULT 3",
          issuer,
          "version default",
        ],
        [
          "UPDATE app_role_grants SET role='unknown' WHERE id='" + id(1) + "'",
          issuer,
          "UNSUPPORTED_ROLE_OR_SCOPE",
        ],
        [
          "UPDATE app_role_grants SET scope_type='organization' WHERE id='" + id(1) + "'",
          issuer,
          "UNSUPPORTED_ROLE_OR_SCOPE",
        ],
        [
          "UPDATE app_authorization_versions SET authorization_version=0 WHERE subject_id='" +
            id(101) +
            "'",
          issuer,
          "invalid or overflowing",
        ],
        [
          "UPDATE app_authorization_versions SET authorization_version=2147483647 WHERE subject_id='" +
            id(101) +
            "'",
          issuer,
          "invalid or overflowing",
        ],
      ]) {
        const db = await fixture();
        if (preparation) await db.query(preparation);
        const original = await snapshot(db);
        await assert.rejects(db.migrate(migration, prefix), new RegExp(reason!));
        assert.equal(await snapshot(db), original);
      }
    });

    it("instrumented faults after every transaction phase restore roles, versions, evidence, constraints and policies", async () => {
      const markers = [
        "create table if not exists public.app_role_conversion_evidence",
        "insert into public.app_authorization_versions",
        "insert into public.app_role_conversion_evidence",
        "alter table public.app_role_grants drop constraint",
        "-- Inventory/remove EVERY existing policy",
        "commit;",
      ];
      for (const marker of markers) {
        assert.ok(migration.includes(marker));
        const db = await fixture();
        const original = await snapshot(db);
        const instrumented = migration.replace(
          marker,
          "DO $$ BEGIN RAISE EXCEPTION 'INJECTED_PHASE_FAILURE'; END $$;\n" + marker,
        );
        await assert.rejects(db.migrate(instrumented), /INJECTED_PHASE_FAILURE/);
        assert.equal(await snapshot(db), original);
      }
    });

    it("two actual connections exclude removed-role writer through commit then reject its insert", async () => {
      const db = await fixture();
      const barrier = migration.replace(
        "-- Locks precede preflight",
        "SELECT pg_sleep(1.5);\n-- Locks precede preflight",
      );
      const running = db.migrate(barrier);
      const waitFor = async (sql: string) => {
        const deadline = Date.now() + 4000;
        while ((await db.query(sql)) !== "t") {
          assert.ok(Date.now() < deadline, "expected real database lock was not observed");
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
      };
      await waitFor(
        "SELECT EXISTS(SELECT FROM pg_locks WHERE relation='app_role_grants'::regclass AND mode='ExclusiveLock' AND granted)",
      );
      const writing = db.query(
        `SET application_name='excluded_role_writer'; INSERT INTO app_role_grants(id,subject_id,role,scope_type,scope_id,organization_id) VALUES('${id(99)}','${id(101)}','read_only_staff','group','${id(201)}','${id(301)}')`,
      );
      // Attach immediately so a fast rejection can never become unhandled.
      const denied = assert.rejects(writing, /current_role_scope/);
      await waitFor(
        "SELECT EXISTS(SELECT FROM pg_stat_activity WHERE application_name='excluded_role_writer' AND wait_event_type='Lock')",
      );
      await running;
      await denied;
      assert.equal(
        await db.query(`SELECT count(*) FROM app_role_grants WHERE id='${id(99)}'`),
        "0",
      );
    });

    it("actual RLS scopes Parent, Group admin and Super administrator while denying teacher raw reads/writes", async () => {
      const db = await fixture();
      await db.migrate();
      for (const [subject, families, assignments, imports] of [
        [106, 1, 0, 0],
        [107, 1, 1, 0],
        [104, 2, 2, 2],
        [108, 1, 1, 1],
        [101, 0, 0, 0],
        [102, 0, 0, 0],
      ]) {
        for (const [table, count] of [
          ["app_families", families],
          ["app_assignments", assignments],
          ["app_import_runs", imports],
        ])
          assert.equal(
            await db.query(actor(subject!, `SELECT count(*) FROM ${table}`)),
            String(count),
          );
      }
      assert.equal(
        await db.query(actor(101, "UPDATE app_families SET scope_id=scope_id RETURNING id")),
        "",
      );
      assert.equal(await db.query(actor(101, "DELETE FROM app_assignments RETURNING id")), "");
      await assert.rejects(
        db.query(
          actor(101, `INSERT INTO app_families VALUES('${id(499)}','${id(301)}','${id(201)}')`),
        ),
        /row-level security/,
      );
      assert.equal(
        await db.query(actor(107, `SELECT has_core_scope('${id(302)}','${id(201)}')`)),
        "f",
      );
      assert.equal(
        await db.query(actor(106, `SELECT authorization_version_for('${id(101)}') IS NULL`)),
        "t",
      );
    });

    it("actual evidence RLS is governance-only and redacted; ordinary client mutation is denied", async () => {
      const db = await fixture();
      await db.migrate();
      for (const [subject, count] of [
        [104, 5],
        [108, 1],
        [101, 0],
        [106, 0],
        [107, 0],
      ])
        assert.equal(
          await db.query(actor(subject!, "SELECT count(*) FROM app_role_conversion_evidence")),
          String(count),
        );
      const columns = (
        await db.query(
          "SELECT column_name FROM information_schema.columns WHERE table_name='app_role_conversion_evidence' ORDER BY ordinal_position",
        )
      ).split("\n");
      assert.deepEqual(columns, [
        "operation_id",
        "grant_id",
        "subject_id",
        "organization_id",
        "original_role",
        "current_role",
        "outcome",
      ]);
      assert.equal(
        await db.query(
          "SELECT count(*) FROM app_role_conversion_evidence WHERE original_role='read_only_staff' AND \"current_role\"='kindergarten_teacher'",
        ),
        "4",
      );
      const before = await snapshot(db);
      for (const table of [
        "app_role_grants",
        "app_authorization_versions",
        "app_role_conversion_evidence",
      ])
        for (const sql of [
          `DELETE FROM ${table}`,
          `UPDATE ${table} SET ${table === "app_authorization_versions" ? "authorization_version=authorization_version" : table === "app_role_grants" ? "role=role" : "outcome=outcome"}`,
        ])
          await assert.rejects(db.query(actor(104, sql)), /permission denied/);
      await assert.rejects(
        db.query(
          actor(
            104,
            "INSERT INTO app_role_conversion_evidence SELECT * FROM app_role_conversion_evidence LIMIT 1",
          ),
        ),
        /permission denied/,
      );
      assert.equal(await snapshot(db), before);
    });

    it("missing tools fail explicitly and failure cleanup removes only its disposable directory", async () => {
      await assert.rejects(
        postgresBinaries("/private/tmp/no-such-postgres-toolchain"),
        /POSTGRES_TOOLS_UNAVAILABLE/,
      );
      await assert.rejects(postgresBinaries("relative-tools"), /ABSOLUTE_DIRECTORY/);
      const owned = await createRoleDatabase();
      try {
        await assert.rejects(
          owned.query("SELECT deliberately_missing_function()"),
          /does not exist/,
        );
      } finally {
        await owned.close();
      }
      await assert.rejects(access(owned.temporary));
    });
  },
);
