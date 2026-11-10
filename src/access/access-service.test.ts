import { SupabaseRouteAdapter } from "./supabase-route-adapter.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { AccessService } from "./access-service.ts";
import {
  InMemoryAccessTransaction,
  InMemoryAuditWriter,
  InMemoryRoleGrantRepository,
  InMemoryUserRepository,
} from "./in-memory-adapters.ts";
import type { RoleGrant, Scope, User } from "./types.ts";

const org: Scope = { id: "org", type: "organization", organizationId: "org" };
const groupA: Scope = { id: "a", type: "group", organizationId: "org" };
const groupB: Scope = { id: "b", type: "group", organizationId: "org" };
const familyA: Scope = { id: "a", type: "family", organizationId: "org" };
const fixedNow = () => new Date("2026-08-06T10:00:00.000Z");
const person = (id: string): User => ({ id, isActive: true, authorizationVersion: 1 });
const roleGrant = (
  id: string,
  subjectId: string,
  role: RoleGrant["role"],
  scope: Scope,
): RoleGrant => ({ id, subjectId, role, scope, grantedAt: "2026-08-01T00:00:00.000Z" });
function setup(users: User[], grants: RoleGrant[]) {
  const audit = new InMemoryAuditWriter();
  const userRepository = new InMemoryUserRepository(users);
  const grantRepository = new InMemoryRoleGrantRepository(grants);
  return {
    audit,
    users: userRepository,
    grants: grantRepository,
    service: new AccessService(
      userRepository,
      grantRepository,
      audit,
      fixedNow,
      new InMemoryAccessTransaction(userRepository, grantRepository, audit),
    ),
  };
}
const session = (subjectId: string, authorizationVersion = 1) => ({
  subjectId,
  authorizationVersion,
});

test("allows organization admins across their organization", () => {
  const { service } = setup([person("admin")], [roleGrant("g", "admin", "super_admin", org)]);
  assert.deepEqual(
    service.authorize(session("admin"), {
      action: "update",
      resource: { kind: "group", scope: groupA },
    }),
    { allowed: true, code: "allowed" },
  );
});
test("restricts group admins to their granted group", () => {
  const { service } = setup([person("admin")], [roleGrant("g", "admin", "group_admin", groupA)]);
  assert.equal(
    service.authorize(session("admin"), {
      action: "read",
      resource: { kind: "task", scope: groupA },
    }).allowed,
    true,
  );
  assert.equal(
    service.authorize(session("admin"), {
      action: "read",
      resource: { kind: "task", scope: groupB },
    }).allowed,
    false,
  );
  assert.equal(
    service.authorize(session("admin"), {
      action: "read",
      resource: { kind: "child", scope: groupA },
    }).allowed,
    false,
    "family records are a super admin's (BR3.9)",
  );
});
test("restricts parents to their linked family", () => {
  const { service } = setup([person("parent")], [roleGrant("g", "parent", "parent", familyA)]);
  assert.equal(
    service.authorize(session("parent"), {
      action: "read",
      resource: { kind: "assignment", scope: familyA },
    }).allowed,
    true,
  );
  assert.equal(
    service.authorize(session("parent"), {
      action: "read",
      resource: { kind: "assignment", scope: { ...familyA, id: "other" } },
    }).allowed,
    false,
  );
});
test("limits Kindergarten teacher to schedules and coordination display names", () => {
  const { service } = setup(
    [person("staff")],
    [roleGrant("g", "staff", "kindergarten_teacher", org)],
  );
  assert.equal(
    service.authorize(session("staff"), {
      action: "read",
      resource: { kind: "coordination", scope: groupA, field: "display_name" },
    }).allowed,
    true,
  );
  assert.equal(
    service.authorize(session("staff"), {
      action: "read",
      resource: { kind: "coordination", scope: groupA, field: "phone" },
    }).allowed,
    false,
  );
  assert.equal(
    service.authorize(session("staff"), {
      action: "update",
      resource: { kind: "schedule", scope: groupA },
    }).allowed,
    false,
  );
});
test("returns generic Hungarian denials and redacted audit evidence", () => {
  const { audit, service } = setup(
    [person("parent")],
    [roleGrant("g", "parent", "parent", familyA)],
  );
  assert.deepEqual(
    service.authorize(session("parent"), {
      action: "read",
      resource: { kind: "family", scope: { ...familyA, id: "secret" }, field: "email" },
    }),
    { allowed: false, code: "authorization_denied", message: "Nincs jogosultság" },
  );
  assert.deepEqual(audit.events[0], {
    actorId: "parent",
    eventType: "authorization_denied",
    occurredAt: "2026-08-06T10:00:00.000Z",
    summary: "Authorization denied",
  });
});
test("revocation invalidates the next protected request", () => {
  const { service, users } = setup(
    [person("super"), person("group")],
    [roleGrant("s", "super", "super_admin", org), roleGrant("g", "group", "group_admin", groupA)],
  );
  assert.equal(service.revokeRole(session("super"), "g"), undefined);
  assert.equal(users.findById("group")?.authorizationVersion, 2);
  assert.deepEqual(
    service.authorize(session("group"), {
      action: "read",
      resource: { kind: "group", scope: groupA },
    }),
    { allowed: false, code: "reauthorization_required", message: "Nincs jogosultság" },
  );
});
test("prevents group admins from changing super-admin governance", () => {
  const { service } = setup(
    [person("admin"), person("candidate")],
    [roleGrant("g", "admin", "group_admin", groupA)],
  );
  assert.deepEqual(
    service.grantRole(session("admin"), {
      id: "new",
      subjectId: "candidate",
      role: "super_admin",
      scope: org,
    }),
    { allowed: false, code: "authorization_denied", message: "Nincs jogosultság" },
  );
});

