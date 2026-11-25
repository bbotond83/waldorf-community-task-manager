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
  const grant: RoleGrant = { id: "g", subjectId: "u", role, scope, grantedAt: "2026-11-20" };
  return grantAllows(grant, { action, resource: { kind, scope } });
};

test("every role reads the to-do list, a teacher too, and a teacher does nothing else with it", () => {
  for (const role of CURRENT_ROLES) assert.equal(allowed(role, "read", "todo"), true, role);
  for (const kind of ["todo_task", "todo_manage", "my_tasks"]) {
    for (const action of ["read", "create", "update", "delete", "manage"] as const) {
      assert.equal(allowed("kindergarten_teacher", action, kind), false, `${kind} ${action}`);
    }
  }
});

test("a parent takes, finishes and reads their own tasks through update and read only, and keeps no group's tasks", () => {
  assert.equal(allowed("parent", "update", "todo_task"), true);
  assert.equal(allowed("parent", "read", "my_tasks"), true);
  for (const action of ["create", "delete", "manage"] as const) {
    assert.equal(allowed("parent", action, "todo_task"), false, action);
  }
  for (const action of ["read", "create", "update", "delete", "manage"] as const) {
    assert.equal(allowed("parent", action, "todo_manage"), false, action);
  }
});

test("a coordinator and a super admin keep tasks, free claims and act on tasks", () => {
  for (const role of ["group_admin", "super_admin"] as const) {
    for (const action of ["read", "create", "update"] as const) {
      assert.equal(allowed(role, action, "todo_manage"), true, `${role} ${action}`);
    }
    assert.equal(allowed(role, "update", "todo_task"), true, role);
    assert.equal(allowed(role, "read", "my_tasks"), true, role);
  }
});

test("a grant of another community reaches nothing", () => {
  const other: Scope = { ...org, id: "other", organizationId: "other" };
  const grant: RoleGrant = {
    id: "g",
    subjectId: "u",
    role: "super_admin",
    scope: org,
    grantedAt: "2026-11-20",
  };
  for (const kind of ["todo", "todo_task", "todo_manage", "my_tasks"]) {
    assert.equal(grantAllows(grant, { action: "read", resource: { kind, scope: other } }), false);
  }
});
