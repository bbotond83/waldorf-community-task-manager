import { randomBytes, randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import type pg from "pg";
import { createAdminAccess } from "../../src/identity/admin-client.ts";
import { COPY } from "../../src/identity/copy.ts";
import { createInvitation } from "../../src/identity/invitations.ts";
import { createInvitationMailer, createSmtpTransport } from "../../src/identity/mail.ts";
import { createSignInService } from "../../src/identity/service.ts";
import { createDatabaseClient } from "../../src/runtime/database/client.ts";
import {
  lockSchemas,
  openDatabase,
  prepareSchema,
  serviceKey,
  stackSettings,
} from "../database/stack-support.ts";
import { bindSeededSchema, expectSignedIn, openLinkSignedOut } from "./support/seeded-schema.ts";

/**
 * The four identity screens and the sign-out control against the real local stack, with the automated
 * accessibility scan on each screen in its success and error states (BR2.20, NFR5.1, NFR5.2, NFR7.2).
 * The servers started by playwright.config.ts use the schema named below, so these tests never touch the
 * data of the other database tests.
 */
// The schema of the running browser project (tests/browser/support/projects.ts); known once the first hook has run.
let SCHEMA = "";
const world = bindSeededSchema({ seed: false });
const ORGANIZATION = "aaaaaaaa-0000-4000-8000-000000000001";
const FAMILY = "cccccccc-0000-4000-8000-000000000201";
const GROUP = "cccccccc-0000-4000-8000-000000000101";
const MAIL_API = "http://127.0.0.1:54324/api/v1";

const settings = stackSettings();
const apiUrl = settings.apiUrl.replace(/\/$/, "");
let admin: ReturnType<typeof createAdminAccess>;
const service = createSignInService({ url: apiUrl, publicKey: settings.publicKey });
let database: ReturnType<typeof createDatabaseClient>;
const mailer = createInvitationMailer({
  transport: createSmtpTransport({ host: "127.0.0.1", port: 54325 }),
  from: "no-reply@example.test",
});

let db: pg.Client;
const password = () => `Pw-${randomBytes(6).toString("hex")}-1`;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  SCHEMA = world().schema;
  admin = createAdminAccess({ url: apiUrl, serviceKey: serviceKey(), schema: SCHEMA });
  database = createDatabaseClient({
    url: apiUrl,
    publicKey: settings.publicKey,
    sessionSecret: randomBytes(32).toString("hex"),
    schema: SCHEMA,
  });
  db = await openDatabase();
  await lockSchemas(db, [SCHEMA]);
  await prepareSchema(db, SCHEMA);
  await db.query(`set search_path to "${SCHEMA}", pg_catalog`);
  const YEAR = "cccccccc-0000-4000-8000-000000000501";
  await db.query("insert into organizations (id, name) values ($1, 'Teszt iskola')", [
    ORGANIZATION,
  ]);
  await db.query(
    "insert into school_years (id, organization_id, name, starts_on, ends_on) values ($1, $2, '2026/2027', '2026-09-01', '2027-06-30')",
    [YEAR, ORGANIZATION],
  );
  await db.query(
    "insert into groups (id, organization_id, school_year_id, name) values ($1, $2, $3, 'Boróka')",
    [GROUP, ORGANIZATION, YEAR],
  );
  await db.query(
    "insert into families (id, organization_id, display_name) values ($1, $2, 'Fenyő család')",
    [FAMILY, ORGANIZATION],
  );
  await db.query(
    "insert into group_memberships (organization_id, family_id, group_id) values ($1, $2, $3)",
    [ORGANIZATION, FAMILY, GROUP],
  );
});
test.afterAll(async () => {
  await db.end();
});

function tag(name: string, projectName: string): string {
  return `${SCHEMA}.${name}-${projectName.replace(/[^a-z]/g, "")}-${randomBytes(3).toString("hex")}@example.test`;
}

