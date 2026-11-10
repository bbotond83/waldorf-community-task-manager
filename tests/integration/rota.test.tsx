import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  denied,
  invalidated,
  retryableFailure,
  success,
  terminalFailure,
  validation,
  conflict,
} from "../../src/application/index.ts";
import type { RotaDutyCardModel, RotaOverviewModel } from "../../src/application/index.ts";
import { rotaState } from "../../app/admin/_lib/rota-state.ts";
import { RotaDutyCard, RotaOverview } from "../../src/runtime/RotaOverview.tsx";

const RETRY = { idempotencyKey: "rota-retry-0001", action: "rota" } as const;

const OVERVIEW: RotaOverviewModel = {
  overviewState: "published",
  schoolYear: { id: "y1", name: "2026-2027" },
  items: [
    {
      job: "indoor_cleaning",
      weekStart: "2026-11-02",
      isBreak: false,
      familyId: "f1",
      familyDisplayName: "Minta család 1",
      isOwn: false,
    },
    {
      job: "indoor_cleaning",
      weekStart: "2026-11-09",
      isBreak: false,
      familyId: "f2",
      familyDisplayName: "Minta család 2",
      isOwn: true,
      dutyId: "d2",
    },
    { job: "indoor_cleaning", weekStart: "2026-11-16", isBreak: true, isOwn: false },
  ],
};

const props = {
  today: "2026-11-05",
  action: "/szulo/beosztas",
  cardHref: (id: string) => `/szulo/beosztas/${id}`,
};

describe("RotaOverview", () => {
  it("lists the weeks, marks the own family, the break week and the next week", () => {
    render(<RotaOverview result={success(OVERVIEW)} {...props} />);
    const list = screen.getByTestId("rota-week-list");
    expect(list).toHaveTextContent("Minta család 1");
    expect(list).toHaveTextContent("Ti");
    expect(list).toHaveTextContent("Szünet");
    expect(list).toHaveTextContent("Következő hét");
    expect(screen.getAllByRole("link", { name: /Feladatlap megnyitása/ })[0]).toHaveAttribute(
      "href",
      "/szulo/beosztas/d2",
    );
    expect(screen.getByTestId("rota-table")).toHaveTextContent("2026. nov. 2–8.");
    expect(screen.getByTestId("rota-filter-select")).toBeInTheDocument();
  });

  it("filters by the own family and says when nothing matches", () => {
    const { rerender } = render(
      <RotaOverview result={success(OVERVIEW)} filter="sajat" {...props} />,
    );
    expect(screen.getByTestId("rota-week-list").querySelectorAll("li")).toHaveLength(1);
    rerender(<RotaOverview result={success(OVERVIEW)} filter="nincs-ilyen" {...props} />);
    expect(screen.getByTestId("rota-filter-empty")).toHaveTextContent("Nincs találat.");
  });

  it("says nothing is published, and shows no family", () => {
    render(
      <RotaOverview
        result={success({ overviewState: "nothing_published", items: [] })}
        {...props}
      />,
    );
    expect(screen.getByTestId("rota-empty")).toHaveTextContent("Még nincs közzétett beosztás.");
    expect(screen.queryByTestId("rota-week-list")).toBeNull();
  });

  it("never shows the empty state for a refused or failed read", () => {
    const { rerender } = render(<RotaOverview result={denied()} {...props} />);
    expect(screen.getByTestId("rota-denied")).toBeInTheDocument();
    rerender(<RotaOverview result={invalidated()} {...props} />);
    expect(screen.getByTestId("rota-denied")).toBeInTheDocument();
    rerender(<RotaOverview result={retryableFailure(RETRY)} {...props} />);
    expect(screen.getByTestId("rota-error")).toBeInTheDocument();
    rerender(<RotaOverview result={terminalFailure()} {...props} />);
    expect(screen.getByTestId("rota-error")).toBeInTheDocument();
    expect(screen.queryByTestId("rota-empty")).toBeNull();
  });
});

const CARD: RotaDutyCardModel = {
  dutyId: "d2",
  job: "indoor_cleaning",
  title: "Benti takarítás",
  familyDisplayName: "Minta család 2",
  weekStart: "2026-11-09",
  weekEnd: "2026-11-15",
  noFixedDay: true,
  isBreakWeek: false,
};

describe("RotaDutyCard", () => {
  it("shows the family, the week, the fixed text and no swap or cancel control", () => {
    render(<RotaDutyCard result={success(CARD)} backHref="/szulo/beosztas" />);
    expect(screen.getByTestId("rota-card-details")).toHaveTextContent("Minta család 2");
    expect(screen.getByTestId("rota-card-details")).toHaveTextContent("2026. november 9.");
    expect(screen.getByTestId("rota-card-no-fixed-day")).toHaveTextContent("nincs kijelölt napja");
    expect(screen.queryByTestId("rota-card-break")).toBeNull();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("warns when the week has become a break week", () => {
    render(
      <RotaDutyCard result={success({ ...CARD, isBreakWeek: true })} backHref="/szulo/beosztas" />,
    );
    expect(screen.getByTestId("rota-card-break")).toBeInTheDocument();
  });

  it("shows the same refusal for every denied read", () => {
    render(<RotaDutyCard result={denied()} backHref="/szulo/beosztas" />);
    expect(screen.getByTestId("rota-denied")).toHaveTextContent("Nincs jogosultság");
  });
});

describe("rotaState", () => {
  it("keeps the success text", () => {
    expect(rotaState(success({ id: "x" }), "Kész.")).toMatchObject({
      state: "success",
      message: "Kész.",
    });
  });

  it("gives a refused rota code its own Hungarian sentence", () => {
    const state = rotaState(validation({ request: "VAL-INVALID" }, "ROTA_WEEKS_EMPTY"), "x");
    expect(state.state).toBe("validation");
    expect(state.message).toContain("minden tanítási hétnek");
    expect(rotaState(conflict("ROTA_PLAN_PUBLISHED"), "x").message).toContain("már közzé van téve");
    expect(rotaState(invalidated("ROTA_DISCARD_OUTDATED"), "x").message).toContain("megváltozott");
  });

  it("names the field of a refused date", () => {
    const state = rotaState(validation({ changeoverDate: "VAL-DATE-RANGE" }), "x");
    expect(state.fieldErrors?.changeoverDate).toBe(
      "Az évváltás napja nem lehet a tanév kezdete előtt.",
    );
  });

  it("maps a refused access and a failure", () => {
    expect(rotaState(denied(), "x").state).toBe("denied");
    expect(rotaState(retryableFailure(RETRY), "x").state).toBe("retryable");
  });
});
