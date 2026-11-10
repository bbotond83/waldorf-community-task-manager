import "server-only";

import type { RotaApplicationFacade } from "../../src/application/index.ts";
import { productionRequest } from "./production-request.ts";

/**
 * The calendar and rota facade of this request: the one built on the signed-in person's database client
 * (undefined without a signed-in session). Admin, parent and teacher pages all read the rota through it.
 */
export async function resolveRotaFacade(): Promise<RotaApplicationFacade | undefined> {
  const request = await productionRequest();
  return request.state === "ready" ? request.services.rota : undefined;
}
