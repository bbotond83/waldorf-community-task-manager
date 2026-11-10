import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { envelope, fakeData, ok, type FakeHandlers } from "../support/data-fakes.ts";

vi.mock("server-only", () => ({}));

import { DATABASE_ADMIN_OPERATIONS } from "../../src/data/index.ts";
import { composeRuntime } from "../../src/runtime/composition.ts";
import { createProductionComposition } from "../../src/runtime/production/composition.ts";
import { createProductionServices } from "../../src/runtime/production/services.ts";

const ORG = "aaaaaaaa-0000-4000-8000-000000000001";
const ACCOUNT = "bbbbbbbb-0000-4000-8000-000000000014";
const scope = { id: ORG, type: "organization" as const, organizationId: ORG };
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const familyScope = {
  id: "cccccccc-0000-4000-8000-000000000201",
  type: "family" as const,
  organizationId: ORG,
};

const session = (role: "super_admin" | "parent") => {
  const granted = role === "parent" ? familyScope : scope;
  return {
    subjectId: ACCOUNT,
    authorizationVersion: 1,
    isActive: true,
    grants: [
      {
        id: "g",
        subjectId: ACCOUNT,
        role,
        scope: granted,
        grantedAt: "2026-10-22T00:00:00.000Z",
      },
    ],
    roles: [role],
    scopes: [granted],
  };
};

/** The services of one request on a fake database that knows the person's role grants (the authorization reads them). */
function production(handlers: FakeHandlers) {
  const fake = fakeData({
    table: (query) => {
      if (query.table === "app_authorization_versions") return ok([{ authorization_version: 1 }]);
      if (query.table === "app_role_grants") {
        return ok([
          {
            id: "g",
            role: "super_admin",
            scope_type: "organization",
            scope_id: ORG,
            organization_id: ORG,
          },
        ]);
      }
      return ok([]);
    },
    ...handlers,
  });
  const services = createProductionServices(fake.database).forRequest("token");
  return { fake, services };
}

describe("production mode builds the notification operations (BR42.1)", () => {
  it("serves the parent's notification list from the database as the signed-in person", async () => {
    const { fake, services } = production({
      rpc: (name) =>
        name === "notification_list"
          ? envelope("success", null, {
              items: [
                {
                  id: "n1",
                  title: "Holnap: Sütés",
                  link: "/szulo/feladatok/x",
                  is_read: false,
                  timing: "24-hour",
                  provider_status: "simulated-sent",
                },
              ],
            })
          : envelope("success", null, { run: 0, sent: 0, failed: 0, dropped: 0 }),
    });
    const result = await services.parent.listNotifications(session("parent"), familyScope);
    expect(result.state).toBe("success");
    expect(fake.rpcCalls.map((call) => call.name)).toEqual([
      "reminder_run_due",
      "notification_list",
    ]);
  });

  it("marks a notification read through the database and returns its link", async () => {
    const { fake, services } = production({
      rpc: () =>
        envelope(
          "success",
          null,
          { link: "/szulo/feladatok/x" },
          "11111111-1111-4111-8111-111111111111",
        ),
    });
    const result = await services.parent.markNotificationRead(session("parent"), {
      familyScope,
      notificationId: "11111111-1111-4111-8111-111111111111",
      idempotencyKey: "mark-read-0001",
    });
    expect(result.state).toBe("success");
    expect(fake.rpcCalls[0]?.name).toBe("notification_mark_read");
  });

  it("serves the reminders list from the database, with no interim answer", async () => {
    const { fake, services } = production({
      rpc: (name) =>
        name === "reminder_list"
          ? envelope("success", null, { items: [] })
          : ok(envelope("success").data),
    });
    expect((await services.admin.reminders.list(session("super_admin"), scope)).state).toBe(
      "empty",
    );
    expect(fake.rpcCalls.map((call) => call.name)).toEqual(["reminder_run_due", "reminder_list"]);
  });

  it("builds the production composition, whose source names the removed import nowhere (BR7.1)", () => {
    const composition = createProductionComposition(
      {
        sessionSecret: "a-production-only-secret-with-32-chars",
        supabaseUrl: "https://example.supabase.co",
        supabaseAnonKey: "placeholder-anon-key-value",
      },
      { database: fakeData().database },
    );
    expect(composition.services.forRequest("t").admin.constructor.name).toBe(
      "AdminApplicationFacade",
    );
    const source = read("src/runtime/production/composition.ts");
    expect(source).not.toContain("import-parser");
    expect(source).not.toContain("parseWorkbook");
  });
});

describe("the interim port is out of the production path for these operations (BR42.1)", () => {
  it("names no interim port in the production composition or services", () => {
    for (const file of ["composition.ts", "services.ts", "access.ts"]) {
      const source = read(`src/runtime/production/${file}`);
      expect(source, file).not.toMatch(
        /getInterimAdvancedPort|UnavailableInterimAdvancedPort|interim-port/,
      );
    }
    expect(read("src/runtime/production/services.ts")).not.toContain("interimAdmin");
  });

  it("answers every admin operation the facade names from the database", () => {
    const operations = [
      ...read("src/application/admin-facade.ts").matchAll(/^ {2}\| "([a-z]+\.[a-z]+)";?$/gm),
    ].map((match) => match[1]!);
    expect(operations.length).toBeGreaterThanOrEqual(20);
    expect([...DATABASE_ADMIN_OPERATIONS].sort()).toEqual([...operations].sort());
  });

  it("has one composition: it builds the database services and no profiles, whatever an old mode setting says", async () => {
    vi.stubEnv("APP_RUNTIME_MODE", "synthetic");
    vi.stubEnv("APP_SESSION_SECRET", "a-production-only-secret-with-32-chars");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "placeholder-anon-key-value");
    const composed = await composeRuntime();
    expect(composed.ok).toBe(true);
    if (!composed.ok) return;
    expect("services" in composed.value).toBe(true);
    expect("profiles" in composed.value).toBe(false);
    vi.unstubAllEnvs();
  });
});
