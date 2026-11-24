import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mapApplicationResult } from "../../app/admin/_lib/action-state.ts";
import { mapParentResult } from "../../app/szulo/_lib/action-state.ts";
import {
  conflict,
  denied,
  success,
  terminalFailure,
  validation,
} from "../../src/application/index.ts";
import type {
  RotaDutyCardModel,
  RotaOverviewModel,
  UnpickedListModel,
} from "../../src/application/index.ts";
import { RotaDutyCard, RotaOverview } from "../../src/runtime/RotaOverview.tsx";

vi.mock("server-only", () => ({}));
const adminAction = vi.hoisted(() => vi.fn());
const parentAction = vi.hoisted(() => vi.fn());
vi.mock("../../app/admin/rota-actions.ts", () => ({ assignSlotAction: adminAction }));
vi.mock("../../app/szulo/actions.ts", () => ({ pickSlotAction: parentAction }));

const { UnpickedList } = await import("../../app/admin/_components/UnpickedList.tsx");
const { WeekendPicker } = await import("../../app/szulo/_components/WeekendPicker.tsx");

const WEEK = "00000000-0000-4000-8000-0000000000a1";

const UNPICKED: UnpickedListModel = {
  items: [
    {
      rotaWeekId: WEEK,
      job: "indoor_cleaning",
      weekStart: "2026-11-23",
      familyDisplayName: "Minta család 3",
      weekendFamilyDisplayName: "Minta család 4",
      changeUntil: "2026-11-27T11:00:00Z",
      freeSlots: [
        { slot: "saturday_closing", dutyId: "d1", placeVersion: 3 },
        { slot: "sunday_opening", dutyId: "d2", placeVersion: 1 },
      ],
    },
  ],
  missed: [
    {
      rotaWeekId: "00000000-0000-4000-8000-0000000000a2",
      job: "front_garden",
      weekStart: "2026-11-16",
      familyDisplayName: "Minta család 5",
      weekendFamilyDisplayName: "Minta család 6",
      freeSlots: [],
    },
  ],
};

beforeEach(() => {
  adminAction.mockReset();
  parentAction.mockReset();
});

