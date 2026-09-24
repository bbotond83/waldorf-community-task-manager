import type { ProductionRuntimeConfig, SyntheticRuntimeConfig } from "./config.ts";
import type { SyntheticProfile } from "./synthetic/profiles.ts";
import type { AuthorizationContract } from "../application/index.ts";

export type RuntimeApplicationPorts = Readonly<{
  authorization: AuthorizationContract;
}>;

export type RuntimeComposition =
  | {
      mode: "synthetic";
      config: SyntheticRuntimeConfig;
      profiles: readonly SyntheticProfile[];
      application: RuntimeApplicationPorts;
    }
  | {
      mode: "production";
      config: ProductionRuntimeConfig;
      authenticationBoundary: "supabase-unlinked";
      application: RuntimeApplicationPorts;
    };
