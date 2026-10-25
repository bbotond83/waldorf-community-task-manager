import { isCalendarDate } from "../../../src/application/tracking-model.ts";
export type SearchParams = Readonly<Record<string, string | string[] | undefined>>;
export const INVALID_FILTER = "invalid";
export function isGroupIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
}
function single(params: SearchParams, canonical: string, legacy?: string) {
  const supplied = [params[canonical], ...(legacy ? [params[legacy]] : [])].filter(
    (value) => value !== undefined,
  );
  if (!supplied.length) return { value: undefined, invalid: false };
  if (supplied.length !== 1 || Array.isArray(supplied[0]))
    return { value: undefined, invalid: true };
  return { value: supplied[0] as string, invalid: false };
}
export function safeFilterValues(params: SearchParams, translateLegacy = false) {
  const group = single(params, "groupId", translateLegacy ? "csoport" : undefined);
  const from = single(params, "from", translateLegacy ? "kezdet" : undefined);
  const to = single(params, "to", translateLegacy ? "veg" : undefined);
  const groupInvalid =
    group.invalid || (group.value !== undefined && !isGroupIdentifier(group.value));
  const invalid =
    groupInvalid ||
    from.invalid ||
    to.invalid ||
    (from.value !== undefined && !isCalendarDate(from.value)) ||
    (to.value !== undefined && !isCalendarDate(to.value));
  // Generated constants carry invalidity to destination without reflecting arbitrary input or broadening a read.
  return {
    groupId: groupInvalid ? undefined : group.value,
    from: invalid ? INVALID_FILTER : from.value,
    to: invalid ? INVALID_FILTER : to.value,
    invalid,
  };
}
export function safeDetailId(id: string): string {
  return !id || /[\u0000-\u001f\u007f]/.test(id) || /^\.+$/.test(id)
    ? "invalid-entry"
    : encodeURIComponent(id);
}
export function compatibilityLocation(params: SearchParams, id?: string): string {
  const values = safeFilterValues(params, true);
  const query = new URLSearchParams();
  for (const key of ["groupId", "from", "to"] as const)
    if (values[key] !== undefined) query.set(key, values[key]!);
  return `/teacher/schedule${id === undefined ? "" : "/" + safeDetailId(id)}${query.size ? "?" + query.toString() : ""}`;
}
