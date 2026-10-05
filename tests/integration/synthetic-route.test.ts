import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as resetSyntheticFixtures } from "../../app/api/synthetic/reset/route";
import { POST as selectSyntheticProfile } from "../../app/api/synthetic/session/route";
import { resolveSyntheticSession, SESSION_COOKIE_NAME } from "../../src/runtime/session/session.ts";
import { SYNTHETIC_PROFILES } from "../../src/runtime/synthetic/profiles.ts";

const localOrigin = "http://127.0.0.1:3400";

function formRequest(profileId: string, origin = localOrigin) {
  return new NextRequest(`${localOrigin}/api/synthetic/session`, {
    method: "POST",
    headers: {
      host: "127.0.0.1:3400",
      origin,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ profileId }),
  });
}

afterEach(() => vi.unstubAllEnvs());

describe("synthetic-only route boundary", () => {
  it.each(SYNTHETIC_PROFILES)(
    "selects and rotates $id without changing the root destination",
    async (profile) => {
      vi.stubEnv("APP_RUNTIME_MODE", "synthetic");
      const first = await selectSyntheticProfile(formRequest(profile.id));
      const second = await selectSyntheticProfile(formRequest(profile.id));
      expect(first.status).toBe(303);
      expect(first.headers.get("location")).toBe(`${localOrigin}/`);
      const token = first.cookies.get(SESSION_COOKIE_NAME)?.value;
      expect(resolveSyntheticSession(token)?.profile.id).toBe(profile.id);
      expect(second.cookies.get(SESSION_COOKIE_NAME)?.value).not.toBe(token);
      expect(first.headers.get("set-cookie")).toContain("HttpOnly");
      expect(first.headers.get("set-cookie")).toContain("SameSite=lax");
    },
  );
  it("clears the active session on explicit profile switch/sign-out", async () => {
    vi.stubEnv("APP_RUNTIME_MODE", "synthetic");
    const response = await selectSyntheticProfile(formRequest(""));
    expect(response.status).toBe(303);
    expect(response.cookies.get(SESSION_COOKIE_NAME)?.value).toBe("");
    expect(response.headers.get("location")).toBe(`${localOrigin}/`);
  });
  it("rejects malformed form bodies without creating a session", async () => {
    vi.stubEnv("APP_RUNTIME_MODE", "synthetic");
    const response = await selectSyntheticProfile(
      new NextRequest(`${localOrigin}/api/synthetic/session`, {
        method: "POST",
        headers: {
          host: "127.0.0.1:3400",
          origin: localOrigin,
          "content-type": "application/json",
        },
        body: "{",
      }),
    );
    expect(response.status).toBe(400);
    expect(response.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
    await expect(response.json()).resolves.toEqual({ error: { code: "REQUEST_BODY_INVALID" } });
  });
  it("creates a rotated HTTP-only session in synthetic mode", async () => {
    vi.stubEnv("APP_RUNTIME_MODE", "synthetic");
    vi.stubEnv("APP_SYNTHETIC_FIXTURE_VERSION", "waldorf-local-v1");
    const response = await selectSyntheticProfile(formRequest("parent-local"));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${localOrigin}/`);
    expect(response.cookies.get(SESSION_COOKIE_NAME)?.value).toBeTruthy();
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
  });

  it("denies cross-origin state changes without a session", async () => {
    vi.stubEnv("APP_RUNTIME_MODE", "synthetic");
    const response = await selectSyntheticProfile(
      formRequest("parent-local", "https://untrusted.invalid"),
    );
    expect(response.status).toBe(403);
    expect(response.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it("returns a generic validation error for an unknown profile", async () => {
    vi.stubEnv("APP_RUNTIME_MODE", "synthetic");
    const response = await selectSyntheticProfile(formRequest("unknown-profile"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: "SYNTHETIC_PROFILE_INVALID" },
    });
  });

  it("removes selector and reset controls from production behavior", async () => {
    vi.stubEnv("APP_RUNTIME_MODE", "production");
    vi.stubEnv("APP_SESSION_SECRET", "a-production-only-secret-with-32-chars");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "placeholder-anon-key-value");

    const sessionResponse = await selectSyntheticProfile(formRequest("parent-local"));
    const resetResponse = await resetSyntheticFixtures(
      new NextRequest(`${localOrigin}/api/synthetic/reset`, {
        method: "POST",
        headers: { host: "127.0.0.1:3400", origin: localOrigin },
      }),
    );
    expect(sessionResponse.status).toBe(404);
    expect(resetResponse.status).toBe(404);
    expect(sessionResponse.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });
});
