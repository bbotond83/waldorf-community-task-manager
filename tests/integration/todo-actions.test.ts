import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  conflict,
  denied,
  invalidated,
  success,
  terminalFailure,
  validation,
} from "../../src/application/index.ts";

const TASK = "11111111-1111-4111-8111-111111111111";
const EVENT = "22222222-2222-4222-8222-222222222222";
const GROUP = "33333333-3333-4333-8333-333333333333";
const OTHER_GROUP = "44444444-4444-4444-8444-444444444444";
const KEY = "todo-test:abcdef0123";
const familyScope = { id: "family-1", type: "family", organizationId: "org" };
const orgScope = { id: "org", type: "organization", organizationId: "org" };

const world = vi.hoisted(() => ({
  parent: undefined as unknown,
  manager: undefined as unknown,
  facadeOn: true,
  todo: {
    save: vi.fn(),
    claim: vi.fn(),
    giveBack: vi.fn(),
    freeClaim: vi.fn(),
    update: vi.fn(),
    markDone: vi.fn(),
    undoDone: vi.fn(),
    pullToEvent: vi.fn(),
  },
  revalidated: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => world.revalidated.push(path) }));
vi.mock("../../app/_todo/actor.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../app/_todo/actor.ts")>()),
  resolveTodoParent: async () => world.parent,
  resolveTodoManager: async () => world.manager,
}));
vi.mock("../../app/_todo/facade.ts", () => ({
  resolveTodoFacade: async () => (world.facadeOn ? world.todo : undefined),
}));

import {
  claimTodoAction,
  freeTodoClaimAction,
  giveBackTodoAction,
  markTodoDoneAction,
  pullTodosAction,
  saveTodoAction,
  undoTodoDoneAction,
  updateTodoAction,
} from "../../app/_todo/actions.ts";

const initial = { state: "initial" } as const;

function form(values: Record<string, string>, extra: [string, string][] = []): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries({ idempotencyKey: KEY, ...values })) {
    data.set(key, value);
  }
  for (const [key, value] of extra) data.append(key, value);
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
  topic: " Kerítésjavítás ",
  priority: "2",
  description: " Az északi oldal ",
  status: "open",
  deadline: "2026-12-20",
  ownerGroupId: GROUP,
};

beforeEach(() => {
  world.parent = parent;
  world.manager = undefined;
  world.facadeOn = true;
  world.revalidated.length = 0;
  for (const fn of Object.values(world.todo)) {
    fn.mockReset().mockResolvedValue(success({ id: TASK, version: 2 }));
  }
  world.todo.pullToEvent.mockResolvedValue(
    success({ eventId: EVENT, added: 2, alreadyOnList: 1, claimantsCarried: 0 }),
  );
});

describe("the boundary shared by the task buttons", () => {
  it("refuses a bad key, a missing facade and a signed-out person before the database", async () => {
    expect(
      await claimTodoAction(
        initial,
        form({ idempotencyKey: "x", taskId: TASK, expectedVersion: "1" }),
      ),
    ).toMatchObject({ state: "validation" });
    world.facadeOn = false;
    expect(
      await claimTodoAction(initial, form({ taskId: TASK, expectedVersion: "1" })),
    ).toMatchObject({ state: "denied", message: "Ezt a műveletet nem végezheted el." });
    world.facadeOn = true;
    world.parent = undefined;
    expect(
      await claimTodoAction(initial, form({ taskId: TASK, expectedVersion: "1" })),
    ).toMatchObject({ state: "denied" });
    expect(world.todo.claim).not.toHaveBeenCalled();
  });

  it("refuses an address or a version that is not valid without asking the database", async () => {
    const cases: Record<string, string>[] = [
      { taskId: "nope", expectedVersion: "1" },
      { taskId: TASK, expectedVersion: "0" },
      { taskId: TASK },
    ];
    for (const values of cases) {
      for (const action of [
        claimTodoAction,
        giveBackTodoAction,
        markTodoDoneAction,
        undoTodoDoneAction,
        freeTodoClaimAction,
        updateTodoAction,
      ]) {
        expect(await action(initial, form(values))).toMatchObject({ state: "validation" });
      }
    }
    expect(world.todo.claim).not.toHaveBeenCalled();
    expect(world.todo.freeClaim).not.toHaveBeenCalled();
  });
});

