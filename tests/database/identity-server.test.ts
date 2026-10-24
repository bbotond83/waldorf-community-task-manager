import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { PUBLISHED_PORTS } from "../../scripts/db/stack.ts";
import {
  acceptInvitation,
  createInvitation,
  invitationLink,
  lookupInvitation,
  resendInvitation,
  revokeInvitation,
} from "../../src/identity/invitations.ts";
import { changeGrant, deactivateAccount, reactivateAccount } from "../../src/identity/accounts.ts";
import { createAdminAccess, type AdminAccess } from "../../src/identity/admin-client.ts";
import { generateToken, hashToken, keyedHash } from "../../src/identity/crypto.ts";
import { createEventEmitter } from "../../src/identity/events.ts";
import { createInvitationMailer, createSmtpTransport } from "../../src/identity/mail.ts";
import { completePasswordReset, requestPasswordReset } from "../../src/identity/reset.ts";
import { decideRefresh } from "../../src/identity/refresh.ts";
import { createSignInService } from "../../src/identity/service.ts";
import { endSession, resolveSession } from "../../src/identity/session.ts";
import { resetHousekeepingClockForTests, signIn } from "../../src/identity/sign-in.ts";
import { createDatabaseClient } from "../../src/runtime/database/client.ts";
import {
  ADMIN_G1,
  count,
  FAMILY_1,
  FAMILY_2,
  GROUP_1,
  IDENTITY_SCHEMAS,
  openIdentityDatabase,
  ORGANIZATION,
  seedIdentityWorld,
} from "./identity-support.ts";
import { report, serviceKey, stackSettings } from "./stack-support.ts";

const settings = stackSettings();
const apiUrl = settings.apiUrl.replace(/\/$/, "");
const SESSION_SECRET = `test-secret-${randomBytes(24).toString("hex")}`;
const APP_URL = "http://127.0.0.1:3000";
const MAIL_API = "http://127.0.0.1:54324/api/v1";

type Mail = { to: string; subject: string; text: string; html: string };

