import type { ApplicationResult } from "../../../src/application/index.ts";
import type { AdminActionState } from "../actions.ts";

export function mapApplicationResult<T>(
  result: ApplicationResult<T>,
  successMessage = "A művelet sikerült.",
): AdminActionState {
  switch (result.state) {
    case "success":
    case "recovery":
      return { state: "success", message: successMessage, code: result.code };
    case "validation":
      return {
        state: "validation",
        message: "Ellenőrizze a megadott adatokat.",
        code: result.code,
        fieldErrors: translateFieldErrors(result.fieldErrors),
      };
    case "denied":
      return { state: "denied", message: "Nincs jogosultság", code: result.code };
    case "conflict":
      return { state: "conflict", message: conflictMessage(result.code), code: result.code };
    case "invalidated":
      return { state: "invalidated", message: "A művelet már nem érvényes.", code: result.code };
    case "dependency-failure-retryable":
      return {
        state: "retryable",
        message: "Átmeneti hiba történt. Próbálja újra.",
        code: result.code,
        retry: result.retry,
      };
    case "dependency-failure-terminal":
      return {
        state: "terminal",
        message: "Hiba történt. A művelet nem ismételhető meg.",
        code: result.code,
      };
    case "empty":
    case "initial":
    case "loading":
    case "pending":
      return { state: "terminal", message: "A művelet nem fejeződött be.", code: result.code };
  }
}

const VALIDATION_CODE_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  "VAL-REQUIRED": "A mező kitöltése kötelező.",
  "VAL-TOO-LONG": "A megadott érték túl hosszú.",
  "VAL-IDEMPOTENCY-KEY": "Érvénytelen műveleti kulcs.",
  "VAL-EXPECTED-VERSION": "Érvénytelen verzió.",
  "VAL-DATE-RANGE": "Érvénytelen időszak.",
  // The codes the database adapters return for a refused field (src/data/results.ts).
  "VAL-INVALID": "Érvénytelen érték.",
  "VAL-NOT-FOUND": "A hivatkozott elem nem található.",
  "VAL-ARCHIVED": "A hivatkozott elem archivált.",
  "VAL-LOCKED": "Ez az érték már nem módosítható.",
  "VAL-TAKEN": "Ez a név már foglalt.",
});

/** A validation code never reaches the screen as such; readable messages pass through. */
function translateFieldErrors(
  fieldErrors: Readonly<Record<string, string>> | undefined,
): Readonly<Record<string, string>> | undefined {
  if (!fieldErrors) return undefined;
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([field, message]) => [
      field,
      VALIDATION_CODE_MESSAGES[message] ?? message,
    ]),
  );
}

/** One Hungarian message for each business conflict an admin screen can meet (BR32.8). */
export const ADMIN_CONFLICT_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  RESTORE_CONFLICT: "Az elem nem állítható vissza, mert ütköző aktív elem létezik.",
  VERSION_CONFLICT: "Az adatok időközben megváltoztak. Töltse újra az oldalt.",
  ASSIGNMENT_INELIGIBLE: "A kiválasztott résztvevő nem jogosult erre a feladatra.",
  ASSIGNMENT_CAPACITY_FULL: "A feladat vagy esemény elérte a kapacitását.",
  MEMBERSHIP_DUPLICATE: "A család már tagja ennek a csoportnak.",
  ACCOUNT_ALREADY_LINKED: "Ez a fiók már egy másik szülőhöz tartozik.",
  SCHOOL_YEAR_HAS_ACTIVE_GROUPS:
    "A nevelési év nem archiválható, amíg aktív csoportjai vannak. Előbb archiválja a csoportokat.",
});

function conflictMessage(code: string): string {
  return Object.hasOwn(ADMIN_CONFLICT_MESSAGES, code)
    ? ADMIN_CONFLICT_MESSAGES[code]!
    : "A művelet ütközés miatt nem hajtható végre.";
}
