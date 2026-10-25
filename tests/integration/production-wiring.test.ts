import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  envelope,
  fakeData,
  ok,
  type FakeHandlers,
  type QueryCall,
} from "../support/data-fakes.ts";

const boundary = vi.hoisted(() => ({
  request: undefined as unknown,
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined }),
}));
vi.mock("../../app/_identity/production-request.ts", () => ({
  productionRequest: async () => boundary.request,
}));

import { resolveAdminFacade } from "../../app/admin/_lib/facade.ts";
import { resolveAdminSession } from "../../app/admin/_lib/session.ts";
import { resolveParentFacade } from "../../app/szulo/_lib/facade.ts";
import { resolveParentSession } from "../../app/szulo/_lib/session.ts";
import { resolveTeacherFacade } from "../../app/teacher/_lib/facade.ts";
import { resolveTeacherSession } from "../../app/teacher/_lib/session.ts";
import { parseWorkbook } from "../../src/import-parser/workbook.ts";
import { composeRuntime } from "../../src/runtime/composition.ts";
import { createProductionComposition } from "../../src/runtime/production/composition.ts";
import { createProductionServices } from "../../src/runtime/production/services.ts";

const ACCOUNT = "bbbbbbbb-0000-4000-8000-000000000014";
const ORG = "aaaaaaaa-0000-4000-8000-000000000001";
const FAMILY = "cccccccc-0000-4000-8000-000000000201";
const GROUP = "cccccccc-0000-4000-8000-000000000101";

const PRODUCTION = {
  APP_SESSION_SECRET: "a-production-only-secret-with-32-chars",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "placeholder-anon-key-value",
};

function stubProduction() {
  for (const [name, value] of Object.entries(PRODUCTION)) vi.stubEnv(name, value);
}

type Row = Record<string, unknown>;
const grant = (role: string, scopeType: string, scopeId: string) => ({
  id: `${role}-${scopeId}`,
  role,
  scope_type: scopeType,
  scope_id: scopeId,
  organization_id: ORG,
});

function world(grants: Row[], parent = false): FakeHandlers {
  return {
    rpc: () => ok(true),
    table: (query: QueryCall) => {
      if (query.table === "app_authorization_versions") return ok([{ authorization_version: 1 }]);
      if (query.table === "app_role_grants") return ok(grants);
      if (query.table === "parents") {
        return ok(parent ? [{ id: "p1", family_id: FAMILY, organization_id: ORG }] : []);
      }
      if (query.table === "families") return ok([{ id: FAMILY }]);
      return ok([]);
    },
  };
}

function readyRequest(handlers: FakeHandlers) {
  const fake = fakeData(handlers);
  const services = createProductionServices(fake.database, { parseWorkbook }).forRequest(
    "access-token-of-the-person",
  );
  boundary.request = { state: "ready", accountId: ACCOUNT, services };
  return { fake, services };
}

beforeEach(() => {
  boundary.request = undefined;
});
afterEach(() => vi.unstubAllEnvs());

