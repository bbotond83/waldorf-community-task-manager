import { TEACHER_GROUPS } from "../support/port-doubles.ts";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ApplicationResult, TrackingModel } from "../../src/application/index.ts";
import { ScheduleCollection } from "../../app/teacher/schedule/_components/ScheduleCollection.tsx";
import { ScheduleFilter } from "../../app/teacher/schedule/_components/ScheduleFilter.tsx";
import { TeacherStatePanel } from "../../app/teacher/_components/TeacherStatePanel.tsx";
import { COMMUNITY_FILTER, parseTeacherFilters } from "../../app/teacher/_lib/filters.ts";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const groups = TEACHER_GROUPS.map((group) => ({ id: group.scope.id, label: group.label }));
const filters = parseTeacherFilters({}, groups);
const model: TrackingModel = {
  entries: [
    {
      id: "schedule-test",
      groupId: "group-oak",
      ownerDisplayName: "Felelős Anna",
      assigneeDisplayNames: ["Beosztott Béla"],
      currentStatusLabel: "Nyitott",
      startsAt: "2026-08-13T06:30:00.000Z",
      endsAt: "2026-08-13T07:30:00.000Z",
      title: "Kitalált felügyelet",
      location: "Keleti udvar",
      coordinationDisplayName: "Kitalált Ágnes",
    },
  ],
};

