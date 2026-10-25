import type { NotificationModel } from "./contracts.ts";

/** The address parameter that carries the notification a task page was opened from. */
export const NOTIFICATION_CONTEXT_PARAMETER = "ertesites";

/** The page every parent notification list lives on. */
export const NOTIFICATION_LIST_PATH = "/szulo/ertesitesek";

/**
 * The address a notification card opens. A task-targeted notification opens its task page with
 * its own id as context; a notification that already points elsewhere (for example the list
 * itself) keeps its link and carries no context.
 */
export function notificationHref(notification: Pick<NotificationModel, "id" | "link">): string {
  const taskPath = /^\/szulo\/feladatok\/[a-z0-9][a-z0-9-]*$/;
  if (!taskPath.test(notification.link)) return notification.link;
  return `${notification.link}?${NOTIFICATION_CONTEXT_PARAMETER}=${encodeURIComponent(notification.id)}`;
}

/**
 * The notification a task page was opened from, or `undefined` when the address carries none.
 * The context counts only when the notification is one of the signed-in parent's own and its
 * target is exactly this task; an unknown id, another task's notification, or a notification
 * that points to the list itself behaves as if the parameter were absent.
 */
export function resolveNotificationContext(
  notifications: readonly NotificationModel[],
  notificationId: string | undefined,
  dutyId: string,
): NotificationModel | undefined {
  if (!notificationId) return undefined;
  const notification = notifications.find((candidate) => candidate.id === notificationId);
  if (!notification) return undefined;
  return notification.link === `/szulo/feladatok/${dutyId}` ? notification : undefined;
}

export type PendingRequests = Readonly<{ swap: boolean; cancellation: boolean; any: boolean }>;

/** Which request kinds are waiting on a task, read from its state. */
export function pendingRequests(duty: Readonly<{ state: string }>): PendingRequests {
  const swap = duty.state === "swap-pending";
  const cancellation = duty.state === "cancellation-pending";
  return { swap, cancellation, any: swap || cancellation };
}