describe("claiming, giving back, finishing and undoing", () => {
  it("sends the family scope, the id and the version, and refreshes the pages", async () => {
    const values = { taskId: TASK, expectedVersion: "3" };
    const expected = { scope: familyScope, idempotencyKey: KEY, taskId: TASK, expectedVersion: 3 };
    expect(await claimTodoAction(initial, form(values))).toMatchObject({
      state: "success",
      message: "Vállaltad a teendőt.",
    });
    expect(world.todo.claim).toHaveBeenCalledWith(parent.session, expected);
    expect(await giveBackTodoAction(initial, form(values))).toMatchObject({
      message: "Visszaadtad a teendőt.",
    });
    expect(world.todo.giveBack).toHaveBeenCalledWith(parent.session, expected);
    expect(await markTodoDoneAction(initial, form(values))).toMatchObject({
      message: "Késznek jelölted.",
    });
    expect(world.todo.markDone).toHaveBeenCalledWith(parent.session, expected);
    expect(await undoTodoDoneAction(initial, form(values))).toMatchObject({
      message: "A kész jelölés visszavonva.",
    });
    expect(world.todo.undoDone).toHaveBeenCalledWith(parent.session, expected);
    expect(world.revalidated).toContain("/szulo/feladataim");
    expect(world.revalidated).toContain("/szulo/teendok");
  });

  it("acts as a super admin with the community scope when the person has no family", async () => {
    world.parent = undefined;
    world.manager = superManager;
    await markTodoDoneAction(initial, form({ taskId: TASK, expectedVersion: "1" }));
    expect(world.todo.markDone).toHaveBeenCalledWith(
      superManager.session,
      expect.objectContaining({ scope: orgScope }),
    );
    world.manager = groupManager;
    expect(
      await markTodoDoneAction(initial, form({ taskId: TASK, expectedVersion: "1" })),
    ).toMatchObject({ state: "denied" });
  });

  it("shows each conflict in Hungarian words, never its code, and refreshes nothing", async () => {
    for (const [code, words] of [
      ["TODO_CLAIMED", "Ezt a feladatot közben valaki más vállalta."],
      ["VERSION_CONFLICT", "Közben valaki módosította, töltsd újra."],
    ] as const) {
      world.todo.claim.mockResolvedValue(conflict(code));
      const result = await claimTodoAction(initial, form({ taskId: TASK, expectedVersion: "1" }));
      expect(result).toMatchObject({ state: "conflict", message: words, code });
    }
    expect(world.revalidated).toEqual([]);
  });

  it("maps denied, invalidated, retryable and terminal answers to plain sentences", async () => {
    const values = { taskId: TASK, expectedVersion: "1" };
    world.todo.claim.mockResolvedValue(denied());
    expect(await claimTodoAction(initial, form(values))).toMatchObject({ state: "denied" });
    world.todo.claim.mockResolvedValue(invalidated());
    expect(await claimTodoAction(initial, form(values))).toMatchObject({ state: "invalidated" });
    world.todo.claim.mockResolvedValue(terminalFailure());
    expect(await claimTodoAction(initial, form(values))).toMatchObject({ state: "terminal" });
    world.todo.claim.mockResolvedValue({
      state: "dependency-failure-retryable",
      code: "X",
      retry: { idempotencyKey: KEY, action: "claim" },
    });
    expect(await claimTodoAction(initial, form(values))).toMatchObject({
      state: "retryable",
      retry: { idempotencyKey: KEY },
    });
  });
});

describe("changing the status or the note", () => {
  it("sends the chosen status and the trimmed note", async () => {
    await updateTodoAction(
      initial,
      form({ taskId: TASK, expectedVersion: "2", status: "postponed", note: " Esik az eső " }),
    );
    expect(world.todo.update).toHaveBeenCalledWith(parent.session, {
      scope: familyScope,
      idempotencyKey: KEY,
      taskId: TASK,
      expectedVersion: 2,
      status: "postponed",
      note: "Esik az eső",
    });
  });

  it("sends only the note when no status is chosen and refuses a status that does not exist", async () => {
    await updateTodoAction(initial, form({ taskId: TASK, expectedVersion: "2", note: "" }));
    expect(world.todo.update).toHaveBeenCalledWith(parent.session, {
      scope: familyScope,
      idempotencyKey: KEY,
      taskId: TASK,
      expectedVersion: 2,
      note: "",
    });
    expect(
      await updateTodoAction(
        initial,
        form({ taskId: TASK, expectedVersion: "2", status: "bogus" }),
      ),
    ).toMatchObject({ state: "validation" });
  });
});

