import "server-only";

import { createSyntheticParentFacade } from "../../../src/parent-web/index.ts";
import { composeRuntime } from "../../../src/runtime/composition.ts";

let cachedFacade: ReturnType<typeof createSyntheticParentFacade> | undefined;

export async function resolveParentFacade() {
  const composition = await composeRuntime();
  if (!composition.ok || composition.value.mode !== "synthetic") return undefined;
  cachedFacade ??= createSyntheticParentFacade(composition.value.application.authorization);
  return cachedFacade;
}

export function resetParentFacadeCache(): void {
  cachedFacade = undefined;
}
