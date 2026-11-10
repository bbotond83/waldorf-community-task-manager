import { beforeEach, expect, it, vi } from "vitest";
import { requestWorld } from "../support/request-world.ts";

const boundary = vi.hoisted(() => ({ revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../../app/_identity/production-request.ts", async () =>
  (await import("../support/request-world.ts")).requestWorldModule(),
);
vi.mock("next/cache", () => ({ revalidatePath: boundary.revalidate }));
import * as actions from "../../app/szulo/actions.ts";

beforeEach(() => {
  vi.clearAllMocks();
  requestWorld.reset();
});
function signIn() {
  requestWorld.signIn("parent");
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
const initial = { state: "initial" } as const;
const cases = [
  ["signUpAction", { id: "duty-garden" }],
  [
    "requestSwapAction",
    {
      id: "duty-assigned",
      assignmentId: "assignment-lampas",
      counterpart: "valid-counterpart:1",
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
            counterpart: "",
          }),
        )
      ).state,
    ).toBe("validation");
    expect((await actions[name](initial, form(values))).state).toBe("denied");
  });
  it(name + " returns authorized real success and safe presentation", async () => {
    signIn();
    const result = await actions[name](initial, form(values));
    expect(result.state).toBe("success");
    expect(result.message).toBeTruthy();
    expect(JSON.stringify(result)).not.toContain("Invented reason");
  });
}
it("marks a notification read twice without a change or an error and refreshes the list", async () => {
  signIn();
  const first = await actions.markNotificationReadAction(
    initial,
    form({ id: "notice-7-day", idempotencyKey: "notice:notice-7-day:open:aaaa1111" }),
  );
  const second = await actions.markNotificationReadAction(
    initial,
    form({ id: "notice-7-day", idempotencyKey: "notice:notice-7-day:read" }),
  );
  expect(first.state).toBe("success");
  expect(second.state).toBe("success");
  expect(second.link).toBe("/szulo/feladatok/duty-assigned");
  expect(boundary.revalidate).toHaveBeenCalledWith("/szulo/ertesitesek");
  expect(boundary.revalidate).toHaveBeenCalledTimes(2);
});
it("does not refresh the list when marking read is denied or invalid", async () => {
  expect(
    (await actions.markNotificationReadAction(initial, form({ id: "notice-7-day" }))).state,
  ).toBe("denied");
  expect(
    (await actions.markNotificationReadAction(initial, form({ id: "!", idempotencyKey: "x" })))
      .state,
  ).toBe("validation");
  expect(boundary.revalidate).not.toHaveBeenCalled();
});
it("preserves signup idempotency and reports full/ineligible conflicts", async () => {
  signIn();
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
});
it.each([
  ["retryable", "retryable"],
  ["terminal", "terminal"],
  ["invalidated", "invalidated"],
  ["conflict", "conflict"],
])("maps request %s with no protected reason", async (partner, state) => {
  signIn();
  const result = await actions.requestSwapAction(
    initial,
    form({
      id: "duty-assigned",
      assignmentId: "assignment-lampas",
      counterpart: `${partner}:1`,
      expectedVersion: "4",
      reason: "Invented reason",
    }),
  );
  expect(result.state).toBe(state);
  expect(JSON.stringify(result)).not.toContain("Invented reason");
});
it("asks for a chosen swap partner and refuses a malformed choice before anything is sent", async () => {
  signIn();
  const base = {
    id: "duty-assigned",
    assignmentId: "assignment-lampas",
    expectedVersion: "4",
    reason: "Invented reason",
  };
  const none = await actions.requestSwapAction(initial, form(base));
  expect(none.state).toBe("validation");
  expect(none.fieldErrors?.counterpart).toBe("Válasszon egy cseretársat.");
  for (const counterpart of ["no-version", "partner:0", "partner:x", "!:1"]) {
    const bad = await actions.requestSwapAction(initial, form({ ...base, counterpart }));
    expect(bad.state, counterpart).toBe("validation");
    expect(bad.fieldErrors?.counterpart).toBe("Érvénytelen cseretárs.");
  }
  expect(requestWorld.ports.parent.requests.size).toBe(0);
});
