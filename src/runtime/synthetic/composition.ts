import type { SyntheticRuntimeConfig } from "../config.ts";
import type { RuntimeComposition } from "../types.ts";
import { SYNTHETIC_PROFILES } from "./profiles.ts";
import { AuthorizationContract, InMemoryAuthorizationVersions } from "../../application/index.ts";

export function createSyntheticComposition(
  config: SyntheticRuntimeConfig,
): Extract<RuntimeComposition, { mode: "synthetic" }> {
  const versions = new InMemoryAuthorizationVersions(
    Object.fromEntries(
      SYNTHETIC_PROFILES.map((profile) => [profile.id, profile.authorizationVersion]),
    ),
  );
  return {
    mode: "synthetic",
    config,
    profiles: SYNTHETIC_PROFILES,
    application: { authorization: new AuthorizationContract(versions) },
  };
}
