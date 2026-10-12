import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ApplicationResult, RetryMetadata } from "../../application/contracts.ts";
import {
  conflict,
  denied,
  retryableFailure,
  success,
  terminalFailure,
  validation,
} from "../../application/results.ts";
import type { DatabaseConfig } from "./config.ts";
import { redactSecrets } from "./redact.ts";

/**
 * The database client the application kernel uses (FR4.2, BR4.1).
 *
 * One client per process, created from the validated configuration and bound to its schema profile.
 * Every call returns one of the existing explicit result states; an unexpected infrastructure error
 * is mapped to `retryable` or `terminal` here and never reaches a screen as a raw error.
 */

/** What a named database function returns: the envelope built by `platform_result` (U1 SQL). */
export type OperationEnvelope = Readonly<{
  state: string;
  reference: string | null;
  code: string | null;
}>;

export type OperationOutcome = Readonly<{ reference: string | null; code: string | null }>;

/** A database error reduced to the parts that are safe to log. */
export type SafeDatabaseError = Readonly<{
  code: string;
  status: number | undefined;
  message: string;
  retryable: boolean;
}>;

type PostgrestLikeError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  status?: number;
};

export type DatabaseResponse<T> = Readonly<{
  data: T | null;
  error: PostgrestLikeError | null;
  status?: number;
}>;

export interface DatabaseClient {
  readonly schema: string;
  /** Calls a named database function that returns an operation envelope. */
  callOperation(
    name: string,
    args: Readonly<Record<string, unknown>>,
    retry: RetryMetadata,
  ): Promise<ApplicationResult<OperationOutcome>>;
  /** Runs any read through the same error mapping. */
  read<T>(
    run: (client: SupabaseClient) => PromiseLike<DatabaseResponse<T>>,
    retry: RetryMetadata,
  ): Promise<ApplicationResult<T>>;
  /** A client acting as the signed-in account that owns `accessToken`. */
  forSession(accessToken: string): DatabaseClient;
}

export type SupabaseFactory = (
  url: string,
  key: string,
  options: Parameters<typeof createClient>[2],
) => SupabaseClient;

export type DatabaseClientOptions = Readonly<{
  createSupabase?: SupabaseFactory;
  /** Receives the redacted description of every unexpected error (never the raw error). */
  onUnexpectedError?: (error: SafeDatabaseError) => void;
}>;

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const NETWORK_MESSAGE = /fetch failed|network|timed? ?out|econn|enotfound|socket|aborted/i;

function isRetryable(error: PostgrestLikeError): boolean {
  const code = error.code ?? "";
  if (code.startsWith("08") || code.startsWith("53") || code.startsWith("57P")) return true;
  if (code === "40001" || code === "40P01" || /^PGRST00[0-3]$/.test(code)) return true;
  if (error.status !== undefined && RETRYABLE_STATUS.has(error.status)) return true;
  return code === "" && NETWORK_MESSAGE.test(error.message ?? "");
}

export function describeDatabaseError(
  error: PostgrestLikeError,
  secrets: readonly string[] = [],
): SafeDatabaseError {
  return {
    code: error.code || "UNKNOWN",
    status: error.status,
    message: redactSecrets(error.message ?? "", secrets).slice(0, 200),
    retryable: isRetryable(error),
  };
}

/** Failures the caller should see as a business outcome rather than an infrastructure problem. */
function mapExpectedError<T>(error: PostgrestLikeError): ApplicationResult<T> | undefined {
  const code = error.code ?? "";
  if (code === "42501" || error.status === 401 || error.status === 403) return denied<T>();
  if (code === "23505" || error.status === 409) return conflict<T>();
  if (/^22/.test(code) || ["23502", "23503", "23514"].includes(code)) {
    return validation<T>({ request: "REQUEST_REJECTED" }, "REQUEST_REJECTED");
  }
  return undefined;
}

function mapEnvelope(envelope: OperationEnvelope): ApplicationResult<OperationOutcome> {
  const code = envelope.code ?? undefined;
  switch (envelope.state) {
    case "success":
      return success({ reference: envelope.reference ?? null, code: envelope.code ?? null }, code);
    case "validation":
      return validation({ request: code ?? "VALIDATION_FAILED" }, code);
    case "denied":
      return denied(code);
    case "conflict":
      return conflict(code);
    default:
      // "terminal" and any state this client does not know: never guess a success.
      return terminalFailure(envelope.state === "terminal" ? code : "UNEXPECTED_RESPONSE");
  }
}

