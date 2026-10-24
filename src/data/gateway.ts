import type { SupabaseClient } from "@supabase/supabase-js";
import type { DatabaseClient } from "../runtime/database/client.ts";
import { malformedResponse, RetryableDataFailure, TerminalDataFailure } from "./errors.ts";
import { asRow, type Row } from "./values.ts";

/**
 * What every named database function returns: the envelope built by `platform_result` (U1), plus the
 * extra fields a function adds (a version, a list of items, a field name). Read through `values.ts`.
 */
export type Envelope = Row &
  Readonly<{ state: string; reference: string | null; code: string | null }>;

const NO_KEY = "retry-not-available";

/**
 * The one place the adapters touch the database client. A call to a named function returns its envelope;
 * a table read returns the rows. Unexpected failures leave here as one of the two typed errors (BR32.4), so
 * an adapter never sees database text and a screen never receives it. Expected refusals that the client maps
 * itself (a permission error, a duplicate, a rejected value) become envelopes with the matching state.
 */
export class DataGateway {
  readonly database: DatabaseClient;

  constructor(database: DatabaseClient) {
    this.database = database;
  }

  async call(
    name: string,
    args: Readonly<Record<string, unknown>>,
    idempotencyKey?: string,
  ): Promise<Envelope> {
    const result = await this.database.read<unknown>(
      (client: SupabaseClient) => client.rpc(name, { ...args }) as never,
      { idempotencyKey: idempotencyKey ?? NO_KEY, action: name },
    );
    switch (result.state) {
      case "success":
        return parseEnvelope(result.data);
      case "denied":
        return { state: "denied", reference: null, code: "authorization_denied" };
      case "conflict":
        return { state: "conflict", reference: null, code: "database_conflict" };
      case "validation":
        return { state: "validation", reference: null, code: "request_invalid" };
      case "dependency-failure-retryable":
        throw new RetryableDataFailure();
      default:
        throw new TerminalDataFailure("UNEXPECTED_DEPENDENCY_FAILURE");
    }
  }

  /** A read of a table or of a function that returns plain data (not an envelope). */
  async select(action: string, run: (client: SupabaseClient) => unknown): Promise<unknown> {
    const result = await this.database.read<unknown>(run as never, {
      idempotencyKey: NO_KEY,
      action,
    });
    switch (result.state) {
      case "success":
        return result.data;
      case "dependency-failure-retryable":
        throw new RetryableDataFailure();
      default:
        throw new TerminalDataFailure("UNEXPECTED_DEPENDENCY_FAILURE");
    }
  }
}

function parseEnvelope(data: unknown): Envelope {
  const row = asRow(data);
  const { state, reference, code } = row;
  if (typeof state !== "string") throw malformedResponse();
  if (reference !== null && reference !== undefined && typeof reference !== "string") {
    throw malformedResponse();
  }
  if (code !== null && code !== undefined && typeof code !== "string") throw malformedResponse();
  return { ...row, state, reference: reference ?? null, code: code ?? null };
}