async function newUser(
  address: string,
  grant?: { role: string; scopeType: string; scope: string },
  options: { linkParent?: boolean } = {},
) {
  const secret = password();
  const created = await admin.createUser({
    email: address,
    password: secret,
    invitationId: "browser-test",
  });
  if (!created.ok) throw new Error("the sign-in service did not create the test user");
  await db.query("update auth.users set raw_app_meta_data = '{}'::jsonb where id = $1", [
    created.value.id,
  ]);
  await db.query("insert into accounts (id, email, organization_id) values ($1, $2, $3)", [
    created.value.id,
    address,
    ORGANIZATION,
  ]);
  if (grant) {
    await db.query(
      "insert into app_role_grants (subject_id, role, scope_type, scope_id, organization_id) values ($1, $2, $3, $4, $5)",
      [created.value.id, grant.role, grant.scopeType, grant.scope, ORGANIZATION],
    );
    await db.query(
      "insert into app_authorization_versions (subject_id, authorization_version) values ($1, 1) on conflict do nothing",
      [created.value.id],
    );
    // A parent's home page needs the parent record linked to the account; without it the page denies access.
    if (grant.role === "parent" && options.linkParent !== false) {
      await db.query(
        "insert into parents (organization_id, family_id, account_id, display_name) values ($1, $2, $3, 'Teszt Szülő')",
        [ORGANIZATION, grant.scope, created.value.id],
      );
    }
  }
  return { id: created.value.id, address, password: secret };
}

async function mailFor(address: string): Promise<{ text: string }> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const list = (await (
      await fetch(`${MAIL_API}/search?query=${encodeURIComponent(`to:${address}`)}`)
    ).json()) as { messages: { ID: string }[] };
    if (list.messages[0]) {
      const full = (await (await fetch(`${MAIL_API}/message/${list.messages[0].ID}`)).json()) as {
        Text: string;
      };
      return { text: full.Text };
    }
    if (Date.now() > deadline) throw new Error("no mail arrived");
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

async function noSeriousViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious.map((violation) => `${label}: ${violation.id}`)).toEqual([]);
}

/**
 * Fills the fields and submits. A submit that reaches the server is awaited until the server answered, so
 * two submits with the same message in a row are told apart; pass `client: true` for a submit that the
 * screen itself refuses (a rule error shown before anything is sent).
 */
async function fillAndSubmit(
  page: Page,
  fields: Record<string, string>,
  submit: string,
  options: { client?: boolean } = {},
) {
  for (const [testId, value] of Object.entries(fields)) await page.getByTestId(testId).fill(value);
  if (options.client) {
    await page.getByTestId(submit).click();
    return;
  }
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST"),
    page.getByTestId(submit).click(),
  ]);
}

test("the sign-in screen is Hungarian, labelled and shows its field errors and the generic error accessibly", async ({
  page,
}, testInfo) => {
  const user = await newUser(tag("signin", testInfo.project.name), {
    role: "parent",
    scopeType: "family",
    scope: FAMILY,
  });
  await page.goto("/bejelentkezes");
  await expect(page).toHaveTitle(COPY.signIn.title);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(COPY.signIn.heading);
  await expect(page.getByLabel(COPY.signIn.emailLabel)).toBeVisible();
  await expect(page.getByLabel(COPY.signIn.passwordLabel)).toBeVisible();
  await noSeriousViolations(page, "sign-in initial");

  await page.getByTestId("sign-in-submit").click();
  await expect(page.getByTestId("sign-in-email-error")).toHaveText(COPY.signIn.emailRequired);
  await expect(page.getByTestId("sign-in-password-error")).toHaveText(COPY.signIn.passwordRequired);
  await expect(page.getByTestId("sign-in-email")).toHaveAttribute("aria-invalid", "true");
  await noSeriousViolations(page, "sign-in field errors");

  await fillAndSubmit(
    page,
    { "sign-in-email": user.address, "sign-in-password": "wrong-password-1" },
    "sign-in-submit",
  );
  const error = page.getByTestId("sign-in-error");
  await expect(error).toHaveText(COPY.signIn.invalid);
  await expect(error).toHaveAttribute("role", "alert");
  await expect(page.getByTestId("sign-in-email")).toHaveValue(user.address);
  await expect(page.getByTestId("sign-in-password")).toHaveValue("");
  await noSeriousViolations(page, "sign-in generic error");
  // An unknown address gets exactly the same message.
  await fillAndSubmit(
    page,
    {
      "sign-in-email": tag("ghost", testInfo.project.name),
      "sign-in-password": "wrong-password-1",
    },
    "sign-in-submit",
  );
  await expect(page.getByTestId("sign-in-error")).toHaveText(COPY.signIn.invalid);
});

