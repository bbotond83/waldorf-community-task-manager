import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createDatabaseClient,
  describeDatabaseError,
  getDatabaseClient,
  resetDatabaseClientForTests,
  type DatabaseResponse,
  type SafeDatabaseError,
  type SupabaseFactory,
} from "./client.ts";
import type { DatabaseConfig } from "./config.ts";

const config: DatabaseConfig = {
  url: "http://127.0.0.1:54321",
  publicKey: "fake-public-key-for-tests-0123456789",
  sessionSecret: "fake-session-secret-0123456789-abcdefghij",
  schema: "worker_1",
};
const retry = { idempotencyKey: "key-1", action: "lifecycle.hold_place" };

type Reply = DatabaseResponse<unknown> | (() => never);

/** A fake data-API client: records what it was created with and what it was asked. */
function fakeFactory(reply: () => Reply) {
  const created: { url: string; key: string; options: unknown }[] = [];
  const calls: { name: string; args: unknown }[] = [];
  const factory: SupabaseFactory = (url, key, options) => {
    created.push({ url, key, options });
    return {
      rpc: async (name: string, args: unknown) => {
        calls.push({ name, args });
        const next = reply();
        return typeof next === "function" ? next() : next;
      },
    } as unknown as SupabaseClient;
  };
  return { factory, created, calls };
}

const envelope = (state: string, code: string | null = null, reference: string | null = null) => ({
  data: { state, reference, code },
  error: null,
});

