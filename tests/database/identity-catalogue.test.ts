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
  // U3 of the Ovis tábla work: directory, profile, email change, records, invitation send, one-off load
  directory_can_read_profile: "authenticated",
  directory_list: "authenticated",
  profile_set_sharing: "authenticated",
  profile_update_own: "authenticated",
  family_add: "authenticated",
  parent_add: "authenticated",
  parent_edit: "authenticated",
  parent_remove: "authenticated",
  invitation_send: "authenticated",
  account_password_changed: "service_role",
  email_change_pending: "service_role",
  email_change_request: "service_role",
  email_change_cancel: "service_role",
  email_change_confirm: "service_role",
  migration_load_family: "service_role",
  directory_address_taken: INTERNAL,
  email_send_register: INTERNAL,
  directory_audit_as: INTERNAL,
  directory_ensure_profile: INTERNAL,
  directory_unshare: INTERNAL,
  identity_end_parent_sign_in: INTERNAL,
  directory_remove_parent_core: INTERNAL,
  directory_removal_preview: INTERNAL,
  directory_removal_apply: INTERNAL,
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
  task_save: "authenticated",
  // Ovis tábla U10 (C1, C8, C13, C14, C16, BR100 to BR124). The commands and reads check their caller themselves
  // (event_save_notes is replaced by event_notices_save); the lock helpers, the notice facts, the facts for later
  // units and the removal pair are internal.
  event_notices_save: "authenticated",
  event_tale_save: "authenticated",
  event_role_save: "authenticated",
  event_role_remove: "authenticated",
  event_role_clear_name: "authenticated",
  event_signup_add: "authenticated",
  event_signup_change: "authenticated",
  event_signup_withdraw: "authenticated",
  food_offer_add: "authenticated",
  food_offer_change: "authenticated",
  food_offer_withdraw: "authenticated",
  event_list: "authenticated",
  event_list_for_group: "authenticated",
  event_get: "authenticated",
  event_typed_roles_list: "authenticated",
  event_lock_managed: INTERNAL,
  event_lock_for_parent: INTERNAL,
  notice_facts_event: INTERNAL,
  event_is_summer: INTERNAL,
  event_deadline: INTERNAL,
  event_organisers: INTERNAL,
  events_removal_preview: INTERNAL,
  events_removal_apply: INTERNAL,
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
  // U5 (BR52): delivery_problems_list and delivery_retry are the super admin's list and Try again (no role reads the
  //    delivery tables); timed_checks_run_system, notice_email_claim, notice_email_sweep and notice_email_record are
  //    the command's own functions, callable by the service role only; notice_send, the facts functions, the
  //    checks and the housekeeping are internal;
  //  reminder_plan and the helpers around it: the planner that the U3 use cases call inside their transaction.
  notification_actor_parent: "authenticated",
  notification_list: "authenticated",
  notification_mark_read: "authenticated",
  delivery_problems_list: "authenticated",
  delivery_retry: "authenticated",
  timed_checks_run_system: "service_role",
  notice_email_claim: "service_role",
  notice_email_sweep: "service_role",
  notice_email_record: "service_role",
  notice_send: INTERNAL,
  notice_send_core: INTERNAL,
  notice_describe: INTERNAL,
  notice_facts_task: INTERNAL,
  notice_facts_change_request: INTERNAL,
  notice_facts_rota_plan: INTERNAL,
  duty_reminders_due_check: INTERNAL,
  housekeeping_due_check: INTERNAL,
  email_delivery_record: INTERNAL,
  notifications_removal_parents: INTERNAL,
  notifications_removal_preview: INTERNAL,
  notifications_remove_core: INTERNAL,
  notifications_removal_apply: INTERNAL,
  reminder_setting_for: INTERNAL,
  reminder_plan: INTERNAL,
  reminder_plan_tasks: INTERNAL,
  reminder_plan_organization: INTERNAL,
  reminder_family_tasks: INTERNAL,
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
  // Ovis tábla U4 (C8, BR40 to BR44). The detail read and the four commands check their caller themselves; the
  // directory helpers, the member lists, the removal steps and the notice facts are internal. end_admin gained a
  // reason argument (a new signature, still internal).
  working_group_detail: "authenticated",
  working_group_join: "authenticated",
  working_group_leave: "authenticated",
  coordinator_appoint: "authenticated",
  coordinator_revoke: "authenticated",
  directory_parent_shares: INTERNAL,
  directory_parent_email: INTERNAL,
  group_members: INTERNAL,
  group_coordinators: INTERNAL,
  working_groups_removal_preview: INTERNAL,
  working_groups_removal_apply: INTERNAL,
  notice_facts_working_group: INTERNAL,
  // Ovis tábla U2 (C3, C4, C5, C18, BR20 to BR27). The calendar, the draft, the adjusting, the publishing and the
  // reads are signed-in commands and lists that check their caller themselves; the school calendar helpers, the
  // shared duty and place functions, the rota guard and the two renamed cores are internal.
  break_week_add: "authenticated",
  break_week_remove: "authenticated",
  place_mark_done: "authenticated",
  rota_plan_make: "authenticated",
  rota_week_set: "authenticated",
  rota_plan_discard: "authenticated",
  rota_plan_publish: "authenticated",
  school_calendar_get: "authenticated",
  rota_plan_get: "authenticated",
  rota_overview: "authenticated",
  rota_duty_card: "authenticated",
  school_year_for: INTERNAL,
  school_weeks: INTERNAL,
  changeover_date: INTERNAL,
  rota_pick_school_year: INTERNAL,
  rota_lock_families: INTERNAL,
  duty_create: INTERNAL,
  place_lock: INTERNAL,
  place_exchange: INTERNAL,
  place_reassign: INTERNAL,
  place_release: INTERNAL,
  duty_rota_managed: INTERNAL,
  duty_rota_managed_places: INTERNAL,
  duty_rota_managed_request: INTERNAL,
  swap_withdraw_core: INTERNAL,
  cancellation_request_core: INTERNAL,
  // Ovis tábla U6 (C10, C11, C12, C16, C20, BR60 to BR64). The standing command, the two weekend pick commands and
  // the unpicked list are signed-in commands that check their caller themselves; the eligibility checks, the draft
  // and notice helpers, the timed checks and the change and removal functions for later units are internal.
  family_standing_set: "authenticated",
  weekend_pick_set: "authenticated",
  weekend_pick_assign: "authenticated",
  weekend_unpicked_list: "authenticated",
  duty_ineligible_result: INTERNAL,
  duty_standing_check: INTERNAL,
  duty_standing_check_task: INTERNAL,
  families_with_standing: INTERNAL,
  family_hold_reason: INTERNAL,
  family_may_hold_duty: INTERNAL,
  family_standing: INTERNAL,
  swap_standing_check: INTERNAL,
  rota_adjust_picks_after_change: INTERNAL,
  rota_check_change: INTERNAL,
  rota_draft_compute: INTERNAL,
  rota_family_for: INTERNAL,
  rota_flagged_duties: INTERNAL,
  rota_notice_parents: INTERNAL,
  rota_notice_super_admins: INTERNAL,
  rota_planning_removal_apply: INTERNAL,
  rota_planning_removal_preview: INTERNAL,
  rota_week_duty: INTERNAL,
  // Ovis tábla U13 (C1, C9, C16, C17; BR130 to BR140). The reads and the commands of the lending library are
  // signed-in functions that check their caller themselves; the owner helpers, the notice facts, the daily check and
  // the removal block for later units are internal; the one-off load is the service role's.
  library_list: "authenticated",
  library_get: "authenticated",
  library_book_add: "authenticated",
  library_book_change: "authenticated",
  library_book_remove: "authenticated",
  library_book_borrow: "authenticated",
  library_loan_set_until: "authenticated",
  library_book_return: "authenticated",
  library_watch_add: "authenticated",
  library_watch_remove: "authenticated",
  book_notice_facts: INTERNAL,
  library_caller_owns: INTERNAL,
  library_owner_has_rights: INTERNAL,
  library_owner_problem: INTERNAL,
  library_lock_book_for_owner: INTERNAL,
  library_due_check: INTERNAL,
  library_removal_apply: INTERNAL,
  library_removal_preview: INTERNAL,
  migration_load_book: "service_role",
  rota_week_reminder_check: INTERNAL,
  weekend_pick_alert_send: INTERNAL,
  weekend_pick_owed: INTERNAL,
  weekend_pick_step: INTERNAL,
  weekend_picking_state: INTERNAL,
  weekend_picks_alert_check: INTERNAL,
  weekend_picks_due_check: INTERNAL,
  weekend_shelter_duty: INTERNAL,
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
  parent_profiles:
    "directory-schema.test.ts (role matrix) and directory-profile.test.ts (who sees what)",
  email_change_requests: "identity-email-change.test.ts (no access for any role)",
  email_send_attempts: "identity-email-change.test.ts (no access for any role)",
  migration_loads: "directory-records.test.ts (no access for any role)",
  children: "directory-schema.test.ts (role matrix)",
  organization_settings: "directory-schema.test.ts (settings matrix)",
  reminder_settings: "directory-schema.test.ts (settings matrix)",
  events: "coordination-schema.test.ts (role matrix)",
  event_notices: "events-core.test.ts (no access for any role)",
  event_roles: "events-notices-roles.test.ts (no access for any role)",
  event_signups: "events-signups.test.ts (no access for any role)",
  food_offers: "events-signups.test.ts (no access for any role)",
  books: "library-core.test.ts (no access for any role)",
  loans: "library-core.test.ts (no access for any role)",
  return_watches: "library-core.test.ts (no access for any role)",
  tasks: "coordination-schema.test.ts (role matrix)",
  assignments:
    "coordination-schema.test.ts (role matrix) and identity-session.test.ts (policy matrix)",
  change_requests: "coordination-schema.test.ts (role matrix)",
  contribution_notes: "coordination-schema.test.ts (role matrix)",
  notifications: "notifications-schema.test.ts (role matrix)",
  reminder_jobs: "notifications-schema.test.ts (no policy: no direct access for any role)",
  reminder_recipients: "notifications-schema.test.ts (no policy: no direct access for any role)",
  notice_kinds: "notifications-schema.test.ts (no policy: no direct access for any role)",
  notice_targets: "notifications-schema.test.ts (no policy: no direct access for any role)",
  timed_check_registry: "notifications-schema.test.ts (no policy: no direct access for any role)",
  email_deliveries: "notifications-schema.test.ts (no policy: no direct access for any role)",
  email_attempts: "notifications-schema.test.ts (no policy: no direct access for any role)",
  timed_runs: "notifications-schema.test.ts (no policy: no direct access for any role)",
  timed_check_runs: "notifications-schema.test.ts (no policy: no direct access for any role)",
  break_weeks: "rota-plan.test.ts (BR27.2 table access)",
  rota_plans: "rota-plan.test.ts (BR27.2 table access)",
  rota_weeks: "rota-plan.test.ts (BR27.2 table access)",
  family_year_standings: "rota-standing.test.ts (table access)",
  weekend_slots: "weekend-picks.test.ts (table access)",
  weekend_picks: "weekend-picks.test.ts (table access)",
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
  parent_profiles: "none: read through directory_list, never a detail screen",
  email_change_requests: "none: no application access",
  email_send_attempts: "none: no application access",
  migration_loads: "none: no application access",
  children: "none: U3 table, probe branch comes with the rewrite of scope_probe",
  organization_settings: "none: U3 table, never a detail screen",
  reminder_settings: "none: U3 table, never a detail screen",
  events: "none: U3 table, probe branch comes with the rewrite of scope_probe",
  event_notices: "none: read through event_get, never a detail screen of the probe",
  event_roles: "none: read through event_get, never a detail screen of the probe",
  event_signups: "none: read through event_get, never a detail screen of the probe",
  food_offers: "none: read through event_get, never a detail screen of the probe",
  books: "none: read through library_list and library_get, never a detail screen of the probe",
  loans: "none: read through library_get, never a detail screen of the probe",
  return_watches: "none: read through library_get, never a detail screen of the probe",
  tasks: "none: U3 table, probe branch comes with the rewrite of scope_probe",
  change_requests: "none: U3 table, probe branch comes with the rewrite of scope_probe",
  contribution_notes: "none: U3 table, never a detail screen",
  break_weeks: "none: U2 table, never a detail screen",
  rota_plans: "none: U2 table, read through the plan and overview functions, never a detail screen",
  rota_weeks: "none: U2 table, read through the plan and overview functions, never a detail screen",
  family_year_standings:
    "none: U6 table, read through the calendar function, never a detail screen",
  weekend_slots:
    "none: U6 table, read through the overview and card functions, never a detail screen",
  weekend_picks:
    "none: U6 table, read through the overview and card functions, never a detail screen",
  // U4 tables: a notification, a reminder job and its rows are never a detail screen of the probe.
  notifications: "none: U4 table, never a detail screen",
  reminder_jobs: "none: U4 table, never a detail screen",
  reminder_recipients: "none: U4 table, never a detail screen",
  notice_kinds: "none: U5 registry, never a detail screen",
  notice_targets: "none: U5 registry, never a detail screen",
  timed_check_registry: "none: U5 registry, never a detail screen",
  email_deliveries: "none: U5 table, never a detail screen",
  email_attempts: "none: U5 table, never a detail screen",
  timed_runs: "none: U5 table, never a detail screen",
  timed_check_runs: "none: U5 table, never a detail screen",
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
