import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  denied,
  success,
  terminalFailure,
  type RecurringGroupListModel,
  type RecurringItem,
  type RecurringScheduleItem,
} from "../../src/application/index.ts";
import { budapestToday } from "../../src/application/library-format.ts";

const GROUP = "33333333-3333-4333-8333-333333333333";
const SCHED = "22222222-2222-4222-8222-222222222222";
const DUTY = "55555555-5555-4555-8555-555555555555";

const world = vi.hoisted(() => ({
  facadeOn: true,
  facade: {
    groupList: vi.fn(),
    scheduleGet: vi.fn(),
    mine: vi.fn(),
    bottle: vi.fn(),
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../../app/_recurring/facade.ts", () => ({
  resolveRecurringFacade: async () => (world.facadeOn ? world.facade : undefined),
}));

import {
  BottleIntervalPanel,
  BottleLine,
  GroupRecurringLink,
  loadBottleLine,
  RecurringFormScreen,
  RecurringGroupScreen,
  RecurringMineScreen,
} from "../../app/_recurring/RecurringScreens.tsx";
import { SkipControl } from "../../app/_recurring/RecurringForms.tsx";

const today = budapestToday();
const shift = (days: number): string => {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const actorFor = (area: "szulo" | "teacher" | "admin") =>
  ({ area, session: { roles: ["parent"] }, scope: {} }) as never;

const noRights = { canMarkDone: false, canUndo: false, canSkip: false };

const item = (id: string, over: Partial<RecurringItem> = {}): RecurringItem => ({
  id,
  scheduleId: SCHED,
  title: "Tyúkok etetése",
  category: "tyúk",
  ownerKind: "group",
  workingGroupId: GROUP,
  dueDate: today,
  status: "open",
  isOverdue: false,
  version: 1,
  ...noRights,
  ...over,
});

const schedule = (over: Partial<RecurringScheduleItem> = {}): RecurringScheduleItem => ({
  id: SCHED,
  title: "Tyúkok etetése",
  category: "tyúk",
  ownerKind: "group",
  workingGroupId: GROUP,
  intervalKind: "weeks",
  intervalCount: 1,
  startDate: "2026-09-07",
  isActive: true,
  version: 3,
  ...over,
});

const groupModel = (over: Partial<RecurringGroupListModel> = {}): RecurringGroupListModel => ({
  group: { id: GROUP, name: "Állatgondozó", status: "active" },
  schedules: [],
  items: [],
  history: [],
  canManage: false,
  canMark: false,
  ...over,
});

const html = async (node: Promise<unknown>) => renderToStaticMarkup((await node) as never);

beforeEach(() => {
  world.facadeOn = true;
  for (const fn of Object.values(world.facade)) fn.mockReset();
});

describe("the group page", () => {
  const items = [
    item("o-over", { dueDate: shift(-3), isOverdue: true, canMarkDone: true, canSkip: true }),
    item("o-due", { title: "Tyúkól almozása", canMarkDone: true }),
    item("o-next", { title: "Fűnyírás", dueDate: shift(6) }),
    item("o-done", {
      title: "Kecskék etetése",
      status: "done",
      doneByDisplayName: "Teszt Anna",
      doneAt: new Date().toISOString(),
      canUndo: true,
    }),
    item("o-skipped", {
      title: "Nyulak etetése",
      status: "skipped",
      skippedReason: "Nyári szünet.",
      skippedByDisplayName: "adminisztrátor",
    }),
  ];

  it("reads once and shows each state in words, with the buttons the database allows", async () => {
    world.facade.groupList.mockResolvedValue(
      success(groupModel({ items, canManage: true, canMark: true, schedules: [schedule()] })),
    );
    const out = await html(RecurringGroupScreen({ actor: actorFor("szulo"), groupId: GROUP }));
    expect(world.facade.groupList).toHaveBeenCalledTimes(1);
    expect(out).toContain("Állatgondozó munkacsoport");
    for (const word of ["Lejárt", "Esedékes", "Következő", "Kész", "Kihagyva"]) {
      expect(out).toContain(word);
    }
    expect(out).toContain("Esedékes volt: 3 napja");
    expect(out).toContain("Teszt Anna");
    expect(out).toContain("Indoklás:");
    expect(out).toContain("Nyári szünet.");
    expect(out).toContain('data-testid="recurring-done-form-o-over"');
    expect(out).toContain('data-testid="recurring-skip-toggle-o-over"');
    expect(out).toContain('data-testid="recurring-undo-form-o-done"');
    expect(out).toContain('data-testid="recurring-new-link"');
    expect(out).toContain(`href="/szulo/ismetlodo/uj?csoport=${GROUP}"`);
    expect(out).toContain(`href="/szulo/ismetlodo/${SCHED}/szerkesztes"`);
    expect(out).toContain("recurring-active-form-" + SCHED);
    expect(out).toContain("Kikapcsolás");
  });

  it("offers a switched-off schedule to be switched on again", async () => {
    world.facade.groupList.mockResolvedValue(
      success(groupModel({ canManage: true, schedules: [schedule({ isActive: false })] })),
    );
    const out = await html(RecurringGroupScreen({ actor: actorFor("admin"), groupId: GROUP }));
    expect(out).toContain("Bekapcsolás");
    expect(out).toContain("Kikapcsolva");
    expect(out).toContain(`href="/admin/ismetlodo/uj?csoport=${GROUP}"`);
  });

  it("shows a teacher the list with no button and no link to change anything", async () => {
    world.facade.groupList.mockResolvedValue(
      success(groupModel({ items: items.map((i) => ({ ...i, ...noRights })), canManage: true })),
    );
    const out = await html(RecurringGroupScreen({ actor: actorFor("teacher"), groupId: GROUP }));
    expect(out).toContain("Tyúkól almozása");
    expect(out).not.toContain("<button");
    expect(out).not.toContain("recurring-new-link");
    expect(out).not.toContain("szerkesztes");
    expect(out).toContain(`href="/teacher/munkacsoportok/${GROUP}"`);
  });

  it("names a duty someone who has left did, and a season-free schedule without a season", async () => {
    world.facade.groupList.mockResolvedValue(
      success(
        groupModel({
          items: [item("o-old", { status: "done", doneByDisplayName: "korábbi tag" })],
          history: [
            item("h-1", {
              status: "done",
              doneByDisplayName: "korábbi tag",
              dueDate: "2026-01-05",
            }),
            item("h-2", { status: "skipped", dueDate: "2026-01-12" }),
            item("h-3", { dueDate: "2026-01-19" }),
          ],
          canManage: true,
          schedules: [schedule({ seasonFromMonth: 4, seasonToMonth: 10 })],
        }),
      ),
    );
    const out = await html(RecurringGroupScreen({ actor: actorFor("szulo"), groupId: GROUP }));
    expect(out).toContain("korábbi tag");
    expect(out).toContain("április–október");
    expect(out).toContain('data-testid="recurring-history"');
    expect(out).toContain("Kihagyva");
    expect(out).toContain("Lejárt");
  });

  it("says nothing is due only after a successful read", async () => {
    world.facade.groupList.mockResolvedValue(success(groupModel({ canManage: true })));
    const empty = await html(RecurringGroupScreen({ actor: actorFor("szulo"), groupId: GROUP }));
    expect(empty).toContain('data-testid="recurring-empty"');
    expect(empty).toContain('data-testid="recurring-schedules-empty"');
    world.facade.groupList.mockResolvedValue(denied());
    const refused = await html(RecurringGroupScreen({ actor: actorFor("szulo"), groupId: GROUP }));
    expect(refused).toContain("recurring-group-state-denied");
    expect(refused).not.toContain("recurring-empty");
    world.facade.groupList.mockResolvedValue(terminalFailure());
    const failed = await html(RecurringGroupScreen({ actor: actorFor("szulo"), groupId: GROUP }));
    expect(failed).toContain("Hiba történt");
    expect(failed).not.toContain("recurring-empty");
    world.facadeOn = false;
    expect(
      await html(RecurringGroupScreen({ actor: actorFor("szulo"), groupId: GROUP })),
    ).not.toContain("recurring-empty");
  });

  it("links the group page to its recurring duties in each area", () => {
    for (const area of ["szulo", "teacher", "admin"] as const) {
      const out = renderToStaticMarkup(<GroupRecurringLink area={area} groupId={GROUP} />);
      expect(out).toContain(`href="/${area}/munkacsoportok/${GROUP}/ismetlodo"`);
    }
  });
});

describe("my recurring duties", () => {
  it("separates the family's duties from each group's and reads once", async () => {
    world.facade.mine.mockResolvedValue(
      success({
        items: [
          item("f-1", { ownerKind: "family", title: "Komposztláda", canMarkDone: true }),
          item("g-1", { groupName: "Állatgondozó", canMarkDone: true }),
          item("g-2", { groupName: "Állatgondozó", title: "Tyúkól almozása" }),
          item("g-3", { groupName: "Karbantartó", title: "Fűnyírás" }),
        ],
      }),
    );
    const out = await html(RecurringMineScreen({ actor: actorFor("szulo") }));
    expect(world.facade.mine).toHaveBeenCalledTimes(1);
    expect(out).toContain("A családunk feladatai");
    expect(out).toContain("Munkacsoportjaink feladatai");
    expect(out.match(/data-testid="recurring-group-block"/g)).toHaveLength(2);
    expect(out).toContain('data-testid="recurring-done-form-f-1"');
    expect(out).not.toContain("recurring-mine-empty");
  });

  it("shows a calm line for a family with no duty of its own, and for no duty at all", async () => {
    world.facade.mine.mockResolvedValue(
      success({ items: [item("g-1", { groupName: "Állatgondozó" })] }),
    );
    expect(await html(RecurringMineScreen({ actor: actorFor("szulo") }))).toContain(
      "recurring-family-empty",
    );
    world.facade.mine.mockResolvedValue(success({ items: [] }));
    expect(await html(RecurringMineScreen({ actor: actorFor("szulo") }))).toContain(
      "recurring-mine-empty",
    );
  });

  it("does not call a failed or refused read empty", async () => {
    world.facade.mine.mockResolvedValue(denied());
    const refused = await html(RecurringMineScreen({ actor: actorFor("szulo") }));
    expect(refused).toContain("recurring-mine-state-denied");
    expect(refused).not.toContain("recurring-mine-empty");
    world.facadeOn = false;
    expect(await html(RecurringMineScreen({ actor: actorFor("szulo") }))).not.toContain(
      "Nincs esedékes ismétlődő feladatod",
    );
  });
});

describe("the schedule form", () => {
  it("opens an empty form for a group the caller manages, with today as the first date", async () => {
    world.facade.groupList.mockResolvedValue(success(groupModel({ canManage: true })));
    const out = await html(RecurringFormScreen({ actor: actorFor("szulo"), groupId: GROUP }));
    expect(world.facade.scheduleGet).not.toHaveBeenCalled();
    expect(out).toContain("Új ismétlődő feladat");
    expect(out).toContain(`value="${today}"`);
    expect(out).toContain('name="ownerKind"');
    expect(out).toContain("Felelős: Állatgondozó munkacsoport");
    expect(out).toContain("Nincs megadva");
    expect(out).not.toContain("recurring-edit-note");
    expect(out).not.toContain('aria-invalid="true"');
  });

  it("opens the change form with the saved values, the version and the locked owner", async () => {
    world.facade.scheduleGet.mockResolvedValue(
      success({ schedule: schedule({ seasonFromMonth: 4, seasonToMonth: 10 }), canManage: true }),
    );
    world.facade.groupList.mockResolvedValue(success(groupModel({ canManage: true })));
    const out = await html(RecurringFormScreen({ actor: actorFor("szulo"), scheduleId: SCHED }));
    expect(out).toContain("Ismétlődő feladat szerkesztése");
    expect(out).toContain('value="Tyúkok etetése"');
    expect(out).toContain('name="expectedVersion" value="3"');
    expect(out).toContain('value="2026-09-07"');
    expect(out).toContain("nem módosítható");
    expect(out).toContain("recurring-edit-note");
    expect(world.facade.groupList).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      GROUP,
    );
  });

  it("refuses a person who may not manage the group, and a schedule that is not a group's", async () => {
    world.facade.groupList.mockResolvedValue(success(groupModel({ canManage: false })));
    expect(await html(RecurringFormScreen({ actor: actorFor("szulo"), groupId: GROUP }))).toContain(
      "recurring-form-state-denied",
    );
    world.facade.scheduleGet.mockResolvedValue(success({ schedule: schedule(), canManage: false }));
    expect(
      await html(RecurringFormScreen({ actor: actorFor("szulo"), scheduleId: SCHED })),
    ).toContain("recurring-form-state-denied");
    world.facade.scheduleGet.mockResolvedValue(
      success({ schedule: schedule({ ownerKind: "family" }), canManage: true }),
    );
    expect(
      await html(RecurringFormScreen({ actor: actorFor("admin"), scheduleId: SCHED })),
    ).toContain("recurring-form-state-denied");
    expect(await html(RecurringFormScreen({ actor: actorFor("szulo") }))).toContain(
      "recurring-form-state-denied",
    );
  });

  it("tells a refused read from a failed one", async () => {
    world.facade.scheduleGet.mockResolvedValue(denied());
    expect(
      await html(RecurringFormScreen({ actor: actorFor("szulo"), scheduleId: SCHED })),
    ).toContain("recurring-form-state-denied");
    world.facade.scheduleGet.mockResolvedValue(terminalFailure());
    expect(
      await html(RecurringFormScreen({ actor: actorFor("szulo"), scheduleId: SCHED })),
    ).toContain("recurring-form-state-error");
    world.facade.groupList.mockResolvedValue(terminalFailure());
    expect(await html(RecurringFormScreen({ actor: actorFor("szulo"), groupId: GROUP }))).toContain(
      "recurring-form-state-error",
    );
    world.facade.groupList.mockResolvedValue(denied());
    expect(await html(RecurringFormScreen({ actor: actorFor("szulo"), groupId: GROUP }))).toContain(
      "recurring-form-state-denied",
    );
    world.facadeOn = false;
    expect(await html(RecurringFormScreen({ actor: actorFor("szulo"), groupId: GROUP }))).toContain(
      "recurring-form-state-error",
    );
  });

  it("goes back to the area's own list of groups when no group is named", async () => {
    expect(await html(RecurringFormScreen({ actor: actorFor("admin") }))).toContain(
      'href="/admin/munkacsoportok"',
    );
  });
});

describe("the bottle-cleaning line", () => {
  it("shows Kész for a due week and who did it, when, with Mégsem for a done one", () => {
    const open = renderToStaticMarkup(
      <BottleLine
        result={success({ items: [item("b-1", { ownerKind: "rota_week", canMarkDone: true })] })}
      />,
    );
    expect(open).toContain('data-testid="recurring-bottle-line"');
    expect(open).toContain('data-testid="recurring-done-form-b-1"');
    const done = renderToStaticMarkup(
      <BottleLine
        result={success({
          items: [
            item("b-2", {
              ownerKind: "rota_week",
              status: "done",
              doneByDisplayName: "Teszt Béla",
              doneAt: new Date().toISOString(),
              canUndo: true,
            }),
          ],
        })}
      />,
    );
    expect(done).toContain("Teszt Béla");
    expect(done).toContain('data-testid="recurring-undo-form-b-2"');
  });

  it("shows nothing for a week with no cleaning and for a refused read, and an error for a failed one", () => {
    expect(renderToStaticMarkup(<BottleLine result={success({ items: [] })} />)).toBe("");
    expect(renderToStaticMarkup(<BottleLine result={denied()} />)).toBe("");
    expect(renderToStaticMarkup(<BottleLine result={terminalFailure()} />)).toContain(
      "recurring-bottle-error",
    );
  });

  it("reads the line only for the card of a water week that loaded", async () => {
    const actor = actorFor("szulo");
    world.facade.bottle.mockResolvedValue(success({ items: [] }));
    const water = success({ job: "water_carrying" } as never);
    expect(await loadBottleLine(actor, water, DUTY)).toEqual(success({ items: [] }));
    expect(world.facade.bottle).toHaveBeenCalledWith(expect.anything(), expect.anything(), DUTY);
    world.facade.bottle.mockClear();
    expect(await loadBottleLine(actor, success({ job: "indoor_cleaning" } as never), DUTY)).toBe(
      undefined,
    );
    expect(await loadBottleLine(actor, denied(), DUTY)).toBe(undefined);
    expect(world.facade.bottle).not.toHaveBeenCalled();
    world.facadeOn = false;
    expect((await loadBottleLine(actor, water, DUTY))?.state).not.toBe("success");
  });
});

describe("the bottle interval of the school calendar", () => {
  const bottle = schedule({
    id: "bottle-1",
    title: "Vizespalackok tisztítása",
    ownerKind: "rota_week",
    rotaJob: "water_carrying",
    intervalKind: "rota_weeks",
    intervalCount: 4,
    seasonFromMonth: 9,
    seasonToMonth: 12,
  });

  it("shows one number field with its hint for the water-week schedule", () => {
    const out = renderToStaticMarkup(
      <BottleIntervalPanel
        result={success({ items: [schedule({ ownerKind: "family" }), bottle] })}
      />,
    );
    expect(out).toContain("Minden hányadik vízhordó héten");
    expect(out).toContain('value="4"');
    expect(out).toContain("minden 4. vízhordó héten");
    expect(out).toContain('name="seasonFromMonth" value="9"');
    expect(out).toContain('name="rotaJob" value="water_carrying"');
  });

  it("says there is no schedule only after a successful read, and an error otherwise", () => {
    expect(renderToStaticMarkup(<BottleIntervalPanel result={success({ items: [] })} />)).toContain(
      "admin-bottle-interval-empty",
    );
    const failed = renderToStaticMarkup(<BottleIntervalPanel result={terminalFailure()} />);
    expect(failed).toContain("admin-bottle-interval-error");
    expect(failed).not.toContain("admin-bottle-interval-empty");
  });
});

describe("the skip button", () => {
  it("is a native button that opens the reason form and closes it again", () => {
    render(<SkipControl item={item("s-1", { canSkip: true })} groupId={GROUP} />);
    const toggle = screen.getByTestId("recurring-skip-toggle-s-1");
    expect(toggle.tagName).toBe("BUTTON");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("recurring-skip-form-s-1")).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("recurring-skip-form-s-1")).toBeInTheDocument();
    expect(screen.getByLabelText("Kihagyás oka")).toBeRequired();
    fireEvent.click(toggle);
    expect(screen.queryByTestId("recurring-skip-form-s-1")).toBeNull();
  });
});
