import assert from "node:assert/strict";
import test from "node:test";
import { convertLegacyRoles } from "./legacy-role-conversion.ts";
import { effectiveGrants } from "./role-policy.ts";
import {
  InMemoryAccessTransaction,
  InMemoryAuditWriter,
  InMemoryRoleGrantRepository,
  InMemoryUserRepository,
} from "./in-memory-adapters.ts";
import type { LegacyConversionGrant, User } from "./types.ts";
const preconditions = {
  supportedSchema: true,
  authoritativeIssuerBaseline: "verified-v1" as const,
};
const legacy: LegacyConversionGrant = {
  id: "legacy",
  subjectId: "user",
  role: "read_only_staff",
  scope: { type: "organization", id: "org", organizationId: "org" },
  grantedAt: "2026",
  revokedAt: "2026-01",
};
function setup(
  rows: LegacyConversionGrant[] = [legacy],
  user: User = { id: "user", isActive: false, authorizationVersion: 1 },
  fault?: (stage: string) => void,
) {
  const users = new InMemoryUserRepository([user]);
  const grants = new InMemoryRoleGrantRepository();
  grants.loadConversionFixture(rows);
  const audit = new InMemoryAuditWriter();
  const store = new InMemoryAccessTransaction(users, grants, audit, fault);
  return { store, users, grants, audit };
}
test("preserves revoked inactive grant identity and all non-role fields", () => {
  const { store, users, grants } = setup();
  const result = convertLegacyRoles(store, preconditions, "operation");
  assert.equal(result.state, "converted");
  assert.deepEqual(grants.findById("legacy"), { ...legacy, role: "kindergarten_teacher" });
  assert.deepEqual(users.findById("user"), {
    id: "user",
    isActive: false,
    authorizationVersion: 2,
  });
  assert.equal(effectiveGrants(grants.list()).length, 0);
});
test("organization administrator converts within same organization", () => {
  const row: LegacyConversionGrant = {
    ...legacy,
    role: "kindergarten_admin",
    scope: { type: "organization", id: "org", organizationId: "org" },
  };
  const { store, grants } = setup([row]);
  assert.equal(convertLegacyRoles(store, preconditions, "operation").state, "converted");
  assert.deepEqual(grants.list(), [{ ...row, role: "super_admin" }]);
});
test("equivalent and duplicate histories survive while each subject invalidates once", () => {
  const active = { ...legacy, revokedAt: undefined };
  const current = { ...active, id: "current", role: "kindergarten_teacher" as const };
  const { store, users, grants } = setup([active, { ...active, id: "duplicate" }, current]);
  assert.equal(convertLegacyRoles(store, preconditions, "operation").state, "converted");
  assert.equal(users.findById("user")?.authorizationVersion, 2);
  assert.equal(grants.list().length, 3);
  assert.equal(effectiveGrants(grants.list()).length, 1);
  assert.equal(store.conversionEvidence.length, 2);
});
test("repeat creates no evidence or generation change", () => {
  const { store, users } = setup();
  convertLegacyRoles(store, preconditions, "one");
  const evidence = structuredClone(store.conversionEvidence);
  assert.deepEqual(convertLegacyRoles(store, preconditions, "two"), {
    state: "unchanged",
    changedGrantIds: [],
  });
  assert.deepEqual(store.conversionEvidence, evidence);
  assert.equal(users.findById("user")?.authorizationVersion, 2);
});
test("unsupported roles and scope shapes block without touching state", () => {
  for (const row of [
    { ...legacy, role: "unknown" } as unknown as LegacyConversionGrant,
    { ...legacy, scope: { type: "group" as const, id: "group", organizationId: "org" } },
    {
      ...legacy,
      role: "kindergarten_admin" as const,
      scope: { type: "group" as const, id: "group", organizationId: "org" },
    },
  ]) {
    const { store, grants } = setup([row]);
    assert.deepEqual(convertLegacyRoles(store, preconditions, "op"), {
      state: "blocked",
      code: "UNSUPPORTED_ROLE_OR_SCOPE",
    });
    assert.deepEqual(grants.list(), [row]);
    assert.equal(store.conversionEvidence.length, 0);
  }
});
test("incompatible schema or issuer rejects before writes", () => {
  for (const condition of [
    { ...preconditions, supportedSchema: false },
    { ...preconditions, authoritativeIssuerBaseline: "unknown" as const },
  ]) {
    const { store, grants } = setup();
    assert.deepEqual(convertLegacyRoles(store, condition, "op"), {
      state: "blocked",
      code: "INCOMPATIBLE_SCHEMA",
    });
    assert.deepEqual(grants.list(), [legacy]);
  }
});
test("missing generation initializes to 2 only with verified issuer baseline", () => {
  const { store, users } = setup([legacy], {
    id: "user",
    isActive: true,
    authorizationVersion: undefined,
  } as unknown as User);
  assert.equal(convertLegacyRoles(store, preconditions, "op").state, "converted");
  assert.equal(users.findById("user")?.authorizationVersion, 2);
});
test("invalid and overflowing generations block", () => {
  for (const version of [0, -1, 1.2, NaN, 2147483647]) {
    const { store, grants } = setup([legacy], {
      id: "user",
      isActive: true,
      authorizationVersion: version,
    });
    assert.equal(convertLegacyRoles(store, preconditions, "op").state, "blocked");
    assert.deepEqual(grants.list(), [legacy]);
  }
});
test("redacted evidence uses only stable identities and role transitions", () => {
  const { store } = setup();
  convertLegacyRoles(store, preconditions, "op");
  assert.deepEqual(store.conversionEvidence, [
    {
      operationId: "op",
      grantId: "legacy",
      subjectId: "user",
      organizationId: "org",
      originalRole: "read_only_staff",
      currentRole: "kindergarten_teacher",
      outcome: "converted",
    },
  ]);
});
test("every injected boundary failure restores full state", () => {
  for (const boundary of ["preflight", "grant", "version", "evidence", "enforcement", "commit"]) {
    const { store, users, grants, audit } = setup([legacy], undefined, (stage) => {
      if (stage === boundary) throw new Error("private failure sentinel");
    });
    const before = {
      users: users.list(),
      grants: grants.list(),
      audit: structuredClone(audit.events),
    };
    assert.deepEqual(convertLegacyRoles(store, preconditions, "op"), {
      state: "failed",
      code: "TRANSACTION_FAILED",
    });
    assert.deepEqual({ users: users.list(), grants: grants.list(), audit: audit.events }, before);
    assert.deepEqual(store.conversionEvidence, []);
    assert.equal(store.currentRolesEnforced, false);
  }
});
