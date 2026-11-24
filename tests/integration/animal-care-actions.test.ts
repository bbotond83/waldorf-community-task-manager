import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  conflict,
  denied,
  success,
  validation,
  terminalFailure,
} from "../../src/application/index.ts";

const DUTY = "11111111-1111-4111-8111-111111111111";
const PLACE = "22222222-2222-4222-8222-222222222222";
const YEAR = "33333333-3333-4333-8333-333333333333";
const GROUP = "44444444-4444-4444-8444-444444444444";
const SECTION = "55555555-5555-4555-8555-555555555555";
const KEY = "animal-test:abcdef0123";
const familyScope = { id: "family-1", type: "family", organizationId: "org" };
const orgScope = { id: "org", type: "organization", organizationId: "org" };

const world = vi.hoisted(() => ({
  parent: undefined as unknown,
  admin: undefined as unknown,
  info: undefined as unknown,
  parentFacadeOn: true,
  animalOn: true,
  informationOn: true,
  parentFacade: { signUp: vi.fn() },
  animal: { giveUp: vi.fn(), saveCalendar: vi.fn(), createSlots: vi.fn() },
  information: { create: vi.fn(), update: vi.fn(), setHidden: vi.fn() },
  revalidated: [] as string[],
  redirected: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => world.revalidated.push(path) }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    world.redirected.push(path);
    throw new Error("NEXT_REDIRECT");
  },
}));
vi.mock("../../app/szulo/_lib/session.ts", () => ({
  resolveParentSession: async () => world.parent,
}));
vi.mock("../../app/szulo/_lib/facade.ts", () => ({
  resolveParentFacade: async () => (world.parentFacadeOn ? world.parentFacade : undefined),
}));
vi.mock("../../app/admin/_lib/session.ts", () => ({
  resolveAdminSession: async () => world.admin,
}));
vi.mock("../../app/_info/actor.ts", () => ({ resolveInfoActor: async () => world.info }));
vi.mock("../../app/_animal/facade.ts", () => ({
  resolveAnimalCareFacade: async () => (world.animalOn ? world.animal : undefined),
  resolveInformationFacade: async () => (world.informationOn ? world.information : undefined),
}));

import {
  animalSignUpAction,
  createSlotsAction,
  giveUpAction,
  saveCalendarAction,
} from "../../app/_animal/actions.ts";
import { mapAnimalResult } from "../../app/_animal/animal-result.ts";
import { saveSectionAction, setHiddenAction } from "../../app/_info/actions.ts";

const initial = { state: "initial" } as const;

function form(values: Record<string, string>, extra: [string, string][] = []): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries({ idempotencyKey: KEY, ...values })) {
    data.set(key, value);
  }
  for (const [key, value] of extra) data.append(key, value);
  return data;
}

const parentSession = {
  state: "success",
  data: { applicationSession: { roles: ["parent"] }, familyScope, familyId: "family-1" },
};
const adminSession = {
  state: "success",
  data: { applicationSession: { roles: ["super_admin"] }, scope: orgScope },
};
const infoActor = { session: { roles: ["super_admin"] }, scope: orgScope };

beforeEach(() => {
  world.parent = parentSession;
  world.admin = adminSession;
  world.info = infoActor;
  world.parentFacadeOn = world.animalOn = world.informationOn = true;
  world.revalidated.length = 0;
  world.redirected.length = 0;
  world.parentFacade.signUp.mockReset().mockResolvedValue(success({}));
  for (const fn of Object.values(world.animal))
    fn.mockReset().mockResolvedValue(success({ id: PLACE, version: 2 }));
  for (const fn of Object.values(world.information))
    fn.mockReset().mockResolvedValue(success({ id: SECTION, version: 2 }));
});

