/**
 * The server actions behind the two removals (U14): the parent's removal and the archiving of a family. What the
 * database does is covered by tests/database/removal-*.test.ts; here only what happens around its answer.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import type { RemovalReportModel } from "../../src/application/index.ts";
import { requestWorld } from "../support/request-world.ts";
import { removedParent } from "../support/port-doubles.ts";
import {
  envelope,
  fakeAdmin,
  ok,
  recordingEvents,
  unavailable,
  type FakeAdmin,
} from "../support/identity-fakes.ts";

const identity = vi.hoisted(() => ({ runtime: undefined as unknown, throwRuntime: false }));

vi.mock("server-only", () => ({}));
vi.mock("../../app/_identity/production-request.ts", async () =>
  (await import("../support/request-world.ts")).requestWorldModule(),
);
vi.mock("../../src/identity/runtime.ts", async (original) => ({
  ...(await original<typeof import("../../src/identity/runtime.ts")>()),
  getIdentityRuntime: () => {
    if (identity.throwRuntime) throw new Error("CONFIG_INVALID");
    return identity.runtime;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const PARENT = "aaaaaaaa-0000-4000-8000-000000000001";
const FAMILY = "aaaaaaaa-0000-4000-8000-0000000000f1";
const ACCOUNT_A = "bbbbbbbb-0000-4000-8000-00000000000a";
const ACCOUNT_B = "bbbbbbbb-0000-4000-8000-00000000000b";
const KEY = "attempt:0123456789abcdef";
const GROUP = "cccccccc-0000-4000-8000-000000000001";
const WARNING =
  "Egy kijelentkeztetés nem sikerült; a fiók a következő kérésnél úgyis le lesz tiltva.";
const NOTHING_CHANGED = "Az eltávolítás nem sikerült, semmi sem változott.";

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}
const parentForm = () =>
  form({ parentId: PARENT, familyId: FAMILY, expectedVersion: "3", idempotencyKey: KEY });
const familyForm = (kind = "family") =>
  form({ id: FAMILY, kind, expectedVersion: "3", idempotencyKey: KEY });

const familyReport = (endedAccountIds: readonly string[]): RemovalReportModel => ({
  subject: { kind: "family", id: FAMILY },
  steps: [],
  endedAccountIds,
  groupsLeftWithoutCoordinator: [],
  auditEvidenceId: "audit-removal",
});

/** Accounts whose ban fails every time; every other call succeeds. */
function installIdentity(failing: readonly string[] = []) {
  const admin: FakeAdmin = fakeAdmin(
    { sessions_remove: () => envelope("success", "ok") },
    { setBan: async (id) => (failing.includes(id) ? unavailable : ok(null)) },
  );
  const events = recordingEvents();
  identity.runtime = { admin, events };
  return { admin, events };
}

const bannedIds = (admin: FakeAdmin) =>
  admin.calls.filter((call) => call.name === "setBan").map((call) => call.args[0]);
const endedSessionCalls = (admin: FakeAdmin) =>
  admin.calls.filter((call) => call.name === "sessions_remove").length;

/** The database's answer to the family archive. */
function familyAnswer(outcome: unknown) {
  return vi.spyOn(requestWorld.ports.admin, "execute").mockResolvedValue(outcome as never);
}
const removedFamily = (endedAccountIds: readonly string[]) => ({
  state: "success",
  data: { completed: true, removal: familyReport(endedAccountIds) },
});

const removeParent = async (data = parentForm()) =>
  (await import("../../app/admin/parent-actions.ts")).removeParentAction(
    { state: "initial" },
    data,
  );
const archive = async (data = familyForm()) =>
  (await import("../../app/admin/actions.ts")).archiveRecordAction({ state: "initial" }, data);

let logged: MockInstance;

