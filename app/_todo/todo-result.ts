import type { ApplicationResult } from "../../src/application/index.ts";
import { todoMessage } from "../../src/data/copy.ts";
import type { ParentActionState } from "../szulo/_lib/action-state.ts";

/**
 * Turns the answer of a to-do command into the Hungarian words a form shows. A refusal never shows its raw code: a
 * refused field shows the sentence of the entry to correct, the other refusals read as one sentence (`todoMessage`).
 * A stale version is a conflict with its own sentence, and an outdated screen is the only case the form shows the
 * "reload" wording (the owner's decision: no banner unless a real version conflict happened).
 */
export function mapTodoResult<T>(
  result: ApplicationResult<T>,
  successMessage: string,
): ParentActionState {
  const code = result.code;
  switch (result.state) {
    case "success":
    case "recovery":
      return { state: "success", message: successMessage, code };
    case "validation": {
      const refused = Object.entries(result.fieldErrors ?? {});
      const fieldErrors =
        refused.length > 0
          ? Object.fromEntries(
              refused.map(([field, reason]) => [
                field,
                todoMessage({ state: "validation", fieldErrors: { [field]: reason } }),
              ]),
            )
          : undefined;
      return {
        state: "validation",
        message: fieldErrors ? "Ellenőrizd a megadott adatokat." : todoMessage(result),
        code,
        ...(fieldErrors ? { fieldErrors } : {}),
      };
    }
    case "denied":
    case "conflict":
      return { state: result.state, message: todoMessage(result), code };
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