describe("database client wrapper", () => {
  beforeEach(() => resetDatabaseClientForTests());

  it("returns success with the reference from the operation envelope", async () => {
    const fake = fakeFactory(() => envelope("success", null, "ref-1"));
    const client = createDatabaseClient(config, { createSupabase: fake.factory });
    const result = await client.callOperation("lifecycle_hold_place", { p_reason: "x" }, retry);
    assert.equal(result.state, "success");
    assert.deepEqual(result.state === "success" ? result.data : undefined, {
      reference: "ref-1",
      code: null,
    });
    assert.equal(fake.calls[0]?.name, "lifecycle_hold_place");
  });

  it("binds the client to the configured schema profile", () => {
    const fake = fakeFactory(() => envelope("success"));
    const client = createDatabaseClient(config, { createSupabase: fake.factory });
    assert.equal(client.schema, "worker_1");
    const options = fake.created[0]?.options as { db: { schema: string }; auth: object };
    assert.equal(options.db.schema, "worker_1");
    assert.deepEqual(options.auth, {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    });
  });

  it("maps a validation envelope to the validation state with its code", async () => {
    const client = createDatabaseClient(config, {
      createSupabase: fakeFactory(() => envelope("validation", "hold_reason_invalid")).factory,
    });
    const result = await client.callOperation("f", {}, retry);
    assert.equal(result.state, "validation");
    assert.equal(result.code, "hold_reason_invalid");
    assert.deepEqual(result.state === "validation" ? result.fieldErrors : undefined, {
      request: "hold_reason_invalid",
    });
  });

  it("maps denied and conflict envelopes", async () => {
    for (const state of ["denied", "conflict"] as const) {
      const client = createDatabaseClient(config, {
        createSupabase: fakeFactory(() => envelope(state, "some_code")).factory,
      });
      const result = await client.callOperation("f", {}, retry);
      assert.equal(result.state, state);
      assert.equal(result.code, "some_code");
    }
  });

  it("maps a terminal envelope and an unknown state to terminal, never to success", async () => {
    for (const state of ["terminal", "surprise"]) {
      const client = createDatabaseClient(config, {
        createSupabase: fakeFactory(() => envelope(state, "bad")).factory,
      });
      const result = await client.callOperation("f", {}, retry);
      assert.equal(result.state, "dependency-failure-terminal");
    }
  });

  it("maps connection-class and gateway errors to retryable with the retry metadata", async () => {
    const replies: Reply[] = [
      { data: null, error: { code: "08006", message: "connection failure" } },
      { data: null, error: { code: "40001", message: "serialization failure" } },
      { data: null, error: { message: "boom" }, status: 503 },
      { data: null, error: { code: "PGRST002", message: "schema cache" } },
    ];
    for (const reply of replies) {
      const client = createDatabaseClient(config, {
        createSupabase: fakeFactory(() => reply).factory,
      });
      const result = await client.callOperation("f", {}, retry);
      assert.equal(result.state, "dependency-failure-retryable");
      assert.deepEqual(
        result.state === "dependency-failure-retryable" ? result.retry : undefined,
        retry,
      );
    }
  });

  it("maps a thrown network failure to retryable", async () => {
    const client = createDatabaseClient(config, {
      createSupabase: fakeFactory(() => () => {
        throw new TypeError("fetch failed");
      }).factory,
    });
    const result = await client.callOperation("f", {}, retry);
    assert.equal(result.state, "dependency-failure-retryable");
  });

  it("maps any other unexpected error, and an empty response, to terminal", async () => {
    const replies: Reply[] = [
      { data: null, error: { code: "XX000", message: "internal error" } },
      { data: null, error: null },
      () => {
        throw new Error("something unrelated");
      },
    ];
    for (const reply of replies) {
      const client = createDatabaseClient(config, {
        createSupabase: fakeFactory(() => reply).factory,
      });
      const result = await client.callOperation("f", {}, retry);
      assert.equal(result.state, "dependency-failure-terminal");
    }
  });

  it("maps privilege, uniqueness and input errors to their business states", async () => {
    const cases: [Reply, string][] = [
      [{ data: null, error: { code: "42501", message: "permission denied" } }, "denied"],
      [{ data: null, error: { message: "x" }, status: 403 }, "denied"],
      [{ data: null, error: { code: "23505", message: "duplicate" } }, "conflict"],
      [{ data: null, error: { code: "22P02", message: "bad input" } }, "validation"],
      [{ data: null, error: { code: "23514", message: "check" } }, "validation"],
    ];
    for (const [reply, state] of cases) {
      const client = createDatabaseClient(config, {
        createSupabase: fakeFactory(() => reply).factory,
      });
      assert.equal((await client.callOperation("f", {}, retry)).state, state);
    }
  });

  it("never puts keys or database messages into a result or a logged description", async () => {
    const logged: SafeDatabaseError[] = [];
    const leaky = `failed with key ${config.publicKey} and secret ${config.sessionSecret} jwt eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2lnbmF0dXJlMTIz`;
    const client = createDatabaseClient(config, {
      createSupabase: fakeFactory(() => ({ data: null, error: { code: "XX000", message: leaky } }))
        .factory,
      onUnexpectedError: (error) => logged.push(error),
    });
    const result = await client.callOperation("f", {}, retry);
    const serialized = JSON.stringify([result, logged]);
    for (const secret of [config.publicKey, config.sessionSecret, "eyJhbGci"]) {
      assert.equal(serialized.includes(secret), false, secret);
    }
    assert.equal(logged.length, 1);
    assert.match(logged[0]!.message, /\[redacted\]/);
  });

  it("read maps errors the same way and returns data on success", async () => {
    const ok = createDatabaseClient(config, {
      createSupabase: fakeFactory(() => ({ data: [1, 2], error: null })).factory,
    });
    const good = await ok.read(async () => ({ data: [1, 2], error: null }), retry);
    assert.deepEqual(good.state === "success" ? good.data : undefined, [1, 2]);
    const bad = await ok.read(
      async () => ({ data: null, error: { code: "08000", message: "down" } }),
      retry,
    );
    assert.equal(bad.state, "dependency-failure-retryable");
  });

  it("forSession creates a client that carries the account's token, not a shared one", () => {
    const fake = fakeFactory(() => envelope("success"));
    const client = createDatabaseClient(config, { createSupabase: fake.factory });
    const sessionClient = client.forSession("fake-access-token");
    assert.notEqual(sessionClient, client);
    assert.equal(sessionClient.schema, "worker_1");
    const options = fake.created[1]?.options as { global: { headers: { Authorization: string } } };
    assert.equal(options.global.headers.Authorization, "Bearer fake-access-token");
  });

  it("keeps one client per process and refuses a different configuration", () => {
    const fake = fakeFactory(() => envelope("success"));
    const first = getDatabaseClient(config, { createSupabase: fake.factory });
    assert.equal(getDatabaseClient(config, { createSupabase: fake.factory }), first);
    assert.equal(fake.created.length, 1);
    assert.throws(
      () => getDatabaseClient({ ...config, schema: "worker_2" }, { createSupabase: fake.factory }),
      /DATABASE_CLIENT_ALREADY_CONFIGURED/,
    );
  });

  it("describeDatabaseError classifies without needing a client", () => {
    assert.equal(
      describeDatabaseError({ code: "53300", message: "too many connections" }).retryable,
      true,
    );
    assert.equal(describeDatabaseError({ message: "plain failure" }).retryable, false);
    assert.equal(describeDatabaseError({ message: "plain failure" }).code, "UNKNOWN");
  });

  it("uses the real data-API client factory by default", () => {
    const client = createDatabaseClient(config);
    assert.equal(client.schema, "worker_1");
    assert.equal(client.forSession("fake-access-token").schema, "worker_1");
  });
});