beforeEach(() => {
  requestWorld.reset();
  requestWorld.signIn("super_admin");
  identity.throwRuntime = false;
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("ending the sign-ins after a removal (NFR3.2)", () => {
  it("ends every account of a removed family and leads to the result page", async () => {
    const harness = installIdentity();
    familyAnswer(removedFamily([ACCOUNT_A, ACCOUNT_B]));
    const result = await archive();
    expect(result).toEqual({
      state: "success",
      message: "A család eltávolítva.",
      code: expect.any(String),
      resultPath: `/admin/nyilvantartasok/${FAMILY}/eltavolitas/eredmeny?allapot=eltavolitva`,
    });
    expect(bannedIds(harness.admin)).toEqual([ACCOUNT_A, ACCOUNT_B]);
    expect(endedSessionCalls(harness.admin)).toBe(2);
    expect(logged).not.toHaveBeenCalled();
  });

  it("ends every account a parent removal returned and leads to the result page", async () => {
    const harness = installIdentity();
    requestWorld.ports.directory.removeAnswer = {
      state: "success",
      data: removedParent(PARENT, [ACCOUNT_A, ACCOUNT_B]),
    };
    const result = await removeParent();
    expect(result.message).toBe("A szülő eltávolítva.");
    expect(result.resultPath).toBe(
      `/admin/nyilvantartasok/${FAMILY}/szulo/${PARENT}/eltavolitas/eredmeny?allapot=eltavolitva`,
    );
    expect(bannedIds(harness.admin)).toEqual([ACCOUNT_A, ACCOUNT_B]);
  });

  it("retries a failed session end, goes on to the next account, warns, and logs code and id only", async () => {
    const harness = installIdentity([ACCOUNT_A]);
    familyAnswer(removedFamily([ACCOUNT_A, ACCOUNT_B]));
    const result = await archive();
    expect(result).toMatchObject({
      state: "success",
      code: "SIGN_IN_FOLLOW_UP_PENDING",
      message: `A család eltávolítva. ${WARNING}`,
    });
    expect(result.resultPath).toContain("&kijelentkezes=sikertelen");
    expect(bannedIds(harness.admin)).toEqual([ACCOUNT_A, ACCOUNT_A, ACCOUNT_A, ACCOUNT_B]);
    expect(logged.mock.calls).toEqual([
      ["removal sign-out failed", { code: "SIGN_IN_FOLLOW_UP_PENDING", accountId: ACCOUNT_A }],
    ]);
  });

  it("keeps the removal and warns when the sign-in service cannot be set up", async () => {
    installIdentity();
    identity.throwRuntime = true;
    familyAnswer(removedFamily([ACCOUNT_A]));
    const result = await archive();
    expect(result).toMatchObject({ state: "success", code: "SIGN_IN_FOLLOW_UP_PENDING" });
    expect(logged).toHaveBeenCalledTimes(1);
  });
});

describe("a removal that did not happen (NFR4.5)", () => {
  it("says nothing changed after an unexpected error on a family, and logs no database text", async () => {
    const harness = installIdentity();
    vi.spyOn(requestWorld.ports.admin, "execute").mockRejectedValue(
      new Error("relation todo_tasks does not exist"),
    );
    const result = await archive();
    expect(["retryable", "terminal"]).toContain(result.state);
    expect(result.message).toBe(NOTHING_CHANGED);
    expect(JSON.stringify(logged.mock.calls)).not.toContain("todo_tasks");
    expect(result.resultPath).toBeUndefined();
    expect(logged.mock.calls).toEqual([
      ["removal failed", { operation: "family_archive", code: result.code, requestId: KEY }],
    ]);
    expect(harness.admin.calls).toEqual([]);
  });

  it("says nothing changed after an unexpected error on a parent", async () => {
    const harness = installIdentity();
    vi.spyOn(requestWorld.ports.directory, "removeParent").mockRejectedValue(
      new Error("relation todo_tasks does not exist"),
    );
    const result = await removeParent();
    expect(result.message).toBe(NOTHING_CHANGED);
    expect(logged.mock.calls).toEqual([
      ["removal failed", { operation: "parent_remove", code: result.code, requestId: KEY }],
    ]);
    expect(JSON.stringify(logged.mock.calls)).not.toContain("todo_tasks");
    expect(harness.admin.calls).toEqual([]);
  });

  it.each([
    ["SELF_REMOVAL", "Ezt egy másik főadminisztrátornak kell elvégeznie"],
    ["last_super_admin", "Az utolsó főadminisztrátor nem távolítható el."],
  ])("words the refusal %s and ends no sign-in", async (code, message) => {
    const harness = installIdentity();
    familyAnswer({ state: "conflict", code });
    expect(await archive()).toMatchObject({ state: "conflict", message });
    requestWorld.ports.directory.removeAnswer = { state: "conflict", code };
    expect(await removeParent()).toMatchObject({ state: "conflict", message });
    expect(harness.admin.calls).toEqual([]);
    expect(logged).not.toHaveBeenCalled();
  });

  it("carries the groups that lost their coordinator to the result page, as ids only", async () => {
    installIdentity();
    familyAnswer({
      state: "success",
      data: {
        completed: true,
        removal: {
          ...familyReport([]),
          groupsLeftWithoutCoordinator: [{ groupId: GROUP, groupName: "Kerti kör" }],
        },
      },
    });
    const result = await archive();
    expect(result.resultPath).toBe(
      `/admin/nyilvantartasok/${FAMILY}/eltavolitas/eredmeny?allapot=eltavolitva&csoport=${GROUP}`,
    );
  });

  it("leaves the archiving of any other record as it was", async () => {
    const harness = installIdentity();
    const answer = familyAnswer({ state: "success", data: { completed: true } });
    expect(await archive(familyForm("group"))).toMatchObject({
      state: "success",
      message: "Az elem archiválva.",
    });
    answer.mockRejectedValue(new Error("down"));
    const failed = await archive(familyForm("group"));
    expect(failed.message).not.toBe(NOTHING_CHANGED);
    expect(harness.admin.calls).toEqual([]);
    expect(logged).not.toHaveBeenCalled();
  });
});
