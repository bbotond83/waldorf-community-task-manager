import { beforeEach, describe, expect, it, vi } from "vitest";
import { conflict, denied, success, validation } from "../../src/application/index.ts";

const OCC = "11111111-1111-4111-8111-111111111111";
const SCHED = "22222222-2222-4222-8222-222222222222";
const GROUP = "33333333-3333-4333-8333-333333333333";
const OTHER_GROUP = "44444444-4444-4444-8444-444444444444";
const KEY = "recurring-test:abcdef0123";
const familyScope = { id: "family-1", type: "family", organizationId: "org" };
const orgScope = { id: "org", type: "organization", organizationId: "org" };

const world = vi.hoisted(() => ({
  parent: undefined as unknown,
  manager: undefined as unknown,
  facadeOn: true,
  recurring: {
    saveSchedule: vi.fn(),
    setActive: vi.fn(),
    markDone: vi.fn(),
    undoDone: vi.fn(),
    skip: vi.fn(),
  },
  revalidated: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => world.revalidated.push(path) }));
vi.mock("../../app/_recurring/actor.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../app/_recurring/actor.ts")>()),
  resolveRecurringParent: async () => world.parent,
  resolveRecurringManager: async () => world.manager,
}));
vi.mock("../../app/_recurring/facade.ts", () => ({
  resolveRecurringFacade: async () => (world.facadeOn ? world.recurring : undefined),
}));

import {
  markDoneAction,
  saveScheduleAction,
  setScheduleActiveAction,
  skipOccurrenceAction,
  undoDoneAction,
} from "../../app/_recurring/actions.ts";

const initial = { state: "initial" } as const;

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries({ idempotencyKey: KEY, ...values })) {
    data.set(key, value);
  }
  return data;
}

const parent = { session: { roles: ["parent"] }, scope: familyScope };
const groupManager = {
  session: { roles: ["group_admin"] },
  isSuperAdmin: false,
  scopeFor: (groupId?: string) =>
    groupId === GROUP ? { id: GROUP, type: "group", organizationId: "org" } : undefined,
};
const superManager = {
  session: { roles: ["super_admin"] },
  isSuperAdmin: true,
  scopeFor: () => orgScope,
};

const SAVE = {
  title: " Komposztálás ",
  category: " kert ",
  ownerKind: "group",
  workingGroupId: GROUP,
  intervalCount: "6",
  startDate: "2026-09-07",
};

beforeEach(() => {
  world.parent = parent;
  world.manager = undefined;
  world.facadeOn = true;
  world.revalidated.length = 0;
  for (const fn of Object.values(world.recurring)) {
    fn.mockReset().mockResolvedValue(success({ id: OCC, version: 2 }));
  }
});

describe("the boundary shared by every recurring action", () => {
  it("refuses a bad key, a missing facade and a signed-out person before the database", async () => {
    expect(
      await markDoneAction(
        initial,
        form({ idempotencyKey: "x", occurrenceId: OCC, expectedVersion: "1" }),
      ),
    ).toMatchObject({ state: "validation" });
    world.facadeOn = false;
    expect(
      await markDoneAction(initial, form({ occurrenceId: OCC, expectedVersion: "1" })),
    ).toMatchObject({
      state: "denied",
      message: "Ezt a műveletet nem végezheted el.",
    });
    world.facadeOn = true;
    world.parent = undefined;
    expect(
      await markDoneAction(initial, form({ occurrenceId: OCC, expectedVersion: "1" })),
    ).toMatchObject({
      state: "denied",
    });
    expect(world.recurring.markDone).not.toHaveBeenCalled();
  });
});

