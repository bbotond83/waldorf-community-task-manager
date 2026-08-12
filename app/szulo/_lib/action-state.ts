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

function conflictMessage(code: string): string {
  if (code === "DUTY_FULL") return "A feladat időközben betelt.";
  if (code === "DUTY_INELIGIBLE") return "Ehhez a feladathoz most nem lehet jelentkezni.";
  if (code === "REQUEST_DUPLICATE") return "Ehhez a megbízáshoz már van függő kérelem.";
  return "A művelet ütközik az aktuális állapottal.";
}
