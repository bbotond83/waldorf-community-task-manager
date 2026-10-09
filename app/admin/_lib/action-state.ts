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

function conflictMessage(code: string): string {
  if (code === "RESTORE_CONFLICT")
    return "A rekord nem állítható vissza, mert ütköző aktív rekord létezik.";
  if (code === "VERSION_CONFLICT")
    return "Az adatok időközben megváltoztak. Töltse újra az oldalt.";
  if (code === "ASSIGNMENT_INELIGIBLE")
    return "A kiválasztott résztvevő nem jogosult erre a feladatra.";
  if (code === "ASSIGNMENT_CAPACITY_FULL") return "A feladat vagy esemény elérte a kapacitását.";
  return "A művelet ütközés miatt nem hajtható végre.";
}
