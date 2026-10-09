import { sessionGrantBindings } from "../../src/access/session-grants.ts";
import { TEACHER_GROUPS } from "../../src/teacher-web/index.ts";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ApplicationResult, TrackingModel } from "../../src/application/index.ts";
import { ScheduleCollection } from "../../app/teacher/schedule/_components/ScheduleCollection.tsx";
import { ScheduleFilter } from "../../app/teacher/schedule/_components/ScheduleFilter.tsx";
import { TeacherStatePanel } from "../../app/teacher/_components/TeacherStatePanel.tsx";
import { DEFAULT_TEACHER_FILTERS, parseTeacherFilters } from "../../app/teacher/_lib/filters.ts";

const session = {
  subjectId: "teacher",
  authorizationVersion: 1,
  ...sessionGrantBindings(
    "teacher",
    "kindergarten_teacher",
    TEACHER_GROUPS.map((group) => group.scope),
  ),
  roles: ["kindergarten_teacher"] as const,
  scopes: TEACHER_GROUPS.map((group) => group.scope),
  runtimeMode: "synthetic" as const,
  isSynthetic: true,
};
const filters = parseTeacherFilters({}, session);
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
    expect(screen.getByLabelText("Csoport")).toHaveValue(filters.groupId);
    expect(screen.getByLabelText("Kezdő dátum")).toHaveValue(DEFAULT_TEACHER_FILTERS.from);
    expect(screen.getByLabelText("Záró dátum")).toHaveValue(DEFAULT_TEACHER_FILTERS.to);
    expect(screen.getByTestId("teacher-schedule-filter-submit-button")).toBeVisible();
    expect(screen.getByTestId("teacher-schedule-filter-clear-link")).toBeVisible();
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
    expect(rowLink.getAttribute("href")).toMatch(/^\/teacher\/schedule\/schedule-test\?/);
    // The table keeps its row and cell semantics; the link sits in the title cell of its row.
    const row = within(table).getByRole("row", { name: /Kitalált felügyelet/ });
    expect(within(row).getAllByRole("cell")).toHaveLength(8);
    expect(within(row).getByRole("link")).toBe(rowLink);
    expect(within(table).getAllByRole("columnheader")).toHaveLength(8);
    expect(document.body).not.toHaveTextContent("Részletek");
  });

  it("renders desktop table and mobile cards from one authorized model", () => {
    render(<ScheduleCollection entries={model.entries} filters={filters} />);
    const table = screen.getByTestId("teacher-schedule-table");
    const cards = screen.getByTestId("teacher-schedule-card-list");
    expect(within(table).getByText("Kitalált felügyelet")).toBeVisible();
    expect(within(cards).getByText("Kitalált felügyelet")).toBeVisible();
    expect(within(table).getByText("Tölgyfa csoport")).toBeVisible();
    expect(within(cards).getByText("Tölgyfa csoport")).toBeVisible();
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
