import { beforeEach, describe, expect, it, vi } from "vitest";
import { conflict, invalidated, success } from "../../src/application/index.ts";

const world = vi.hoisted(() => ({
  signedIn: true,
  facade: {
    requestSwap: vi.fn(),
    respondToSwap: vi.fn(),
    withdrawRequest: vi.fn(),
  },
  revalidated: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => world.revalidated.push(path),
}));
vi.mock("../../app/szulo/_lib/facade.ts", () => ({
  resolveParentFacade: async () => (world.signedIn ? world.facade : undefined),
}));
vi.mock("../../app/szulo/_lib/session.ts", () => ({
  resolveParentSession: async () =>
    world.signedIn
      ? {
          state: "success",
          data: {
            applicationSession: { subjectId: "parent" },
            familyScope: { id: "family-1", type: "family", organizationId: "org" },
            familyId: "family-1",
          },
        }
      : { state: "signed-out" },
}));

import {
  requestSwapAction,
  respondToSwapAction,
  withdrawRequestAction,
} from "../../app/szulo/actions.ts";
import { PARENT_CONFLICT_MESSAGES } from "../../app/szulo/_lib/action-state.ts";

const initial = { state: "initial" } as const;
const REQUEST = "11111111-0000-4000-8000-000000000001";
const PARTNER = "aaaaaaaa-0000-4000-8000-0000000000a1";

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  const base = {
    id: "duty-1",
    expectedVersion: "4",
    idempotencyKey: "swap:0123456789abcdef",
    reason: "Beteg a gyerek",
    assignmentId: "assignment-1",
  };
  for (const [key, value] of Object.entries({ ...base, ...values })) data.set(key, value);
  return data;
}

beforeEach(() => {
  world.signedIn = true;
  world.revalidated = [];
  world.facade.requestSwap.mockReset().mockResolvedValue(success({ id: "r", state: "pending" }));
  world.facade.respondToSwap
    .mockReset()
    .mockResolvedValue(success({ id: REQUEST, outcome: "applied" }));
  world.facade.withdrawRequest
    .mockReset()
    .mockResolvedValue(success({ id: REQUEST, state: "withdrawn" }));
});

describe("requestSwapAction with the partner list", () => {
  it("sends the chosen partner place and the version that was on screen", async () => {
    const result = await requestSwapAction(initial, form({ counterpart: `${PARTNER}:3` }));
    expect(result).toMatchObject({ state: "success" });
    expect(world.facade.requestSwap).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        assignmentId: "assignment-1",
        counterpartId: PARTNER,
        counterpartVersion: 3,
        expectedVersion: 4,
        idempotencyKey: "swap:0123456789abcdef",
      }),
    );
    expect(world.revalidated).toEqual(
      expect.arrayContaining(["/szulo/feladatok", "/szulo/feladatok/duty-1", "/szulo/cserek"]),
    );
  });

  it("asks for a choice, linked to the first partner, when none was made", async () => {
    const result = await requestSwapAction(initial, form({}));
    expect(result).toMatchObject({
      state: "validation",
      fieldErrors: { counterpart: "Válasszon egy cseretársat." },
    });
    expect(world.facade.requestSwap).not.toHaveBeenCalled();
  });

  it.each(["abc", `${PARTNER}:x`, `${PARTNER}:0`, `${PARTNER}`, "!!:3"])(
    "refuses the malformed choice %s",
    async (choice) => {
      const result = await requestSwapAction(initial, form({ counterpart: choice }));
      expect(result).toMatchObject({
        state: "validation",
        fieldErrors: { counterpart: "Érvénytelen cseretárs." },
      });
    },
  );

  it("no longer takes a fixed partner id from the form: without a chosen partner nothing is sent", async () => {
    const result = await requestSwapAction(
      initial,
      form({ counterpartId: "assignment-counterpart" }),
    );
    expect(result.state).toBe("validation");
    expect(world.facade.requestSwap).not.toHaveBeenCalled();
    expect(world.revalidated).toEqual([]);
  });

  it("maps the conflicts of a swap to Hungarian messages and does not refresh pages", async () => {
    for (const [code, message] of Object.entries(PARENT_CONFLICT_MESSAGES)) {
      world.facade.requestSwap.mockResolvedValueOnce(conflict(code));
      const result = await requestSwapAction(initial, form({ counterpart: `${PARTNER}:3` }));
      expect(result).toMatchObject({ state: "conflict", code, message });
    }
    expect(world.revalidated).toEqual([]);
  });

  it("is denied without a session", async () => {
    world.signedIn = false;
    const result = await requestSwapAction(initial, form({ counterpart: `${PARTNER}:3` }));
    expect(result).toMatchObject({ state: "denied", message: "Nincs jogosultság." });
  });
});

