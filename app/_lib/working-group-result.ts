import type { ApplicationResult } from "../../src/application/index.ts";
import { workingGroupMessage, type WorkingGroupAction } from "../../src/data/copy.ts";

/** The outcome of a working-group command as a form shows it; the parent and admin action states both accept it. */
export type WorkingGroupActionState = Readonly<{
  state:
    "success" | "validation" | "denied" | "conflict" | "invalidated" | "retryable" | "terminal";
  message: string;
  code?: string;
  retry?: Readonly<{ idempotencyKey: string; action: string }>;
}>;

/**
 * Turns the answer of a join, leave, appoint or revoke into the Hungarian words the person reads (U4 rules table).
 * A refusal never shows its raw code; an unknown code reads as the general "could not be done" text.
 */
export function mapWorkingGroupResult<T>(
  action: WorkingGroupAction,
  result: ApplicationResult<T>,
  successMessage: string,
): WorkingGroupActionState {
  const code = result.code;
  switch (result.state) {
    case "success":
    case "recovery":
      return { state: "success", message: successMessage, code };
    case "denied":
    case "conflict":
    case "validation":
      return { state: result.state, message: workingGroupMessage(action, result), code };
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KEY = /^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/;

const text = (formData: FormData, field: string): string => {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
};

/** What a group command form sends: the identifiers are checked here, before anything reaches the database. */
export type GroupCommandInput =
  | Readonly<{ ok: true; idempotencyKey: string; id: string; expectedVersion: number }>
  | Readonly<{ ok: false; state: WorkingGroupActionState }>;

const INVALID: WorkingGroupActionState = {
  state: "validation",
  message: "A kérés érvénytelen. Frissítsd az oldalt, és próbáld újra.",
  code: "VAL-INVALID",
};

/** Reads a form that names one record by `idField`; `withVersion` also needs the version that was on screen. */
export function readGroupCommand(
  formData: FormData,
  idField: "groupId" | "membershipId",
  withVersion: boolean,
): GroupCommandInput {
  const id = text(formData, idField);
  const idempotencyKey = text(formData, "idempotencyKey");
  const expectedVersion = withVersion ? Number(formData.get("expectedVersion")) : 1;
  if (
    !UUID.test(id) ||
    !KEY.test(idempotencyKey) ||
    !Number.isInteger(expectedVersion) ||
    expectedVersion < 1
  ) {
    return { ok: false, state: INVALID };
  }
  return { ok: true, idempotencyKey, id, expectedVersion };
}

export const NO_ACCESS: WorkingGroupActionState = {
  state: "denied",
  message: workingGroupMessage("join", { state: "denied" }),
};
