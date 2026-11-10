import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type {
  ApplicationResult,
  WorkingGroupItem,
  WorkingGroupListModel,
} from "../../src/application/index.ts";
import { WorkingGroupList } from "../../src/runtime/WorkingGroupList.tsx";

const group = (id: string, name: string, schoolYearName = "2026/2027"): WorkingGroupItem => ({
  id,
  name,
  description: `${name} leírása.`,
  schoolYearId: `year-${schoolYearName}`,
  schoolYearName,
});

const success = (items: readonly WorkingGroupItem[]): ApplicationResult<WorkingGroupListModel> =>
  ({ state: "success", data: { items } }) as ApplicationResult<WorkingGroupListModel>;

const state = (name: "empty" | "denied" | "invalidated" | "dependency-failure-terminal") =>
  ({ state: name }) as ApplicationResult<WorkingGroupListModel>;

describe("the working-group list (W3)", () => {
  it("shows each group as a card with its name and description under the school year", () => {
    render(
      <WorkingGroupList
        result={success([group("g-1", "Játszókert"), group("g-2", "Karbantartó")])}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Munkacsoportok" })).toBeVisible();
    expect(screen.getByText("2026/2027-es nevelési év")).toBeVisible();
    expect(screen.getByText("A közösség munkacsoportjai ebben a nevelési évben.")).toBeVisible();
    const card = within(screen.getByTestId("workgroup-card-g-1"));
    expect(card.getByRole("heading", { level: 2, name: "Játszókert" })).toBeVisible();
    expect(card.getByText("Játszókert leírása.")).toBeVisible();
    expect(screen.getByTestId("workgroup-list").children).toHaveLength(2);
  });

  it("is read-only: no button, link, count, person or badge on a card", () => {
    render(<WorkingGroupList result={success([group("g-1", "Játszókert")])} />);
    const card = screen.getByTestId("workgroup-card-g-1");
    expect(within(card).queryByRole("button")).toBeNull();
    expect(within(card).queryByRole("link")).toBeNull();
    expect(card.querySelector("svg, img, [data-status-icon]")).toBeNull();
    expect(card.textContent).toBe("JátszókertJátszókert leírása.");
  });

  it("groups an older school year after the newest one", () => {
    render(
      <WorkingGroupList
        result={success([group("g-1", "Új", "2026/2027"), group("g-2", "Régi", "2025/2026")])}
      />,
    );
    const eyebrows = screen.getAllByText(/nevelési év$/).map((node) => node.textContent);
    expect(eyebrows).toEqual(["2026/2027-es nevelési év", "2025/2026-es nevelési év"]);
    expect(screen.getAllByTestId("workgroup-list")).toHaveLength(2);
  });

  it("shows the empty state as a status with the approved text", () => {
    render(<WorkingGroupList result={state("empty")} />);
    expect(screen.getByRole("status")).toHaveTextContent("Még nincs munkacsoport.");
    expect(screen.queryByTestId("workgroup-list")).toBeNull();
  });

  it.each(["denied", "invalidated"] as const)(
    "shows %s as the denied state, never the empty one",
    (name) => {
      render(<WorkingGroupList result={state(name)} />);
      const alert = screen.getByRole("alert");
      expect(alert).toHaveAttribute("data-testid", "workgroup-denied");
      expect(alert).toHaveTextContent("Nincs jogosultság");
      expect(screen.queryByText("Még nincs munkacsoport.")).toBeNull();
    },
  );

  it("shows a failed read as the error state, never the empty one", () => {
    render(<WorkingGroupList result={state("dependency-failure-terminal")} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("data-testid", "workgroup-error");
    expect(alert).toHaveTextContent("Hiba történt");
    expect(screen.queryByText("Még nincs munkacsoport.")).toBeNull();
  });

  it("keeps a hostile description as plain text", () => {
    const hostile = '<img src=x onerror="sentinel()">';
    const { container } = render(
      <WorkingGroupList result={success([{ ...group("g-1", "A"), description: hostile }])} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText(hostile)).toBeVisible();
  });
});
