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

test("standings, assigned picks and the unpicked list belong to a super admin alone (BR60.1, BR63.6, BR63.8)", () => {
  for (const kind of ["family_standing", "weekend_unpicked_list"]) {
    for (const action of ["read", "update", "manage"] as const)
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
      for (const action of ["read", "update", "manage"] as const)
        assert.equal(
          grantAllows(grant(role, scope), { action, resource: { kind, scope } }),
          false,
          `${role} ${kind} ${action}`,
        );
  }
});

test("a parent picks a weekend slot for the own family, and no other action on picks is the parent's (BR63.4)", () => {
  assert.equal(
    grantAllows(grant("parent", family), {
      action: "update",
      resource: { kind: "weekend_pick", scope: family },
    }),
    true,
  );
  assert.equal(
    grantAllows(grant("parent", family), {
      action: "update",
      resource: { kind: "weekend_pick", scope: { ...family, id: "other" } },
    }),
    false,
  );
  for (const action of ["read", "create", "delete", "manage"] as const)
    assert.equal(
      grantAllows(grant("parent", family), {
        action,
        resource: { kind: "weekend_pick", scope: family },
      }),
      false,
      action,
    );
  for (const [role, scope] of [
    ["group_admin", group],
    ["kindergarten_teacher", org],
  ] as const)
    assert.equal(
      grantAllows(grant(role, scope), {
        action: "update",
        resource: { kind: "weekend_pick", scope },
      }),
      false,
      role,
    );
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
test("every current role reads the directory and nothing else of it (BR30.1)", () => {
  const request = (action: Parameters<typeof grantAllows>[1]["action"], scope: Scope) => ({
    action,
    resource: { kind: "directory", scope },
  });
  for (const [role, scope] of [
    ["parent", family],
    ["group_admin", group],
    ["kindergarten_teacher", org],
    ["super_admin", org],
  ] as const) {
    assert.equal(grantAllows(grant(role, scope), request("read", scope)), true, role);
    for (const action of ["create", "update", "delete", "manage"] as const) {
      assert.equal(
        grantAllows(grant(role, scope), request(action, scope)),
        false,
        `${role} ${action}`,
      );
    }
  }
  assert.equal(
    grantAllows(grant("parent", family), request("read", { ...family, id: "other" })),
    false,
  );
  assert.equal(
    grantAllows(grant("parent", family), request("read", { ...family, organizationId: "other" })),
    false,
  );
});
test("a parent's own profile and account belong to the parent grant alone, a super admin included (BR31.2, BR32.1, NFR3.4)", () => {
  for (const kind of ["own_profile", "own_account"]) {
    for (const action of ["read", "update"] as const) {
      assert.equal(
        grantAllows(grant("parent", family), { action, resource: { kind, scope: family } }),
        true,
        `parent ${kind} ${action}`,
      );
      for (const [role, scope] of [
        ["super_admin", org],
        ["group_admin", group],
        ["kindergarten_teacher", org],
      ] as const) {
        assert.equal(
          grantAllows(grant(role, scope), { action, resource: { kind, scope } }),
          false,
          `${role} ${kind}`,
        );
        assert.equal(
          grantAllows(grant(role, scope), { action, resource: { kind, scope: family } }),
          false,
        );
      }
    }
    for (const action of ["create", "delete", "manage"] as const) {
      assert.equal(
        grantAllows(grant("parent", family), { action, resource: { kind, scope: family } }),
        false,
      );
    }
    assert.equal(
      grantAllows(grant("parent", family), {
        action: "update",
        resource: { kind, scope: { ...family, id: "other" } },
      }),
      false,
      "another family's parent",
    );
  }
});
test("invitations and family and parent records are a super admin's alone (BR35.1, BR37.1)", () => {
  for (const kind of ["invitation", "record"]) {
    assert.equal(
      grantAllows(grant("super_admin", org), { action: "create", resource: { kind, scope: org } }),
      true,
      kind,
    );
    for (const [role, scope] of [
      ["group_admin", group],
      ["kindergarten_teacher", org],
      ["parent", family],
    ] as const) {
      assert.equal(
        grantAllows(grant(role, scope), { action: "create", resource: { kind, scope } }),
        false,
        `${role} ${kind}`,
      );
    }
  }
});
test("joining and leaving a working group is a parent's own act: no other role holds it, a super admin included (BR40)", () => {
  for (const action of ["create", "update"] as const) {
    assert.equal(
      grantAllows(grant("parent", family), {
        action,
        resource: { kind: "working_group_membership", scope: family },
      }),
      true,
      `parent ${action}`,
    );
    for (const [role, scope] of [
      ["group_admin", group],
      ["kindergarten_teacher", org],
      ["super_admin", org],
    ] as const) {
      assert.equal(
        grantAllows(grant(role, scope), {
          action,
          resource: { kind: "working_group_membership", scope },
        }),
        false,
        `${role} ${action}`,
      );
    }
  }
  // A parent holds no other action on a membership.
  for (const action of ["read", "delete", "manage"] as const) {
    assert.equal(
      grantAllows(grant("parent", family), {
        action,
        resource: { kind: "working_group_membership", scope: family },
      }),
      false,
      `parent ${action}`,
    );
  }
});
test("every role reads the event pages, signing up and offering food are a parent's own acts, managing needs a group admin or super admin (BR104.1, BR108.1, BR113.1)", () => {
  const holders = [
    ["parent", family],
    ["group_admin", group],
    ["kindergarten_teacher", org],
    ["super_admin", org],
  ] as const;
  for (const [role, scope] of holders) {
    assert.equal(
      grantAllows(grant(role, scope), { action: "read", resource: { kind: "event", scope } }),
      true,
      `${role} reads`,
    );
    assert.equal(
      grantAllows(grant(role, scope), { action: "update", resource: { kind: "event", scope } }),
      false,
      `${role} does not change an event page itself`,
    );
    assert.equal(
      grantAllows(grant(role, scope), {
        action: "manage",
        resource: { kind: "event_manage", scope },
      }),
      role === "group_admin" || role === "super_admin",
      `${role} manage`,
    );
    for (const kind of ["event_signup", "food_offer"]) {
      for (const action of ["create", "update", "delete"] as const) {
        assert.equal(
          grantAllows(grant(role, scope), { action, resource: { kind, scope } }),
          role === "parent",
          `${role} ${action} ${kind}`,
        );
      }
    }
  }
  assert.equal(
    grantAllows(grant("parent", family), {
      action: "read",
      resource: { kind: "event_signup", scope: family },
    }),
    false,
    "a parent reads sign-ups through the event page, not as a resource of their own",
  );
});
test("appointing and revoking a coordinator is a super admin's alone (BR41.1)", () => {
  assert.equal(
    grantAllows(grant("super_admin", org), {
      action: "manage",
      resource: { kind: "working_group_coordinator", scope: org },
    }),
    true,
  );
  for (const [role, scope] of [
    ["group_admin", group],
    ["kindergarten_teacher", org],
    ["parent", family],
  ] as const) {
    for (const action of ["read", "create", "update", "delete", "manage"] as const) {
      assert.equal(
        grantAllows(grant(role, scope), {
          action,
          resource: { kind: "working_group_coordinator", scope },
        }),
        false,
        `${role} ${action}`,
      );
    }
  }
});
test("delivery failures (resource reminder) are a super admin's alone, for the list and for Try again", () => {
  for (const action of ["read", "update"] as const) {
    assert.equal(
      grantAllows(grant("super_admin", org), {
        action,
        resource: { kind: "reminder", scope: org },
      }),
      true,
    );
    for (const [role, scope] of [
      ["group_admin", group],
      ["kindergarten_teacher", group],
      ["parent", family],
    ] as const) {
      assert.equal(
        grantAllows(grant(role, scope), { action, resource: { kind: "reminder", scope } }),
        false,
        `${role} ${action}`,
      );
    }
  }
});
