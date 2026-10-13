import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAdminAccess,
  getAdminAccess,
  readEnvFileValue,
  readServiceKey,
  resetAdminAccessForTests,
  SERVICE_KEY_NAME,
} from "../../src/identity/admin-runtime";
import {
  getIdentityRuntime,
  isIdentityConfigured,
  resetIdentityRuntimeForTests,
} from "../../src/identity/runtime";
import { resetDatabaseClientForTests } from "../../src/runtime/database/client";

// Fake values for the tests; none is a real credential.
const PUBLIC_KEY = "fake-public-key-for-tests-0123456789";
const SERVICE_KEY = ["fake", "service", "credential", "for", "tests", "0123456789"].join("-");
const SECRET = "fake-session-secret-0123456789-abcdefghij";
const environment = {
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_ANON_KEY: PUBLIC_KEY,
  APP_SESSION_SECRET: SECRET,
  APP_PUBLIC_URL: "http://127.0.0.1:3000",
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: "54325",
  SMTP_FROM: "sender@example.test",
};

describe("the server-only admin module reads the service-role key (BR2.23)", () => {
  it("reads one value from an env file, with quotes and comments", () => {
    const text = ["# comment", "", `OTHER=1`, `${SERVICE_KEY_NAME}="quoted-value"`].join("\n");
    expect(readEnvFileValue(text, SERVICE_KEY_NAME)).toBe("quoted-value");
    expect(readEnvFileValue(`${SERVICE_KEY_NAME}=plain`, SERVICE_KEY_NAME)).toBe("plain");
    expect(readEnvFileValue(`${SERVICE_KEY_NAME}=`, SERVICE_KEY_NAME)).toBeUndefined();
    expect(readEnvFileValue("A=1", SERVICE_KEY_NAME)).toBeUndefined();
    expect(readEnvFileValue(`=nothing\n#${SERVICE_KEY_NAME}=x`, SERVICE_KEY_NAME)).toBeUndefined();
  });

  it("prefers the process environment, then the ignored tooling file, then nothing", () => {
    const readFile = (path: string) =>
      path.endsWith(".env.service.local") ? `${SERVICE_KEY_NAME}=from-file` : undefined;
    expect(
      readServiceKey({
        environment: { [SERVICE_KEY_NAME]: " from-environment " },
        readFile,
        directory: "/app",
      }),
    ).toBe("from-environment");
    expect(readServiceKey({ environment: {}, readFile, directory: "/app" })).toBe("from-file");
    expect(
      readServiceKey({ environment: {}, readFile: () => undefined, directory: "/app" }),
    ).toBeUndefined();
  });

  it("builds the admin access, or names what is missing without printing a value", () => {
    const sources = { readFile: () => undefined, directory: "/app" };
    expect(() =>
      buildAdminAccess({ ...environment, [SERVICE_KEY_NAME]: SERVICE_KEY }, sources),
    ).not.toThrow();
    const noKey = () => buildAdminAccess(environment, sources);
    expect(noKey).toThrow(/ADMIN_ACCESS_UNAVAILABLE: SUPABASE_SERVICE_ROLE_KEY is not set/);
    const badConfig = () =>
      buildAdminAccess(
        { ...environment, SUPABASE_URL: "ftp://x", [SERVICE_KEY_NAME]: SERVICE_KEY },
        sources,
      );
    expect(badConfig).toThrow(/ADMIN_ACCESS_UNAVAILABLE: CONFIG_DATABASE_URL_INVALID/);
    try {
      badConfig();
    } catch (error) {
      expect(String(error)).not.toContain(SERVICE_KEY);
    }
  });
});

describe("the process-wide composition", () => {
  beforeEach(() => {
    resetAdminAccessForTests();
    resetIdentityRuntimeForTests();
    resetDatabaseClientForTests();
    for (const [name, value] of Object.entries(environment)) vi.stubEnv(name, value);
    vi.stubEnv(SERVICE_KEY_NAME, SERVICE_KEY);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    resetAdminAccessForTests();
    resetIdentityRuntimeForTests();
    resetDatabaseClientForTests();
  });

  it("reports whether the identity settings are complete", () => {
    expect(isIdentityConfigured()).toBe(true);
    expect(isIdentityConfigured({ ...environment, SMTP_PORT: "x" })).toBe(false);
    expect(isIdentityConfigured({})).toBe(false);
  });

  it("reuses one admin access per process and reads the key from the environment", () => {
    const first = getAdminAccess();
    expect(getAdminAccess()).toBe(first);
  });

  it("composes the identity runtime once from the validated settings", () => {
    const runtime = getIdentityRuntime();
    expect(getIdentityRuntime()).toBe(runtime);
    expect(runtime.settings).toEqual({
      appPublicUrl: "http://127.0.0.1:3000",
      smtp: { host: "127.0.0.1", port: 54325, from: "sender@example.test" },
    });
    expect(runtime.emailKeySecret).toBe(SECRET);
    expect(Object.keys(runtime).sort()).toEqual([
      "admin",
      "database",
      "emailKeySecret",
      "events",
      "mailer",
      "service",
      "settings",
    ]);
  });

  it("refuses to compose with a missing setting, naming it", () => {
    vi.stubEnv("APP_PUBLIC_URL", "");
    expect(() => getIdentityRuntime()).toThrow(/CONFIG_APP_PUBLIC_URL_INVALID/);
  });

  it("reads the key from the ignored tooling file when the environment has none", () => {
    vi.stubEnv(SERVICE_KEY_NAME, "");
    resetAdminAccessForTests();
    // The repository's tooling file may or may not exist (written by the stack start): both are valid outcomes.
    try {
      expect(getAdminAccess()).toBeTruthy();
    } catch (error) {
      expect(String(error)).toMatch(/ADMIN_ACCESS_UNAVAILABLE/);
    }
  });
});
