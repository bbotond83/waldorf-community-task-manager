import type {
  DomainOutcome,
  NotificationListModel,
  ReminderListModel,
  ReminderOutcome,
} from "../application/index.ts";
import { RetryableDataFailure, TerminalDataFailure } from "./errors.ts";
import type { DataGateway } from "./gateway.ts";
import { payloadNumber, payloadText, type Payload } from "./payload.ts";
import { toItemsOutcome, toOutcome } from "./results.ts";
import { flag, integer, isUuid, oneOf, optionalText, text } from "./values.ts";

/**
 * Notifications and reminders on the real database (BR40.2 to BR40.8, BR42.1, BR42.3): the parent's own
 * notification list and the read mark, and the admin's reminder list and retry. Each calls one named database
 * function. The reminder tick of the simulated delivery is lazy (no scheduler runs locally): the server runs
 * `reminder_run_due` when a parent opens the notification list and when an admin opens the reminders list.
 */

/**
 * Runs the lazy tick. The tick only moves due reminder jobs forward; the list that follows reads the
 * state as it is, whether or not the tick worked, so a failed tick (a lost connection, a denied caller) never
 * hides the list and never invents a state. The next time a list is opened the tick runs again.
 */
async function tick(gateway: DataGateway): Promise<void> {
  try {
    await gateway.call("reminder_run_due", {});
  } catch (error) {
    if (!(error instanceof RetryableDataFailure) && !(error instanceof TerminalDataFailure)) {
      throw error;
    }
  }
}

const TIMINGS = ["7-day", "24-hour", "within-threshold", "stale", "cancelled"] as const;
const PROVIDER_STATUSES = ["simulated-sent", "simulated-retry", "simulated-cancelled"] as const;
const REMINDER_STATUSES = [
  "queued",
  "sent",
  "retryable",
  "retrying",
  "stale",
  "cancelled",
  "terminal",
] as const;

/** The signed-in parent's own notifications, newest first (the database finds the parent from the session). */
export async function listNotifications(
  gateway: DataGateway,
): Promise<DomainOutcome<NotificationListModel>> {
  await tick(gateway);
  const envelope = await gateway.call("notification_list", {});
  return toItemsOutcome(envelope, (rows) =>
    Object.freeze({
      notifications: Object.freeze(
        rows.map((row) =>
          Object.freeze({
            id: text(row, "id"),
            title: text(row, "title"),
            ...(optionalText(row, "text") ? { text: optionalText(row, "text") as string } : {}),
            link: text(row, "link"),
            isRead: flag(row, "is_read"),
            timing: oneOf(row, "timing", TIMINGS),
            providerStatus: oneOf(row, "provider_status", PROVIDER_STATUSES),
          }),
        ),
      ),
    }),
  );
}

/** Marks one of the parent's own notifications as read and returns the link to follow. */
export async function markNotificationRead(
  gateway: DataGateway,
  notificationId: string,
): Promise<DomainOutcome<Readonly<{ link: string }>>> {
  // An id that is not a uuid names nothing: it reads like another parent's notification.
  if (!isUuid(notificationId)) return { state: "denied" };
  const envelope = await gateway.call("notification_mark_read", {
    p_notification_id: notificationId,
  });
  return toOutcome(envelope, (current) => Object.freeze({ link: text(current, "link") }));
}

/** The reminder jobs the admin reaches, one row per task and threshold (counts of recipients, never names). */
export async function listReminders(
  gateway: DataGateway,
  payload: Payload,
): Promise<DomainOutcome<ReminderListModel>> {
  await tick(gateway);
  const status = payloadText(payload, "status");
  const envelope = await gateway.call("reminder_list", { p_status: status ?? null });
  return toItemsOutcome(envelope, (rows) =>
    Object.freeze({
      jobs: Object.freeze(
        rows.map((row) =>
          Object.freeze({
            id: text(row, "id"),
            title: text(row, "title"),
            status: oneOf(row, "status", REMINDER_STATUSES),
            attempt: integer(row, "attempt"),
            correlationId: text(row, "correlation_id"),
            recipientSummary: text(row, "recipient_summary"),
            providerLabel: oneOf(row, "provider_label", ["Szimulált kézbesítés"] as const),
            version: integer(row, "version"),
          }),
        ),
      ),
    }),
  );
}

export type ReminderCall = Readonly<{ payload: Payload; idempotencyKey?: string }>;

/** Retries a retryable job as one action: the next tick records the attempt for all its recipients at once. */
export async function retryReminder(
  gateway: DataGateway,
  call: ReminderCall,
): Promise<DomainOutcome<ReminderOutcome>> {
  const key = call.idempotencyKey ?? "";
  const jobId = payloadText(call.payload, "id");
  if (jobId === undefined || !isUuid(jobId)) return { state: "denied" };
  const envelope = await gateway.call(
    "reminder_retry",
    {
      p_idempotency_key: key,
      p_job_id: jobId,
      p_expected_version: payloadNumber(call.payload, "expectedVersion") ?? null,
    },
    key,
  );
  return toOutcome(envelope, (current) =>
    Object.freeze({ jobId: current.reference ?? jobId, status: "retry-scheduled" as const }),
  );
}
