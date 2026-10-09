"use client";

import { useEffect } from "react";
import { markNotificationReadAction } from "../actions.ts";

/**
 * Marks the notification a task page was opened from as read. It runs only after the page has
 * really been shown in the browser (an effect on mount), never while the page is rendered on the
 * server, so a link preview or prefetch cannot mark anything. A failure is ignored: the task page
 * stays fully usable and the notification simply stays unread. It renders nothing.
 */
export function MarkNotificationRead({ notificationId }: Readonly<{ notificationId: string }>) {
  useEffect(() => {
    const formData = new FormData();
    formData.set("id", notificationId);
    // A fresh key per opening: the result of an earlier opening is never replayed, so the state
    // is written again after a fixture reset. Marking read itself is idempotent.
    formData.set("idempotencyKey", `notice:${notificationId}:open:${crypto.randomUUID()}`);
    markNotificationReadAction({ state: "initial" }, formData).catch(() => undefined);
  }, [notificationId]);
  return null;
}
