import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type QueryResult, type SqlClient, ToolingError } from "./common.ts";
import {
  assertLocalSettings,
  assertLocalStack,
  assertLocalStackPassword,
  connectLocalStack,
  IDENTITY_QUERY,
  LOCAL_STACK_DB_PASSWORD_HASH,
  LOCAL_STACK_JWT_HASH,
  resolveSeedSchema,
  SEED_SCHEMAS,
} from "./local-guard.ts";

const LOCAL = {
  databaseUrl: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  apiUrl: "http://127.0.0.1:54321",
};

type Identity = {
  database_name: unknown;
  supabase_role: unknown;
  managed: unknown;
  jwt_hash: unknown;
};
const GOOD: Identity = {
  database_name: "postgres",
  supabase_role: true,
  managed: true,
  jwt_hash: LOCAL_STACK_JWT_HASH,
};

/** A recording fake: it answers the identity query and notes every statement it was asked to run. */
function fakeClient(identity: Identity | "none" | Error = GOOD) {
  const statements: string[] = [];
  let ended = 0;
  const client: SqlClient = {
    async query(sql): Promise<QueryResult> {
      statements.push(sql);
      if (identity instanceof Error) throw identity;
      return {
        rows: identity === "none" ? [] : [identity as unknown as Record<string, unknown>],
        rowCount: 1,
      };
    },
    async end() {
      ended++;
    },
  };
  return { client, statements, ended: () => ended };
}

const refusal = (work: () => unknown) =>
  assert.rejects(
    async () => work(),
    (error: unknown) => {
      assert.ok(error instanceof ToolingError);
      return true;
    },
  );

describe("seed schema selector", () => {
  it("defaults to the public schema and accepts the four worker schemas", () => {
    assert.equal(resolveSeedSchema(undefined), "public");
    for (const name of ["public", "worker_1", "worker_2", "worker_3", "worker_4"]) {
      assert.equal(resolveSeedSchema(name), name);
    }
    assert.deepEqual([...SEED_SCHEMAS], ["public", "worker_1", "worker_2", "worker_3", "worker_4"]);
  });

  it("refuses a bad schema name, a missing value, an empty value and a worker beyond four", () => {
    for (const bad of [
      "worker_5",
      "Public",
      "auth",
      "public; drop schema public",
      "",
      true as const,
    ]) {
      assert.throws(
        () => resolveSeedSchema(bad),
        (error: unknown) => error instanceof ToolingError && error.step === "schema",
        String(bad),
      );
    }
  });
});

describe("local-only guard: the connection password marker", () => {
  it("accepts the local stack's default password and nothing else", () => {
    assertLocalStackPassword(LOCAL.databaseUrl);
    for (const url of [
      "postgresql://postgres:x@127.0.0.1:54322/postgres",
      "postgresql://postgres@127.0.0.1:54322/postgres",
      "postgresql://postgres:@127.0.0.1:54322/postgres",
      "postgresql://postgres:a-hosted-project-password@127.0.0.1:54322/postgres",
      "not an address",
    ]) {
      assert.throws(
        () => assertLocalStackPassword(url),
        (error: unknown) => error instanceof ToolingError && error.step === "guard",
        url,
      );
    }
  });

  // Finding B4 (U1 review R-10): a refused custom password said only that this is not the local stack.
  it("tells a developer with a custom local password what the limit is, without echoing the password", () => {
    const secret = "my-custom-local-password";
    let message = "";
    try {
      assertLocalStackPassword(`postgresql://postgres:${secret}@127.0.0.1:54322/postgres`);
    } catch (error) {
      message = (error as Error).message;
    }
    assert.match(message, /default local database password/);
    assert.match(message, /restart the stack with the default password/);
    assert.ok(!message.includes(secret), "the password is never echoed");
    assert.ok(!message.includes(LOCAL_STACK_DB_PASSWORD_HASH), "the stored hash is never echoed");
  });

  it("refuses a loopback database with another password before connecting, so nothing can change", async () => {
    let connected = 0;
    const connect = async () => {
      connected++;
      return fakeClient().client;
    };
    await refusal(() =>
      connectLocalStack(
        { ...LOCAL, databaseUrl: "postgresql://postgres:tunnel-password@127.0.0.1:54322/postgres" },
        connect,
      ),
    );
    assert.equal(connected, 0);
  });

  it("does not print the password it refused", async () => {
    try {
      assertLocalStackPassword("postgresql://postgres:tunnel-password@127.0.0.1:54322/postgres");
      assert.fail("expected a refusal");
    } catch (error) {
      assert.ok(error instanceof ToolingError);
      assert.equal(error.message.includes("tunnel-password"), false);
    }
  });

  it("needs the marker even when the database holds no JWT secret", async () => {
    const unset = { ...GOOD, jwt_hash: null };
    // With the default password an unset secret is accepted, as before.
    const ok = fakeClient(unset);
    await connectLocalStack(LOCAL, async () => ok.client);
    // Without it the same database is refused before any connection.
    let connected = 0;
    await refusal(() =>
      connectLocalStack(
        { ...LOCAL, databaseUrl: "postgresql://postgres:other@127.0.0.1:54322/postgres" },
        async () => {
          connected++;
          return fakeClient(unset).client;
        },
      ),
    );
    assert.equal(connected, 0);
  });
});