test("signing in sets httpOnly sameSite cookies, shows the signed-in state, and sign-out ends only this session", async ({
  page,
  context,
}, testInfo) => {
  const user = await newUser(tag("session", testInfo.project.name), {
    role: "parent",
    scopeType: "family",
    scope: FAMILY,
  });
  await page.goto("/bejelentkezes");
  await fillAndSubmit(
    page,
    { "sign-in-email": user.address, "sign-in-password": user.password },
    "sign-in-submit",
  );
  await expectSignedIn(page);
  await expect(page).toHaveURL(/\/szulo\/ertesitesek$/);
  await noSeriousViolations(page, "signed in");

  const cookies = (await context.cookies()).filter((cookie) => cookie.name.startsWith("wb_"));
  expect(cookies.map((cookie) => cookie.name).sort()).toEqual(["wb_access", "wb_refresh"]);
  for (const cookie of cookies) {
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("Lax");
    expect(cookie.secure).toBe(false); // served over http locally; the unit test proves secure over https
  }
  expect(await page.evaluate(() => document.cookie)).not.toContain("wb_");

  const other = await service.passwordSignIn(user.address, user.password);
  expect(other.ok).toBe(true);
  await page.getByTestId("sign-out-button").click();
  await expect(page.getByTestId("sign-in-form")).toBeVisible();
  expect(
    (await context.cookies()).filter(
      (cookie) => cookie.name.startsWith("wb_") && cookie.value !== "",
    ),
  ).toEqual([]);
  const remaining = await db.query(
    "select count(*)::int as n from auth.sessions where user_id = $1",
    [user.id],
  );
  expect(remaining.rows[0].n).toBe(1);
});

test("an expired access cookie with a live refresh cookie stays signed in: the proxy renews the session", async ({
  page,
  context,
}, testInfo) => {
  const user = await newUser(tag("renew", testInfo.project.name), {
    role: "parent",
    scopeType: "family",
    scope: FAMILY,
  });
  await page.goto("/bejelentkezes");
  await fillAndSubmit(
    page,
    { "sign-in-email": user.address, "sign-in-password": user.password },
    "sign-in-submit",
  );
  await expectSignedIn(page);
  const before = (await context.cookies()).find((cookie) => cookie.name === "wb_access")!;
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const expired = `${encode({ alg: "none" })}.${encode({ sub: user.id, exp: Math.floor(Date.now() / 1000) - 120 })}.x`;
  await context.addCookies([{ ...before, value: expired }]);
  await page.reload();
  await expectSignedIn(page);
  const after = (await context.cookies()).find((cookie) => cookie.name === "wb_access")!;
  expect(after.value).not.toBe(expired);
  expect(after.httpOnly).toBe(true);
  // A refresh token the service no longer knows ends the session: the cookies are cleared.
  await db.query("delete from auth.sessions where user_id = $1", [user.id]);
  await context.addCookies([{ ...after, value: expired }]);
  await page.goto("/bejelentkezes");
  await expect(page.getByTestId("sign-in-form")).toBeVisible();
  expect(
    (await context.cookies()).filter(
      (cookie) => cookie.name.startsWith("wb_") && cookie.value !== "",
    ),
  ).toEqual([]);
});

