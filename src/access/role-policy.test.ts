import assert from "node:assert/strict";
import test from "node:test";
import {
  CURRENT_ROLES,
  effectiveGrants,
  grantAllows,
  isAuthorizationVersion,
  isCurrentRole,
  isRoleScope,
  scopeContains,
} from "./role-policy.ts";
import type { RoleGrant, Scope } from "./types.ts";
const group: Scope = { id: "oak", type: "group", organizationId: "org" };
const family: Scope = { ...group, type: "family", id: "family" };
const org: Scope = { ...group, type: "organization", id: "org" };
const grant = (role: RoleGrant["role"], scope: Scope): RoleGrant => ({
  id: "grant",
  subjectId: "user",
  role,
  scope,
  grantedAt: "2026-10-06",
});
test("current vocabulary exhaustively excludes legacy and unknown values", () => {
  assert.deepEqual(CURRENT_ROLES, ["parent", "group_admin", "kindergarten_teacher", "super_admin"]);
  for (const role of CURRENT_ROLES) assert.equal(isCurrentRole(role), true);
  for (const role of ["read_only_staff", "kindergarten_admin", "staff", "", null, undefined, {}])
    assert.equal(isCurrentRole(role), false);
});
test("each role requires its precise scope shape", () => {
  for (const role of CURRENT_ROLES)
    for (const scope of [group, family, org])
      assert.equal(
        isRoleScope(role, scope),
        scope.type ===
          (role === "parent" ? "family" : role === "group_admin" ? "group" : "organization"),
      );
  assert.equal(isRoleScope("super_admin", { ...org, id: "elsewhere" }), false);
  assert.equal(isRoleScope("parent", { ...family, id: "" }), false);
});
test("same identifiers cannot cross organization or scope type", () => {
  assert.equal(scopeContains(group, { ...group, organizationId: "other" }), false);
  assert.equal(scopeContains(group, { ...group, type: "family" }), false);
  assert.equal(scopeContains(org, group), true);
});
test("teacher tracking allows only safe scoped reads", () => {
  const teacher = grant("kindergarten_teacher", org);
  for (const action of ["create", "update", "delete", "manage"] as const)
    assert.equal(
      grantAllows(teacher, { action, resource: { kind: "schedule", scope: group } }),
      false,
    );
  assert.equal(
    grantAllows(teacher, { action: "read", resource: { kind: "schedule", scope: group } }),
    true,
  );
  for (const field of ["email", "phone", "allergen_note"])
    assert.equal(
      grantAllows(teacher, { action: "read", resource: { kind: "schedule", scope: group, field } }),
      false,
    );
  assert.equal(
    grantAllows(teacher, { action: "read", resource: { kind: "family", scope: group } }),
    false,
  );
  assert.equal(
    grantAllows(teacher, {
      action: "read",
      resource: { kind: "coordination", scope: group, field: "display_name" },
    }),
    true,
  );
});
test("retained role branches deny advanced group operations and private parent fields", () => {
  const admin = grant("group_admin", group),
    parent = grant("parent", family);
  for (const kind of ["import", "reminder", "lifecycle", "settings", "role_grant", "unknown"])
    assert.equal(grantAllows(admin, { action: "manage", resource: { kind, scope: group } }), false);
  assert.equal(
    grantAllows(admin, { action: "update", resource: { kind: "task", scope: group } }),
    true,
  );
  assert.equal(
    grantAllows(parent, { action: "update", resource: { kind: "contribution", scope: family } }),
    true,
  );
  assert.equal(
    grantAllows(parent, { action: "update", resource: { kind: "assignment", scope: family } }),
    false,
  );
  assert.equal(
    grantAllows(parent, {
      action: "read",
      resource: { kind: "family", scope: family, field: "email" },
    }),
    false,
  );
  assert.equal(
    grantAllows(grant("super_admin", org), {
      action: "manage",
      resource: { kind: "role_grant", scope: group },
    }),
    true,
  );
});
test("unknown, invalid and revoked grants never authorize", () => {
  for (const candidate of [
    { ...grant("kindergarten_teacher", org), role: "unknown" } as unknown as RoleGrant,
    { ...grant("kindergarten_teacher", group) },
    { ...grant("kindergarten_teacher", org), revokedAt: "" },
  ])
    assert.equal(
      grantAllows(candidate, { action: "read", resource: { kind: "schedule", scope: group } }),
      false,
    );
});
test("effective dedup preserves history and ignores revoked invalid rows", () => {
  const original = grant("kindergarten_teacher", org);
  const rows = [
    original,
    { ...original, id: "duplicate" },
    { ...original, id: "revoked", revokedAt: "2026" },
    { ...original, id: "invalid", scope: group },
  ];
  assert.deepEqual(effectiveGrants(rows), [original]);
  assert.equal(rows.length, 4);
});
test("authorization versions use the supported positive database range", () => {
  for (const value of [1, 2, 2147483647]) assert.equal(isAuthorizationVersion(value), true);
  for (const value of [0, -1, 1.2, NaN, Infinity, 2147483648, "1", undefined])
    assert.equal(isAuthorizationVersion(value), false);
});