describe("signing up for a slot", () => {
  it("signs the family up with the duty and its version, then goes back to the row with a message", async () => {
    await expect(
      animalSignUpAction(
        initial,
        form({ id: DUTY, expectedVersion: "3", anchor: "slot-2027-04-12-morning" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(world.parentFacade.signUp).toHaveBeenCalledWith(
      { roles: ["parent"] },
      { familyScope, familyId: "family-1", dutyId: DUTY, expectedVersion: 3, idempotencyKey: KEY },
    );
    expect(world.redirected).toEqual(["/szulo/allatok?uzenet=jelentkezes#slot-2027-04-12-morning"]);
    expect(world.revalidated).toContain("/szulo/allatok");
  });

  it("drops an anchor that is not a plain id and refuses a bad form before the database", async () => {
    await expect(
      animalSignUpAction(initial, form({ id: DUTY, expectedVersion: "1", anchor: 'x"><b' })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(world.redirected).toEqual(["/szulo/allatok?uzenet=jelentkezes"]);
    for (const bad of <Record<string, string>[]>[
      { id: "x", expectedVersion: "1" },
      { id: DUTY, expectedVersion: "0" },
      { id: DUTY, expectedVersion: "1", idempotencyKey: "k" },
    ]) {
      expect(await animalSignUpAction(initial, form(bad))).toMatchObject({ state: "validation" });
    }
    expect(world.parentFacade.signUp).toHaveBeenCalledTimes(1);
  });

  it("refuses a signed-out person or a missing facade, and shows a refusal as a sentence", async () => {
    world.parent = { state: "signed-out" };
    expect(
      await animalSignUpAction(initial, form({ id: DUTY, expectedVersion: "1" })),
    ).toMatchObject({ state: "denied" });
    world.parent = parentSession;
    world.parentFacadeOn = false;
    expect(
      await animalSignUpAction(initial, form({ id: DUTY, expectedVersion: "1" })),
    ).toMatchObject({ state: "denied" });
    world.parentFacadeOn = true;
    world.parentFacade.signUp.mockResolvedValue(conflict("DUTY_FULL"));
    expect(
      await animalSignUpAction(initial, form({ id: DUTY, expectedVersion: "1" })),
    ).toMatchObject({
      state: "conflict",
      message: "Már foglalt.",
    });
  });
});

describe("giving a slot up", () => {
  it("sends the place and its version with the family scope and goes back with a message", async () => {
    await expect(
      giveUpAction(initial, form({ placeId: PLACE, expectedVersion: "2" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(world.animal.giveUp).toHaveBeenCalledWith(
      { roles: ["parent"] },
      { scope: familyScope, idempotencyKey: KEY, placeId: PLACE, expectedVersion: 2 },
    );
    expect(world.redirected).toEqual(["/szulo/allatok?uzenet=lemondas"]);
  });

  it("reads the 24-hour refusal as its own sentence and a missing person or facade as denied", async () => {
    world.animal.giveUp.mockResolvedValue(conflict("SLOT_GIVE_UP_TOO_LATE"));
    const late = await giveUpAction(initial, form({ placeId: PLACE, expectedVersion: "2" }));
    expect(late).toMatchObject({ state: "conflict" });
    expect(late.message).toContain("24 óránál");
    expect(
      await giveUpAction(initial, form({ placeId: "no", expectedVersion: "2" })),
    ).toMatchObject({ state: "validation" });
    world.parent = { state: "denied" };
    expect(
      await giveUpAction(initial, form({ placeId: PLACE, expectedVersion: "2" })),
    ).toMatchObject({ state: "denied" });
    world.parent = parentSession;
    world.animalOn = false;
    expect(
      await giveUpAction(initial, form({ placeId: PLACE, expectedVersion: "2" })),
    ).toMatchObject({ state: "denied" });
  });
});

describe("the school year's settings", () => {
  const base = {
    schoolYearId: YEAR,
    morningStart: "07:30",
    afternoonStart: "15:00",
    expectedVersion: "0",
  };

  it("saves the times with version 0 for a first save and sends the alert group only when it is an id", async () => {
    expect(await saveCalendarAction(initial, form({ ...base, careGroupId: GROUP }))).toMatchObject({
      state: "success",
      message: "A beállítások mentve.",
    });
    expect(world.animal.saveCalendar).toHaveBeenCalledWith(
      { roles: ["super_admin"] },
      {
        scope: orgScope,
        idempotencyKey: KEY,
        schoolYearId: YEAR,
        morningStart: "07:30",
        afternoonStart: "15:00",
        careGroupId: GROUP,
        expectedVersion: 0,
      },
    );
    await saveCalendarAction(initial, form({ ...base, careGroupId: "" }));
    expect(world.animal.saveCalendar.mock.calls[1]?.[1]).not.toHaveProperty("careGroupId");
    expect(world.revalidated).toContain("/admin/allatgondozas");
  });

  it("refuses times that are not hours and minutes, a bad version and a person who is not an admin", async () => {
    expect(await saveCalendarAction(initial, form({ ...base, morningStart: "7:3" }))).toMatchObject(
      { state: "validation" },
    );
    expect(
      await saveCalendarAction(initial, form({ ...base, expectedVersion: "-1" })),
    ).toMatchObject({ state: "validation" });
    expect(await saveCalendarAction(initial, form({ ...base, schoolYearId: "x" }))).toMatchObject({
      state: "validation",
    });
    world.admin = { state: "denied" };
    expect(await saveCalendarAction(initial, form(base))).toMatchObject({ state: "denied" });
    expect(world.animal.saveCalendar).not.toHaveBeenCalled();
  });

  it("creates the slots and says how many were added, or that none were", async () => {
    world.animal.createSlots.mockResolvedValue(success({ id: YEAR, version: 1, added: 42 }));
    expect(await createSlotsAction(initial, form({ schoolYearId: YEAR }))).toMatchObject({
      state: "success",
      message: "42 időpont létrejött.",
    });
    world.animal.createSlots.mockResolvedValue(success({ id: YEAR, version: 1, added: 0 }));
    expect((await createSlotsAction(initial, form({ schoolYearId: YEAR }))).message).toBe(
      "Nem jött létre új időpont.",
    );
    world.animal.createSlots.mockResolvedValue(denied());
    expect(await createSlotsAction(initial, form({ schoolYearId: YEAR }))).toMatchObject({
      state: "denied",
    });
    expect(world.revalidated).toContain("/szulo/allatok");
  });
});

describe("saving and hiding a section", () => {
  it("adds a section with its months, owner and order, and ends on the page", async () => {
    await expect(
      saveSectionAction(
        initial,
        form({ title: " Új ", body: "Szöveg", owningGroupName: "Állatgondozás", position: "7" }, [
          ["seasonMonth", "3"],
          ["seasonMonth", "4"],
        ]),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(world.information.create).toHaveBeenCalledWith(
      { roles: ["super_admin"] },
      {
        scope: orgScope,
        idempotencyKey: KEY,
        title: "Új",
        body: "Szöveg",
        position: 7,
        owningGroupName: "Állatgondozás",
        seasonMonths: [3, 4],
      },
    );
    expect(world.redirected).toEqual(["/informacio"]);
  });

  it("changes a section with its version and refuses a bad id, version, order, key or person", async () => {
    await expect(
      saveSectionAction(
        initial,
        form({ sectionId: SECTION, expectedVersion: "4", title: "C", body: "B" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(world.information.update).toHaveBeenCalledWith(
      { roles: ["super_admin"] },
      {
        scope: orgScope,
        idempotencyKey: KEY,
        title: "C",
        body: "B",
        position: 0,
        sectionId: SECTION,
        expectedVersion: 4,
      },
    );
    for (const bad of <Record<string, string>[]>[
      { sectionId: "x", expectedVersion: "1" },
      { sectionId: SECTION, expectedVersion: "0" },
      { position: "1.5" },
      { idempotencyKey: "k" },
    ]) {
      expect(
        await saveSectionAction(initial, form({ title: "C", body: "B", ...bad })),
      ).toMatchObject({ state: "validation" });
    }
    world.info = undefined;
    expect(await saveSectionAction(initial, form({ title: "C", body: "B" }))).toMatchObject({
      state: "denied",
    });
    world.info = infoActor;
    world.informationOn = false;
    expect(await saveSectionAction(initial, form({ title: "C", body: "B" }))).toMatchObject({
      state: "denied",
    });
  });

  it("shows a refused text as a sentence and not as a code", async () => {
    world.information.create.mockResolvedValue(
      validation({ body: "INFO_TEXT_INVALID" }, "INFO_TEXT_INVALID"),
    );
    const state = await saveSectionAction(initial, form({ title: "C", body: "[x](javascript:1)" }));
    expect(state).toMatchObject({ state: "validation" });
    expect(state.message).toContain("hivatkozás");
  });

  it("hides and restores a section with its version", async () => {
    expect(
      await setHiddenAction(
        initial,
        form({ sectionId: SECTION, expectedVersion: "2", hidden: "true" }),
      ),
    ).toMatchObject({
      state: "success",
      message: "A szakasz el van rejtve.",
    });
    expect(
      (
        await setHiddenAction(
          initial,
          form({ sectionId: SECTION, expectedVersion: "2", hidden: "false" }),
        )
      ).message,
    ).toBe("A szakasz újra látszik.");
    expect(world.information.setHidden).toHaveBeenLastCalledWith(
      { roles: ["super_admin"] },
      {
        scope: orgScope,
        idempotencyKey: KEY,
        sectionId: SECTION,
        hidden: false,
        expectedVersion: 2,
      },
    );
    expect(
      await setHiddenAction(initial, form({ sectionId: "x", expectedVersion: "2" })),
    ).toMatchObject({ state: "validation" });
    expect(world.revalidated).toContain("/informacio");
  });
});

describe("the words of a refusal", () => {
  it("never shows a raw code and keeps a retry and a stale page apart", () => {
    expect(mapAnimalResult(terminalFailure(), "")).toMatchObject({ state: "terminal" });
    expect(mapAnimalResult({ state: "invalidated", code: "X" } as never, "")).toMatchObject({
      state: "invalidated",
    });
    expect(
      mapAnimalResult(
        {
          state: "dependency-failure-retryable",
          code: "X",
          retry: { idempotencyKey: "k", action: "a" },
        } as never,
        "",
      ),
    ).toMatchObject({ state: "retryable", retry: { idempotencyKey: "k" } });
    expect(
      mapAnimalResult({ state: "recovery", code: "R", data: {} } as never, "Kész."),
    ).toMatchObject({ state: "success", message: "Kész." });
    expect(mapAnimalResult(denied(), "")).toMatchObject({ state: "denied" });
  });
});
