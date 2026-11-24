import { beforeEach, describe, expect, it, vi } from "vitest";
import { conflict, denied, success, validation } from "../../src/application/index.ts";

const EVENT = "11111111-1111-4111-8111-111111111111";
const GROUP = "22222222-2222-4222-8222-222222222222";
const SIGNUP = "33333333-3333-4333-8333-333333333333";
const ROLE = "44444444-4444-4444-8444-444444444444";
const OFFER = "55555555-5555-4555-8555-555555555555";
const PARENT = "66666666-6666-4666-8666-666666666666";
const KEY = "event-test:abcdef0123";

const familyScope = { id: "family-1", type: "family", organizationId: "org" };
const groupScope = { id: GROUP, type: "group", organizationId: "org" };

const world = vi.hoisted(() => ({
  actor: undefined as unknown,
  facadeOn: true,
  adminOn: true,
  events: {
    addSignup: vi.fn(),
    changeSignup: vi.fn(),
    withdrawSignup: vi.fn(),
    addOffer: vi.fn(),
    withdrawOffer: vi.fn(),
    saveNotices: vi.fn(),
    saveTale: vi.fn(),
    saveRole: vi.fn(),
    removeRole: vi.fn(),
  },
  admin: { saveTaskOrEvent: vi.fn() },
  checklists: { copyTemplate: vi.fn() },
  checklistsOn: true,
  revalidated: [] as string[],
  redirected: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => world.revalidated.push(path) }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => world.redirected.push(path),
}));
vi.mock("../../app/_events/actor.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../app/_events/actor.ts")>()),
  resolveEventActor: async () => world.actor,
}));
vi.mock("../../app/_events/facade.ts", () => ({
  resolveEventFacade: async () => (world.facadeOn ? world.events : undefined),
}));
vi.mock("../../app/_checklists/facade.ts", () => ({
  resolveChecklistFacade: async () => (world.checklistsOn ? world.checklists : undefined),
}));
vi.mock("../../app/admin/_lib/facade.ts", () => ({
  resolveAdminFacade: async () => (world.adminOn ? world.admin : undefined),
}));

import {
  addOfferAction,
  addSignupAction,
  cancelEventAction,
  changeSignupAction,
  removeRoleAction,
  saveEventAction,
  saveNoticesAction,
  saveRoleAction,
  saveTaleAction,
  withdrawOfferAction,
  withdrawSignupAction,
} from "../../app/_events/actions.ts";

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
  session: {
    grants: [{ role: "group_admin", scope: groupScope, revokedAt: undefined }],
  },
};

beforeEach(() => {
  world.actor = parentActor;
  world.facadeOn = true;
  world.adminOn = true;
  world.checklistsOn = true;
  world.checklists.copyTemplate.mockReset().mockResolvedValue(success({ id: EVENT, version: 1 }));
  world.revalidated.length = 0;
  world.redirected.length = 0;
  for (const fn of [...Object.values(world.events), world.admin.saveTaskOrEvent]) {
    fn.mockReset().mockResolvedValue(success({ id: EVENT, version: 2 }));
  }
});

describe("the boundary shared by every event action", () => {
  it("refuses a wrong area, a bad key, a signed-out person and a missing facade without calling the database", async () => {
    expect(await addSignupAction(initial, form({ area: "elnok", eventId: EVENT }))).toMatchObject({
      state: "validation",
    });
    expect(
      await addSignupAction(initial, form({ idempotencyKey: "x", eventId: EVENT })),
    ).toMatchObject({ state: "validation" });
    world.actor = undefined;
    expect(await addSignupAction(initial, form({ eventId: EVENT }))).toMatchObject({
      state: "denied",
      message: "Ez az esemény nem érhető el.",
    });
    world.actor = parentActor;
    world.facadeOn = false;
    expect((await addSignupAction(initial, form({ eventId: EVENT }))).state).toBe("denied");
    expect(world.events.addSignup).not.toHaveBeenCalled();
  });
});