describe("the production composition", () => {
  it("builds the parent, admin and teacher facades per request without calling any target", async () => {
    stubProduction();
    const composed = await composeRuntime();
    expect(composed.ok).toBe(true);
    if (!composed.ok) throw new Error("not composed");
    expect(composed.value.authenticationBoundary).toBe("supabase-session");
    expect("profiles" in composed.value).toBe(false);
    expect("mode" in composed.value).toBe(false);
    const request = composed.value.services.forRequest("token-a");
    expect(request.parent.constructor.name).toBe("ParentApplicationFacade");
    expect(request.admin.constructor.name).toBe("AdminApplicationFacade");
    expect(request.teacher.constructor.name).toBe("TeacherApplicationFacade");
    expect(request.database.schema).toBe("public");
    const another = composed.value.services.forRequest("token-b");
    expect(another.parent).not.toBe(request.parent);
  });

  it("uses the database client it is given, and the schema from the environment", () => {
    const fake = fakeData();
    const composition = createProductionComposition(
      {
        sessionSecret: PRODUCTION.APP_SESSION_SECRET,
        supabaseUrl: PRODUCTION.SUPABASE_URL,
        supabaseAnonKey: PRODUCTION.SUPABASE_ANON_KEY,
      },
      { database: fake.database },
    );
    composition.services.forRequest("the-token");
    expect(fake.tokens).toEqual(["the-token"]);
    const withSchema = createProductionComposition(
      {
        sessionSecret: PRODUCTION.APP_SESSION_SECRET,
        supabaseUrl: PRODUCTION.SUPABASE_URL,
        supabaseAnonKey: PRODUCTION.SUPABASE_ANON_KEY,
      },
      { environment: { DATABASE_SCHEMA: "worker_2" } },
    );
    expect(withSchema.services.forRequest("t").database.schema).toBe("worker_2");
  });

  it("keeps the shared authorization slot closed: it knows no version and denies", async () => {
    stubProduction();
    const composed = await composeRuntime();
    if (!composed.ok) throw new Error("not composed");
    const { application } = composed.value;
    const result = await application.authorization.authorize(
      {
        subjectId: ACCOUNT,
        authorizationVersion: 1,
        isActive: true,
        grants: [],
        roles: [],
        scopes: [],
      },
      {
        matrixRowId: "AUTH-PARENT-DUTIES",
        action: "read",
        resource: "assignment",
        scope: { id: FAMILY, type: "family", organizationId: ORG },
      },
    );
    expect(result.state).not.toBe("success");
  });

  it("has no other mode to compose: an old mode setting changes nothing", async () => {
    stubProduction();
    vi.stubEnv("APP_RUNTIME_MODE", "synthetic");
    const composed = await composeRuntime();
    expect(composed.ok).toBe(true);
    if (!composed.ok) return;
    expect("services" in composed.value).toBe(true);
    expect("profiles" in composed.value).toBe(false);
  });
});

describe("the admin import status in a production request", () => {
  it("answers the import status from the database inside a production request", async () => {
    const { services, fake } = readyRequest({
      ...world([grant("super_admin", "organization", ORG)]),
      rpc: (name) =>
        name === "import_status" ? envelope("success", null, { run: null }) : ok(true),
    });
    const scope = { id: ORG, type: "organization" as const, organizationId: ORG };
    const session = {
      subjectId: ACCOUNT,
      authorizationVersion: 1,
      isActive: true,
      grants: [
        {
          id: "g",
          subjectId: ACCOUNT,
          role: "super_admin" as const,
          scope,
          grantedAt: "2026-10-22T00:00:00.000Z",
        },
      ],
      roles: ["super_admin" as const],
      scopes: [scope],
    };
    const result = await services.admin.import.status(session, scope);
    expect(result.state).toBe("empty");
    expect(fake.rpcCalls.map((call) => call.name)).toContain("import_status");
  });
});

