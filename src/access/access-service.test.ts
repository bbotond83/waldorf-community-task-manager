import assert from "node:assert/strict";
import test from "node:test";
import { AccessService } from "./access-service.ts";
import { InMemoryAuditWriter, InMemoryRoleGrantRepository, InMemoryUserRepository } from "./in-memory-adapters.ts";
import type { RoleGrant, Scope, User } from "./types.ts";

const org: Scope = { id: "org", type: "organization", organizationId: "org" };
const groupA: Scope = { id: "a", type: "group", organizationId: "org" };
const groupB: Scope = { id: "b", type: "group", organizationId: "org" };
const familyA: Scope = { id: "a", type: "family", organizationId: "org" };
const fixedNow = () => new Date("2026-08-06T10:00:00.000Z");
const person = (id: string): User => ({ id, isActive: true, authorizationVersion: 1 });
const roleGrant = (id: string, subjectId: string, role: RoleGrant["role"], scope: Scope): RoleGrant => ({ id, subjectId, role, scope, grantedAt: "2026-08-01T00:00:00.000Z" });
function setup(users: User[], grants: RoleGrant[]) { const audit = new InMemoryAuditWriter(); const userRepository = new InMemoryUserRepository(users); return { audit, users: userRepository, service: new AccessService(userRepository, new InMemoryRoleGrantRepository(grants), audit, fixedNow) }; }
const session = (subjectId: string, authorizationVersion = 1) => ({ subjectId, authorizationVersion });

test("allows organization admins across their organization", () => {
  const { service } = setup([person("admin")], [roleGrant("g", "admin", "kindergarten_admin", org)]);
  assert.deepEqual(service.authorize(session("admin"), { action: "update", resource: { kind: "group", scope: groupA } }), { allowed: true, code: "allowed" });
});
test("restricts group admins to their granted group", () => {
  const { service } = setup([person("admin")], [roleGrant("g", "admin", "group_admin", groupA)]);
  assert.equal(service.authorize(session("admin"), { action: "read", resource: { kind: "child", scope: groupA } }).allowed, true);
  assert.equal(service.authorize(session("admin"), { action: "read", resource: { kind: "child", scope: groupB } }).allowed, false);
});
test("restricts parents to their linked family", () => {
  const { service } = setup([person("parent")], [roleGrant("g", "parent", "parent", familyA)]);
  assert.equal(service.authorize(session("parent"), { action: "read", resource: { kind: "assignment", scope: familyA } }).allowed, true);
  assert.equal(service.authorize(session("parent"), { action: "read", resource: { kind: "assignment", scope: { ...familyA, id: "other" } } }).allowed, false);
});
test("limits staff to schedules and coordination display names", () => {
  const { service } = setup([person("staff")], [roleGrant("g", "staff", "read_only_staff", groupA)]);
  assert.equal(service.authorize(session("staff"), { action: "read", resource: { kind: "coordination", scope: groupA, field: "display_name" } }).allowed, true);
  assert.equal(service.authorize(session("staff"), { action: "read", resource: { kind: "coordination", scope: groupA, field: "phone" } }).allowed, false);
  assert.equal(service.authorize(session("staff"), { action: "update", resource: { kind: "schedule", scope: groupA } }).allowed, false);
});
test("returns generic Hungarian denials and redacted audit evidence", () => {
  const { audit, service } = setup([person("parent")], [roleGrant("g", "parent", "parent", familyA)]);
  assert.deepEqual(service.authorize(session("parent"), { action: "read", resource: { kind: "family", scope: { ...familyA, id: "secret" }, field: "email" } }), { allowed: false, code: "authorization_denied", message: "Nincs jogosultság" });
  assert.deepEqual(audit.events[0], { actorId: "parent", eventType: "authorization_denied", occurredAt: "2026-08-06T10:00:00.000Z", summary: "Authorization denied" });
});
test("revocation invalidates the next protected request", () => {
  const { service, users } = setup([person("super"), person("group")], [roleGrant("s", "super", "super_admin", org), roleGrant("g", "group", "group_admin", groupA)]);
  assert.equal(service.revokeRole(session("super"), "g"), undefined);
  assert.equal(users.findById("group")?.authorizationVersion, 2);
  assert.deepEqual(service.authorize(session("group"), { action: "read", resource: { kind: "group", scope: groupA } }), { allowed: false, code: "reauthorization_required", message: "Nincs jogosultság" });
});
test("prevents kindergarten admins from changing super-admin governance", () => {
  const { service } = setup([person("admin"), person("candidate")], [roleGrant("g", "admin", "kindergarten_admin", org)]);
  assert.deepEqual(service.grantRole(session("admin"), { id: "new", subjectId: "candidate", role: "super_admin", scope: org }), { allowed: false, code: "authorization_denied", message: "Nincs jogosultság" });
});
