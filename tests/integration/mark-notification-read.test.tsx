import { render, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarkNotificationRead } from "../../app/szulo/_components/MarkNotificationRead.tsx";

const markRead = vi.hoisted(() => vi.fn());
vi.mock("../../app/szulo/actions.ts", () => ({ markNotificationReadAction: markRead }));

beforeEach(() => {
  markRead.mockReset();
  markRead.mockResolvedValue({ state: "success", message: "Az értesítés olvasott." });
});

describe("MarkNotificationRead", () => {
  it("marks the notification read once after the page is shown, and renders nothing", async () => {
    const { container } = render(<MarkNotificationRead notificationId="notice-7-day" />);
    expect(container).toBeEmptyDOMElement();
    await waitFor(() => expect(markRead).toHaveBeenCalledTimes(1));
    const formData = markRead.mock.calls[0]![1] as FormData;
    expect(formData.get("id")).toBe("notice-7-day");
    expect(String(formData.get("idempotencyKey"))).toMatch(/^notice:notice-7-day:open:[\w-]{8,}$/);
  });

  it("does not mark anything while rendering on the server", () => {
    expect(renderToStaticMarkup(<MarkNotificationRead notificationId="notice-7-day" />)).toBe("");
    expect(markRead).not.toHaveBeenCalled();
  });

  it("ignores a failed request, a refused result and a thrown error", async () => {
    markRead.mockResolvedValueOnce({ state: "denied", message: "Nincs jogosultság." });
    const first = render(<MarkNotificationRead notificationId="notice-a" />);
    await waitFor(() => expect(markRead).toHaveBeenCalledTimes(1));
    expect(first.container).toBeEmptyDOMElement();
    first.unmount();

    markRead.mockRejectedValueOnce(new Error("network"));
    const second = render(<MarkNotificationRead notificationId="notice-b" />);
    await waitFor(() => expect(markRead).toHaveBeenCalledTimes(2));
    expect(second.container).toBeEmptyDOMElement();
  });
});
