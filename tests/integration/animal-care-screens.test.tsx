import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  success,
  terminalFailure,
  type AnimalCalendarModel,
  type AnimalSlotItem,
  type InfoSectionItem,
} from "../../src/application/index.ts";

const YEAR = "33333333-3333-4333-8333-333333333333";
const DUTY = "11111111-1111-4111-8111-111111111111";
const PLACE = "22222222-2222-4222-8222-222222222222";

const world = vi.hoisted(() => ({
  rotaOn: true,
  animalOn: true,
  informationOn: true,
  rota: { getOverview: vi.fn() },
  animal: { slots: vi.fn(), fairShare: vi.fn(), calendar: vi.fn() },
  information: { list: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("../../app/_identity/rota-facade.ts", () => ({
  resolveRotaFacade: async () => (world.rotaOn ? world.rota : undefined),
}));
vi.mock("../../app/_animal/facade.ts", () => ({
  resolveAnimalCareFacade: async () => (world.animalOn ? world.animal : undefined),
  resolveInformationFacade: async () => (world.informationOn ? world.information : undefined),
}));

import { AnimalCareScreen, AnimalSettingsScreen } from "../../app/_animal/AnimalScreens.tsx";
import { InformationScreen } from "../../app/_info/InformationScreens.tsx";

const slot = (over: Partial<AnimalSlotItem> = {}): AnimalSlotItem => ({
  slotDate: "2027-04-12",
  part: "morning",
  startTime: "07:30",
  dutyId: DUTY,
  dutyVersion: 2,
  mine: false,
  inSwap: false,
  started: false,
  cancelled: false,
  canGiveUp: false,
  mayHold: true,
  ...over,
});

const slotsModel = (slots: AnimalSlotItem[], links = true) => ({
  schoolYearId: YEAR,
  fromDate: "2027-04-12",
  toDate: "2027-04-26",
  slots,
  infoLinksMorning: links ? [{ key: "morning", title: "Reggeli teendők" }] : [],
  infoLinksAfternoon: links
    ? [
        { key: "morning", title: "Reggeli teendők" },
        { key: "afternoon", title: "Délutáni, esti teendők" },
      ]
    : [],
});

const share = {
  average: 4.5,
  mine: { familyName: "Napraforgó család", count: 5, share: 1, activeWeeks: 30, mine: true },
  families: [
    { familyName: "Napraforgó család", count: 5, share: 1, activeWeeks: 30, mine: true },
    { familyName: "Mályva család", count: 4, share: 1, activeWeeks: 30, mine: false },
  ],
};

const view = { session: { roles: ["parent"] } as never, scope: {} as never };
const html = async (node: Promise<unknown>) => renderToStaticMarkup((await node) as never);

beforeEach(() => {
  world.rotaOn = world.animalOn = world.informationOn = true;
  world.rota.getOverview
    .mockReset()
    .mockResolvedValue(success({ schoolYear: { id: YEAR, name: "2026/27" } }));
  world.animal.slots.mockReset().mockResolvedValue(success(slotsModel([slot()])));
  world.animal.fairShare.mockReset().mockResolvedValue(success(share));
  world.animal.calendar.mockReset();
  world.information.list.mockReset();
});

describe("the animal-care sign-up page", () => {
  it("shows the fair share, the days, the info links once each and a sign-up button that names its row", async () => {
    const out = await html(AnimalCareScreen({ ...view, notice: undefined }));
    expect(out).toContain('data-testid="animal-fair-share"');
    expect(out).toContain("Mályva család");
    expect(out).toContain("2027. április 12.");
    expect(out).toContain('data-testid="animal-signup-2027-04-12-morning"');
    expect(out).toContain("Elvállalom: 2027. április 12. reggeli időpont");
    expect(out.match(/href="\/informacio#morning"/g)).toHaveLength(1);
    expect(out).toContain('href="/informacio#afternoon"');
  });

  it("gives a teacher a read-only page: free and taken slots, no sign-up, give-up, swap or hold-back text", async () => {
    world.animal.slots.mockResolvedValue(
      success(
        slotsModel([
          slot({ mayHold: false, holdReason: "no_family" }),
          slot({ part: "afternoon", startTime: "16:00", familyName: "Mályva család" }),
        ]),
      ),
    );
    const out = await html(AnimalCareScreen({ ...view, notice: undefined, readOnly: true }));
    expect(out).toContain("Szabad");
    expect(out).toContain("Mályva család");
    expect(out).toContain("melyik családé melyik időpont");
    expect(out).not.toContain("animal-signup-");
    expect(out).not.toContain("animal-hold-");
    expect(out).not.toContain("Elvállalom");
    expect(out).not.toContain("Lemondom");
  });

  it("shows each state of a slot: taken by another, mine with give-up, mine too late, in a swap, closed, cancelled, held back", async () => {
    world.animal.slots.mockResolvedValue(
      success(
        slotsModel(
          [
            slot({ familyName: "Mályva család" }),
            slot({
              part: "afternoon",
              familyName: "Napraforgó család",
              mine: true,
              canGiveUp: true,
              placeId: PLACE,
              placeVersion: 3,
            }),
            slot({ slotDate: "2027-04-13", familyName: "Napraforgó család", mine: true }),
            slot({
              slotDate: "2027-04-13",
              part: "afternoon",
              familyName: "Napraforgó család",
              mine: true,
              inSwap: true,
            }),
            slot({ slotDate: "2027-04-14", started: true }),
            slot({ slotDate: "2027-04-14", part: "afternoon", cancelled: true }),
            slot({
              slotDate: "2027-04-15",
              mayHold: false,
              holdReason: "leaving_after_changeover",
            }),
            slot({ slotDate: "2027-04-15", part: "afternoon", mayHold: false }),
          ],
          false,
        ),
      ),
    );
    const out = await html(AnimalCareScreen({ ...view, notice: undefined }));
    expect(out).toContain("Már foglalt");
    expect(out).toContain('data-testid="animal-giveup-2027-04-12-afternoon"');
    expect(out).toContain("Biztosan lemondod");
    expect(out).toContain('data-testid="animal-mine-2027-04-12-afternoon"');
    expect(out).toContain(`href="/szulo/feladatok/${DUTY}/csere"`);
    expect(out).toContain("Csere folyamatban.");
    expect(out).toContain("Lezárva");
    expect(out).toContain("Elmarad");
    expect(out).toContain("A család az évváltás után távozik.");
    expect(out).toContain("Erre az időpontra most nem jelentkezhetsz.");
    expect(out).not.toContain("animal-info-links");
  });

  it("reports a finished sign-up or give-up in the status region", async () => {
    expect(await html(AnimalCareScreen({ ...view, notice: "jelentkezes" }))).toContain(
      "Az időpontot elvállaltad.",
    );
    expect(await html(AnimalCareScreen({ ...view, notice: "lemondas" }))).toContain(
      "Az időpontot lemondtad.",
    );
  });

  it("says there are no slots only after a successful read, and an error never reads as an empty week", async () => {
    world.animal.slots.mockResolvedValue(success(slotsModel([])));
    expect(await html(AnimalCareScreen({ ...view, notice: undefined }))).toContain(
      "A következő hetekre még nincsenek időpontok.",
    );
    world.animal.slots.mockResolvedValue(terminalFailure());
    const failed = await html(AnimalCareScreen({ ...view, notice: undefined }));
    expect(failed).toContain("Hiba történt");
    expect(failed).not.toContain("még nincsenek időpontok");
    world.animalOn = false;
    expect(await html(AnimalCareScreen({ ...view, notice: undefined }))).toContain("Hiba történt");
  });

  it("says there is no school year only when the rota read answered without one", async () => {
    world.rota.getOverview.mockResolvedValue(success({ schoolYear: undefined }));
    expect(await html(AnimalCareScreen({ ...view, notice: undefined }))).toContain(
      'data-testid="animal-no-year"',
    );
    expect(world.animal.slots).not.toHaveBeenCalled();
    world.rota.getOverview.mockResolvedValue(terminalFailure());
    expect(await html(AnimalCareScreen({ ...view, notice: undefined }))).not.toContain(
      "animal-no-year",
    );
    world.rotaOn = false;
    expect(await html(AnimalCareScreen({ ...view, notice: undefined }))).toContain("Hiba történt");
  });
});

const calendar = (over: Partial<AnimalCalendarModel> = {}): AnimalCalendarModel => ({
  schoolYearId: YEAR,
  exists: true,
  morningStart: "07:30",
  afternoonStart: "15:00",
  slotCount: 120,
  version: 2,
  groups: [{ id: "g1", name: "Állatgondozás" }],
  ...over,
});

describe("the animal-care settings", () => {
  const args = { ...view, schoolYearId: YEAR, schoolYearName: "2026/27" };

  it("shows the two times, the groups, the slot count and the create button", async () => {
    world.animal.calendar.mockResolvedValue(success(calendar()));
    const out = await html(AnimalSettingsScreen(args));
    expect(out).toContain('value="07:30"');
    expect(out).toContain("Állatgondozás");
    expect(out).toContain("Eddig 120 időpont van.");
    expect(out).toContain("Időpontok létrehozása");
    expect(out).toContain("2026/27");
  });

  it("asks for a first save before slots can be created, and says when there is no school year or the read failed", async () => {
    world.animal.calendar.mockResolvedValue(success(calendar({ exists: false, version: 0 })));
    const first = await html(AnimalSettingsScreen(args));
    expect(first).toContain("Előbb mentsd el a beállításokat.");
    expect(first).not.toContain("Időpontok létrehozása");
    expect(
      await html(
        AnimalSettingsScreen({ ...args, schoolYearId: undefined, schoolYearName: undefined }),
      ),
    ).toContain("admin-animal-no-year");
    world.animal.calendar.mockResolvedValue(terminalFailure());
    expect(await html(AnimalSettingsScreen(args))).toContain("Hiba történt");
  });
});

const section = (key: string, over: Partial<InfoSectionItem> = {}): InfoSectionItem => ({
  id: `id-${key}`,
  key,
  title: `Cím ${key}`,
  body: "Első **vastag** és [link](https://example.org).\n\n- egy\n- kettő\n\n1. első\n2. második\n\n[rossz](javascript:alert(1)) <b>x</b>",
  position: 1,
  hidden: false,
  version: 3,
  canEditText: false,
  canEditAll: false,
  ...over,
});

const infoModel = (items: InfoSectionItem[], canManage = false) => ({
  canManage,
  ownerGroupNames: ["Állatgondozás"],
  items,
});

const actor = { session: { roles: ["parent"] }, scope: {}, profile: {} } as never;

describe("the information page", () => {
  it("draws the text as plain blocks: bold, links, lists, and never markup or an unsafe link", async () => {
    world.information.list.mockResolvedValue(success(infoModel([section("morning")])));
    const out = await html(InformationScreen({ actor, editKey: undefined }));
    expect(out).toContain('id="morning"');
    expect(out).toContain("<strong>vastag</strong>");
    expect(out).toContain('href="https://example.org" target="_blank" rel="noopener noreferrer"');
    expect(out).toContain("<ul>");
    expect(out).toContain("<ol>");
    expect(out).not.toContain("javascript:");
    expect(out).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(out).not.toContain("info-edit-");
    expect(out).not.toContain("info-new-link");
  });

  it("shows the owner, the season and a hidden mark, and an edit link for whoever may edit", async () => {
    world.information.list.mockResolvedValue(
      success(
        infoModel(
          [
            section("watering", {
              seasonMonths: [3, 4, 5, 6, 7, 8, 9, 10],
              owningGroupName: "Állatgondozás",
              canEditText: true,
            }),
            section("odd", { seasonMonths: [1, 7], hidden: true }),
            section("one", { seasonMonths: [5] }),
          ],
          true,
        ),
      ),
    );
    const out = await html(InformationScreen({ actor, editKey: undefined }));
    expect(out).toContain("március–október");
    expect(out).toContain("január, július");
    expect(out).toContain("Felelős csoport: Állatgondozás");
    expect(out).toContain('data-testid="info-hidden-odd"');
    expect(out).toContain('href="/informacio?szerkesztes=watering#watering"');
    expect(out).toContain('data-testid="info-new-link"');
    expect(out).toContain("Elrejtés");
    expect(out).toContain("Visszaállítás");
  });

  it("opens the editor of the named section with the warning, and only for a section the person may edit", async () => {
    world.information.list.mockResolvedValue(
      success(infoModel([section("a", { canEditText: true }), section("b")], true)),
    );
    const out = await html(InformationScreen({ actor, editKey: "a" }));
    expect(out).toContain('data-testid="info-section-form"');
    expect(out).toContain("Ne írj ide telefonszámot");
    expect(out).toContain('data-testid="info-cancel-a"');
    expect(out).toContain('name="expectedVersion" value="3"');
    const other = await html(InformationScreen({ actor, editKey: "b" }));
    expect(other).not.toContain('data-testid="info-section-form"');
  });

  it("gives a coordinator only the text field, and a super admin every field", async () => {
    world.information.list.mockResolvedValue(
      success(
        infoModel([
          section("a", { canEditText: true, seasonMonths: [4], owningGroupName: "Állatgondozás" }),
        ]),
      ),
    );
    const text = await html(InformationScreen({ actor, editKey: "a" }));
    expect(text).toContain('name="title" value="Cím a"');
    expect(text).toContain('name="seasonMonth" value="4"');
    expect(text).not.toContain('data-testid="info-title"');
    world.information.list.mockResolvedValue(
      success(
        infoModel([section("a", { canEditText: true, canEditAll: true, seasonMonths: [4] })], true),
      ),
    );
    const all = await html(InformationScreen({ actor, editKey: "a" }));
    expect(all).toContain('data-testid="info-title"');
    expect(all).toContain('data-testid="info-season"');
    expect(all).toContain('data-testid="info-position"');
  });

  it("opens the new-section form for a super admin only, and shows the empty and error states honestly", async () => {
    world.information.list.mockResolvedValue(success(infoModel([], true)));
    const fresh = await html(InformationScreen({ actor, editKey: "uj" }));
    expect(fresh).toContain('data-testid="info-new"');
    expect(fresh).toContain('data-testid="info-empty"');
    world.information.list.mockResolvedValue(success(infoModel([], false)));
    expect(await html(InformationScreen({ actor, editKey: "uj" }))).not.toContain(
      'data-testid="info-new"',
    );
    world.information.list.mockResolvedValue(terminalFailure());
    const failed = await html(InformationScreen({ actor, editKey: undefined }));
    expect(failed).toContain("Hiba történt");
    expect(failed).not.toContain("info-empty");
    world.informationOn = false;
    expect(await html(InformationScreen({ actor, editKey: undefined }))).toContain("Hiba történt");
  });
});