describe("marking a duty done", () => {
  it("sends the family scope, the id and the version, and refreshes the pages", async () => {
    const result = await markDoneAction(
      initial,
      form({ occurrenceId: OCC, expectedVersion: "3", groupId: GROUP }),
    );
    expect(result).toMatchObject({ state: "success", message: "Késznek jelölted." });
    expect(world.recurring.markDone).toHaveBeenCalledWith(parent.session, {
      scope: familyScope,
      idempotencyKey: KEY,
      occurrenceId: OCC,
      expectedVersion: 3,
    });
    expect(world.revalidated).toContain("/szulo/ismetlodo");
    expect(world.revalidated).toContain(`/teacher/munkacsoportok/${GROUP}/ismetlodo`);
  });

  it("refuses an address or a version that is not valid without asking the database", async () => {
    const cases: Record<string, string>[] = [
      { occurrenceId: "nope", expectedVersion: "1" },
      { occurrenceId: OCC, expectedVersion: "0" },
      { occurrenceId: OCC, expectedVersion: "x" },
      { occurrenceId: OCC },
    ];
    for (const values of cases) {
      expect(await markDoneAction(initial, form(values))).toMatchObject({ state: "validation" });
    }
    expect(world.recurring.markDone).not.toHaveBeenCalled();
  });

  it("shows each conflict in Hungarian words, never its code, and refreshes nothing", async () => {
    for (const [code, words] of [
      ["RECURRING_CLOSED", "Ez az ismétlődő feladat már le van zárva."],
      ["VERSION_CONFLICT", "Közben valaki módosította, töltsd újra."],
    ] as const) {
      world.recurring.markDone.mockResolvedValue(conflict(code));
      const result = await markDoneAction(
        initial,
        form({ occurrenceId: OCC, expectedVersion: "1" }),
      );
      expect(result).toMatchObject({ state: "conflict", message: words, code });
    }
    expect(world.revalidated).toEqual([]);
  });

  it("reads a denied answer as the general refusal", async () => {
    world.recurring.markDone.mockResolvedValue(denied());
    expect(
      await markDoneAction(initial, form({ occurrenceId: OCC, expectedVersion: "1" })),
    ).toMatchObject({
      state: "denied",
      message: "Ezt a műveletet nem végezheted el.",
    });
  });
});

describe("undoing a done mark", () => {
  it("acts as the group's coordinator when the form names their group", async () => {
    world.manager = groupManager;
    await undoDoneAction(
      initial,
      form({ occurrenceId: OCC, expectedVersion: "2", groupId: GROUP }),
    );
    expect(world.recurring.undoDone).toHaveBeenCalledWith(groupManager.session, {
      scope: { id: GROUP, type: "group", organizationId: "org" },
      idempotencyKey: KEY,
      occurrenceId: OCC,
      expectedVersion: 2,
    });
  });

  it("acts as the parent when the person is no coordinator of that group, and says the undo is too late", async () => {
    world.manager = groupManager;
    world.recurring.undoDone.mockResolvedValue(conflict("RECURRING_UNDO_TOO_LATE"));
    const result = await undoDoneAction(
      initial,
      form({ occurrenceId: OCC, expectedVersion: "2", groupId: OTHER_GROUP }),
    );
    expect(world.recurring.undoDone).toHaveBeenCalledWith(
      parent.session,
      expect.objectContaining({ scope: familyScope }),
    );
    expect(result).toMatchObject({
      state: "conflict",
      message: "A kész jelölés már nem vonható vissza, mert több mint egy napja történt.",
    });
  });

  it("is refused when the person is neither", async () => {
    world.parent = undefined;
    expect(
      await undoDoneAction(initial, form({ occurrenceId: OCC, expectedVersion: "2" })),
    ).toMatchObject({
      state: "denied",
    });
    expect(world.recurring.undoDone).not.toHaveBeenCalled();
  });

  it("refuses an invalid address or version", async () => {
    expect(
      await undoDoneAction(initial, form({ occurrenceId: "nope", expectedVersion: "1" })),
    ).toMatchObject({
      state: "validation",
    });
  });
});

describe("skipping an occurrence", () => {
  it("is a coordinator's or super admin's and sends the trimmed reason", async () => {
    world.manager = groupManager;
    const result = await skipOccurrenceAction(
      initial,
      form({ occurrenceId: OCC, expectedVersion: "1", groupId: GROUP, reason: "  Havazás " }),
    );
    expect(result).toMatchObject({ state: "success", message: "Kihagytad." });
    expect(world.recurring.skip).toHaveBeenCalledWith(groupManager.session, {
      scope: { id: GROUP, type: "group", organizationId: "org" },
      idempotencyKey: KEY,
      occurrenceId: OCC,
      expectedVersion: 1,
      reason: "Havazás",
    });
  });

  it("is refused for a parent and for a coordinator of another group, before the database", async () => {
    expect(
      await skipOccurrenceAction(
        initial,
        form({ occurrenceId: OCC, expectedVersion: "1", reason: "x" }),
      ),
    ).toMatchObject({ state: "denied" });
    world.manager = groupManager;
    expect(
      await skipOccurrenceAction(
        initial,
        form({ occurrenceId: OCC, expectedVersion: "1", groupId: OTHER_GROUP, reason: "x" }),
      ),
    ).toMatchObject({ state: "denied" });
    expect(world.recurring.skip).not.toHaveBeenCalled();
  });

  it("shows a missing reason next to the reason field", async () => {
    world.manager = superManager;
    world.recurring.skip.mockResolvedValue(validation({ reason: "VAL-INVALID" }));
    const result = await skipOccurrenceAction(
      initial,
      form({ occurrenceId: OCC, expectedVersion: "1", reason: " " }),
    );
    expect(result).toMatchObject({
      state: "validation",
      message: "Ellenőrizd a megadott adatokat.",
      fieldErrors: { reason: "Adj meg egy indoklást, legfeljebb 200 karakterrel." },
    });
  });
});

