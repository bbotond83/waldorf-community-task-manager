import { describe, expect, it } from "vitest";
import {
  InMemoryAccessTransaction,
  InMemoryAuditWriter,
  InMemoryRoleGrantRepository,
  InMemoryUserRepository,
  AccessService,
} from "../../src/access/index.ts";
import { convertLegacyRoles } from "../../src/access/legacy-role-conversion.ts";
import { AuthorizationContract } from "../../src/application/index.ts";
import type { SessionContext } from "../../src/application/index.ts";
import {
  createSyntheticTeacherFacade,
  createSyntheticTeacherRepository,
  TEACHER_GROUPS,
} from "../../src/teacher-web/index.ts";
function setup() {
  const users = new InMemoryUserRepository([
    { id: "converted", isActive: true, authorizationVersion: 1 },
  ]);
  const grants = new InMemoryRoleGrantRepository();
  grants.loadConversionFixture([
    {
      id: "legacy",
      subjectId: "converted",
      role: "read_only_staff",
      scope: TEACHER_GROUPS[0]!.scope,
      grantedAt: "2026-01-01",
    },
  ]);
  const audit = new InMemoryAuditWriter();
  const store = new InMemoryAccessTransaction(users, grants, audit);
  convertLegacyRoles(
    store,
    { supportedSchema: true, authoritativeIssuerBaseline: "verified-v1" },
    "u2-fixture",
  );
  const session: SessionContext = {
    subjectId: "converted",
    authorizationVersion: 2,
    isActive: true,
    grants: grants.list(),
    roles: ["kindergarten_teacher"],
    scopes: [TEACHER_GROUPS[0]!.scope],
    runtimeMode: "synthetic",
    isSynthetic: true,
  };
  const authorization = new AuthorizationContract({
    getCurrentVersion: (id) => users.findById(id)?.authorizationVersion,
    clearProtectedCache() {},
  });
  const source = createSyntheticTeacherRepository();
  const facade = createSyntheticTeacherFacade(authorization, "ready", source.repository);
  return { users, grants, audit, store, session, authorization, source, facade };
}
const query = { groupScope: TEACHER_GROUPS[0]!.scope, from: "2026-08-12", to: "2026-08-20" };
describe("Teacher foundation integration", () => {
  it("converted current teacher reads existing scope and preserved identities", async () => {
    const s = setup();
    expect((await s.facade.getSchedule(s.session, query)).state).toBe("success");
    expect(s.grants.list()[0]?.id).toBe("legacy");
    expect(s.source.operator.snapshot().map((row) => row.id)).toEqual([
      "schedule-garden",
      "schedule-crafts",
      "schedule-coverage",
    ]);
  });
  it("stale preconversion authorization cannot reuse projection", async () => {
    const s = setup();
    const result = await s.facade.getSchedule({ ...s.session, authorizationVersion: 1 }, query);
    expect(result.state).toBe("invalidated");
    expect(result).not.toHaveProperty("data");
  });
  it("teacher direct writes deny and preserve source business snapshots", async () => {
    const s = setup();
    const before = s.source.operator.snapshot();
    for (const action of ["create", "update", "delete", "manage"] as const) {
      const result = await s.authorization.authorize(s.session, {
        matrixRowId: "AUTH-TEACHER-TRACKING",
        action,
        resource: "schedule",
        scope: query.groupScope,
      });
      expect(result.state).toBe("denied");
    }
    expect(s.source.operator.snapshot()).toEqual(before);
  });
  it("shared domain direct mutation denials produce redacted audit", () => {
    const s = setup();
    const access = new AccessService(s.users, s.grants, s.audit);
    const before = s.grants.list();
    expect(
      access.authorize(s.session, {
        action: "update",
        resource: { kind: "assignment", scope: query.groupScope },
      }).allowed,
    ).toBe(false);
    expect(s.grants.list()).toEqual(before);
    expect(JSON.stringify(s.audit.events)).not.toMatch(/Kitalált|email|phone/);
    expect(s.audit.events.length).toBeGreaterThan(0);
  });
  it("revoked grant after success returns no current or stale records", async () => {
    const s = setup();
    await s.facade.getSchedule(s.session, query);
    const result = await s.facade.getSchedule(
      { ...s.session, grants: s.session.grants.map((grant) => ({ ...grant, revokedAt: "now" })) },
      query,
    );
    expect(result.state).toBe("denied");
    expect(result).not.toHaveProperty("data");
  });
  it("wrong organization is denied without exposing names", async () => {
    const s = setup();
    const result = await s.facade.getSchedule(s.session, {
      ...query,
      groupScope: { ...query.groupScope, organizationId: "other" },
    });
    expect(result.state).toBe("denied");
    expect(JSON.stringify(result)).not.toContain("Kitalált");
  });
});
