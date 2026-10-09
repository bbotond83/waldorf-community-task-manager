/**
 * Hungarian display labels for every status value that can reach the screen.
 *
 * Sources of the values:
 * - admin items (`AdminItemModel.state`, src/admin-core/synthetic-admin.ts): active, archived,
 *   open, scheduled, pending, approved, rejected, assigned, notes-saved
 * - reminder jobs (`ReminderJobModel.status`): queued, sent, retryable, retrying, stale,
 *   cancelled, terminal; reminder outcomes: retry-scheduled
 * - privacy candidates (`eligibility`): eligible-delete, eligible-anonymize, blocked
 * - import runs and outcomes: selected, validated, preview, conflicts, confirmed, committed,
 *   rolled-back, interrupted, recovered
 * - duty states: available, full, ineligible, assigned, swap-pending, cancellation-pending
 *
 * Only the displayed words are translated; the raw values in page addresses, filters and form
 * payloads stay unchanged.
 */
export const STATUS_LABELS = Object.freeze({
  pending: "Függőben",
  approved: "Jóváhagyva",
  rejected: "Elutasítva",
  active: "Aktív",
  archived: "Archivált",
  open: "Nyitott",
  scheduled: "Ütemezve",
  assigned: "Kiosztva",
  "notes-saved": "Jegyzet mentve",
  queued: "Sorban áll",
  sent: "Elküldve",
  retryable: "Újrapróbálható",
  retrying: "Újrapróbálás folyamatban",
  "retry-scheduled": "Újrapróbálás ütemezve",
  stale: "Elavult",
  cancelled: "Törölve",
  terminal: "Végleges hiba",
  "eligible-delete": "Törölhető",
  "eligible-anonymize": "Anonimizálható",
  blocked: "Blokkolt",
  selected: "Kiválasztva",
  validated: "Ellenőrizve",
  preview: "Előnézet",
  conflicts: "Ütközések",
  confirmed: "Megerősítve",
  committed: "Végrehajtva",
  "rolled-back": "Visszavonva",
  interrupted: "Megszakadt",
  recovered: "Helyreállítva",
  available: "Szabad",
  full: "Betelt",
  ineligible: "Nem vállalható",
  "swap-pending": "Csere függőben",
  "cancellation-pending": "Lemondás függőben",
} as const);

/**
 * Parent-facing words for the duty states. The parent task list and the task detail page both
 * read this one map, so they never disagree. The request words match the pending notices.
 */
export const DUTY_STATE_LABELS = Object.freeze({
  available: "Jelentkezésre nyitott",
  full: "Betelt",
  ineligible: "Nem jogosult",
  assigned: "Vállalt feladat",
  "swap-pending": "Cserekérelem folyamatban",
  "cancellation-pending": "Lemondási kérelem folyamatban",
} as const);

export type DutyState = keyof typeof DUTY_STATE_LABELS;

/** Returns the parent-facing Hungarian label for a duty state. */
export function dutyStateLabel(value: string): string {
  return Object.hasOwn(DUTY_STATE_LABELS, value)
    ? DUTY_STATE_LABELS[value as DutyState]
    : UNKNOWN_STATUS_LABEL;
}

/**
 * The statuses each admin list can contain (the filter offers exactly these). Records are active
 * or archived; tasks and events are open or scheduled; approvals are pending, approved or, once
 * a request is rejected, rejected.
 */
export const ADMIN_LIST_STATUS_OPTIONS = Object.freeze({
  records: ["active", "archived"],
  tasks: ["open", "scheduled"],
  approvals: ["pending", "approved", "rejected"],
} as const);

export type AdminListKind = keyof typeof ADMIN_LIST_STATUS_OPTIONS;

/**
 * Reads the status value of a list address. A value the list offers is used as is; an empty value
 * means no filter; any other value (for example an old link) shows the unfiltered list and is
 * reported as `unknown` so the page can say so instead of failing.
 */
export function resolveListStatus(
  kind: AdminListKind,
  raw: string,
): Readonly<{ state: string; unknown: boolean }> {
  if (raw === "") return { state: "", unknown: false };
  const offered: readonly string[] = ADMIN_LIST_STATUS_OPTIONS[kind];
  return offered.includes(raw) ? { state: raw, unknown: false } : { state: "", unknown: true };
}

export type KnownStatus = keyof typeof STATUS_LABELS;

export const UNKNOWN_STATUS_LABEL = "Ismeretlen állapot";

/** Returns the Hungarian label for a status value, never the raw English value. */
export function statusLabel(value: string): string {
  return Object.hasOwn(STATUS_LABELS, value)
    ? STATUS_LABELS[value as KnownStatus]
    : UNKNOWN_STATUS_LABEL;
}
