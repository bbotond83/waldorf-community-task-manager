import type { DomainOutcome } from "../application/index.ts";
import { TerminalDataFailure } from "./errors.ts";
import type { Envelope } from "./gateway.ts";
import { asRows, camelCase, type Row } from "./values.ts";

/**
 * Mapping of a database function's result envelope (state, reference, code, field) to the application
 * result states and codes of BR32.8, in one place so the code-by-code contract test covers one table.
 * The functions already return the stored codes; this module only chooses the application state.
 */

/**
 * Every business code a screen maps, with the state it is returned in (BR32.8). The contract test calls
 * the real functions for each entry and checks the state and code that arrive here.
 */
export const BUSINESS_CODE_STATES = Object.freeze({
  // Records, tasks, notes, assignments (admin)
  VERSION_CONFLICT: "conflict",
  RESTORE_CONFLICT: "conflict",
  ASSIGNMENT_CAPACITY_FULL: "conflict",
  // Approvals
  APPROVAL_ALREADY_DECIDED: "conflict",
  APPROVAL_INVALIDATED: "invalidated",
  // Settings
  SETTINGS_STALE: "invalidated",
  SETTINGS_RECIPIENT_INVALID: "conflict",
  // Parent sign-up
  DUTY_VERSION_STALE: "invalidated",
  DUTY_CLOSED: "conflict",
  DUTY_ALREADY_ASSIGNED: "conflict",
  DUTY_FULL: "conflict",
  // Swap and cancellation
  REQUEST_VERSION_STALE: "invalidated",
  REQUEST_DUPLICATE: "conflict",
  REQUEST_CONFLICT: "conflict",
  SWAP_CANNOT_BE_APPLIED: "conflict",
  SWAP_REQUEST_NOT_OPEN: "conflict",
  // Lifecycle
  LIFECYCLE_STALE: "invalidated",
  LIFECYCLE_BLOCKED: "conflict",
  LIFECYCLE_CONFIRMATION_REQUIRED: "conflict",
  // Grants
  GRANT_STALE: "invalidated",
  GRANT_LAST_SUPER_ADMIN: "conflict",
  GRANT_SELF_LOCKOUT: "conflict",
} as const satisfies Readonly<Record<string, "conflict" | "invalidated">>);

export type BusinessCode = keyof typeof BUSINESS_CODE_STATES;

/** The Hungarian message keys of a refused field; the admin screen's table turns them into words. */
const REASON_CODES: Readonly<Record<string, string>> = Object.freeze({
  invalid: "VAL-INVALID",
  archived: "VAL-ARCHIVED",
  locked: "VAL-LOCKED",
  taken: "VAL-TAKEN",
  before_start: "VAL-DATE-RANGE",
});

const FIELD_CODES: Readonly<Record<string, string>> = Object.freeze({
  expected_version: "VAL-EXPECTED-VERSION",
  target_version: "VAL-EXPECTED-VERSION",
});

function fieldCode(field: string, reason: string | null): string {
  const byField = FIELD_CODES[field];
  if (byField) return byField;
  if (reason && reason.includes("not_found")) return "VAL-NOT-FOUND";
  return (reason && REASON_CODES[reason]) || "VAL-INVALID";
}

function reasonOf(envelope: Envelope): string | null {
  return typeof envelope.reason === "string" ? envelope.reason : null;
}

/**
 * A refused value. `field_invalid` names the field (snake case in the database, camel case on a form);
 * a record that does not exist or is not visible reads exactly like a refused access, so a person cannot
 * tell the two apart (BR30.8); any other refusal is a request-level validation.
 */
function validationOutcome<T>(envelope: Envelope): DomainOutcome<T> {
  const code = envelope.code ?? "request_invalid";
  if (code === "field_invalid" && typeof envelope.field === "string") {
    return {
      state: "validation",
      fieldErrors: { [camelCase(envelope.field)]: fieldCode(envelope.field, reasonOf(envelope)) },
      code,
    };
  }
  if (code === "idempotency_key_invalid") {
    return {
      state: "validation",
      fieldErrors: { idempotencyKey: "VAL-IDEMPOTENCY-KEY" },
      code,
    };
  }
  if (code === "VAL-DATE-RANGE") {
    return { state: "validation", fieldErrors: { range: "VAL-DATE-RANGE" }, code };
  }
  if (/_not_found$/.test(code) || code === "invitation_not_valid") return { state: "denied" };
  return { state: "validation", fieldErrors: { request: "VAL-INVALID" }, code };
}

/**
 * Turns an envelope into the outcome the facades know. `onSuccess` reads the data of a success; every other
 * state is mapped here, in one place. A state this module does not know is a terminal failure: it is never
 * guessed to be a success.
 */
export function toOutcome<T>(
  envelope: Envelope,
  onSuccess: (envelope: Envelope) => T,
): DomainOutcome<T> {
  switch (envelope.state) {
    case "success":
      return { state: "success", data: onSuccess(envelope) };
    case "denied":
      return { state: "denied" };
    case "conflict":
      return envelope.code ? { state: "conflict", code: envelope.code } : { state: "conflict" };
    case "invalidated":
      return envelope.code
        ? { state: "invalidated", code: envelope.code }
        : { state: "invalidated" };
    case "validation":
      return validationOutcome<T>(envelope);
    default:
      throw new TerminalDataFailure("UNEXPECTED_RESPONSE");
  }
}

/** For a function that returns `items`: a success with no items is the empty state. */
export function toItemsOutcome<T>(
  envelope: Envelope,
  build: (rows: readonly Row[]) => T,
): DomainOutcome<T> {
  const outcome = toOutcome(envelope, (current) => asRows(current.items));
  if (outcome.state !== "success") return outcome as DomainOutcome<T>;
  return outcome.data.length ? { state: "success", data: build(outcome.data) } : { state: "empty" };
}

/** The same for rows already read from a table. */
export function rowsOutcome<T>(
  rows: readonly Row[],
  build: (rows: readonly Row[]) => T,
): DomainOutcome<T> {
  return rows.length ? { state: "success", data: build(rows) } : { state: "empty" };
}

/** A refused request that the function reported as validation, ready for a screen. */
export function refused<T = never>(
  fieldErrors: Readonly<Record<string, string>>,
  code = "request_invalid",
): DomainOutcome<T> {
  return { state: "validation", fieldErrors, code };
}
