import "server-only";
import { cache } from "react";
import { composeRuntime } from "../../src/runtime/composition.ts";
import type { RequestServices } from "../../src/runtime/production/services.ts";
import { currentSession } from "./current-session.ts";

/**
 * The signed-in request of the production mode (FR2.8, BR32.7): the real session of the page or action
 * (U2) and the facades built on a database client that acts as that person. In the synthetic mode there is
 * no such request. Memoised for one render, so a page that asks for the session and the facade pays for one
 * session check.
 */
export type ProductionRequest =
  | { state: "ready"; accountId: string; services: RequestServices }
  | { state: "signed-out" }
  | { state: "unavailable" }
  | { state: "not-production" };

export const productionRequest = cache(async (): Promise<ProductionRequest> => {
  const composition = await composeRuntime();
  if (!composition.ok || composition.value.mode !== "production") {
    return { state: "not-production" };
  }
  const session = await currentSession();
  if (session.status === "signed-out") return { state: "signed-out" };
  if (session.status === "unavailable") return { state: "unavailable" };
  return {
    state: "ready",
    accountId: session.accountId,
    services: composition.value.services.forRequest(session.accessToken),
  };
});

/**
 * True when the application runs against the real database (the production mode). Pages that keep their
 * synthetic form and copy in the synthetic mode ask this, so the two modes can differ in exactly the places
 * the owner approved (BR32.7) and nowhere else.
 */
export async function isProductionMode(): Promise<boolean> {
  const composition = await composeRuntime();
  return composition.ok && composition.value.mode === "production";
}
