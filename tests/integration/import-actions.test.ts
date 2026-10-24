import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  conflict,
  invalidated,
  retryableFailure,
  success,
  WorkbookUpload,
} from "../../src/application/index.ts";

const world = vi.hoisted(() => ({
  signedIn: true,
  facade: {
    import: {
      createPreview: vi.fn(),
      resolveConflict: vi.fn(),
      commit: vi.fn(),
      recover: vi.fn(),
      cancel: vi.fn(),
    },
  },
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

import {
  cancelImportAction,
  commitImportAction,
  recoverImportAction,
  resolveImportConflictAction,
  uploadImportWorkbookAction,
} from "../../app/admin/advanced-actions.ts";
import { IMPORT_LIMITS } from "../../src/import-parser/index.ts";

const initial = { state: "initial" } as const;
const RUN = "dddddddd-0000-4000-8000-000000000001";
const CONFLICT = "dddddddd-0000-4000-8000-000000000011";

function form(values: Record<string, string | File>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const workbook = (name = "tavaszi.xlsx", size = 64) =>
  new File([new Uint8Array(size).fill(1)], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

beforeEach(() => {
  world.signedIn = true;
  world.revalidated = [];
  for (const mock of Object.values(world.facade.import)) mock.mockReset();
  world.facade.import.createPreview.mockResolvedValue(success({ id: RUN }));
  world.facade.import.resolveConflict.mockResolvedValue(success({ id: RUN }));
  world.facade.import.commit.mockResolvedValue(success({ runId: RUN }));
  world.facade.import.recover.mockResolvedValue(success({ runId: RUN }));
  world.facade.import.cancel.mockResolvedValue(success({ runId: RUN }));
});

describe("uploadImportWorkbookAction", () => {
  it("hands the bytes and the file name to the facade and refreshes the import screen", async () => {
    const result = await uploadImportWorkbookAction(initial, form({ workbook: workbook() }));
    expect(result).toMatchObject({
      state: "success",
      message: "A munkafüzet ellenőrzése és előnézete elkészült.",
    });
    const input = world.facade.import.createPreview.mock.calls[0]![1];
    expect(input.payload.workbook).toBeInstanceOf(WorkbookUpload);
    expect(input.payload.workbook.fileName).toBe("tavaszi.xlsx");
    expect(input.payload.workbook.bytes).toHaveLength(64);
    expect(input.payload.scenario).toBeUndefined();
    expect(world.revalidated).toEqual(["/admin/import"]);
  });

  it("makes a new idempotency key for every attempt", async () => {
    await uploadImportWorkbookAction(initial, form({ workbook: workbook() }));
    await uploadImportWorkbookAction(initial, form({ workbook: workbook() }));
    const keys = world.facade.import.createPreview.mock.calls.map(
      (call) => call[1].idempotencyKey as string,
    );
    expect(keys[0]).toMatch(/^import-upload:[0-9a-f]{32}$/);
    expect(keys[1]).toMatch(/^import-upload:[0-9a-f]{32}$/);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it("refuses a missing or empty file before anything is read further", async () => {
    for (const data of [form({}), form({ workbook: workbook("ures.xlsx", 0) })]) {
      const result = await uploadImportWorkbookAction(initial, data);
      expect(result.state).toBe("validation");
      expect(result.fieldErrors).toEqual({ workbook: "Válasszon ki egy .xlsx munkafüzetet." });
    }
    expect(world.facade.import.createPreview).not.toHaveBeenCalled();
  });

  it("refuses a file over 5 MB with a Hungarian message and accepts exactly 5 MB", async () => {
    const over = await uploadImportWorkbookAction(
      initial,
      form({ workbook: workbook("nagy.xlsx", IMPORT_LIMITS.maxFileBytes + 1) }),
    );
    expect(over.fieldErrors).toEqual({ workbook: "A munkafüzet legfeljebb 5 MB lehet." });
    expect(world.facade.import.createPreview).not.toHaveBeenCalled();
    const exact = await uploadImportWorkbookAction(
      initial,
      form({ workbook: workbook("pont.xlsx", IMPORT_LIMITS.maxFileBytes) }),
    );
    expect(exact.state).toBe("success");
  });

  it("answers 'no permission' without a signed-in admin", async () => {
    world.signedIn = false;
    const result = await uploadImportWorkbookAction(initial, form({ workbook: workbook() }));
    expect(result).toMatchObject({ state: "denied", message: "Nincs jogosultság" });
    expect(world.facade.import.createPreview).not.toHaveBeenCalled();
  });

  it("says the Hungarian message of a parser refusal", async () => {
    world.facade.import.createPreview.mockResolvedValue(conflict("IMPORT_UNSAFE_CELL"));
    const result = await uploadImportWorkbookAction(initial, form({ workbook: workbook() }));
    expect(result).toMatchObject({ state: "conflict", code: "IMPORT_UNSAFE_CELL" });
    expect(result.message).toContain("nem biztonságos cellát");
  });
});

describe("the import step actions", () => {
  it("sends the run id, the run version and the key of the form when a conflict is resolved", async () => {
    const result = await resolveImportConflictAction(
      initial,
      form({
        previewId: RUN,
        conflictId: CONFLICT,
        expectedVersion: "4",
        idempotencyKey: "import-resolve:0123",
        resolution: "use-import",
      }),
    );
    expect(result.state).toBe("success");
    expect(world.facade.import.resolveConflict.mock.calls[0]![1]).toMatchObject({
      id: RUN,
      expectedVersion: 4,
      idempotencyKey: "import-resolve:0123",
      payload: { conflictId: CONFLICT, resolution: "use-import" },
    });
  });

  it("asks for a resolution before calling the facade", async () => {
    const result = await resolveImportConflictAction(initial, form({ previewId: RUN }));
    expect(result.fieldErrors).toEqual({ resolution: "Válasszon feloldási módot." });
    expect(world.facade.import.resolveConflict).not.toHaveBeenCalled();
  });

  it("sends the fingerprint and the confirmation of a commit, and no scenario value", async () => {
    await commitImportAction(
      initial,
      form({
        previewId: RUN,
        expectedVersion: "5",
        fingerprint: "ab".repeat(32),
        confirmed: "yes",
        idempotencyKey: "import-commit:0123",
      }),
    );
    const input = world.facade.import.commit.mock.calls[0]![1];
    expect(input).toMatchObject({
      id: RUN,
      expectedVersion: 5,
      idempotencyKey: "import-commit:0123",
    });
    expect(input.payload).toEqual({ fingerprint: "ab".repeat(32), confirmed: "yes", scenario: "" });
  });

  it("recovers by run id and cancels by run id and version", async () => {
    await recoverImportAction(initial, form({ runId: RUN, idempotencyKey: "import-recover:0123" }));
    expect(world.facade.import.recover.mock.calls[0]![1]).toMatchObject({
      id: RUN,
      payload: { action: "resume" },
    });
    const cancelled = await cancelImportAction(
      initial,
      form({ runId: RUN, expectedVersion: "7", idempotencyKey: "import-cancel:0123" }),
    );
    expect(cancelled).toMatchObject({
      state: "success",
      message: "Az import megszakítva; új munkafüzetet tölthet fel.",
    });
    expect(world.facade.import.cancel.mock.calls[0]![1]).toMatchObject({
      id: RUN,
      expectedVersion: 7,
    });
    expect(world.revalidated).toEqual(["/admin/import", "/admin/import"]);
  });

  it("maps the new codes to their own Hungarian messages", async () => {
    world.facade.import.commit.mockResolvedValueOnce(conflict("IMPORT_MATCH_CHANGED"));
    const changed = await commitImportAction(initial, form({ previewId: RUN }));
    expect(changed.message).toContain("megváltoztak");
    world.facade.import.commit.mockResolvedValueOnce(conflict("IMPORT_CONFIRMATION_REQUIRED"));
    const unconfirmed = await commitImportAction(initial, form({ previewId: RUN }));
    expect(unconfirmed.message).toBe("Jelölje be, hogy megerősíti a következményeket.");
    world.facade.import.recover.mockResolvedValueOnce(conflict("IMPORT_RECOVERY_NOT_AVAILABLE"));
    const none = await recoverImportAction(initial, form({ runId: RUN }));
    expect(none.message).toContain("nincs folytatható mentés");
  });

  it("keeps a stale run and a transient failure distinguishable", async () => {
    world.facade.import.commit.mockResolvedValueOnce(invalidated("IMPORT_PREVIEW_STALE"));
    const stale = await commitImportAction(initial, form({ previewId: RUN }));
    expect(stale.state).toBe("invalidated");
    expect(stale.message).toBe("Az előnézet elavult; kezdje újra az ellenőrzést.");
    world.facade.import.commit.mockResolvedValueOnce(
      retryableFailure({ idempotencyKey: "import-commit:0123", action: "import.commit" }),
    );
    const retry = await commitImportAction(initial, form({ previewId: RUN }));
    expect(retry.state).toBe("retryable");
  });

  it("refuses every step without a signed-in admin", async () => {
    world.signedIn = false;
    for (const action of [
      resolveImportConflictAction,
      commitImportAction,
      recoverImportAction,
      cancelImportAction,
    ]) {
      const result = await action(initial, form({ resolution: "use-import" }));
      expect(result.state).toBe("denied");
    }
    expect(world.facade.import.cancel).not.toHaveBeenCalled();
  });
});
