import "server-only";

import type { ChecklistApplicationFacade } from "../../src/application/index.ts";
import { productionRequest } from "../_identity/production-request.ts";

/** The checklist facade of this request: the one built on the signed-in person's database client. */
export async function resolveChecklistFacade(): Promise<ChecklistApplicationFacade | undefined> {
  const request = await productionRequest();
  return request.state === "ready" ? request.services.checklists : undefined;
}