test("every signed-in role reads the published rota and nothing more of it (BR24.1)", () => {
  const holders: [RoleGrant["role"], Scope][] = [
    ["parent", family],
    ["group_admin", group],
    ["kindergarten_teacher", org],
    ["super_admin", org],
  ];
  for (const [role, scope] of holders) {
    const holder = grant(role, scope);
    assert.equal(
      grantAllows(holder, { action: "read", resource: { kind: "rota", scope } }),
      true,
      role,
    );
    for (const action of ["create", "update", "delete", "manage"] as const)
      assert.equal(
        grantAllows(holder, { action, resource: { kind: "rota", scope } }),
        false,
        `${role} ${action}`,
      );
  }
});

test("the school calendar and the rota plan belong to a super admin alone (BR20.2, BR21.1)", () => {
  for (const kind of ["school_calendar", "rota_plan"]) {
    for (const action of ["read", "create", "update", "delete", "manage"] as const)
      assert.equal(
        grantAllows(grant("super_admin", org), { action, resource: { kind, scope: org } }),
        true,
        `${kind} ${action}`,
      );
    for (const [role, scope] of [
      ["parent", family],
      ["group_admin", group],
      ["kindergarten_teacher", org],
    ] as const)
      for (const action of ["read", "create", "update", "delete", "manage"] as const)
        assert.equal(
          grantAllows(grant(role, scope), { action, resource: { kind, scope } }),
          false,
          `${role} ${kind} ${action}`,
        );
  }
});

test("a duty card is read by a parent of the family and by a super admin, never changed (BR24.2)", () => {
  assert.equal(
    grantAllows(grant("parent", family), {
      action: "read",
      resource: { kind: "rota_duty", scope: family },
    }),
    true,
  );
  assert.equal(
    grantAllows(grant("super_admin", org), {
      action: "read",
      resource: { kind: "rota_duty", scope: org },
    }),
    true,
  );
  for (const action of ["create", "update", "delete", "manage"] as const)
    assert.equal(
      grantAllows(grant("parent", family), {
        action,
        resource: { kind: "rota_duty", scope: family },
      }),
      false,
      action,
    );
  assert.equal(
    grantAllows(grant("kindergarten_teacher", org), {
      action: "read",
      resource: { kind: "rota_duty", scope: org },
    }),
    false,
  );
  assert.equal(
    grantAllows(grant("group_admin", group), {
      action: "read",
      resource: { kind: "rota_duty", scope: group },
    }),
    false,
  );
  // A parent of another family cannot reach it through a scope that is not their own.
  assert.equal(
    grantAllows(grant("parent", family), {
      action: "read",
      resource: { kind: "rota_duty", scope: { ...family, id: "other" } },
    }),
    false,
  );
});

test("Group admin preserves scoped queue/year reads without generic advanced dispatch", () => {
  const admin = grant("group_admin", group);
  for (const kind of ["admin_queue", "school_year"]) {
    assert.equal(grantAllows(admin, { action: "read", resource: { kind, scope: group } }), true);
    assert.equal(grantAllows(admin, { action: "manage", resource: { kind, scope: group } }), false);
  }
  assert.equal(
    grantAllows(admin, { action: "manage", resource: { kind: "admin_operation", scope: group } }),
    false,
  );
});
