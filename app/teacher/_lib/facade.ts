import "server-only";

import type { TeacherApplicationFacade } from "../../../src/application/index.ts";
import { composeRuntime } from "../../../src/runtime/composition.ts";
import {
  createSyntheticTeacherFacade,
  type TeacherFixtureScenario,
} from "../../../src/teacher-web/index.ts";
import { productionRequest } from "../../_identity/production-request.ts";

/**
 * The teacher facade of this request: the synthetic one in the synthetic mode (the scenario picks a fixture
 * variant), and in the production mode the one built on the signed-in person's database client, which has no
 * scenarios (undefined without a signed-in session).
 */
export async function resolveTeacherFacade(
  scenario: TeacherFixtureScenario = "ready",
): Promise<TeacherApplicationFacade | undefined> {
  const composition = await composeRuntime();
  if (!composition.ok) return undefined;
  if (composition.value.mode === "production") {
    const request = await productionRequest();
    return request.state === "ready" ? request.services.teacher : undefined;
  }
  return createSyntheticTeacherFacade(composition.value.application.authorization, scenario);
}
