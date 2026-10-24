import "server-only";

import type { ParentApplicationFacade } from "../../../src/application/index.ts";
import { createSyntheticParentFacade } from "../../../src/parent-web/index.ts";
import { composeRuntime } from "../../../src/runtime/composition.ts";
import { productionRequest } from "../../_identity/production-request.ts";

// Kept on the global object so the fixture reset route clears the same cache the pages and
// actions use (the production build can load this module more than once). Clearing it also
// drops remembered idempotent results, so a reset really returns to the first-run state.
const FACADE_KEY = Symbol.for("waldorf.syntheticParentFacade");
type FacadeHolder = { [FACADE_KEY]?: ParentApplicationFacade };

/**
 * The parent facade of this request: the synthetic one in the synthetic mode, and in the production mode
 * the one built on the signed-in person's database client (undefined without a signed-in session).
 */
export async function resolveParentFacade(): Promise<ParentApplicationFacade | undefined> {
  const composition = await composeRuntime();
  if (!composition.ok) return undefined;
  if (composition.value.mode === "production") {
    const request = await productionRequest();
    return request.state === "ready" ? request.services.parent : undefined;
  }
  const holder = globalThis as FacadeHolder;
  holder[FACADE_KEY] ??= createSyntheticParentFacade(composition.value.application.authorization);
  return holder[FACADE_KEY];
}

export function resetParentFacadeCache(): void {
  (globalThis as FacadeHolder)[FACADE_KEY] = undefined;
}
