import { AuthorizationContract } from "../../application/index.ts";
import { parseWorkbook } from "../../import-parser/server.ts";
import type { ProductionRuntimeConfig } from "../config.ts";
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
  config: ProductionRuntimeConfig,
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
  config: ProductionRuntimeConfig,
  dependencies: ProductionDependencies = {},
): Extract<RuntimeComposition, { mode: "production" }> {
  const database =
    dependencies.database ?? clientFor(config, dependencies.environment ?? process.env);
  // The composition is the one place that reaches the server-only workbook reader (BR41.2, NFR2.21); the
  // services and adapters receive it as a plain function.
  const services: ProductionServices = createProductionServices(database, { parseWorkbook });
  return {
    mode: "production",
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
