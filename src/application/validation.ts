import type { ApplicationResult } from "./contracts.ts";
import { success, validation } from "./results.ts";

export type ValidationCode =
  | "VAL-REQUIRED"
  | "VAL-TOO-LONG"
  | "VAL-DATE-RANGE"
  | "VAL-IDEMPOTENCY-KEY"
  | "VAL-EXPECTED-VERSION";

type Validated<T> =
  | Extract<ApplicationResult<T>, { state: "success" }>
  | Extract<ApplicationResult<T>, { state: "validation" }>;

export function normalizeRequiredText(
  value: unknown,
  field: string,
  maximumLength = 200,
): Validated<string> {
  if (typeof value !== "string" || value.trim().length === 0) {
    return validation({ [field]: "VAL-REQUIRED" });
  }
  const normalized = value.trim().replaceAll(/\s+/g, " ");
  return normalized.length > maximumLength
    ? validation({ [field]: "VAL-TOO-LONG" })
    : success(normalized, "INPUT_VALID");
}

/** The check for a command that carries no version (answering or withdrawing a request). */
export function validateIdempotencyKey(
  idempotencyKey: unknown,
): Extract<ApplicationResult<never>, { state: "validation" }> | undefined {
  return typeof idempotencyKey === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/.test(idempotencyKey)
    ? undefined
    : validation({ idempotencyKey: "VAL-IDEMPOTENCY-KEY" });
}

export function validateMutationContext(input: {
  idempotencyKey: unknown;
  expectedVersion: unknown;
}): Validated<Readonly<{ idempotencyKey: string; expectedVersion: number }>> {
  const fieldErrors: Record<string, ValidationCode> = {};
  if (
    typeof input.idempotencyKey !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/.test(input.idempotencyKey)
  ) {
    fieldErrors.idempotencyKey = "VAL-IDEMPOTENCY-KEY";
  }
  if (
    typeof input.expectedVersion !== "number" ||
    !Number.isInteger(input.expectedVersion) ||
    input.expectedVersion < 1
  ) {
    fieldErrors.expectedVersion = "VAL-EXPECTED-VERSION";
  }
  if (Object.keys(fieldErrors).length > 0) return validation(fieldErrors);
  return success(
    Object.freeze({
      idempotencyKey: input.idempotencyKey as string,
      expectedVersion: input.expectedVersion as number,
    }),
    "MUTATION_CONTEXT_VALID",
  );
}

export function validateDateRange(
  from: unknown,
  to: unknown,
  maximumDays = 31,
): Validated<Readonly<{ from: string; to: string }>> {
  if (typeof from !== "string" || typeof to !== "string") {
    return validation({ range: "VAL-DATE-RANGE" });
  }
  const start = new Date(from);
  const end = new Date(to);
  const maximumMilliseconds = maximumDays * 24 * 60 * 60 * 1000;
  if (
    Number.isNaN(start.valueOf()) ||
    Number.isNaN(end.valueOf()) ||
    start > end ||
    end.valueOf() - start.valueOf() > maximumMilliseconds
  ) {
    return validation({ range: "VAL-DATE-RANGE" });
  }
  return success(Object.freeze({ from, to }), "DATE_RANGE_VALID");
}
