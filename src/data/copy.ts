import { STATUS_LABELS } from "../application/status-labels.ts";

/**
 * The few Hungarian words the database adapters put on a screen themselves: titles built from stored data
 * (an approval is named after its kind and task), the two recipient choices of the reminder setting, the
 * reasons a family is held back from deletion, and the schedule status words. Everything else a person reads
 * comes from the screens' own copy and message tables.
 */
export const APPROVAL_KIND_TITLES = Object.freeze({
  swap: "Feladatcsere-kérelem",
  cancellation: "Lemondási kérelem",
} as const);

export const RECIPIENT_OPTIONS = Object.freeze([
  {
    id: "recipient-duty",
    scope: "duty",
    label: "Aktív feladatok érintettjei",
    summary: "Csak a kijelölt feladatok családjai",
  },
  {
    id: "recipient-group",
    scope: "group",
    label: "A csoport családjai",
    summary: "A csoport aktív családjai",
  },
] as const);

/** The scope label of a grant that covers the whole organization. */
export const ORGANIZATION_SCOPE_LABEL = "Teljes szervezet";
/** The scope label of a group grant whose group name is not shown. */
export const GROUP_SCOPE_LABEL = "Csoport";

const BLOCKER_SUMMARIES: Readonly<Record<string, string>> = Object.freeze({
  grace_period: "A türelmi idő még tart",
  hold: "Aktív megőrzési kötelezettség",
});

/** One line for the blocker codes of a family; an unknown code is shown as a generic reason. */
export function blockerSummary(blockers: readonly string[]): string | undefined {
  if (blockers.length === 0) return undefined;
  return blockers
    .map((blocker) => BLOCKER_SUMMARIES[blocker] ?? "A család jelenleg nem törölhető")
    .join("; ");
}

const SCHEDULE_STATUS_WORDS: Readonly<Record<string, string>> = Object.freeze({
  open: STATUS_LABELS.open,
  full: STATUS_LABELS.full,
  cancelled: STATUS_LABELS.cancelled,
});

/** The schedule's status word for the stored label; no known label means no status. */
export function scheduleStatusLabel(label: string | null): string | null {
  if (label === null) return null;
  return SCHEDULE_STATUS_WORDS[label] ?? null;
}
