import assert from "node:assert/strict";
import test from "node:test";
import { CURRENT_ROLES, grantAllows } from "./role-policy.ts";
import type { AuthorizationAction, Role, RoleGrant, Scope } from "./types.ts";

const org: Scope = { id: "org", type: "organization", organizationId: "org" };
const group: Scope = { id: "group", type: "group", organizationId: "org" };
const family: Scope = { id: "family", type: "family", organizationId: "org" };
const SCOPE_OF_ROLE: Readonly<Record<Role, Scope>> = {
  parent: family,
  group_admin: group,
  kindergarten_teacher: org,
  super_admin: org,
};

const allowed = (role: Role, action: AuthorizationAction, kind: string): boolean => {
  const scope = SCOPE_OF_ROLE[role];
  const grant: RoleGrant = { id: "g", subjectId: "u", role, scope, grantedAt: "2026-11-15" };
  return grantAllows(grant, { action, resource: { kind, scope } });
};

test("every role reads the recurring duties, a teacher too, and a teacher does nothing else", () => {
  for (const role of CURRENT_ROLES) assert.equal(allowed(role, "read", "recurring"), true, role);
  for (const action of ["create", "update", "delete", "manage"] as const) {
    assert.equal(allowed("kindergarten_teacher", action, "recurring"), false);
    assert.equal(allowed("kindergarten_teacher", action, "recurring_duty"), false);
    assert.equal(allowed("kindergarten_teacher", action, "recurring_schedule"), false);
  }
  assert.equal(allowed("kindergarten_teacher", "read", "recurring_schedule"), false);
});

test("a parent marks, undoes and skips through the update action only, and keeps no schedule", () => {
  assert.equal(allowed("parent", "update", "recurring_duty"), true);
  for (const action of ["create", "delete", "manage"] as const) {
    assert.equal(allowed("parent", action, "recurring_duty"), false, action);
  }
  for (const action of ["read", "create", "update", "delete", "manage"] as const) {
    assert.equal(allowed("parent", action, "recurring_schedule"), false, action);
  }
});

test("a coordinator and a super admin keep schedules and act on duties", () => {
  for (const role of ["group_admin", "super_admin"] as const) {
    for (const action of ["read", "create", "update", "manage"] as const) {
      assert.equal(allowed(role, action, "recurring_schedule"), true, `${role} ${action}`);
    }
    assert.equal(allowed(role, "update", "recurring_duty"), true, role);
  }
});

test("a grant of another community reaches nothing", () => {
  const other: Scope = { ...org, id: "other", organizationId: "other" };
  const grant: RoleGrant = {
    id: "g",
    subjectId: "u",
    role: "super_admin",
    scope: org,
    grantedAt: "2026-11-15",
  };
  for (const kind of ["recurring", "recurring_duty", "recurring_schedule"]) {
    assert.equal(grantAllows(grant, { action: "read", resource: { kind, scope: other } }), false);
  }
});
