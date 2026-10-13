import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACCESS_COOKIE,
  clearedCookieOptions,
  clearTokenPair,
  isSecureOrigin,
  readTokenPair,
  REFRESH_COOKIE,
  SESSION_COOKIE_MAX_AGE_SECONDS,
  type SessionCookieOptions,
  sessionCookieOptions,
  writeTokenPair,
} from "./cookies.ts";

describe("session cookies (BR2.5, NFR1.7)", () => {
  it("are httpOnly and sameSite lax, and secure over https only", () => {
    const http = sessionCookieOptions("http://127.0.0.1:3000");
    assert.deepEqual(http, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    });
    const https = sessionCookieOptions("https://app.example.org");
    assert.equal(https.secure, true);
    assert.equal(https.httpOnly, true);
    assert.equal(https.sameSite, "lax");
  });

  it("last 30 days and are cleared with a zero lifetime", () => {
    assert.equal(SESSION_COOKIE_MAX_AGE_SECONDS, 30 * 24 * 60 * 60);
    const cleared = clearedCookieOptions("https://app.example.org");
    assert.equal(cleared.maxAge, 0);
    assert.equal(cleared.secure, true);
    assert.equal(cleared.httpOnly, true);
  });

  it("treat an unparsable address as not secure", () => {
    assert.equal(isSecureOrigin("not a url"), false);
    assert.equal(isSecureOrigin("https://x.example.org"), true);
  });

  it("read both tokens or none, write them with the options, and clear them", () => {
    const jar = new Map<string, { value: string; options?: SessionCookieOptions }>();
    const store = {
      get: (name: string) => jar.get(name),
      set: (name: string, value: string, options: SessionCookieOptions) => {
        jar.set(name, { value, options });
      },
    };
    assert.equal(readTokenPair(store), undefined);
    writeTokenPair(
      store,
      { accessToken: "access-value", refreshToken: "refresh-value" },
      "http://localhost:3000",
    );
    assert.deepEqual(readTokenPair(store), {
      accessToken: "access-value",
      refreshToken: "refresh-value",
    });
    assert.equal(jar.get(ACCESS_COOKIE)?.options?.httpOnly, true);
    assert.equal(jar.get(REFRESH_COOKIE)?.options?.maxAge, SESSION_COOKIE_MAX_AGE_SECONDS);
    jar.delete(REFRESH_COOKIE);
    assert.equal(readTokenPair(store), undefined, "a pair with one cookie missing is no session");
    clearTokenPair(store, "http://localhost:3000");
    assert.equal(jar.get(ACCESS_COOKIE)?.value, "");
    assert.equal(jar.get(ACCESS_COOKIE)?.options?.maxAge, 0);
    assert.equal(readTokenPair(store), undefined);
  });
});
