import "server-only";

import type { AdminApplicationFacade } from "../../../src/application/index.ts";
import { productionRequest } from "../../_identity/production-request.ts";

/**
 * The admin facade of this request: the one built on the signed-in person's database client (undefined
 * without a signed-in session).
 */
export async function resolveAdminFacade(): Promise<AdminApplicationFacade | undefined> {
  const request = await productionRequest();
  return request.state === "ready" ? request.services.admin : undefined;
}
