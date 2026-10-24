import type { ApplicationResult } from "../../../src/application/index.ts";

export type ParentActionState = Readonly<{
  state:
    | "initial"
    | "validation"
    | "success"
    | "denied"
    | "conflict"
    | "invalidated"
    | "retryable"
    | "terminal";
  message?: string;
  code?: string;
  fieldErrors?: Readonly<Record<string, string>>;
  retry?: Readonly<{ idempotencyKey: string; action: string }>;
  link?: string;
}>;

export function mapParentResult<T>(
  result: ApplicationResult<T>,
  successMessage: string,
): ParentActionState {
  switch (result.state) {
    case "success":
      return { state: "success", message: successMessage, code: result.code };
    case "validation":
      return {
        state: "validation",
        message: "Ellenőrizze a megadott adatokat.",
        code: result.code,
        fieldErrors: result.fieldErrors,
      };
    case "denied":
      return { state: "denied", message: "Nincs jogosultság.", code: result.code };
    case "conflict":
      return { state: "conflict", message: conflictMessage(result.code), code: result.code };
    case "invalidated":
      return {
        state: "invalidated",
        message: "Az adatok időközben megváltoztak. Frissítse az oldalt.",
        code: result.code,
      };
    case "dependency-failure-retryable":
      return {
        state: "retryable",
        message: "Átmeneti hiba történt. A művelet biztonságosan újrapróbálható.",
        code: result.code,
        retry: result.retry,
      };
    case "dependency-failure-terminal":
      return { state: "terminal", message: "Hiba történt.", code: result.code };
    default:
      return { state: "terminal", message: "Hiba történt.", code: result.code };
  }
}

/** One Hungarian message for each business conflict a parent screen can meet (BR32.8). */
export const PARENT_CONFLICT_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  DUTY_FULL: "A feladat időközben betelt.",
  DUTY_INELIGIBLE: "Ehhez a feladathoz most nem lehet jelentkezni.",
  DUTY_CLOSED: "Erre a feladatra már nem lehet jelentkezni, mert lezárták vagy elkezdődött.",
  DUTY_ALREADY_ASSIGNED: "A család már jelentkezett erre a feladatra.",
  REQUEST_DUPLICATE: "Ehhez a megbízáshoz már van függő kérelem.",
  REQUEST_CONFLICT: "A kérelem a feladatok jelenlegi állapota miatt nem küldhető el.",
  SWAP_CANNOT_BE_APPLIED:
    "A csere már nem hajtható végre, mert a feladatok időközben megváltoztak. A kérelem nyitva marad, az adminisztrátor dönthet róla, vagy a kérelmező visszavonhatja.",
  SWAP_REQUEST_NOT_OPEN: "Ez a kérelem már nem nyitott: időközben visszavonták vagy elbírálták.",
});

function conflictMessage(code: string): string {
  return Object.hasOwn(PARENT_CONFLICT_MESSAGES, code)
    ? PARENT_CONFLICT_MESSAGES[code]!
    : "A művelet ütközik az aktuális állapottal.";
}
