import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  conflict,
  denied,
  success,
  validation,
  type EventDetailModel,
  type EventListModel,
} from "../../src/application/index.ts";

const OFFER = "55555555-5555-4555-8555-555555555555";
const OTHER_OFFER = "55555555-5555-4555-8555-555555555556";
const EVENT = "11111111-1111-4111-8111-111111111111";

const world = vi.hoisted(() => ({
  signedIn: true,
  detail: undefined as unknown,
  list: undefined as unknown,
  facade: {
    changeOffer: vi.fn(),
    detail: vi.fn(),
    list: vi.fn(),
    listForGroup: vi.fn(),
  },
  revalidated: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => world.revalidated.push(path) }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../../app/_events/facade.ts", () => ({
  resolveEventFacade: async () => (world.signedIn ? world.facade : undefined),
}));
vi.mock("../../app/admin/_lib/facade.ts", () => ({ resolveAdminFacade: async () => undefined }));
vi.mock("../../app/admin/_lib/session.ts", () => ({
  resolveAdminSession: async () => ({ state: "signed-out" }),
}));
vi.mock("../../app/teacher/_lib/session.ts", () => ({
  resolveTeacherSession: async () => ({ state: "signed-out" }),
}));
vi.mock("../../app/teacher/_lib/facade.ts", () => ({
  resolveWorkingGroupFacade: async () => undefined,
}));
vi.mock("../../app/szulo/_lib/facade.ts", () => ({
  resolveDirectoryFacade: async () => undefined,
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

import { changeOfferAction } from "../../app/_events/actions.ts";
import { OfferChangeForm } from "../../app/_events/EventForms.tsx";
import { EventDetailScreen, EventListScreen } from "../../app/_events/EventScreens.tsx";

const initial = { state: "initial" } as const;
const KEY = "offer-change:55555555:v2:abcdef0123";

function form(values: Record<string, string> = {}): FormData {
  const data = new FormData();
  const base = {
    area: "szulo",
    idempotencyKey: KEY,
    eventId: EVENT,
    offerId: OFFER,
    expectedVersion: "2",
    category: "sweet",
    text: "Mézes puszedli",
    hasMilk: "on",
  };
  for (const [key, value] of Object.entries({ ...base, ...values })) data.set(key, value);
  for (const [key, value] of Object.entries(values)) if (value === "") data.delete(key);
  return data;
}

const offer = (id: string, isOwn: boolean) => ({
  id,
  parentDisplayName: "Minta Anna",
  text: "Puszedli",
  hasMilk: true,
  hasEgg: false,
  hasGarlic: true,
  version: 2,
  isOwn,
});

const detail = (overrides: { isOpen?: boolean } = {}): EventDetailModel => ({
  event: {
    id: EVENT,
    title: "Őszi vásár",
    startsAt: "2026-12-05T09:00:00Z",
    endsAt: "2026-12-05T15:00:00Z",
    status: "planned",
    isFinished: false,
    isOpen: overrides.isOpen ?? true,
    isSummer: false,
    foodSignupOn: true,
    version: 3,
  },
  notices: [],
  roles: [],
  signups: [],
  food: {
    on: true,
    categories: [{ category: "sweet", offers: [offer(OFFER, true), offer(OTHER_OFFER, false)] }],
  },
  caller: { canManage: false, canSignUp: true },
});

beforeEach(() => {
  world.signedIn = true;
  world.revalidated.length = 0;
  world.facade.changeOffer.mockReset().mockResolvedValue(success({ id: OFFER, version: 3 }));
  world.facade.detail.mockReset().mockImplementation(async () => success(world.detail));
  world.facade.list.mockReset().mockImplementation(async () => success(world.list));
  world.detail = detail();
});

describe("changeOfferAction", () => {
  it("sends the changed offer with the version the screen showed and refreshes the event page", async () => {
    const state = await changeOfferAction(initial, form());
    expect(state).toMatchObject({ state: "success", message: "Az ételfelajánlást módosítottuk." });
    expect(world.facade.changeOffer).toHaveBeenCalledWith(
      { subjectId: "parent" },
      {
        scope: { id: "family-1", type: "family", organizationId: "org" },
        idempotencyKey: KEY,
        offerId: OFFER,
        expectedVersion: 2,
        category: "sweet",
        text: "Mézes puszedli",
        hasMilk: true,
        hasEgg: false,
        hasGarlic: false,
      },
    );
    expect(world.revalidated).toContain(`/szulo/esemenyek/${EVENT}`);
  });

  it("refuses an empty dish and an unknown category next to the field, without asking the database", async () => {
    const noText = await changeOfferAction(initial, form({ text: "   " }));
    expect(noText.state).toBe("validation");
    expect(noText.fieldErrors?.text).toContain("Add meg");
    const noCategory = await changeOfferAction(initial, form({ category: "sushi" }));
    expect(noCategory.fieldErrors?.category).toBe("Válassz kategóriát.");
    expect(world.facade.changeOffer).not.toHaveBeenCalled();
  });

  it("refuses a made-up identifier, a bad version or key, and a signed-out caller", async () => {
    const bads: Record<string, string>[] = [
      { offerId: "x" },
      { expectedVersion: "0" },
      { idempotencyKey: "kurta" },
    ];
    for (const bad of bads) {
      expect((await changeOfferAction(initial, form(bad))).state).toBe("validation");
    }
    world.signedIn = false;
    expect(await changeOfferAction(initial, form())).toMatchObject({ state: "denied" });
    expect(world.facade.changeOffer).not.toHaveBeenCalled();
  });

  it("shows a version conflict, a closed event and a refusal in Hungarian, never a code", async () => {
    world.facade.changeOffer.mockResolvedValueOnce(conflict("VERSION_CONFLICT"));
    expect(await changeOfferAction(initial, form())).toMatchObject({
      state: "conflict",
      message: "Az oldal közben megváltozott. Frissítsd, és próbáld újra.",
    });
    world.facade.changeOffer.mockResolvedValueOnce(conflict("EVENT_CLOSED"));
    expect(await changeOfferAction(initial, form())).toMatchObject({
      state: "conflict",
      message: "Erre az eseményre már lezárult a jelentkezés.",
    });
    world.facade.changeOffer.mockResolvedValueOnce(denied());
    expect(await changeOfferAction(initial, form())).toMatchObject({
      state: "denied",
      message: "Ez az esemény nem érhető el.",
    });
    world.facade.changeOffer.mockResolvedValueOnce(validation({ text: "VAL-INVALID" }));
    expect((await changeOfferAction(initial, form())).fieldErrors).toEqual({
      text: "Érvénytelen érték.",
    });
    expect(world.revalidated).toEqual([]);
  });
});

describe("the offer change form", () => {
  const model = detail().food.categories[0]!.offers[0]!;

  it("starts from the offer: its category, text and ticks, and carries the version it was shown", () => {
    render(<OfferChangeForm area="szulo" eventId={EVENT} category="sweet" offer={model} />);
    expect(screen.getByTestId(`event-offer-change-category-select-${OFFER}`)).toHaveValue("sweet");
    expect(screen.getByTestId(`event-offer-change-text-${OFFER}`)).toHaveValue("Puszedli");
    expect(screen.getByTestId(`event-offer-change-hasMilk-${OFFER}`)).toBeChecked();
    expect(screen.getByTestId(`event-offer-change-hasEgg-${OFFER}`)).not.toBeChecked();
    expect(screen.getByTestId(`event-offer-change-hasGarlic-${OFFER}`)).toBeChecked();
    expect(screen.getByRole("group", { name: /Allergének/ })).toBeInTheDocument();
    expect(document.querySelector('input[name="expectedVersion"]')).toHaveValue("2");
  });

  it("sends the form and shows the confirmation from the action", async () => {
    render(<OfferChangeForm area="szulo" eventId={EVENT} category="sweet" offer={model} />);
    fireEvent.change(screen.getByTestId(`event-offer-change-text-${OFFER}`), {
      target: { value: "Almás rétes" },
    });
    fireEvent.click(screen.getByTestId(`event-offer-change-${OFFER}-submit-button`));
    await waitFor(() => expect(world.facade.changeOffer).toHaveBeenCalled());
    expect(world.facade.changeOffer.mock.calls[0]![1]).toMatchObject({
      offerId: OFFER,
      text: "Almás rétes",
      hasMilk: true,
      hasGarlic: true,
    });
    expect(
      await screen.findByTestId(`event-offer-change-${OFFER}-state-success`),
    ).toHaveTextContent("Az ételfelajánlást módosítottuk.");
  });
});

describe("the event page and the list", () => {
  const actor = {
    area: "szulo",
    basePath: "/szulo/esemenyek",
    session: {},
    scope: {},
  } as never;

  it("offers the change form on the parent's own offer of an open event only", async () => {
    const open = renderToStaticMarkup(await EventDetailScreen({ actor, eventId: EVENT }));
    expect(open).toContain(`event-offer-edit-${OFFER}`);
    expect(open).not.toContain(`event-offer-edit-${OTHER_OFFER}`);
    world.detail = detail({ isOpen: false });
    const closed = renderToStaticMarkup(await EventDetailScreen({ actor, eventId: EVENT }));
    expect(closed).not.toContain("event-offer-edit-");
    // Withdrawing an own offer stays possible on a closed event.
    expect(closed).toContain(`event-offer-withdraw-${OFFER}`);
  });

  it("shows the sign-up count line and the green badge on the list", async () => {
    const base = {
      title: "Őszi vásár",
      startsAt: "2026-12-05T09:00:00Z",
      endsAt: "2026-12-05T15:00:00Z",
      status: "planned",
      isFinished: false,
    } as const;
    const list: EventListModel = {
      items: [
        { ...base, id: "e-1", signupCount: 34, isSignedUp: true },
        { ...base, id: "e-2", signupCount: 0, isSignedUp: false },
      ],
      canManageCommunity: false,
      managedGroupIds: [],
    };
    world.list = list;
    const html = renderToStaticMarkup(await EventListScreen({ actor, past: false }));
    expect(html).toContain("34 jelentkező");
    expect(html).toContain("0 jelentkező");
    expect(html).toContain('data-testid="event-signed-up-e-1"');
    expect(html).not.toContain('data-testid="event-signed-up-e-2"');
  });
});
