import assert from "node:assert/strict";
import test from "node:test";
import {
  AccessService,
  InMemoryAuditWriter,
  InMemoryRoleGrantRepository,
  InMemoryUserRepository,
} from "../access/index.ts";
import type { RoleGrant, Scope, User } from "../access/types.ts";
import {
  DirectoryService,
  DirectoryValidationError,
  InMemoryDirectoryAuditWriter,
  InMemoryDirectoryRepository,
} from "./index.ts";

const org: Scope = { id: "org", type: "organization", organizationId: "org" };
const familyScope: Scope = { id: "family-a", type: "family", organizationId: "org" };
const group: Scope = { id: "group-a", type: "group", organizationId: "org" };
const now = () => new Date("2026-08-06T10:00:00.000Z");
const user = (id: string): User => ({ id, isActive: true, authorizationVersion: 1 });
const grant = (
  id: string,
  subjectId: string,
  role: RoleGrant["role"],
  scope: Scope,
): RoleGrant => ({ id, subjectId, role, scope, grantedAt: "2026-08-01T00:00:00.000Z" });
function setup() {
  const users = new InMemoryUserRepository([user("admin"), user("parent"), user("unrelated")]);
  const grants = new InMemoryRoleGrantRepository([
    grant("a", "admin", "super_admin", org),
    grant("p", "parent", "parent", familyScope),
    grant("u", "unrelated", "parent", { ...familyScope, id: "other" }),
  ]);
  const authorizer = new AccessService(users, grants, new InMemoryAuditWriter(), now);
  const audit = new InMemoryDirectoryAuditWriter();
  const repository = new InMemoryDirectoryRepository();
  return {
    audit,
    repository,
    service: new DirectoryService({ repository, authorizer, grants, audit, now }),
  };
}
const session = (subjectId: string) => ({ subjectId, authorizationVersion: 1 });

test("creates relationships transactionally and recalculates visibility", () => {
  const { audit, repository, service } = setup();
  service.saveFamily(session("admin"), { id: "family", scope: familyScope });
  service.linkParent(session("admin"), "family", {
    id: "parent-profile",
    userId: "parent",
    displayName: "Szülő",
    email: "parent@example.test",
    phone: "+361234567",
  });
  service.linkChild(session("admin"), "family", {
    id: "child",
    displayName: "Gyermek",
    groupScope: group,
    schoolYearId: "2026",
  });
  assert.deepEqual(repository.recalculatedFamilyIds, ["family", "family"]);
  assert.equal(audit.events.length, 3);
});
test("returns a linked parent view without contact or optional fields", () => {
  const { service } = setup();
  service.saveFamily(session("admin"), { id: "family", scope: familyScope });
  service.linkParent(session("admin"), "family", {
    id: "profile",
    userId: "parent",
    displayName: "Szülő",
    email: "parent@example.test",
    optionalProfile: "private",
  });
  assert.deepEqual(service.getVisible(session("parent"), "family"), {
    id: "family",
    parents: [{ id: "profile", displayName: "Szülő" }],
    children: [],
  });
});
test("denies an unrelated parent without revealing the family", () => {
  const { service } = setup();
  service.saveFamily(session("admin"), { id: "family", scope: familyScope });
  assert.deepEqual(service.getVisible(session("unrelated"), "family"), {
    allowed: false,
    code: "authorization_denied",
    message: "Nincs jogosultság",
  });
});
test("shows consented sensitive fields only to in-scope administrators", () => {
  const { service } = setup();
  service.saveFamily(session("admin"), { id: "family", scope: familyScope });
  service.linkParent(session("admin"), "family", {
    id: "profile",
    userId: "parent",
    displayName: "Szülő",
    email: "parent@example.test",
    locality: "Budapest",
    optionalProfile: "private",
    optionalProfileConsent: true,
  });
  assert.deepEqual(service.getVisible(session("admin"), "family"), {
    id: "family",
    parents: [
      {
        id: "profile",
        userId: "parent",
        displayName: "Szülő",
        email: "parent@example.test",
        locality: "Budapest",
        optionalProfile: "private",
      },
    ],
    children: [],
  });
});
test("rejects duplicate parent links without changing relevance projections", () => {
  const { repository, service } = setup();
  service.saveFamily(session("admin"), { id: "family", scope: familyScope });
  service.linkParent(session("admin"), "family", {
    id: "profile",
    userId: "parent",
    displayName: "Szülő",
  });
  assert.throws(
    () =>
      service.linkParent(session("admin"), "family", {
        id: "profile",
        userId: "parent",
        displayName: "Szülő",
      }),
    DirectoryValidationError,
  );
  assert.equal(repository.findFamily("family")?.parents.length, 1);
  assert.deepEqual(repository.recalculatedFamilyIds, ["family"]);
});
test("rejects cross-organization links and parent mutations", () => {
  const { service } = setup();
  service.saveFamily(session("admin"), { id: "family", scope: familyScope });
  assert.throws(
    () =>
      service.linkChild(session("admin"), "family", {
        id: "child",
        displayName: "Gyermek",
        groupScope: { ...group, organizationId: "other" },
        schoolYearId: "2026",
      }),
    DirectoryValidationError,
  );
  assert.deepEqual(service.archive(session("parent"), "family"), {
    allowed: false,
    code: "authorization_denied",
    message: "Nincs jogosultság",
  });
});
