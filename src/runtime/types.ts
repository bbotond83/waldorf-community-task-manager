import type { ProductionRuntimeConfig, SyntheticRuntimeConfig } from "./config.ts";
import type { ProductionServices } from "./production/services.ts";
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
      /** The person's session is the sign-in service's own (U2); requests act as that person. */
      authenticationBoundary: "supabase-session";
      application: RuntimeApplicationPorts;
      /** The parent, admin and teacher facades, made per signed-in request. */
      services: ProductionServices;
    };