/** Reads mail from the mail catcher's web API, the way a person would open it. */
async function mailTo(address: string, expected = 1): Promise<Mail[]> {
  const deadline = Date.now() + 8000;
  for (;;) {
    const list = (await (
      await fetch(`${MAIL_API}/search?query=${encodeURIComponent(`to:${address}`)}`)
    ).json()) as {
      messages: { ID: string; Subject: string }[];
    };
    if (list.messages.length >= expected || Date.now() > deadline) {
      const mails: Mail[] = [];
      for (const message of list.messages) {
        const full = (await (await fetch(`${MAIL_API}/message/${message.ID}`)).json()) as {
          Text: string;
          HTML: string;
        };
        mails.push({ to: address, subject: message.Subject, text: full.Text, html: full.HTML });
      }
      return mails;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

async function forgetMail(address: string): Promise<void> {
  await fetch(`${MAIL_API}/search?query=${encodeURIComponent(`to:${address}`)}`, {
    method: "DELETE",
  });
}

/** Server modules against the real stack: the sign-in service, the database, the mail catcher (NFR1.22, NFR6.2, NFR6.4, NFR6.5, NFR6.8). */
for (const schema of IDENTITY_SCHEMAS) {
  describe(`identity server modules in ${schema}`, () => {
    let db: pg.Client;
    const lines: string[] = [];
    const events = createEventEmitter({ secret: SESSION_SECRET, sink: (line) => lines.push(line) });
    const config = {
      url: apiUrl,
      publicKey: settings.publicKey,
      sessionSecret: SESSION_SECRET,
      schema,
    };
    const database = createDatabaseClient(config);
    const service = createSignInService({ url: apiUrl, publicKey: settings.publicKey });
    const admin = createAdminAccess({ url: apiUrl, serviceKey: serviceKey(), schema });
    const mailer = createInvitationMailer({
      transport: createSmtpTransport({ host: "127.0.0.1", port: PUBLISHED_PORTS.smtp }),
      from: "noreply@example.test",
    });
    const email = (tag: string) => `${schema}.${tag}@example.test`;
    // The password hook is wired to the default schema, so its attempts live in public whatever the schema under test.
    const hookKey = (id: string) => `encode(sha256(convert_to('hook:${id}', 'UTF8')), 'hex')`;
    const hookAttempts = async (id: string) =>
      (
        await db.query(
          `select count(*)::int as n from public.sign_in_attempts where email_hash = ${hookKey(id)}`,
        )
      ).rows[0].n as number;
    const clearHookAttempts = (id: string) =>
      db.query(`delete from public.sign_in_attempts where email_hash = ${hookKey(id)}`);
    const appAttempts = (address: string) =>
      count(
        db,
        "sign_in_attempts",
        `email_hash = '${keyedHash(address, SESSION_SECRET, "email")}'`,
      );
    const secret = () => `Pw-${randomBytes(6).toString("hex")}-1`;
    const now = () => Date.now();

    const signInDeps = (overrides: Partial<Parameters<typeof signIn>[1]> = {}) => ({
      service,
      admin,
      database,
      events,
      emailKeySecret: SESSION_SECRET,
      now,
      ...overrides,
    });

    before(async () => {
      db = await openIdentityDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedIdentityWorld(db, schema);
      lines.length = 0;
      resetHousekeepingClockForTests();
    });

    /**
     * What the signed-in person's grants allow for a family, asked through the data API with their own token:
     * the scope probe reads the grants (the family table follows the parent's link instead, U3 BR30.8).
     */
    async function probeFamily(token: string, family: string): Promise<string> {
      const answer = (await database
        .forSession(token)
        .read<string>(
          (client) =>
            client.rpc("scope_probe", { p_record_type: "family", p_record_id: family }) as never,
          { idempotencyKey: "x", action: "read" },
        )) as { state: string; data: string };
      return answer.data;
    }

    /** A person with a real sign-in user, an Account and a grant. */
    async function person(
      tag: string,
      grant?: { role: string; scopeType: string; scope: string; organization?: string },
    ) {
      const address = email(tag);
      const password = secret();
      const created = await admin.createUser({ email: address, password, invitationId: "test" });
      assert.ok(created.ok, "the sign-in service creates the user");
      const id = created.value.id;
      // The test users are real accounts: remove the invitation tag so housekeeping leaves them alone.
      await db.query("update auth.users set raw_app_meta_data = '{}'::jsonb where id = $1", [id]);
      await db.query("insert into accounts (id, email, organization_id) values ($1, $2, $3)", [
        id,
        address,
        ORGANIZATION,
      ]);
      if (grant) {
        await db.query(
          "insert into app_role_grants (subject_id, role, scope_type, scope_id, organization_id) values ($1, $2, $3, $4, $5)",
          [id, grant.role, grant.scopeType, grant.scope, grant.organization ?? ORGANIZATION],
        );
        await db.query(
          "insert into app_authorization_versions (subject_id, authorization_version) values ($1, 1) on conflict do nothing",
          [id],
        );
      }
      return { id, address, password };
    }

    async function signedIn(tag: string, grant?: Parameters<typeof person>[1]) {
      const who = await person(tag, grant);
      const result = await signIn({ email: who.address, password: who.password }, signInDeps());
      assert.equal(result.state, "success");
      assert.ok(result.state === "success");
      return {
        ...who,
        tokens: result.data,
        caller: { accessToken: result.data.accessToken, accountId: who.id },
      };
    }

    const superGrant = { role: "super_admin", scopeType: "organization", scope: ORGANIZATION };

    describe("sign-in, session and sign-out", () => {
      it("signs in against the real service, keeps an active session, refreshes it, and signs out only that session", async () => {
        const who = await signedIn("alice", superGrant);
        const started = await resolveSession(
          { accessToken: who.tokens.accessToken, refreshToken: who.tokens.refreshToken },
          { service, database, now },
        );
        assert.equal(started.status, "signed-in");
        const second = await signIn({ email: who.address, password: who.password }, signInDeps());
        assert.ok(second.state === "success", "a second session of the same account");
        // A refresh near expiry spends the refresh token and hands back new ones.
        const nearExpiry = () => Date.now() + 3600 * 1000 - 10_000;
        const refreshed = await resolveSession(
          { accessToken: who.tokens.accessToken, refreshToken: who.tokens.refreshToken },
          { service, database, now: nearExpiry },
        );
        assert.ok(refreshed.status === "signed-in" && refreshed.renewed, "the tokens were renewed");
        assert.notEqual(
          refreshed.status === "signed-in" && refreshed.renewed?.refreshToken,
          who.tokens.refreshToken,
        );
        assert.equal(
          await endSession(
            { accessToken: who.tokens.accessToken, refreshToken: who.tokens.refreshToken },
            { service, now },
          ),
          "ended",
        );
        const after = await resolveSession(
          { accessToken: who.tokens.accessToken, refreshToken: who.tokens.refreshToken },
          { service, database, now },
        );
        assert.equal(
          after.status,
          "signed-out",
          "the ended session is dead for the database at once",
        );
        assert.ok(second.state === "success");
        const other = await resolveSession(
          { accessToken: second.data.accessToken, refreshToken: second.data.refreshToken },
          { service, database, now },
        );
        assert.equal(
          other.status,
          "signed-in",
          "the other session of the same account is unaffected",
        );
      });

      it("keeps a session alive with the refresh step, and signs out a revoked or 30-day idle session (R-04)", async () => {
        const who = await signedIn("refresher", superGrant);
        const cookies = (tokens: { accessToken: string; refreshToken: string }) => ({
          get: (name: string) =>
            name === "wb_access"
              ? { value: tokens.accessToken }
              : name === "wb_refresh"
                ? { value: tokens.refreshToken }
                : undefined,
        });
        const base = { service, appPublicUrl: APP_URL };
        // Fresh token: nothing to do.
        assert.equal((await decideRefresh(cookies(who.tokens), { ...base, now })).action, "none");
        // An hour later the access token has expired: the live refresh token renews the pair and the session stays.
        const later = () => Date.now() + 3600 * 1000 + 5000;
        const renewed = await decideRefresh(cookies(who.tokens), { ...base, now: later });
        assert.equal(renewed.action, "renew");
        assert.ok(renewed.action === "renew");
        const active = await resolveSession(renewed.tokens, { service, database, now });
        assert.equal(active.status, "signed-in", "the renewed tokens are an active session");
        // The session survives many hours of use: each renewal moves the 30-day clock.
        const again = await decideRefresh(cookies(renewed.tokens), {
          ...base,
          now: () => later() + 3600 * 1000 + 5000,
        });
        assert.equal(again.action, "renew");
        // Revoked (signed out elsewhere): the refresh is refused and the cookies are cleared.
        const other = await signedIn("refresher2", superGrant);
        await db.query("delete from auth.sessions where user_id = $1", [other.id]);
        const revoked = await decideRefresh(cookies(other.tokens), { ...base, now: later });
        assert.equal(revoked.action, "clear");
        // Idle for more than 30 days: the sign-in service refuses the refresh too.
        const idle = await signedIn("refresher3", superGrant);
        await db.query(
          "update auth.sessions set refreshed_at = (now() - interval '31 days') at time zone 'utc' where user_id = $1",
          [idle.id],
        );
        const stale = await decideRefresh(cookies(idle.tokens), { ...base, now: later });
        assert.equal(stale.action, "clear");
        assert.equal(
          (await resolveSession(idle.tokens, { service, database, now })).status,
          "signed-out",
          "the database refuses the idle session as well",
        );
      });

      it("lets two people be signed in at once without seeing each other's data", async () => {
        const parent = await signedIn("parent1", {
          role: "parent",
          scopeType: "family",
          scope: FAMILY_1,
        });
        const other = await signedIn("parent2", {
          role: "parent",
          scopeType: "family",
          scope: FAMILY_2,
        });
        assert.deepEqual(
          [
            await probeFamily(parent.tokens.accessToken, FAMILY_1),
            await probeFamily(parent.tokens.accessToken, FAMILY_2),
          ],
          ["allowed", "denied"],
        );
        assert.deepEqual(
          [
            await probeFamily(other.tokens.accessToken, FAMILY_1),
            await probeFamily(other.tokens.accessToken, FAMILY_2),
          ],
          ["denied", "allowed"],
        );
      });

      it("answers a wrong password, an unknown address and a deactivated account with the same result, and reports the timing difference", async () => {
        const active = await person("active", superGrant);
        const gone = await person("gone");
        await db.query("update accounts set status = 'deactivated' where id = $1", [gone.id]);
        await admin.setBan(gone.id, true);
        const timed = async (address: string, password: string) => {
          const started = performance.now();
          const result = await signIn({ email: address, password }, signInDeps());
          return { result, ms: performance.now() - started };
        };
        const wrong = await timed(active.address, "not-the-password-1");
        const unknown = await timed(email("nobody"), "whatever-123");
        const deactivated = await timed(gone.address, gone.password);
        for (const outcome of [wrong, unknown, deactivated]) {
          assert.equal(outcome.result.state, "denied");
          assert.equal(outcome.result.code, "SIGN_IN_INVALID");
          assert.equal(outcome.result.presentationCode, wrong.result.presentationCode);
        }
        const spread =
          Math.max(wrong.ms, unknown.ms, deactivated.ms) -
          Math.min(wrong.ms, unknown.ms, deactivated.ms);
        report(
          `sign-in response time for a wrong password, an unknown and a deactivated address in ${schema}: ${wrong.ms.toFixed(0)}, ${unknown.ms.toFixed(0)}, ${deactivated.ms.toFixed(0)} ms (spread ${spread.toFixed(0)} ms, target under 100 ms)`,
        );
      });

      it("locks an address after five wrong passwords, the same for unknown addresses, and a success clears the attempts", async () => {
        const who = await person("lock", superGrant);
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const result = await signIn(
            { email: who.address, password: `wrong-password-${attempt}` },
            signInDeps(),
          );
          assert.equal(result.code, "SIGN_IN_INVALID");
        }
        const locked = await signIn({ email: who.address, password: who.password }, signInDeps());
        assert.equal(locked.state, "denied");
        assert.equal(
          locked.code,
          "SIGN_IN_LOCKED",
          "even the right password is refused while locked",
        );
        let lastUnknown;
        for (let attempt = 0; attempt < 6; attempt += 1)
          lastUnknown = await signIn(
            { email: email("ghost"), password: `wrong-password-${attempt}` },
            signInDeps(),
          );
        assert.equal(
          lastUnknown?.code,
          "SIGN_IN_LOCKED",
          "an unknown address is locked the same way",
        );
        await db.query("delete from sign_in_attempts");
        await clearHookAttempts(who.id);
        const ok = await signIn({ email: who.address, password: who.password }, signInDeps());
        assert.equal(ok.state, "success");
        assert.equal(await appAttempts(who.address), 0, "success clears the attempts");
        assert.equal(await hookAttempts(who.id), 0, "and the account's count in the hook");
      });

      it("stays inside the sign-in time budget (NFR4.1, reported, fails above 5000 ms)", async () => {
        const who = await person("fast", superGrant);
        const started = performance.now();
        const result = await signIn({ email: who.address, password: who.password }, signInDeps());
        const ms = performance.now() - started;
        report(`sign-in on the real stack in ${schema}: ${ms.toFixed(0)} ms (budget 5000 ms)`);
        assert.equal(result.state, "success");
        assert.ok(ms < 5000);
      });

      it("returns a retryable result and creates no session when the sign-in service or the database is unreachable (NFR6.4)", async () => {
        const who = await person("down", superGrant);
        const deadService = createSignInService({
          url: "http://127.0.0.1:1",
          publicKey: settings.publicKey,
        });
        const result = await signIn(
          { email: who.address, password: who.password },
          signInDeps({ service: deadService }),
        );
        assert.equal(result.state, "dependency-failure-retryable");
        const deadAdmin = createAdminAccess({
          url: "http://127.0.0.1:1",
          serviceKey: serviceKey(),
          schema,
        });
        const lockoutDown = await signIn(
          { email: who.address, password: who.password },
          signInDeps({ admin: deadAdmin }),
        );
        assert.equal(lockoutDown.state, "dependency-failure-retryable");
        assert.equal(await count(db, "sign_in_attempts"), 0);
        assert.equal(await count(db, "auth.sessions", `user_id = '${who.id}'`), 0);
      });

      it("runs the housekeeping through the sign-in at most once an hour", async () => {
        const who = await person("house", superGrant);
        let runs = 0;
        const housekeeping = async () => {
          runs += 1;
          const done = await admin.callFunction("identity_housekeeping", {});
          assert.ok(done.ok);
        };
        await signIn({ email: who.address, password: who.password }, signInDeps({ housekeeping }));
        await signIn({ email: who.address, password: who.password }, signInDeps({ housekeeping }));
        assert.equal(runs, 1);
      });
    });

    describe("deactivation and reactivation", () => {
      it("bans the sign-in user, ends its sessions and refuses its token at once; reactivation restores sign-in", async () => {
        const boss = await signedIn("boss", superGrant);
        const target = await signedIn("target", {
          role: "parent",
          scopeType: "family",
          scope: FAMILY_1,
        });
        const deps = { database, admin, events };
        const result = await deactivateAccount(
          boss.caller,
          { accountId: target.id, idempotencyKey: randomUUID() },
          deps,
        );
        assert.equal(result.state, "success");
        assert.equal(result.state === "success" && result.data.followUp, "done");
        assert.equal(await count(db, "auth.sessions", `user_id = '${target.id}'`), 0);
        const dead = await resolveSession(
          { accessToken: target.tokens.accessToken, refreshToken: target.tokens.refreshToken },
          { service, database, now },
        );
        assert.equal(dead.status, "signed-out");
        const refused = await signIn(
          { email: target.address, password: target.password },
          signInDeps(),
        );
        assert.equal(refused.code, "SIGN_IN_INVALID");
        const restored = await reactivateAccount(
          boss.caller,
          { accountId: target.id, idempotencyKey: randomUUID() },
          deps,
        );
        assert.equal(restored.state === "success" && restored.data.followUp, "done");
        const again = await signIn(
          { email: target.address, password: target.password },
          signInDeps(),
        );
        assert.equal(again.state, "success");
        assert.deepEqual(
          lines
            .map((line) => JSON.parse(line).event)
            .filter((event) => event === "deactivation" || event === "reactivation"),
          ["deactivation", "reactivation"],
        );
      });

      it("refuses the account at once even when the follow-up calls to the sign-in service fail, retries them and reports (NFR6.5)", async () => {
        const boss = await signedIn("boss2", superGrant);
        const target = await signedIn("target2", {
          role: "parent",
          scopeType: "family",
          scope: FAMILY_1,
        });
        let banCalls = 0;
        const flaky: AdminAccess = {
          ...admin,
          setBan: async () => {
            banCalls += 1;
            return { ok: false, kind: "unavailable" };
          },
          callFunction: async (name, args) =>
            name === "sessions_remove"
              ? { ok: false, kind: "unavailable" }
              : admin.callFunction(name, args),
        };
        const result = await deactivateAccount(
          boss.caller,
          { accountId: target.id, idempotencyKey: randomUUID() },
          { database, admin: flaky, events },
        );
        assert.equal(result.state === "success" && result.data.followUp, "pending");
        assert.equal(banCalls, 3);
        const dead = await resolveSession(
          { accessToken: target.tokens.accessToken, refreshToken: target.tokens.refreshToken },
          { service, database, now },
        );
        assert.equal(
          dead.status,
          "signed-out",
          "the database refuses the account although the sessions still exist",
        );
        assert.ok(lines.some((line) => JSON.parse(line).event === "follow_up_failed"));
      });

      it("changes a grant through the signed-in admin and applies it on the very next request", async () => {
        const boss = await signedIn("boss3", superGrant);
        const parent = await signedIn("parent3");
        const families = async () =>
          (await probeFamily(parent.tokens.accessToken, FAMILY_1)) === "allowed" ? 1 : 0;
        assert.equal(await families(), 0);
        const added = await changeGrant(
          boss.caller,
          {
            change: "add",
            subjectId: parent.id,
            role: "parent",
            scopeType: "family",
            scopeId: FAMILY_1,
            idempotencyKey: randomUUID(),
          },
          { database, events },
        );
        assert.equal(added.state, "success");
        assert.equal(await families(), 1);
        const refused = await changeGrant(
          parent.caller,
          {
            change: "add",
            subjectId: parent.id,
            role: "parent",
            scopeType: "family",
            scopeId: FAMILY_2,
            idempotencyKey: randomUUID(),
          },
          { database, events },
        );
        assert.equal(refused.state, "denied");
        assert.equal(ADMIN_G1.length + GROUP_1.length > 0, true);
      });
    });

    describe("invitations end to end", () => {
      const deps = (overrides: Partial<Parameters<typeof createInvitation>[2]> = {}) => ({
        service,
        admin,
        database,
        mailer,
        events,
        appPublicUrl: APP_URL,
        ...overrides,
      });
      const input = (address: string, key = randomUUID()) => ({
        email: address,
        role: "parent",
        scopeType: "family",
        scopeId: FAMILY_1,
        idempotencyKey: key,
      });
      const tokenFromMail = (mail: Mail): string => {
        const match = /\/meghivas\/([A-Za-z0-9_-]{43})/.exec(mail.text);
        assert.ok(match, "the mail carries the link");
        return match![1]!;
      };

      it("creates an invitation, mails the link through the mail server, opens it, accepts it, signs the person in and applies the grant", async () => {
        const boss = await signedIn("inviter", superGrant);
        const address = email("newparent");
        await forgetMail(address);
        const created = await createInvitation(boss.caller, input(address), deps());
        assert.equal(created.state, "success");
        const [mail] = await mailTo(address);
        assert.ok(mail, "the invitation arrived at the mail server");
        const token = tokenFromMail(mail!);
        assert.ok(mail!.text.includes(invitationLink(APP_URL, token)));
        assert.equal(await count(db, "invitations", `token_hash = '${hashToken(token)}'`), 1);
        assert.equal(
          await count(db, "invitations", `token_hash = '${token}'`),
          0,
          "only the hash is stored",
        );
        assert.deepEqual(await lookupInvitation(token, deps()), {
          validity: "valid",
          role: "parent",
          scopeType: "family",
        });
        const password = secret();
        const accepted = await acceptInvitation(
          { token, password, idempotencyKey: randomUUID() },
          deps(),
        );
        assert.equal(accepted.state, "success");
        assert.ok(
          accepted.state === "success" && accepted.data.tokens,
          "signed in after accepting",
        );
        const account = (
          await db.query("select id, organization_id from accounts where email = $1", [address])
        ).rows[0];
        assert.equal(account.organization_id, ORGANIZATION);
        const session = await resolveSession(
          accepted.state === "success" ? accepted.data.tokens! : undefined,
          { service, database, now },
        );
        assert.equal(session.status, "signed-in");
        assert.equal(
          await probeFamily(
            accepted.state === "success" ? accepted.data.tokens!.accessToken : "",
            FAMILY_1,
          ),
          "allowed",
        );
        const again = await acceptInvitation(
          { token, password, idempotencyKey: randomUUID() },
          deps(),
        );
        assert.equal(again.state, "denied", "a second submit on an accepted link is not valid");
        assert.deepEqual(await lookupInvitation(token, deps()), { validity: "not_valid" });
        assert.equal((await signIn({ email: address, password }, signInDeps())).state, "success");
      });

      it("returns the stored success for a repeated key and lets the person sign in", async () => {
        const boss = await signedIn("inviter2", superGrant);
        const address = email("repeat");
        await forgetMail(address);
        await createInvitation(boss.caller, input(address), deps());
        const token = tokenFromMail((await mailTo(address))[0]!);
        const key = randomUUID();
        const password = secret();
        const first = await acceptInvitation({ token, password, idempotencyKey: key }, deps());
        const repeat = await acceptInvitation({ token, password, idempotencyKey: key }, deps());
        assert.equal(first.state, "success");
        assert.equal(repeat.state, "success");
        assert.equal(await count(db, "accounts", `email = '${address}'`), 1);
        assert.equal((await signIn({ email: address, password }, signInDeps())).state, "success");
      });

      it("leaves nothing behind when acceptance fails midway, removes the new sign-in user, and a retry succeeds (NFR6.2)", async () => {
        const boss = await signedIn("inviter3", superGrant);
        const address = email("flaky");
        await forgetMail(address);
        await createInvitation(boss.caller, input(address), deps());
        const token = tokenFromMail((await mailTo(address))[0]!);
        await db.query(
          "create function fail_account_insert() returns trigger language plpgsql as $$ begin raise exception 'injected failure'; end $$",
        );
        await db.query(
          "create trigger inject_account_failure before insert on accounts for each row execute function fail_account_insert()",
        );
        try {
          const failed = await acceptInvitation(
            { token, password: secret(), idempotencyKey: randomUUID() },
            deps(),
          );
          assert.equal(failed.state, "dependency-failure-retryable");
        } finally {
          await db.query("drop trigger inject_account_failure on accounts");
          await db.query("drop function fail_account_insert()");
        }
        assert.equal(await count(db, "accounts", `email = '${address}'`), 0);
        assert.equal(
          await count(db, "auth.users", `email = '${address}'`),
          0,
          "the new sign-in user was removed",
        );
        assert.equal(
          (
            await db.query("select status from invitations where token_hash = $1", [
              hashToken(token),
            ])
          ).rows[0].status,
          "pending",
        );
        const retried = await acceptInvitation(
          { token, password: secret(), idempotencyKey: randomUUID() },
          deps(),
        );
        assert.equal(retried.state, "success");
      });

      it("reuses a leftover sign-in user when its removal failed, and never deletes a user that has an Account", async () => {
        const boss = await signedIn("inviter4", superGrant);
        const address = email("leftover");
        await forgetMail(address);
        await createInvitation(boss.caller, input(address), deps());
        const token = tokenFromMail((await mailTo(address))[0]!);
        const stuck: AdminAccess = {
          ...admin,
          deleteUser: async () => ({ ok: false, kind: "unavailable" }),
        };
        await db.query(
          "create function fail_account_insert() returns trigger language plpgsql as $$ begin raise exception 'injected failure'; end $$",
        );
        await db.query(
          "create trigger inject_account_failure before insert on accounts for each row execute function fail_account_insert()",
        );
        try {
          await acceptInvitation(
            { token, password: secret(), idempotencyKey: randomUUID() },
            deps({ admin: stuck }),
          );
        } finally {
          await db.query("drop trigger inject_account_failure on accounts");
          await db.query("drop function fail_account_insert()");
        }
        const leftover = (await db.query("select id from auth.users where email = $1", [address]))
          .rows;
        assert.equal(leftover.length, 1, "the user that could not be deleted is still there");
        const password = secret();
        const retried = await acceptInvitation(
          { token, password, idempotencyKey: randomUUID() },
          deps(),
        );
        assert.equal(retried.state, "success");
        const account = (await db.query("select id from accounts where email = $1", [address]))
          .rows[0];
        assert.equal(account.id, leftover[0].id, "the leftover user was reused");
        assert.equal((await signIn({ email: address, password }, signInDeps())).state, "success");
        // Housekeeping never removes a user that has an Account, however old it is.
        await db.query(
          "update auth.users set created_at = now() - interval '3 hours' where id = $1",
          [account.id],
        );
        await admin.callFunction("identity_housekeeping", {});
        assert.equal(await count(db, "auth.users", `id = '${account.id}'`), 1);
      });

      it("never deletes a sign-in user whose Account was committed when the accept answer is lost and the follow-up calls fail", async () => {
        const boss = await signedIn("inviter-lost", superGrant);
        const address = email("lostanswer");
        await forgetMail(address);
        await createInvitation(boss.caller, input(address), deps());
        const token = tokenFromMail((await mailTo(address))[0]!);
        const lossy: AdminAccess = {
          ...admin,
          callFunction: async (name, args) => {
            if (name === "invitation_accept") {
              await admin.callFunction(name, args); // the transaction commits, the answer is lost
              return { ok: false, kind: "unavailable" };
            }
            if (name === "invitation_release" || name === "invitation_lookup") {
              return { ok: false, kind: "unavailable" };
            }
            return admin.callFunction(name, args);
          },
        };
        const password = secret();
        const result = await acceptInvitation(
          { token, password, idempotencyKey: randomUUID() },
          deps({ admin: lossy }),
        );
        assert.equal(result.state, "dependency-failure-retryable");
        const account = (await db.query("select id from accounts where email = $1", [address]))
          .rows[0];
        assert.ok(account, "the Account was committed");
        assert.equal(
          await count(db, "auth.users", `id = '${account.id}'`),
          1,
          "its sign-in user is kept",
        );
        assert.ok(lines.some((line) => JSON.parse(line).code === "delete_user_unproven"));
        assert.equal((await signIn({ email: address, password }, signInDeps())).state, "success");
      });

      it("lets exactly one of two simultaneous submits create the account (concurrent double submit)", async () => {
        const boss = await signedIn("inviter5", superGrant);
        const address = email("double");
        await forgetMail(address);
        await createInvitation(boss.caller, input(address), deps());
        const token = tokenFromMail((await mailTo(address))[0]!);
        const [a, b] = await Promise.all([
          acceptInvitation({ token, password: secret(), idempotencyKey: randomUUID() }, deps()),
          acceptInvitation({ token, password: secret(), idempotencyKey: randomUUID() }, deps()),
        ]);
        assert.equal([a, b].filter((result) => result.state === "success").length, 1);
        assert.ok(
          [a, b].some(
            (result) =>
              result.state === "dependency-failure-retryable" || result.state === "denied",
          ),
        );
        assert.equal(await count(db, "accounts", `email = '${address}'`), 1);
        assert.equal(await count(db, "auth.users", `email = '${address}'`), 1);
      });

      it("treats an expired link as no longer valid, and resend and revoke work as the admin", async () => {
        const boss = await signedIn("inviter6", superGrant);
        const address = email("expiring");
        await forgetMail(address);
        const created = await createInvitation(boss.caller, input(address), deps());
        assert.ok(created.state === "success");
        const token = tokenFromMail((await mailTo(address))[0]!);
        await db.query(
          "update invitations set created_at = now() - interval '9 days', expires_at = now() - interval '2 days' where id = $1",
          [created.data.invitationId],
        );
        assert.deepEqual(await lookupInvitation(token, deps()), { validity: "expired" });
        const refused = await acceptInvitation(
          { token, password: secret(), idempotencyKey: randomUUID() },
          deps(),
        );
        assert.equal(refused.state, "denied");
        assert.ok(lines.some((line) => JSON.parse(line).event === "invitation_expired"));
        const resent = await resendInvitation(
          boss.caller,
          { invitationId: created.data.invitationId, email: address, idempotencyKey: randomUUID() },
          deps(),
        );
        assert.equal(resent.state, "success");
        const mails = await mailTo(address, 2);
        assert.equal(mails.length, 2);
        const newToken = mails.map(tokenFromMail).find((candidate) => candidate !== token)!;
        assert.equal((await lookupInvitation(newToken, deps())).validity, "valid");
        assert.equal(
          (await lookupInvitation(token, deps())).validity,
          "not_valid",
          "the replaced link is refused",
        );
        assert.ok(resent.state === "success");
        const revoked = await revokeInvitation(
          boss.caller,
          { invitationId: resent.data.invitationId, idempotencyKey: randomUUID() },
          deps(),
        );
        assert.equal(revoked.state, "success");
        assert.equal((await lookupInvitation(newToken, deps())).validity, "not_valid");
      });

      it("keeps the stored invitation and says the email was not sent when the mail server is unreachable, then resends (NFR6.8)", async () => {
        const boss = await signedIn("inviter7", superGrant);
        const address = email("nomail");
        await forgetMail(address);
        const brokenMailer = createInvitationMailer({
          transport: createSmtpTransport({ host: "127.0.0.1", port: 1 }),
          from: "noreply@example.test",
        });
        const created = await createInvitation(
          boss.caller,
          input(address),
          deps({ mailer: brokenMailer }),
        );
        assert.equal(created.state, "dependency-failure-retryable");
        assert.equal(created.code, "INVITATION_MAIL_NOT_SENT");
        const invitationId = created.evidenceId!;
        assert.equal(
          (await db.query("select status from invitations where id = $1", [invitationId])).rows[0]
            .status,
          "pending",
        );
        const resent = await resendInvitation(
          boss.caller,
          { invitationId, email: address, idempotencyKey: randomUUID() },
          deps(),
        );
        assert.equal(resent.state, "success");
        assert.equal((await mailTo(address)).length, 1);
      });

      it("refuses a second open invitation, a group admin outside their group and an account that already exists", async () => {
        const boss = await signedIn("inviter8", superGrant);
        const address = email("dup");
        await forgetMail(address);
        assert.equal(
          (await createInvitation(boss.caller, input(address), deps())).state,
          "success",
        );
        assert.equal(
          (await createInvitation(boss.caller, input(address), deps())).state,
          "conflict",
        );
        const groupAdmin = await signedIn("ga", {
          role: "group_admin",
          scopeType: "group",
          scope: GROUP_1,
        });
        const outside = await createInvitation(
          groupAdmin.caller,
          { ...input(email("outside")), scopeId: FAMILY_2 },
          deps(),
        );
        assert.equal(outside.state, "denied");
        const token = tokenFromMail((await mailTo(address))[0]!);
        const taken = await person("taken");
        await db.query("update invitations set email = $1 where token_hash = $2", [
          taken.address,
          hashToken(token),
        ]);
        const exists = await acceptInvitation(
          { token, password: secret(), idempotencyKey: randomUUID() },
          deps(),
        );
        assert.equal(
          exists.state,
          "denied",
          "an existing Account is told apart internally, but the person sees not valid",
        );
      });
    });

    describe("password reset", () => {
      const resetDeps = () => ({ service, admin, events, emailKeySecret: SESSION_SECRET });
      const hashFromMail = (mail: Mail) => {
        const match =
          /\/jelszo-visszaallitas\/uj\?token_hash=([A-Za-z0-9_-]+)&(?:amp;)?type=recovery/.exec(
            mail.text,
          );
        assert.ok(match, "the recovery mail links to the app's reset page");
        return match![1]!;
      };

      it("mails a link to the app's page for an active account, and nothing for an unknown or a deactivated address", async () => {
        const who = await person("resetter", superGrant);
        const gone = await person("resetgone");
        await db.query("update accounts set status = 'deactivated' where id = $1", [gone.id]);
        for (const address of [who.address, gone.address, email("nobody-here")])
          await forgetMail(address);
        const answers = [];
        for (const address of [who.address, gone.address, email("nobody-here")])
          answers.push(await requestPasswordReset(address, resetDeps()));
        assert.deepEqual(
          answers.map((answer) => answer.state),
          ["success", "success", "success"],
        );
        assert.deepEqual(answers[0], answers[1]);
        assert.deepEqual(answers[1], answers[2]);
        const [mail] = await mailTo(who.address);
        assert.ok(mail);
        assert.ok(
          mail!.text.includes(`${APP_URL}/jelszo-visszaallitas/uj?token_hash=`),
          "the link points at the app, not at the sign-in service",
        );
        assert.equal((await mailTo(gone.address, 0)).length, 0);
        assert.equal((await mailTo(email("nobody-here"), 0)).length, 0);
      });

      it("answers a reset request in the same time for an unknown, a deactivated and an active address (reported, target under 100 ms)", async () => {
        const active = await person("timing-active", superGrant);
        const gone = await person("timing-gone");
        await db.query("update accounts set status = 'deactivated' where id = $1", [gone.id]);
        const tasks: Promise<void>[] = [];
        const deferred = {
          ...resetDeps(),
          defer: (task: () => Promise<void>) => void tasks.push(task()),
        };
        const times: number[] = [];
        for (const address of [email("timing-nobody"), gone.address, active.address]) {
          await forgetMail(address);
          const started = performance.now();
          const answer = await requestPasswordReset(address, deferred);
          times.push(performance.now() - started);
          assert.equal(answer.state, "success");
        }
        await Promise.all(tasks);
        const spread = Math.max(...times) - Math.min(...times);
        report(
          `reset request response time for an unknown, a deactivated and an active address in ${schema}: ${times.map((time) => time.toFixed(1)).join(", ")} ms (spread ${spread.toFixed(1)} ms, target under 100 ms)`,
        );
        assert.ok(spread < 100);
        assert.equal((await mailTo(active.address)).length, 1, "the deferred mail was sent");
        assert.equal((await mailTo(gone.address, 0)).length, 0);
      });

      it("uses the code once: a new password, other sessions ended, attempts cleared, the old password dead, the person signed in", async () => {
        const who = await person("resetter2", superGrant);
        await forgetMail(who.address);
        const other = await signIn({ email: who.address, password: who.password }, signInDeps());
        assert.ok(other.state === "success");
        for (let attempt = 0; attempt < 3; attempt += 1)
          await signIn({ email: who.address, password: `wrong-password-${attempt}` }, signInDeps());
        assert.equal(await appAttempts(who.address), 3);
        assert.equal(await hookAttempts(who.id), 3, "the sign-in service's own count");
        await requestPasswordReset(who.address, resetDeps());
        const tokenHash = hashFromMail((await mailTo(who.address))[0]!);
        const newPassword = secret();
        const result = await completePasswordReset(
          { tokenHash, password: newPassword },
          resetDeps(),
        );
        assert.equal(result.state, "success");
        assert.ok(result.state === "success");
        assert.equal(await appAttempts(who.address), 0);
        // The hook counts in the default schema (the one it is wired to); the admin function that clears it
        // runs in the schema under test, so this part is checked where both are the same.
        if (schema === "public") {
          assert.equal(
            await hookAttempts(who.id),
            0,
            "the reset clears the sign-in service's count too",
          );
        }
        assert.equal(
          await count(db, "auth.sessions", `user_id = '${who.id}'`),
          1,
          "only the new session remains",
        );
        const old = await resolveSession(
          { accessToken: other.data.accessToken, refreshToken: other.data.refreshToken },
          { service, database, now },
        );
        assert.equal(old.status, "signed-out");
        const current = await resolveSession(result.data.tokens, { service, database, now });
        assert.equal(current.status, "signed-in");
        assert.equal(
          (await signIn({ email: who.address, password: who.password }, signInDeps())).code,
          "SIGN_IN_INVALID",
        );
        assert.equal(
          (await signIn({ email: who.address, password: newPassword }, signInDeps())).state,
          "success",
        );
        const reuse = await completePasswordReset({ tokenHash, password: secret() }, resetDeps());
        assert.equal(reuse.state, "denied", "the link works once");
        assert.equal(reuse.code, "RESET_NOT_VALID");
      });

      it("does not spend the code for a password that breaks the rule, and refuses an expired code", async () => {
        const who = await person("resetter3", superGrant);
        await forgetMail(who.address);
        await requestPasswordReset(who.address, resetDeps());
        const tokenHash = hashFromMail((await mailTo(who.address))[0]!);
        const weak = await completePasswordReset({ tokenHash, password: "weak" }, resetDeps());
        assert.equal(weak.state, "validation");
        // The code is still good after the rejected attempt; now let it expire with a controllable clock.
        await db.query(
          "update auth.users set recovery_sent_at = now() - interval '2 hours' where id = $1",
          [who.id],
        );
        await db.query(
          "update auth.one_time_tokens set created_at = now() - interval '2 hours' where user_id = $1",
          [who.id],
        );
        const expired = await completePasswordReset({ tokenHash, password: secret() }, resetDeps());
        assert.equal(expired.state, "denied");
      });

      it("returns a retryable result when the sign-in service is unreachable", async () => {
        const dead = createSignInService({
          url: "http://127.0.0.1:1",
          publicKey: settings.publicKey,
        });
        const result = await completePasswordReset(
          { tokenHash: "a".repeat(40), password: secret() },
          { ...resetDeps(), service: dead },
        );
        assert.equal(result.state, "dependency-failure-retryable");
      });
    });

    describe("logs never carry secrets (NFR1.6, NFR1.18)", () => {
      it("writes no address, password, token, link or session value into any event line", async () => {
        const boss = await signedIn("logger", superGrant);
        const address = email("logged");
        await forgetMail(address);
        await createInvitation(
          boss.caller,
          {
            email: address,
            role: "parent",
            scopeType: "family",
            scopeId: FAMILY_1,
            idempotencyKey: randomUUID(),
          },
          {
            service,
            admin,
            database,
            mailer,
            events,
            appPublicUrl: APP_URL,
            newToken: generateToken,
          },
        );
        const token = /\/meghivas\/([A-Za-z0-9_-]{43})/.exec((await mailTo(address))[0]!.text)![1]!;
        const password = secret();
        await acceptInvitation(
          { token, password, idempotencyKey: randomUUID() },
          { service, admin, database, mailer, events, appPublicUrl: APP_URL },
        );
        await signIn({ email: address, password: "wrong-password-1" }, signInDeps());
        await requestPasswordReset(address, {
          service,
          admin,
          events,
          emailKeySecret: SESSION_SECRET,
        });
        const text = lines.join("\n");
        assert.ok(lines.length >= 4, "events were written");
        for (const value of [
          address,
          "example.test",
          password,
          "wrong-password-1",
          token,
          boss.tokens.accessToken,
          boss.tokens.refreshToken,
          SESSION_SECRET,
          serviceKey(),
        ]) {
          assert.equal(text.includes(value), false, `an event line contains ${value.slice(0, 6)}…`);
        }
        for (const line of lines) {
          const parsed = JSON.parse(line) as Record<string, string>;
          assert.ok(parsed.event && parsed.at);
          assert.deepEqual(
            Object.keys(parsed).filter((key) => !["event", "at", "subject", "code"].includes(key)),
            [],
          );
        }
      });
    });
  });
}
