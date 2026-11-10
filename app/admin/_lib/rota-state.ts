import type { ApplicationResult } from "../../../src/application/index.ts";
import { hasRotaRefusalMessage, rotaRefusalMessage } from "../../../src/application/rota-format.ts";
import type { AdminActionState } from "../actions.ts";
import { mapApplicationResult } from "./action-state.ts";

/** Hungarian sentences for the fields of the school year and break week forms, by the code the database gave. */
const FIELD_MESSAGES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  changeoverDate: {
    "VAL-DATE-RANGE": "Az évváltás napja nem lehet a tanév kezdete előtt.",
    "VAL-INVALID": "Adjon meg érvényes évváltási napot.",
  },
  endsOn: { "VAL-DATE-RANGE": "A tanév vége nem lehet a tanév kezdete előtt." },
  startsOn: {
    "VAL-LOCKED": "A tanév kezdete nem módosítható, mert szünet esne a tanéven kívülre.",
  },
  name: { "VAL-TAKEN": "Ez a név már foglalt." },
};

/**
 * The state a screen shows for the result of a calendar or rota command: the success text, or, for a refusal, the
 * sentence of its code (`rotaRefusalMessage`) or of its field.
 */
export function rotaState<T>(result: ApplicationResult<T>, success: string): AdminActionState {
  const mapped = mapApplicationResult(result, success);
  if (result.state === "success" || result.state === "recovery") return mapped;
  if (result.state === "validation") {
    if (hasRotaRefusalMessage(result.code)) {
      return { state: "validation", message: rotaRefusalMessage(result.code), code: result.code };
    }
    const fieldErrors = Object.fromEntries(
      Object.entries(mapped.fieldErrors ?? {}).map(([field, message]) => [
        field,
        FIELD_MESSAGES[field]?.[result.fieldErrors[field] ?? ""] ?? message,
      ]),
    );
    return { ...mapped, fieldErrors };
  }
  if (result.state === "conflict" || result.state === "invalidated") {
    return { ...mapped, message: rotaRefusalMessage(result.code) };
  }
  return mapped;
}
