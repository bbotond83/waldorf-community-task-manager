import "server-only";
import { cache } from "react";
import { composeRuntime } from "../../src/runtime/composition.ts";
import type { RequestServices } from "../../src/runtime/production/services.ts";
import { currentSession } from "./current-session.ts";

/**
 * The signed-in request (FR2.8, BR32.7): the real session of the page or action (U2) and the facades built
 * on a database client that acts as that person. `unavailable` covers a runtime that is not configured and a
 * sign-in service or database that could not answer. Memoised for one render, so a page that asks for the
 * session and the facade pays for one session check.
 */
export type ProductionRequest =
  | { state: "ready"; accountId: string; services: RequestServices }
  | { state: "signed-out" }
  | { state: "unavailable" };

export const productionRequest = cache(async (): Promise<ProductionRequest> => {
  const composition = await composeRuntime();
  if (!composition.ok) return { state: "unavailable" };
  const session = await currentSession();
  if (session.status === "signed-out") return { state: "signed-out" };
  if (session.status === "unavailable") return { state: "unavailable" };
  return {
    state: "ready",
    accountId: session.accountId,
    services: composition.value.services.forRequest(session.accessToken),
  };
});
