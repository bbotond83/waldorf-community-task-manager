import type { Scope } from "../access/index.ts";
import {
  isOptionalTrackingRange,
  isTrackingSource,
  type TrackingSourceRecord,
  type TrackingQuery,
  type TeacherScheduleRepository,
} from "../teacher-tracking/index.ts";
export const TEACHER_GROUPS = Object.freeze([
  Object.freeze({
    scope: Object.freeze({
      id: "group-oak",
      type: "group",
      organizationId: "org-waldorf-local",
    } satisfies Scope),
    label: "Tölgyfa csoport",
  }),
  Object.freeze({
    scope: Object.freeze({
      id: "group-sunflower",
      type: "group",
      organizationId: "org-waldorf-local",
    } satisfies Scope),
    label: "Napraforgó csoport",
  }),
]);

export const UNGRANTED_TEACHER_GROUP: Scope = Object.freeze({
  id: "group-ungranted",
  type: "group",
  organizationId: "org-waldorf-local",
});

export type TeacherFixtureScenario = "ready" | "empty" | "denied" | "retryable" | "terminal";

export const TEACHER_FIXTURE_SCENARIOS = Object.freeze([
  "ready",
  "empty",
  "denied",
  "retryable",
  "terminal",
] satisfies readonly TeacherFixtureScenario[]);

export const TEACHER_FIXTURE_VERSION = "teacher-tracking-local-v1";

export const SYNTHETIC_SCHEDULE: readonly TrackingSourceRecord[] = Object.freeze([
  Object.freeze({
    id: "schedule-garden",
    sourceRecordId: "schedule-garden",
    organizationId: "org-waldorf-local",
    ownerDisplayName: "Kitalált Dóra",
    assigneeDisplayNames: Object.freeze(["Kitalált Eszter"]),
    currentStatusLabel: "Ütemezett",
    groupId: "group-oak",
    startsAt: "2026-08-13T06:30:00.000Z",
    endsAt: "2026-08-13T07:30:00.000Z",
    title: "Reggeli udvari felügyelet",
    location: "Keleti udvar",
    coordinationDisplayName: "Kitalált Ágnes",
  }),
  Object.freeze({
    id: "schedule-crafts",
    sourceRecordId: "schedule-crafts",
    organizationId: "org-waldorf-local",
    ownerDisplayName: "Kitalált Fanni",
    assigneeDisplayNames: Object.freeze(["Kitalált Géza", "Kitalált Hanna"]),
    currentStatusLabel: "Nyitott",
    groupId: "group-oak",
    startsAt: "2026-08-14T12:00:00.000Z",
    endsAt: "2026-08-14T14:00:00.000Z",
    title: "Kézműves előkészítés",
    location: "Műhely",
    coordinationDisplayName: "Kitalált Bence",
  }),
  Object.freeze({
    id: "schedule-coverage",
    sourceRecordId: "schedule-coverage",
    organizationId: "org-waldorf-local",
    ownerDisplayName: null,
    assigneeDisplayNames: Object.freeze([]),
    currentStatusLabel: null,
    groupId: "group-sunflower",
    startsAt: "2026-08-18T08:00:00.000Z",
    endsAt: "2026-08-18T10:00:00.000Z",
    title: "Csoportkísérés",
    location: "Tornatermi lefedettség",
  }),
]);

function snapshot(row: TrackingSourceRecord): TrackingSourceRecord {
  return Object.freeze({
    ...row,
    assigneeDisplayNames: Object.freeze([...row.assigneeDisplayNames]),
  });
}
export function createSyntheticTeacherRepository(
  records: readonly TrackingSourceRecord[] = SYNTHETIC_SCHEDULE,
) {
  if (!records.every(isTrackingSource)) throw new Error("Invalid synthetic tracking records");
  let current = records.map(snapshot);
  const repository: TeacherScheduleRepository = Object.freeze({
    readCurrent(query: TrackingQuery) {
      if (!isOptionalTrackingRange(query.from, query.to)) throw new Error("Invalid tracking range");
      // A missing limit leaves that side open.
      const from =
        query.from === undefined ? -Infinity : Date.parse(`${query.from}T00:00:00.000Z`);
      const to = query.to === undefined ? Infinity : Date.parse(`${query.to}T23:59:59.999Z`);
      return Object.freeze(
        current
          .filter(
            (row) =>
              row.groupId === query.groupScope.id &&
              row.organizationId === query.groupScope.organizationId &&
              Date.parse(row.startsAt) >= from &&
              Date.parse(row.startsAt) <= to,
          )
          .map(snapshot),
      );
    },
  });
  // Kept separately from the read port: fixture operators never become teacher capabilities.
  const operator = Object.freeze({
    replaceTrackingFields(
      id: string,
      fields: Pick<
        TrackingSourceRecord,
        "ownerDisplayName" | "assigneeDisplayNames" | "currentStatusLabel"
      >,
    ) {
      const index = current.findIndex((row) => row.id === id);
      if (index < 0) throw new Error("Unknown synthetic tracking record");
      const next = {
        ...current[index]!,
        ownerDisplayName: fields.ownerDisplayName,
        assigneeDisplayNames: fields.assigneeDisplayNames,
        currentStatusLabel: fields.currentStatusLabel,
      };
      if (!isTrackingSource(next)) throw new Error("Invalid synthetic tracking fields");
      current = current.map((row, position) => (position === index ? snapshot(next) : row));
    },
    snapshot() {
      return Object.freeze(current.map(snapshot));
    },
  });
  return Object.freeze({ repository, operator });
}
