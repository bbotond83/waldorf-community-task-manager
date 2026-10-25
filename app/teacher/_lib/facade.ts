import "server-only";

import type { TeacherApplicationFacade } from "../../../src/application/index.ts";
import { productionRequest } from "../../_identity/production-request.ts";

/**
 * The teacher facade of this request: the one built on the signed-in person's database client (undefined
 * without a signed-in session).
 */
export async function resolveTeacherFacade(): Promise<TeacherApplicationFacade | undefined> {
  const request = await productionRequest();
  return request.state === "ready" ? request.services.teacher : undefined;
}
