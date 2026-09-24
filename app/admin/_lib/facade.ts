import "server-only";

import { composeRuntime } from "../../../src/runtime/composition.ts";
import { getSyntheticAdminPort } from "../../../src/admin-core/synthetic-admin.ts";
import { createSyntheticAdvancedAdminFacade } from "../../../src/admin-advanced/index.ts";

export async function resolveAdminFacade() {
  const composition = await composeRuntime();
  if (!composition.ok || composition.value.mode !== "synthetic") return undefined;
  return createSyntheticAdvancedAdminFacade(
    composition.value.application.authorization,
    getSyntheticAdminPort(),
  );
}
