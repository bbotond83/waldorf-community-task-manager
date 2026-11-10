/**
 * Hungarian wording for the school calendar and the rota screens (U2): dates of a week, which week is "now", and
 * one plain message for every refusal code the database can give. The functions are pure, so the screens, the
 * actions and their tests all read the same words.
 */

const MONTHS_SHORT = [
  "jan.",
  "febr.",
  "márc.",
  "ápr.",
  "máj.",
  "jún.",
  "júl.",
  "aug.",
  "szept.",
  "okt.",
  "nov.",
  "dec.",
] as const;

const MONTHS_LONG = [
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

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

type Day = Readonly<{ year: number; month: number; day: number }>;

function parseDay(value: string): Day | undefined {
  const match = DAY.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  const valid =
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day;
  return valid ? { year, month, day } : undefined;
}

function addDays(value: string, days: number): string | undefined {
  const parsed = parseDay(value);
  if (!parsed) return undefined;
  const moved = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
  return moved.toISOString().slice(0, 10);
}

/** "2026. november 2." for a calendar day; the text itself when it is not a day. */
export function formatLongDay(value: string): string {
  const day = parseDay(value);
  return day ? `${day.year}. ${MONTHS_LONG[day.month - 1]} ${day.day}.` : value;
}

/** "2026. nov. 2." for a calendar day, as the week tables write it. */
export function formatShortDay(value: string): string {
  const day = parseDay(value);
  return day ? `${day.year}. ${MONTHS_SHORT[day.month - 1]} ${day.day}.` : value;
}

/** The Monday-to-Sunday week that starts on `weekStart`: "2026. nov. 2–8." or "2026. okt. 26. – nov. 1.". */
export function formatWeekRange(weekStart: string): string {
  const first = parseDay(weekStart);
  const lastText = addDays(weekStart, 6);
  const last = lastText ? parseDay(lastText) : undefined;
  if (!first || !last) return weekStart;
  if (first.year === last.year && first.month === last.month) {
    return `${first.year}. ${MONTHS_SHORT[first.month - 1]} ${first.day}–${last.day}.`;
  }
  if (first.year === last.year) {
    return `${first.year}. ${MONTHS_SHORT[first.month - 1]} ${first.day}. – ${MONTHS_SHORT[last.month - 1]} ${last.day}.`;
  }
  return `${formatShortDay(weekStart)} – ${formatShortDay(lastText!)}`;
}

/** The weekday name of a day: "hétfő" for a Monday. */
export function weekdayName(value: string): string {
  const day = parseDay(value);
  if (!day) return "";
  const names = ["vasárnap", "hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat"];
  return names[new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay()]!;
}

/** Where a week stands next to today: the week now, the one after it, or neither. */
export type WeekPhase = "current" | "next" | "other";

export function weekPhase(weekStart: string, today: string): WeekPhase {
  const last = addDays(weekStart, 6);
  const next = addDays(weekStart, -7);
  if (!last || !next || !parseDay(today)) return "other";
  if (today >= weekStart && today <= last) return "current";
  const lastOfPrevious = addDays(weekStart, -1)!;
  if (today >= next && today <= lastOfPrevious) return "next";
  return "other";
}

/** Today's date in Budapest as `YYYY-MM-DD`: the school's own day, whatever the server's clock zone is. */
export function budapestToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Budapest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts;
}

/** The refusal codes of the calendar and the rota, each with one plain sentence (W1 to W5, BR25.1). */
const REFUSAL_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  ROTA_PLAN_EXISTS:
    "Ehhez a tanévhez már van beosztás, ezért ez a művelet most nem végezhető el. Ha elölről kezdené, előbb vesse el a tervezetet.",
  ROTA_PLAN_PUBLISHED: "A beosztás már közzé van téve, ezért nem módosítható és nem vethető el.",
  ROTA_FAMILY_INELIGIBLE:
    "Ez a család nem osztható be: nem aktív, vagy nem ehhez a közösséghez tartozik.",
  ROTA_BREAK_WEEK: "Szünetes hétre nem osztható be család. Üresítse ki a hetet.",
  ROTA_WEEKS_EMPTY: "A közzététel előtt minden tanítási hétnek családot kell adni.",
  ROTA_DISCARD_OUTDATED:
    "A kézzel módosított hetek száma közben megváltozott. Nézze át a tervezetet, és vesse el újra.",
  BREAK_WEEK_INVALID: "A szünet első napja a tanév egyik tanítási hetének hétfője legyen.",
  BREAK_WEEK_EXISTS: "Ez a hét már szünetként szerepel.",
  DUTY_ROTA_MANAGED: "Ez a feladat a beosztás része, ezért itt nem módosítható.",
  VERSION_CONFLICT: "Az adatok időközben megváltoztak. Töltse újra az oldalt.",
  idempotency_key_reused:
    "Ez a kérés már más tartalommal el lett küldve. Töltse újra az oldalt, és próbálja újra.",
});

const FALLBACK_REFUSAL = "A művelet most nem hajtható végre.";

/** The Hungarian sentence for a refusal code; a code this table does not know gets the general sentence. */
export function rotaRefusalMessage(code: string | undefined): string {
  return code !== undefined && Object.hasOwn(REFUSAL_MESSAGES, code)
    ? REFUSAL_MESSAGES[code]!
    : FALLBACK_REFUSAL;
}

/** Whether the table has a sentence of its own for this code. */
export function hasRotaRefusalMessage(code: string | undefined): boolean {
  return code !== undefined && Object.hasOwn(REFUSAL_MESSAGES, code);
}

/** The fixed Hungarian text of an indoor-cleaning duty card (BR24.3); other jobs bring their own texts later. */
export const INDOOR_CLEANING_CARD_TEXT = Object.freeze({
  jobLabel: "Benti takarítás",
  instruction: "A család a saját hetében takarítja az óvoda belső tereit.",
  noFixedDay:
    "Ennek a feladatnak nincs kijelölt napja: a család a saját hetében, tetszése szerinti időpontban végzi el.",
  breakWarning:
    "Ez a hét időközben szünet lett. Érdeklődjön az adminisztrátornál, hogy kell-e teendője.",
});
