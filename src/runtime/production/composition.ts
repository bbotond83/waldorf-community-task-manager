import type { ProductionRuntimeConfig } from "../config.ts";
import type { RuntimeComposition } from "../types.ts";
import { AuthorizationContract } from "../../application/index.ts";

export function createProductionComposition(
  config: ProductionRuntimeConfig,
): Extract<RuntimeComposition, { mode: "production" }> {
  // This slot validates configuration only. It intentionally performs no target call.
  return {
    mode: "production",
    config,
    authenticationBoundary: "supabase-unlinked",
    application: {
      authorization: new AuthorizationContract({
        getCurrentVersion: () => undefined,
        clearProtectedCache: () => undefined,
      }),
    },
  };
}
