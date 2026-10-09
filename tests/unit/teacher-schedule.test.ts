import { expect, it } from "vitest";
import { sessionGrantBindings } from "../../src/access/session-grants.ts";
import type { SessionContext } from "../../src/application/index.ts";
import {
  AuthorizationContract,
  InMemoryAuthorizationVersions,
} from "../../src/application/index.ts";
import { createSyntheticTeacherFacade, TEACHER_GROUPS } from "../../src/teacher-web/index.ts";
import { parseTeacherFilters } from "../../app/teacher/_lib/filters.ts";
import { readTeacherSchedule, teacherRange } from "../../app/teacher/_lib/schedule.ts";

const grantedScopes = TEACHER_GROUPS.map((group) => group.scope);
const session: SessionContext = {
  subjectId: "teacher",
  authorizationVersion: 1,
  ...sessionGrantBindings("teacher", "kindergarten_teacher", grantedScopes),
  roles: ["kindergarten_teacher"] as const,
  scopes: grantedScopes,
  runtimeMode: "synthetic",
  isSynthetic: true,
};

function facade(scenario: "ready" | "empty" | "denied" = "ready") {
  return createSyntheticTeacherFacade(
    new AuthorizationContract(new InMemoryAuthorizationVersions({ teacher: 1 })),
    scenario,
  );
}

async function entryIds(params: Record<string, string>) {
  const result = await readTeacherSchedule(facade(), session, parseTeacherFilters(params, session));
  return result.state === "success" ? result.data.entries.map((entry) => entry.id) : result.state;
}

it("Teacher unfiltered schedule shows every granted group ordered by start time", async () => {
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

it("Teacher an ungranted group stays denied and never widens to the granted groups", async () => {
  expect(await entryIds({ groupId: "group-ungranted" })).toBe("denied");
});

it("Teacher a group without matches in the range adds nothing and an empty range is empty", async () => {
  expect(await entryIds({ from: "2026-09-01", to: "2026-09-05" })).toBe("empty");
});

it("Teacher a dependency scenario outcome is returned unchanged", async () => {
  const result = await readTeacherSchedule(
    facade("denied"),
    session,
    parseTeacherFilters({}, session),
  );
  expect(result.state).toBe("denied");
  const none = await readTeacherSchedule(
    facade("ready"),
    { ...session, grants: [] },
    parseTeacherFilters({}, { ...session, grants: [] }),
  );
  expect(none.state).toBe("denied");
});

it("Teacher range leaves empty limits out", () => {
  expect(teacherRange(parseTeacherFilters({}, session))).toEqual({});
  expect(teacherRange(parseTeacherFilters({ from: "2026-08-14" }, session))).toEqual({
    from: "2026-08-14",
  });
});
