import "server-only";

import type { ParentApplicationFacade } from "../../../src/application/index.ts";
import { productionRequest } from "../../_identity/production-request.ts";

/**
 * The parent facade of this request: the one built on the signed-in person's database client (undefined
 * without a signed-in session).
 */
export async function resolveParentFacade(): Promise<ParentApplicationFacade | undefined> {
  const request = await productionRequest();
  return request.state === "ready" ? request.services.parent : undefined;
}
