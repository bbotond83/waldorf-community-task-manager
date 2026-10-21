import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fakeJwt,
  fakeService,
  fakeSession,
  ok,
  rejected,
  rateLimited,
  unavailable,
} from "../../tests/support/identity-fakes.ts";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "./cookies.ts";
import { decideRefresh, refreshDepsFromEnvironment } from "./refresh.ts";

const now = () => Date.now();
const deps = (service = fakeService()) => ({ service, now, appPublicUrl: "http://127.0.0.1:3000" });
const jar = (values: Record<string, string>) => ({
  get: (name: string) => (name in values ? { value: values[name]! } : undefined),
});
const expiredToken = () => fakeSession({}, -30).accessToken;

describe("the per-request token refresh (R-04, BR2.5, BR2.7)", () => {
  it("does nothing without a refresh token or while the access token is fresh", async () => {
    const service = fakeService();
    assert.deepEqual(await decideRefresh(jar({}), deps(service)), { action: "none" });
    assert.deepEqual(
      await decideRefresh(jar({ [ACCESS_COOKIE]: fakeSession().accessToken }), deps(service)),
      {
        action: "none",
      },
    );
    const fresh = jar({
      [ACCESS_COOKIE]: fakeSession().accessToken,
      [REFRESH_COOKIE]: "refresh-1",
    });
    assert.deepEqual(await decideRefresh(fresh, deps(service)), { action: "none" });
    assert.equal(service.calls.length, 0);
  });

  it("renews an expired or missing access token with a live refresh token and gives the new cookies", async () => {
    const renewed = fakeSession({ refreshToken: "refresh-2" });
    for (const cookies of [
      jar({ [ACCESS_COOKIE]: expiredToken(), [REFRESH_COOKIE]: "refresh-1" }),
      jar({ [REFRESH_COOKIE]: "refresh-1" }),
      jar({ [ACCESS_COOKIE]: "not-a-token", [REFRESH_COOKIE]: "refresh-1" }),
    ]) {
      const service = fakeService({ refresh: async () => ok(renewed) });
      const decision = await decideRefresh(cookies, deps(service));
      assert.equal(decision.action, "renew");
      if (decision.action === "renew") {
        assert.deepEqual(decision.tokens, {
          accessToken: renewed.accessToken,
          refreshToken: "refresh-2",
        });
        assert.equal(decision.options.httpOnly, true);
        assert.equal(decision.options.sameSite, "lax");
      }
      assert.deepEqual(service.calls[0]!.args, ["refresh-1"]);
    }
  });

  it("renews a token that is about to expire (inside the margin)", async () => {
    const soon = fakeSession({}, 30).accessToken;
    const service = fakeService({ refresh: async () => ok(fakeSession()) });
    const decision = await decideRefresh(
      jar({ [ACCESS_COOKIE]: soon, [REFRESH_COOKIE]: "r" }),
      deps(service),
    );
    assert.equal(decision.action, "renew");
  });

  it("clears the cookies when the service refuses the refresh (revoked, ended or idle for 30 days)", async () => {
    const service = fakeService({ refresh: async () => rejected("refresh_token_not_found", 400) });
    const decision = await decideRefresh(
      jar({ [ACCESS_COOKIE]: expiredToken(), [REFRESH_COOKIE]: "r" }),
      deps(service),
    );
    assert.equal(decision.action, "clear");
    if (decision.action === "clear") assert.equal(decision.options.maxAge, 0);
  });

  it("changes nothing when the service cannot be reached or rate limits the request, so the next request tries again", async () => {
    for (const outcome of [unavailable, rateLimited]) {
      const service = fakeService({ refresh: async () => outcome });
      assert.deepEqual(
        await decideRefresh(
          jar({ [ACCESS_COOKIE]: expiredToken(), [REFRESH_COOKIE]: "r" }),
          deps(service),
        ),
        { action: "none" },
      );
    }
    assert.ok(fakeJwt({}).length > 0);
  });

  it("builds its dependencies from the environment only when the database settings are valid", () => {
    const environment = {
      SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_ANON_KEY: "fake-public-key-for-tests-0123456789",
      APP_SESSION_SECRET: "fake-session-secret-0123456789-abcdefghij",
    };
    assert.equal(refreshDepsFromEnvironment({}), undefined);
    const built = refreshDepsFromEnvironment(environment);
    assert.ok(built);
    assert.equal(built.appPublicUrl, "http://127.0.0.1:3000");
    assert.equal(
      refreshDepsFromEnvironment({ ...environment, APP_PUBLIC_URL: "https://app.example.org" })
        ?.appPublicUrl,
      "https://app.example.org",
    );
  });
});
