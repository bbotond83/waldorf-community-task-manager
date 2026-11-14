import "server-only";

import type {
  DirectoryApplicationFacade,
  ParentApplicationFacade,
} from "../../../src/application/index.ts";
import { productionRequest } from "../../_identity/production-request.ts";

/**
 * The parent facade of this request: the one built on the signed-in person's database client (undefined
 * without a signed-in session).
 */
export async function resolveParentFacade(): Promise<ParentApplicationFacade | undefined> {
  const request = await productionRequest();
  return request.state === "ready" ? request.services.parent : undefined;
}

/** The directory facade of this request: every signed-in role reads the directory through it (U3). */
export async function resolveDirectoryFacade(): Promise<DirectoryApplicationFacade | undefined> {
  const request = await productionRequest();
  return request.state === "ready" ? request.services.directory : undefined;
}
