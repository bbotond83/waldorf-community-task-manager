import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ParentActionState } from "../../app/szulo/_lib/action-state.ts";
import { NotificationReadForm } from "../../app/szulo/_components/NotificationReadForm.tsx";

const markRead = vi.hoisted(() => vi.fn());
vi.mock("../../app/szulo/actions.ts", () => ({ markNotificationReadAction: markRead }));

const checkbox = () => screen.getByTestId("notification-read-checkbox-notice-1");

function renderForm(isRead = false) {
  return render(<NotificationReadForm id="notice-1" title="Közelgő feladat" isRead={isRead} />);
}

beforeEach(() => {
  markRead.mockReset();
  markRead.mockResolvedValue({
    state: "success",
    message: "Az értesítés olvasottként megjelölve.",
  });
});

describe("NotificationReadForm", () => {
  it("names the checkbox with the label followed by the notification title", () => {
    renderForm();
    expect(screen.getByRole("checkbox")).toHaveAccessibleName(
      "Olvasottnak jelölöm Közelgő feladat",
    );
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByRole("checkbox")).toBeEnabled();
  });

  it("marks the notification as read once, at the moment the box is ticked", async () => {
    renderForm();
    fireEvent.click(checkbox());
    await waitFor(() => expect(markRead).toHaveBeenCalledTimes(1));
    const formData = markRead.mock.calls[0]![1] as FormData;
    expect(formData.get("id")).toBe("notice-1");
    expect(formData.get("idempotencyKey")).toBe("notice:notice-1:read");
    await waitFor(() =>
      expect(screen.getByTestId("notification-state-notice-1-success")).toHaveTextContent(
        "olvasottként",
      ),
    );
    expect(screen.getByRole("status")).toBeVisible();
    // Read: ticked and disabled, so a second request is not possible.
    expect(checkbox()).toBeChecked();
    expect(checkbox()).toBeDisabled();
    expect(markRead).toHaveBeenCalledTimes(1);
  });

  it("moves focus to the card link after the read state is saved", async () => {
    render(
      <li>
        <a href="/x" data-testid="notification-link-notice-1">
          Közelgő feladat
        </a>
        <NotificationReadForm id="notice-1" title="Közelgő feladat" isRead={false} />
      </li>,
    );
    fireEvent.click(checkbox());
    await waitFor(() => expect(screen.getByTestId("notification-link-notice-1")).toHaveFocus());
    expect(checkbox()).toBeChecked();
    expect(checkbox()).toBeDisabled();
  });

  it("is disabled and busy while the request runs", async () => {
    let finish: (state: ParentActionState) => void = () => {};
    markRead.mockReturnValue(new Promise<ParentActionState>((resolve) => (finish = resolve)));
    renderForm();
    fireEvent.click(checkbox());
    await waitFor(() => expect(checkbox()).toBeDisabled());
    expect(checkbox()).toHaveAttribute("aria-busy", "true");
    finish({ state: "success", message: "Kész." });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Kész."));
    expect(checkbox()).toHaveAttribute("aria-busy", "false");
    expect(checkbox()).toBeDisabled();
  });

  it.each([
    ["conflict", "Az adatok időközben megváltoztak."],
    ["denied", "Nincs jogosultság."],
    ["terminal", "A művelet most nem hajtható végre."],
  ] as const)("returns to unticked with an alert after a %s failure", async (state, message) => {
    markRead.mockResolvedValue({ state, message });
    renderForm();
    fireEvent.click(checkbox());
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(message));
    expect(screen.getByTestId(`notification-state-notice-1-${state}`)).toBeVisible();
    expect(checkbox()).not.toBeChecked();
    expect(checkbox()).toBeEnabled();
    await waitFor(() => expect(checkbox()).toHaveFocus());
  });

  it("explains a validation result in Hungarian instead of showing the raw message", async () => {
    markRead.mockResolvedValue({
      state: "validation",
      message: "Ellenőrizze a megadott adatokat.",
    });
    renderForm();
    fireEvent.click(checkbox());
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Jelölje be a négyzetet"),
    );
  });

  it("shows an already read notification ticked and disabled", () => {
    renderForm(true);
    expect(checkbox()).toBeChecked();
    expect(checkbox()).toBeDisabled();
    expect(markRead).not.toHaveBeenCalled();
  });

  it("does nothing when the box is unticked again before any request", () => {
    renderForm();
    fireEvent.click(checkbox());
    fireEvent.click(checkbox());
    expect(markRead.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it("carries a Hungarian save button for use without JavaScript", () => {
    const markup = renderToStaticMarkup(
      <NotificationReadForm id="notice-1" title="Közelgő feladat" isRead={false} />,
    );
    expect(markup).toMatch(/<noscript><button[^>]*>Mentés<\/button><\/noscript>/);
    expect(markup).toContain('name="id"');
    expect(markup).toContain('name="idempotencyKey"');
  });
});
