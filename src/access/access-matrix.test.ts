import assert from "node:assert/strict";
import test from "node:test";
import {
  AccessService,
  InMemoryAuditWriter,
  InMemoryRoleGrantRepository,
  InMemoryUserRepository,
} from "./index.ts";
const scope = { id: "family", type: "family" as const, organizationId: "org" };
const service = new AccessService(
  new InMemoryUserRepository([{ id: "parent", isActive: true, authorizationVersion: 1 }]),
  new InMemoryRoleGrantRepository([
    { id: "g", subjectId: "parent", role: "parent", scope, grantedAt: "2026-01-01T00:00:00Z" },
  ]),
  new InMemoryAuditWriter(),
);
test("enforces parent action-resource-field matrix", () => {
  const actor = { subjectId: "parent", authorizationVersion: 1 };
  assert.equal(
    service.authorize(actor, { action: "update", resource: { kind: "contribution", scope } })
      .allowed,
    true,
  );
  assert.equal(
    service.authorize(actor, { action: "update", resource: { kind: "assignment", scope } }).allowed,
    false,
  );
  assert.equal(
    service.authorize(actor, {
      action: "read",
      resource: { kind: "family", scope, field: "email" },
    }).allowed,
    false,
  );
});
type AnyScope = { id: string; type: "family" | "organization" | "group"; organizationId: string };
const org = { id: "org", type: "organization" as const, organizationId: "org" };
const group = { id: "group", type: "group" as const, organizationId: "org" };
const grantOf = (
  subjectId: string,
  role: "parent" | "group_admin" | "kindergarten_teacher" | "super_admin",
  at: AnyScope,
) => ({
  id: `g-${subjectId}`,
  subjectId,
  role,
  scope: at,
  grantedAt: "2026-01-01T00:00:00Z",
});
const people = new AccessService(
  new InMemoryUserRepository(
    ["parent", "admin", "teacher", "super"].map((id) => ({
      id,
      isActive: true,
      authorizationVersion: 1,
    })),
  ),
  new InMemoryRoleGrantRepository([
    grantOf("parent", "parent", scope),
    grantOf("admin", "group_admin", group),
    grantOf("teacher", "kindergarten_teacher", org),
    grantOf("super", "super_admin", org),
  ]),
  new InMemoryAuditWriter(),
);
const may = (subjectId: string, action: "read" | "create" | "update", kind: string, at: AnyScope) =>
  people.authorize(
    { subjectId, authorizationVersion: 1 },
    { action, resource: { kind, scope: at } },
  ).allowed;
test("the directory rows: every role reads, nobody writes, a stale version is refused", () => {
  const where = { parent: scope, admin: group, teacher: org, super: org } as const;
  for (const [subject, at] of Object.entries(where)) {
    assert.equal(may(subject, "read", "directory", at), true, subject);
    assert.equal(may(subject, "update", "directory", at), false, subject);
  }
  assert.equal(
    people.authorize(
      { subjectId: "parent", authorizationVersion: 2 },
      { action: "read", resource: { kind: "directory", scope } },
    ).allowed,
    false,
  );
});
test("the own-account rows: the parent of the family only, never a super admin, administrator or teacher", () => {
  assert.equal(may("parent", "update", "own_profile", scope), true);
  assert.equal(may("parent", "update", "own_account", scope), true);
  assert.equal(may("parent", "update", "own_profile", { ...scope, id: "other" }), false);
  for (const [subject, at] of [
    ["super", org],
    ["admin", group],
    ["teacher", org],
  ] as const) {
    assert.equal(may(subject, "update", "own_profile", at), false, subject);
    assert.equal(may(subject, "read", "own_account", at), false, subject);
  }
});
test("the records and invitation rows: a super admin only", () => {
  for (const kind of ["record", "invitation"]) {
    assert.equal(may("super", "create", kind, org), true, kind);
    for (const [subject, at] of [
      ["admin", group],
      ["teacher", org],
      ["parent", scope],
    ] as const) {
      assert.equal(may(subject, "create", kind, at), false, `${subject} ${kind}`);
    }
  }
});
