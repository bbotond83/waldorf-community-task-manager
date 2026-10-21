import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { applyMigrations, readMigrationFiles } from "../../scripts/db/runner.ts";
import { FRESH_SCHEMA_SETTINGS } from "../../scripts/db/migrate.ts";
import {
  ADMIN_G1,
  ADMIN_G2,
  asActor,
  authenticated,
  IDENTITY_SCHEMAS,
  openIdentityDatabase,
  ORGANIZATION,
  OTHER_ADMIN,
  OUTSIDER,
  PARENT_F1,
  seedIdentityWorld,
  SIGNED_OUT,
  SUPER_ADMIN,
  TEACHER_G1,
  DEACTIVATED,
  uuid,
} from "./identity-support.ts";
import { root } from "./stack-support.ts";

/**
 * The authoritative list of elevated (security definer) functions and who may execute them (BR2.16,
 * BR2.23; functional-spec.md, "Elevated Function List"). A function that is not listed fails the test, so
 * a later unit must append its own functions here. Internal helpers are executable by nobody.
 */
const INTERNAL = "internal";
export const ELEVATED: Record<
  string,
  "authenticated" | "service_role" | "auth_admin" | typeof INTERNAL
> = {
  // U1 building blocks and holds
  platform_actor_account: INTERNAL,
  platform_actor_role: INTERNAL,
  platform_audit_write: INTERNAL,
  platform_caller_is_system: INTERNAL,
  platform_cleanup_expired: INTERNAL,
  platform_finish_operation: INTERNAL,
  platform_idempotency_check: INTERNAL,
  platform_idempotency_store: INTERNAL,
  lifecycle_hold_place: "authenticated",
  lifecycle_hold_release: "authenticated",
  // U2: the session check and the policy helpers
  current_session_is_active: "authenticated",
  authorization_version_for: "authenticated",
  has_current_role_scope: "authenticated",
  has_super_scope: "authenticated",
  has_core_scope: "authenticated",
  identity_account_visible: "authenticated",
  identity_can_manage_scope: "authenticated",
  // U2: internal helpers
  identity_actor_organization: INTERNAL,
  identity_bump_authorization_version: INTERNAL,
  identity_deny: INTERNAL,
  identity_lock_super_admins: INTERNAL,
  identity_scope_group: INTERNAL,
  identity_set_account_status: INTERNAL,
  // U2 review repair: stale reservation release, and the guard on sign-in email changes (a trigger function)
  invitation_release_stale: INTERNAL,
  identity_block_email_change: INTERNAL,
  // U2: signed-in admins
  invitation_create: "authenticated",
  invitation_resend: "authenticated",
  invitation_revoke: "authenticated",
  grant_change: "authenticated",
  account_deactivate: "authenticated",
  account_reactivate: "authenticated",
  account_find_by_email: "authenticated",
  scope_probe: "authenticated",
  // U2: admin access (the service-role key), before or outside a session
  sign_in_lockout_check: "service_role",
  sign_in_attempt_record: "service_role",
  sign_in_attempt_clear: "service_role",
  invitation_lookup: "service_role",
  invitation_reserve: "service_role",
  invitation_release: "service_role",
  invitation_accept: "service_role",
  account_recovery_check: "service_role",
  sessions_remove: "service_role",
  identity_housekeeping: "service_role",
  identity_ban_mismatches: "service_role",
  // U2: the operator's command only (the schema owner)
  operator_first_super_admin: INTERNAL,
  // U2: the password-verification hook, executable only by the sign-in service's own database role
  password_verification_hook: "auth_admin",
};

/** Tables with row-level security and the test that covers each (NFR1.2): fails when one has no entry. */
const POLICY_TEST_COVERAGE: Record<string, string> = {
  accounts: "identity-session.test.ts (policy matrix)",
  invitations: "identity-session.test.ts (policy matrix)",
  app_role_grants: "identity-session.test.ts (policy matrix)",
  app_authorization_versions: "identity-session.test.ts (policy matrix)",
  app_families: "identity-session.test.ts (policy matrix)",
  app_assignments: "identity-session.test.ts (policy matrix)",
  app_import_runs: "identity-session.test.ts (policy matrix)",
  audit_events: "identity-session.test.ts (policy matrix)",
  app_role_conversion_evidence: "identity-catalogue.test.ts (this file)",
  sign_in_attempts: "identity-lockout.test.ts (no access for any role)",
  idempotency_records: "migrations.test.ts (no access for any role)",
  lifecycle_holds: "migrations.test.ts (no access for any role)",
};

