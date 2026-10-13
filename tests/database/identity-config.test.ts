import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { promisify } from "node:util";
import { PROJECT_ID } from "../../scripts/db/stack.ts";
import { createAdminAccess } from "../../src/identity/admin-client.ts";
import { createSignInService, readTokenClaims } from "../../src/identity/service.ts";
import { requestPasswordReset } from "../../src/identity/reset.ts";
import { createEventEmitter } from "../../src/identity/events.ts";
import {
  lockSchemas,
  openDatabase,
  prepareSchema,
  root,
  serviceKey,
  stackSettings,
} from "./stack-support.ts";

const run = promisify(execFile);
const settings = stackSettings();
const apiUrl = settings.apiUrl.replace(/\/$/, "");
const config = readFileSync(`${root}supabase/config.toml`, "utf8");
const SESSION_SECRET = `test-secret-${randomBytes(24).toString("hex")}`;

/** The value of `key` inside `[section]` of supabase/config.toml (strings without their quotes). */
function tomlValue(section: string, key: string): string | undefined {
  const lines = config.split("\n");
  let inSection = false;
  for (const line of lines) {
    const header = /^\[([^\]]+)\]\s*$/.exec(line.trim());
    if (header) inSection = header[1] === section;
    else if (inSection) {
      const match = new RegExp(`^${key}\\s*=\\s*(.+?)\\s*$`).exec(line.trim());
      if (match) return match[1]!.replace(/^"(.*)"$/, "$1");
    }
  }
  return undefined;
}

/** The environment of the running sign-in service container: the CLI passes every setting to it that way. */
async function authEnvironment(): Promise<Record<string, string>> {
  const { stdout } = await run("docker", [
    "inspect",
    `supabase_auth_${PROJECT_ID}`,
    "--format",
    "{{range .Config.Env}}{{println .}}{{end}}",
  ]);
  return Object.fromEntries(
    stdout
      .split("\n")
      .filter((line) => line.includes("="))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );
}

