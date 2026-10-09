import { currentSyntheticActor } from "./access-state.ts";
import type { SyntheticRuntimeConfig } from "../config.ts";
import type { RuntimeComposition } from "../types.ts";
import { SYNTHETIC_PROFILES } from "./profiles.ts";
import { AuthorizationContract } from "../../application/index.ts";

export function createSyntheticComposition(
  config: SyntheticRuntimeConfig,
): Extract<RuntimeComposition, { mode: "synthetic" }> {
  const versions = {
    getCurrentVersion(subjectId: string) {
      return currentSyntheticActor(subjectId)?.authorizationVersion;
    },
    clearProtectedCache() {
      /* Protected projections are request-scoped; no shared cache. */
    },
  };
  return {
    mode: "synthetic",
    config,
    profiles: SYNTHETIC_PROFILES,
    application: { authorization: new AuthorizationContract(versions) },
  };
}
