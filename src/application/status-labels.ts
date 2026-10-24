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
 * - tasks closed for new sign-ups by an admin: closed
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
  closed: "Lezárva",
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

/**
 * Status symbols. A symbol is shown before a status word wherever the status stands as its own
 * item (list badge, "Állapot" line, status column, status dropdown option), never inside a
 * sentence. Each symbol has two forms: an icon key (drawn as an inline vector icon next to lists
 * and detail pages, see `StatusBadge`) and a plain character for native dropdown options, which
 * cannot hold markup. The characters are text-presentation geometric symbols that system fonts
 * render without an emoji font.
 *
 * Approval states use the three symbols the person asked for: check (approved), cross (rejected)
 * and clock (pending).
 */
export const STATUS_ICON_CHARACTERS = Object.freeze({
  check: "✓",
  cross: "✕",
  clock: "◔",
  dot: "●",
  ring: "○",
  half: "◐",
  square: "■",
  diamond: "◆",
  calendar: "▦",
  pencil: "✎",
  arrow: "→",
  retry: "↻",
  undo: "↺",
  warning: "△",
  block: "⊘",
  pause: "‖",
  unknown: "?",
} as const);

export type StatusIconKey = keyof typeof STATUS_ICON_CHARACTERS;

export type StatusSymbol = Readonly<{ icon: StatusIconKey; character: string }>;

function symbolFor(icon: StatusIconKey): StatusSymbol {
  return Object.freeze({ icon, character: STATUS_ICON_CHARACTERS[icon] });
}

const STATUS_ICONS = {
  pending: "clock",
  approved: "check",
  rejected: "cross",
  active: "dot",
  archived: "ring",
  open: "half",
  scheduled: "calendar",
  assigned: "diamond",
  "notes-saved": "pencil",
  queued: "clock",
  sent: "arrow",
  retryable: "retry",
  retrying: "retry",
  "retry-scheduled": "clock",
  stale: "warning",
  cancelled: "block",
  closed: "block",
  terminal: "cross",
  "eligible-delete": "check",
  "eligible-anonymize": "check",
  blocked: "block",
  selected: "square",
  validated: "check",
  preview: "ring",
  conflicts: "warning",
  confirmed: "check",
  committed: "check",
  "rolled-back": "undo",
  interrupted: "pause",
  recovered: "retry",
  available: "dot",
  full: "square",
  ineligible: "block",
  "swap-pending": "clock",
  "cancellation-pending": "clock",
} as const satisfies Record<keyof typeof STATUS_LABELS, StatusIconKey>;

const DUTY_STATE_ICONS = {
  available: "dot",
  full: "square",
  ineligible: "block",
  assigned: "check",
  "swap-pending": "clock",
  "cancellation-pending": "clock",
} as const satisfies Record<keyof typeof DUTY_STATE_LABELS, StatusIconKey>;

/** The symbol of every key of `STATUS_LABELS`. */
export const STATUS_SYMBOLS: Readonly<Record<KnownStatus, StatusSymbol>> = Object.freeze(
  Object.fromEntries(
    Object.entries(STATUS_ICONS).map(([key, icon]) => [key, symbolFor(icon)]),
  ) as Record<KnownStatus, StatusSymbol>,
);

/** The symbol of every key of `DUTY_STATE_LABELS`. */
export const DUTY_STATE_SYMBOLS: Readonly<Record<DutyState, StatusSymbol>> = Object.freeze(
  Object.fromEntries(
    Object.entries(DUTY_STATE_ICONS).map(([key, icon]) => [key, symbolFor(icon)]),
  ) as Record<DutyState, StatusSymbol>,
);

/** The neutral symbol of an unknown status or of text that has no mapping. */
export const UNKNOWN_STATUS_SYMBOL: StatusSymbol = symbolFor("unknown");

/** Returns the symbol for a status value; an unknown value gets the neutral symbol. */
export function statusSymbol(value: string): StatusSymbol {
  return Object.hasOwn(STATUS_SYMBOLS, value)
    ? STATUS_SYMBOLS[value as KnownStatus]
    : UNKNOWN_STATUS_SYMBOL;
}

/** Returns the symbol for a parent duty state; an unknown value gets the neutral symbol. */
export function dutyStateSymbol(value: string): StatusSymbol {
  return Object.hasOwn(DUTY_STATE_SYMBOLS, value)
    ? DUTY_STATE_SYMBOLS[value as DutyState]
    : UNKNOWN_STATUS_SYMBOL;
}

/** A status as its own item: the word and the symbol that goes before it. */
export type StatusDisplay = Readonly<{ label: string; symbol: StatusSymbol | null }>;

export function statusDisplay(value: string): StatusDisplay {
  return { label: statusLabel(value), symbol: statusSymbol(value) };
}

export function dutyStateDisplay(value: string): StatusDisplay {
  return { label: dutyStateLabel(value), symbol: dutyStateSymbol(value) };
}

/** Option text for a native dropdown: the plain symbol character, a space, then the word. */
export function statusOptionText(value: string): string {
  return `${statusSymbol(value).character} ${statusLabel(value)}`;
}

/** Option text for the parent duty filter. */
export function dutyStateOptionText(value: string): string {
  return `${dutyStateSymbol(value).character} ${dutyStateLabel(value)}`;
}

/** Shown in the teacher status column when the source gives no status. */
export const NO_TEACHER_STATUS_LABEL = "Nincs elérhető állapot";

/**
 * The teacher schedule carries its status as free Hungarian text from the data source. Words the
 * source is known to use that differ from the shared label map are mapped here to a shared state.
 */
const TEACHER_STATUS_ALIASES: Readonly<Record<string, KnownStatus>> = Object.freeze({
  Ütemezett: "scheduled",
});

/**
 * Maps the teacher's free-text status to the shared word and symbol: a known word (or a source
 * word with an alias) shows the shared label and its symbol; any other text is shown unchanged
 * with the neutral symbol; no status shows the fixed notice and no symbol.
 */
export function teacherStatusDisplay(text: string | null): StatusDisplay {
  if (text === null) return { label: NO_TEACHER_STATUS_LABEL, symbol: null };
  const alias = Object.hasOwn(TEACHER_STATUS_ALIASES, text)
    ? TEACHER_STATUS_ALIASES[text]
    : undefined;
  if (alias) return statusDisplay(alias);
  const known = (Object.keys(STATUS_LABELS) as KnownStatus[]).find(
    (key) => STATUS_LABELS[key] === text,
  );
  return known ? statusDisplay(known) : { label: text, symbol: UNKNOWN_STATUS_SYMBOL };
}
