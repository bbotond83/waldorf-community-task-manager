import type { SupabaseClient } from "@supabase/supabase-js";
import { createDatabaseClient, type DatabaseClient } from "../../src/runtime/database/client.ts";

/**
 * A fake data API for the tests of the database adapters. It stands in for the supabase client under the
 * real database client wrapper, so the real error mapping runs; only the network is replaced. Nothing here
 * is a real credential.
 */
export type RpcCall = { name: string; args: Record<string, unknown> };
export type QueryCall = { table: string; columns: string; steps: [string, ...unknown[]][] };

export type FakeResponse =
  | { data: unknown; error?: undefined; status?: number }
  | {
      data?: undefined;
      error: { code?: string; message?: string; status?: number };
      status?: number;
    };

export type FakeHandlers = {
  /** The answer to a named function; a thrown error is a lost connection. */
  rpc?: (name: string, args: Record<string, unknown>) => FakeResponse | Promise<FakeResponse>;
  /** The rows of a table read; a function sees the recorded query. */
  table?: (query: QueryCall) => FakeResponse | Promise<FakeResponse>;
};

export type FakeData = {
  database: DatabaseClient;
  rpcCalls: RpcCall[];
  queries: QueryCall[];
  /** Replaces the handlers between steps of a test. */
  handlers: FakeHandlers;
  /** The access tokens `forSession` was called with. */
  tokens: string[];
};

export const FAKE_CONFIG = {
  url: "http://127.0.0.1:54321",
  publicKey: "fake-public-key-for-tests-0123456789",
  sessionSecret: "fake-session-secret-0123456789-abcdefghij",
  schema: "public",
} as const;

export const ok = (data: unknown): FakeResponse => ({ data });
export const failure = (code: string, message = "fake", status?: number): FakeResponse => ({
  error: { code, message, ...(status !== undefined ? { status } : {}) },
});

/** A function result in the shape of `platform_result`, plus extra fields. */
export function envelope(
  state: string,
  code: string | null = null,
  extra: Record<string, unknown> = {},
  reference: string | null = null,
): FakeResponse {
  return ok({ state, reference, code, ...extra });
}

class FakeQuery implements PromiseLike<{ data: unknown; error: unknown; status?: number }> {
  private readonly call: QueryCall;
  private readonly settle: (query: QueryCall) => Promise<FakeResponse>;

  constructor(call: QueryCall, settle: (query: QueryCall) => Promise<FakeResponse>) {
    this.call = call;
    this.settle = settle;
  }

  private step(name: string, ...args: unknown[]): this {
    this.call.steps.push([name, ...args]);
    return this;
  }

  eq = (...args: unknown[]) => this.step("eq", ...args);
  neq = (...args: unknown[]) => this.step("neq", ...args);
  in = (...args: unknown[]) => this.step("in", ...args);
  is = (...args: unknown[]) => this.step("is", ...args);
  ilike = (...args: unknown[]) => this.step("ilike", ...args);
  order = (...args: unknown[]) => this.step("order", ...args);
  limit = (...args: unknown[]) => this.step("limit", ...args);

  then<A, B>(
    onfulfilled?: (value: { data: unknown; error: unknown; status?: number }) => A | PromiseLike<A>,
    onrejected?: (reason: unknown) => B | PromiseLike<B>,
  ): PromiseLike<A | B> {
    return this.settle(this.call)
      .then((response) => ({
        data: response.data ?? null,
        error: response.error ?? null,
        ...(response.status ? { status: response.status } : {}),
      }))
      .then(onfulfilled, onrejected);
  }
}

export function fakeData(handlers: FakeHandlers = {}): FakeData {
  const state: FakeData = {
    database: undefined as unknown as DatabaseClient,
    rpcCalls: [],
    queries: [],
    handlers,
    tokens: [],
  };
  const supabase = {
    rpc(name: string, args: Record<string, unknown>) {
      state.rpcCalls.push({ name, args });
      const handler = state.handlers.rpc;
      const answer = handler ? Promise.resolve(handler(name, args)) : Promise.resolve(ok(null));
      return answer.then((response) => ({
        data: response.data ?? null,
        error: response.error ?? null,
        ...(response.status ? { status: response.status } : {}),
      }));
    },
    from(table: string) {
      return {
        select(columns: string) {
          const call: QueryCall = { table, columns, steps: [] };
          state.queries.push(call);
          return new FakeQuery(call, async (query) => {
            const handler = state.handlers.table;
            return handler ? handler(query) : ok([]);
          });
        },
      };
    },
  } as unknown as SupabaseClient;
  state.database = createDatabaseClient(FAKE_CONFIG, {
    createSupabase: (_url, key, options) => {
      const headers = (options as { global?: { headers?: Record<string, string> } } | undefined)
        ?.global?.headers;
      const authorization = headers?.Authorization;
      if (authorization) state.tokens.push(authorization.replace(/^Bearer /, ""));
      void key;
      return supabase;
    },
  });
  return state;
}
