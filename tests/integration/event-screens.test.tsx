import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  success,
  terminalFailure,
  type EventDetailModel,
  type EventListItem,
  type EventListModel,
} from "../../src/application/index.ts";

const EVENT = "11111111-1111-4111-8111-111111111111";
const GROUP = "22222222-2222-4222-8222-222222222222";
const SIGNUP = "33333333-3333-4333-8333-333333333333";
const OTHER_SIGNUP = "33333333-3333-4333-8333-333333333334";
const ROLE = "44444444-4444-4444-8444-444444444444";

const world = vi.hoisted(() => ({
  facadeOn: true,
  list: undefined as unknown,
  past: undefined as unknown,
  detail: undefined as unknown,
  groupList: undefined as unknown,
  facade: { list: vi.fn(), detail: vi.fn(), listForGroup: vi.fn() },
  groups: { list: vi.fn() },
  directory: { list: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../../app/_events/facade.ts", () => ({
  resolveEventFacade: async () => (world.facadeOn ? world.facade : undefined),
}));
vi.mock("../../app/teacher/_lib/facade.ts", () => ({
  resolveWorkingGroupFacade: async () => world.groups,
}));
vi.mock("../../app/szulo/_lib/facade.ts", () => ({
  resolveDirectoryFacade: async () => world.directory,
}));

import {
  EventDetailScreen,
  EventFormScreen,
  EventListScreen,
  GroupEventsSection,
  loadGroupEvents,
} from "../../app/_events/EventScreens.tsx";
import { PastEventsToggle } from "../../app/_events/EventForms.tsx";

const actorFor = (area: "szulo" | "teacher" | "admin") =>
  ({ area, basePath: `/${area}/esemenyek`, session: {}, scope: {} }) as never;

const base = {
  title: "Őszi vásár",
  startsAt: "2026-12-05T09:00:00Z",
  endsAt: "2026-12-05T15:00:00Z",
  status: "planned",
  isFinished: false,
  signupCount: 3,
  isSignedUp: false,
} as const;

const item = (id: string, over: Partial<EventListItem> = {}): EventListItem => ({
  ...base,
  id,
  ...over,
});

const listOf = (items: EventListItem[], over: Partial<EventListModel> = {}): EventListModel => ({
  items,
  canManageCommunity: false,
  managedGroupIds: [],
  ...over,
});

function detailOf(
  event: Partial<EventDetailModel["event"]> = {},
  over: Partial<EventDetailModel> = {},
): EventDetailModel {
  return {
    event: {
      id: EVENT,
      title: "Őszi vásár",
      startsAt: "2026-12-05T09:00:00Z",
      endsAt: "2026-12-05T15:00:00Z",
      status: "planned",
      isFinished: false,
      isOpen: true,
      isSummer: false,
      foodSignupOn: true,
      version: 3,
      ...event,
    },
    notices: [],
    roles: [],
    signups: [],
    food: { on: true, categories: [] },
    caller: { canManage: false, canSignUp: true },
    ...over,
  };
}

const html = async (node: Promise<React.JSX.Element> | React.JSX.Element) =>
  renderToStaticMarkup(await node);

beforeEach(() => {
  world.facadeOn = true;
  world.list = success(listOf([item("e-1")]));
  world.past = success(listOf([item("e-old", { isFinished: true })]));
  world.detail = success(detailOf());
  world.groupList = success(listOf([item("e-1")]));
  world.facade.list
    .mockReset()
    .mockImplementation(async (_s: unknown, _c: unknown, options?: { past?: boolean }) =>
      options?.past ? world.past : world.list,
    );
  world.facade.detail.mockReset().mockImplementation(async () => world.detail);
  world.facade.listForGroup.mockReset().mockImplementation(async () => world.groupList);
  world.groups.list.mockReset().mockResolvedValue(
    success({
      items: [
        { id: GROUP, name: "Játszókert" },
        { id: "g-2", name: "Karbantartó" },
      ],
    }),
  );
  world.directory.list.mockReset().mockResolvedValue(
    success({
      families: [
        {
          familyName: "Szabó",
          parents: [
            { id: "p-2", fullName: "Szabó Péter" },
            { id: "p-1", fullName: "Szabó Anna" },
          ],
        },
      ],
    }),
  );
});

describe("the event list", () => {
  it("shows each event with its group, count and badges, and links to its page in the area", async () => {
    world.list = success(
      listOf([
        item("e-1", { groupName: "Játszókert", location: "Az óvoda kertje", isSignedUp: true }),
        item("e-2", { status: "cancelled" }),
        item("e-3", { isFinished: true }),
      ]),
    );
    const out = await html(EventListScreen({ actor: actorFor("szulo"), past: false }));
    expect(out).toContain('data-testid="event-list-page"');
    expect(out).toContain("Játszókert");
    expect(out).toContain("Közösségi");
    expect(out).toContain("Az óvoda kertje");
    expect(out).toContain('href="/szulo/esemenyek/e-1"');
    expect(out).toContain('data-testid="event-signed-up-e-1"');
    expect(out).toContain('data-testid="event-cancelled-e-2"');
    expect(out).toContain('data-testid="event-ended-e-3"');
    expect(out).not.toContain('data-testid="event-new-link"');
    expect(out).not.toContain('data-testid="event-earlier"');
  });

  it("offers the new-event link to a manager of the community, of a group or of the shown list, not to a teacher", async () => {
    for (const over of [
      { canManageCommunity: true },
      { managedGroupIds: [GROUP] },
      { canManage: true },
    ]) {
      world.list = success(listOf([item("e-1")], over));
      expect(await html(EventListScreen({ actor: actorFor("admin"), past: false }))).toContain(
        'href="/admin/esemenyek/uj"',
      );
    }
    expect(await html(EventListScreen({ actor: actorFor("teacher"), past: false }))).not.toContain(
      "event-new-link",
    );
  });

  it("says so when there is no coming event, and lists the earlier ones only on request", async () => {
    world.list = success(listOf([]));
    const none = await html(EventListScreen({ actor: actorFor("szulo"), past: false }));
    expect(none).toContain("Nincs közelgő esemény.");
    const withPast = await html(EventListScreen({ actor: actorFor("szulo"), past: true }));
    expect(withPast).toContain('data-testid="event-earlier"');
    expect(withPast).toContain('data-testid="event-card-e-old"');
    world.past = success(listOf([]));
    expect(await html(EventListScreen({ actor: actorFor("szulo"), past: true }))).toContain(
      "Nincs korábbi esemény.",
    );
  });

  it("shows a calm message instead of a list when the events cannot be read", async () => {
    world.list = terminalFailure();
    const failed = await html(EventListScreen({ actor: actorFor("szulo"), past: true }));
    expect(failed).not.toContain('event-list"');
    world.facadeOn = false;
    expect(await html(EventListScreen({ actor: actorFor("szulo"), past: false }))).toContain(
      "event-list-state",
    );
  });

  it("has a past-events switch that is on when asked for and keeps the sent form simple", () => {
    render(<PastEventsToggle action="/szulo/esemenyek" checked />);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });
});

describe("the event page", () => {
  const parentActor = actorFor("szulo");

  it("an open event offers the sign-up form and the food form and shows notices, roles and the tale", async () => {
    world.detail = success(
      detailOf(
        {
          groupName: "Játszókert",
          location: "Kert",
          tale: "Volt egyszer egy kert",
          signupDeadline: "2026-12-01",
        },
        {
          notices: ["Hozzon váltócipőt"],
          roles: [
            {
              id: ROLE,
              name: "Szervező",
              kind: "parent",
              displayName: "Szabó Anna",
              isOrganiser: true,
              version: 1,
            },
            {
              id: "r-2",
              name: "Sütő",
              kind: "typed",
              displayName: "Tóth Mária",
              isOrganiser: false,
              version: 1,
            },
            {
              id: "r-3",
              name: "Pénztár",
              kind: "former",
              displayName: "",
              isOrganiser: false,
              version: 1,
            },
          ],
        },
      ),
    );
    const out = await html(EventDetailScreen({ actor: parentActor, eventId: EVENT }));
    expect(out).toContain("Nyitott esemény");
    expect(out).toContain("Hozzon váltócipőt");
    expect(out).toContain("Szabó Anna");
    expect(out).toContain("Főszervező");
    expect(out).toContain("Tóth Mária");
    expect(out).toContain("Volt egyszer egy kert");
    expect(out).toContain("Jelentkezési határidő");
    expect(out).toContain('data-testid="event-signup-form"');
    expect(out).toContain('data-testid="event-offer-form"');
    expect(out).toContain("Még nincs felajánlás.");
    expect(out).toContain("Még senki nem jelentkezett.");
    expect(out).not.toContain("event-manager-strip");
    expect(out).not.toContain("event-closed-state");
  });

  it("a signed-up parent sees the own sign-up with its note, a change form and a withdraw form", async () => {
    world.detail = success(
      detailOf(
        {},
        {
          signups: [
            {
              id: SIGNUP,
              parentDisplayName: "Szabó Anna",
              familyDisplayName: "Szabó",
              note: "Hozok takarót",
              chosenAt: "2026-12-05T10:00:00Z",
              version: 2,
              isOwn: true,
            },
            {
              id: OTHER_SIGNUP,
              parentDisplayName: "Kiss Katalin",
              familyDisplayName: "Kiss",
              version: 1,
              isOwn: false,
            },
          ],
        },
      ),
    );
    const out = await html(EventDetailScreen({ actor: parentActor, eventId: EVENT }));
    expect(out).toContain(`data-testid="event-own-signup-${SIGNUP}"`);
    expect(out).toContain("Megjegyzés: Hozok takarót");
    expect(out).toContain("Választott időpont");
    expect(out).toContain(`event-signup-change-${SIGNUP}`);
    expect(out).toContain(`event-signup-withdraw-${SIGNUP}`);
    expect(out).toMatch(/aria-label="Jelentkezés (törlése|visszavonása): /);
    expect(out).toContain('data-testid="event-signup-form"');
    expect(out).toContain("Kiss Katalin");
    expect(out).not.toContain(`event-signup-withdraw-${OTHER_SIGNUP}`);
  });

  it("a closed event gives the reason, offers no new sign-up or change, and still allows withdrawing", async () => {
    world.detail = success(
      detailOf(
        { isOpen: false },
        {
          signups: [
            {
              id: SIGNUP,
              parentDisplayName: "Szabó Anna",
              familyDisplayName: "Szabó",
              version: 1,
              isOwn: true,
            },
          ],
        },
      ),
    );
    const out = await html(EventDetailScreen({ actor: parentActor, eventId: EVENT }));
    expect(out).toContain("Lezárt jelentkezés");
    expect(out).toContain("A jelentkezés lezárult.");
    expect(out).not.toContain('data-testid="event-signup-form"');
    expect(out).not.toContain(`event-signup-change-${SIGNUP}`);
    expect(out).toContain(`event-signup-withdraw-${SIGNUP}`);
    expect(out).not.toContain('data-testid="event-offer-form"');
  });

  it("a finished event and a cancelled event say so, strike the time and hide the cancel button", async () => {
    world.detail = success(
      detailOf(
        { isOpen: false, isFinished: true },
        { caller: { canManage: true, canSignUp: true } },
      ),
    );
    const finished = await html(EventDetailScreen({ actor: parentActor, eventId: EVENT }));
    expect(finished).toContain("Véget ért");
    expect(finished).toContain("Az esemény véget ért, új jelentkezés nem lehetséges.");
    expect(finished).toContain("event-edit-link");
    expect(finished).not.toContain("event-cancel-button");
    world.detail = success(
      detailOf(
        { isOpen: false, status: "cancelled" },
        { caller: { canManage: true, canSignUp: true } },
      ),
    );
    const cancelled = await html(EventDetailScreen({ actor: parentActor, eventId: EVENT }));
    expect(cancelled).toContain("Elmarad");
    expect(cancelled).toContain("Az esemény elmarad, új jelentkezés nem lehetséges.");
    expect(cancelled).toContain("parent-event-struck");
    expect(cancelled).not.toContain("event-cancel-button");
  });

  it("a manager gets the strip with the edit link, the cancel button and a withdraw form for others' sign-ups and offers", async () => {
    world.detail = success(
      detailOf(
        { groupId: GROUP },
        {
          caller: { canManage: true, canSignUp: false },
          signups: [
            {
              id: OTHER_SIGNUP,
              parentDisplayName: "Kiss Katalin",
              familyDisplayName: "Kiss",
              version: 1,
              isOwn: false,
            },
          ],
          food: {
            on: true,
            categories: [
              {
                category: "bread",
                offers: [
                  {
                    id: "o-1",
                    parentDisplayName: "Kiss Katalin",
                    text: "Kenyér",
                    hasMilk: false,
                    hasEgg: true,
                    hasGarlic: false,
                    version: 1,
                    isOwn: false,
                  },
                ],
              },
            ],
          },
        },
      ),
    );
    const out = await html(EventDetailScreen({ actor: parentActor, eventId: EVENT }));
    expect(out).toContain('data-testid="event-manager-strip"');
    expect(out).toContain(`href="/szulo/esemenyek/${EVENT}/szerkesztes"`);
    expect(out).toContain("event-cancel-button");
    expect(out).toContain(`event-signup-withdraw-${OTHER_SIGNUP}`);
    expect(out).toContain("event-offer-withdraw-o-1");
    expect(out).toContain("Jelentkezés törlése");
    expect(out).toContain("Tartalmaz: tojás");
    expect(out).not.toContain('data-testid="event-signup-form"');
  });

  it("a teacher reads the page but is told sign-up is in the parent view and gets no manager strip", async () => {
    world.detail = success(detailOf({}, { caller: { canManage: true, canSignUp: false } }));
    const out = await html(EventDetailScreen({ actor: actorFor("teacher"), eventId: EVENT }));
    expect(out).toContain("Jelentkezni a szülői nézetben lehet.");
    expect(out).not.toContain("event-manager-strip");
    expect(out).not.toContain('data-testid="event-signup-form"');
  });

  it("food switched off shows the notice, and an event with no food at all shows no section", async () => {
    world.detail = success(detailOf({}, { food: { on: false, categories: [] } }));
    expect(await html(EventDetailScreen({ actor: parentActor, eventId: EVENT }))).not.toContain(
      'event-food"',
    );
    world.detail = success(
      detailOf(
        {},
        {
          food: {
            on: false,
            categories: [
              {
                category: "sweet",
                offers: [
                  {
                    id: "o-1",
                    parentDisplayName: "Kiss Katalin",
                    text: "Torta",
                    hasMilk: true,
                    hasEgg: false,
                    hasGarlic: false,
                    version: 1,
                    isOwn: false,
                  },
                ],
              },
            ],
          },
        },
      ),
    );
    const out = await html(EventDetailScreen({ actor: parentActor, eventId: EVENT }));
    expect(out).toContain("Ennél az eseménynél új ételfelajánlás már nincs.");
    expect(out).not.toContain('data-testid="event-offer-form"');
  });

  it("an unreadable event shows a calm message in place of the page", async () => {
    world.detail = terminalFailure();
    const out = await html(EventDetailScreen({ actor: parentActor, eventId: EVENT }));
    expect(out).toContain("event-detail");
    expect(out).not.toContain("event-facts");
  });

  it("the cancel button asks for a confirmation and can be called off", () => {
    return import("../../app/_events/EventForms.tsx").then(({ CancelEventPanel }) => {
      render(<CancelEventPanel area="szulo" event={{ id: EVENT, version: 3, groupId: GROUP }} />);
      fireEvent.click(screen.getByTestId("event-cancel-button"));
      expect(screen.getByTestId("event-cancel-confirm")).toBeInTheDocument();
      expect(screen.getByTestId("event-cancel-form-submit-button")).toBeInTheDocument();
      fireEvent.click(screen.getByTestId("event-cancel-abort"));
      expect(screen.getByTestId("event-cancel-button")).toBeInTheDocument();
    });
  });
});

describe("the event form", () => {
  const manager = (over: Partial<EventListModel> = {}) =>
    success(listOf([], { canManageCommunity: true, managedGroupIds: [GROUP], ...over }));

  it("a new event shows only the basic fields, the groups the person manages and the hint", async () => {
    world.list = manager({ canManageCommunity: false });
    const out = await html(EventFormScreen({ actor: actorFor("szulo") }));
    expect(out).toContain("Új esemény");
    expect(out).toContain('data-testid="event-core-form"');
    expect(out).not.toContain("Egész közösség");
    expect(out).toContain("Játszókert");
    expect(out).not.toContain("Karbantartó");
    expect(out).toContain("az esemény mentése után");
    expect(out).not.toContain("event-notices-form");
  });

  it("puts the preset group first", async () => {
    world.list = manager();
    const out = await html(EventFormScreen({ actor: actorFor("szulo"), presetGroupId: GROUP }));
    expect(out.indexOf("Játszókert")).toBeLessThan(out.indexOf("Egész közösség"));
  });

  it("refuses a person who manages nothing", async () => {
    world.list = success(listOf([]));
    const out = await html(EventFormScreen({ actor: actorFor("szulo") }));
    expect(out).toContain("Ezt az eseményt nem kezelheted.");
    expect(out).not.toContain("event-core-form");
  });

  it("an edit page shows the notices, role and tale editors with the saved message and sorted parents", async () => {
    world.detail = success(
      detailOf(
        { tale: "Mese", groupId: GROUP },
        {
          caller: { canManage: true, canSignUp: false },
          notices: ["Egy", "Kettő"],
          roles: [
            {
              id: ROLE,
              name: "Szervező",
              kind: "parent",
              displayName: "Szabó Anna",
              parentId: "p-1",
              isOrganiser: true,
              version: 2,
            },
          ],
        },
      ),
    );
    const out = await html(
      EventFormScreen({ actor: actorFor("szulo"), eventId: EVENT, saved: "uj" }),
    );
    expect(out).toContain("Esemény szerkesztése");
    expect(out).toContain("Az eseményt létrehoztuk.");
    expect(out).toContain('data-testid="event-notices-form"');
    expect(out).toContain('data-testid="event-tale-form"');
    expect(out).toContain('data-testid="event-role-form-new"');
    expect(out).toContain(`event-role-form-${ROLE}`);
    expect(out).toContain(`event-role-remove-${ROLE}`);
    expect(out.indexOf("Szabó Anna (Szabó)")).toBeLessThan(out.indexOf("Szabó Péter (Szabó)"));
    expect(out).toContain("Egy\nKettő");
    expect(out).toContain(`href="/szulo/esemenyek/${EVENT}"`);
    const savedAgain = await html(
      EventFormScreen({ actor: actorFor("szulo"), eventId: EVENT, saved: "1" }),
    );
    expect(savedAgain).toContain("Az esemény mentése sikerült.");
  });

  it("an edit page of an event the person cannot manage, or cannot read, shows the refusal", async () => {
    world.detail = success(detailOf({}, { caller: { canManage: false, canSignUp: true } }));
    expect(await html(EventFormScreen({ actor: actorFor("szulo"), eventId: EVENT }))).toContain(
      "Ezt az eseményt nem kezelheted.",
    );
    world.detail = terminalFailure();
    expect(await html(EventFormScreen({ actor: actorFor("szulo"), eventId: EVENT }))).toContain(
      "Ezt az eseményt nem kezelheted.",
    );
  });

  it("works without the directory: the role editor then has no parent choices", async () => {
    world.directory.list.mockResolvedValue(terminalFailure());
    world.detail = success(detailOf({}, { caller: { canManage: true, canSignUp: false } }));
    const out = await html(EventFormScreen({ actor: actorFor("admin"), eventId: EVENT }));
    expect(out).toContain("event-role-form-new");
    expect(out).not.toContain("Szabó Anna");
  });
});

describe("the group page section", () => {
  const actor = actorFor("szulo");

  it("lists the group's events with a link to all of them, and a new-event link for a manager", async () => {
    world.groupList = success(
      listOf([item("e-1", { groupName: "Játszókert" })], { canManage: true }),
    );
    const result = await loadGroupEvents(actor, GROUP);
    const out = renderToStaticMarkup(
      <GroupEventsSection actor={actor} groupId={GROUP} result={result} />,
    );
    expect(out).toContain('data-testid="group-events"');
    expect(out).toContain('data-testid="event-card-e-1"');
    expect(out).toContain('data-testid="group-events-all-link"');
    expect(out).toContain(`/szulo/esemenyek/uj`);
    expect(out).toContain('data-testid="group-events-new-link"');
  });

  it("says there is no coming event, shows no new link to an ordinary member, and hides the section when unreadable", async () => {
    world.groupList = success(listOf([]));
    const result = await loadGroupEvents(actor, GROUP);
    const out = renderToStaticMarkup(
      <GroupEventsSection actor={actor} groupId={GROUP} result={result} />,
    );
    expect(out).toContain("Nincs közelgő esemény.");
    expect(out).not.toContain("group-events-new-link");
    world.groupList = terminalFailure();
    const failed = await loadGroupEvents(actor, GROUP);
    expect(
      renderToStaticMarkup(<GroupEventsSection actor={actor} groupId={GROUP} result={failed} />),
    ).toBe("");
    world.facadeOn = false;
    expect((await loadGroupEvents(actor, GROUP)).state).not.toBe("success");
  });
});
