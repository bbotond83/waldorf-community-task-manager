import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  EXAMPLE_SESSION_SECRET,
  formatDatabaseConfigError,
  readDatabaseConfig,
  readIdentitySettings,
  requireDatabaseConfig,
  requireIdentitySettings,
} from "./config.ts";

// Fake values generated for the tests; none of them is a real credential.
const PUBLIC_KEY = "fake-public-key-for-tests-0123456789";
const SECRET = "fake-session-secret-0123456789-abcdefghij";
const base = {
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_ANON_KEY: PUBLIC_KEY,
  APP_SESSION_SECRET: SECRET,
};

function jwtWithRole(role: string): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "HS256", typ: "JWT" })}.${part({ role })}.${"s".repeat(20)}`;
}

function failureOf(environment: Record<string, string | undefined>) {
  const result = readDatabaseConfig(environment);
  assert.equal(result.ok, false);
  return result.ok ? undefined : result.error;
}

describe("database runtime configuration", () => {
  it("accepts a local http address on a loopback host with the default schema", () => {
    const result = readDatabaseConfig(base);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.value, {
        url: "http://127.0.0.1:54321",
        publicKey: PUBLIC_KEY,
        sessionSecret: SECRET,
        schema: "public",
      });
    }
  });

  for (const url of ["http://localhost:54321", "http://[::1]:54321", "http://127.0.0.1"]) {
    it(`accepts the loopback address ${url}`, () => {
      assert.equal(readDatabaseConfig({ ...base, SUPABASE_URL: url }).ok, true);
    });
  }

  it("accepts a hosted https address and a worker schema", () => {
    const result = readDatabaseConfig({
      ...base,
      SUPABASE_URL: "https://project.example.co",
      DATABASE_SCHEMA: "worker_2",
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.value.schema, "worker_2");
  });

  it("falls back to the public schema when the setting is empty", () => {
    const result = readDatabaseConfig({ ...base, DATABASE_SCHEMA: "  " });
    assert.equal(result.ok && result.value.schema, "public");
  });

  it("rejects http on a host that is not loopback", () => {
    const error = failureOf({ ...base, SUPABASE_URL: "http://project.example.co" });
    assert.equal(error?.code, "CONFIG_DATABASE_URL_INVALID");
    assert.equal(error?.variable, "SUPABASE_URL");
  });

  for (const url of ["ftp://x", "not a url", "", undefined]) {
    it(`rejects the database address ${JSON.stringify(url)}`, () => {
      assert.equal(failureOf({ ...base, SUPABASE_URL: url })?.variable, "SUPABASE_URL");
    });
  }

  it("rejects a missing or too short public key", () => {
    assert.equal(
      failureOf({ ...base, SUPABASE_ANON_KEY: undefined })?.variable,
      "SUPABASE_ANON_KEY",
    );
    assert.equal(failureOf({ ...base, SUPABASE_ANON_KEY: "short" })?.variable, "SUPABASE_ANON_KEY");
  });

  it("rejects a service credential supplied as the public key", () => {
    for (const key of [jwtWithRole("service_role"), `sb_secret_${"a".repeat(24)}`]) {
      const error = failureOf({ ...base, SUPABASE_ANON_KEY: key });
      assert.equal(error?.code, "CONFIG_DATABASE_PUBLIC_KEY_INVALID");
    }
    assert.equal(readDatabaseConfig({ ...base, SUPABASE_ANON_KEY: jwtWithRole("anon") }).ok, true);
    assert.equal(
      readDatabaseConfig({ ...base, SUPABASE_ANON_KEY: "a.b.c-not-json-but-long-enough" }).ok,
      true,
    );
  });

  it("rejects a session secret that is short, missing or the example value", () => {
    for (const secret of ["too-short", undefined, EXAMPLE_SESSION_SECRET]) {
      const error = failureOf({ ...base, APP_SESSION_SECRET: secret });
      assert.equal(error?.variable, "APP_SESSION_SECRET");
    }
  });

  it("rejects schema names that are not lowercase identifiers", () => {
    for (const schema of ["Public", "a-b", "1abc", "worker 1", "x".repeat(64)]) {
      assert.equal(failureOf({ ...base, DATABASE_SCHEMA: schema })?.variable, "DATABASE_SCHEMA");
    }
  });

  it("never reads a service credential from the environment", () => {
    const serviceValue = "fake-service-credential-value-0123456789";
    const result = readDatabaseConfig({
      ...base,
      SUPABASE_SERVICE_ROLE_KEY: serviceValue,
      SERVICE_ROLE_KEY: serviceValue,
    });
    assert.equal(result.ok, true);
    assert.equal(JSON.stringify(result).includes(serviceValue), false);
    const source = readFileSync(new URL("./config.ts", import.meta.url), "utf8");
    // The only mention allowed is the role claim used to refuse a service credential as public key.
    assert.equal(/SERVICE_ROLE_KEY|SUPABASE_SERVICE|process\.env/.test(source), false);
  });

  it("names the failing setting but never prints a value", () => {
    const error = failureOf({ ...base, APP_SESSION_SECRET: "short-secret-value" });
    const text = formatDatabaseConfigError(error!);
    assert.match(text, /APP_SESSION_SECRET/);
    assert.equal(text.includes("short-secret-value"), false);
  });

  it("requireDatabaseConfig returns the value or throws naming the setting", () => {
    assert.equal(requireDatabaseConfig(base).schema, "public");
    assert.throws(
      () => requireDatabaseConfig({ ...base, SUPABASE_URL: "ftp://x" }),
      /SUPABASE_URL/,
    );
  });
});

const identity = {
  APP_PUBLIC_URL: "http://127.0.0.1:3000",
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: "54325",
  SMTP_FROM: "sender@example.test",
};
const LOCAL_DATABASE = "http://127.0.0.1:54321";

function identityFailure(
  environment: Record<string, string | undefined>,
  databaseUrl = LOCAL_DATABASE,
) {
  const result = readIdentitySettings(environment, databaseUrl);
  assert.equal(result.ok, false);
  return result.ok ? undefined : result.error;
}

describe("identity settings (BR2.10, BR2.12)", () => {
  it("accepts the local defaults and normalizes the public address", () => {
    const result = readIdentitySettings(
      { ...identity, APP_PUBLIC_URL: "http://localhost:3000/" },
      LOCAL_DATABASE,
    );
    assert.deepEqual(result, {
      ok: true,
      value: {
        appPublicUrl: "http://localhost:3000",
        smtp: { host: "127.0.0.1", port: 54325, from: "sender@example.test" },
      },
    });
  });

  it("allows http only for a loopback host and otherwise requires https", () => {
    for (const url of [
      "http://app.example.org",
      "http://192.168.1.5:3000",
      "ftp://127.0.0.1",
      "not a url",
      "",
    ]) {
      assert.equal(
        identityFailure({ ...identity, APP_PUBLIC_URL: url })?.variable,
        "APP_PUBLIC_URL",
        url,
      );
    }
    for (const url of ["https://app.example.org", "http://[::1]:3000", "http://127.0.0.1"]) {
      assert.equal(
        readIdentitySettings({ ...identity, APP_PUBLIC_URL: url }, LOCAL_DATABASE).ok,
        true,
        url,
      );
    }
  });

  it("refuses a path, a query, a fragment or credentials in the public address", () => {
    for (const url of [
      "https://app.example.org/app",
      "https://app.example.org/?a=1",
      "https://app.example.org/#x",
      "https://user:pass@example.org",
    ]) {
      assert.equal(
        identityFailure({ ...identity, APP_PUBLIC_URL: url })?.code,
        "CONFIG_APP_PUBLIC_URL_INVALID",
        url,
      );
    }
  });

  it("requires a loopback mail host in a local run and any valid host elsewhere", () => {
    assert.equal(
      identityFailure({ ...identity, SMTP_HOST: "mail.example.org" })?.variable,
      "SMTP_HOST",
    );
    assert.equal(
      readIdentitySettings(
        { ...identity, APP_PUBLIC_URL: "https://app.example.org", SMTP_HOST: "mail.example.org" },
        "https://db.example.org",
      ).ok,
      true,
    );
    for (const host of ["", "bad host", "-bad.example.org", "a..b"]) {
      assert.equal(
        identityFailure({ ...identity, SMTP_HOST: host }, "https://db.example.org")?.variable,
        "SMTP_HOST",
        host,
      );
    }
    assert.equal(
      readIdentitySettings({ ...identity, SMTP_HOST: "[::1]" }, LOCAL_DATABASE).ok,
      true,
    );
  });

  it("requires a numeric port and a plain sender address", () => {
    for (const port of ["", "abc", "0", "65536", "-1", "12.5"]) {
      assert.equal(identityFailure({ ...identity, SMTP_PORT: port })?.variable, "SMTP_PORT", port);
    }
    for (const from of ["", "nobody", "A <a@example.test>", "a@b", `${"a".repeat(250)}@b.test`]) {
      assert.equal(identityFailure({ ...identity, SMTP_FROM: from })?.variable, "SMTP_FROM", from);
    }
  });

  it("names the failing setting without printing its value, and requireIdentitySettings throws", () => {
    const error = identityFailure({ ...identity, SMTP_FROM: "secret-looking-value" });
    assert.equal(JSON.stringify(error).includes("secret-looking-value"), false);
    assert.equal(requireIdentitySettings(identity, LOCAL_DATABASE).smtp.port, 54325);
    assert.throws(
      () => requireIdentitySettings({ ...identity, SMTP_PORT: "x" }, LOCAL_DATABASE),
      /SMTP_PORT/,
    );
  });

  it("still never reads a service credential: the general configuration is unchanged (U1 BR1.4)", () => {
    const source = readFileSync(new URL("./config.ts", import.meta.url), "utf8");
    assert.equal(/SERVICE_ROLE_KEY|SUPABASE_SERVICE|process\.env/.test(source), false);
  });
});
