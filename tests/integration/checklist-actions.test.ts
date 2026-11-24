import { beforeEach, describe, expect, it, vi } from "vitest";
import { conflict, denied, success, validation } from "../../src/application/index.ts";

const EVENT = "11111111-1111-4111-8111-111111111111";
const GROUP = "22222222-2222-4222-8222-222222222222";
const TASK = "33333333-3333-4333-8333-333333333333";
const CLAIM = "44444444-4444-4444-8444-444444444444";
const SECTION = "55555555-5555-4555-8555-555555555555";
const TEMPLATE = "66666666-6666-4666-8666-666666666666";
const KEY = "checklist-test:abcdef0123";

const familyScope = { id: "family-1", type: "family", organizationId: "org" };
const groupScope = { id: GROUP, type: "group", organizationId: "org" };

const world = vi.hoisted(() => ({
  actor: undefined as unknown,
  facadeOn: true,
  checklists: {
    claim: vi.fn(),
    withdrawClaim: vi.fn(),
    markDone: vi.fn(),
    undoDone: vi.fn(),
    saveSection: vi.fn(),
    removeSection: vi.fn(),
    saveTask: vi.fn(),
    removeTask: vi.fn(),
    reorder: vi.fn(),
    copyTemplate: vi.fn(),
    saveTemplate: vi.fn(),
    setTemplateRemoved: vi.fn(),
  },
  revalidated: [] as string[],
  redirected: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => world.revalidated.push(path) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => world.redirected.push(path) }));
vi.mock("../../app/_events/actor.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../app/_events/actor.ts")>()),
  resolveEventActor: async () => world.actor,
}));
vi.mock("../../app/_checklists/facade.ts", () => ({
  resolveChecklistFacade: async () => (world.facadeOn ? world.checklists : undefined),
}));

import {
  claimTaskAction,
  copyTemplateAction,
  markTaskDoneAction,
  removeSectionAction,
  removeTaskAction,
  reorderAction,
  saveSectionAction,
  saveTaskAction,
  saveTemplateAction,
  setTemplateRemovedAction,
  undoTaskDoneAction,
  withdrawClaimAction,
} from "../../app/_checklists/actions.ts";

const initial = { state: "initial" } as const;

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  const base = { area: "szulo", idempotencyKey: KEY };
  for (const [key, value] of Object.entries({ ...base, ...values })) data.set(key, value);
  return data;
}

const parentActor = {
  area: "szulo",
  basePath: "/szulo/esemenyek",
  scope: familyScope,
  session: { grants: [] },
};
const coordinatorActor = {
  ...parentActor,
  session: { grants: [{ role: "group_admin", scope: groupScope, revokedAt: undefined }] },
};

beforeEach(() => {
  world.actor = parentActor;
  world.facadeOn = true;
  world.revalidated.length = 0;
  world.redirected.length = 0;
  for (const fn of Object.values(world.checklists)) {
    fn.mockReset().mockResolvedValue(success({ id: TASK, version: 2 }));
  }
});

describe("the boundary shared by every checklist action", () => {
  it("refuses a wrong area, a bad key, a signed-out person and a missing facade without calling the database", async () => {
    expect(await claimTaskAction(initial, form({ area: "elnok", taskId: TASK }))).toMatchObject({
      state: "validation",
    });
    expect(
      await claimTaskAction(initial, form({ idempotencyKey: "x", taskId: TASK })),
    ).toMatchObject({ state: "validation" });
    world.actor = undefined;
    expect(await claimTaskAction(initial, form({ taskId: TASK }))).toMatchObject({
      state: "denied",
    });
    world.actor = parentActor;
    world.facadeOn = false;
    expect((await claimTaskAction(initial, form({ taskId: TASK }))).state).toBe("denied");
    expect(world.checklists.claim).not.toHaveBeenCalled();
  });
});

