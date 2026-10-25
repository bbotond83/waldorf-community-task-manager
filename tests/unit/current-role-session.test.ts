import { describe, expect, it } from "vitest";
import {
  AuthorizationContract,
  InMemoryAuthorizationVersions,
  type SessionContext,
} from "../../src/application/index.ts";
import { createVersionPort } from "../../src/data/index.ts";
import {
  resolveAdminAccess,
  resolveParentAccess,
  resolveTeacherAccess,
} from "../../src/runtime/production/access.ts";
import { fakeData, ok, type FakeHandlers, type QueryCall } from "../support/data-fakes.ts";

const ACCOUNT = "bbbbbbbb-0000-4000-8000-000000000013";
const ORG = "org-waldorf-local";
const NOW = () => new Date("2026-10-06T12:00:00Z");
type Row = Record<string, unknown>;

const grant = (role: string, scopeType: string, scopeId: string, extra: Row = {}): Row => ({
  id: `${role}-${scopeId}`,
  role,
  scope_type: scopeType,
  scope_id: scopeId,
  organization_id: ORG,
  ...extra,
});
const TEACHER_GRANTS = [
  grant("kindergarten_teacher", "group", "group-oak"),
  grant("kindergarten_teacher", "group", "group-sunflower"),
];

type State = { active: boolean; version: number | null; grants: Row[]; parent?: boolean };
function world(state: State): FakeHandlers {
  return {
    rpc: () => ok(state.active),
    table: (query: QueryCall) => {
      if (query.table === "app_authorization_versions")
        return ok(state.version === null ? [] : [{ authorization_version: state.version }]);
      if (query.table === "app_role_grants") return ok(state.grants);
      if (query.table === "parents")
        return ok(
          state.parent ? [{ id: "p1", family_id: "family-boroka", organization_id: ORG }] : [],
        );
      if (query.table === "families") return ok([{ id: "family-boroka" }]);
      return ok([]);
    },
  };
}
const teacherAccess = (state: State) =>
  resolveTeacherAccess(fakeData(world(state)).database, ACCOUNT, NOW);

