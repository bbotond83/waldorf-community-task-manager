import "server-only";

import type { TodoApplicationFacade } from "../../src/application/index.ts";
import { productionRequest } from "../_identity/production-request.ts";

/** The to-do facade of this request: the one built on the signed-in person's database client. */
export async function resolveTodoFacade(): Promise<TodoApplicationFacade | undefined> {
  const request = await productionRequest();
  return request.state === "ready" ? request.services.todo : undefined;
}
