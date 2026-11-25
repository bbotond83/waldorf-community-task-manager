import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TASK = "11111111-1111-4111-8111-111111111111";

const world = vi.hoisted(() => ({
  claim: vi.fn(),
  done: vi.fn(),
}));

vi.mock("../../app/_todo/actions.ts", () => ({
  claimTodoAction: world.claim,
  markTodoDoneAction: world.done,
  freeTodoClaimAction: vi.fn(),
  giveBackTodoAction: vi.fn(),
  pullTodosAction: vi.fn(),
  saveTodoAction: vi.fn(),
  undoTodoDoneAction: vi.fn(),
  updateTodoAction: vi.fn(),
}));
vi.mock("../../app/_recurring/actions.ts", () => ({ markDoneAction: vi.fn() }));

import { announceTodo, TodoStatusRegion } from "../../app/_todo/TodoAnnouncer.tsx";
import { ClaimButton, DoneButton } from "../../app/_todo/TodoForms.tsx";

beforeEach(() => {
  world.claim.mockReset();
  world.done.mockReset();
});

describe("the page's status region", () => {
  it("is always on the page, polite, and empty until something is announced", () => {
    render(<TodoStatusRegion />);
    const region = screen.getByTestId("todo-status-region");
    expect(region.getAttribute("role")).toBe("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.textContent).toBe("");
  });

  it("says a success in Hungarian after a one-press action, and stays after the button is gone", async () => {
    world.claim.mockResolvedValue({ state: "success", message: "Vállaltad a teendőt." });
    const { rerender } = render(
      <>
        <TodoStatusRegion />
        <ClaimButton taskId={TASK} topic="Kerítésjavítás" version={1} />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Vállalom: Kerítésjavítás" }));
    await waitFor(() =>
      expect(screen.getByTestId("todo-status-region").textContent).toBe("Vállaltad a teendőt."),
    );
    // The refresh that follows the success replaces the card: the button is gone, the announcement stays.
    rerender(<TodoStatusRegion />);
    expect(screen.getByTestId("todo-status-region").textContent).toBe("Vállaltad a teendőt.");
  });

  it("says the same message again when the same result comes twice", async () => {
    render(<TodoStatusRegion />);
    act(() => announceTodo("A teendő kész."));
    const first = screen.getByText("A teendő kész.");
    act(() => announceTodo("A teendő kész."));
    expect(screen.getByText("A teendő kész.")).not.toBe(first);
  });

  it("does not announce a refusal: the form that failed shows it with its own alert", async () => {
    world.done.mockResolvedValue({ state: "denied", message: "Nincs jogosultság." });
    render(
      <>
        <TodoStatusRegion />
        <DoneButton taskId={TASK} topic="Veteményes" version={2} />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Kész: Veteményes" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Nincs jogosultság."),
    );
    expect(screen.getByTestId("todo-status-region").textContent).toBe("");
  });
});
