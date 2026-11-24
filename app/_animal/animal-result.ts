import type { ApplicationResult } from "../../src/application/index.ts";
import { animalMessage } from "../../src/data/copy.ts";
import type { ParentActionState } from "../szulo/_lib/action-state.ts";

/**
 * Turns the answer of an animal-care or information command into the Hungarian words a form shows. A refusal never
 * shows its raw code: it reads as one sentence (`animalMessage`). A recovery (the same request sent again) reads as
 * the success it already was.
 */
export function mapAnimalResult<T>(
  result: ApplicationResult<T>,
  successMessage: string,
): ParentActionState {
  const code = result.code;
  switch (result.state) {
    case "success":
    case "recovery":
      return { state: "success", message: successMessage, code };
    case "validation":
      return { state: "validation", message: animalMessage(result), code };
    case "denied":
    case "conflict":
      return { state: result.state, message: animalMessage(result), code };
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
