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
  resetParentFacadeCache();
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
import { resetParentFacadeCache } from "../../app/szulo/_lib/facade.ts";
import * as actions from "../../app/szulo/actions.ts";
import { authenticateParentAction } from "../../app/belepes/actions.ts";
import {
  acceptInvitationAction,
  resendInvitationAction,
} from "../../app/meghivas/[token]/actions.ts";
const initial = { state: "initial" } as const;
const cases = [
  ["signUpAction", { id: "duty-garden" }],
  [
    "requestSwapAction",
    {
      id: "duty-assigned",
      assignmentId: "assignment-lampas",
      counterpartId: "valid-counterpart",
      expectedVersion: "4",
      reason: "Invented reason",
    },
  ],
  [
    "requestCancellationAction",
    {
      id: "duty-assigned",
      assignmentId: "assignment-lampas",
      expectedVersion: "4",
      reason: "Invented reason",
    },
  ],
  ["markNotificationReadAction", { id: "notice-7-day" }],
  ["updateContributionAction", { id: "duty-assigned", note: " Invented contribution " }],
] as const;
for (const [name, values] of cases) {
  it(name + " validates data and refuses signed-out mutation", async () => {
    expect(
      (
        await actions[name](
          initial,
          form({
            ...values,
            id: "!",
            idempotencyKey: "x",
            expectedVersion: "-1",
            note: "",
            reason: "",
          }),
        )
      ).state,
    ).toBe("validation");
    expect((await actions[name](initial, form(values))).state).toBe("denied");
  });
  it(name + " returns authorized real success and safe presentation", async () => {
    signIn("parent-local");
    const result = await actions[name](initial, form(values));
    expect(result.state).toBe("success");
    expect(result.message).toBeTruthy();
    expect(JSON.stringify(result)).not.toContain("Invented reason");
  });
}
it("preserves signup idempotency and reports full/ineligible conflicts", async () => {
  signIn("parent-local");
  const input = form({ id: "duty-garden" });
  const first = await actions.signUpAction(initial, input);
  expect(await actions.signUpAction(initial, input)).toEqual(first);
  expect(
    (
      await actions.signUpAction(
        initial,
        form({ id: "duty-full", expectedVersion: "3", idempotencyKey: "coverage:full:0001" }),
      )
    ).code,
  ).toBe("DUTY_FULL");
  expect(
    (
      await actions.signUpAction(
        initial,
        form({
          id: "duty-ineligible",
          expectedVersion: "2",
          idempotencyKey: "coverage:ineligible:0001",
        }),
      )
    ).code,
  ).toBe("DUTY_INELIGIBLE");
});
it.each([
  ["retryable", "retryable"],
  ["terminal", "terminal"],
  ["invalidated", "invalidated"],
  ["conflict", "conflict"],
])("maps request %s with no protected reason", async (scenario, state) => {
  signIn("parent-local");
  const result = await actions.requestSwapAction(
    initial,
    form({
      id: "duty-assigned",
      assignmentId: "assignment-lampas",
      counterpartId: scenario,
      expectedVersion: "4",
      reason: "Invented reason",
    }),
  );
  expect(result.state).toBe(state);
  expect(JSON.stringify(result)).not.toContain("Invented reason");
});
it("returns validation and denied authentication then safe destination/cookie", async () => {
  expect((await authenticateParentAction(initial, form({ identifier: "" }))).state).toBe(
    "validation",
  );
  expect((await authenticateParentAction(initial, form({ identifier: "unknown" }))).state).toBe(
    "denied",
  );
  expect(
    (
      await authenticateParentAction(
        initial,
        form({ identifier: "parent-local", intendedPath: "https://invented.invalid" }),
      )
    ).destination,
  ).toBe("/szulo/feladatok");
  expect(boundary.set).toHaveBeenCalledWith(
    "waldorf_local_session",
    expect.any(String),
    expect.objectContaining({ httpOnly: true, sameSite: "lax", secure: false }),
  );
  expect(
    (
      await authenticateParentAction(
        initial,
        form({ identifier: "parent-local", intendedPath: "/szulo/ertesitesek" }),
      )
    ).destination,
  ).toBe("/szulo/ertesitesek");
});
it("accepts valid invitations, generically denies invalid and simulates resend", async () => {
  expect((await acceptInvitationAction("parent-valid-invitation", initial)).destination).toBe(
    "/szulo/feladatok",
  );
  expect((await acceptInvitationAction("parent-expired-invitation", initial)).state).toBe("denied");
  expect(
    (await resendInvitationAction(initial, form({ identifier: "invented@example.invalid" }))).state,
  ).toBe("success");
});
it("fails safely when runtime is invalid", async () => {
  vi.stubEnv("APP_RUNTIME_MODE", "invalid");
  expect(
    (await authenticateParentAction(initial, form({ identifier: "parent-local" }))).state,
  ).toBe("terminal");
  expect((await acceptInvitationAction("parent-valid-invitation", initial)).state).toBe("terminal");
  expect((await resendInvitationAction(initial, new FormData())).state).toBe("terminal");
});