describe("local-only guard: addresses", () => {
  it("accepts the loopback addresses", () => {
    assertLocalSettings(LOCAL);
    assertLocalSettings({
      ...LOCAL,
      databaseUrl: "postgresql://postgres:postgres@localhost:54322/postgres",
    });
    assertLocalSettings({
      ...LOCAL,
      databaseUrl: "postgresql://postgres:postgres@[::1]:54322/postgres",
    });
  });

  it("refuses a hosted-looking database address", () => {
    assert.throws(
      () =>
        assertLocalSettings({
          ...LOCAL,
          databaseUrl: "postgresql://postgres:x@example.test:5432/postgres",
        }),
      (error: unknown) => error instanceof ToolingError && /this machine/.test(error.message),
    );
  });

  it("refuses a non-loopback address on this network and a hosted sign-in service address", () => {
    assert.throws(() =>
      assertLocalSettings({
        ...LOCAL,
        databaseUrl: "postgresql://postgres:x@192.168.0.141:54322/postgres",
      }),
    );
    assert.throws(() =>
      assertLocalSettings({ ...LOCAL, apiUrl: "https://abcdefghijklmnop.supabase.co" }),
    );
  });

  it("refuses a missing or malformed address and a query parameter that could redirect the connection", () => {
    assert.throws(() => assertLocalSettings({ ...LOCAL, databaseUrl: "" }));
    assert.throws(() => assertLocalSettings({ ...LOCAL, databaseUrl: "not an address" }));
    assert.throws(() =>
      assertLocalSettings({
        ...LOCAL,
        databaseUrl: "postgresql://postgres:postgres@127.0.0.1:54322/postgres?host=db.example.org",
      }),
    );
  });

  it("refuses before any connection is made, so nothing can have been changed", async () => {
    let connected = 0;
    const connect = async () => {
      connected++;
      return fakeClient().client;
    };
    await refusal(() =>
      connectLocalStack(
        { ...LOCAL, databaseUrl: "postgresql://postgres:x@10.0.0.5:54322/postgres" },
        connect,
      ),
    );
    assert.equal(connected, 0);
  });
});

describe("local-only guard: the database identifies itself", () => {
  it("accepts the local stack and only reads", async () => {
    const fake = fakeClient();
    await assertLocalStack(fake.client);
    assert.deepEqual(fake.statements, [IDENTITY_QUERY]);
    assert.match(IDENTITY_QUERY.trim(), /^select /);
    assert.doesNotMatch(IDENTITY_QUERY, /\b(insert|update|delete|truncate|drop|alter|create)\b/i);
  });

  it("accepts a stack that holds no JWT secret setting", async () => {
    await assertLocalStack(fakeClient({ ...GOOD, jwt_hash: null }).client);
  });

  it("refuses a database that gives no answer to the identity query", async () => {
    await refusal(() => assertLocalStack(fakeClient("none").client));
    await refusal(() => assertLocalStack(fakeClient(new Error("boom")).client));
  });

  it("refuses another database name, a missing supabase role and an unmanaged database", async () => {
    for (const change of [
      { database_name: "production" },
      { supabase_role: false },
      { managed: false },
      { managed: null },
    ]) {
      const fake = fakeClient({ ...GOOD, ...change });
      await assert.rejects(
        () => assertLocalStack(fake.client),
        (error: unknown) => error instanceof ToolingError && error.step === "guard",
        JSON.stringify(change),
      );
    }
  });

  it("refuses a database that holds a project secret, and never repeats a hash in the message", async () => {
    const other = "0".repeat(64);
    await assert.rejects(
      () => assertLocalStack(fakeClient({ ...GOOD, jwt_hash: other }).client),
      (error: unknown) =>
        error instanceof ToolingError &&
        /project secret/.test(error.message) &&
        !error.message.includes(other) &&
        !error.message.includes(LOCAL_STACK_JWT_HASH),
    );
  });

  it("closes the connection of a refused database and returns an open one for the local stack", async () => {
    const refused = fakeClient({ ...GOOD, database_name: "other" });
    await refusal(() => connectLocalStack(LOCAL, async () => refused.client));
    assert.equal(refused.ended(), 1);
    assert.deepEqual(
      refused.statements,
      [IDENTITY_QUERY],
      "nothing but the identity read was asked",
    );

    const accepted = fakeClient();
    const client = await connectLocalStack(LOCAL, async () => accepted.client);
    assert.equal(client, accepted.client);
    assert.equal(accepted.ended(), 0);
  });

  // Finding B5 (U1 review R-09): the worker command uses the guard on a stack that may never have been migrated.
  it("requires the migration tooling's tracking table by default, and not when the caller turns that off", async () => {
    const unmanaged = { ...GOOD, managed: false };
    // The default (seed and reset) still refuses a database the tooling has not set up.
    await assert.rejects(
      () => assertLocalStack(fakeClient(unmanaged).client),
      (error: unknown) => error instanceof ToolingError && /db:migrate/.test(error.message),
    );
    const refused = fakeClient(unmanaged);
    await refusal(() => connectLocalStack(LOCAL, async () => refused.client));
    assert.equal(refused.ended(), 1);

    // With the requirement off the database passes, and the connection stays open.
    await assertLocalStack(fakeClient(unmanaged).client, { requireManaged: false });
    const accepted = fakeClient(unmanaged);
    const client = await connectLocalStack(LOCAL, async () => accepted.client, {
      requireManaged: false,
    });
    assert.equal(client, accepted.client);
    assert.equal(accepted.ended(), 0);
  });

  it("keeps every other identity reason even when the tracking table is not required", async () => {
    for (const identity of [
      { ...GOOD, managed: false, database_name: "other" },
      { ...GOOD, managed: false, supabase_role: false },
      { ...GOOD, managed: false, jwt_hash: "f".repeat(64) },
    ]) {
      const refused = fakeClient(identity);
      await assert.rejects(
        () => connectLocalStack(LOCAL, async () => refused.client, { requireManaged: false }),
        (error: unknown) => error instanceof ToolingError && error.step === "guard",
      );
      assert.equal(refused.ended(), 1);
    }
  });
});
