import type { ApplicationResult } from "../../src/application/index.ts";
import { libraryMessage } from "../../src/data/copy.ts";
import type { ParentActionState } from "../szulo/_lib/action-state.ts";

const FIELD_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  "VAL-REQUIRED": "A mező kitöltése kötelező.",
  "VAL-TOO-LONG": "A megadott érték túl hosszú.",
  "VAL-INVALID": "Érvénytelen érték.",
  "VAL-BEFORE-TODAY": "A visszahozás napja nem lehet a mai napnál korábbi.",
  "VAL-TOO-FAR": "A visszahozás napja legfeljebb egy évre lehet.",
  "VAL-OWN-BOOK": "A saját könyvedet nem veheted kölcsön.",
  "VAL-PERSON-INVALID": "Ez a személy nem lehet a könyv tulajdonosa.",
});

/**
 * Turns the answer of a library command into the Hungarian words a form shows. A refusal never shows its raw code: a
 * refused field shows its reason next to it, the other refusals read as one sentence (`libraryMessage`). A missing,
 * removed or other-community book reads as unavailable, so a person cannot tell which it was. VERSION_CONFLICT and
 * BOOK_NOT_ON_LOAN read the same way on a return: reload and look again.
 */
export function mapLibraryResult<T>(
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
        message: fieldErrors ? "Ellenőrizd a megadott adatokat." : libraryMessage(result),
        code,
        ...(fieldErrors ? { fieldErrors } : {}),
      };
    }
    case "denied":
    case "conflict":
      return { state: result.state, message: libraryMessage(result), code };
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
