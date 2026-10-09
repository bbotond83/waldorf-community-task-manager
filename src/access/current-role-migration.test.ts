import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const sql = readFileSync(
  new URL("../../supabase/migrations/20261006_current_roles.sql", import.meta.url),
  "utf8",
);
test("static SQL: transaction locks precede all preflight and mutation", () => {
  assert.match(sql, /begin;/);
  assert.ok(sql.indexOf("lock table public.app_role_grants") < sql.indexOf("do $$"));
  assert.ok(sql.indexOf("lock table public.app_authorization_versions") < sql.indexOf("do $$"));
  assert.match(sql, /commit;\s*$/);
});
test("static SQL: unknown issuer/schema/triggers/version overflow block explicitly", () => {
  for (const marker of [
    "authoritative_issuer_baseline",
    "information_schema.columns",
    "pg_trigger",
    "2147483647",
    "UNSUPPORTED_ROLE_OR_SCOPE",
  ])
    assert.ok(sql.includes(marker));
});
test("static SQL: only role changes, distinct invalidation and baseline missing version 2", () => {
  assert.match(sql, /update public.app_role_grants g set role=c\."current_role"/);
  assert.match(sql, /select distinct subject_id,2/);
  assert.match(sql, /authorization_version\+1/);
  assert.doesNotMatch(sql, /delete from public.app_role_grants/i);
});
test("static SQL: restricted redacted append-only conversion evidence retains roles", () => {
  assert.match(sql, /original_role text/);
  assert.match(sql, /"current_role" text/);
  assert.match(sql, /revoke insert,update,delete.*app_role_conversion_evidence/);
  assert.match(sql, /conversion_governance_read.*has_super_scope/);
});
test("static SQL: four-role scope enforcement validates organization identity", () => {
  assert.match(sql, /add constraint current_role_scope/);
  assert.match(sql, /role='parent' and scope_type='family'/);
  assert.match(sql, /role in \('group_admin','kindergarten_teacher'\) and scope_type='group'/);
  assert.match(sql, /scope_id=organization_id/);
});
test("static SQL: entire previous policy inventory removed before replacements", () => {
  assert.match(sql, /from pg_policies/);
  assert.match(sql, /drop policy %I/);
  assert.ok(sql.indexOf("drop policy %I") < sql.indexOf("create policy current_grants_self"));
  assert.match(sql, /drop function if exists public.has_active_scope/);
  assert.match(sql, /drop function if exists public.has_admin_scope/);
});
test("static SQL: family identity and supported group relations deny teacher raw access", () => {
  const policies = sql.slice(sql.indexOf("create policy family_current_read"));
  assert.match(policies, /'parent',organization_id,'family',id/);
  assert.doesNotMatch(policies, /kindergarten_teacher/);
  assert.match(policies, /assignment_current_read.*has_core_scope/);
  assert.match(policies, /import_current_read.*has_super_scope/);
});
test("static SQL: version lookup is self-restricted and helper execution restricted", () => {
  assert.match(sql, /requested_subject_id=auth.uid\(\)/);
  assert.match(sql, /revoke all on function/);
  assert.match(sql, /to authenticated/);
});