describe("respondToSwapAction", () => {
  it("confirms with the request, its version and the key", async () => {
    const result = await respondToSwapAction(
      initial,
      form({ id: REQUEST, expectedVersion: "2", decision: "accept" }),
    );
    expect(result).toMatchObject({
      state: "success",
      message: "A csere megtörtént: a két család feladata felcserélődött.",
    });
    expect(world.facade.respondToSwap).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ requestId: REQUEST, accept: true, expectedVersion: 2 }),
    );
    expect(world.revalidated).toEqual(["/szulo/cserek", "/szulo/feladatok"]);
  });

  it("declines and says so", async () => {
    world.facade.respondToSwap.mockResolvedValue(success({ id: REQUEST, outcome: "declined" }));
    const result = await respondToSwapAction(initial, form({ id: REQUEST, decision: "decline" }));
    expect(result).toMatchObject({ state: "success", message: "A cserekérelmet elutasította." });
    expect(world.facade.respondToSwap.mock.calls[0]![1].accept).toBe(false);
  });

  it("refuses an unknown decision before anything is sent", async () => {
    const result = await respondToSwapAction(initial, form({ id: REQUEST, decision: "later" }));
    expect(result).toMatchObject({
      state: "validation",
      fieldErrors: { decision: "Válasszon: megerősítés vagy elutasítás." },
    });
    expect(world.facade.respondToSwap).not.toHaveBeenCalled();
  });

  it("refuses bad ids, versions and keys", async () => {
    const result = await respondToSwapAction(
      initial,
      form({ id: "!", expectedVersion: "0", idempotencyKey: "x", decision: "accept" }),
    );
    expect(result.state).toBe("validation");
    expect(result.fieldErrors).toHaveProperty("id");
    expect(result.fieldErrors).toHaveProperty("expectedVersion");
    expect(result.fieldErrors).toHaveProperty("idempotencyKey");
  });

  it("tells the family when the request is no longer open or can no longer be applied", async () => {
    world.facade.respondToSwap.mockResolvedValueOnce(conflict("SWAP_REQUEST_NOT_OPEN"));
    expect(
      (await respondToSwapAction(initial, form({ id: REQUEST, decision: "accept" }))).message,
    ).toBe("Ez a kérelem már nem nyitott: időközben visszavonták vagy elbírálták.");
    world.facade.respondToSwap.mockResolvedValueOnce(conflict("SWAP_CANNOT_BE_APPLIED"));
    expect(
      (await respondToSwapAction(initial, form({ id: REQUEST, decision: "accept" }))).message,
    ).toMatch(/^A csere már nem hajtható végre/);
    world.facade.respondToSwap.mockResolvedValueOnce(invalidated("REQUEST_VERSION_STALE"));
    expect(
      (await respondToSwapAction(initial, form({ id: REQUEST, decision: "accept" }))).state,
    ).toBe("invalidated");
    expect(world.revalidated).toEqual([]);
  });

  it("is denied without a session", async () => {
    world.signedIn = false;
    const result = await respondToSwapAction(initial, form({ id: REQUEST, decision: "accept" }));
    expect(result.state).toBe("denied");
  });
});

describe("withdrawRequestAction", () => {
  it("withdraws a swap request by default and a cancellation request when told", async () => {
    await withdrawRequestAction(initial, form({ id: REQUEST }));
    expect(world.facade.withdrawRequest.mock.calls[0]![1]).toMatchObject({
      requestId: REQUEST,
      kind: "swap",
    });
    const result = await withdrawRequestAction(
      initial,
      form({ id: REQUEST, kind: "cancellation" }),
    );
    expect(world.facade.withdrawRequest.mock.calls[1]![1].kind).toBe("cancellation");
    expect(result).toMatchObject({ state: "success", message: "A kérelmet visszavonta." });
    expect(world.revalidated).toContain("/szulo/cserek");
  });

  it("refuses invalid data and a signed-out caller", async () => {
    expect((await withdrawRequestAction(initial, form({ id: "!" }))).state).toBe("validation");
    world.signedIn = false;
    expect((await withdrawRequestAction(initial, form({ id: REQUEST }))).state).toBe("denied");
  });
});
