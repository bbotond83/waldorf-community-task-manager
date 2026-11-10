import { AuthorizationContract } from "../../application/index.ts";
import type { RuntimeConfig } from "../config.ts";
import { createDatabaseClient, type DatabaseClient } from "../database/client.ts";
import { DEFAULT_DATABASE_SCHEMA } from "../database/config.ts";
import type { RuntimeComposition } from "../types.ts";
import { createProductionServices, type ProductionServices } from "./services.ts";

/**
 * The production composition (BR32.1, BR32.7, BR42.1): the database client built from the validated settings and the
 * three facades of a signed-in request, made per request by `services.forRequest(accessToken)`. Building it
 * performs no target call; the client only connects when a request uses it. The `authorization` of the
 * shared application slot stays a contract that knows no version, so it denies anything that reaches it
 * outside a signed-in request.
 */
export type ProductionDependencies = Readonly<{
  /** For tests: a database client to use instead of the one built from the settings. */
  database?: DatabaseClient;
  environment?: Partial<Record<string, string | undefined>>;
}>;

const clients = new Map<string, DatabaseClient>();

function clientFor(
  config: RuntimeConfig,
  environment: Partial<Record<string, string | undefined>>,
): DatabaseClient {
  const schema = environment.DATABASE_SCHEMA?.trim() || DEFAULT_DATABASE_SCHEMA;
  const fingerprint = `${config.supabaseUrl}|${schema}|${config.supabaseAnonKey}`;
  const existing = clients.get(fingerprint);
  if (existing) return existing;
  const created = createDatabaseClient({
    url: config.supabaseUrl,
    publicKey: config.supabaseAnonKey,
    sessionSecret: config.sessionSecret,
    schema,
  });
  clients.set(fingerprint, created);
  return created;
}

export function createProductionComposition(
  config: RuntimeConfig,
  dependencies: ProductionDependencies = {},
): RuntimeComposition {
  const database =
    dependencies.database ?? clientFor(config, dependencies.environment ?? process.env);
  const services: ProductionServices = createProductionServices(database);
  return {
    config,
    authenticationBoundary: "supabase-session",
    application: {
      authorization: new AuthorizationContract({
        getCurrentVersion: () => undefined,
        clearProtectedCache: () => undefined,
      }),
    },
    services,
  };
}
