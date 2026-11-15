import type {
  DeliveryProblemsModel,
  DeliveryRetryOutcome,
  DomainOutcome,
  NotificationListModel,
} from "../application/index.ts";
import type { DataGateway } from "./gateway.ts";
import { payloadObjects, payloadText, type Payload } from "./payload.ts";
import { toOutcome } from "./results.ts";
import { asRows, flag, integer, isUuid, oneOf, optionalText, text } from "./values.ts";

/**
 * Notifications and email delivery on the real database (BR40.2, BR40.3, BR42.1, BR53): the parent's own notice list
 * and read mark, and the super admin's list of emails that could not be sent with Try again. Each calls one named
 * database function. Nothing here sends mail or runs a check: the timed command does that, outside the screens.
 */

const TIMINGS = ["7-day", "24-hour", "within-threshold", "stale", "cancelled"] as const;

/** Where a notice leads when the item it is about is gone: the notice list itself, so the link never dead-ends. */
export const NOTICE_LIST_PATH = "/szulo/ertesitesek";

/** The signed-in parent's own notices, newest first, one page of 50 (the database finds the parent from the session). */
export async function listNotifications(
  gateway: DataGateway,
): Promise<DomainOutcome<NotificationListModel>> {
  const envelope = await gateway.call("notification_list", {});
  const outcome = toOutcome(envelope, (current) => asRows(current.items));
  if (outcome.state !== "success") return outcome as DomainOutcome<NotificationListModel>;
  if (outcome.data.length === 0) return { state: "empty" };
  return {
    state: "success",
    data: Object.freeze({
      notifications: Object.freeze(
        outcome.data.map((row) => {
          const line = optionalText(row, "text");
          return Object.freeze({
            id: text(row, "id"),
            title: text(row, "title"),
            ...(line ? { text: line } : {}),
            link: optionalText(row, "link") ?? NOTICE_LIST_PATH,
            isRead: flag(row, "is_read"),
            timing: oneOf(row, "timing", TIMINGS),
          });
        }),
      ),
    }),
  };
}

/** Marks one of the parent's own notices as read and returns the link to follow. */
export async function markNotificationRead(
  gateway: DataGateway,
  notificationId: string,
): Promise<DomainOutcome<Readonly<{ link: string }>>> {
  // An id that is not a uuid names nothing: it reads like another parent's notice.
  if (!isUuid(notificationId)) return { state: "denied" };
  const envelope = await gateway.call("notification_mark_read", {
    p_notification_id: notificationId,
  });
  return toOutcome(envelope, (current) =>
    Object.freeze({ link: optionalText(current, "link") ?? NOTICE_LIST_PATH }),
  );
}

const CHECK_OUTCOMES = ["failed", "missing"] as const;

/**
 * The emails that failed, grouped by kind and item, and the timed checks that failed or were missing (BR53.1, BR52.7).
 * The database returns counts and ids only: no address, no parent or family name, no mail-server text.
 */
export async function listDeliveryProblems(
  gateway: DataGateway,
): Promise<DomainOutcome<DeliveryProblemsModel>> {
  const envelope = await gateway.call("delivery_problems_list", {});
  const outcome = toOutcome(envelope, (current) => ({
    groups: asRows(current.groups),
    checks: asRows(current.checks),
  }));
  if (outcome.state !== "success") return outcome as DomainOutcome<DeliveryProblemsModel>;
  const { groups, checks } = outcome.data;
  if (groups.length === 0 && checks.length === 0) return { state: "empty" };
  return {
    state: "success",
    data: Object.freeze({
      groups: Object.freeze(
        groups.map((row) =>
          Object.freeze({
            kind: text(row, "kind"),
            kindLabel: text(row, "kind_label"),
            targetType: text(row, "target_type"),
            targetId: text(row, "target_id"),
            title: text(row, "title"),
            latestTryAt: text(row, "latest_try_at"),
            failedCount: integer(row, "failed_count"),
            ...(optionalText(row, "reason") ? { reason: optionalText(row, "reason")! } : {}),
            deliveries: Object.freeze(
              asRows(row.deliveries).map((delivery) =>
                Object.freeze({
                  id: text(delivery, "id"),
                  tryCount: integer(delivery, "try_count"),
                }),
              ),
            ),
          }),
        ),
      ),
      checks: Object.freeze(
        checks.map((row) => {
          const code = optionalText(row, "error_code");
          return Object.freeze({
            checkName: text(row, "check_name"),
            runKind: text(row, "run_kind"),
            startedAt: text(row, "started_at"),
            outcome: oneOf(row, "outcome", CHECK_OUTCOMES),
            created: integer(row, "created"),
            skipped: integer(row, "skipped"),
            ...(code ? { errorCode: code } : {}),
          });
        }),
      ),
    }),
  };
}

export type DeliveryRetryCall = Readonly<{ payload: Payload; idempotencyKey?: string }>;

/**
 * Try again for one group. The call carries the (delivery id, try count) list the screen showed: the database
 * refuses with REMINDER_STALE when any of those emails has had another try since (BR53.3), so a click on an
 * outdated screen changes nothing.
 */
export async function retryDeliveries(
  gateway: DataGateway,
  call: DeliveryRetryCall,
): Promise<DomainOutcome<DeliveryRetryOutcome>> {
  const key = call.idempotencyKey ?? "";
  const kind = payloadText(call.payload, "kind");
  const targetType = payloadText(call.payload, "targetType");
  const targetId = payloadText(call.payload, "id");
  const expected = payloadObjects(call.payload, "expected");
  if (!kind || !targetType || targetId === undefined || !isUuid(targetId) || !expected) {
    return { state: "denied" };
  }
  const envelope = await gateway.call(
    "delivery_retry",
    {
      p_idempotency_key: key,
      p_kind: kind,
      p_target_type: targetType,
      p_target_id: targetId,
      p_expected: expected.map((entry) => ({ id: entry.id, try_count: entry.tryCount })),
    },
    key,
  );
  return toOutcome(envelope, (current) =>
    Object.freeze({
      targetId: current.reference ?? targetId,
      restarted: typeof current.restarted === "number" ? current.restarted : 0,
    }),
  );
}
