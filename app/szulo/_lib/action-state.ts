import type { ApplicationResult } from "../../../src/application/index.ts";
import { hasRotaRefusalMessage, rotaRefusalMessage } from "../../../src/application/rota-format.ts";

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
      // The rota refusals have a sentence of their own: a family that may not hold the duty on that day (BR60.3),
      // and the weekend pick refusals (BR63.4).
      if (hasRotaRefusalMessage(result.code)) {
        return { state: "validation", message: rotaRefusalMessage(result.code), code: result.code };
      }
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
  DUTY_CLOSED: "Erre a feladatra már nem lehet jelentkezni, mert lezárták vagy elkezdődött.",
  DUTY_ALREADY_ASSIGNED: "A család már jelentkezett erre a feladatra.",
  REQUEST_DUPLICATE: "Ehhez a megbízáshoz már van függő kérelem.",
  REQUEST_CONFLICT:
    "Az egyik feladathoz időközben másik kérelem érkezett, ezért ez most nem indítható.",
  DUTY_INELIGIBLE: "A család jelenlegi helyzete miatt ez a csere nem lehetséges.",
  SWAP_CANNOT_BE_APPLIED:
    "A csere már nem hajtható végre, mert a feladatok időközben megváltoztak. A kérelem nyitva marad, a kérelmező visszavonhatja.",
  SWAP_REQUEST_NOT_OPEN: "Ez a kérelem már nem nyitott: időközben visszavonták vagy elbírálták.",
  SWAP_EXPIRED: "A csere kérelme lejárt, mert az egyik feladat már elkezdődött.",
  CANCELLATION_EXPIRED: "A lemondási kérelem lejárt, mert a feladat már elkezdődött.",
  SWAP_SLOT_FOLLOWS_WEEK:
    "A hétvégi nyitás vagy zárás a hetet követi, ezért nem cserélhető. Válasszon másik feladatot.",
});

function conflictMessage(code: string): string {
  if (Object.hasOwn(PARENT_CONFLICT_MESSAGES, code)) return PARENT_CONFLICT_MESSAGES[code]!;
  // The weekend pick conflicts (a slot taken meanwhile, a pick that closed) have their own sentences.
  return hasRotaRefusalMessage(code)
    ? rotaRefusalMessage(code)
    : "A művelet ütközik az aktuális állapottal.";
}