test("two people signed in at once in two browser contexts keep independent sessions", async ({
  browser,
  baseURL,
}, testInfo) => {
  const first = await newUser(tag("one", testInfo.project.name), {
    role: "parent",
    scopeType: "family",
    scope: FAMILY,
  });
  const second = await newUser(tag("two", testInfo.project.name), {
    role: "kindergarten_teacher",
    scopeType: "group",
    scope: GROUP,
  });
  const contexts: BrowserContext[] = [
    await browser.newContext({ baseURL }),
    await browser.newContext({ baseURL }),
  ];
  try {
    const pages = await Promise.all(contexts.map((context) => context.newPage()));
    for (const [index, user] of [first, second].entries()) {
      await pages[index]!.goto("/bejelentkezes");
      await fillAndSubmit(
        pages[index]!,
        { "sign-in-email": user.address, "sign-in-password": user.password },
        "sign-in-submit",
      );
      await expectSignedIn(pages[index]!);
    }
    await pages[0]!.getByTestId("sign-out-button").click();
    await expect(pages[0]!.getByTestId("sign-in-form")).toBeVisible();
    await pages[1]!.reload();
    await expectSignedIn(pages[1]!);
    const sessions = await db.query("select user_id from auth.sessions where user_id = any($1)", [
      [first.id, second.id],
    ]);
    expect(sessions.rows.map((row) => row.user_id)).toEqual([second.id]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test("five wrong passwords lock the screen with the try-again-later message", async ({
  page,
}, testInfo) => {
  const user = await newUser(tag("lock", testInfo.project.name), {
    role: "parent",
    scopeType: "family",
    scope: FAMILY,
  });
  await page.goto("/bejelentkezes");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await fillAndSubmit(
      page,
      { "sign-in-email": user.address, "sign-in-password": `wrong-password-${attempt}` },
      "sign-in-submit",
    );
    await expect(page.getByTestId("sign-in-error")).toHaveText(COPY.signIn.invalid);
  }
  await fillAndSubmit(
    page,
    { "sign-in-email": user.address, "sign-in-password": user.password },
    "sign-in-submit",
  );
  await expect(page.getByTestId("sign-in-error")).toHaveText(COPY.signIn.locked);
  await noSeriousViolations(page, "sign-in locked");
  await db.query("delete from sign_in_attempts");
});

test("an invitation link: the valid page, the rule error, acceptance and the not-valid pages", async ({
  page,
  baseURL,
}, testInfo) => {
  const boss = await newUser(tag("boss", testInfo.project.name), {
    role: "super_admin",
    scopeType: "organization",
    scope: ORGANIZATION,
  });
  const session = await service.passwordSignIn(boss.address, boss.password);
  if (!session.ok) throw new Error("the inviter could not sign in");
  const address = tag("invitee", testInfo.project.name);
  const created = await createInvitation(
    { accessToken: session.value.accessToken, accountId: boss.id },
    {
      email: address,
      role: "parent",
      scopeType: "family",
      scopeId: FAMILY,
      idempotencyKey: randomUUID(),
    },
    { service, admin, database, mailer, events: { emit: () => undefined }, appPublicUrl: baseURL! },
  );
  expect(created.state).toBe("success");
  const link = /(http:\/\/\S+\/meghivas\/[A-Za-z0-9_-]{43})/.exec(
    (await mailFor(address)).text,
  )![1]!;

  await page.goto(link);
  await expect(page).toHaveTitle(/.+/);
  await expect(page.getByTestId("real-invitation-valid")).toBeVisible();
  await expect(page.getByTestId("real-invitation-details")).toContainText(
    COPY.invitation.roles.parent!,
  );
  await expect(page.getByTestId("real-invitation-details")).toContainText(
    COPY.invitation.scopes.family!,
  );
  await noSeriousViolations(page, "invitation valid");

  await fillAndSubmit(
    page,
    { "accept-invitation-password": "short1" },
    "accept-invitation-submit",
    {
      client: true,
    },
  );
  await expect(page.getByTestId("accept-invitation-field-error")).toHaveText(
    COPY.password.ruleError,
  );
  await expect(page.getByTestId("accept-invitation-password")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await noSeriousViolations(page, "invitation rule error");

  await fillAndSubmit(
    page,
    { "accept-invitation-password": password() },
    "accept-invitation-submit",
  );
  await expectSignedIn(page);
  const accounts = await db.query("select count(*)::int as n from accounts where email = $1", [
    address,
  ]);
  expect(accounts.rows[0].n).toBe(1);

  await openLinkSignedOut(page, link);
  await expect(page.getByTestId("real-invitation-not-valid-message")).toHaveText(
    COPY.invitation.notValid,
  );
  await noSeriousViolations(page, "invitation used");
});

test("an expired invitation link shows the not-valid message", async ({
  page,
  baseURL,
}, testInfo) => {
  const boss = await newUser(tag("boss2", testInfo.project.name), {
    role: "super_admin",
    scopeType: "organization",
    scope: ORGANIZATION,
  });
  const session = await service.passwordSignIn(boss.address, boss.password);
  if (!session.ok) throw new Error("the inviter could not sign in");
  const address = tag("late", testInfo.project.name);
  const created = await createInvitation(
    { accessToken: session.value.accessToken, accountId: boss.id },
    {
      email: address,
      role: "parent",
      scopeType: "family",
      scopeId: FAMILY,
      idempotencyKey: randomUUID(),
    },
    { service, admin, database, mailer, events: { emit: () => undefined }, appPublicUrl: baseURL! },
  );
  expect(created.state).toBe("success");
  const link = /(http:\/\/\S+\/meghivas\/[A-Za-z0-9_-]{43})/.exec(
    (await mailFor(address)).text,
  )![1]!;
  await db.query(
    "update invitations set created_at = now() - interval '9 days', expires_at = now() - interval '2 days' where email = $1",
    [address],
  );
  await page.goto(link);
  await expect(page.getByTestId("real-invitation-not-valid-message")).toHaveText(
    COPY.invitation.notValid,
  );
  await noSeriousViolations(page, "invitation expired");
});

test("password reset: the request, the neutral confirmation, the new-password page, the single-use link and signing in again", async ({
  page,
  baseURL,
}, testInfo) => {
  const user = await newUser(tag("reset", testInfo.project.name), {
    role: "parent",
    scopeType: "family",
    scope: FAMILY,
  });
  await page.goto("/jelszo-visszaallitas");
  await expect(page).toHaveTitle(COPY.reset.requestTitle);
  await noSeriousViolations(page, "reset request");
  await fillAndSubmit(page, { "request-reset-email": "not-an-address" }, "request-reset-submit");
  await expect(page.getByTestId("request-reset-error")).toHaveText(COPY.reset.emailInvalid);
  await noSeriousViolations(page, "reset request error");
  await fillAndSubmit(
    page,
    { "request-reset-email": tag("nobody", testInfo.project.name) },
    "request-reset-submit",
  );
  await expect(page.getByTestId("request-reset-confirmation")).toHaveText(COPY.reset.confirmation);
  await fillAndSubmit(page, { "request-reset-email": user.address }, "request-reset-submit");
  await expect(page.getByTestId("request-reset-confirmation")).toHaveText(COPY.reset.confirmation);
  await noSeriousViolations(page, "reset confirmation");

  const mail = await mailFor(user.address);
  const link = /\/jelszo-visszaallitas\/uj\?token_hash=([A-Za-z0-9_-]+)&type=recovery/.exec(
    mail.text,
  )!;
  const target = `${baseURL}${link[0]}`;
  // Opening the link only shows the page: the code is exchanged when the form is submitted.
  await page.goto(target);
  await expect(page.getByTestId("set-password-form")).toBeVisible();
  await noSeriousViolations(page, "new password");
  await page.goto(target);
  await expect(page.getByTestId("set-password-form")).toBeVisible();

  await fillAndSubmit(page, { "set-password-input": "weak" }, "set-password-submit", {
    client: true,
  });
  await expect(page.getByTestId("set-password-field-error")).toHaveText(COPY.password.ruleError);
  await noSeriousViolations(page, "new password rule error");
  const newPassword = password();
  await fillAndSubmit(page, { "set-password-input": newPassword }, "set-password-submit");
  await expectSignedIn(page);

  await openLinkSignedOut(page, target);
  await fillAndSubmit(page, { "set-password-input": password() }, "set-password-submit");
  await expect(page.getByTestId("set-password-error")).toHaveText(COPY.reset.notValid);
  await expect(page.getByTestId("set-password-request-link")).toBeVisible();
  await noSeriousViolations(page, "new password used link");

  await page.goto("/bejelentkezes");
  await fillAndSubmit(
    page,
    { "sign-in-email": user.address, "sign-in-password": user.password },
    "sign-in-submit",
  );
  await expect(page.getByTestId("sign-in-error")).toHaveText(COPY.signIn.invalid);
  await fillAndSubmit(
    page,
    { "sign-in-email": user.address, "sign-in-password": newPassword },
    "sign-in-submit",
  );
  await expectSignedIn(page);
});

test("the new-password route without a usable link shows the not-valid page with a way to ask for a new one", async ({
  page,
}) => {
  await page.goto("/jelszo-visszaallitas/uj");
  await expect(page.getByTestId("set-password-not-valid")).toContainText(COPY.reset.notValid);
  await page.getByTestId("set-password-request-link").click();
  await expect(page.getByTestId("request-reset-form")).toBeVisible();
  await page.goto("/jelszo-visszaallitas/uj?token_hash=abc&type=recovery");
  await expect(page.getByTestId("set-password-not-valid")).toBeVisible();
  await noSeriousViolations(page, "new password not valid");
});

test("the screens work with the keyboard alone", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chrome",
    "keyboard focus order is checked on the desktop browsers",
  );
  await page.goto("/bejelentkezes");
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("sign-in-skip-link")).toBeFocused();
  await page.keyboard.press("Tab");
  const focusOrder: string[] = [];
  for (let step = 0; step < 6; step += 1) {
    focusOrder.push(
      (await page.evaluate(
        () =>
          document.activeElement?.getAttribute("data-testid") ??
          document.activeElement?.tagName ??
          "",
      )) as string,
    );
    await page.keyboard.press("Tab");
  }
  expect(focusOrder).toEqual(
    expect.arrayContaining([
      "sign-in-email",
      "sign-in-password",
      "sign-in-submit",
      "sign-in-forgot-link",
    ]),
  );
});

test("Nincs jogosultság: an account with a parent role but no linked record can read why and sign out", async ({
  page,
}, testInfo) => {
  const user = await newUser(
    tag("norecord", testInfo.project.name),
    { role: "parent", scopeType: "family", scope: FAMILY },
    { linkParent: false },
  );
  await page.goto("/bejelentkezes");
  await fillAndSubmit(
    page,
    { "sign-in-email": user.address, "sign-in-password": user.password },
    "sign-in-submit",
  );
  await expect(page.getByTestId("parent-access-denied")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nincs jogosultság", exact: true })).toBeVisible();
  await expect(page.getByTestId("access-guidance")).toHaveText(COPY.noAccess.guidance);
  // The link back would only reload this same screen, so it is not offered.
  await expect(page.getByTestId("parent-access-home-link")).toHaveCount(0);
  await noSeriousViolations(page, "no access");

  await page.getByTestId("sign-out-button").click();
  await expect(page).toHaveURL(/\/bejelentkezes$/);
  await expect(page.getByTestId("sign-in-form")).toBeVisible();
});
