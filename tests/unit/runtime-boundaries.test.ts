import { afterEach, describe, expect, it, vi } from "vitest";
import { assertLoginDuration } from "../browser/support/profile-login-server.ts";
import {
  measureProfileLogin,
  permittedNavigationIds,
  type LoginMeasurement,
} from "../browser/support/profile-login-measurement.ts";
import type { Page, Request as BrowserRequest } from "@playwright/test";
import { composeRuntime } from "../../src/runtime/composition.ts";
import { formatRuntimeConfigError, validateRuntimeConfig } from "../../src/runtime/config.ts";
import { isSameOrigin } from "../../src/runtime/security/origin.ts";
import {
  createSyntheticSessionToken,
  resolveSyntheticSession,
  SESSION_MAX_AGE_SECONDS,
  sessionCookieOptions,
} from "../../src/runtime/session/session.ts";
import { getSyntheticProfile, SYNTHETIC_PROFILES } from "../../src/runtime/synthetic/profiles.ts";

describe("profile login measurement boundary", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("accepts the inclusive five-second boundary", () => {
    expect(() => assertLoginDuration(5000)).not.toThrow();
  });
  it("takes the permitted links from the one menu of each profile", () => {
    expect(permittedNavigationIds(SYNTHETIC_PROFILES[2]).has("admin-archive")).toBe(true);
    expect(permittedNavigationIds(SYNTHETIC_PROFILES[2]).has("admin-records")).toBe(true);
    expect(permittedNavigationIds(SYNTHETIC_PROFILES[2]).has("admin-import")).toBe(false);
    expect([...permittedNavigationIds(SYNTHETIC_PROFILES[0])]).toEqual([
      "parent-notifications",
      "parent-duties",
      "parent-swaps",
    ]);
    expect([...permittedNavigationIds(SYNTHETIC_PROFILES[1])]).toEqual([]);
  });
  it("rejects a successful but over-budget login", () => {
    expect(() => assertLoginDuration(5001)).toThrow("within 5000 ms");
    expect(() => assertLoginDuration(Number.NaN)).toThrow();
    expect(() => assertLoginDuration(-1)).toThrow();
  });
  it.each([123, null, Number.NaN, -1])(
    "records a failed selection before propagating it (timer %s)",
    async (elapsed) => {
      const failure = new Error("session request failed");
      const page = {
        on: vi.fn(),
        off: vi.fn(),
        evaluate: vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(elapsed),
        getByTestId: vi.fn().mockReturnValue({ click: vi.fn().mockRejectedValue(failure) }),
      } as unknown as Page;
      const records: LoginMeasurement[] = [];
      await expect(
        measureProfileLogin(page, SYNTHETIC_PROFILES[0], (record) => records.push(record)),
      ).rejects.toBe(failure);
      expect(records).toEqual([
        expect.objectContaining({
          profile: "parent-local",
          destination: "/szulo/ertesitesek",
          elapsed,
          observedElapsed: expect.any(Number),
          result: "failed",
          error: "session request failed",
        }),
      ]);
      expect(page.off).toHaveBeenCalledTimes(3);
    },
  );
  it("preserves host observation when the renderer cannot return the submission timer", async () => {
    const failure = new Error("browser disconnected");
    let onRequest: ((request: BrowserRequest) => void) | undefined;
    const page = {
      on: vi.fn((event, listener) => {
        if (event === "request") onRequest = listener;
      }),
      off: vi.fn(),
      evaluate: vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(failure),
      getByTestId: vi.fn().mockReturnValue({
        click: vi.fn(async () => {
          onRequest?.({
            method: () => "POST",
            url: () => "http://127.0.0.1:3000/api/synthetic/session",
          } as BrowserRequest);
          throw failure;
        }),
      }),
    } as unknown as Page;
    const record = vi.fn();
    await expect(measureProfileLogin(page, SYNTHETIC_PROFILES[0], record)).rejects.toBe(failure);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        elapsed: null,
        observedElapsed: expect.any(Number),
        requestElapsedLowerBound: expect.any(Number),
        result: "failed",
      }),
    );
  });
  it("leaves normal Next output unchanged", async () => {
    vi.stubEnv("APP_LOGIN_TEST_DIST_DIR", undefined);
    expect((await import("../../next.config.ts")).default.distDir).toBeUndefined();
  });
  it("isolates test output inside the ignored generated tree", async () => {
    vi.stubEnv("APP_LOGIN_TEST_DIST_DIR", ".next/login-performance-unit-1");
    expect((await import("../../next.config.ts")).default.distDir).toBe(
      ".next/login-performance-unit-1",
    );
  });
  it("rejects output outside the dedicated test namespace", async () => {
    vi.stubEnv("APP_LOGIN_TEST_DIST_DIR", "../outside");
    await expect(import("../../next.config.ts")).rejects.toThrow("dedicated");
  });
});

