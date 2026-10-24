import "server-only";

import type { AdminApplicationFacade } from "../../../src/application/index.ts";
import { composeRuntime } from "../../../src/runtime/composition.ts";
import { getSyntheticAdminPort } from "../../../src/admin-core/synthetic-admin.ts";
import { createSyntheticAdvancedAdminFacade } from "../../../src/admin-advanced/index.ts";
import { productionRequest } from "../../_identity/production-request.ts";

/**
 * The admin facade of this request: the synthetic one in the synthetic mode, and in the production mode the
 * one built on the signed-in person's database client (undefined without a signed-in session).
 */
export async function resolveAdminFacade(): Promise<AdminApplicationFacade | undefined> {
  const composition = await composeRuntime();
  if (!composition.ok) return undefined;
  if (composition.value.mode === "production") {
    const request = await productionRequest();
    return request.state === "ready" ? request.services.admin : undefined;
  }
  return createSyntheticAdvancedAdminFacade(
    composition.value.application.authorization,
    getSyntheticAdminPort(),
  );
}
