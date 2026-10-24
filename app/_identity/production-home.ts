import "server-only";

import { resolveAdminAccess } from "../../src/runtime/production/access.ts";
import { productionRequest } from "./production-request.ts";

/**
 * Where the signed-in person of the production mode belongs (FR2.8): the home page of their strongest role.
 * `signed-out` has no session, `no-role` a session whose account holds no role this application serves, and
 * `unavailable` a database or sign-in service that could not answer.
 */
export type ProductionHome =
  | { state: "ready"; path: string }
  | { state: "signed-out" }
  | { state: "no-role" }
  | { state: "unavailable" };

export async function resolveProductionHome(): Promise<ProductionHome> {
  const request = await productionRequest();
  if (request.state === "unavailable") return { state: "unavailable" };
  if (request.state !== "ready") return { state: "signed-out" };
  // The admin check answers for every role: a person who is not an admin is `denied` with the home of the
  // strongest role they do hold, or with none when they hold no role at all.
  const access = await resolveAdminAccess(request.services.database, request.accountId);
  if (access.state === "success") return { state: "ready", path: access.data.profile.homePath };
  if (access.state === "denied") {
    return access.homePath ? { state: "ready", path: access.homePath } : { state: "no-role" };
  }
  return access.state === "unavailable" ? { state: "unavailable" } : { state: "signed-out" };
}