describe("runtime configuration", () => {
  it("accepts privacy-safe synthetic defaults", () => {
    expect(validateRuntimeConfig({ APP_RUNTIME_MODE: "synthetic" })).toEqual({
      ok: true,
      value: { mode: "synthetic", fixtureVersion: "waldorf-local-v1" },
    });
  });

  it("rejects a malformed fixture version", () => {
    const result = validateRuntimeConfig({
      APP_RUNTIME_MODE: "synthetic",
      APP_SYNTHETIC_FIXTURE_VERSION: "unsafe version/value",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.variable).toBe("APP_SYNTHETIC_FIXTURE_VERSION");
  });

  it("rejects missing and unknown modes with a stable redacted error", () => {
    const missing = validateRuntimeConfig({ APP_SESSION_SECRET: "must-not-appear" });
    const unknown = validateRuntimeConfig({ APP_RUNTIME_MODE: "preview" });
    expect(missing.ok).toBe(false);
    expect(unknown.ok).toBe(false);
    if (!missing.ok) {
      expect(formatRuntimeConfigError(missing.error)).toBe(
        "CONFIG_RUNTIME_MODE_INVALID: invalid APP_RUNTIME_MODE",
      );
      expect(formatRuntimeConfigError(missing.error)).not.toContain("must-not-appear");
    }
  });

  it("validates production variables without calling a target", () => {
    const result = validateRuntimeConfig({
      APP_RUNTIME_MODE: "production",
      APP_SESSION_SECRET: "a-production-only-secret-with-32-chars",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "placeholder-anon-key-value",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.mode).toBe("production");
  });

  it("accepts an http database address only on the machine itself", () => {
    const base = {
      APP_RUNTIME_MODE: "production",
      APP_SESSION_SECRET: "a-production-only-secret-with-32-chars",
      SUPABASE_ANON_KEY: "placeholder-anon-key-value",
    };
    for (const address of [
      "http://127.0.0.1:54321",
      "http://localhost:54321",
      "http://[::1]:54321",
    ]) {
      expect(validateRuntimeConfig({ ...base, SUPABASE_URL: address }).ok).toBe(true);
    }
    for (const address of [
      "http://example.supabase.co",
      "http://192.168.1.20:54321",
      "http://localhost.evil.example",
      "ftp://127.0.0.1",
      "not a url",
    ]) {
      const result = validateRuntimeConfig({ ...base, SUPABASE_URL: address });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.variable).toBe("SUPABASE_URL");
    }
  });

  it("names only the first invalid production variable", () => {
    const result = validateRuntimeConfig({ APP_RUNTIME_MODE: "production" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONFIG_PRODUCTION_INVALID");
      expect(result.error.variable).toBe("APP_SESSION_SECRET");
      expect(result.error.message).not.toMatch(/key value/i);
    }
  });

  it("composes only the selected synthetic root", async () => {
    const result = await composeRuntime({ APP_RUNTIME_MODE: "synthetic" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.mode).toBe("synthetic");
      expect("authenticationBoundary" in result.value).toBe(false);
    }
  });

  it("composes the production slot without synthetic controls", async () => {
    const result = await composeRuntime({
      APP_RUNTIME_MODE: "production",
      APP_SESSION_SECRET: "a-production-only-secret-with-32-chars",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "placeholder-anon-key-value",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.mode).toBe("production");
      expect("profiles" in result.value).toBe(false);
    }
  });

  it("does not construct any root after invalid configuration", async () => {
    const result = await composeRuntime({ APP_RUNTIME_MODE: "invalid" });
    expect(result).toMatchObject({ ok: false, error: { code: "CONFIG_RUNTIME_MODE_INVALID" } });
  });
});

describe("synthetic profile and session boundary", () => {
  const parent = SYNTHETIC_PROFILES[0];

  it("provides exactly the four approved invented roles", () => {
    expect(SYNTHETIC_PROFILES.map((profile) => profile.role)).toEqual([
      "parent",
      "kindergarten-teacher",
      "group-admin",
      "super-admin",
    ]);
  });

  it("keeps group administrator navigation free of import and governance", () => {
    const profile = getSyntheticProfile("group-admin-local");
    expect(profile).toBeDefined();
    expect(profile?.navigation.some((item) => item.href === "/admin/import")).toBe(false);
    expect(profile?.navigation.some((item) => item.href === "/admin/beallitasok")).toBe(false);
    expect(getSyntheticProfile("real-person-profile")).toBeUndefined();
  });

  it("creates and resolves a synthetic profile session", () => {
    const now = Date.parse("2026-08-12T10:00:00.000Z");
    const session = resolveSyntheticSession(createSyntheticSessionToken(parent, now), now);
    expect(session?.profile.id).toBe("parent-local");
    expect(session?.authorizationVersion).toBe(1);
  });

  it("rotates the token when switching profiles", () => {
    const firstToken = createSyntheticSessionToken(parent);
    const nextToken = createSyntheticSessionToken(SYNTHETIC_PROFILES[1]);
    expect(firstToken).not.toBe(nextToken);
    expect(resolveSyntheticSession(nextToken)?.profile.id).toBe("kindergarten-teacher-local");
  });

  it("rejects missing, malformed, and tampered tokens", () => {
    expect(resolveSyntheticSession(undefined)).toBeUndefined();
    expect(resolveSyntheticSession("not-a-token")).toBeUndefined();
    expect(
      resolveSyntheticSession(`${createSyntheticSessionToken(parent)}tampered`),
    ).toBeUndefined();
  });

  it("rejects stale sessions", () => {
    const issuedAt = Date.parse("2026-08-12T00:00:00.000Z");
    const token = createSyntheticSessionToken(parent, issuedAt);
    expect(
      resolveSyntheticSession(token, issuedAt + (SESSION_MAX_AGE_SECONDS + 1) * 1000),
    ).toBeUndefined();
  });

  it("uses secure HTTP-only cookie attributes at the production boundary", () => {
    expect(sessionCookieOptions(true)).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
  });
});

describe("same-origin protection", () => {
  function request(origin?: string) {
    const headers = new Headers({ host: "127.0.0.1:3000" });
    if (origin) headers.set("origin", origin);
    return new Request("http://127.0.0.1:3000/api/synthetic/session", { headers });
  }

  it("accepts a matching request origin and host", () => {
    expect(isSameOrigin(request("http://127.0.0.1:3000"))).toBe(true);
  });

  it("rejects cross-origin and missing-origin state changes", () => {
    expect(isSameOrigin(request("https://untrusted.invalid"))).toBe(false);
    expect(isSameOrigin(request())).toBe(false);
  });

  it("rejects a malformed origin", () => {
    expect(isSameOrigin(request("not a url"))).toBe(false);
  });
});
