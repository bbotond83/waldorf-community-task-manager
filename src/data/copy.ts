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

/**
 * What a person reads for each refusal of the directory, profile, account and invitation commands (U3). The
 * address refusals say the same thing whichever record held the address (NFR1.4), and none names a person.
 * A code not listed here is shown with `DIRECTORY_REFUSAL_FALLBACK`.
 */
export const DIRECTORY_REFUSAL_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  VERSION_CONFLICT:
    "Közben valaki módosította az adatot. Kérjük, töltse újra az oldalt, és próbálja újra.",
  EMAIL_INVALID: "Kérjük, érvényes e-mail-címet adjon meg.",
  EMAIL_UNAVAILABLE: "Ez az e-mail-cím nem használható.",
  EMAIL_RATE_LIMITED:
    "Túl sok levelet kértek erre a címre rövid idő alatt. Kérjük, próbálja később.",
  EMAIL_REQUEST_NOT_PENDING: "Nincs függőben lévő címváltoztatási kérés.",
  EMAIL_LINK_INVALID: "Ez a hivatkozás már nem érvényes.",
  EMAIL_MAIL_NOT_SENT: "A levelet most nem sikerült elküldeni. Kérjük, próbálja újra később.",
  INVITATION_MAIL_NOT_SENT: "A meghívó elkészült, de a levelet most nem sikerült elküldeni.",
  INVITATION_BUSY: "Ehhez a szülőhöz már tartozik nyitott meghívó.",
  PARENT_LAST_IN_FAMILY: "Az utolsó szülő nem távolítható el a családból.",
  PARENT_HAS_ACCOUNT: "Ennek a szülőnek már van fiókja, ezért a címét ott lehet módosítani.",
  PROFILE_FIELD_INVALID: "Az egyik megadott adat nem érvényes.",
  authorization_denied: "Ehhez nincs jogosultsága.",
  session_inactive: "A munkamenet lejárt. Kérjük, jelentkezzen be újra.",
});

export const DIRECTORY_REFUSAL_FALLBACK = "A művelet most nem hajtható végre.";

export type WorkingGroupAction = "join" | "leave" | "appoint" | "revoke";

/**
 * What a person reads for each answer of the working-group commands (U4, the table of `rules.md`). `NOT_A_MEMBER`
 * means something different for each command, so it is listed per command; every other code reads the same
 * wherever it comes from. `ALREADY_MEMBER` is a success of a repeated join and is shown as a note, not an error.
 */
const WORKING_GROUP_CODE_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  ALREADY_MEMBER: "Már tagja vagy ennek a csoportnak.",
  ALREADY_COORDINATOR: "Ő már koordinátora ennek a csoportnak.",
  NOT_COORDINATOR: "Ő már nem koordinátora ennek a csoportnak.",
  ACCOUNT_REQUIRED: "Csak aktív fiókkal rendelkező szülő lehet koordinátor.",
  VERSION_CONFLICT: "Az oldal közben megváltozott. Frissítsd, és próbáld újra.",
  GROUP_UNAVAILABLE: "Ez a munkacsoport nem érhető el.",
});

const NOT_A_MEMBER_MESSAGES: Readonly<Record<WorkingGroupAction, string>> = Object.freeze({
  join: "A művelet most nem hajtható végre.",
  leave: "Már nem vagy tagja ennek a csoportnak.",
  appoint:
    "Koordinátor csak a csoport tagja lehet. Kérd meg a szülőt, hogy előbb csatlakozzon a csoporthoz.",
  revoke: "Ő már nem tagja ennek a csoportnak.",
});

/**
 * The words for one answer. An access refusal (a missing, archived or other-community group, or someone else's
 * membership) reads as the unavailable group, so a person cannot tell which of these it was (BR42.1). A code this
 * table does not know is shown with the general fallback and never its raw text.
 */
export function workingGroupMessage(
  action: WorkingGroupAction,
  answer: { state: string; code?: string | undefined },
): string {
  if (answer.state === "denied") return WORKING_GROUP_CODE_MESSAGES.GROUP_UNAVAILABLE!;
  if (answer.code === "NOT_A_MEMBER") return NOT_A_MEMBER_MESSAGES[action];
  return (answer.code && WORKING_GROUP_CODE_MESSAGES[answer.code]) || DIRECTORY_REFUSAL_FALLBACK;
}

/**
 * What a person reads for each refusal of the event commands (U10). A refused field names its reason (`person_invalid`,
 * `too_many`, `outside_event`, `text_invalid`), which the adapter turns into the field codes below (`text_invalid` is
 * the general `VAL-INVALID`); the other codes come as the answer's code. An access refusal (a missing or
 * other-community event) reads as the unavailable event, so a person cannot tell which it was.
 */
