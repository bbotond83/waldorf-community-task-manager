import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ApplicationResult, ScheduleModel } from "../../src/application/index.ts";
import { ScheduleCollection } from "../../app/munkatars/beosztas/_components/ScheduleCollection.tsx";
import { ScheduleFilter } from "../../app/munkatars/beosztas/_components/ScheduleFilter.tsx";
import { StaffStatePanel } from "../../app/munkatars/_components/StaffStatePanel.tsx";
import { DEFAULT_STAFF_FILTERS, parseStaffFilters } from "../../app/munkatars/_lib/filters.ts";

const filters = parseStaffFilters({});
const model: ScheduleModel = {
  entries: [
    {
      id: "schedule-test",
      startsAt: "2026-08-13T06:30:00.000Z",
      endsAt: "2026-08-13T07:30:00.000Z",
      title: "Kitalált felügyelet",
      location: "Keleti udvar",
      coordinationDisplayName: "Kitalált Ágnes",
    },
  ],
};

describe("Staff schedule components", () => {
  it("renders labelled bounded filters with stable interactive test IDs", () => {
    render(<ScheduleFilter filters={filters} />);
    expect(screen.getByLabelText("Csoport")).toHaveValue(DEFAULT_STAFF_FILTERS.groupId);
    expect(screen.getByLabelText("Kezdő dátum")).toHaveValue(DEFAULT_STAFF_FILTERS.from);
    expect(screen.getByLabelText("Záró dátum")).toHaveValue(DEFAULT_STAFF_FILTERS.to);
    expect(screen.getByTestId("staff-schedule-filter-submit-button")).toBeVisible();
    expect(screen.getByTestId("staff-schedule-filter-clear-link")).toBeVisible();
  });

  it("renders desktop table and mobile cards from one authorized model", () => {
    render(<ScheduleCollection entries={model.entries} filters={filters} />);
    const table = screen.getByTestId("staff-schedule-table");
    const cards = screen.getByTestId("staff-schedule-card-list");
    expect(within(table).getByText("Kitalált felügyelet")).toBeVisible();
    expect(within(cards).getByText("Kitalált felügyelet")).toBeVisible();
    expect(within(table).getByText("Tölgyfa csoport")).toBeVisible();
    expect(within(cards).getByText("Tölgyfa csoport")).toBeVisible();
  });

  it("renders an empty state with a clear-filter link", () => {
    render(
      <StaffStatePanel result={result("empty")} retryHref="/retry" testId="staff-test">
        {() => null}
      </StaffStatePanel>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Nincs találat");
    expect(screen.getByTestId("staff-test-clear-link")).toHaveAttribute(
      "href",
      "/munkatars/beosztas",
    );
  });

  it("offers retry only for the classified retryable state", () => {
    const { rerender } = render(
      <StaffStatePanel
        result={result("dependency-failure-retryable")}
        retryHref="/retry"
        testId="staff-test"
      >
        {() => null}
      </StaffStatePanel>,
    );
    expect(screen.getByTestId("staff-test-retry-link")).toHaveAttribute("href", "/retry");
    rerender(
      <StaffStatePanel
        result={result("dependency-failure-terminal")}
        retryHref="/retry"
        testId="staff-test"
      >
        {() => null}
      </StaffStatePanel>,
    );
    expect(screen.queryByTestId("staff-test-retry-link")).not.toBeInTheDocument();
  });

  it("renders generic denial without protected identifiers", () => {
    render(
      <StaffStatePanel result={result("denied")} retryHref="/retry" testId="staff-test">
        {() => null}
      </StaffStatePanel>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("A kért tartalom nem érhető el");
    expect(document.body.textContent).not.toMatch(
      /email|telefon|család|lakhely|indok|hozzárendelés/iu,
    );
  });
});

function result(
  state: "empty" | "denied" | "dependency-failure-retryable" | "dependency-failure-terminal",
): ApplicationResult<ScheduleModel> {
  const base = {
    code: "SAFE_STATE",
    focusTarget: "#fo-tartalom",
    announcement: "assertive" as const,
  };
  if (state === "dependency-failure-retryable") {
    return {
      ...base,
      state,
      presentationCode: "APP-DEPENDENCY-RETRYABLE",
      retry: { idempotencyKey: "staff-read-only", action: "read:schedule" },
    };
  }
  return {
    ...base,
    state,
    presentationCode:
      state === "empty"
        ? "APP-EMPTY"
        : state === "denied"
          ? "APP-DENIED"
          : "APP-DEPENDENCY-TERMINAL",
  };
}
