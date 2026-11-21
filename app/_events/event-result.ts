import type { ApplicationResult } from "../../src/application/index.ts";
import { eventMessage } from "../../src/data/copy.ts";
import type { ParentActionState } from "../szulo/_lib/action-state.ts";

const FIELD_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  "VAL-REQUIRED": "A mező kitöltése kötelező.",
  "VAL-TOO-LONG": "A megadott érték túl hosszú.",
  "VAL-DATE-RANGE": "Érvénytelen időszak.",
  "VAL-INVALID": "Érvénytelen érték.",
  "VAL-TOO-MANY": "Ennél több elem nem adható meg.",
  "VAL-OUTSIDE-EVENT": "Az időpont az eseményen kívül esik.",
  "VAL-PERSON-INVALID": "Ez a személy nem választható ehhez a szerephez.",
  "VAL-NOT-FOUND": "A hivatkozott elem nem található.",
  "VAL-LOCKED": "Ez az érték már nem módosítható.",
  "VAL-ARCHIVED": "Ez az elem már archivált, ezért nem módosítható.",
});

/**
 * Turns the answer of an event command into the Hungarian words a form shows. A refusal never shows its raw code: a
 * refused field shows its reason next to it, the other refusals read as one sentence (`eventMessage`). A missing or
 * other-community event reads as unavailable, so a person cannot tell which it was.
 */
export function mapEventResult<T>(
  result: ApplicationResult<T>,
  successMessage: string,
): ParentActionState {
  const code = result.code;
  switch (result.state) {
    case "success":
    case "recovery":
      return { state: "success", message: successMessage, code };
    case "validation": {
      const fieldErrors = result.fieldErrors
        ? Object.fromEntries(
            Object.entries(result.fieldErrors).map(([field, reason]) => [
              field,
              FIELD_MESSAGES[reason] ?? reason,
            ]),
          )
        : undefined;
      return {
        state: "validation",
        message: fieldErrors ? "Ellenőrizd a megadott adatokat." : eventMessage(result),
        code,
        ...(fieldErrors ? { fieldErrors } : {}),
      };
    }
    case "denied":
    case "conflict":
      return { state: result.state, message: eventMessage(result), code };
    case "invalidated":
      return {
        state: "invalidated",
        message: "Az oldal közben megváltozott. Frissítsd, és próbáld újra.",
        code,
      };
    case "dependency-failure-retryable":
      return {
        state: "retryable",
        message: "Átmeneti hiba történt. A művelet biztonságosan újrapróbálható.",
        code,
        retry: result.retry,
      };
    default:
      return { state: "terminal", message: "Hiba történt. Próbáld meg később.", code };
  }
}
