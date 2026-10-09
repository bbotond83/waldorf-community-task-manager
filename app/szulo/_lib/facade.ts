import "server-only";

import { createSyntheticParentFacade } from "../../../src/parent-web/index.ts";
import { composeRuntime } from "../../../src/runtime/composition.ts";

type ParentFacade = ReturnType<typeof createSyntheticParentFacade>;

// Kept on the global object so the fixture reset route clears the same cache the pages and
// actions use (the production build can load this module more than once). Clearing it also
// drops remembered idempotent results, so a reset really returns to the first-run state.
const FACADE_KEY = Symbol.for("waldorf.syntheticParentFacade");
type FacadeHolder = { [FACADE_KEY]?: ParentFacade };

export async function resolveParentFacade() {
  const composition = await composeRuntime();
  if (!composition.ok || composition.value.mode !== "synthetic") return undefined;
  const holder = globalThis as FacadeHolder;
  holder[FACADE_KEY] ??= createSyntheticParentFacade(composition.value.application.authorization);
  return holder[FACADE_KEY];
}

export function resetParentFacadeCache(): void {
  (globalThis as FacadeHolder)[FACADE_KEY] = undefined;
}
