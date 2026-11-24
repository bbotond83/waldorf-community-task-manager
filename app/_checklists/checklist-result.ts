import type { ApplicationResult } from "../../src/application/index.ts";
import { checklistMessage } from "../../src/data/copy.ts";
import type { ParentActionState } from "../szulo/_lib/action-state.ts";

/**
 * Turns the answer of a checklist or template command into the Hungarian words a form shows. A refusal never shows its
 * raw code: it reads as one sentence (`checklistMessage`). A stale version is a conflict that asks for a reload.
 */
export function mapChecklistResult<T>(
  result: ApplicationResult<T>,
  successMessage: string,
): ParentActionState {
  const code = result.code;
  switch (result.state) {
    case "success":
    case "recovery":
      return { state: "success", message: successMessage, code };
    case "validation":
      return {
        state: "validation",
        message: result.fieldErrors?.title
          ? "A cím megadása kötelező, és legfeljebb 200 karakter lehet."
          : checklistMessage(result),
        code,
      };
    case "denied":
    case "conflict":
      return { state: result.state, message: checklistMessage(result), code };
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
