import { describe, expect, it } from "vitest";
import { composeRuntime } from "../../src/runtime/composition.ts";
import { formatRuntimeConfigError, validateRuntimeConfig } from "../../src/runtime/config.ts";
import {
  GROUP_ADMIN_NAVIGATION,
  PARENT_NAVIGATION,
  SUPER_ADMIN_NAVIGATION,
  TEACHER_NAVIGATION,
} from "../../src/runtime/navigation.ts";

const VALID = {
  APP_SESSION_SECRET: "a-production-only-secret-with-32-chars",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "placeholder-anon-key-value",
};

describe("runtime configuration", () => {
  it("validates the three settings without calling a target and has no mode", () => {
    const result = validateRuntimeConfig(VALID);
    expect(result).toEqual({
      ok: true,
      value: {
        sessionSecret: VALID.APP_SESSION_SECRET,
        supabaseUrl: VALID.SUPABASE_URL,
        supabaseAnonKey: VALID.SUPABASE_ANON_KEY,
      },
    });
    if (result.ok) expect("mode" in result.value).toBe(false);
  });

  it("ignores the removed mode and fixture settings completely", () => {
    const result = validateRuntimeConfig({
      ...VALID,
      APP_RUNTIME_MODE: "preview",
      APP_SYNTHETIC_FIXTURE_VERSION: "unsafe version/value",
    });
    expect(result.ok).toBe(true);
  });

  it("stops without the settings, naming the first missing one and never repeating a value", () => {
    const missing = validateRuntimeConfig({ SUPABASE_URL: VALID.SUPABASE_URL });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error.code).toBe("CONFIG_PRODUCTION_INVALID");
      expect(missing.error.variable).toBe("APP_SESSION_SECRET");
      expect(formatRuntimeConfigError(missing.error)).toBe(
        "CONFIG_PRODUCTION_INVALID: invalid APP_SESSION_SECRET",
      );
    }
    const secret = validateRuntimeConfig({ ...VALID, APP_SESSION_SECRET: "must-not-appear" });
    expect(secret.ok).toBe(false);
    if (!secret.ok) expect(formatRuntimeConfigError(secret.error)).not.toContain("must-not-appear");
    const noKey = validateRuntimeConfig({ ...VALID, SUPABASE_ANON_KEY: "short" });
    expect(!noKey.ok && noKey.error.variable).toBe("SUPABASE_ANON_KEY");
    const nothing = validateRuntimeConfig({});
    expect(!nothing.ok && nothing.error.variable).toBe("APP_SESSION_SECRET");
  });

  it("accepts an http database address only on the machine itself", () => {
    for (const address of [
      "http://127.0.0.1:54321",
      "http://localhost:54321",
      "http://[::1]:54321",
    ]) {
      expect(validateRuntimeConfig({ ...VALID, SUPABASE_URL: address }).ok).toBe(true);
    }
    for (const address of [
      "http://example.supabase.co",
      "http://192.168.1.20:54321",
      "http://localhost.evil.example",
      "ftp://127.0.0.1",
      "not a url",
    ]) {
      const result = validateRuntimeConfig({ ...VALID, SUPABASE_URL: address });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.variable).toBe("SUPABASE_URL");
    }
  });
});

describe("runtime composition", () => {
  it("composes the one runtime with the facades made per signed-in request", async () => {
    const result = await composeRuntime(VALID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect("mode" in result.value).toBe(false);
      expect("profiles" in result.value).toBe(false);
      expect(result.value.authenticationBoundary).toBe("supabase-session");
      expect(typeof result.value.services.forRequest).toBe("function");
    }
  });

  it("does not construct anything after an invalid configuration", async () => {
    const result = await composeRuntime({ ...VALID, SUPABASE_URL: "http://example.org" });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "CONFIG_PRODUCTION_INVALID", variable: "SUPABASE_URL" },
    });
  });
});

describe("role navigation", () => {
  it("keeps group administrator navigation free of import and governance", () => {
    const hrefs = GROUP_ADMIN_NAVIGATION.map((item) => item.href);
    expect(hrefs).not.toContain("/admin/import");
    expect(hrefs).not.toContain("/admin/beallitasok");
    expect(hrefs).toContain("/admin/archivum");
  });

  it("gives the super admin the group menu and the four super admin pages, the teacher none", () => {
    expect(SUPER_ADMIN_NAVIGATION.slice(0, GROUP_ADMIN_NAVIGATION.length)).toEqual(
      GROUP_ADMIN_NAVIGATION,
    );
    expect(SUPER_ADMIN_NAVIGATION.map((item) => item.id).slice(-4)).toEqual([
      "admin-import",
      "admin-reminders",
      "admin-privacy",
      "admin-settings",
    ]);
    expect(TEACHER_NAVIGATION).toEqual([]);
    expect(PARENT_NAVIGATION.map((item) => item.id)).toEqual([
      "parent-notifications",
      "parent-duties",
      "parent-swaps",
    ]);
  });
});