describe("a parent's own acts", () => {
  it("claims a task in the family's scope and refreshes the event page", async () => {
    const state = await claimTaskAction(initial, form({ taskId: TASK, eventId: EVENT }));
    expect(state).toMatchObject({ state: "success", message: "Elvállaltad a feladatot." });
    expect(world.checklists.claim.mock.calls[0]![1]).toEqual({
      scope: familyScope,
      idempotencyKey: KEY,
      taskId: TASK,
    });
    expect(world.revalidated).toContain(`/szulo/esemenyek/${EVENT}`);
    expect(world.revalidated).toContain(`/admin/esemenyek/${EVENT}/feladatlista`);
  });

  it("answers a full task with its own sentence and refuses a bad task before the database", async () => {
    world.checklists.claim.mockResolvedValue(conflict("TASK_TAKEN"));
    expect(await claimTaskAction(initial, form({ taskId: TASK }))).toMatchObject({
      state: "conflict",
      message: "Közben betelt ez a feladat, nincs több szabad hely.",
    });
    expect((await claimTaskAction(initial, form({ taskId: "x" }))).state).toBe("validation");
    expect(world.checklists.claim).toHaveBeenCalledTimes(1);
    expect(world.revalidated).toEqual([]);
  });

  it("gives a claim back as the owner (family scope) or removes another's as the team (group scope)", async () => {
    world.actor = coordinatorActor;
    await withdrawClaimAction(initial, form({ claimId: CLAIM, expectedVersion: "2" }));
    expect(world.checklists.withdrawClaim.mock.calls[0]![1]).toMatchObject({
      scope: familyScope,
      asManager: false,
      expectedVersion: 2,
    });
    await withdrawClaimAction(
      initial,
      form({ claimId: CLAIM, expectedVersion: "2", asManager: "1", groupId: GROUP }),
    );
    expect(world.checklists.withdrawClaim.mock.calls[1]![1]).toMatchObject({
      scope: groupScope,
      asManager: true,
    });
    expect((await withdrawClaimAction(initial, form({ claimId: CLAIM }))).state).toBe("validation");
  });

  it("marks a task done and takes the mark back, each with the version the screen saw", async () => {
    expect(
      await markTaskDoneAction(initial, form({ taskId: TASK, expectedVersion: "3" })),
    ).toMatchObject({
      message: "Késznek jelölted.",
    });
    expect(
      await undoTaskDoneAction(initial, form({ taskId: TASK, expectedVersion: "4" })),
    ).toMatchObject({
      message: "A kész jelölés visszavonva.",
    });
    expect(world.checklists.markDone.mock.calls[0]![1]).toMatchObject({
      taskId: TASK,
      expectedVersion: 3,
    });
    expect(world.checklists.undoDone.mock.calls[0]![1]).toMatchObject({ expectedVersion: 4 });
    expect((await markTaskDoneAction(initial, form({ taskId: TASK }))).state).toBe("validation");
    world.checklists.markDone.mockResolvedValue(conflict("VERSION_CONFLICT"));
    expect(
      (await markTaskDoneAction(initial, form({ taskId: TASK, expectedVersion: "1" }))).message,
    ).toBe("Közben valaki módosította, töltsd újra.");
  });
});

describe("the organising team's edits", () => {
  it("sends a section and a task with the group's grant and the checklist version", async () => {
    world.actor = coordinatorActor;
    await saveSectionAction(
      initial,
      form({
        eventId: EVENT,
        groupId: GROUP,
        checklistVersion: "3",
        title: "Kert",
        kind: "parents",
      }),
    );
    expect(world.checklists.saveSection.mock.calls[0]![1]).toMatchObject({
      scope: groupScope,
      eventId: EVENT,
      expectedChecklistVersion: 3,
      section: { title: "Kert", kind: "parents" },
    });
    await saveTaskAction(
      initial,
      form({
        eventId: EVENT,
        groupId: GROUP,
        checklistVersion: "3",
        sectionId: SECTION,
        title: "Ásás",
      }),
    );
    expect(world.checklists.saveTask.mock.calls[0]![1]).toMatchObject({
      scope: groupScope,
      task: { section_id: SECTION, title: "Ásás" },
    });
    expect(world.revalidated).toContain(`/szulo/esemenyek/${EVENT}/feladatlista`);
  });

  it("refuses an unreadable section or task, or a missing version, before the database", async () => {
    expect((await saveSectionAction(initial, form({ eventId: EVENT, title: "A" }))).state).toBe(
      "validation",
    );
    expect(
      (await saveSectionAction(initial, form({ eventId: EVENT, checklistVersion: "1", kind: "x" })))
        .state,
    ).toBe("validation");
    expect(
      (await saveTaskAction(initial, form({ eventId: EVENT, checklistVersion: "1", title: "A" })))
        .state,
    ).toBe("validation");
    expect(world.checklists.saveSection).not.toHaveBeenCalled();
    expect(world.checklists.saveTask).not.toHaveBeenCalled();
  });

  it("removes a section and a task and refuses one with a version missing", async () => {
    await removeSectionAction(
      initial,
      form({ sectionId: SECTION, checklistVersion: "2", eventId: EVENT }),
    );
    await removeTaskAction(initial, form({ taskId: TASK, checklistVersion: "2", eventId: EVENT }));
    expect(world.checklists.removeSection.mock.calls[0]![1]).toMatchObject({ sectionId: SECTION });
    expect(world.checklists.removeTask.mock.calls[0]![1]).toMatchObject({ taskId: TASK });
    expect((await removeSectionAction(initial, form({ sectionId: SECTION }))).state).toBe(
      "validation",
    );
    expect((await removeTaskAction(initial, form({ checklistVersion: "2" }))).state).toBe(
      "validation",
    );
    world.checklists.removeTask.mockResolvedValue(conflict("TASK_HAS_CLAIMS"));
    expect(
      (await removeTaskAction(initial, form({ taskId: TASK, checklistVersion: "2" }))).message,
    ).toBe("A feladatot már vállalták, ezért nem törölhető.");
  });

  it("sends a new order and refuses an order that is not a list", async () => {
    const order = [{ section_id: SECTION, task_ids: [TASK] }];
    const state = await reorderAction(
      initial,
      form({ eventId: EVENT, checklistVersion: "2", order: JSON.stringify(order) }),
    );
    expect(state).toMatchObject({ state: "success", message: "A sorrend mentve." });
    expect(world.checklists.reorder.mock.calls[0]![1]).toMatchObject({ order });
    for (const bad of ["{nem json", '{"a":1}']) {
      expect(
        (await reorderAction(initial, form({ eventId: EVENT, checklistVersion: "2", order: bad })))
          .state,
      ).toBe("validation");
    }
    world.checklists.reorder.mockResolvedValue(validation({ order: "sections_differ" }));
    expect(
      (await reorderAction(initial, form({ eventId: EVENT, checklistVersion: "2", order: "[]" })))
        .message,
    ).toContain("töltsd újra");
  });

  it("copies a template into the list and refuses a bad identifier", async () => {
    expect(
      await copyTemplateAction(initial, form({ eventId: EVENT, templateId: TEMPLATE })),
    ).toMatchObject({
      message: "A sablon feladatai bemásolva.",
    });
    expect(world.checklists.copyTemplate.mock.calls[0]![1]).toMatchObject({
      eventId: EVENT,
      templateId: TEMPLATE,
    });
    expect((await copyTemplateAction(initial, form({ eventId: EVENT }))).state).toBe("validation");
    world.checklists.copyTemplate.mockResolvedValue(conflict("CHECKLIST_NOT_EMPTY"));
    expect(
      (await copyTemplateAction(initial, form({ eventId: EVENT, templateId: TEMPLATE }))).message,
    ).toBe("A lista már nem üres, ezért nem másolható bele sablon.");
  });
});