describe("freeing a claim", () => {
  it("acts as the group's coordinator for the group the form names", async () => {
    world.manager = groupManager;
    expect(
      await freeTodoClaimAction(
        initial,
        form({ taskId: TASK, expectedVersion: "2", groupId: GROUP }),
      ),
    ).toMatchObject({ state: "success", message: "A teendő újra szabad." });
    expect(world.todo.freeClaim).toHaveBeenCalledWith(groupManager.session, {
      scope: { id: GROUP, type: "group", organizationId: "org" },
      idempotencyKey: KEY,
      taskId: TASK,
      expectedVersion: 2,
    });
    expect(world.revalidated).toContain(`/szulo/munkacsoportok/${GROUP}/kezeles`);
  });

  it("refuses a coordinator of another group and a person who is no manager", async () => {
    world.manager = groupManager;
    expect(
      await freeTodoClaimAction(
        initial,
        form({ taskId: TASK, expectedVersion: "2", groupId: OTHER_GROUP }),
      ),
    ).toMatchObject({ state: "denied" });
    world.manager = undefined;
    expect(
      await freeTodoClaimAction(
        initial,
        form({ taskId: TASK, expectedVersion: "2", groupId: GROUP }),
      ),
    ).toMatchObject({ state: "denied" });
    expect(world.todo.freeClaim).not.toHaveBeenCalled();
  });
});

describe("saving a task", () => {
  it("adds a group's task as its coordinator, trimming the entries", async () => {
    world.manager = groupManager;
    const result = await saveTodoAction(initial, form(SAVE));
    expect(result).toMatchObject({ state: "success", message: "A teendő mentve." });
    expect(world.todo.save).toHaveBeenCalledWith(groupManager.session, {
      scope: { id: GROUP, type: "group", organizationId: "org" },
      idempotencyKey: KEY,
      topic: "Kerítésjavítás",
      priority: 2,
      description: "Az északi oldal",
      status: "open",
      deadline: "2026-12-20",
      ownerGroupId: GROUP,
    });
    expect(world.revalidated).toContain("/admin/teendok");
  });

  it("changes a task with its id and version, and lets a super admin keep a family's task", async () => {
    world.manager = superManager;
    await saveTodoAction(
      initial,
      form({
        topic: "Veteményes",
        taskId: TASK,
        expectedVersion: "4",
        ownerFamilyId: OTHER_GROUP,
        notBefore: "2026-12-01",
      }),
    );
    expect(world.todo.save).toHaveBeenCalledWith(superManager.session, {
      scope: orgScope,
      idempotencyKey: KEY,
      topic: "Veteményes",
      taskId: TASK,
      expectedVersion: 4,
      ownerFamilyId: OTHER_GROUP,
      notBefore: "2026-12-01",
    });
  });

  it("hands a task to another family: the new family alone names the owner, kept with the version the screen saw", async () => {
    world.manager = superManager;
    await saveTodoAction(
      initial,
      form({
        topic: "Veteményes",
        taskId: TASK,
        expectedVersion: "4",
        ownerFamilyId: GROUP,
        ownerGroupId: OTHER_GROUP,
        newOwnerFamilyId: EVENT,
      }),
    );
    expect(world.todo.save).toHaveBeenCalledWith(superManager.session, {
      scope: orgScope,
      idempotencyKey: KEY,
      topic: "Veteményes",
      taskId: TASK,
      expectedVersion: 4,
      ownerFamilyId: EVENT,
    });
    // An empty choice ("Nem változik") or a made-up identifier leaves the owner the form carried.
    world.todo.save.mockClear();
    for (const newOwnerFamilyId of ["", "nem-azonosito"]) {
      await saveTodoAction(
        initial,
        form({
          topic: "Veteményes",
          taskId: TASK,
          expectedVersion: "4",
          ownerFamilyId: GROUP,
          newOwnerFamilyId,
        }),
      );
    }
    expect(world.todo.save).toHaveBeenLastCalledWith(
      superManager.session,
      expect.objectContaining({ ownerFamilyId: GROUP }),
    );
  });

  it("refuses a hand-over by a coordinator before the database, and passes a stale version on as a conflict", async () => {
    world.manager = groupManager;
    expect(
      await saveTodoAction(
        initial,
        form({ topic: "Veteményes", taskId: TASK, expectedVersion: "4", newOwnerFamilyId: EVENT }),
      ),
    ).toMatchObject({ state: "denied" });
    expect(world.todo.save).not.toHaveBeenCalled();
    world.manager = superManager;
    world.todo.save.mockResolvedValue(conflict("VERSION_CONFLICT"));
    expect(
      await saveTodoAction(
        initial,
        form({ topic: "Veteményes", taskId: TASK, expectedVersion: "1", newOwnerFamilyId: EVENT }),
      ),
    ).toMatchObject({ state: "conflict", message: "Közben valaki módosította, töltsd újra." });
  });

  it("refuses a coordinator of another group and a person who is no manager", async () => {
    world.manager = groupManager;
    expect(
      await saveTodoAction(initial, form({ ...SAVE, ownerGroupId: OTHER_GROUP })),
    ).toMatchObject({ state: "denied" });
    expect(await saveTodoAction(initial, form({ topic: "Valami" }))).toMatchObject({
      state: "denied",
    });
    world.manager = undefined;
    expect(await saveTodoAction(initial, form(SAVE))).toMatchObject({ state: "denied" });
    expect(world.todo.save).not.toHaveBeenCalled();
  });

  it("refuses a shape that cannot be right, naming the entry to correct", async () => {
    world.manager = groupManager;
    for (const [values, field] of [
      [{ priority: "x" }, "priority"],
      [{ notBefore: "holnap" }, "notBefore"],
      [{ deadline: "2026/12/01" }, "deadline"],
      [{ status: "kész" }, "status"],
    ] as const) {
      const result = await saveTodoAction(initial, form({ ...SAVE, ...values }));
      expect(result).toMatchObject({ state: "validation" });
      expect(result.fieldErrors).toHaveProperty(field);
    }
    expect(await saveTodoAction(initial, form({ ...SAVE, taskId: TASK }))).toMatchObject({
      state: "validation",
      code: "VAL-INVALID",
    });
    expect(world.todo.save).not.toHaveBeenCalled();
  });

  it("shows a refused field as its own sentence and a version clash as a conflict", async () => {
    world.manager = groupManager;
    world.todo.save.mockResolvedValue(validation({ topic: "VAL-REQUIRED" }));
    const refused = await saveTodoAction(initial, form(SAVE));
    expect(refused).toMatchObject({
      state: "validation",
      message: "Ellenőrizd a megadott adatokat.",
      fieldErrors: { topic: "Adj meg egy témát, legfeljebb 200 karakterrel." },
    });
    world.todo.save.mockResolvedValue(validation({}, "status_not_allowed"));
    expect(await saveTodoAction(initial, form(SAVE))).toMatchObject({
      state: "validation",
      message: "Ez az állapot most nem választható ehhez a feladathoz.",
    });
    world.todo.save.mockResolvedValue(conflict("VERSION_CONFLICT"));
    expect(
      await saveTodoAction(initial, form({ ...SAVE, taskId: TASK, expectedVersion: "1" })),
    ).toMatchObject({ state: "conflict", message: "Közben valaki módosította, töltsd újra." });
  });
});

