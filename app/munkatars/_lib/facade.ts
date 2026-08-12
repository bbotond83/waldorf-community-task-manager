import "server-only";

import { composeRuntime } from "../../../src/runtime/composition.ts";
import {
  createSyntheticStaffFacade,
  type StaffFixtureScenario,
} from "../../../src/staff-web/index.ts";

export async function resolveStaffFacade(scenario: StaffFixtureScenario = "ready") {
  const composition = await composeRuntime();
  if (!composition.ok || composition.value.mode !== "synthetic") return undefined;
  return createSyntheticStaffFacade(composition.value.application.authorization, scenario);
}
