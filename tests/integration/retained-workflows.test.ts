import { expect, it } from "vitest";
import {
  InMemoryAccessTransaction,
  InMemoryAuditWriter,
  InMemoryRoleGrantRepository,
  InMemoryUserRepository,
  type Scope,
  type Role,
} from "../../src/access/index.ts";
import { convertLegacyRoles } from "../../src/access/legacy-role-conversion.ts";
import { sessionGrantBindings } from "../../src/access/session-grants.ts";
import {
  AuthorizationContract,
  InMemoryAuthorizationVersions,
  type SessionContext,
} from "../../src/application/index.ts";
import {
  createAdminFacadeDouble,
  createParentFacadeDouble,
  PARENT_FAMILY_ID,
  PARENT_FAMILY_SCOPE,
} from "../support/port-doubles.ts";
const group: Scope = { id: "group-boroka", type: "group", organizationId: "org-napsugar" };
const org: Scope = { id: "org-napsugar", type: "organization", organizationId: "org-napsugar" };
function session(role: Role, scope: Scope, id = "actor"): SessionContext {
  return {
    subjectId: id,
    authorizationVersion: 1,
    ...sessionGrantBindings(id, role, [scope]),
    roles: [role],
    scopes: [scope],
  };
}
function authorization(id = "actor") {
  return new AuthorizationContract(new InMemoryAuthorizationVersions({ [id]: 1 }));
}
it("Parent own participation requests and notifications remain permitted while other family denies", async () => {
  const actor = session("parent", PARENT_FAMILY_SCOPE, "parent-account");
  const app = createParentFacadeDouble(authorization(actor.subjectId), actor.subjectId);
  const own = { familyScope: PARENT_FAMILY_SCOPE, familyId: PARENT_FAMILY_ID };
  expect((await app.listDuties(actor, own)).state).toBe("success");
  const signup = {
    ...own,
    dutyId: "duty-garden",
    expectedVersion: 1,
    idempotencyKey: "signup:retained:1",
  };
  const first = await app.signUp(actor, signup);
  expect(first.state).toBe("success");
  expect(await app.signUp(actor, signup)).toEqual(first);
  expect(
    (
      await app.requestSwap(actor, {
        ...own,
        assignmentId: "assignment-lampas",
        counterpartId: "assignment-counterpart",
        expectedVersion: 4,
        idempotencyKey: "swap:retained:1",
      })
    ).state,
  ).toBe("success");
  expect((await app.listNotifications(actor, PARENT_FAMILY_SCOPE)).state).toBe("success");
  expect(
    (
      await app.markNotificationRead(actor, {
        familyScope: PARENT_FAMILY_SCOPE,
        notificationId: "notice-7-day",
        idempotencyKey: "notice:retained:1",
      })
    ).state,
  ).toBe("success");
  const before = await app.listDuties(actor, own);
  const denied = await app.signUp(actor, {
    ...signup,
    familyScope: { ...PARENT_FAMILY_SCOPE, id: "other" },
    familyId: "other",
    idempotencyKey: "signup:other:1",
  });
  expect(denied.state).toBe("denied");
  expect(denied).not.toHaveProperty("data");
  expect(await app.listDuties(actor, own)).toEqual(before);
});
it("Group core fixtures permit assignments in the own group, and never family records (BR3.9)", async () => {
  const actor = session("group_admin", group);
  const app = createAdminFacadeDouble(authorization());
  expect((await app.listRecords(actor, group)).state).toBe("denied");
  expect(
    (
      await app.assign(actor, {
        scope: group,
        id: "task-kert",
        expectedVersion: 1,
        idempotencyKey: "assign:retained:1",
        payload: {},
      })
    ).state,
  ).toBe("success");
  expect(
    (
      await app.assign(actor, {
        scope: { ...group, id: "other" },
        id: "task-kert",
        expectedVersion: 1,
        idempotencyKey: "assign:retained:2",
        payload: {},
      })
    ).state,
  ).toBe("denied");
  expect((await app.getRecord(actor, group, "family", "family-napraforgo")).state).toBe("denied");
});
it("Super current organization retains reminders privacy settings and governance", async () => {
  const actor = session("super_admin", org, "super-admin-account");
  const app = createAdminFacadeDouble(authorization(actor.subjectId));
  for (const result of [
    await app.reminders.list(actor, org),
    await app.lifecycle.list(actor, org),
    await app.settings.get(actor, org),
    await app.governance.list(actor, org),
  ])
    expect(["success", "empty"]).toContain(result.state);
  const wrong = { ...org, id: "other", organizationId: "other" };
  expect((await app.settings.get(actor, wrong)).state).toBe("denied");
});
it("all non-Super advanced requests deny and leave authorized advanced snapshots unchanged", async () => {
  const versions = new InMemoryAuthorizationVersions({ actor: 1, "super-admin-account": 1 });
  const app = createAdminFacadeDouble(new AuthorizationContract(versions));
  const admin = session("super_admin", org, "super-admin-account");
  const before = await app.governance.list(admin, org);
  for (const [role, scope] of [
    ["parent", PARENT_FAMILY_SCOPE],
    ["kindergarten_teacher", org],
    ["group_admin", group],
  ] as const) {
    const actor = session(role, scope);
    const command = {
      scope: org,
      id: "target",
      expectedVersion: 1,
      idempotencyKey: "denied:retained:1",
    };
    for (const result of [
      await app.reminders.retry(actor, command),
      await app.lifecycle.run(actor, command),
      await app.settings.save(actor, command),
      await app.governance.updateGrant(actor, command),
    ]) {
      expect(result.state).toBe("denied");
      expect(result).not.toHaveProperty("data");
    }
  }
  expect(await app.governance.list(admin, org)).toEqual(before);
});
it("populated explicit U1 conversion preserves identity and enables current Super governance", async () => {
  const users = new InMemoryUserRepository([
    { id: "converted", isActive: true, authorizationVersion: 1 },
  ]);
  const grants = new InMemoryRoleGrantRepository();
  grants.loadConversionFixture([
    {
      id: "legacy-admin",
      subjectId: "converted",
      role: "kindergarten_admin",
      scope: org,
      grantedAt: "2026-01-01",
    },
  ]);
  const audit = new InMemoryAuditWriter();
  const store = new InMemoryAccessTransaction(users, grants, audit);
  expect(
    convertLegacyRoles(
      store,
      { supportedSchema: true, authoritativeIssuerBaseline: "verified-v1" },
      "u3-fixture",
    ).state,
  ).toBe("converted");
  const actor: SessionContext = {
    ...session("super_admin", org, "converted"),
    authorizationVersion: 2,
    grants: grants.list(),
  };
  const app = createAdminFacadeDouble(
    new AuthorizationContract({
      getCurrentVersion: (id) => users.findById(id)?.authorizationVersion,
      clearProtectedCache() {},
    }),
  );
  expect((await app.governance.list(actor, org)).state).toBe("success");
  expect(grants.list()[0]).toMatchObject({
    id: "legacy-admin",
    subjectId: "converted",
    role: "super_admin",
    scope: org,
    grantedAt: "2026-01-01",
  });
  expect((await app.governance.list({ ...actor, authorizationVersion: 1 }, org)).state).toBe(
    "invalidated",
  );
});
it("inactive revoked and equivalent current grants preserve authority boundaries and data", async () => {
  const actor = session("super_admin", org, "super-admin-account");
  const app = createAdminFacadeDouble(authorization(actor.subjectId));
  const before = await app.settings.get(actor, org);
  expect(
    (
      await app.settings.get(
        {
          ...actor,
          grants: [...actor.grants, ...actor.grants.map((g) => ({ ...g, id: "equivalent" }))],
        },
        org,
      )
    ).state,
  ).toBe("success");
  for (const context of [
    { ...actor, isActive: false },
    { ...actor, grants: actor.grants.map((g) => ({ ...g, revokedAt: "now" })) },
  ])
    expect((await app.settings.get(context, org)).state).toBe("denied");
  expect(await app.settings.get(actor, org)).toEqual(before);
});
