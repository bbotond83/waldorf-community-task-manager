import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  dutyStateDisplay,
  STATUS_ICON_CHARACTERS,
  statusDisplay,
  teacherStatusDisplay,
  type StatusIconKey,
} from "../../src/application/status-labels.ts";
import { StatusBadge } from "../../src/runtime/StatusBadge.tsx";

describe("StatusBadge", () => {
  it("shows the word with a decorative icon that assistive technology skips", () => {
    render(<StatusBadge testId="badge" {...statusDisplay("approved")} />);
    const badge = screen.getByTestId("badge");
    expect(badge).toHaveTextContent("Jóváhagyva");
    expect(badge).toHaveTextContent(/^Jóváhagyva$/);
    const icon = badge.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveAttribute("focusable", "false");
    expect(icon).toHaveAttribute("data-status-icon", "check");
    expect(screen.getByText("Jóváhagyva")).toBe(badge);
  });

  it("keeps the accessible name of a link that holds the badge unchanged", () => {
    render(
      <a href="/x">
        Kérelem <StatusBadge {...statusDisplay("rejected")} />
      </a>,
    );
    expect(screen.getByRole("link")).toHaveAccessibleName("Kérelem Elutasítva");
  });

  it("draws a distinct icon for every symbol key", () => {
    const keys = Object.keys(STATUS_ICON_CHARACTERS) as StatusIconKey[];
    for (const key of keys) {
      const { container, unmount } = render(
        <StatusBadge
          label="Állapot"
          symbol={{ icon: key, character: STATUS_ICON_CHARACTERS[key] }}
        />,
      );
      expect(
        container.querySelector(`svg[data-status-icon='${key}']`)?.childElementCount,
      ).toBeGreaterThan(0);
      unmount();
    }
  });

  it("colours the icon by meaning, not the word", () => {
    const { container } = render(
      <>
        <StatusBadge {...statusDisplay("approved")} />
        <StatusBadge {...statusDisplay("rejected")} />
        <StatusBadge {...statusDisplay("pending")} />
        <StatusBadge {...statusDisplay("active")} />
      </>,
    );
    const tones = Array.from(container.querySelectorAll("svg")).map((svg) =>
      Array.from(svg.classList).find((name) => name.startsWith("status-badge-icon-")),
    );
    expect(tones).toEqual([
      "status-badge-icon-positive",
      "status-badge-icon-negative",
      "status-badge-icon-pending",
      "status-badge-icon-neutral",
    ]);
  });

  it("renders the strong variant, a class and no icon without a symbol", () => {
    render(
      <StatusBadge as="strong" className="parent-state-badge" {...teacherStatusDisplay(null)} />,
    );
    const badge = screen.getByText("Nincs elérhető állapot");
    expect(badge.tagName).toBe("STRONG");
    expect(badge).toHaveClass("status-badge", "parent-state-badge");
    expect(badge.querySelector("svg")).toBeNull();
  });

  it("gives parent duty states and unknown values a symbol and a Hungarian word", () => {
    const { container } = render(
      <>
        <StatusBadge {...dutyStateDisplay("available")} />
        <StatusBadge {...statusDisplay("no-such-status")} />
      </>,
    );
    expect(container).toHaveTextContent("Jelentkezésre nyitottIsmeretlen állapot");
    expect(container.querySelector("svg[data-status-icon='unknown']")).not.toBeNull();
  });
});
