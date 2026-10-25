import type { RuntimeConfig } from "./config.ts";
import type { ProductionServices } from "./production/services.ts";
import type { AuthorizationContract } from "../application/index.ts";

export type RuntimeApplicationPorts = Readonly<{
  authorization: AuthorizationContract;
}>;

/** The one runtime composition: the validated settings and the services made per signed-in request. */
export type RuntimeComposition = {
  config: RuntimeConfig;
  /** The person's session is the sign-in service's own (U2); requests act as that person. */
  authenticationBoundary: "supabase-session";
  application: RuntimeApplicationPorts;
  /** The parent, admin and teacher facades, made per signed-in request. */
  services: ProductionServices;
};
