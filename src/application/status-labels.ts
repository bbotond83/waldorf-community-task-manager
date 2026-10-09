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

export type KnownStatus = keyof typeof STATUS_LABELS;

export const UNKNOWN_STATUS_LABEL = "Ismeretlen állapot";

/** Returns the Hungarian label for a status value, never the raw English value. */
export function statusLabel(value: string): string {
  return Object.hasOwn(STATUS_LABELS, value)
    ? STATUS_LABELS[value as KnownStatus]
    : UNKNOWN_STATUS_LABEL;
}
