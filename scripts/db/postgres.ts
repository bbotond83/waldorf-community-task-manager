import pg from "pg";
import { redactSecrets } from "../../src/runtime/database/redact.ts";
import { type SqlClient, ToolingError } from "./common.ts";

type ClientFactory = (config: { connectionString: string; connectionTimeoutMillis: number }) => {
  connect(): Promise<unknown>;
} & SqlClient;

const createPgClient: ClientFactory = (config) =>
  new pg.Client(config) as unknown as ReturnType<ClientFactory>;

/** Opens one Postgres connection for the tooling; the message of a failure never carries secrets. */
export async function connectPostgres(
  url: string,
  createClient: ClientFactory = createPgClient,
): Promise<SqlClient> {
  const client = createClient({ connectionString: url, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ToolingError("connect", redactSecrets(message, [url]), {});
  }
  return client;
}