describe("sign-ups", () => {
  it("signs a parent up with a trimmed note and a time inside the event, and refreshes the pages", async () => {
    const state = await addSignupAction(
      initial,
      form({ eventId: EVENT, note: "  Hozok takarót ", chosenAt: "2026-12-05T10:30" }),
    );
    expect(state).toMatchObject({ state: "success", message: "Jelentkezésedet rögzítettük." });
    const sent = world.events.addSignup.mock.calls[0]![1];
    expect(sent).toMatchObject({ scope: familyScope, eventId: EVENT, note: "Hozok takarót" });
    expect(sent.chosenAt).toMatch(/^2026-12-05T09:30/);
    expect(world.revalidated).toContain(`/szulo/esemenyek/${EVENT}`);
    expect(world.revalidated).toContain("/admin/esemenyek");
  });

  it("sends no note when it is blank and refuses an unreadable time or event before asking the database", async () => {
    await addSignupAction(initial, form({ eventId: EVENT, note: "   " }));
    expect(world.events.addSignup.mock.calls[0]![1]).not.toHaveProperty("note");
    expect(
      (await addSignupAction(initial, form({ eventId: EVENT, chosenAt: "tegnap" }))).fieldErrors,
    ).toEqual({ chosenAt: "Adj meg érvényes dátumot és időt." });
    expect((await addSignupAction(initial, form({ eventId: "x" }))).state).toBe("validation");
    expect(world.events.addSignup).toHaveBeenCalledTimes(1);
  });

  it("shows a closed event, an outdated screen and a refusal in Hungarian, and refreshes nothing", async () => {
    world.events.addSignup.mockResolvedValueOnce(conflict("EVENT_CLOSED"));
    expect(await addSignupAction(initial, form({ eventId: EVENT }))).toMatchObject({
      state: "conflict",
      message: "Erre az eseményre már lezárult a jelentkezés.",
    });
    world.events.addSignup.mockResolvedValueOnce(denied());
    expect((await addSignupAction(initial, form({ eventId: EVENT }))).state).toBe("denied");
    expect(world.revalidated).toEqual([]);
  });

  it("changes a sign-up with the version shown, and refuses a bad identifier or version", async () => {
    const ok = await changeSignupAction(
      initial,
      form({ eventId: EVENT, signupId: SIGNUP, expectedVersion: "2", note: "Később érkezem" }),
    );
    expect(ok).toMatchObject({ state: "success", message: "A jelentkezést módosítottuk." });
    expect(world.events.changeSignup.mock.calls[0]![1]).toMatchObject({
      signupId: SIGNUP,
      expectedVersion: 2,
      note: "Később érkezem",
    });
    for (const bad of [
      { signupId: "x", expectedVersion: "2" },
      { signupId: SIGNUP, expectedVersion: "0" },
    ]) {
      expect((await changeSignupAction(initial, form({ eventId: EVENT, ...bad }))).state).toBe(
        "validation",
      );
    }
    expect(
      (
        await changeSignupAction(
          initial,
          form({ signupId: SIGNUP, expectedVersion: "2", chosenAt: "rossz" }),
        )
      ).state,
    ).toBe("validation");
  });

  it("withdraws a sign-up as the family, and as a coordinator with the group's own grant", async () => {
    await withdrawSignupAction(
      initial,
      form({ eventId: EVENT, signupId: SIGNUP, expectedVersion: "1" }),
    );
    expect(world.events.withdrawSignup.mock.calls[0]![1]).toMatchObject({
      scope: familyScope,
      asManager: false,
    });
    world.actor = coordinatorActor;
    const state = await withdrawSignupAction(
      initial,
      form({
        eventId: EVENT,
        signupId: SIGNUP,
        expectedVersion: "1",
        asManager: "1",
        groupId: GROUP,
      }),
    );
    expect(state).toMatchObject({ state: "success", message: "A jelentkezést visszavontuk." });
    expect(world.events.withdrawSignup.mock.calls[1]![1]).toMatchObject({
      scope: groupScope,
      asManager: true,
    });
    expect(
      (await withdrawSignupAction(initial, form({ signupId: "x", expectedVersion: "1" }))).state,
    ).toBe("validation");
  });
});

