import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACCOUNT_ID,
  fakeDatabase,
  fakeJwt,
  fakeService,
  fakeSession,
  ok,
  rejected,
  SESSION_ID,
  unavailable,
} from "../../tests/support/identity-fakes.ts";
import { endSession, resolveSession } from "./session.ts";

const now = () => Date.now();
const live = () => ({ accessToken: fakeSession().accessToken, refreshToken: "refresh-1" });
const expired = () => ({
  accessToken: fakeJwt({
    sub: ACCOUNT_ID,
    session_id: SESSION_ID,
    exp: Math.floor(Date.now() / 1000) - 10,
  }),
  refreshToken: "refresh-1",
});

describe("the session of a request (BR2.5 to BR2.8)", () => {
  it("is signed out without cookies", async () => {
    const result = await resolveSession(undefined, {
      service: fakeService(),
      database: fakeDatabase(),
      now,
    });
    assert.deepEqual(result, { status: "signed-out", clearCookies: false });
  });

  it("is signed in when the database says the session is active, without refreshing a fresh token", async () => {
    const service = fakeService();
    const result = await resolveSession(live(), {
      service,
      database: fakeDatabase({ active: true }),
      now,
    });
    assert.equal(result.status, "signed-in");
    if (result.status === "signed-in") {
      assert.equal(result.accountId, ACCOUNT_ID);
      assert.equal(result.sessionId, SESSION_ID);
      assert.equal(result.renewed, undefined);
    }
    assert.equal(service.calls.length, 0);
  });

  it("is signed out and clears the cookies when the database refuses the session (signed out, idle, deactivated)", async () => {
    const result = await resolveSession(live(), {
      service: fakeService(),
      database: fakeDatabase({ active: false }),
      now,
    });
    assert.deepEqual(result, { status: "signed-out", clearCookies: true });
  });

  it("refreshes an expiring token and hands back the renewed tokens to store", async () => {
    const renewed = fakeSession({ refreshToken: "refresh-2" });
    const service = fakeService({ refresh: async () => ok(renewed) });
    const database = fakeDatabase({ active: true });
    const result = await resolveSession(expired(), { service, database, now });
    assert.equal(result.status, "signed-in");
    if (result.status === "signed-in") {
      assert.deepEqual(result.renewed, {
        accessToken: renewed.accessToken,
        refreshToken: "refresh-2",
      });
      assert.equal(result.accessToken, renewed.accessToken);
    }
    assert.equal(database.operations.length, 0);
  });

  it("does not spend the refresh token where the new tokens cannot be stored", async () => {
    const service = fakeService();
    const result = await resolveSession(
      expired(),
      { service, database: fakeDatabase(), now },
      { canPersist: false },
    );
    assert.deepEqual(result, { status: "signed-out", clearCookies: false });
    assert.equal(service.calls.length, 0);
  });

  it("is signed out when the refresh is rejected, and unavailable when the service is down", async () => {
    const rejectedRefresh = await resolveSession(expired(), {
      service: fakeService({ refresh: async () => rejected("refresh_token_not_found") }),
      database: fakeDatabase(),
      now,
    });
    assert.deepEqual(rejectedRefresh, { status: "signed-out", clearCookies: true });
    const down = await resolveSession(expired(), {
      service: fakeService({ refresh: async () => unavailable }),
      database: fakeDatabase(),
      now,
    });
    assert.deepEqual(down, { status: "unavailable" });
  });

  it("is unavailable when the database cannot be reached, never signed in", async () => {
    const result = await resolveSession(live(), {
      service: fakeService(),
      database: fakeDatabase({ active: "unavailable" }),
      now,
    });
    assert.deepEqual(result, { status: "unavailable" });
  });

  it("is signed out for a token without the account or session claims", async () => {
    const tokens = {
      accessToken: fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 }),
      refreshToken: "r",
    };
    const result = await resolveSession(tokens, {
      service: fakeService(),
      database: fakeDatabase({ active: true }),
      now,
    });
    assert.deepEqual(result, { status: "signed-out", clearCookies: true });
  });

  it("ends only the request's own session in the service, refreshing an expired token first", async () => {
    const service = fakeService({ refresh: async () => ok(fakeSession({ refreshToken: "r2" })) });
    assert.equal(await endSession(expired(), { service, now }), "ended");
    assert.deepEqual(
      service.calls.map((call) => call.name),
      ["refresh", "signOut"],
    );
    const fresh = fakeService();
    assert.equal(await endSession(live(), { service: fresh, now }), "ended");
    assert.deepEqual(
      fresh.calls.map((call) => call.name),
      ["signOut"],
    );
    assert.equal(await endSession(undefined, { service: fresh, now }), "ended");
  });

  it("counts a session that is already gone as ended, and reports an unreachable service", async () => {
    const gone = fakeService({
      refresh: async () => rejected("refresh_token_not_found"),
      signOut: async () => rejected("session_not_found", 403),
    });
    assert.equal(await endSession(expired(), { service: gone, now }), "ended");
    assert.equal(await endSession(live(), { service: gone, now }), "ended");
    const down = fakeService({
      signOut: async () => unavailable,
      refresh: async () => unavailable,
    });
    assert.equal(await endSession(live(), { service: down, now }), "unavailable");
    assert.equal(await endSession(expired(), { service: down, now }), "unavailable");
  });
});
