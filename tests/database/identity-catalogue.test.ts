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
  // U3 Directory and Settings: the reach helpers the policies call, the actor's family (internal), the
  // optional profile read, and the checked change functions of signed-in admins (BR32.6)
  directory_actor_family: INTERNAL,
  directory_is_family_parent: "authenticated",
  directory_in_organization: "authenticated",
  directory_is_admin: "authenticated",
  directory_reaches_family: "authenticated",
  directory_group_visible: "authenticated",
  directory_school_year_visible: "authenticated",
  directory_can_read_contact: "authenticated",
  directory_parent_profile: "authenticated",
  directory_save: "authenticated",
  structure_save: "authenticated",
  directory_archive_item: "authenticated",
  directory_restore_item: "authenticated",
  settings_get: "authenticated",
  settings_save: "authenticated",
  // U3 Coordination: the reach helpers of its policies, the capacity trigger (a deferred trigger that
  // runs at commit as the owner), and the event, task and note functions
  coordination_task_reached: "authenticated",
  coordination_assignment_reached: "authenticated",
  coordination_assignment_family_parent: "authenticated",
  assignments_check_capacity: INTERNAL,
  event_save: "authenticated",
  event_save_notes: "authenticated",
  task_save: "authenticated",
  contribution_save: "authenticated",
  // U3 kernel use cases (BR32.6). Why each is elevated:
  //  duty_list, duty_get, duty_sign_up: a parent reads no task or event table, so the list, detail and
  //    sign-up read Directory memberships and Coordination tasks for the parent's own family only;
  //  assignment_assign, assignment_remove: admin placements that read memberships by typed id;
  //  swap_candidates, swap_incoming: show another family's task title, date and display name;
  //  swap_request, swap_respond, swap_withdraw, cancellation_request: change two families' assignments;
  //  swap_decide, cancellation_decide: an admin's decision, with the approval audit event;
  //  family_archive, family_restore: Directory records plus Coordination assignments and requests;
  //  dashboard_get: counts across Coordination for an admin's reach;
  //  governance_revoke: U2's grant functions plus the self-lockout check;
  //  schedule_get: the teacher schedule shows several families' display names to a teacher, who reads
  //    none of the tables;
  //  lifecycle_list, lifecycle_run: delete or anonymize a family across both blocks.
  coordination_reach_groups: "authenticated",
  coordination_reach_task_ids: "authenticated",
  coordination_my_family: "authenticated",
  coordination_duty_view: INTERNAL,
  duty_list: "authenticated",
  duty_get: "authenticated",
  duty_sign_up: "authenticated",
  assignment_assign: "authenticated",
  assignment_remove: "authenticated",
  coordination_decide: INTERNAL,
  swap_candidates: "authenticated",
  swap_request: "authenticated",
  swap_respond: "authenticated",
  swap_incoming: "authenticated",
  swap_withdraw: "authenticated",
  cancellation_request: "authenticated",
  swap_decide: "authenticated",
  cancellation_decide: "authenticated",
  family_archive: "authenticated",
  family_restore: "authenticated",
  invitation_accept_parent: INTERNAL,
  dashboard_get: "authenticated",
  governance_revoke: "authenticated",
  //  governance_list: shows other accounts' authorization versions (their only reader is the account
  //    itself), which the revoke needs; super admins only (added by the database adapters, step 24);
  governance_list: "authenticated",
  lifecycle_blockers: INTERNAL,
  lifecycle_list: "authenticated",
  lifecycle_run: "authenticated",
  schedule_get: "authenticated",
  // U4 Notifications (BR42.4). Why each is elevated:
  //  notification_actor_parent: the reader of the notification policies (the parent row linked to the account);
  //  notification_list, notification_mark_read: a parent reads only their own notices, and the title and link are
  //    built from the task and the request, which the parent reads through no table;
  //  reminder_list, reminder_retry: an admin sees and retries reminder jobs, which no role reads as a table;
  //  reminder_run_due: the lazy simulated tick, callable by any member of the organization for their own
  //    organization; reminder_run_due_system is the same tick for the system caller (service-role key);
  //  reminder_plan and the helpers around it: the planner that the U3 use cases call inside their transaction.
  notification_actor_parent: "authenticated",
  notification_list: "authenticated",
  notification_mark_read: "authenticated",
  reminder_list: "authenticated",
  reminder_retry: "authenticated",
  reminder_run_due: "authenticated",
  reminder_run_due_system: "service_role",
  reminder_setting_for: INTERNAL,
  reminder_plan: INTERNAL,
  reminder_plan_tasks: INTERNAL,
  reminder_plan_organization: INTERNAL,
  reminder_family_tasks: INTERNAL,
  reminder_run_jobs: INTERNAL,
  //  the notice and job writes inside the use cases of U3's hand-off list (BR40.9): each use case keeps its name
  //    and signature and calls its renamed core (internal, the unchanged function of U3) and then the helper that
  //    writes the notices and re-plans the reminders, all in the caller's transaction.
  notification_notify_family: INTERNAL,
  notification_after_place_added: INTERNAL,
  notification_after_place_removed: INTERNAL,
  notification_after_swap_request: INTERNAL,
  notification_after_swap_response: INTERNAL,
  notification_after_decision: INTERNAL,
  notification_after_lifecycle: INTERNAL,
  duty_sign_up_core: INTERNAL,
  assignment_assign_core: INTERNAL,
  assignment_remove_core: INTERNAL,
  swap_request_core: INTERNAL,
  swap_respond_core: INTERNAL,
  coordination_decide_core: INTERNAL,
  family_archive_core: INTERNAL,
  task_save_core: INTERNAL,
  event_save_core: INTERNAL,
  settings_save_core: INTERNAL,
  lifecycle_run_core: INTERNAL,
  // Ovis tábla U1 (C2, BR2.3, BR3.10, NFR3.6). The callers' reach and the two new lists are readable by signed-in
  // accounts and check their caller themselves; the linked-parent lookup and the admin-grant helpers are internal.
  identity_linked_parent: INTERNAL,
  current_parent_id: "authenticated",
  current_family_id: "authenticated",
  has_community_admin: "authenticated",
  can_manage_group: "authenticated",
  can_read_community: "authenticated",
  grant_admin: INTERNAL,
  end_admin: INTERNAL,
  working_group_list: "authenticated",
  family_name_list: "authenticated",
  // U5 audit purge (NFR1.68): deletes audit events older than 365 days. Elevated because no application role holds
  // a delete right on the audit table; it checks that the caller is the system, sets the transaction-local purge
  // setting for its own transaction only, and is called by identity_housekeeping (the service-role key).
  audit_purge: "service_role",
};

