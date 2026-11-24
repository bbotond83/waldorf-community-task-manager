import "server-only";

import type {
  AnimalCareApplicationFacade,
  InformationApplicationFacade,
} from "../../src/application/index.ts";
import { productionRequest } from "../_identity/production-request.ts";

/** The animal-care facade of this request: the one built on the signed-in person's database client. */
export async function resolveAnimalCareFacade(): Promise<AnimalCareApplicationFacade | undefined> {
  const request = await productionRequest();
  return request.state === "ready" ? request.services.animalCare : undefined;
}

/** The information facade of this request. */
export async function resolveInformationFacade(): Promise<
  InformationApplicationFacade | undefined
> {
  const request = await productionRequest();
  return request.state === "ready" ? request.services.information : undefined;
}
