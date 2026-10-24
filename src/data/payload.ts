/**
 * Readers for the `payload` of an admin command. The payload comes from a form, so nothing in it is trusted:
 * a field of the wrong type is read as absent, and the database function then refuses the missing value with
 * a coded validation result that names the field.
 */
export type Payload = Readonly<Record<string, unknown>>;

export function payloadText(payload: Payload, ...keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string") return value;
  }
  return undefined;
}

export function payloadNumber(payload: Payload, key: string): number | undefined {
  const value = payload[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return Number(value);
  return undefined;
}

export function payloadFlag(payload: Payload, key: string): boolean | undefined {
  const value = payload[key];
  if (typeof value === "boolean") return value;
  if (value === "yes" || value === "true" || value === "on") return true;
  if (value === "no" || value === "false" || value === "off") return false;
  return undefined;
}

export function payloadTexts(payload: Payload, key: string): readonly string[] | undefined {
  const value = payload[key];
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string");
}

export function payloadObjects(payload: Payload, key: string): readonly Payload[] | undefined {
  const value = payload[key];
  if (!Array.isArray(value)) return undefined;
  return value.filter(
    (item): item is Payload => !!item && typeof item === "object" && !Array.isArray(item),
  );
}

/** Keeps only the entries that are set, so "absent" never turns into an explicit empty value. */
export function defined<T extends Record<string, unknown>>(entries: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(entries).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

/** `LIKE` characters in a search text are matched literally. */
export function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, "\\$&")}%`;
}