describe("adding tasks to an event", () => {
  it("sends the chosen tasks with their versions and says how many were added", async () => {
    world.manager = groupManager;
    const result = await pullTodosAction(
      initial,
      form({ eventId: EVENT, groupId: GROUP }, [
        ["task", `${TASK}:3`],
        ["task", "nope:1"],
        ["task", `${OTHER_GROUP}:x`],
      ]),
    );
    expect(result).toMatchObject({
      state: "success",
      message: "2 teendő hozzáadva. 1 már a listán volt.",
    });
    expect(world.todo.pullToEvent).toHaveBeenCalledWith(groupManager.session, {
      scope: { id: GROUP, type: "group", organizationId: "org" },
      idempotencyKey: KEY,
      eventId: EVENT,
      tasks: [{ taskId: TASK, expectedVersion: 3 }],
    });
    expect(world.revalidated).toContain(`/szulo/esemenyek/${EVENT}`);
  });

  it("says only the count when nothing was on the list already", async () => {
    world.manager = superManager;
    world.todo.pullToEvent.mockResolvedValue(
      success({ eventId: EVENT, added: 1, alreadyOnList: 0, claimantsCarried: 0 }),
    );
    expect(
      await pullTodosAction(initial, form({ eventId: EVENT }, [["task", `${TASK}:1`]])),
    ).toMatchObject({ message: "1 teendő hozzáadva." });
  });

  it("refuses a bad event, another group's coordinator and an empty choice", async () => {
    world.manager = groupManager;
    expect(await pullTodosAction(initial, form({ eventId: "x" }))).toMatchObject({
      state: "validation",
    });
    expect(
      await pullTodosAction(initial, form({ eventId: EVENT, groupId: OTHER_GROUP })),
    ).toMatchObject({ state: "denied" });
    world.todo.pullToEvent.mockResolvedValue(validation({ tasks: "VAL-REQUIRED" }));
    expect(await pullTodosAction(initial, form({ eventId: EVENT, groupId: GROUP }))).toMatchObject({
      state: "validation",
      fieldErrors: { tasks: "Válassz ki egy és ötven közötti feladatot." },
    });
    world.todo.pullToEvent.mockResolvedValue(conflict("EVENT_CLOSED"));
    expect(
      await pullTodosAction(
        initial,
        form({ eventId: EVENT, groupId: GROUP }, [["task", `${TASK}:1`]]),
      ),
    ).toMatchObject({
      state: "conflict",
      message: "Ez az esemény már le van zárva, nem vehető fel rá feladat.",
    });
  });
});
