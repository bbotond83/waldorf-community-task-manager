import "server-only";

import type { LibraryApplicationFacade } from "../../src/application/index.ts";
import { productionRequest } from "../_identity/production-request.ts";

/** The library facade of this request: the one built on the signed-in person's database client. */
export async function resolveLibraryFacade(): Promise<LibraryApplicationFacade | undefined> {
  const request = await productionRequest();
  return request.state === "ready" ? request.services.library : undefined;
}