describe("current role session", () => {
  it("has four roles with the Hungarian teacher label, and each lands on its own default page", async () => {
    const teacher = await teacherAccess({ active: true, version: 1, grants: TEACHER_GRANTS });
    expect(teacher.state === "success" && teacher.data.profile.label).toBe("Óvónő");
    expect(teacher.state === "success" && teacher.data.profile.homePath).toBe("/teacher/schedule");
    const parent = await resolveParentAccess(
      fakeData(
        world({
          active: true,
          version: 1,
          grants: [grant("parent", "family", "family-boroka")],
          parent: true,
        }),
      ).database,
      ACCOUNT,
      NOW,
    );
    expect(parent.state === "success" && parent.data.profile.homePath).toBe("/szulo/ertesitesek");
    for (const [role, scopeType, scopeId] of [
      ["group_admin", "group", "group-boroka"],
      ["super_admin", "organization", ORG],
    ] as const) {
      const admin = await resolveAdminAccess(
        fakeData(world({ active: true, version: 1, grants: [grant(role, scopeType, scopeId)] }))
          .database,
        ACCOUNT,
        NOW,
      );
      expect(admin.state === "success" && admin.data.profile.homePath, role).toBe("/admin");
    }
  });

  it.each(["read_only_staff", "kindergarten_admin"])(
    "the removed role %s cannot become authority: the account holds no role at all",
    async (role) => {
      const access = await teacherAccess({
        active: true,
        version: 1,
        grants: [grant(role, "group", "group-oak")],
      });
      expect(access).toEqual({ state: "denied" });
    },
  );

  it("a current teacher session binds the active scoped grants of that role", async () => {
    const access = await teacherAccess({ active: true, version: 1, grants: TEACHER_GRANTS });
    if (access.state !== "success") throw new Error("expected a teacher session");
    const session = access.data.applicationSession;
    expect(session.isActive).toBe(true);
    expect(session.grants.map((entry) => entry.scope.id)).toEqual(["group-oak", "group-sunflower"]);
    expect(session.grants.every((entry) => entry.role === "kindergarten_teacher")).toBe(true);
    expect(session.roles).toEqual(["kindergarten_teacher"]);
  });

  it("a new authorization version makes the old session stale and a fresh read uses the new version", async () => {
    const state: State = { active: true, version: 1, grants: TEACHER_GRANTS };
    const database = fakeData(world(state)).database;
    const first = await resolveTeacherAccess(database, ACCOUNT, NOW);
    if (first.state !== "success") throw new Error("expected a teacher session");
    const old = first.data.applicationSession;
    expect(
      (await new AuthorizationContract(createVersionPort(database)).navigation(old)).state,
    ).toBe("success");
    state.version = 2;
    const stale = await new AuthorizationContract(createVersionPort(database)).navigation(old);
    expect(stale.state).toBe("invalidated");
    const fresh = await resolveTeacherAccess(database, ACCOUNT, NOW);
    expect(fresh.state === "success" && fresh.data.applicationSession.authorizationVersion).toBe(2);
  });

  it.each([
    ["inactive", { active: false, version: 1, grants: TEACHER_GRANTS }, "signed-out"],
    // The data API returns no revoked grant (the read filters them), so a revoked account has no grants.
    ["revoked or without grants", { active: true, version: 1, grants: [] }, "denied"],
  ] as const)(
    "%s authoritative state does not resolve a teacher session",
    async (_name, state, answer) => {
      expect((await teacherAccess(state as State)).state).toBe(answer);
    },
  );

  it.each([
    ["missing", null],
    ["invalid", 0],
  ] as const)("a %s authorization version resolves no usable session", async (_name, version) => {
    const state: State = { active: true, version, grants: TEACHER_GRANTS };
    const database = fakeData(world(state)).database;
    const access = await resolveTeacherAccess(database, ACCOUNT, NOW);
    if (access.state !== "success") return;
    const result = await new AuthorizationContract(createVersionPort(database)).navigation(
      access.data.applicationSession,
    );
    expect(["denied", "invalidated"]).toContain(result.state);
    expect("data" in result).toBe(false);
  });

  it("a malformed persisted role or scope cannot become teacher authority", async () => {
    for (const bad of [
      grant("unknown", "group", "group-oak"),
      grant("kindergarten_teacher", "organization", ORG),
      grant("kindergarten_teacher", "tenant", "group-oak"),
    ]) {
      expect(await teacherAccess({ active: true, version: 1, grants: [bad] })).toEqual({
        state: "denied",
      });
    }
  });

  it("invalidated navigation clears the protected cache and contains no payload", async () => {
    const access = await teacherAccess({ active: true, version: 1, grants: TEACHER_GRANTS });
    if (access.state !== "success") throw new Error("expected a teacher session");
    const actor: SessionContext = access.data.applicationSession;
    const versions = new InMemoryAuthorizationVersions({ [actor.subjectId]: 2 });
    const result = await new AuthorizationContract(versions).navigation(actor);
    expect(result.state).toBe("invalidated");
    expect("data" in result).toBe(false);
    expect(versions.clearedSubjects).toEqual([actor.subjectId]);
  });

  it("a revocation raises the version, so the old session is rejected and the account holds no admin role", async () => {
    const state: State = {
      active: true,
      version: 1,
      grants: [grant("group_admin", "group", "group-boroka")],
    };
    const database = fakeData(world(state)).database;
    const before = await resolveAdminAccess(database, ACCOUNT, NOW);
    if (before.state !== "success") throw new Error("expected an admin session");
    state.version = 2;
    state.grants = [];
    const result = await new AuthorizationContract(createVersionPort(database)).navigation(
      before.data.applicationSession,
    );
    expect(result.state).toBe("invalidated");
    expect((await resolveAdminAccess(database, ACCOUNT, NOW)).state).toBe("denied");
  });
});