class SupabaseDatabaseClient implements DatabaseClient {
  readonly schema: string;
  private readonly supabase: SupabaseClient;
  private readonly config: DatabaseConfig;
  private readonly options: DatabaseClientOptions;

  constructor(supabase: SupabaseClient, config: DatabaseConfig, options: DatabaseClientOptions) {
    this.supabase = supabase;
    this.config = config;
    this.options = options;
    this.schema = config.schema;
  }

  private unexpected<T>(error: PostgrestLikeError, retry: RetryMetadata): ApplicationResult<T> {
    const safe = describeDatabaseError(error, [this.config.publicKey, this.config.sessionSecret]);
    this.options.onUnexpectedError?.(safe);
    return safe.retryable
      ? retryableFailure<T>(retry)
      : terminalFailure<T>("UNEXPECTED_DEPENDENCY_FAILURE");
  }

  private async guard<T>(
    run: () => PromiseLike<DatabaseResponse<T>>,
    retry: RetryMetadata,
    onData: (data: T) => ApplicationResult<T>,
  ): Promise<ApplicationResult<T>> {
    let response: DatabaseResponse<T>;
    try {
      response = await run();
    } catch (thrown) {
      const message = thrown instanceof Error ? thrown.message : "";
      return this.unexpected<T>({ message }, retry);
    }
    if (response.error) {
      const error = { ...response.error, status: response.error.status ?? response.status };
      return mapExpectedError<T>(error) ?? this.unexpected<T>(error, retry);
    }
    if (response.data === null || response.data === undefined) {
      return this.unexpected<T>({ message: "empty response" }, retry);
    }
    return onData(response.data);
  }

  async callOperation(
    name: string,
    args: Readonly<Record<string, unknown>>,
    retry: RetryMetadata,
  ): Promise<ApplicationResult<OperationOutcome>> {
    const result = await this.guard<OperationEnvelope>(
      () =>
        this.supabase.rpc(name, { ...args }) as PromiseLike<DatabaseResponse<OperationEnvelope>>,
      retry,
      (data) => success(data) as ApplicationResult<OperationEnvelope>,
    );
    if (result.state !== "success") return result as ApplicationResult<OperationOutcome>;
    return mapEnvelope(result.data);
  }

  read<T>(
    run: (client: SupabaseClient) => PromiseLike<DatabaseResponse<T>>,
    retry: RetryMetadata,
  ): Promise<ApplicationResult<T>> {
    return this.guard<T>(
      () => run(this.supabase),
      retry,
      (data) => success(data),
    );
  }

  forSession(accessToken: string): DatabaseClient {
    const factory = this.options.createSupabase ?? createClient;
    return new SupabaseDatabaseClient(
      factory(this.config.url, this.config.publicKey, clientOptions(this.config, accessToken)),
      this.config,
      this.options,
    );
  }
}

function clientOptions(config: DatabaseConfig, accessToken?: string) {
  return {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    db: { schema: config.schema },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {},
  } as unknown as Parameters<typeof createClient>[2];
}

export function createDatabaseClient(
  config: DatabaseConfig,
  options: DatabaseClientOptions = {},
): DatabaseClient {
  const factory = options.createSupabase ?? createClient;
  return new SupabaseDatabaseClient(
    factory(config.url, config.publicKey, clientOptions(config)),
    config,
    options,
  );
}

let shared: { fingerprint: string; client: DatabaseClient } | undefined;

/** The one client of this process. A second call with a different configuration is a bug. */
export function getDatabaseClient(
  config: DatabaseConfig,
  options: DatabaseClientOptions = {},
): DatabaseClient {
  const fingerprint = `${config.url}|${config.schema}|${config.publicKey}`;
  if (shared) {
    if (shared.fingerprint !== fingerprint) {
      throw new Error("DATABASE_CLIENT_ALREADY_CONFIGURED: one process serves one schema");
    }
    return shared.client;
  }
  shared = { fingerprint, client: createDatabaseClient(config, options) };
  return shared.client;
}

export function resetDatabaseClientForTests(): void {
  shared = undefined;
}