describe("food offers", () => {
  it("offers a dish with its ingredient ticks and refuses an empty dish or an unknown category", async () => {
    const ok = await addOfferAction(
      initial,
      form({ eventId: EVENT, category: "sweet", text: "Almás pite", hasMilk: "on", hasEgg: "on" }),
    );
    expect(ok).toMatchObject({
      state: "success",
      message: "Az ételfelajánlásodat rögzítettük.",
    });
    expect(world.events.addOffer.mock.calls[0]![1]).toMatchObject({
      category: "sweet",
      text: "Almás pite",
      hasMilk: true,
      hasEgg: true,
      hasGarlic: false,
    });
    expect(
      (await addOfferAction(initial, form({ eventId: EVENT, category: "sweet", text: " " })))
        .fieldErrors?.text,
    ).toContain("Add meg");
    expect(
      (await addOfferAction(initial, form({ eventId: EVENT, category: "sushi", text: "Rizs" })))
        .fieldErrors?.category,
    ).toBe("Válassz kategóriát.");
    expect((await addOfferAction(initial, form({ eventId: "x" }))).state).toBe("validation");
    expect(world.events.addOffer).toHaveBeenCalledTimes(1);
  });

  it("withdraws an offer, as the owner or as a manager, and refuses bad input", async () => {
    const ok = await withdrawOfferAction(
      initial,
      form({ eventId: EVENT, offerId: OFFER, expectedVersion: "3" }),
    );
    expect(ok).toMatchObject({ state: "success", message: "Az ételfelajánlást visszavontuk." });
    world.actor = coordinatorActor;
    await withdrawOfferAction(
      initial,
      form({
        eventId: EVENT,
        offerId: OFFER,
        expectedVersion: "3",
        asManager: "1",
        groupId: GROUP,
      }),
    );
    expect(world.events.withdrawOffer.mock.calls[1]![1]).toMatchObject({
      scope: groupScope,
      asManager: true,
    });
    expect(
      (await withdrawOfferAction(initial, form({ offerId: "x", expectedVersion: "3" }))).state,
    ).toBe("validation");
  });
});

