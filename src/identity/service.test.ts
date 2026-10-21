import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fakeJwt } from "../../tests/support/identity-fakes.ts";
import {
  createSignInService,
  type FetchLike,
  readTokenClaims,
  SERVICE_TIMEOUT_MS,
} from "./service.ts";

type Seen = { url: string; init: RequestInit };

function serviceWith(respond: (seen: Seen) => Response | Promise<Response>) {
  const seen: Seen[] = [];
  const fetchLike: FetchLike = async (url, init) => {
    const entry = { url, init };
    seen.push(entry);
    return respond(entry);
  };
  return {
    seen,
    service: createSignInService({
      url: "http://127.0.0.1:54321/",
      publicKey: "public-key-value-for-tests",
      fetch: fetchLike,
    }),
  };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const sessionBody = () => ({
  access_token: fakeJwt({ sub: "u1", session_id: "s1", exp: 4_000_000_000 }),
  refresh_token: "r1",
  user: { id: "u1", email: "person@example.test" },
});

describe("the sign-in service over HTTP (NFR2.1)", () => {
  it("signs in with a password and returns the tokens, the user and the session id", async () => {
    const { service, seen } = serviceWith(() => json(200, sessionBody()));
    const outcome = await service.passwordSignIn("person@example.test", "secret-value-1");
    assert.equal(outcome.ok, true);
    if (outcome.ok) {
      assert.equal(outcome.value.userId, "u1");
      assert.equal(outcome.value.sessionId, "s1");
      assert.equal(outcome.value.refreshToken, "r1");
      assert.equal(outcome.value.email, "person@example.test");
    }
    assert.equal(seen[0]!.url, "http://127.0.0.1:54321/auth/v1/token?grant_type=password");
    assert.equal(seen[0]!.init.method, "POST");
    const headers = seen[0]!.init.headers as Record<string, string>;
    assert.equal(headers.apikey, "public-key-value-for-tests");
    assert.equal(headers.Authorization, "Bearer public-key-value-for-tests");
    assert.deepEqual(JSON.parse(String(seen[0]!.init.body)), {
      email: "person@example.test",
      password: "secret-value-1",
    });
  });

  it("maps a 4xx answer to a rejection with the service's error code", async () => {
    const { service } = serviceWith(() => json(400, { error_code: "invalid_credentials" }));
    const outcome = await service.passwordSignIn("a@example.test", "x");
    assert.deepEqual(outcome, {
      ok: false,
      kind: "rejected",
      code: "invalid_credentials",
      status: 400,
    });
    const bare = serviceWith(() => new Response("not json", { status: 422 }));
    assert.deepEqual(await bare.service.passwordSignIn("a@example.test", "x"), {
      ok: false,
      kind: "rejected",
      code: "rejected",
      status: 422,
    });
  });

  it("maps a network failure, a timeout, a server error and a rate limit to unavailable", async () => {
    const failing = createSignInService({
      url: "http://127.0.0.1:1",
      publicKey: "k".repeat(20),
      fetch: async () => {
        throw new Error("connect ECONNREFUSED");
      },
    });
    assert.deepEqual(await failing.refresh("r"), { ok: false, kind: "unavailable" });
    for (const status of [500, 502, 503]) {
      const { service } = serviceWith(() => json(status, {}));
      assert.deepEqual(
        await service.refresh("r"),
        { ok: false, kind: "unavailable" },
        String(status),
      );
    }
    // Regression (code review Minor 6): rate limiting is its own outcome, not an outage.
    const { service: limited } = serviceWith(() => json(429, {}));
    assert.deepEqual(await limited.refresh("r"), { ok: false, kind: "rate_limited" });
    assert.ok(SERVICE_TIMEOUT_MS >= 1000);
  });

  it("treats a success body without usable tokens as unavailable, never as a session", async () => {
    for (const body of [
      {},
      { access_token: "x", refresh_token: "y" },
      { access_token: fakeJwt({ exp: 1 }), refresh_token: "y", user: { id: "u" } },
    ]) {
      const { service } = serviceWith(() => json(200, body));
      assert.deepEqual(await service.refresh("r"), { ok: false, kind: "unavailable" });
    }
  });

  it("uses the session's own token for sign-out and a new password, and sends the recovery and verify bodies", async () => {
    const { service, seen } = serviceWith((entry) =>
      entry.url.endsWith("/verify")
        ? json(200, sessionBody())
        : new Response(null, { status: 204 }),
    );
    assert.deepEqual(await service.signOut("access-1"), { ok: true, value: null });
    assert.deepEqual(await service.updatePassword("access-2", "new-secret-1"), {
      ok: true,
      value: null,
    });
    assert.deepEqual(await service.requestRecovery("a@example.test"), { ok: true, value: null });
    assert.equal((await service.verifyRecovery("hash-value-1")).ok, true);
    assert.deepEqual(
      seen.map((entry) => [
        entry.init.method,
        entry.url.replace("http://127.0.0.1:54321/auth/v1", ""),
      ]),
      [
        ["POST", "/logout?scope=local"],
        ["PUT", "/user"],
        ["POST", "/recover"],
        ["POST", "/verify"],
      ],
    );
    assert.equal(
      (seen[0]!.init.headers as Record<string, string>).Authorization,
      "Bearer access-1",
    );
    assert.equal(
      (seen[1]!.init.headers as Record<string, string>).Authorization,
      "Bearer access-2",
    );
    assert.deepEqual(JSON.parse(String(seen[3]!.init.body)), {
      type: "recovery",
      token_hash: "hash-value-1",
    });
  });

  it("refreshes with the refresh token in the body", async () => {
    const { service, seen } = serviceWith(() => json(200, sessionBody()));
    await service.refresh("refresh-1");
    assert.equal(seen[0]!.url, "http://127.0.0.1:54321/auth/v1/token?grant_type=refresh_token");
    assert.deepEqual(JSON.parse(String(seen[0]!.init.body)), { refresh_token: "refresh-1" });
  });

  it("reads token claims without trusting them, and returns nothing for anything else", () => {
    assert.equal(readTokenClaims(fakeJwt({ sub: "u" }))?.sub, "u");
    for (const bad of [
      "",
      "a.b",
      "a.b.c",
      `a.${Buffer.from("[1]").toString("base64url")}.c`,
      `a.${Buffer.from('"x"').toString("base64url")}.c`,
    ]) {
      assert.equal(readTokenClaims(bad), undefined, bad);
    }
  });
});