describe("the session helpers in the production mode", () => {
  beforeEach(() => stubProduction());

  it("reads the parent's family from the database as the signed-in person, not from a constant", async () => {
    readyRequest(world([grant("parent", "family", FAMILY)], true));
    const session = await resolveParentSession();
    expect(session.state).toBe("success");
    if (session.state !== "success") return;
    expect(session.data.familyId).toBe(FAMILY);
    expect(session.data.familyScope).toEqual({ id: FAMILY, type: "family", organizationId: ORG });
    expect(session.data.applicationSession.subjectId).toBe(ACCOUNT);
    expect("runtimeMode" in session.data.applicationSession).toBe(false);
    expect(session.data.profile.label).toBe("Szülő");
    expect(session.data.profile.navigation.map((item) => item.href)).toContain("/szulo/feladatok");
  });

  it("gives the parent page the production parent facade, and a real duty list through it", async () => {
    const { fake } = readyRequest({
      ...world([grant("parent", "family", FAMILY)], true),
      rpc: (name) =>
        name === "notification_list"
          ? envelope("success", null, { items: [] })
          : name === "duty_list"
            ? envelope("success", null, {
                items: [
                  {
                    id: "cccccccc-0000-4000-8000-000000000811",
                    title: "Sütés",
                    due_at: "2026-11-02T10:00:00+00:00",
                    location: "Konyha",
                    version: 4,
                    state: "available",
                    assignment_id: null,
                    assignment_version: null,
                  },
                ],
              })
            : ok(true),
    });
    const facade = await resolveParentFacade();
    const session = await resolveParentSession();
    expect(facade).toBeDefined();
    if (!facade || session.state !== "success") throw new Error("no facade or session");
    const list = await facade.listDuties(session.data.applicationSession, {
      familyScope: session.data.familyScope,
      familyId: session.data.familyId,
    });
    expect(list.state).toBe("success");
    if (list.state === "success") expect(list.data.duties[0]?.title).toBe("Sütés");
    expect(fake.rpcCalls.some((call) => call.name === "duty_list")).toBe(true);
    // The notification page of a real parent shows the empty state, not "denied" and not fixture data.
    const notices = await facade.listNotifications(
      session.data.applicationSession,
      session.data.familyScope,
    );
    expect(notices.state).toBe("empty");
  });

  it("is denied to an account that holds no linked parent, pointing at the home of its own role", async () => {
    readyRequest(world([grant("group_admin", "group", GROUP)]));
    expect(await resolveParentSession()).toEqual({ state: "denied", homePath: "/admin" });
  });

  it("reads an admin's reach from the role grants", async () => {
    readyRequest(world([grant("super_admin", "organization", ORG)]));
    const session = await resolveAdminSession();
    expect(session.state).toBe("success");
    if (session.state === "success") {
      expect(session.data.scope).toEqual({ id: ORG, type: "organization", organizationId: ORG });
      expect(session.data.profile.label).toBe("Szuperadminisztrátor");
    }
    expect(await resolveAdminFacade()).toBeDefined();
  });

  it("denies a parent the admin pages and a group admin the teacher pages", async () => {
    readyRequest(world([grant("parent", "family", FAMILY)], true));
    expect(await resolveAdminSession()).toEqual({
      state: "denied",
      homePath: "/szulo/ertesitesek",
    });
    readyRequest(world([grant("group_admin", "group", GROUP)]));
    expect(await resolveTeacherSession()).toEqual({ state: "denied" });
  });

  it("reads a teacher's granted groups and gives the teacher page its facade", async () => {
    readyRequest(world([grant("kindergarten_teacher", "group", GROUP)]));
    const session = await resolveTeacherSession();
    expect(session.state).toBe("success");
    if (session.state === "success") {
      expect(session.data.applicationSession.scopes).toEqual([
        { id: GROUP, type: "group", organizationId: ORG },
      ]);
    }
    expect(await resolveTeacherFacade()).toBeDefined();
  });

  it("treats a request with no sign-in as signed out and one that cannot be checked as unavailable", async () => {
    boundary.request = { state: "signed-out" };
    for (const resolver of [resolveParentSession, resolveAdminSession, resolveTeacherSession]) {
      expect((await resolver()).state).toBe("signed-out");
    }
    for (const resolver of [resolveParentFacade, resolveAdminFacade, resolveTeacherFacade]) {
      expect(await resolver()).toBeUndefined();
    }
    boundary.request = { state: "unavailable" };
    for (const resolver of [resolveParentSession, resolveAdminSession, resolveTeacherSession]) {
      expect((await resolver()).state).toBe("configuration-error");
    }
  });

  it("maps a database that cannot answer to the configuration state, never to an error page", async () => {
    readyRequest({
      rpc: () => ({ error: { code: "08006", message: "down" } }),
      table: () => ({ error: { code: "08006" } }),
    });
    expect((await resolveParentSession()).state).toBe("configuration-error");
    expect((await resolveAdminSession()).state).toBe("configuration-error");
    expect((await resolveTeacherSession()).state).toBe("configuration-error");
  });

  it("signs out a person whose session the database no longer accepts", async () => {
    readyRequest({ rpc: () => ok(false), table: () => ok([]) });
    expect((await resolveParentSession()).state).toBe("signed-out");
    expect((await resolveAdminSession()).state).toBe("signed-out");
    expect((await resolveTeacherSession()).state).toBe("signed-out");
  });
});