/** Tables with row-level security and the test that covers each (NFR1.2): fails when one has no entry. */
const POLICY_TEST_COVERAGE: Record<string, string> = {
  accounts: "identity-session.test.ts (policy matrix)",
  invitations: "identity-session.test.ts (policy matrix)",
  app_role_grants: "identity-session.test.ts (policy matrix)",
  app_authorization_versions: "identity-session.test.ts (policy matrix)",
  audit_events: "identity-session.test.ts (policy matrix)",
  app_role_conversion_evidence: "identity-catalogue.test.ts (this file)",
  sign_in_attempts: "identity-lockout.test.ts (no access for any role)",
  idempotency_records: "migrations.test.ts (no access for any role)",
  lifecycle_holds: "migrations.test.ts (no access for any role)",
  organizations: "directory-schema.test.ts (role matrix)",
  school_years: "directory-schema.test.ts (role matrix)",
  groups: "directory-schema.test.ts (role matrix)",
  families: "directory-schema.test.ts (role matrix) and identity-session.test.ts (policy matrix)",
  group_memberships: "directory-schema.test.ts (role matrix)",
  parents: "directory-schema.test.ts (role matrix)",
  parent_contacts: "directory-schema.test.ts (role matrix)",
  children: "directory-schema.test.ts (role matrix)",
  organization_settings: "directory-schema.test.ts (settings matrix)",
  reminder_settings: "directory-schema.test.ts (settings matrix)",
  events: "coordination-schema.test.ts (role matrix)",
  tasks: "coordination-schema.test.ts (role matrix)",
  assignments:
    "coordination-schema.test.ts (role matrix) and identity-session.test.ts (policy matrix)",
  change_requests: "coordination-schema.test.ts (role matrix)",
  contribution_notes: "coordination-schema.test.ts (role matrix)",
  notifications: "notifications-schema.test.ts (role matrix)",
  reminder_jobs: "notifications-schema.test.ts (no policy: no direct access for any role)",
  reminder_recipients: "notifications-schema.test.ts (no policy: no direct access for any role)",
  reminder_attempts: "notifications-schema.test.ts (no policy: no direct access for any role)",
};

/**
 * Every table is either a record a detail screen opens (and then the scope probe has a branch for it) or is
 * not (and the reason is stated). A later unit that adds a table fails this test until it decides (BR2.17, R-06).
 * Still to register by their units: parent, task, event, change request, notification.
 */
const PROBE_DECISION: Record<string, string> = {
  families: "family",
  assignments: "assignment",
  accounts: "none: identity record, never a detail screen of the probe",
  invitations: "none: managed through the admin functions",
  app_role_grants: "none: managed through grant_change",
  app_authorization_versions: "none: counter",
  app_role_conversion_evidence: "none: governance evidence",
  audit_events: "none: audit read policy",
  sign_in_attempts: "none: no application access",
  idempotency_records: "none: no application access",
  lifecycle_holds: "none: no application access",
  // U3 tables: the family and assignment branches of scope_probe read families and assignments (step 21).
  organizations: "none: U3 table, no probe branch needed",
  school_years: "none: U3 table, no probe branch needed",
  groups: "none: U3 table, no probe branch needed",
  group_memberships: "none: U3 table, never a detail screen",
  parents: "none: U3 table, never a detail screen",
  parent_contacts: "none: U3 table, never a detail screen",
  children: "none: U3 table, probe branch comes with the rewrite of scope_probe",
  organization_settings: "none: U3 table, never a detail screen",
  reminder_settings: "none: U3 table, never a detail screen",
  events: "none: U3 table, probe branch comes with the rewrite of scope_probe",
  tasks: "none: U3 table, probe branch comes with the rewrite of scope_probe",
  change_requests: "none: U3 table, probe branch comes with the rewrite of scope_probe",
  contribution_notes: "none: U3 table, never a detail screen",
  // U4 tables: a notification, a reminder job and its rows are never a detail screen of the probe.
  notifications: "none: U4 table, never a detail screen",
  reminder_jobs: "none: U4 table, never a detail screen",
  reminder_recipients: "none: U4 table, never a detail screen",
  reminder_attempts: "none: U4 table, never a detail screen",
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
