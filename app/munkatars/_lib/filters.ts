import type { Scope } from "../../../src/access/index.ts";
import {
  STAFF_FIXTURE_SCENARIOS,
  STAFF_GROUPS,
  UNGRANTED_STAFF_GROUP,
  type StaffFixtureScenario,
} from "../../../src/staff-web/index.ts";

export const DEFAULT_STAFF_FILTERS = Object.freeze({
  groupId: STAFF_GROUPS[0]!.scope.id,
  from: "2026-08-12",
  to: "2026-08-20",
  scenario: "ready" as StaffFixtureScenario,
});

export type StaffSearchParams = Readonly<{
  csoport?: string | string[];
  kezdet?: string | string[];
  veg?: string | string[];
  scenario?: string | string[];
}>;

export type StaffFilters = Readonly<{
  groupId: string;
  groupScope: Scope;
  from: string;
  to: string;
  scenario: StaffFixtureScenario;
}>;

export function parseStaffFilters(params: StaffSearchParams): StaffFilters {
  const groupId = first(params.csoport) ?? DEFAULT_STAFF_FILTERS.groupId;
  const scenarioValue = first(params.scenario);
  const scenario = STAFF_FIXTURE_SCENARIOS.includes(scenarioValue as StaffFixtureScenario)
    ? (scenarioValue as StaffFixtureScenario)
    : DEFAULT_STAFF_FILTERS.scenario;
  const granted = STAFF_GROUPS.find(({ scope }) => scope.id === groupId);
  const groupScope =
    granted?.scope ??
    (groupId === UNGRANTED_STAFF_GROUP.id
      ? UNGRANTED_STAFF_GROUP
      : Object.freeze({
          ...UNGRANTED_STAFF_GROUP,
          id: "group-unrecognized",
        }));
  return Object.freeze({
    groupId,
    groupScope,
    from: first(params.kezdet) ?? DEFAULT_STAFF_FILTERS.from,
    to: first(params.veg) ?? DEFAULT_STAFF_FILTERS.to,
    scenario,
  });
}

export function staffFilterQuery(filters: StaffFilters): string {
  const query = new URLSearchParams({
    csoport: filters.groupId,
    kezdet: filters.from,
    veg: filters.to,
  });
  if (filters.scenario !== "ready") query.set("scenario", filters.scenario);
  return query.toString();
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
