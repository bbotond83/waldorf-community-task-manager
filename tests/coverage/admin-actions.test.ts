import { beforeEach, expect, it, vi } from "vitest";
import { requestWorld } from "../support/request-world.ts";
const boundary = vi.hoisted(() => ({ revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../../app/_identity/production-request.ts", async () =>
  (await import("../support/request-world.ts")).requestWorldModule(),
);
vi.mock("next/cache", () => ({ revalidatePath: boundary.revalidate }));
beforeEach(() => {
  vi.clearAllMocks();
  requestWorld.reset();
});
function signIn(role: "super_admin" | "group_admin" = "super_admin") {
  requestWorld.signIn(role);
}
/** Makes the data source answer the next admin calls with a named failure or conflict word. */
function force(scenario: string) {
  requestWorld.ports.admin.forcedScenario = scenario;
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
  ["decideApprovalAction", { id: "approval-csere", decision: "approved" }, "success"],
  [
    "saveEventNotesAction",
    { id: "event-lampa", expectedVersion: "2", allergenNote: " Invented note " },
    "success",
  ],
] as const;
for (const [name, values, state] of coreCases) {
  it(name + " authorizes and returns its actual mutation outcome", async () => {
    signIn();
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
  signIn();
  expect((await core.saveRecordAction(initial, form({ title: " " }))).state).toBe("validation");
  expect((await core.saveTaskAction(initial, form({ title: " " }))).state).toBe("validation");
  expect(
    (await core.saveEventNotesAction(initial, form({ foodNote: "x".repeat(301) }))).state,
  ).toBe("validation");
  const input = form({ id: "task-kert" });
  const first = await core.assignTaskAction(initial, input);
  expect(await core.assignTaskAction(initial, input)).toEqual(first);
});
it.each(["saveRecordAction", "saveTaskAction"] as const)(
  "%s names an empty or too long title in Hungarian and creates nothing",
  async (name) => {
    signIn();
    const empty = await core[name](initial, form({ id: "new", title: "   " }));
    expect(empty.state).toBe("validation");
    expect(empty.fieldErrors).toEqual({ title: "A megnevezés megadása kötelező." });
    const long = await core[name](initial, form({ id: "new", title: "x".repeat(121) }));
    expect(long.state).toBe("validation");
    expect(long.fieldErrors).toEqual({
      title: "A megnevezés legfeljebb 120 karakter hosszú lehet.",
    });
    for (const result of [empty, long]) {
      expect(JSON.stringify(result)).not.toMatch(/VAL-/);
    }
    expect(boundary.revalidate).not.toHaveBeenCalled();
    const exact = await core[name](
      initial,
      form({ id: "new", title: "x".repeat(120), idempotencyKey: "coverage:title:max:0001" }),
    );
    expect(exact.state).toBe("success");
  },
);
it.each([
  ["full", "conflict"],
  // A transient source failure is retryable (the old demo classifier mis-labelled it terminal).
  ["retryable", "retryable"],
  ["terminal", "terminal"],
])("maps assignment %s without leaking details", async (scenario, state) => {
  signIn();
  force(scenario);
  const result = await core.assignTaskAction(initial, form());
  expect(result.state).toBe(state);
  expect(result.message).toBeTruthy();
  expect(boundary.revalidate).not.toHaveBeenCalled();
});
it.each([
  ["invalidated", "invalidated"],
  ["denied", "denied"],
  ["retryable", "retryable"],
  ["terminal", "terminal"],
])("maps approval %s to a distinct outcome", async (scenario, state) => {
  signIn();
  force(scenario);
  const result = await core.decideApprovalAction(
    initial,
    form({ id: "approval-csere", decision: "approved" }),
  );
  expect(result.state).toBe(state);
  expect(result.outcome).toBe(state);
});
it("refuses a missing or unknown approval decision before anything is decided (fail closed)", async () => {
  signIn();
  for (const values of [
    { id: "approval-csere" } as Record<string, string>,
    { id: "approval-csere", decision: "" },
    { id: "approval-csere", decision: "approve" },
    { id: "approval-csere", decision: "Rejected" },
  ]) {
    const result = await core.decideApprovalAction(initial, form(values));
    expect(result.state).toBe("validation");
    expect(result.fieldErrors?.decision).toBeTruthy();
  }
  expect(boundary.revalidate).not.toHaveBeenCalled();
  // The request is still open: a valid decision afterwards works.
  expect(
    (await core.decideApprovalAction(initial, form({ id: "approval-csere", decision: "approved" })))
      .state,
  ).toBe("success");
});
it("distinguishes rejected and already-decided approvals", async () => {
  signIn();
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
          decision: "approved",
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
            resolution: "keep-existing",
            recipientId: "allowed",
          }),
        )
      ).state,
    ).toBe("denied");
});
it("returns field-specific advanced validation", async () => {
  signIn();
  expect((await advanced.saveAdvancedSettingsAction(initial, form())).fieldErrors).toHaveProperty(
    "recipientId",
  );
});
it("sends no scenario value in any admin payload, whatever the form carries", async () => {
  signIn();
  const seen: unknown[] = [];
  const port = requestWorld.ports.admin;
  const original = port.execute.bind(port);
  port.execute = (async (input: { payload: Record<string, unknown> }) => {
    seen.push(input.payload);
    return original(input as never);
  }) as typeof port.execute;
  await core.assignTaskAction(initial, form({ scenario: "full" }));
  await core.decideApprovalAction(
    initial,
    form({ id: "approval-csere", decision: "approved", scenario: "denied" }),
  );
  await core.archiveRecordAction(initial, form({ id: "family-feny", scenario: "terminal" }));
  await advanced.retryReminderAction(
    initial,
    form({ jobId: "job-lampas", correlationId: "coverage:correlation:0001", scenario: "terminal" }),
  );
  expect(seen.length).toBeGreaterThanOrEqual(4);
  for (const payload of seen) expect(payload).not.toHaveProperty("scenario");
});
it("runs advanced mutation outcomes with real invalid identities", async () => {
  signIn();
  const actions = [
    advanced.retryReminderAction,
    advanced.updateGrantAction,
    advanced.runLifecycleAction,
    advanced.saveAdvancedSettingsAction,
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