describe("templates", () => {
  const document = JSON.stringify({
    name: "Kerti nap",
    defaultLeadDays: "10",
    sections: [{ title: "Kert", kind: "parents", tasks: [{ title: "Ásás" }] }],
  });

  it("saves a new template and sends the person back to the list", async () => {
    world.actor = coordinatorActor;
    const state = await saveTemplateAction(
      initial,
      form({
        template: document,
        groupId: GROUP,
        backHref: `/szulo/munkacsoportok/${GROUP}/sablonok`,
      }),
    );
    expect(state.state).toBe("success");
    expect(world.checklists.saveTemplate.mock.calls[0]![1]).toMatchObject({
      scope: groupScope,
      template: { name: "Kerti nap", working_group_id: GROUP, default_lead_days: 10 },
    });
    expect(world.redirected).toEqual([`/szulo/munkacsoportok/${GROUP}/sablonok?mentve=1`]);
    expect(world.revalidated).toContain(`/admin/munkacsoportok/${GROUP}/sablonok`);
  });

  it("keeps the person on the editor after changing a template, and does not redirect to a foreign address", async () => {
    await saveTemplateAction(
      initial,
      form({
        template: document,
        templateId: TEMPLATE,
        expectedVersion: "2",
        backHref: "/admin/sablonok",
      }),
    );
    expect(world.redirected).toEqual([]);
    await saveTemplateAction(
      initial,
      form({ template: document, backHref: "https://rossz.example" }),
    );
    expect(world.redirected).toEqual([]);
    expect((await saveTemplateAction(initial, form({ template: "{nem json" }))).state).toBe(
      "validation",
    );
  });

  it("answers a refused save with the database's own sentence", async () => {
    world.checklists.saveTemplate.mockResolvedValue(validation({ name: "name_taken" }));
    expect((await saveTemplateAction(initial, form({ template: document }))).message).toBe(
      "Ilyen nevű sablon már van.",
    );
    world.checklists.saveTemplate.mockResolvedValue(denied());
    expect((await saveTemplateAction(initial, form({ template: document }))).state).toBe("denied");
  });

  it("removes a template from the choice and brings it back", async () => {
    expect(
      await setTemplateRemovedAction(
        initial,
        form({ templateId: TEMPLATE, expectedVersion: "2", removed: "true" }),
      ),
    ).toMatchObject({ message: "A sablon törölve." });
    expect(
      await setTemplateRemovedAction(
        initial,
        form({ templateId: TEMPLATE, expectedVersion: "3", removed: "false" }),
      ),
    ).toMatchObject({ message: "A sablon visszaállítva." });
    expect(world.checklists.setTemplateRemoved.mock.calls[0]![1]).toMatchObject({ removed: true });
    for (const bad of [
      { templateId: TEMPLATE, expectedVersion: "2", removed: "talán" },
      { templateId: TEMPLATE, removed: "true" },
      { expectedVersion: "2", removed: "true" },
    ] as Record<string, string>[]) {
      expect((await setTemplateRemovedAction(initial, form(bad))).state).toBe("validation");
    }
  });
});
