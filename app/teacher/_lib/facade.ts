import "server-only";

import { composeRuntime } from "../../../src/runtime/composition.ts";
import {
  createSyntheticTeacherFacade,
  type TeacherFixtureScenario,
} from "../../../src/teacher-web/index.ts";

export async function resolveTeacherFacade(scenario: TeacherFixtureScenario = "ready") {
  const composition = await composeRuntime();
  if (!composition.ok || composition.value.mode !== "synthetic") return undefined;
  return createSyntheticTeacherFacade(composition.value.application.authorization, scenario);
}
