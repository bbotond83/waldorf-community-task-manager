import { expect, it } from "vitest";
import { sessionGrantBindings } from "../../src/access/session-grants.ts";
import type { SessionContext } from "../../src/application/index.ts";
import {
  AuthorizationContract,
  FacadePipeline,
  InMemoryAuthorizationVersions,
  TeacherApplicationFacade,
} from "../../src/application/index.ts";
import {
  classifyDoubleFailure,
  TEACHER_GROUPS,
  TEACHER_SCOPE,
  TeacherPortDouble,
  type TeacherScenario,
} from "../support/port-doubles.ts";
import { parseTeacherFilters } from "../../app/teacher/_lib/filters.ts";
import { readTeacherSchedule, teacherRange } from "../../app/teacher/_lib/schedule.ts";

const session: SessionContext = {
  subjectId: "teacher",
  authorizationVersion: 1,
  ...sessionGrantBindings("teacher", "kindergarten_teacher", [TEACHER_SCOPE]),
  roles: ["kindergarten_teacher"] as const,
  scopes: [TEACHER_SCOPE],
};
const groups = TEACHER_GROUPS.map((group) => ({ id: group.scope.id, label: group.label }));

function facade(scenario: TeacherScenario = "ready") {
  return new TeacherApplicationFacade(
    new FacadePipeline(
      new AuthorizationContract(new InMemoryAuthorizationVersions({ teacher: 1 })),
      classifyDoubleFailure,
    ),
    new TeacherPortDouble(undefined, scenario),
  );
}

async function entryIds(params: Record<string, string>) {
  const result = await readTeacherSchedule(
    facade(),
    session,
    TEACHER_SCOPE,
    parseTeacherFilters(params, groups),
  );
  return result.state === "success" ? result.data.entries.map((entry) => entry.id) : result.state;
}

it("Teacher unfiltered schedule shows the whole community ordered by start time", async () => {
  expect(await entryIds({})).toEqual(["schedule-garden", "schedule-crafts", "schedule-coverage"]);
});

it("Teacher a chosen group narrows the schedule", async () => {
  expect(await entryIds({ groupId: "group-sunflower" })).toEqual(["schedule-coverage"]);
});

it("Teacher one-sided and two-sided dates limit the schedule", async () => {
  expect(await entryIds({ from: "2026-08-14" })).toEqual(["schedule-crafts", "schedule-coverage"]);
  expect(await entryIds({ to: "2026-08-13" })).toEqual(["schedule-garden"]);
  expect(await entryIds({ from: "2026-08-14", to: "2026-08-14" })).toEqual(["schedule-crafts"]);
});

it("Teacher a start after the end keeps the validation outcome", async () => {
  expect(await entryIds({ from: "2026-08-20", to: "2026-08-12" })).toBe("validation");
  expect(await entryIds({ from: "invalid" })).toBe("validation");
});

it("Teacher an unknown group stays denied and never widens to the whole community", async () => {
  expect(await entryIds({ groupId: "group-unknown" })).toBe("denied");
});

it("Teacher a range without matches is empty", async () => {
  expect(await entryIds({ from: "2026-09-01", to: "2026-09-05" })).toBe("empty");
});

it("Teacher a dependency scenario outcome is returned unchanged", async () => {
  const result = await readTeacherSchedule(
    facade("denied"),
    session,
    TEACHER_SCOPE,
    parseTeacherFilters({}, groups),
  );
  expect(result.state).toBe("denied");
  const none = await readTeacherSchedule(
    facade("ready"),
    { ...session, grants: [] },
    TEACHER_SCOPE,
    parseTeacherFilters({}, groups),
  );
  expect(none.state).toBe("denied");
});

it("Teacher range leaves empty limits out", () => {
  expect(teacherRange(parseTeacherFilters({}, groups))).toEqual({});
  expect(teacherRange(parseTeacherFilters({ from: "2026-08-14" }, groups))).toEqual({
    from: "2026-08-14",
  });
});
