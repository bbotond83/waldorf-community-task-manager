import type { ApplicationResult } from "../../src/application/index.ts";
import { recurringMessage } from "../../src/data/copy.ts";
import type { ParentActionState } from "../szulo/_lib/action-state.ts";

/**
 * Turns the answer of a recurring-duty command into the Hungarian words a form shows. A refusal never shows its raw
 * code: a refused field shows the sentence that tells the person which entry to correct, the other refusals read as
 * one sentence (`recurringMessage`). A stale version, a closed occurrence and a late undo are conflicts with their
 * own sentences.
 */
export function mapRecurringResult<T>(
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
              recurringMessage({ state: "validation", fieldErrors: { [field]: reason } }),
            ]),
          )
        : undefined;
      return {
        state: "validation",
        message: fieldErrors ? "Ellenőrizd a megadott adatokat." : recurringMessage(result),
        code,
        ...(fieldErrors ? { fieldErrors } : {}),
      };
    }
    case "denied":
    case "conflict":
      return { state: result.state, message: recurringMessage(result), code };
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
