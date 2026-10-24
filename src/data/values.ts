import { malformedResponse } from "./errors.ts";

/**
 * Small readers for what the database returns. A response is data from outside this module, so every field
 * is checked where it is read; a field of the wrong shape is a terminal failure, never a guessed value.
 */
export type Row = Readonly<Record<string, unknown>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function asRow(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw malformedResponse();
  return value as Row;
}

export function asRows(value: unknown): readonly Row[] {
  if (!Array.isArray(value)) throw malformedResponse();
  return value.map(asRow);
}

export function text(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw malformedResponse();
  return value;
}

export function optionalText(row: Row, key: string): string | undefined {
  const value = row[key];
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "string") throw malformedResponse();
  return value;
}

export function integer(row: Row, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isInteger(value)) throw malformedResponse();
  return value;
}

export function flag(row: Row, key: string): boolean {
  const value = row[key];
  if (typeof value !== "boolean") throw malformedResponse();
  return value;
}

/** Keeps a value only when it is one of the words listed. */
export function oneOf<T extends string>(row: Row, key: string, allowed: readonly T[]): T {
  const value = text(row, key);
  const match = allowed.find((candidate) => candidate === value);
  if (match === undefined) throw malformedResponse();
  return match;
}

/** `snake_case` to `camelCase`, segment by segment, for field names that travel to a screen. */
export function camelCase(name: string): string {
  return name
    .split(".")
    .map((segment) => segment.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()))
    .join(".");
}
