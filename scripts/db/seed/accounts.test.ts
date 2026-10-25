import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { QueryResult, SqlClient } from "../common.ts";
import { ToolingError } from "../common.ts";
import {
  createSeedAccountAdmin,
  provisionAccounts,
  removeAccounts,
  type SeedAccountAdmin,
} from "./accounts.ts";
import { buildSeedPlan, SEED_PASSWORDS } from "./data.ts";

const plan = buildSeedPlan("worker_1", "small");
const ACCOUNT = plan.accounts[0]!;

type Recorded = {
  url: string;
  method: string;
  body: Record<string, unknown> | undefined;
  headers: Record<string, string>;
};

function fakeFetch(answer: (request: Recorded) => Response | Promise<Response>) {
  const requests: Recorded[] = [];
  const fetchLike = async (url: string, init: RequestInit): Promise<Response> => {
    const request: Recorded = {
      url,
      method: String(init.method),
      body: init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined,
      headers: init.headers as Record<string, string>,
    };
    requests.push(request);
    return answer(request);
  };
  return { fetchLike, requests };
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("seed account admin (sign-in service)", () => {
  const options = (fetch: ReturnType<typeof fakeFetch>["fetchLike"]) => ({
    url: "http://127.0.0.1:54321/",
    serviceKey: "service-key-value-for-tests",
    fetch,
  });

  it("creates a confirmed user with the fixed id through the admin interface", async () => {
    const { fetchLike, requests } = fakeFetch((request) => json(200, { id: request.body!.id }));
    const admin = createSeedAccountAdmin(options(fetchLike));
    const result = await admin.createUser({
      id: ACCOUNT.id,
      email: ACCOUNT.email,
      password: ACCOUNT.password,
    });
    assert.deepEqual(result, { ok: true });
    assert.equal(requests[0]!.url, "http://127.0.0.1:54321/auth/v1/admin/users");
    assert.equal(requests[0]!.method, "POST");
    assert.deepEqual(requests[0]!.body, {
      id: ACCOUNT.id,
      email: ACCOUNT.email,
      password: ACCOUNT.password,
      email_confirm: true,
    });
    assert.equal(requests[0]!.headers.apikey, "service-key-value-for-tests");
    assert.equal(requests[0]!.headers.Authorization, "Bearer service-key-value-for-tests");
  });

  it("reports the service's own error code for a refused user, and unavailable for outages", async () => {
    for (const [status, body, reason] of [
      [422, { error_code: "email_exists" }, "email_exists"],
      [400, {}, "rejected"],
      [500, {}, "unavailable"],
      [429, { error_code: "over_request_rate_limit" }, "unavailable"],
    ] as const) {
      const { fetchLike } = fakeFetch(() => json(status, body));
      const result = await createSeedAccountAdmin(options(fetchLike)).createUser({
        id: ACCOUNT.id,
        email: ACCOUNT.email,
        password: ACCOUNT.password,
      });
      assert.deepEqual(result, { ok: false, reason }, String(status));
    }
    const down = createSeedAccountAdmin(
      options(async () => {
        throw new Error("connection refused");
      }),
    );
    assert.deepEqual(await down.createUser({ id: "x", email: "y", password: "z" }), {
      ok: false,
      reason: "unavailable",
    });
  });

  it("treats an answer that is not JSON as an empty one", async () => {
    const { fetchLike } = fakeFetch(() => new Response("not json", { status: 200 }));
    const result = await createSeedAccountAdmin(options(fetchLike)).createUser({
      id: ACCOUNT.id,
      email: ACCOUNT.email,
      password: ACCOUNT.password,
    });
    assert.deepEqual(result, { ok: false, reason: "id_not_honoured" });
  });

  it("removes a user the service created under another id, and fails: the records would name someone else", async () => {
    const { fetchLike, requests } = fakeFetch((request) =>
      request.method === "POST"
        ? json(200, { id: "11111111-1111-4111-8111-111111111111" })
        : json(200, {}),
    );
    const result = await createSeedAccountAdmin(options(fetchLike)).createUser({
      id: ACCOUNT.id,
      email: ACCOUNT.email,
      password: ACCOUNT.password,
    });
    assert.deepEqual(result, { ok: false, reason: "id_not_honoured" });
    assert.equal(requests[1]!.method, "DELETE");
    assert.match(
      requests[1]!.url,
      /\/auth\/v1\/admin\/users\/11111111-1111-4111-8111-111111111111$/,
    );
  });

  it("deletes a user by id and counts a missing user as removed, but not a refusal or an outage", async () => {
    for (const [status, expected] of [
      [200, true],
      [204, true],
      [404, true],
      [403, false],
      [500, false],
    ] as const) {
      const { fetchLike } = fakeFetch(() => new Response(null, { status }));
      assert.equal(
        await createSeedAccountAdmin(options(fetchLike)).deleteUser("abc"),
        expected,
        String(status),
      );
    }
    const down = createSeedAccountAdmin(
      options(async () => {
        throw new Error("down");
      }),
    );
    assert.equal(await down.deleteUser("abc"), false);
  });

  it("uses the global fetch when none is given", async () => {
    const original = globalThis.fetch;
    let seen = "";
    globalThis.fetch = (async (url: string) => {
      seen = String(url);
      return json(200, {});
    }) as typeof fetch;
    try {
      assert.equal(
        await createSeedAccountAdmin({ url: "http://127.0.0.1:54321", serviceKey: "k" }).deleteUser(
          "a",
        ),
        true,
      );
      assert.match(seen, /admin\/users\/a$/);
    } finally {
      globalThis.fetch = original;
    }
  });
});

/** A database fake that knows which sign-in users already exist. */
function usersClient(existing: { id: string; email: string }[]) {
  const queries: { sql: string; values: unknown[] | undefined }[] = [];
  const client: SqlClient = {
    async query(sql, values): Promise<QueryResult> {
      queries.push({ sql, values });
      const wanted = new Set((values?.[0] as string[]) ?? []);
      return { rows: existing.filter((row) => wanted.has(row.email.toLowerCase())), rowCount: 0 };
    },
    async end() {},
  };
  return { client, queries };
}

function fakeAdmin(failFor?: string) {
  const created: string[] = [];
  const removed: string[] = [];
  const admin: SeedAccountAdmin = {
    async createUser({ id, email }) {
      if (failFor && email === failFor) return { ok: false, reason: "unavailable" };
      created.push(id);
      return { ok: true };
    },
    async deleteUser(id) {
      removed.push(id);
      return true;
    },
  };
  return { admin, created, removed };
}

describe("provisioning of the seeded accounts", () => {
  it("creates every missing account and none that exists with the right id", async () => {
    const present = plan.accounts
      .slice(0, 3)
      .map((account) => ({ id: account.id, email: account.email }));
    const { client, queries } = usersClient(present);
    const fake = fakeAdmin();
    const result = await provisionAccounts({ client, admin: fake.admin, accounts: plan.accounts });
    assert.equal(result.existing, 3);
    assert.equal(result.created.length, plan.accounts.length - 3);
    assert.deepEqual([...fake.created].sort(), [...result.created].sort());
    assert.ok(!fake.created.some((id) => present.some((row) => row.id === id)));
    assert.match(queries[0]!.sql, /^select /);
  });

  it("creates all accounts on a clean sign-in service, using the accounts' own fictitious passwords", async () => {
    const { client } = usersClient([]);
    const seen: { email: string; password: string }[] = [];
    const admin: SeedAccountAdmin = {
      async createUser(input) {
        seen.push({ email: input.email, password: input.password });
        return { ok: true };
      },
      async deleteUser() {
        return true;
      },
    };
    const result = await provisionAccounts({
      client,
      admin,
      accounts: plan.accounts,
      concurrency: 1,
    });
    assert.equal(result.created.length, plan.accounts.length);
    assert.equal(seen.length, plan.accounts.length);
    for (const entry of seen) assert.ok(Object.values(SEED_PASSWORDS).includes(entry.password));
  });

  it("stops without creating anything when an address belongs to a user with another id", async () => {
    const { client } = usersClient([
      { id: "22222222-2222-4222-8222-222222222222", email: plan.accounts[1]!.email },
    ]);
    const fake = fakeAdmin();
    await assert.rejects(
      () => provisionAccounts({ client, admin: fake.admin, accounts: plan.accounts }),
      (error: unknown) =>
        error instanceof ToolingError &&
        error.step === "accounts" &&
        error.detail.account === plan.accounts[1]!.tag &&
        /run the reset/.test(error.message),
    );
    assert.deepEqual(fake.created, []);
  });

  it("asks for the addresses in lower case and compares them without regard to case", async () => {
    const account = plan.accounts[0]!;
    const { client, queries } = usersClient([{ id: account.id, email: account.email }]);
    const fake = fakeAdmin();
    const result = await provisionAccounts({ client, admin: fake.admin, accounts: [account] });
    assert.equal(result.existing, 1);
    assert.match(queries[0]!.sql, /lower\(email\) = any\(\$1::text\[\]\)/);
    assert.deepEqual(queries[0]!.values, [[account.email.toLowerCase()]]);
  });

  it("removes the accounts it created when one creation fails, and names the account's tag, never a password", async () => {
    const { client } = usersClient([]);
    const failing = plan.accounts[5]!;
    const fake = fakeAdmin(failing.email);
    await assert.rejects(
      () =>
        provisionAccounts({ client, admin: fake.admin, accounts: plan.accounts, concurrency: 1 }),
      (error: unknown) => {
        assert.ok(error instanceof ToolingError);
        assert.equal(error.detail.account, failing.tag);
        for (const password of Object.values(SEED_PASSWORDS))
          assert.ok(!error.message.includes(password));
        return true;
      },
    );
    assert.equal(fake.created.length, 5, "the first five were created before the failure");
    assert.deepEqual([...fake.removed].sort(), [...fake.created].sort());
  });

  it("works with several accounts in flight and still removes every created account after a failure", async () => {
    const { client } = usersClient([]);
    const fake = fakeAdmin(plan.accounts[3]!.email);
    await assert.rejects(() =>
      provisionAccounts({ client, admin: fake.admin, accounts: plan.accounts, concurrency: 3 }),
    );
    assert.deepEqual([...fake.removed].sort(), [...fake.created].sort());
  });

  it("counts the users that could not be removed again", async () => {
    const admin: SeedAccountAdmin = {
      async createUser() {
        return { ok: true };
      },
      async deleteUser(id) {
        return id !== "b";
      },
    };
    assert.equal(await removeAccounts(admin, ["a", "b", "c"]), 1);
    assert.equal(await removeAccounts(admin, []), 0);
  });
});