const EVENT_CODE_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  EVENT_CLOSED: "Erre az eseményre már lezárult a jelentkezés.",
  EVENT_LIMIT_REACHED: "Ehhez az eseményhez nem adható több ilyen elem.",
  FOOD_SIGNUP_OFF: "Ennél az eseménynél nincs ételfelajánlás.",
  EVENT_UNAVAILABLE: "Ez az esemény nem érhető el.",
  GROUP_UNAVAILABLE: "Ez a munkacsoport nem érhető el.",
  VERSION_CONFLICT: "Az oldal közben megváltozott. Frissítsd, és próbáld újra.",
  ROLE_ORGANISER_NEEDS_ACCOUNT: "Szervező csak fiókkal rendelkező szülő lehet.",
  no_typed_name: "Ennek a szerepnek nincs beírt neve.",
});

const EVENT_REASON_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  "VAL-PERSON-INVALID": "Ez a személy nem választható ehhez a szerephez.",
  "VAL-TOO-MANY": "Ennél több elem nem adható meg.",
  "VAL-OUTSIDE-EVENT": "Az időpont az eseményen kívül esik.",
  "VAL-INVALID": "Az egyik megadott adat nem megfelelő.",
  "VAL-ARCHIVED": "Ez az elem már archivált, ezért nem módosítható.",
  "VAL-DATE-RANGE": "A jelentkezési határidő nem lehet az esemény vége után.",
});

export function eventMessage(answer: {
  state: string;
  code?: string | undefined;
  fieldErrors?: Readonly<Record<string, string>> | undefined;
}): string {
  if (answer.state === "denied") return EVENT_CODE_MESSAGES.EVENT_UNAVAILABLE!;
  const byCode = answer.code && EVENT_CODE_MESSAGES[answer.code];
  if (byCode) return byCode;
  for (const reason of Object.values(answer.fieldErrors ?? {})) {
    const known = EVENT_REASON_MESSAGES[reason];
    if (known) return known;
  }
  return DIRECTORY_REFUSAL_FALLBACK;
}

/**
 * What a person reads for each refusal of the library commands (U13). A refused field names its reason, which the
 * adapter turns into the field codes below; the other codes come as the answer's code. An access refusal (a missing,
 * removed or other-community book) reads as the unavailable book, so a person cannot tell which it was.
 */
const LIBRARY_CODE_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  BOOK_NOT_AVAILABLE: "Közben valaki kölcsönvette ezt a könyvet.",
  BOOK_NOT_ON_LOAN: "A könyv már nincs kölcsönadva.",
  BOOK_ON_LOAN: "Kölcsönadott könyv nem törölhető.",
  BOOK_AVAILABLE: "A könyv elérhető, ezért nincs mire értesítést kérni.",
  BOOK_REMOVED: "Ezt a könyvet már törölték.",
  BOOK_UNAVAILABLE: "Ez a könyv nem érhető el.",
  ALREADY_WATCHING: "Már kértél értesítést.",
  VERSION_CONFLICT: "Közben valaki módosította, töltsd újra.",
  authorization_denied: "Ezt a műveletet nem végezheted el.",
});

const LIBRARY_REASON_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  "VAL-OWN-BOOK": "A saját könyvedet nem veheted kölcsön.",
  "VAL-BEFORE-TODAY": "A visszahozás napja nem lehet a mai napnál korábbi.",
  "VAL-TOO-FAR": "A visszahozás napja legfeljebb egy évre lehet.",
  "VAL-HOLDER-OR-OWNER": "Ezt a személyt most nem lehet kijelölni.",
  "VAL-PERSON-INVALID": "Ez a személy nem lehet a könyv tulajdonosa.",
  "VAL-INVALID": "Az egyik megadott adat nem megfelelő.",
});

export function libraryMessage(answer: {
  state: string;
  code?: string | undefined;
  fieldErrors?: Readonly<Record<string, string>> | undefined;
}): string {
  if (answer.state === "denied" && answer.code === undefined) {
    return LIBRARY_CODE_MESSAGES.BOOK_UNAVAILABLE!;
  }
  const byCode = answer.code && LIBRARY_CODE_MESSAGES[answer.code];
  if (byCode) return byCode;
  for (const reason of Object.values(answer.fieldErrors ?? {})) {
    const known = LIBRARY_REASON_MESSAGES[reason];
    if (known) return known;
  }
  return DIRECTORY_REFUSAL_FALLBACK;
}

export function directoryRefusalMessage(code: string | undefined): string {
  return (code && DIRECTORY_REFUSAL_MESSAGES[code]) || DIRECTORY_REFUSAL_FALLBACK;
}
