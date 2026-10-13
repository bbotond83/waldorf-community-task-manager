import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "../../proxy";
import { fakeJwt } from "../support/identity-fakes";

const now = () => Math.floor(Date.now() / 1000);
const token = (exp: number) => fakeJwt({ sub: "u1", session_id: "s1", exp });
const sessionBody = () => ({
  access_token: token(now() + 3600),
  refresh_token: "refresh-2",
  user: { id: "u1", email: "person@example.test" },
});

function requestWith(cookies: Record<string, string>): NextRequest {
  const header = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  return new NextRequest("http://localhost/bejelentkezes", {
    headers: header ? { cookie: header } : {},
  });
}

describe("the request proxy renews the session cookies (R-04)", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("SUPABASE_ANON_KEY", "fake-public-key-for-tests-0123456789");
    vi.stubEnv("APP_SESSION_SECRET", "fake-session-secret-0123456789-abcdefghij");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("answers a request without a session cookie synchronously, as before", () => {
    const response = proxy(requestWith({}));
    expect(response).not.toBeInstanceOf(Promise);
  });

  it("keeps a fresh session untouched and calls nothing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await proxy(
      requestWith({ wb_access: token(now() + 3000), wb_refresh: "refresh-1" }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.cookies.get("wb_access")).toBeUndefined();
  });

  it("renews an expired access token with the live refresh token: the page of this request and the browser both get the new cookies", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify(sessionBody()), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await proxy(
      requestWith({ wb_access: token(now() - 60), wb_refresh: "refresh-1" }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(
      String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body),
    );
    expect(body).toEqual({ refresh_token: "refresh-1" });
    const access = response.cookies.get("wb_access")!;
    expect(access.value).toBe(sessionBody().access_token.length ? access.value : "");
    expect(response.cookies.get("wb_refresh")!.value).toBe("refresh-2");
    expect(response.headers.get("x-middleware-request-cookie")).toContain("wb_refresh=refresh-2");
    expect(response.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    expect(response.headers.get("set-cookie")).toMatch(/SameSite=lax/i);
    expect(response.headers.get("content-security-policy")).toContain("nonce-");
  });

  it("signs the person out (clears both cookies) when the refresh is refused: revoked or idle for 30 days", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error_code: "refresh_token_not_found" }), { status: 400 }),
      ),
    );
    const response = await proxy(
      requestWith({ wb_access: token(now() - 60), wb_refresh: "refresh-1" }),
    );
    expect(response.cookies.get("wb_access")!.value).toBe("");
    expect(response.cookies.get("wb_refresh")!.value).toBe("");
    expect(response.headers.get("x-middleware-request-cookie") ?? "").not.toContain("wb_refresh");
  });

  it("leaves the cookies alone when the sign-in service is down, and without identity settings", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("down");
      }),
    );
    const down = await proxy(
      requestWith({ wb_access: token(now() - 60), wb_refresh: "refresh-1" }),
    );
    expect(down.cookies.get("wb_access")).toBeUndefined();
    vi.unstubAllEnvs();
    vi.stubEnv("SUPABASE_URL", "");
    const none = await proxy(
      requestWith({ wb_access: token(now() - 60), wb_refresh: "refresh-1" }),
    );
    expect(none.cookies.get("wb_access")).toBeUndefined();
  });
});
