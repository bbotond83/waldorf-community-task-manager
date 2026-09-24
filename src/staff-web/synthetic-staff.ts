import type { Scope } from "../access/index.ts";
import {
  FacadePipeline,
  StaffApplicationFacade,
  type DomainOutcome,
  type ScheduleEntryModel,
  type ScheduleModel,
  type StaffApplicationPort,
} from "../application/index.ts";
import type { AuthorizationContract } from "../application/index.ts";

export const STAFF_GROUPS = Object.freeze([
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

export const UNGRANTED_STAFF_GROUP: Scope = Object.freeze({
  id: "group-ungranted",
  type: "group",
  organizationId: "org-waldorf-local",
});

export type StaffFixtureScenario = "ready" | "empty" | "denied" | "retryable" | "terminal";

export const STAFF_FIXTURE_SCENARIOS = Object.freeze([
  "ready",
  "empty",
  "denied",
  "retryable",
  "terminal",
] satisfies readonly StaffFixtureScenario[]);

export const STAFF_FIXTURE_VERSION = "staff-schedule-local-v1";

const SYNTHETIC_SCHEDULE: readonly (ScheduleEntryModel & { groupId: string })[] = Object.freeze([
  Object.freeze({
    id: "schedule-garden",
    groupId: "group-oak",
    startsAt: "2026-08-13T06:30:00.000Z",
    endsAt: "2026-08-13T07:30:00.000Z",
    title: "Reggeli udvari felügyelet",
    location: "Keleti udvar",
    coordinationDisplayName: "Kitalált Ágnes",
  }),
  Object.freeze({
    id: "schedule-crafts",
    groupId: "group-oak",
    startsAt: "2026-08-14T12:00:00.000Z",
    endsAt: "2026-08-14T14:00:00.000Z",
    title: "Kézműves előkészítés",
    location: "Műhely",
    coordinationDisplayName: "Kitalált Bence",
  }),
  Object.freeze({
    id: "schedule-coverage",
    groupId: "group-sunflower",
    startsAt: "2026-08-18T08:00:00.000Z",
    endsAt: "2026-08-18T10:00:00.000Z",
    title: "Csoportkísérés",
    location: "Tornatermi lefedettség",
  }),
]);

class SyntheticStaffDependencyError extends Error {
  readonly classification: "retryable" | "terminal";

  constructor(classification: "retryable" | "terminal") {
    super("Synthetic staff dependency failure");
    this.name = "SyntheticStaffDependencyError";
    this.classification = classification;
  }
}

export class SyntheticStaffScheduleAdapter implements StaffApplicationPort {
  readonly fixtureVersion = STAFF_FIXTURE_VERSION;
  private readonly scenario: StaffFixtureScenario;

  constructor(scenario: StaffFixtureScenario = "ready") {
    this.scenario = scenario;
  }

  async getSchedule(input: {
    actorId: string;
    groupScope: Scope;
    from: string;
    to: string;
  }): Promise<DomainOutcome<ScheduleModel>> {
    if (this.scenario === "retryable" || this.scenario === "terminal") {
      throw new SyntheticStaffDependencyError(this.scenario);
    }
    if (this.scenario === "denied") return { state: "denied" };
    if (this.scenario === "empty") return { state: "empty" };

    const from = Date.parse(`${input.from}T00:00:00.000Z`);
    const to = Date.parse(`${input.to}T23:59:59.999Z`);
    const entries = SYNTHETIC_SCHEDULE.filter((entry) => {
      const startsAt = Date.parse(entry.startsAt);
      return entry.groupId === input.groupScope.id && startsAt >= from && startsAt <= to;
    }).map(projectScheduleEntry);

    return entries.length === 0
      ? { state: "empty" }
      : { state: "success", data: Object.freeze({ entries: Object.freeze(entries) }) };
  }
}

export function createSyntheticStaffFacade(
  authorization: AuthorizationContract,
  scenario: StaffFixtureScenario = "ready",
): StaffApplicationFacade {
  const classifier = (error: unknown): "retryable" | "terminal" =>
    error instanceof SyntheticStaffDependencyError ? error.classification : "terminal";
  return new StaffApplicationFacade(
    new FacadePipeline(authorization, classifier),
    new SyntheticStaffScheduleAdapter(scenario),
  );
}

function projectScheduleEntry(entry: ScheduleEntryModel & { groupId: string }): ScheduleEntryModel {
  return Object.freeze({
    id: entry.id,
    startsAt: entry.startsAt,
    endsAt: entry.endsAt,
    title: entry.title,
    location: entry.location,
    ...(entry.coordinationDisplayName
      ? { coordinationDisplayName: entry.coordinationDisplayName }
      : {}),
  });
}
