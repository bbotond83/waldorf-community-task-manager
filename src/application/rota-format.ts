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
  ROTA_WEEKS_EMPTY:
    "A közzététel előtt minden tanítási hétnek családot kell adni mind a négy beosztásban (szünetes héten a belső takarítás és a vízhordás üres maradhat).",
  ROTA_SAME_WEEK_CLASH:
    "Ugyanaz a család ugyanazon a héten nem végezheti a belső takarítást és az előkert gondozását is.",
  STANDING_INVALID: "Ez az állapot nem választható. Válasszon a Marad, Távozik és Új közül.",
  DUTY_INELIGIBLE:
    "Ez a család az adott napon már nem (vagy még nem) vállalhat feladatot, ezért nem osztható be.",
  WEEKEND_PICK_CLOSED:
    "A választás ideje lejárt: szombat éjféltől már nem lehet nyitást vagy zárást választani.",
  WEEKEND_PICK_LOCKED:
    "A választás péntek délután már nem módosítható. Ha változtatni kell, kérje az adminisztrátor segítségét.",
  WEEKEND_PICK_NOT_NEEDED: "Ezen a héten nem kell hétvégi nyitást vagy zárást választani.",
  WEEKEND_SLOT_NOT_PICKABLE: "Ezt a hétvégi feladatot nem lehet választani.",
  WEEKEND_SLOT_TAKEN: "Ezt a nyitást vagy zárást közben más család választotta. Válasszon másikat.",
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

/** The name of each rota as the screens write it (the same words the database puts on the duty). */
export const ROTA_JOB_LABELS = Object.freeze({
  indoor_cleaning: "Belső takarítás",
  front_garden: "Előkert",
  water_carrying: "Vízhordás",
  weekend_animal_care: "Hétvégi állatgondozás",
} as const);

/** The name of each weekend duty (BR63.1). */
export const WEEKEND_SLOT_LABELS = Object.freeze({
  saturday_opening: "Szombat reggeli nyitás",
  saturday_closing: "Szombat esti zárás",
  sunday_opening: "Vasárnap reggeli nyitás",
  sunday_closing: "Vasárnap esti zárás",
  shelter_cleaning: "Hétvégi takarítás",
} as const);

/** Why a week of the draft is empty, as the planning screen says it (BR62.3). */
export const EMPTY_WEEK_REASON_TEXT = Object.freeze({
  no_family: "Még nincs család kijelölve.",
  cleared: "A hét ki lett ürítve.",
  break_week: "Szünetes hét: ennél a beosztásnál üresen maradhat.",
} as const);

/** Why a family may not hold a duty on a date, as the flagged-duty list says it (BR60.5). */
export const HOLD_REASON_TEXT = Object.freeze({
  leaving_after_changeover: "A család az évváltás után távozik.",
  new_before_changeover: "A család csak az évváltástól csatlakozik.",
} as const);

/** The standings a super admin can set (BR60.1). */
export const STANDING_LABELS = Object.freeze({
  staying: "Marad",
  leaving: "Távozik",
  new: "Új",
} as const);

/** The state of a weekend pick, as the picker and the weekend list say it (BR63.4, BR65.3). */
export const PICK_STATE_TEXT = Object.freeze({
  open: "Még nem választott.",
  picked: "Választott.",
  missed: "Nem választott időben.",
  not_needed: "Ezen a héten nem kell választani.",
} as const);

/** The warning lines of the planning screen (BR62.6, BR62.7) and the calendar. */
export const ROTA_WARNING_TEXT = Object.freeze({
  twoJobs: "Ugyanaz a család ezen a héten két beosztásban is szerepel.",
  breakWeek: "Szünetes héten is van család a belső takarításnál vagy a vízhordásnál.",
} as const);

/** The fixed Hungarian text of the duty cards of the other three rotas and of the weekend duties (BR65.2). */
export const DUTY_CARD_TEXT = Object.freeze({
  front_garden: Object.freeze({
    jobLabel: "Előkert",
    instruction: "A család a saját hetében rendben tartja az óvoda előkertjét.",
    watering: "Március és október között a növények öntözése is a család dolga.",
  }),
  water_carrying: Object.freeze({
    jobLabel: "Vízhordás",
    instruction: "A család a saját hetében gondoskodik az ivóvízről.",
    bottlesAtWeekEnd: "A hét végén a palackokat a család visszaviszi a helyükre.",
  }),
  weekend_animal_care: Object.freeze({
    jobLabel: "Hétvégi állatgondozás",
    instruction:
      "A család a hétvégén gondozza az óvoda állatait, és ő viszi a hétvégi takarítást is. A szombati és vasárnapi nyitást és zárást a hét belső takarító és előkerti családja választhatja; ami nem kel el, az a hétvégi családnál marad.",
  }),
  weekend_slot: Object.freeze({
    instruction: "Ez a hétvégi feladat a megjelölt napon és napszakban esedékes.",
    day: Object.freeze({ saturday: "Szombat", sunday: "Vasárnap", weekend: "A hétvége" }),
    partOfDay: Object.freeze({ morning: "reggel", evening: "este", all_day: "egész nap" }),
  }),
} as const);

/** The words of the administrator's unpicked list "Ki nem választott?" (BR63.8) and its assign action (BR63.6). */
export const ROTA_ASSIGN_TEXT = Object.freeze({
  title: "Ki nem választott?",
  intro:
    "Ezek a hétvégi feladatok még a hétvégi családnál vannak. Szombat éjfélig kijelölheti őket valamelyik családnak.",
  emptyTitle: "Mindenki választott.",
  empty: "Most nincs kiosztandó hétvégi feladat.",
  missedTitle: "Nem választott időben",
  slotLabel: "Szabad nyitás vagy zárás",
  submit: "Kijelölés mentése",
  noFreeSlot: "Nincs szabad nyitás vagy zárás ezen a héten.",
});

/** The words of the weekend picker on a duty card (BR63.4, BR65.3). */
export const WEEKEND_PICKER_TEXT = Object.freeze({
  legend: "Hétvégi nyitás vagy zárás választása",
  rule: "Péntek délig választhat, és péntek délig módosíthatja is; ami nem kel el, az a hétvégi családnál marad.",
  submit: "Választás mentése",
  saved: "A választás mentve.",
  taken: "Már választották",
  closed: "A választás ideje lejárt.",
  weekendFamily: "Hétvégi felelős család",
  weekendList: "Hétvégi feladatok ezen a héten",
  whoPicked: "Ki mit választott?",
  noOne: "Még nincs választva.",
  keptByWeekendFamily: "A hétvégi család viszi.",
});

/** The fixed Hungarian text of an indoor-cleaning duty card (BR24.3); the texts of the other jobs are `DUTY_CARD_TEXT`. */
export const INDOOR_CLEANING_CARD_TEXT = Object.freeze({
  jobLabel: "Benti takarítás",
  instruction: "A család a saját hetében takarítja az óvoda belső tereit.",
  noFixedDay:
    "Ennek a feladatnak nincs kijelölt napja: a család a saját hetében, tetszése szerinti időpontban végzi el.",
  breakWarning:
    "Ez a hét időközben szünet lett. Érdeklődjön az adminisztrátornál, hogy kell-e teendője.",
});