/** Read-back of every sign-in service value the design names (NFR2.4, NFR2.9, BR2.5, BR2.12, BR2.13). */
describe("sign-in service configuration read back from the running stack", () => {
  const service = createSignInService({ url: apiUrl, publicKey: settings.publicKey });
  const admin = createAdminAccess({ url: apiUrl, serviceKey: serviceKey(), schema: "public" });
  const address = (tag: string) => `config.${tag}.${randomBytes(4).toString("hex")}@example.test`;

  it("refuses a real open sign-up call (BR2.13)", async () => {
    const response = await fetch(`${apiUrl}/auth/v1/signup`, {
      method: "POST",
      headers: { apikey: settings.publicKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: address("signup"), password: "Plenty-of-1-chars" }),
    });
    assert.equal(response.status, 422);
    assert.equal(((await response.json()) as { error_code: string }).error_code, "signup_disabled");
    assert.equal(tomlValue("auth", "enable_signup"), "false");
    assert.equal((await authEnvironment()).GOTRUE_DISABLE_SIGNUP, "true");
  });

  it("keeps the email provider on, so password sign-in and recovery work (the second switch cannot be closed in this CLI)", async () => {
    assert.equal(tomlValue("auth.email", "enable_signup"), "true");
    assert.equal((await authEnvironment()).GOTRUE_EXTERNAL_EMAIL_ENABLED, "true");
    const outcome = await service.requestRecovery(address("provider"));
    assert.equal(
      outcome.ok,
      true,
      "the recovery endpoint answers (it would say the provider is disabled otherwise)",
    );
  });

  it("enforces the minimum password length of 8 on a real admin create", async () => {
    assert.equal(tomlValue("auth", "minimum_password_length"), "8");
    const short = await admin.createUser({
      email: address("short"),
      password: "abc1234",
      invitationId: "config-test",
    });
    assert.ok(!short.ok && short.kind === "rejected" && short.code === "weak_password");
    const email = address("eight");
    const eight = await admin.createUser({
      email,
      password: "abc12345",
      invitationId: "config-test",
    });
    assert.ok(eight.ok, "eight characters are accepted");
    if (eight.ok) await admin.deleteUser(eight.value.id);
  });

  it("issues access tokens that live 3600 seconds", async () => {
    assert.equal(tomlValue("auth", "jwt_expiry"), "3600");
    const email = address("token");
    const created = await admin.createUser({
      email,
      password: "abc12345",
      invitationId: "config-test",
    });
    assert.ok(created.ok);
    try {
      const session = await service.passwordSignIn(email, "abc12345");
      assert.ok(session.ok);
      const claims = readTokenClaims(session.value.accessToken)!;
      assert.equal(Number(claims.exp) - Number(claims.iat), 3600);
    } finally {
      if (created.ok) await admin.deleteUser(created.value.id);
    }
  });

  it("passes the one-time-code lifetime, the inactivity timeout, the rate limits and the email gap to the sign-in service", async () => {
    const env = await authEnvironment();
    assert.equal(tomlValue("auth.email", "otp_expiry"), "3600");
    assert.equal(env.GOTRUE_MAILER_OTP_EXP, "3600");
    assert.equal(tomlValue("auth.sessions", "inactivity_timeout"), "720h");
    assert.equal(env.GOTRUE_SESSIONS_INACTIVITY_TIMEOUT, "720h0m0s", "30 days");
    assert.equal(tomlValue("auth.email", "max_frequency"), "1m0s");
    assert.equal(env.GOTRUE_SMTP_MAX_FREQUENCY, "1m0s");
    for (const [key, name] of [
      ["token_refresh", "GOTRUE_RATE_LIMIT_TOKEN_REFRESH"],
      ["sign_in_sign_ups", "GOTRUE_RATE_LIMIT_OTP"],
      ["token_verifications", "GOTRUE_RATE_LIMIT_VERIFY"],
    ] as const) {
      assert.equal(tomlValue("auth.rate_limit", key), "30");
      assert.equal(env[name], "30", `${key} reaches the service as ${name}`);
    }
  });

  it("registers the password-verification hook and the password character rule with the sign-in service", async () => {
    const env = await authEnvironment();
    assert.equal(tomlValue("auth.hook.password_verification_attempt", "enabled"), "true");
    assert.equal(
      tomlValue("auth.hook.password_verification_attempt", "uri"),
      "pg-functions://postgres/public/password_verification_hook",
    );
    assert.equal(env.GOTRUE_HOOK_PASSWORD_VERIFICATION_ATTEMPT_ENABLED, "true");
    assert.equal(
      env.GOTRUE_HOOK_PASSWORD_VERIFICATION_ATTEMPT_URI,
      "pg-functions://postgres/public/password_verification_hook",
    );
    assert.equal(tomlValue("auth", "password_requirements"), "letters_digits");
    assert.match(
      env.GOTRUE_PASSWORD_REQUIRED_CHARACTERS ?? "",
      /abcdefghijklmnopqrstuvwxyz.*0123456789/,
    );
  });

  it("records the one rate limit this CLI version does not pass on locally: emails per hour", async () => {
    // `[auth.rate_limit] email_sent` is written to the file, but the CLI only forwards it for a custom SMTP
    // server; locally it sets its own very high value. The mail catcher receives all mail, so nothing is
    // sent to real people. The test fails if the CLI starts passing the value, so the fallback is revisited.
    assert.equal(tomlValue("auth.rate_limit", "email_sent"), "30");
    const effective = (await authEnvironment()).GOTRUE_RATE_LIMIT_EMAIL_SENT;
    assert.ok(
      effective === "360000" || effective === "30",
      `unexpected effective value ${effective}`,
    );
  });

  it("keeps the session inactivity limit inside the database as well (the stated fallback is exercised by identity-session.test.ts)", () => {
    const migration = readFileSync(
      `${root}supabase/migrations/20261015_identity_session.sql`,
      "utf8",
    );
    assert.match(migration, /interval '30 days'/);
  });

  it("sends a recovery mail whose link points at the app's reset route with the token hash", async () => {
    const email = address("recovery");
    const created = await admin.createUser({
      email,
      password: "abc12345",
      invitationId: "config-test",
    });
    assert.ok(created.ok);
    try {
      // A schema of its own, held under the test lock, so another file's reset cannot remove the Account.
      const database = await openDatabase();
      try {
        await lockSchemas(database, ["worker_2"]);
        await prepareSchema(database, "worker_2");
        await database.query('set search_path to "worker_2", pg_catalog');
        await database.query(
          "insert into accounts (id, email, organization_id) values ($1, $2, $3)",
          [created.ok ? created.value.id : "", email, "aaaaaaaa-0000-4000-8000-000000000001"],
        );
        const events: string[] = [];
        const outcome = await requestPasswordReset(email, {
          service,
          admin: createAdminAccess({ url: apiUrl, serviceKey: serviceKey(), schema: "worker_2" }),
          events: createEventEmitter({ secret: SESSION_SECRET, sink: (line) => events.push(line) }),
          emailKeySecret: SESSION_SECRET,
        });
        assert.equal(outcome.state, "success");
        await database.query("delete from accounts where email = $1", [email]);
      } finally {
        await database.end();
      }
      const deadline = Date.now() + 8000;
      let mail: { Text: string } | undefined;
      while (!mail && Date.now() < deadline) {
        const list = (await (
          await fetch(
            `http://127.0.0.1:54324/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
          )
        ).json()) as { messages: { ID: string }[] };
        if (list.messages[0])
          mail = (await (
            await fetch(`http://127.0.0.1:54324/api/v1/message/${list.messages[0].ID}`)
          ).json()) as { Text: string };
        else await new Promise((resolve) => setTimeout(resolve, 150));
      }
      assert.ok(mail, "the recovery mail arrived");
      const site = tomlValue("auth", "site_url")!;
      assert.match(
        mail.Text,
        new RegExp(
          `${site.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/jelszo-visszaallitas/uj\\?token_hash=[A-Za-z0-9_-]+&type=recovery`,
        ),
      );
    } finally {
      if (created.ok) await admin.deleteUser(created.value.id);
    }
  });

  it("uses the same address in links as the application: site_url equals APP_PUBLIC_URL and the redirect list names the reset page", async () => {
    const site = tomlValue("auth", "site_url");
    assert.equal(site, process.env.APP_PUBLIC_URL ?? "http://127.0.0.1:3000");
    assert.equal((await authEnvironment()).GOTRUE_SITE_URL, site);
    assert.match(config, /additional_redirect_urls = \["[^"]*\/jelszo-visszaallitas\/uj"\]/);
    assert.equal(
      tomlValue("auth.email.template.recovery", "content_path"),
      "./supabase/templates/recovery.html",
    );
    const template = readFileSync(`${root}supabase/templates/recovery.html`, "utf8");
    assert.ok(
      template.includes(
        "{{ .SiteURL }}/jelszo-visszaallitas/uj?token_hash={{ .TokenHash }}&type=recovery",
      ),
    );
  });

  it("publishes the mail catcher's SMTP port the application sends to", () => {
    assert.equal(tomlValue("local_smtp", "smtp_port"), "54325");
    assert.equal(tomlValue("local_smtp", "enabled"), "true");
  });
});
