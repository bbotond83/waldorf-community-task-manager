import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { conflict, success, WorkbookUpload } from "../../src/application/index.ts";
import { envelope, fakeData, ok, type FakeHandlers } from "../support/data-fakes.ts";
import { buildWorkbook } from "../support/workbook.ts";

const world = vi.hoisted(() => ({
  signedIn: true,
  facade: { import: { createPreview: vi.fn() } },
  revalidated: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => world.revalidated.push(path),
}));
vi.mock("../../app/admin/_lib/facade.ts", () => ({
  resolveAdminFacade: async () => (world.signedIn ? world.facade : undefined),
}));
vi.mock("../../app/admin/_lib/session.ts", () => ({
  resolveAdminSession: async () =>
    world.signedIn
      ? {
          state: "success",
          data: {
            applicationSession: { subjectId: "admin" },
            scope: { id: "org", type: "organization", organizationId: "org" },
          },
        }
      : { state: "signed-out" },
}));

import nextConfig from "../../next.config.ts";
import { uploadImportWorkbookAction } from "../../app/admin/advanced-actions.ts";
import { IMPORT_LIMITS } from "../../src/import-parser/index.ts";
import { parseWorkbook } from "../../src/import-parser/server.ts";
import { DATABASE_ADMIN_OPERATIONS } from "../../src/data/index.ts";
import { composeRuntime } from "../../src/runtime/composition.ts";
import { createProductionComposition } from "../../src/runtime/production/composition.ts";
import { createProductionServices } from "../../src/runtime/production/services.ts";

const ORG = "aaaaaaaa-0000-4000-8000-000000000001";
const ACCOUNT = "bbbbbbbb-0000-4000-8000-000000000014";
const RUN = "dddddddd-0000-4000-8000-000000000001";
const scope = { id: ORG, type: "organization" as const, organizationId: ORG };
const initial = { state: "initial" } as const;
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

const runModel = {
  run_id: RUN,
  version: 1,
  workbook_name: "minta.xlsx",
  fingerprint: "ab".repeat(32),
  step: 5,
  model_state: "preview",
  run_status: "previewed",
  total_rows: 2,
  imported_rows: 0,
  skipped_rows: 0,
  warning_count: 0,
  changed_rows: [],
  conflicts: [],
  open_conflicts: 0,
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
  const services = createProductionServices(fake.database, { parseWorkbook }).forRequest("token");
  return { fake, services };
}

function uploadForm(file: File | string | null, extra: Record<string, string> = {}): FormData {
  const data = new FormData();
  if (file !== null) data.append("workbook", file);
  for (const [key, value] of Object.entries(extra)) data.append(key, value);
  return data;
}

beforeEach(() => {
  world.signedIn = true;
  world.revalidated = [];
  world.facade.import.createPreview.mockReset().mockResolvedValue(success({ id: RUN }));
});