describe("saving a schedule", () => {
  it("adds a group schedule with trimmed fields, in the scope of the coordinator's group", async () => {
    world.manager = groupManager;
    const result = await saveScheduleAction(
      initial,
      form({ ...SAVE, seasonFromMonth: "4", seasonToMonth: "10" }),
    );
    expect(result).toMatchObject({ state: "success", message: "A feladat mentve." });
    expect(world.recurring.saveSchedule).toHaveBeenCalledWith(groupManager.session, {
      scope: { id: GROUP, type: "group", organizationId: "org" },
      idempotencyKey: KEY,
      title: "Komposztálás",
      category: "kert",
      ownerKind: "group",
      workingGroupId: GROUP,
      intervalCount: 6,
      startDate: "2026-09-07",
      seasonFromMonth: 4,
      seasonToMonth: 10,
    });
    expect(world.revalidated).toContain(`/szulo/munkacsoportok/${GROUP}/ismetlodo`);
  });

  it("changes a schedule with its id and version, and sends a rota job only when it is a known one", async () => {
    world.manager = superManager;
    await saveScheduleAction(
      initial,
      form({
        ...SAVE,
        ownerKind: "rota_week",
        workingGroupId: "",
        rotaJob: "water_carrying",
        scheduleId: SCHED,
        expectedVersion: "4",
      }),
    );
    expect(world.recurring.saveSchedule).toHaveBeenCalledWith(
      superManager.session,
      expect.objectContaining({
        scope: orgScope,
        scheduleId: SCHED,
        expectedVersion: 4,
        rotaJob: "water_carrying",
      }),
    );
    world.recurring.saveSchedule.mockClear();
    await saveScheduleAction(
      initial,
      form({ ...SAVE, ownerKind: "rota_week", rotaJob: "made_up" }),
    );
    expect(world.recurring.saveSchedule.mock.calls[0]?.[1]).not.toHaveProperty("rotaJob");
  });

  it("says the bottle interval applies to future water weeks when a rota-week schedule is saved", async () => {
    world.manager = superManager;
    const result = await saveScheduleAction(
      initial,
      form({ ...SAVE, ownerKind: "rota_week", workingGroupId: "", rotaJob: "water_carrying" }),
    );
    expect(result).toMatchObject({
      state: "success",
      message: "Elmentve. A beállítás a jövőbeli vízhordó hetekre érvényes.",
    });
  });

  it("refuses a family or rota owner for a coordinator, and any save for a parent, before the database", async () => {
    world.manager = groupManager;
    expect(
      await saveScheduleAction(initial, form({ ...SAVE, ownerKind: "family", workingGroupId: "" })),
    ).toMatchObject({ state: "denied" });
    world.manager = undefined;
    expect(await saveScheduleAction(initial, form(SAVE))).toMatchObject({ state: "denied" });
    expect(world.recurring.saveSchedule).not.toHaveBeenCalled();
  });

  it("refuses a malformed form with the entry to correct", async () => {
    world.manager = groupManager;
    const cases: [Record<string, string>, string][] = [
      [{ intervalCount: "" }, "interval"],
      [{ intervalCount: "x" }, "interval"],
      [{ startDate: "07/09/2026" }, "startDate"],
      [{ seasonFromMonth: "abc" }, "season"],
    ];
    for (const [change, field] of cases) {
      const result = await saveScheduleAction(initial, form({ ...SAVE, ...change }));
      expect(result).toMatchObject({ state: "validation" });
      expect(Object.keys(result.fieldErrors ?? {})).toEqual([field]);
    }
    expect(await saveScheduleAction(initial, form({ ...SAVE, ownerKind: "elnok" }))).toMatchObject({
      state: "validation",
      code: "VAL-INVALID",
    });
    expect(await saveScheduleAction(initial, form({ ...SAVE, scheduleId: SCHED }))).toMatchObject({
      state: "validation",
      code: "VAL-INVALID",
    });
    expect(
      await saveScheduleAction(
        initial,
        form({ ...SAVE, scheduleId: "nope", expectedVersion: "1" }),
      ),
    ).toMatchObject({
      state: "validation",
    });
    expect(world.recurring.saveSchedule).not.toHaveBeenCalled();
  });

  it("shows the database's field refusals in words", async () => {
    world.manager = groupManager;
    world.recurring.saveSchedule.mockResolvedValue(
      validation({ title: "VAL-INVALID", owner: "VAL-CANNOT-CHANGE" }),
    );
    const result = await saveScheduleAction(initial, form(SAVE));
    expect(result.fieldErrors).toEqual({
      title: "Adj meg egy címet, legfeljebb 200 karakterrel.",
      owner: "A feladat felelőse utólag nem módosítható.",
    });
  });
});

