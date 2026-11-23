import type { RecurringItem, RecurringScheduleItem } from "./contracts.ts";
import { isoToBudapestLocal } from "./budapest-time.ts";
import { budapestToday } from "./library-format.ts";
import { formatLongDay, formatShortDay, weekdayName } from "./rota-format.ts";

/**
 * The words and dates of the recurring-duty screens (U9). Dates arrive as `YYYY-MM-DD` and moments as instants; the
 * functions are pure (the moment of "now" is an argument), so the screens and their tests read the same text.
 */

/** The months as the season fields name them, January first. */
export const MONTH_NAMES = [
  "január",
  "február",
  "március",
  "április",
  "május",
  "június",
  "július",
  "augusztus",
  "szeptember",
  "október",
  "november",
  "december",
] as const;

/** How often a schedule comes back: every N weeks, or every Nth published water week for the bottle cleaning. */
export function intervalText(
  schedule: Pick<RecurringScheduleItem, "intervalKind" | "intervalCount">,
): string {
  const n = schedule.intervalCount;
  if (schedule.intervalKind === "rota_weeks") {
    return n === 1 ? "Minden vízhordó héten" : `Minden ${n}. vízhordó héten`;
  }
  if (n === 1) return "Hetente";
  return n === 2 ? "Kéthetente" : `${n} hetente`;
}

/** The season of a schedule as "április–október", or nothing when it runs all year. */
export function seasonText(
  schedule: Pick<RecurringScheduleItem, "seasonFromMonth" | "seasonToMonth">,
): string | undefined {
  const { seasonFromMonth: from, seasonToMonth: to } = schedule;
  if (from === undefined || to === undefined) return undefined;
  const first = MONTH_NAMES[from - 1];
  const last = MONTH_NAMES[to - 1];
  return first && last ? `${first}–${last}` : undefined;
}

export type RecurringState = "overdue" | "due" | "upcoming" | "done" | "skipped";

/** The words of each state, shown next to its colour and symbol (NFR4.8). */
export const RECURRING_STATE_LABELS: Readonly<Record<RecurringState, string>> = Object.freeze({
  overdue: "Lejárt",
  due: "Esedékes",
  upcoming: "Következő",
  done: "Kész",
  skipped: "Kihagyva",
});

function dayNumber(value: string): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match
    ? Math.round(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000)
    : undefined;
}

/** Whole days from `from` to `to` (negative when `to` is earlier); 0 when either is not a date. */
export function daysBetween(from: string, to: string): number {
  const a = dayNumber(from);
  const b = dayNumber(to);
  return a === undefined || b === undefined ? 0 : b - a;
}

/** The state an occurrence is shown in. "Overdue" is not stored: it is an open occurrence past its due date. */
export function recurringState(
  item: Pick<RecurringItem, "dueDate" | "status" | "isOverdue">,
  today: string,
): RecurringState {
  if (item.status === "done") return "done";
  if (item.status === "skipped") return "skipped";
  if (item.isOverdue || item.dueDate < today) return "overdue";
  return item.dueDate === today ? "due" : "upcoming";
}

/** The due line of an open occurrence: "Esedékes: ma (hétfő)", "Esedékes volt: 3 napja (…)" or the date ahead. */
export function dueLine(dueDate: string, today: string): string {
  const days = daysBetween(today, dueDate);
  const date = formatLongDay(dueDate);
  const weekday = weekdayName(dueDate);
  if (days === 0) return `Esedékes: ma (${weekday})`;
  if (days < 0) {
    return days === -1
      ? `Esedékes volt: tegnap (${date})`
      : `Esedékes volt: ${-days} napja (${date})`;
  }
  const ahead = days === 1 ? "holnap" : `${days} nap múlva`;
  return `Esedékes: ${date} (${weekday}) • ${ahead}`;
}

function shiftDay(value: string, days: number): string {
  const number = dayNumber(value);
  return number === undefined
    ? value
    : new Date((number + days) * 86_400_000).toISOString().slice(0, 10);
}

/** A moment as "ma 09:12", "tegnap 16:40" or "2026. nov. 20. 15:30", in Budapest time. Empty when it is not an instant. */
export function formatMoment(iso: string | undefined, now: Date = new Date()): string {
  const local = isoToBudapestLocal(iso);
  if (!local) return "";
  const date = local.slice(0, 10);
  const time = local.slice(11, 16);
  const today = budapestToday(now);
  if (date === today) return `ma ${time}`;
  if (date === shiftDay(today, -1)) return `tegnap ${time}`;
  return `${formatShortDay(date)} ${time}`;
}