describe("production mode builds the notification and import operations (BR42.1)", () => {
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

  it("stages an uploaded workbook through the parser and the preview function, with the run id and version in the model", async () => {
    const { fake, services } = production({ rpc: () => envelope("success", null, runModel, RUN) });
    const result = await services.admin.import.createPreview(session("super_admin"), {
      scope,
      id: "minta.xlsx",
      expectedVersion: 1,
      idempotencyKey: "import-upload:0123456789",
      payload: { workbook: new WorkbookUpload("minta.xlsx", buildWorkbook()) },
    });
    expect(result.state).toBe("success");
    if (result.state !== "success") return;
    expect(result.data.runId).toBe(RUN);
    expect(result.data.runVersion).toBe(1);
    expect(result.data.fileName).toBe("minta.xlsx");
    expect(fake.rpcCalls.map((call) => call.name)).toEqual(["import_preview_create"]);
    expect((fake.rpcCalls[0]!.args.p_rows as unknown[]).length).toBeGreaterThan(10);
  });

  it("serves the reminders list and every import operation from the database, with no interim answer", async () => {
    const { fake, services } = production({
      rpc: (name) =>
        name === "import_status"
          ? envelope("success", null, { run: null })
          : name === "reminder_list"
            ? envelope("success", null, { items: [] })
            : ok(envelope("success").data),
    });
    expect((await services.admin.import.status(session("super_admin"), scope)).state).toBe("empty");
    expect((await services.admin.reminders.list(session("super_admin"), scope)).state).toBe(
      "empty",
    );
    expect(fake.rpcCalls.map((call) => call.name)).toEqual([
      "import_status",
      "reminder_run_due",
      "reminder_list",
    ]);
  });

  it("builds the production composition with the parser handed in, and its source reaches the reader only through the server door", () => {
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
    expect(source).toContain('from "../../import-parser/server.ts"');
    expect(source).not.toContain("workbook.ts");
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
    expect(operations.length).toBeGreaterThanOrEqual(27);
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

describe("the body limit and the upload action (NFR2.20, BR41.2)", () => {
  it("sets the server-action body limit to 6 MB, in step with the limits of the parser", () => {
    const limit = nextConfig.experimental?.serverActions?.bodySizeLimit;
    expect(limit).toBe("6mb");
    expect(6 * 1024 * 1024).toBe(IMPORT_LIMITS.maxBodyBytes);
    expect(IMPORT_LIMITS.maxFileBytes).toBe(5 * 1024 * 1024);
  });

  it("accepts a file just under 5 MB: the bytes reach the facade as an upload, with its own key", async () => {
    const file = new File([new Uint8Array(IMPORT_LIMITS.maxFileBytes - 1)], "nagy.xlsx");
    const result = await uploadImportWorkbookAction(initial, uploadForm(file));
    expect(result.state).toBe("success");
    const input = world.facade.import.createPreview.mock.calls[0]![1];
    expect(input.payload.workbook).toBeInstanceOf(WorkbookUpload);
    expect(input.payload.workbook.bytes.byteLength).toBe(IMPORT_LIMITS.maxFileBytes - 1);
    expect(input.payload.workbook.fileName).toBe("nagy.xlsx");
    expect(input.idempotencyKey).toMatch(/^import-upload:[0-9a-f]{32}$/);
    expect(world.revalidated).toEqual(["/admin/import"]);
  });

  it("accepts a file of exactly 5 MB and refuses one byte more, with a Hungarian message and no facade call", async () => {
    const exact = new File([new Uint8Array(IMPORT_LIMITS.maxFileBytes)], "pontosan.xlsx");
    expect((await uploadImportWorkbookAction(initial, uploadForm(exact))).state).toBe("success");
    world.facade.import.createPreview.mockClear();
    const over = new File([new Uint8Array(IMPORT_LIMITS.maxFileBytes + 1)], "tul-nagy.xlsx");
    const refused = await uploadImportWorkbookAction(initial, uploadForm(over));
    expect(refused.state).toBe("validation");
    expect(refused.fieldErrors?.workbook).toBe("A munkafüzet legfeljebb 5 MB lehet.");
    expect(world.facade.import.createPreview).not.toHaveBeenCalled();
  });

  it("refuses a file over 6 MB with the same Hungarian message at the action level", async () => {
    const huge = new File([new Uint8Array(IMPORT_LIMITS.maxBodyBytes + 1024)], "hatalmas.xlsx");
    const refused = await uploadImportWorkbookAction(initial, uploadForm(huge));
    expect(refused.state).toBe("validation");
    expect(refused.fieldErrors?.workbook).toBe("A munkafüzet legfeljebb 5 MB lehet.");
    expect(world.facade.import.createPreview).not.toHaveBeenCalled();
  });

  it("refuses a missing, empty or non-file field with a Hungarian message and calls nothing", async () => {
    for (const data of [
      uploadForm(null),
      uploadForm("not-a-file"),
      uploadForm(new File([], "ures.xlsx")),
    ]) {
      const refused = await uploadImportWorkbookAction(initial, data);
      expect(refused.state).toBe("validation");
      expect(refused.fieldErrors?.workbook).toBe("Válasszon ki egy .xlsx munkafüzetet.");
    }
    expect(world.facade.import.createPreview).not.toHaveBeenCalled();
  });

  it("sends a fresh key for every attempt, and denies a caller who is not a signed-in admin", async () => {
    const file = () => new File([new Uint8Array([80, 75, 3, 4])], "a.xlsx");
    await uploadImportWorkbookAction(initial, uploadForm(file()));
    await uploadImportWorkbookAction(initial, uploadForm(file()));
    const keys = world.facade.import.createPreview.mock.calls.map((call) => call[1].idempotencyKey);
    expect(new Set(keys).size).toBe(2);
    world.signedIn = false;
    const denied = await uploadImportWorkbookAction(initial, uploadForm(file()));
    expect(denied.state).toBe("denied");
  });

  it("shows a Hungarian message for each upload code of the parser", async () => {
    const expected: Record<string, RegExp> = {
      IMPORT_MALFORMED: /nem olvasható/,
      IMPORT_OVERSIZED: /túl nagy/,
      IMPORT_MISSING_SHEET: /munkalap/,
      IMPORT_MISSING_HEADER: /oszlop/,
      IMPORT_UNSAFE_CELL: /nem biztonságos/,
    };
    for (const [code, pattern] of Object.entries(expected)) {
      world.facade.import.createPreview.mockResolvedValueOnce(conflict(code));
      const result = await uploadImportWorkbookAction(
        initial,
        uploadForm(new File([new Uint8Array([1])], "x.xlsx")),
      );
      expect(result.state, code).toBe("conflict");
      expect(result.message, code).toMatch(pattern);
    }
  });
});