/**
 * Every table is either a record a detail screen opens (and then the scope probe has a branch for it) or is
 * not (and the reason is stated). A later unit that adds a table fails this test until it decides (BR2.17, R-06).
 * Still to register by their units: parent, task, event, change request, notification.
 */
const PROBE_DECISION: Record<string, string> = {
  app_families: "family",
  app_assignments: "assignment",
  app_import_runs: "import_run",
  accounts: "none: identity record, never a detail screen of the probe",
  invitations: "none: managed through the admin functions",
  app_role_grants: "none: managed through grant_change",
  app_authorization_versions: "none: counter",
  app_role_conversion_evidence: "none: governance evidence",
  audit_events: "none: audit read policy",
  sign_in_attempts: "none: no application access",
  idempotency_records: "none: no application access",
  lifecycle_holds: "none: no application access",
};

for (const schema of IDENTITY_SCHEMAS) {
  describe(`identity catalogue in ${schema}`, () => {
    let db: pg.Client;

    before(async () => {
      db = await openIdentityDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedIdentityWorld(db, schema);
    });

    const functions = async (definerOnly: boolean) =>
      (
        await db.query(
          `select p.proname, p.prosecdef, p.proconfig,
                  has_function_privilege('anon', p.oid, 'execute') as anon,
                  has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
                  has_function_privilege('service_role', p.oid, 'execute') as service_role,
                  has_function_privilege('public', p.oid, 'execute') as public
             from pg_proc p
            where p.pronamespace = current_schema()::regnamespace and p.prokind = 'f'
              and (not $1 or p.prosecdef)
            order by p.proname`,
          [definerOnly],
        )
      ).rows as {
        proname: string;
        prosecdef: boolean;
        proconfig: string[] | null;
        anon: boolean;
        authenticated: boolean;
        service_role: boolean;
        public: boolean;
      }[];

    it("lists every security-definer function of the schema on the authoritative list, and every listed function exists", async () => {
      const found = (await functions(true)).map((row) => row.proname);
      const listed = Object.keys(ELEVATED).sort();
      assert.deepEqual(
        found.filter((name) => !listed.includes(name)),
        [],
        "a security-definer function that is not on the elevated list",
      );
      assert.deepEqual(
        listed.filter((name) => !found.includes(name)),
        [],
        "a listed function that does not exist",
      );
    });

    it("pins the search path of every function to its own schema and the system catalogue (BR1.5)", async () => {
      for (const row of await functions(false)) {
        const pinned = (row.proconfig ?? []).find((setting) => setting.startsWith("search_path="));
        assert.ok(pinned, `${row.proname} has no pinned search path`);
        assert.ok(pinned.endsWith(", pg_catalog"), `${row.proname}: ${pinned}`);
        assert.ok(pinned.includes(`"${schema}"`), `${row.proname}: ${pinned}`);
      }
    });

    it("makes no elevated function executable by anon or by everyone, and only by the roles named for it", async () => {
      for (const row of await functions(true)) {
        assert.equal(row.anon, false, `${row.proname} executable by anon`);
        assert.equal(row.public, false, `${row.proname} executable by everyone`);
        const who = ELEVATED[row.proname];
        assert.equal(
          row.authenticated,
          who === "authenticated",
          `${row.proname} for authenticated`,
        );
        assert.equal(row.service_role, who === "service_role", `${row.proname} for service_role`);
      }
    });

    it("gives the service role execute on the admin-access functions and nothing else, among all functions of the schema (BR2.23)", async () => {
      const allowed = Object.entries(ELEVATED)
        .filter(([, who]) => who === "service_role")
        .map(([name]) => name)
        .sort();
      const actual = (await functions(false))
        .filter((row) => row.service_role)
        .map((row) => row.proname)
        .sort();
      assert.deepEqual(actual, allowed);
      assert.equal(
        allowed.includes("account_find_by_email"),
        false,
        "it needs a signed-in admin as actor",
      );
    });

    it("keeps trigger functions and the platform building blocks out of reach of every application role", async () => {
      for (const row of (await functions(false)).filter((entry) => !ELEVATED[entry.proname])) {
        assert.equal(row.anon || row.public || row.service_role, false, row.proname);
      }
    });

    it("has a policy test case for every table with row-level security (NFR1.2)", async () => {
      const tables = (
        await db.query(
          "select c.relname from pg_class c where c.relnamespace = current_schema()::regnamespace and c.relkind = 'r' and c.relrowsecurity order by 1",
        )
      ).rows.map((row) => String(row.relname));
      const unexpected = tables.filter((table) => !(table in POLICY_TEST_COVERAGE));
      assert.deepEqual(
        unexpected,
        [],
        "a table with row-level security that no policy test covers: add a case and list it here",
      );
      assert.deepEqual(
        Object.keys(POLICY_TEST_COVERAGE).filter((table) => !tables.includes(table)),
        [],
      );
      const withoutRls = (
        await db.query(
          "select c.relname from pg_class c where c.relnamespace = current_schema()::regnamespace and c.relkind = 'r' and not c.relrowsecurity",
        )
      ).rows;
      assert.deepEqual(withoutRls, [], "every table of the schema has row-level security");
    });

    it("has a decision about the scope probe for every table, and a branch for each probed type (R-06)", async () => {
      const tables = (
        await db.query(
          "select c.relname from pg_class c where c.relnamespace = current_schema()::regnamespace and c.relkind = 'r' order by 1",
        )
      ).rows.map((row) => String(row.relname));
      assert.deepEqual(
        tables.filter((table) => !(table in PROBE_DECISION)),
        [],
        "a table without a decision: add a probe branch (scope_probe) or state why it has none",
      );
      const source = (
        await db.query(
          "select prosrc from pg_proc where proname = 'scope_probe' and pronamespace = current_schema()::regnamespace",
        )
      ).rows[0].prosrc as string;
      for (const type of Object.values(PROBE_DECISION).filter(
        (value) => !value.startsWith("none"),
      )) {
        assert.ok(source.includes(`'${type}'`), `scope_probe has no branch for ${type}`);
      }
    });

    it("lets only a super admin of the organization read the conversion evidence, per role", async () => {
      await db.query(
        "insert into app_role_conversion_evidence (operation_id, grant_id, subject_id, organization_id, original_role, \"current_role\", outcome) values ($1, $2, $3, $4, 'read_only_staff', 'kindergarten_teacher', 'converted')",
        [uuid(1), uuid(2), PARENT_F1, ORGANIZATION],
      );
      const expected: [string, number][] = [
        [SUPER_ADMIN, 1],
        [ADMIN_G1, 0],
        [ADMIN_G2, 0],
        [PARENT_F1, 0],
        [TEACHER_G1, 0],
        [OUTSIDER, 0],
        [DEACTIVATED, 0],
        [SIGNED_OUT, 0],
        [OTHER_ADMIN, 0],
      ];
      for (const [account, rows] of expected) {
        const seen = await asActor(
          db,
          schema,
          authenticated(account),
          async () => (await db.query("select * from app_role_conversion_evidence")).rows.length,
        );
        assert.equal(seen, rows, account);
      }
    });

    it("applies the identity migrations a second time without changing anything (forward-only, NFR6.1)", async () => {
      const files = readMigrationFiles(`${root}supabase/migrations`);
      const before = (
        await db.query(
          "select count(*)::int as n from pg_proc where pronamespace = current_schema()::regnamespace",
        )
      ).rows[0].n;
      const result = await applyMigrations({
        client: db,
        schema,
        files,
        log: () => {},
        now: () => Date.now(),
        freshSchemaSettings: FRESH_SCHEMA_SETTINGS,
      });
      assert.deepEqual(result.applied, []);
      assert.ok(result.upToDate.some((name) => name.includes("identity")));
      await db.query(`set search_path to "${schema}", pg_catalog`);
      const after = (
        await db.query(
          "select count(*)::int as n from pg_proc where pronamespace = current_schema()::regnamespace",
        )
      ).rows[0].n;
      assert.equal(after, before);
    });
  });
}