test("teacher commands and advanced group operations preserve state", () => {
  const { service, users, grants } = setup(
    [person("teacher"), person("group")],
    [
      roleGrant("t", "teacher", "kindergarten_teacher", org),
      roleGrant("g", "group", "group_admin", groupA),
    ],
  );
  const before = { users: users.list(), grants: grants.list() };
  for (const action of ["create", "update", "delete", "manage"] as const)
    assert.equal(
      service.authorize(session("teacher"), {
        action,
        resource: { kind: "schedule", scope: groupA },
      }).allowed,
      false,
    );
  for (const kind of ["import", "reminder", "lifecycle", "settings", "role_grant"])
    assert.equal(
      service.authorize(session("group"), { action: "manage", resource: { kind, scope: groupA } })
        .allowed,
      false,
    );
  assert.deepEqual({ users: users.list(), grants: grants.list() }, before);
});
test("missing inactive and invalid generation subjects cannot authorize", () => {
  for (const user of [
    { ...person("teacher"), isActive: false },
    { ...person("teacher"), authorizationVersion: 0 },
  ]) {
    const { service } = setup([user], [roleGrant("t", "teacher", "kindergarten_teacher", org)]);
    assert.equal(
      service.authorize(session("teacher"), {
        action: "read",
        resource: { kind: "schedule", scope: groupA },
      }).code,
      "reauthorization_required",
    );
  }
});
test("grant writes invalidate current version atomically", () => {
  const { service, users } = setup(
    [person("super"), person("target")],
    [roleGrant("s", "super", "super_admin", org)],
  );
  const result = service.grantRole(session("super"), {
    id: "new",
    subjectId: "target",
    role: "kindergarten_teacher",
    scope: org,
  });
  assert.equal("role" in result, true);
  assert.equal(users.findById("target")?.authorizationVersion, 2);
});
test("last active administrator cannot revoke itself", () => {
  const { service, users, grants } = setup(
    [person("super")],
    [roleGrant("s", "super", "super_admin", org)],
  );
  assert.equal(service.revokeRole(session("super"), "s")?.code, "authorization_denied");
  assert.equal(users.findById("super")?.authorizationVersion, 1);
  assert.equal(grants.findById("s")?.revokedAt, undefined);
});
test("equivalent surviving grant preserves administrator without treating duplicate subjects as independent admins", () => {
  const { service, users, grants } = setup(
    [person("super")],
    [
      roleGrant("s", "super", "super_admin", org),
      roleGrant("equivalent", "super", "super_admin", org),
    ],
  );
  assert.equal(service.revokeRole(session("super"), "s"), undefined);
  assert.equal(users.findById("super")?.authorizationVersion, 2);
  assert.equal(service.revokeRole(session("super", 2), "equivalent")?.code, "authorization_denied");
  assert.equal(grants.findById("equivalent")?.revokedAt, undefined);
});
test("inactive revoked and other-organization administrators cannot satisfy final-admin guard", () => {
  for (const other of [
    {
      user: { ...person("other"), isActive: false },
      grant: roleGrant("o", "other", "super_admin", org),
    },
    {
      user: person("other"),
      grant: { ...roleGrant("o", "other", "super_admin", org), revokedAt: "2026" },
    },
    {
      user: person("other"),
      grant: roleGrant("o", "other", "super_admin", {
        id: "other",
        type: "organization",
        organizationId: "other",
      }),
    },
  ]) {
    const { service } = setup(
      [person("super"), other.user],
      [roleGrant("s", "super", "super_admin", org), other.grant],
    );
    assert.equal(service.revokeRole(session("super"), "s")?.code, "authorization_denied");
  }
});
test("another distinct active organization administrator permits revoke", () => {
  const { service } = setup(
    [person("super"), person("other")],
    [roleGrant("s", "super", "super_admin", org), roleGrant("o", "other", "super_admin", org)],
  );
  assert.equal(service.revokeRole(session("super"), "o"), undefined);
});
test("grant identity cannot move subject or scope through overwrite", () => {
  const { service, grants } = setup(
    [person("super"), person("target"), person("other")],
    [roleGrant("s", "super", "super_admin", org), roleGrant("t", "target", "group_admin", groupA)],
  );
  const before = grants.list();
  for (const input of [
    { id: "t", subjectId: "other", role: "group_admin" as const, scope: groupA },
    { id: "t", subjectId: "target", role: "group_admin" as const, scope: groupB },
  ])
    assert.equal(
      (service.grantRole(session("super"), input) as import("./types.ts").AuthorizationDecision)
        .allowed,
      false,
    );
  assert.deepEqual(grants.list(), before);
});
test("overflow and unavailable transaction reject mutation", () => {
  const { service, grants } = setup(
    [person("super"), { ...person("target"), authorizationVersion: 2147483647 }],
    [roleGrant("s", "super", "super_admin", org)],
  );
  assert.equal(
    (
      service.grantRole(session("super"), {
        id: "new",
        subjectId: "target",
        role: "group_admin",
        scope: groupA,
      }) as import("./types.ts").AuthorizationDecision
    ).allowed,
    false,
  );
  assert.equal(grants.findById("new"), undefined);
  const readOnly = new AccessService(
    new InMemoryUserRepository([person("super")]),
    grants,
    new InMemoryAuditWriter(),
  );
  assert.equal(readOnly.revokeRole(session("super"), "s")?.code, "transaction_failed");
});
test("repeated revoke is no-op and does not invalidate twice", () => {
  const { service, users } = setup(
    [person("super"), person("target")],
    [roleGrant("s", "super", "super_admin", org), roleGrant("t", "target", "group_admin", groupA)],
  );
  service.revokeRole(session("super"), "t");
  assert.equal(service.revokeRole(session("super"), "t"), undefined);
  assert.equal(users.findById("target")?.authorizationVersion, 2);
});

