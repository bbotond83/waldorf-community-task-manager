import type { Scope } from "../access/types.ts";
export type TrackingEntry = Readonly<{
  id: string;
  groupId: string;
  startsAt: string;
  endsAt: string;
  title: string;
  location: string;
  coordinationDisplayName?: string;
  ownerDisplayName: string | null;
  assigneeDisplayNames: readonly string[];
  currentStatusLabel: string | null;
}>;
export type TrackingSourceRecord = TrackingEntry &
  Readonly<{ sourceRecordId: string; organizationId: string }>;
/** A missing `from` or `to` means no limit on that side. */
export type TrackingQuery = Readonly<{ groupScope: Scope; from?: string; to?: string }>;
export interface TeacherScheduleRepository {
  readCurrent(
    query: TrackingQuery,
  ): readonly TrackingSourceRecord[] | Promise<readonly TrackingSourceRecord[]>;
}
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const instant = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(instant) && new Date(instant).toISOString().slice(0, 10) === value;
}
export function isTrackingRange(from: unknown, to: unknown): boolean {
  // Round-trip calendar validation rejects JavaScript's normalized impossible dates.
  return (
    isCalendarDate(from) &&
    isCalendarDate(to) &&
    from <= to &&
    Date.parse(to) - Date.parse(from) <= 31 * 24 * 60 * 60 * 1000
  );
}
/**
 * Like `isTrackingRange`, but each limit is optional: no dates is no limit, one date is a one-sided
 * limit (a calendar date is all it needs), and a filled pair keeps the strict range rules.
 */
export function isOptionalTrackingRange(from: unknown, to: unknown): boolean {
  if (from === undefined && to === undefined) return true;
  if (from === undefined) return isCalendarDate(to);
  if (to === undefined) return isCalendarDate(from);
  return isTrackingRange(from, to);
}
export function isTrackingSource(value: unknown): value is TrackingSourceRecord {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  const text = (key: string) => typeof row[key] === "string" && (row[key] as string).length > 0;
  return (
    [
      "id",
      "sourceRecordId",
      "groupId",
      "organizationId",
      "startsAt",
      "endsAt",
      "title",
      "location",
    ].every(text) &&
    Number.isFinite(Date.parse(row.startsAt as string)) &&
    Number.isFinite(Date.parse(row.endsAt as string)) &&
    Date.parse(row.startsAt as string) <= Date.parse(row.endsAt as string) &&
    (row.coordinationDisplayName === undefined ||
      typeof row.coordinationDisplayName === "string") &&
    (row.ownerDisplayName === null || typeof row.ownerDisplayName === "string") &&
    Array.isArray(row.assigneeDisplayNames) &&
    row.assigneeDisplayNames.every((name) => typeof name === "string") &&
    (row.currentStatusLabel === null || typeof row.currentStatusLabel === "string")
  );
}
export function projectTrackingEntry(row: TrackingSourceRecord): TrackingEntry {
  // Copy each browser field explicitly; source metadata and future private fields stay behind the port.
  return Object.freeze({
    id: row.id,
    groupId: row.groupId,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    title: row.title,
    location: row.location,
    ...(row.coordinationDisplayName !== undefined
      ? { coordinationDisplayName: row.coordinationDisplayName }
      : {}),
    ownerDisplayName: row.ownerDisplayName,
    assigneeDisplayNames: Object.freeze([...row.assigneeDisplayNames]),
    currentStatusLabel: row.currentStatusLabel,
  });
}
export function matchesTrackingScope(row: TrackingSourceRecord, scope: Scope): boolean {
  return (
    scope.type === "group" &&
    row.groupId === scope.id &&
    row.organizationId === scope.organizationId
  );
}
