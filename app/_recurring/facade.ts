import "server-only";

import type { RecurringApplicationFacade } from "../../src/application/index.ts";
import { productionRequest } from "../_identity/production-request.ts";

/** The recurring-duty facade of this request: the one built on the signed-in person's database client. */
export async function resolveRecurringFacade(): Promise<RecurringApplicationFacade | undefined> {
  const request = await productionRequest();
  return request.state === "ready" ? request.services.recurring : undefined;
}
