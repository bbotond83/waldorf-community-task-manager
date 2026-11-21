import "server-only";

import type { EventApplicationFacade } from "../../src/application/index.ts";
import { productionRequest } from "../_identity/production-request.ts";

/** The event facade of this request: the one built on the signed-in person's database client. */
export async function resolveEventFacade(): Promise<EventApplicationFacade | undefined> {
  const request = await productionRequest();
  return request.state === "ready" ? request.services.events : undefined;
}
