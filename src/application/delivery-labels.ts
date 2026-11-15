import { createHash } from "node:crypto";
import { isoToBudapestLocal } from "./budapest-time.ts";

/**
 * Hungarian wording of the delivery-failure screen. A failed email shows only the reason class, never a mail-server code or
 * text. An unknown class reads as a general failure.
 */
const REASONS: Readonly<Record<string, string>> = Object.freeze({
  mail_unavailable: "a levelezőszerver nem elérhető",
  mail_rejected: "a levelezőszerver elutasította a levelet",
  claim_expired: "a küldés megszakadt, nem érkezett visszajelzés",
});

export const UNKNOWN_REASON = "ismeretlen ok";

export function deliveryReasonLabel(reason: string | undefined): string {
  return (reason && REASONS[reason]) || UNKNOWN_REASON;
}

const CHECKS: Readonly<Record<string, string>> = Object.freeze({
  duty_reminders: "Feladat-emlékeztetők",
  housekeeping: "Takarítás és karbantartás",
});

/** A registered check's name in words; an unregistered name is shown as it is (it holds no person data). */
export function checkLabel(name: string): string {
  return CHECKS[name] ?? name;
}

export const CHECK_OUTCOME_LABELS = Object.freeze({
  failed: "Hibás",
  missing: "Hiányzik",
}) satisfies Readonly<Record<"failed" | "missing", string>>;

/** `2026-11-14T06:15:00+00:00` as `2026. 11. 14. 07:15` in the school's own time. */
export function formatMoment(iso: string): string {
  const local = isoToBudapestLocal(iso);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})$/.exec(local);
  return match ? `${match[1]}. ${match[2]}. ${match[3]}. ${match[4]}` : iso;
}

/**
 * The idempotency key of one Try again click: the group and a hash of the whole shown (delivery id, try count) list,
 * sorted by id. Two different lists never share a key (a sum of the try counts could: 3 + 3 and 6 + 0), and the same
 * list always does, so a repeated click is replayed.
 */
export function deliveryRetryKey(
  kind: string,
  targetId: string,
  deliveries: readonly Readonly<{ id: string; tryCount: number }>[],
): string {
  const list = [...deliveries]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((entry) => `${entry.id}:${entry.tryCount}`)
    .join(",");
  return `delivery-retry-${kind}-${targetId}-${createHash("sha256").update(list).digest("hex").slice(0, 32)}`;
}