describe("the unpicked list of the dashboard (BR63.8)", () => {
  it("says everyone has chosen when nothing is owed", () => {
    render(<UnpickedList result={success({ items: [], missed: [] })} />);
    expect(screen.getByRole("heading", { name: "Ki nem választott?" })).toBeInTheDocument();
    expect(screen.getByTestId("admin-unpicked-empty")).toHaveTextContent("Mindenki választott.");
  });

  it("lists the open picks with their free slots and the missed ones without a form when none is free", () => {
    render(<UnpickedList result={success(UNPICKED)} />);
    const open = screen.getByTestId("admin-unpicked-open");
    expect(open).toHaveTextContent("Minta család 3");
    expect(open).toHaveTextContent("Minta család 4");
    expect(open).toHaveTextContent("Belső takarítás");
    const select = within(open).getByRole("combobox");
    expect(
      within(select)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Szombat esti zárás", "Vasárnap reggeli nyitás"]);
    const missed = screen.getByTestId("admin-unpicked-missed");
    expect(missed).toHaveTextContent("Nem választott időben");
    expect(within(missed).queryByRole("button")).toBeNull();
    expect(missed).toHaveTextContent("Nincs szabad nyitás vagy zárás ezen a héten.");
  });

  it("sends the chosen slot with the version of its place and shows the answer of the action", async () => {
    adminAction.mockResolvedValue({ state: "success", message: "A kijelölés mentve." });
    render(<UnpickedList result={success(UNPICKED)} />);
    const select = screen.getByTestId(`admin-unpicked-select-${WEEK}-indoor_cleaning`);
    fireEvent.change(select, { target: { value: "sunday_opening:1" } });
    fireEvent.click(screen.getByRole("button", { name: "Kijelölés mentése" }));
    await waitFor(() => expect(adminAction).toHaveBeenCalledTimes(1));
    const data = adminAction.mock.calls[0]![1] as FormData;
    expect(data.get("rotaWeekId")).toBe(WEEK);
    expect(data.get("slot")).toBe("sunday_opening:1");
    expect(await screen.findByText("A kijelölés mentve.")).toBeInTheDocument();
  });

  it("shows nothing for a caller who may not read it, and an error for a failed read", () => {
    const { container, rerender } = render(<UnpickedList result={denied()} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<UnpickedList result={terminalFailure()} />);
    expect(screen.getByTestId("admin-unpicked-error")).toHaveAttribute("role", "alert");
  });
});

const CARD: RotaDutyCardModel = {
  dutyId: "d9",
  job: "indoor_cleaning",
  title: "Belső takarítás",
  familyDisplayName: "Minta család 3",
  weekStart: "2026-11-23",
  weekEnd: "2026-11-29",
  noFixedDay: true,
  isBreakWeek: false,
  includesWatering: false,
  bottlesAtWeekEnd: false,
  infoLinks: [],
  weekend: {
    weekStart: "2026-11-23",
    picksCloseAt: "2026-11-27T11:00:00Z",
    changeUntil: "2026-11-27T11:00:00Z",
    weekendFamilyDisplayName: "Minta család 4",
    slots: [
      {
        slot: "saturday_opening",
        dutyId: "s1",
        placeVersion: 2,
        holderFamilyDisplayName: "Minta család 4",
        heldByWeekendFamily: true,
        picked: false,
      },
      {
        slot: "saturday_closing",
        dutyId: "s2",
        placeVersion: 3,
        heldByWeekendFamily: false,
        picked: true,
        holderFamilyDisplayName: "Minta család 3",
      },
    ],
    pickers: [
      {
        job: "indoor_cleaning",
        familyDisplayName: "Minta család 3",
        state: "picked",
        slot: "saturday_closing",
      },
      { job: "front_garden", familyDisplayName: "Minta család 5", state: "open" },
    ],
  },
  ownPick: {
    rotaWeekId: WEEK,
    state: "picked",
    slot: "saturday_closing",
    canPick: true,
    freeSlots: [{ slot: "saturday_opening", dutyId: "s1", placeVersion: 2 }],
    picksCloseAt: "2026-11-27T11:00:00Z",
    changeUntil: "2026-11-27T11:00:00Z",
  },
};

function card(model: RotaDutyCardModel) {
  return render(
    <RotaDutyCard
      result={success(model)}
      backHref="/szulo/beosztas"
      renderPicker={(c, own) => <WeekendPicker card={c} own={own} />}
    />,
  );
}

describe("the weekend picker of the duty card (BR63.4)", () => {
  it("offers the free slots and the own current pick as native radio buttons, the own pick checked", () => {
    card(CARD);
    const fieldset = screen.getByTestId("weekend-pick-fieldset");
    const radios = within(fieldset).getAllByRole("radio");
    expect(radios.map((r) => (r as HTMLInputElement).value)).toEqual([
      "saturday_opening:2",
      "saturday_closing:3",
    ]);
    expect(screen.getByTestId("weekend-pick-saturday_closing")).toBeChecked();
    expect(screen.getByTestId("weekend-pick-current")).toHaveTextContent("Szombat esti zárás");
  });

  it("sends the slot and the version that were on screen and shows the saved message", async () => {
    parentAction.mockResolvedValue({ state: "success", message: "A választás mentve." });
    card(CARD);
    fireEvent.click(screen.getByTestId("weekend-pick-saturday_opening"));
    fireEvent.click(screen.getByRole("button", { name: "Választás mentése" }));
    await waitFor(() => expect(parentAction).toHaveBeenCalledTimes(1));
    const data = parentAction.mock.calls[0]![1] as FormData;
    expect(data.get("slot")).toBe("saturday_opening:2");
    expect(data.get("rotaWeekId")).toBe(WEEK);
    expect(String(data.get("idempotencyKey"))).toMatch(/^pick:/);
    expect(await screen.findByText("A választás mentve.")).toBeInTheDocument();
  });

  it("shows the sentence of a refusal, such as a slot taken meanwhile", async () => {
    parentAction.mockResolvedValue(
      mapParentResult(conflict("WEEKEND_SLOT_TAKEN"), "A választás mentve."),
    );
    card(CARD);
    fireEvent.click(screen.getByRole("button", { name: "Választás mentése" }));
    expect(await screen.findByText(/közben más család választotta/)).toBeInTheDocument();
  });

  it("says what the state is when the family cannot choose: not needed, missed, closed, taken", () => {
    const states: [Partial<RotaDutyCardModel["ownPick"]>, string][] = [
      [{ state: "not_needed", canPick: false }, "Ezen a héten nem kell választani."],
      [{ state: "missed", canPick: false }, "Nem választott időben."],
      [{ state: "open", canPick: false }, "A választás ideje lejárt."],
      [{ state: "picked", slot: "sunday_closing", canPick: false }, "Vasárnap esti zárás."],
    ];
    for (const [own, text] of states) {
      const { unmount } = card({ ...CARD, ownPick: { ...CARD.ownPick!, ...own } });
      expect(screen.getByTestId("rota-picker-state")).toHaveTextContent(text);
      expect(screen.queryByRole("radio")).toBeNull();
      unmount();
    }
  });

  it("tells a family with nothing left to choose that every slot is taken", () => {
    card({
      ...CARD,
      ownPick: { ...CARD.ownPick!, state: "open", slot: undefined, freeSlots: [] },
    });
    expect(screen.getByTestId("rota-picker-state")).toHaveTextContent("Már választották");
  });

  it("lists who holds each weekend duty and who chose what", () => {
    card(CARD);
    expect(screen.getByTestId("rota-weekend-slot-saturday_opening")).toHaveTextContent(
      "A hétvégi család viszi.",
    );
    expect(screen.getByTestId("rota-weekend-slot-saturday_closing")).toHaveTextContent(
      "Minta család 3",
    );
    const pickers = screen.getByTestId("rota-weekend-pickers");
    expect(pickers).toHaveTextContent(
      "Belső takarítás: Minta család 3 – Választott. Szombat esti zárás.",
    );
    expect(pickers).toHaveTextContent("Előkert: Minta család 5 – Még nem választott.");
  });

  it("keeps the picker out of a card with no pick, and shows no button", () => {
    card({ ...CARD, ownPick: undefined });
    expect(screen.queryByTestId("rota-picker")).toBeNull();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});

describe("the duty card of each rota (BR65.2)", () => {
  const base = { ...CARD, weekend: undefined, ownPick: undefined };

  it("says the watering for the front garden in the watering months only", () => {
    const { unmount } = card({
      ...base,
      job: "front_garden",
      title: "Előkert",
      includesWatering: true,
    });
    expect(screen.getByTestId("rota-card-extra")).toHaveTextContent("öntözése");
    unmount();
    card({ ...base, job: "front_garden", title: "Előkert", includesWatering: false });
    expect(screen.queryByTestId("rota-card-extra")).toBeNull();
    expect(screen.getByTestId("rota-card-no-fixed-day")).toBeInTheDocument();
  });

  it("says the bottles for the water carrying in the last week only", () => {
    const { unmount } = card({
      ...base,
      job: "water_carrying",
      title: "Vízhordás",
      bottlesAtWeekEnd: true,
    });
    expect(screen.getByTestId("rota-card-extra")).toHaveTextContent("palackokat");
    unmount();
    card({ ...base, job: "water_carrying", title: "Vízhordás" });
    expect(screen.queryByTestId("rota-card-extra")).toBeNull();
  });

  it("gives a weekend duty its day and part of day, and no fixed-day line", () => {
    card({
      ...base,
      job: "weekend_animal_care",
      slot: "saturday_opening",
      title: "Szombat reggeli nyitás",
      noFixedDay: false,
      day: "saturday",
      partOfDay: "morning",
    });
    expect(screen.getByTestId("rota-card-when")).toHaveTextContent("Szombat reggel");
    expect(screen.queryByTestId("rota-card-no-fixed-day")).toBeNull();
  });

  it("gives the weekend family card the weekend text", () => {
    card({ ...base, job: "weekend_animal_care", title: "Hétvégi állatgondozás" });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Hétvégi állatgondozás");
    expect(screen.getByText(/ami nem kel el, az a hétvégi családnál marad/)).toBeInTheDocument();
  });
});

describe("the overview of four rotas and the weekend duties (W6)", () => {
  const OVERVIEW: RotaOverviewModel = {
    overviewState: "published",
    schoolYear: { id: "y1", name: "2026-2027" },
    items: [
      {
        job: "indoor_cleaning",
        weekStart: "2026-11-23",
        isBreak: false,
        familyId: "f1",
        familyDisplayName: "Minta család 1",
        isOwn: false,
      },
      {
        job: "front_garden",
        weekStart: "2026-11-23",
        isBreak: false,
        familyId: "f2",
        familyDisplayName: "Minta család 2",
        isOwn: true,
        dutyId: "d2",
      },
      { job: "water_carrying", weekStart: "2026-11-23", isBreak: true, isOwn: false },
      {
        job: "weekend_animal_care",
        weekStart: "2026-11-23",
        isBreak: false,
        familyId: "f3",
        familyDisplayName: "Minta család 3",
        isOwn: false,
      },
    ],
    weekendItems: [
      {
        weekStart: "2026-11-23",
        slot: "saturday_opening",
        familyId: "f3",
        familyDisplayName: "Minta család 3",
        isOwn: false,
      },
      {
        weekStart: "2026-11-23",
        slot: "saturday_closing",
        familyId: "f2",
        familyDisplayName: "Minta család 2",
        isOwn: true,
        dutyId: "w2",
      },
    ],
  };
  const props = {
    today: "2026-11-20",
    action: "/szulo/beosztas",
    cardHref: (id: string) => `/szulo/beosztas/${id}`,
  };

  it("shows one section per rota and the weekend duties, the own family marked", () => {
    render(<RotaOverview result={success(OVERVIEW)} {...props} />);
    for (const job of [
      "indoor_cleaning",
      "front_garden",
      "water_carrying",
      "weekend_animal_care",
    ]) {
      expect(screen.getByTestId(`rota-job-${job}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId("rota-front_garden-week-2026-11-23")).toHaveTextContent("Ti");
    expect(screen.getByTestId("rota-weekend-2026-11-23")).toHaveTextContent("Szombat esti zárás");
    expect(screen.getByTestId("rota-weekend-2026-11-23")).toHaveTextContent("Minta család 2");
    expect(
      within(screen.getByTestId("rota-weekend-2026-11-23")).getByRole("link", {
        name: "Feladatlap megnyitása",
      }),
    ).toHaveAttribute("href", "/szulo/beosztas/w2");
  });

  it("filters the weekend duties by the own family too, and says when nothing matches", () => {
    const { rerender } = render(
      <RotaOverview result={success(OVERVIEW)} filter="sajat" {...props} />,
    );
    expect(screen.queryByTestId("rota-job-indoor_cleaning")).toBeNull();
    expect(screen.getByTestId("rota-weekend-2026-11-23")).not.toHaveTextContent("Minta család 3");
    expect(screen.getByTestId("rota-weekend-2026-11-23")).toHaveTextContent("Szombat esti zárás");
    rerender(<RotaOverview result={success(OVERVIEW)} filter="nincs-ilyen" {...props} />);
    expect(screen.getByTestId("rota-filter-empty")).toBeInTheDocument();
  });
});

describe("the refusals a family may not hold a duty (BR60.3)", () => {
  it("is one sentence on the parent and the admin screens, without a field to point at", () => {
    const refused = validation({ request: "VAL-INVALID" }, "DUTY_INELIGIBLE");
    for (const state of [mapParentResult(refused, ""), mapApplicationResult(refused)]) {
      expect(state.state).toBe("validation");
      expect(state.message).toContain("nem (vagy még nem) vállalhat feladatot");
      expect(state.fieldErrors).toBeUndefined();
    }
  });

  it("keeps the general validation text for any other code", () => {
    expect(mapParentResult(validation({ reason: "VAL-REQUIRED" }), "").message).toBe(
      "Ellenőrizze a megadott adatokat.",
    );
  });
});