describe("saving, cancelling and the notice, tale and role editors", () => {
  const eventFields = {
    extended: "1",
    id: "new",
    title: "Kerti délután",
    groupId: GROUP,
    startsAt: "2026-12-05T10:00",
    endsAt: "2026-12-05T14:00",
    location: "Az óvoda kertje",
    foodSignupOn: "on",
    noticeLeadDays: "7",
    signupDeadline: "2026-12-01",
  };

  beforeEach(() => {
    world.actor = coordinatorActor;
  });

  it("creates an event with the group's grant, then sends the person to its edit page", async () => {
    await saveEventAction(initial, form(eventFields));
    expect(world.admin.saveTaskOrEvent.mock.calls[0]![1]).toMatchObject({
      id: "new",
      scope: groupScope,
      expectedVersion: 1,
      payload: { kind: "event", title: "Kerti délután", foodSignupOn: true, noticeLeadDays: 7 },
    });
    expect(world.redirected).toEqual([`/szulo/esemenyek/${EVENT}/szerkesztes?mentve=uj`]);
  });

  it("copies the chosen template into a new event's list and sends the person to the checklist editor", async () => {
    const TEMPLATE = "77777777-7777-4777-8777-777777777777";
    await saveEventAction(initial, form({ ...eventFields, templateId: TEMPLATE }));
    expect(world.checklists.copyTemplate.mock.calls[0]![1]).toMatchObject({
      scope: groupScope,
      eventId: EVENT,
      templateId: TEMPLATE,
      idempotencyKey: `checklist-copy:${EVENT}`,
    });
    // The real redirect ends the action; the test double lets it run on, so only the first address counts.
    expect(world.redirected[0]).toBe(`/szulo/esemenyek/${EVENT}/feladatlista`);
  });

  it("still opens the checklist editor when the copy is refused or its facade is missing, and ignores a template on a change", async () => {
    const TEMPLATE = "77777777-7777-4777-8777-777777777777";
    world.checklistsOn = false;
    await saveEventAction(initial, form({ ...eventFields, templateId: TEMPLATE }));
    // The real redirect ends the action; the test double lets it run on, so only the first address counts.
    expect(world.redirected[0]).toBe(`/szulo/esemenyek/${EVENT}/feladatlista`);
    world.redirected.length = 0;
    world.checklistsOn = true;
    await saveEventAction(
      initial,
      form({ ...eventFields, id: EVENT, expectedVersion: "4", templateId: TEMPLATE }),
    );
    await saveEventAction(initial, form({ ...eventFields, templateId: "nem-azonosito" }));
    expect(world.checklists.copyTemplate).not.toHaveBeenCalled();
    expect(world.redirected[0]).toContain("mentve=1");
    expect(world.redirected[1]).toContain("mentve=uj");
  });

  it("changes an existing event with its version and refuses a missing title or a bad number", async () => {
    await saveEventAction(
      initial,
      form({ ...eventFields, id: EVENT, expectedVersion: "4", currentGroupId: GROUP }),
    );
    expect(world.admin.saveTaskOrEvent.mock.calls[0]![1]).toMatchObject({
      id: EVENT,
      expectedVersion: 4,
    });
    expect(world.redirected[0]).toContain("mentve=1");
    expect(
      (await saveEventAction(initial, form({ ...eventFields, title: " " }))).fieldErrors,
    ).toEqual({
      title: "A megnevezés megadása kötelező.",
    });
    expect(
      (await saveEventAction(initial, form({ ...eventFields, title: "x".repeat(121) }))).fieldErrors
        ?.title,
    ).toContain("legfeljebb 120");
    expect(
      (await saveEventAction(initial, form({ ...eventFields, noticeLeadDays: "90" }))).fieldErrors,
    ).toHaveProperty("noticeLeadDays");
    expect(
      (await saveEventAction(initial, form({ ...eventFields, signupDeadline: "holnap" })))
        .fieldErrors,
    ).toHaveProperty("signupDeadline");
    expect((await saveEventAction(initial, form({ ...eventFields, id: "x" }))).state).toBe(
      "validation",
    );
    world.adminOn = false;
    expect((await saveEventAction(initial, form(eventFields))).state).toBe("denied");
  });

  it("shows a refused save in Hungarian without redirecting", async () => {
    world.admin.saveTaskOrEvent.mockResolvedValueOnce(validation({ endsAt: "VAL-DATE-RANGE" }));
    const state = await saveEventAction(initial, form(eventFields));
    expect(state.fieldErrors).toEqual({ endsAt: "Érvénytelen időszak." });
    expect(world.redirected).toEqual([]);
  });

  it("cancels an event with the group's grant, and refuses bad input", async () => {
    const ok = await cancelEventAction(
      initial,
      form({ eventId: EVENT, expectedVersion: "3", groupId: GROUP }),
    );
    expect(ok).toMatchObject({ state: "success", message: "Az eseményt lemondtuk." });
    expect(world.admin.saveTaskOrEvent.mock.calls[0]![1]).toMatchObject({
      id: EVENT,
      scope: groupScope,
      payload: { kind: "event", status: "cancelled" },
    });
    expect(world.revalidated).toContain(`/szulo/munkacsoportok/${GROUP}`);
    expect(
      (await cancelEventAction(initial, form({ eventId: "x", expectedVersion: "3" }))).state,
    ).toBe("validation");
    world.adminOn = false;
    expect(
      (await cancelEventAction(initial, form({ eventId: EVENT, expectedVersion: "3" }))).state,
    ).toBe("denied");
  });

  it("saves notices line by line and refuses more than ten or a too long line", async () => {
    await saveNoticesAction(
      initial,
      form({
        eventId: EVENT,
        expectedVersion: "2",
        groupId: GROUP,
        notices: "Egy\n\n  Kettő \r\nHáromra",
      }),
    );
    expect(world.events.saveNotices.mock.calls[0]![1]).toMatchObject({
      notices: ["Egy", "Kettő", "Háromra"],
      scope: groupScope,
    });
    const many = Array.from({ length: 11 }, (_, index) => `sor ${index}`).join("\n");
    expect(
      (
        await saveNoticesAction(
          initial,
          form({ eventId: EVENT, expectedVersion: "2", notices: many }),
        )
      ).fieldErrors?.notices,
    ).toBe("Ennél több elem nem adható meg.");
    expect(
      (
        await saveNoticesAction(
          initial,
          form({ eventId: EVENT, expectedVersion: "2", notices: "x".repeat(301) }),
        )
      ).fieldErrors?.notices,
    ).toContain("300 karakter");
    expect(
      (await saveNoticesAction(initial, form({ eventId: "x", expectedVersion: "2" }))).state,
    ).toBe("validation");
    expect(world.events.saveNotices).toHaveBeenCalledTimes(1);
  });

  it("saves the tale trimmed, and refuses a bad version", async () => {
    const ok = await saveTaleAction(
      initial,
      form({ eventId: EVENT, expectedVersion: "2", tale: "  Volt egyszer egy kert  " }),
    );
    expect(ok).toMatchObject({ state: "success", message: "Az év meséjét mentettük." });
    expect(world.events.saveTale.mock.calls[0]![1]).toMatchObject({
      tale: "Volt egyszer egy kert",
    });
    expect(
      (await saveTaleAction(initial, form({ eventId: EVENT, expectedVersion: "0" }))).state,
    ).toBe("validation");
  });

  it("adds and changes a role held by a parent or by a typed name, and refuses bad input", async () => {
    await saveRoleAction(
      initial,
      form({ eventId: EVENT, name: "Szervező", parentId: PARENT, isOrganiser: "on" }),
    );
    expect(world.events.saveRole.mock.calls[0]![1]).toMatchObject({
      name: "Szervező",
      parentId: PARENT,
      isOrganiser: true,
    });
    expect(world.events.saveRole.mock.calls[0]![1]).not.toHaveProperty("roleId");
    await saveRoleAction(
      initial,
      form({
        eventId: EVENT,
        roleId: ROLE,
        expectedVersion: "2",
        name: "Sütő",
        personName: "Tóth Mária",
      }),
    );
    expect(world.events.saveRole.mock.calls[1]![1]).toMatchObject({
      roleId: ROLE,
      expectedVersion: 2,
      personName: "Tóth Mária",
      isOrganiser: false,
    });
    expect(
      (await saveRoleAction(initial, form({ eventId: EVENT, name: " " }))).fieldErrors,
    ).toEqual({
      name: "A szerep megnevezése kötelező.",
    });
    expect(
      (
        await saveRoleAction(
          initial,
          form({ eventId: EVENT, name: "Sütő", personName: "x".repeat(201) }),
        )
      ).fieldErrors?.personName,
    ).toContain("200");
    expect(
      (await saveRoleAction(initial, form({ eventId: EVENT, roleId: "x", name: "Sütő" }))).state,
    ).toBe("validation");
    expect((await saveRoleAction(initial, form({ eventId: "x", name: "Sütő" }))).state).toBe(
      "validation",
    );
  });

  it("removes a role and refuses a bad identifier", async () => {
    const ok = await removeRoleAction(
      initial,
      form({ eventId: EVENT, roleId: ROLE, expectedVersion: "2" }),
    );
    expect(ok).toMatchObject({ state: "success", message: "A szerepet töröltük." });
    expect(world.events.removeRole.mock.calls[0]![1]).toMatchObject({
      roleId: ROLE,
      expectedVersion: 2,
    });
    expect(
      (await removeRoleAction(initial, form({ roleId: "x", expectedVersion: "2" }))).state,
    ).toBe("validation");
  });

  it("maps an unexpected failure to one calm sentence, never a code", async () => {
    world.events.removeRole.mockResolvedValueOnce({ state: "terminal-failure", code: "BOOM" });
    expect(
      await removeRoleAction(initial, form({ eventId: EVENT, roleId: ROLE, expectedVersion: "2" })),
    ).toMatchObject({ state: "terminal", message: "Hiba történt. Próbáld meg később." });
  });
});