describe("switching a schedule on or off", () => {
  it("sends the choice and the version in the coordinator's group scope", async () => {
    world.manager = groupManager;
    const result = await setScheduleActiveAction(
      initial,
      form({ scheduleId: SCHED, expectedVersion: "2", active: "false", groupId: GROUP }),
    );
    expect(result).toMatchObject({ state: "success", message: "A feladat ki van kapcsolva." });
    expect(world.recurring.setActive).toHaveBeenCalledWith(groupManager.session, {
      scope: { id: GROUP, type: "group", organizationId: "org" },
      idempotencyKey: KEY,
      scheduleId: SCHED,
      expectedVersion: 2,
      active: false,
    });
    expect(
      await setScheduleActiveAction(
        initial,
        form({ scheduleId: SCHED, expectedVersion: "3", active: "true", groupId: GROUP }),
      ),
    ).toMatchObject({ message: "A feladat be van kapcsolva." });
  });

  it("refuses a bad choice, version or address, and a person who is no manager", async () => {
    world.manager = groupManager;
    for (const values of [
      { scheduleId: SCHED, expectedVersion: "2", active: "maybe" },
      { scheduleId: SCHED, expectedVersion: "0", active: "true" },
      { scheduleId: "nope", expectedVersion: "2", active: "true" },
    ]) {
      expect(await setScheduleActiveAction(initial, form(values))).toMatchObject({
        state: "validation",
      });
    }
    world.manager = undefined;
    expect(
      await setScheduleActiveAction(
        initial,
        form({ scheduleId: SCHED, expectedVersion: "2", active: "true" }),
      ),
    ).toMatchObject({ state: "denied" });
    expect(world.recurring.setActive).not.toHaveBeenCalled();
  });
});

describe("the other states of an answer", () => {
  it("maps invalidated, retryable and terminal answers", async () => {
    world.recurring.markDone.mockResolvedValue({ state: "invalidated" });
    expect(
      await markDoneAction(initial, form({ occurrenceId: OCC, expectedVersion: "1" })),
    ).toMatchObject({
      state: "invalidated",
    });
    world.recurring.markDone.mockResolvedValue({
      state: "dependency-failure-retryable",
      retry: { idempotencyKey: KEY, action: "markDone" },
    });
    expect(
      await markDoneAction(initial, form({ occurrenceId: OCC, expectedVersion: "1" })),
    ).toMatchObject({
      state: "retryable",
      retry: { idempotencyKey: KEY },
    });
    world.recurring.markDone.mockResolvedValue({ state: "dependency-failure-terminal" });
    expect(
      await markDoneAction(initial, form({ occurrenceId: OCC, expectedVersion: "1" })),
    ).toMatchObject({
      state: "terminal",
    });
    world.recurring.markDone.mockResolvedValue(validation({ x: "VAL-INVALID" }, "bad"));
    expect(
      await markDoneAction(initial, form({ occurrenceId: OCC, expectedVersion: "1" })),
    ).toMatchObject({
      state: "validation",
    });
  });
});
