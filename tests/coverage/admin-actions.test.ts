import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { createSyntheticSessionToken } from "../../src/runtime/session/session.ts";
import { getSyntheticProfile } from "../../src/runtime/synthetic/profiles.ts";
import { resetSyntheticAdminFixtures } from "../../src/admin-core/synthetic-admin.ts";
import { resetSyntheticAdvancedFixtures } from "../../src/admin-advanced/index.ts";
import { resetSyntheticParentState } from "../../src/parent-web/index.ts";
const boundary = vi.hoisted(() => ({
  token: undefined as string | undefined,
  set: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (boundary.token ? { value: boundary.token } : undefined),
    set: boundary.set,
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: boundary.revalidate }));
beforeEach(() => {
  vi.stubEnv("APP_RUNTIME_MODE", "synthetic");
  boundary.token = undefined;
  vi.clearAllMocks();
  resetSyntheticAdminFixtures();
  resetSyntheticAdvancedFixtures();
  resetSyntheticParentState();
});
afterEach(() => vi.unstubAllEnvs());
function signIn(id: string) {
  boundary.token = createSyntheticSessionToken(getSyntheticProfile(id)!);
}
function form(values: Record<string, string> = {}) {
  const result = new FormData();
  for (const [key, value] of Object.entries({
    id: "task-kert",
    expectedVersion: "1",
    idempotencyKey: "coverage:key:0001",
    title: "Invented title",
    ...values,
  }))
    result.set(key, value);
  return result;
}
import * as core from "../../app/admin/actions.ts";
import * as advanced from "../../app/admin/advanced-actions.ts";
const initial = { state: "initial" } as const;
const coreCases = [
  ["saveRecordAction", { id: "family-feny" }, "success"],
  ["archiveRecordAction", { id: "family-feny" }, "success"],
  ["restoreRecordAction", { id: "family-napraforgo" }, "success"],
  ["saveTaskAction", { id: "task-kert" }, "success"],
  ["assignTaskAction", { id: "task-kert" }, "success"],
  ["decideApprovalAction", { id: "approval-csere" }, "success"],
  [
    "saveEventNotesAction",
    { id: "event-lampa", expectedVersion: "2", allergenNote: " Invented note " },
    "success",
  ],
] as const;
for (const [name, values, state] of coreCases) {
  it(name + " authorizes and returns its actual mutation outcome", async () => {
    signIn("super-admin-local");
    const result = await core[name](initial, form(values));
    expect(result.state).toBe(state);
    expect(result.code).toBeTruthy();
    expect(boundary.revalidate).toHaveBeenCalled();
  });
  it(name + " rejects malformed metadata and signed-out mutation", async () => {
    expect(
      (
        await core[name](
          initial,
          form({ ...values, id: "!", expectedVersion: "-1", idempotencyKey: "x" }),
        )
      ).state,
    ).toBe("validation");
    expect((await core[name](initial, form(values))).state).toBe("denied");
    expect(boundary.revalidate).not.toHaveBeenCalled();
  });
}
it("normalizes title validation, notes bounds and idempotent repeat", async () => {
  signIn("super-admin-local");
  expect((await core.saveRecordAction(initial, form({ title: " " }))).state).toBe("validation");
  expect((await core.saveTaskAction(initial, form({ title: " " }))).state).toBe("validation");
  expect(
    (await core.saveEventNotesAction(initial, form({ foodNote: "x".repeat(301) }))).state,
  ).toBe("validation");
  const input = form({ id: "task-kert" });
  const first = await core.assignTaskAction(initial, input);
  expect(await core.assignTaskAction(initial, input)).toEqual(first);
});
it.each([
  ["full", "conflict"],
  ["ineligible", "conflict"],
  ["retryable", "terminal"],
  ["terminal", "terminal"],
])("maps assignment %s without leaking details", async (scenario, state) => {
  signIn("super-admin-local");
  const result = await core.assignTaskAction(initial, form({ scenario }));
  expect(result.state).toBe(state);
  expect(result.message).toBeTruthy();
  expect(boundary.revalidate).not.toHaveBeenCalled();
});
it.each([
  ["invalidated", "invalidated"],
  ["denied", "denied"],
  ["retryable", "terminal"],
  ["terminal", "terminal"],
])("maps approval %s to a distinct outcome", async (scenario, state) => {
  signIn("super-admin-local");
  const result = await core.decideApprovalAction(initial, form({ id: "approval-csere", scenario }));
  expect(result.state).toBe(state);
  expect(result.outcome).toBe(state);
});
it("distinguishes rejected and already-decided approvals", async () => {
  signIn("super-admin-local");
  expect(
    (await core.decideApprovalAction(initial, form({ id: "approval-csere", decision: "rejected" })))
      .outcome,
  ).toBe("rejected");
  expect(
    (
      await core.decideApprovalAction(
        initial,
        form({
          id: "approval-lezart",
          expectedVersion: "2",
          idempotencyKey: "coverage:closed:0001",
        }),
      )
    ).outcome,
  ).toBe("already-decided");
});
it("rejects unsigned callers at every advanced boundary", async () => {
  for (const action of Object.values(advanced))
    expect(
      (
        await action(
          initial,
          form({
            fixtureId: "workbook-waldorf-v1",
            resolution: "keep-existing",
            recipientId: "allowed",
          }),
        )
      ).state,
    ).toBe("denied");
});
it("returns field-specific advanced validation", async () => {
  expect((await advanced.createImportPreviewAction(initial, form())).fieldErrors).toHaveProperty(
    "fixtureId",
  );
  expect((await advanced.resolveImportConflictAction(initial, form())).fieldErrors).toHaveProperty(
    "resolution",
  );
  expect((await advanced.saveAdvancedSettingsAction(initial, form())).fieldErrors).toHaveProperty(
    "recipientId",
  );
});
it("creates and rejects workbook previews through actual facade", async () => {
  signIn("super-admin-local");
  expect(
    (await advanced.createImportPreviewAction(initial, form({ fixtureId: "workbook-waldorf-v1" })))
      .state,
  ).toBe("success");
  expect(
    (
      await advanced.createImportPreviewAction(
        initial,
        form({
          fixtureId: "workbook-waldorf-v1",
          scenario: "malformed",
          idempotencyKey: "coverage:preview:0002",
        }),
      )
    ).code,
  ).toBe("IMPORT_MALFORMED");
  expect(boundary.revalidate).toHaveBeenCalledWith("/admin/import");
});
it("runs advanced mutation outcomes with real invalid identities", async () => {
  signIn("super-admin-local");
  const actions = [
    advanced.commitImportAction,
    advanced.recoverImportAction,
    advanced.retryReminderAction,
    advanced.updateGrantAction,
    advanced.runLifecycleAction,
    advanced.saveAdvancedSettingsAction,
    advanced.resolveImportConflictAction,
  ];
  for (let index = 0; index < actions.length; index++) {
    const result = await actions[index]!(
      initial,
      form({
        previewId: "unknown",
        runId: "unknown",
        jobId: "unknown",
        grantId: "unknown",
        familyId: "unknown",
        recipientId: "unknown",
        resolution: "keep-existing",
        idempotencyKey: "coverage:advanced:" + index,
        correlationId: "coverage:correlation:" + index,
      }),
    );
    expect(["denied", "conflict", "validation", "invalidated"]).toContain(result.state);
    expect(result.message).toBeTruthy();
  }
});