test("persistence version adapter rejects invalid and nonnumeric generations", async () => {
  for (const value of [0, -1, 1.2, NaN, 2147483648, "1", null]) {
    const adapter = new SupabaseRouteAdapter({
      async rpc() {
        return { data: value, error: null };
      },
    });
    assert.equal(await adapter.authorizationVersion("subject"), undefined);
  }
});
test("persistence adapter uses self-version RPC contract", async () => {
  const calls: unknown[] = [];
  const adapter = new SupabaseRouteAdapter({
    async rpc(name, args) {
      calls.push([name, args]);
      return { data: 2, error: null };
    },
  });
  assert.equal(await adapter.authorizationVersion("subject"), 2);
  assert.deepEqual(calls, [["authorization_version_for", { requested_subject_id: "subject" }]]);
});
test("persistence current role scope RPC binds all role/scope dimensions", async () => {
  const calls: unknown[] = [];
  const adapter = new SupabaseRouteAdapter({
    async rpc(name, args) {
      calls.push([name, args]);
      return { data: true, error: null };
    },
  });
  assert.equal(await adapter.hasCurrentRoleScope("kindergarten_teacher", org), true);
  assert.deepEqual(calls, [
    [
      "has_current_role_scope",
      {
        requested_role: "kindergarten_teacher",
        requested_organization_id: "org",
        requested_scope_type: "organization",
        requested_scope_id: "org",
      },
    ],
  ]);
});
test("scope-only or malformed persistence requests do not query", async () => {
  let calls = 0;
  const adapter = new SupabaseRouteAdapter({
    async rpc() {
      calls++;
      return { data: true, error: null };
    },
  });
  assert.equal(await adapter.hasActiveScope(groupA), false);
  assert.equal(await adapter.hasCurrentRoleScope("kindergarten_teacher", groupA), false);
  assert.equal(calls, 0);
});
test("persistence boolean adapter rejects truthy nonbooleans", async () => {
  for (const value of [1, "true", {}, null]) {
    const adapter = new SupabaseRouteAdapter({
      async rpc() {
        return { data: value, error: null };
      },
    });
    assert.equal(await adapter.hasActiveScope(groupA, "group_admin"), false);
  }
});
test("persistence adapter propagates dependency failure for boundary mapping", async () => {
  const error = new Error("dependency");
  const adapter = new SupabaseRouteAdapter({
    async rpc() {
      return { data: null, error };
    },
  });
  await assert.rejects(adapter.authorizationVersion("subject"), error);
  await assert.rejects(adapter.hasCurrentRoleScope("group_admin", groupA), error);
});
test("normal grant mutation audit failure rolls back grant and generation", () => {
  const users = new InMemoryUserRepository([person("super"), person("target")]);
  const grants = new InMemoryRoleGrantRepository([roleGrant("s", "super", "super_admin", org)]);
  class FailingAudit extends InMemoryAuditWriter {
    override write() {
      throw new Error("audit unavailable");
    }
  }
  const audit = new FailingAudit();
  const tx = new InMemoryAccessTransaction(users, grants, audit);
  const service = new AccessService(users, grants, audit, fixedNow, tx);
  assert.equal(
    (
      service.grantRole(session("super"), {
        id: "new",
        subjectId: "target",
        role: "group_admin",
        scope: groupA,
      }) as import("./types.ts").AuthorizationDecision
    ).code,
    "transaction_failed",
  );
  assert.equal(grants.findById("new"), undefined);
  assert.equal(users.findById("target")?.authorizationVersion, 1);
});