describe("Teacher schedule components", () => {
  it("renders labelled bounded filters with stable interactive test IDs", () => {
    render(<ScheduleFilter filters={filters} />);
    expect(screen.getByLabelText("Munkacsoport")).toHaveValue("");
    expect(screen.getByLabelText("Kezdő dátum")).toHaveValue("");
    expect(screen.getByLabelText("Záró dátum")).toHaveValue("");
    expect(screen.getByTestId("teacher-schedule-filter-submit-button")).toBeVisible();
    expect(screen.getByTestId("teacher-schedule-filter-clear-link")).toBeVisible();
  });

  it("offers everything, the whole community and each working group, and does not require dates (W6)", () => {
    render(<ScheduleFilter filters={filters} />);
    const options = within(screen.getByLabelText("Munkacsoport")).getAllByRole("option");
    expect(options.map((option) => [option.getAttribute("value"), option.textContent])).toEqual([
      ["", "Minden"],
      [COMMUNITY_FILTER, "Egész közösség"],
      ["group-oak", "Tölgyfa csoport"],
      ["group-sunflower", "Napraforgó csoport"],
    ]);
    expect(screen.getByLabelText("Kezdő dátum")).not.toBeRequired();
    expect(screen.getByLabelText("Záró dátum")).not.toBeRequired();
  });

  it("shows the values of the address and clears every field with the clear link", () => {
    const filled = parseTeacherFilters(
      { groupId: "group-sunflower", from: "2026-08-13", to: "2026-08-15" },
      groups,
    );
    render(<ScheduleFilter filters={filled} />);
    expect(screen.getByLabelText("Munkacsoport")).toHaveValue("group-sunflower");
    expect(screen.getByLabelText("Kezdő dátum")).toHaveValue("2026-08-13");
    const clear = screen.getByTestId("teacher-schedule-filter-clear-link");
    expect(clear).toHaveAttribute("href", "/teacher/schedule");
    fireEvent.click(clear);
    expect(screen.getByLabelText("Munkacsoport")).toHaveValue("");
    expect(screen.getByLabelText("Kezdő dátum")).toHaveValue("");
    expect(screen.getByLabelText("Záró dátum")).toHaveValue("");
  });

  it("opens each entry and keeps the current filter in its address", () => {
    render(
      <ScheduleCollection
        entries={model.entries}
        filters={parseTeacherFilters({ from: "2026-08-13" }, groups)}
      />,
    );
    const href = screen.getByTestId("teacher-schedule-open-schedule-test").getAttribute("href");
    expect(href).toBe("/teacher/schedule/schedule-test?from=2026-08-13");
  });

  it("shows the status with its symbol and the shared word", () => {
    render(
      <ScheduleCollection
        entries={[{ ...model.entries[0]!, currentStatusLabel: "Ütemezett" }]}
        filters={filters}
      />,
    );
    const row = screen.getByTestId("teacher-schedule-row-schedule-test");
    expect(row).toHaveTextContent("Ütemezve");
    expect(row).not.toHaveTextContent("Ütemezett");
    expect(row.querySelector("svg[data-status-icon='calendar']")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("opens an entry from one whole-row link and one whole-card link with the same name", () => {
    render(<ScheduleCollection entries={model.entries} filters={filters} />);
    const table = screen.getByTestId("teacher-schedule-table");
    const cards = screen.getByTestId("teacher-schedule-card-list");
    const rowLink = screen.getByTestId("teacher-schedule-open-schedule-test");
    const cardLink = screen.getByTestId("teacher-schedule-card-open-schedule-test");
    expect(within(table).getAllByRole("link")).toHaveLength(1);
    expect(within(cards).getAllByRole("link")).toHaveLength(1);
    expect(rowLink).toHaveAccessibleName("Kitalált felügyelet");
    expect(cardLink).toHaveAccessibleName("Kitalált felügyelet");
    expect(rowLink.getAttribute("href")).toBe(cardLink.getAttribute("href"));
    expect(rowLink.getAttribute("href")).toMatch(/^\/teacher\/schedule\/schedule-test/);
    // The table keeps its row and cell semantics; the link sits in the title cell of its row.
    const row = within(table).getByRole("row", { name: /Kitalált felügyelet/ });
    expect(within(row).getAllByRole("cell")).toHaveLength(8);
    expect(within(row).getByRole("link")).toBe(rowLink);
    expect(within(table).getAllByRole("columnheader")).toHaveLength(8);
    expect(document.body).not.toHaveTextContent("Részletek");
  });

  it("renders desktop table and mobile cards from one authorized model, naming the working group", () => {
    render(<ScheduleCollection entries={model.entries} filters={filters} />);
    const table = screen.getByTestId("teacher-schedule-table");
    const cards = screen.getByTestId("teacher-schedule-card-list");
    expect(within(table).getByText("Kitalált felügyelet")).toBeVisible();
    expect(within(cards).getByText("Kitalált felügyelet")).toBeVisible();
    expect(within(table).getByRole("cell", { name: "Tölgyfa csoport" })).toBeVisible();
    expect(within(cards).getAllByText("Tölgyfa csoport").length).toBeGreaterThan(0);
  });

  it("names a community-wide entry as the whole community", () => {
    render(
      <ScheduleCollection entries={[{ ...model.entries[0]!, groupId: null }]} filters={filters} />,
    );
    expect(
      within(screen.getByTestId("teacher-schedule-table")).getByRole("cell", {
        name: "Egész közösség",
      }),
    ).toBeVisible();
  });

  it("renders an empty state with a clear-filter link", () => {
    render(
      <TeacherStatePanel result={result("empty")} retryHref="/retry" testId="teacher-test">
        {() => null}
      </TeacherStatePanel>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Nincs találat");
    expect(screen.getByTestId("teacher-test-clear-link")).toHaveAttribute(
      "href",
      "/teacher/schedule",
    );
  });

  it("offers retry only for the classified retryable state", () => {
    const { rerender } = render(
      <TeacherStatePanel
        result={result("dependency-failure-retryable")}
        retryHref="/retry"
        testId="teacher-test"
      >
        {() => null}
      </TeacherStatePanel>,
    );
    expect(screen.getByTestId("teacher-test-retry-link")).toHaveAttribute("href", "/retry");
    rerender(
      <TeacherStatePanel
        result={result("dependency-failure-terminal")}
        retryHref="/retry"
        testId="teacher-test"
      >
        {() => null}
      </TeacherStatePanel>,
    );
    expect(screen.queryByTestId("teacher-test-retry-link")).not.toBeInTheDocument();
  });

  it("renders generic denial without protected identifiers", () => {
    render(
      <TeacherStatePanel result={result("denied")} retryHref="/retry" testId="teacher-test">
        {() => null}
      </TeacherStatePanel>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("A kért tartalom nem érhető el");
    expect(document.body.textContent).not.toMatch(
      /email|telefon|család|lakhely|indok|hozzárendelés/iu,
    );
  });
});

function result(
  state: "empty" | "denied" | "dependency-failure-retryable" | "dependency-failure-terminal",
): ApplicationResult<TrackingModel> {
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
      retry: { idempotencyKey: "teacher-read-only", action: "read:schedule" },
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

it("Teacher table cards and detail fields render explicit absence equally", () => {
  const entry = {
    ...model.entries[0]!,
    ownerDisplayName: null,
    assigneeDisplayNames: [],
    currentStatusLabel: null,
  };
  render(<ScheduleCollection entries={[entry]} filters={filters} />);
  for (const id of ["teacher-schedule-table", "teacher-schedule-card-list"]) {
    const view = within(screen.getByTestId(id));
    for (const copy of ["Nincs kijelölt felelős", "Nincs beosztott", "Nincs elérhető állapot"])
      expect(view.getByText(copy)).toBeVisible();
  }
});
it("Teacher displayed hostile source strings remain text without executable markup", () => {
  const hostile = '<img src=x onerror="sentinel()">';
  const entry = {
    ...model.entries[0]!,
    title: hostile,
    ownerDisplayName: hostile,
    assigneeDisplayNames: [hostile],
    currentStatusLabel: hostile,
  };
  const { container } = render(<ScheduleCollection entries={[entry]} filters={filters} />);
  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelector("script")).toBeNull();
  expect(container.textContent).toContain(hostile);
  expect(container.innerHTML).toContain("&lt;img");
});
it("Teacher components expose no write controls and include current fields in both representations", () => {
  render(<ScheduleCollection entries={model.entries} filters={filters} />);
  for (const id of ["teacher-schedule-table", "teacher-schedule-card-list"]) {
    const view = within(screen.getByTestId(id));
    for (const copy of ["Felelős Anna", "Beosztott Béla", "Nyitott"])
      expect(view.getByText(copy)).toBeVisible();
  }
  expect(screen.queryByRole("button", { name: /mentés|törlés|szerkeszt|jóváhagy/iu })).toBeNull();
});
