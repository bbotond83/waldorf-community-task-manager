import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import type pg from "pg";
import { createAdminAccess } from "../../src/identity/admin-client.ts";
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
  uuid,
} from "../database/stack-support.ts";
import { bindSeededSchema } from "./support/seeded-schema.ts";

/**
 * Directory and coordination on a production build against the real local stack (U3, steps 28 to 30):
 * two parents at once, a swap confirmed by the other family, a cancellation approved by the admin, an invited
 * new parent who is linked and sees their family's tasks, a teacher who sees only the granted group, the
 * extended admin forms and the empty notification page of a real parent. Every screen is scanned for
 * WCAG 2.2 AA violations. The production server is started here (the servers of playwright.config.ts are
 * synthetic), on its own port, over the schema named below.
 */
// The schema of the running browser project (tests/browser/support/projects.ts); known once the first hook has run.
let SCHEMA = "";
const world = bindSeededSchema({ seed: false });
const PORT = Number(process.env.DIRECTORY_BROWSER_PORT ?? 3140);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const MAIL_API = "http://127.0.0.1:54324/api/v1";

const ORG = "aaaaaaaa-0000-4000-8000-000000000001";
const YEAR = uuid(9501);
const G1 = uuid(9101);
const G2 = uuid(9102);
const G3 = uuid(9103);
const F1 = uuid(9201);
const F2 = uuid(9202);
const F4 = uuid(9204);
const F5 = uuid(9205);
const P1_ROW = uuid(9301);
const P2_ROW = uuid(9302);
const P4_ROW = uuid(9304);
const T_LAST = uuid(9401);
const T_SW1 = uuid(9402);
const T_SW2 = uuid(9403);
const T_CANCEL = uuid(9404);
const T_G2 = uuid(9405);
const T_G3 = uuid(9406);
const EVENT = uuid(9407);
const A_SW1 = uuid(9501 + 1000);
const A_SW2 = uuid(9502 + 1000);
const A_CANCEL = uuid(9503 + 1000);

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
let server: ChildProcess | undefined;
const password = () => `Pw-${randomBytes(6).toString("hex")}-1`;
const day = (offset: number, hour = 9) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
};

test.describe.configure({ mode: "serial" });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one production server, one browser");
});

async function startServer(): Promise<void> {
  const stack = {
    SUPABASE_URL: apiUrl,
    SUPABASE_ANON_KEY: settings.publicKey,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey(),
  };
  server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(PORT)],
    {
      env: {
        ...process.env,
        ...stack,
        APP_SESSION_SECRET: randomBytes(32).toString("hex"),
        DATABASE_SCHEMA: SCHEMA,
        APP_PUBLIC_URL: ORIGIN,
        SMTP_HOST: "127.0.0.1",
        SMTP_PORT: "54325",
        SMTP_FROM: "no-reply@example.test",
      },
      detached: true,
      stdio: "ignore",
    },
  );
  const deadline = Date.now() + 90_000;
  for (;;) {
    try {
      const response = await fetch(`${ORIGIN}/api/readiness`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) {
        expect((await response.json()).status).toBe("ready");
        return;
      }
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) throw new Error("the production server did not become ready");
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

function stopServer(): void {
  if (server?.pid) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      // already gone
    }
  }
}

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
  await db.query("insert into organizations (id, name) values ($1, 'Teszt iskola')", [ORG]);
  await db.query(
    "insert into school_years (id, organization_id, name, starts_on, ends_on) values ($1, $2, '2026/2027', '2026-09-01', '2027-06-30')",
    [YEAR, ORG],
  );
  for (const [id, name] of [
    [G1, "Boróka"],
    [G2, "Napraforgó"],
    [G3, "Meghívott csoport"],
  ]) {
    await db.query(
      "insert into groups (id, organization_id, school_year_id, name) values ($1, $2, $3, $4)",
      [id, ORG, YEAR, name],
    );
  }
  for (const [id, name, group] of [
    [F1, "Fenyő család", G1],
    [F2, "Diófa család", G1],
    [F4, "Meghívott család", G3],
    [F5, "Hárs család", G2],
  ]) {
    await db.query("insert into families (id, organization_id, display_name) values ($1, $2, $3)", [
      id,
      ORG,
      name,
    ]);
    await db.query(
      "insert into group_memberships (organization_id, family_id, group_id) values ($1, $2, $3)",
      [ORG, id, group],
    );
  }
  const task = (id: string, group: string, title: string, capacity: number, offset: number) =>
    db.query(
      "insert into tasks (id, organization_id, group_id, title, capacity, starts_at, ends_at, location) values ($1, $2, $3, $4, $5, $6, $7, 'Kert')",
      [id, ORG, group, title, capacity, day(offset), day(offset, 11)],
    );
  await task(T_LAST, G1, "Utolsó hely", 1, 6);
  await task(T_SW1, G1, "Csere egy", 1, 7);
  await task(T_SW2, G1, "Csere kettő", 1, 8);
  await task(T_CANCEL, G1, "Lemondható", 2, 9);
  await task(T_G2, G2, "Napraforgó-feladat", 1, 10);
  await task(T_G3, G3, "Meghívott feladat", 1, 11);
  await db.query(
    "insert into parents (id, organization_id, family_id, display_name) values ($1, $2, $3, 'Meghívott Mária')",
    [P4_ROW, ORG, F4],
  );
  await db.query(
    "insert into events (id, organization_id, group_id, title, starts_at, ends_at) values ($1, $2, $3, 'Őszi ünnep', $4, $5)",
    [EVENT, ORG, G1, day(12), day(12, 12)],
  );
  await startServer();
});

test.afterAll(async () => {
  stopServer();
  await db?.end();
});

function tag(name: string): string {
  return `${SCHEMA}.${name}-${randomBytes(3).toString("hex")}@example.test`;
}

async function newUser(
  name: string,
  grant: { role: string; scopeType: string; scope: string },
  parentRow?: { id: string; family: string; name: string },
) {
  const address = tag(name);
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
    ORG,
  ]);
  await db.query(
    "insert into app_role_grants (subject_id, role, scope_type, scope_id, organization_id) values ($1, $2, $3, $4, $5)",
    [created.value.id, grant.role, grant.scopeType, grant.scope, ORG],
  );
  await db.query(
    "insert into app_authorization_versions (subject_id, authorization_version) values ($1, 1) on conflict do nothing",
    [created.value.id],
  );
  if (parentRow) {
    await db.query(
      "insert into parents (id, organization_id, family_id, account_id, display_name) values ($1, $2, $3, $4, $5)",
      [parentRow.id, ORG, parentRow.family, created.value.id, parentRow.name],
    );
  }
  return { id: created.value.id, address, password: secret };
}

async function openSession(
  browser: import("@playwright/test").Browser,
  user: { address: string; password: string },
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL: ORIGIN });
  const page = await context.newPage();
  await page.goto("/bejelentkezes");
  await page.getByTestId("sign-in-email").fill(user.address);
  await page.getByTestId("sign-in-password").fill(user.password);
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST"),
    page.getByTestId("sign-in-submit").click(),
  ]);
  await expect(page.getByTestId("signed-in-panel")).toBeVisible();
  return { context, page };
}

/** The announced error of a form (not the router's own empty announcer). */
function alertOf(page: Page) {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)');
}

async function accessible(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious.map((violation) => `${label}: ${violation.id}`)).toEqual([]);
}

async function mailFor(address: string): Promise<string> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const list = (await (
      await fetch(`${MAIL_API}/search?query=${encodeURIComponent(`to:${address}`)}`)
    ).json()) as { messages: { ID: string }[] };
    if (list.messages[0]) {
      const full = (await (await fetch(`${MAIL_API}/message/${list.messages[0].ID}`)).json()) as {
        Text: string;
      };
      return full.Text;
    }
    if (Date.now() > deadline) throw new Error("no mail arrived");
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

async function oneValue<T>(sql: string, params: unknown[] = []): Promise<T> {
  return (await db.query(sql, params)).rows[0] as T;
}

let parent1: Awaited<ReturnType<typeof newUser>>;
let parent2: Awaited<ReturnType<typeof newUser>>;
let boss: Awaited<ReturnType<typeof newUser>>;
let teacher: Awaited<ReturnType<typeof newUser>>;

test("the people of the test world exist and the home page leads each to their own page", async ({
  browser,
}) => {
  parent1 = await newUser(
    "parent1",
    { role: "parent", scopeType: "family", scope: F1 },
    {
      id: P1_ROW,
      family: F1,
      name: "Fenyő Anna",
    },
  );
  parent2 = await newUser(
    "parent2",
    { role: "parent", scopeType: "family", scope: F2 },
    {
      id: P2_ROW,
      family: F2,
      name: "Diófa Béla",
    },
  );
  boss = await newUser("boss", { role: "super_admin", scopeType: "organization", scope: ORG });
  teacher = await newUser("teacher", {
    role: "kindergarten_teacher",
    scopeType: "group",
    scope: G1,
  });
  await db.query(
    "insert into assignments (id, organization_id, task_id, family_id, source) values ($1,$2,$3,$4,'admin_assign'), ($5,$2,$6,$7,'admin_assign'), ($8,$2,$9,$7,'admin_assign')",
    [A_SW1, ORG, T_SW1, F1, A_SW2, T_SW2, F2, A_CANCEL, T_CANCEL],
  );

  // Signed out: the sign-in link, no test profiles.
  const anonymous = await browser.newContext({ baseURL: ORIGIN });
  const visitor = await anonymous.newPage();
  await visitor.goto("/");
  await expect(visitor.getByTestId("production-sign-in-link")).toBeVisible();
  await expect(visitor.getByTestId("app-shell-switch-profile-button")).toHaveCount(0);
  await accessible(visitor, "home signed out");
  await anonymous.close();

  // Signed in: the person's own home and a sign-out button instead of the test-profile switcher.
  const { context, page } = await openSession(browser, parent1);
  await page.goto("/");
  await expect(page).toHaveURL(/\/szulo\/ertesitesek$/);
  await expect(page.getByTestId("sign-out-button")).toBeVisible();
  await expect(page.getByTestId("app-shell-switch-profile-button")).toHaveCount(0);
  await expect(page.getByTestId("app-shell-navigation-parent-swaps")).toHaveText("Cserék");
  await context.close();
});

test("a real parent sees the empty notification page and the task list in good time", async ({
  browser,
}, testInfo) => {
  const { context, page } = await openSession(browser, parent1);
  await page.goto("/szulo/ertesitesek");
  await expect(page.getByTestId("notifications-empty")).toBeVisible();
  await accessible(page, "notifications empty");

  const timings: number[] = [];
  for (let run = 0; run < 5; run += 1) {
    const started = Date.now();
    await page.goto("/szulo/feladatok", { waitUntil: "load" });
    await expect(page.getByTestId("duty-list")).toBeVisible();
    timings.push(Date.now() - started);
  }
  const sorted = timings.toSorted((a, b) => a - b);
  const median = sorted[2]!;
  console.log(`PARENT TASK LIST PAGE: ${timings.join(" ms, ")} ms; median ${median} ms`);
  testInfo.annotations.push({
    type: "parent task list page time",
    description: `runs ${timings.join(", ")} ms; median ${median} ms`,
  });
  expect(median).toBeLessThan(2000);
  await accessible(page, "parent task list");
  await context.close();
});

test("two parents at once sign up for the last place: one gets it, the other sees it taken", async ({
  browser,
}) => {
  const first = await openSession(browser, parent1);
  const second = await openSession(browser, parent2);
  for (const { page } of [first, second]) {
    await page.goto(`/szulo/feladatok/${T_LAST}`);
    await expect(page.getByTestId("signup-form")).toBeVisible();
  }
  await accessible(first.page, "duty detail");
  await first.page.getByTestId("signup-form-submit-button").click();
  await expect(first.page.getByTestId("signup-form-state-success")).toBeVisible();
  // The second parent still has the old screen: the server refuses, in Hungarian.
  await second.page.getByTestId("signup-form-submit-button").click();
  await expect(alertOf(second.page)).toContainText("Az adatok időközben megváltoztak");
  await second.page.reload();
  await expect(second.page.getByTestId("duty-full-state")).toBeVisible();
  await first.page.reload();
  await expect(first.page.getByTestId("duty-detail-state")).toContainText("Vállalt feladat");
  const taken = await oneValue<{ n: number }>(
    "select count(*)::int as n from assignments where task_id = $1 and status <> 'removed'",
    [T_LAST],
  );
  expect(taken.n).toBe(1);
  await first.context.close();
  await second.context.close();
});

test("a swap is requested from the partner list, confirmed by the other family and applied", async ({
  browser,
}) => {
  const first = await openSession(browser, parent1);
  const second = await openSession(browser, parent2);

  await first.page.goto(`/szulo/feladatok/${T_SW1}/csere`);
  await expect(page_h1(first.page)).toHaveText("Cserekérelem");
  const candidate = first.page.getByTestId(`swap-candidate-${A_SW2}`);
  await expect(candidate).toBeVisible();
  await accessible(first.page, "swap page");
  // Nothing chosen: the message is announced and tied to the list.
  await first.page.getByTestId("swap-reason-input").fill("Beteg a gyerek");
  await first.page.getByTestId("swap-request-form-submit-button").click();
  await expect(alertOf(first.page)).toContainText("Válasszon egy cseretársat.");
  await accessible(first.page, "swap page error");
  await candidate.check();
  await first.page.getByTestId("swap-request-form-submit-button").click();
  await expect(first.page.getByTestId("swap-pending-panel")).toBeVisible();

  await second.page.goto("/szulo/cserek");
  await expect(second.page.getByRole("heading", { level: 1 })).toHaveText("Cserék és kérelmek");
  const confirm = second.page.getByRole("button", { name: /^Megerősítés: Csere egy/ });
  await expect(confirm).toBeVisible();
  await expect(second.page.getByRole("button", { name: /^Elutasítás: Csere egy/ })).toBeVisible();
  await accessible(second.page, "incoming swaps");
  await confirm.click();
  await expect(second.page.getByTestId("swap-board-state-success")).toContainText(
    "A csere megtörtént",
  );

  const moved = await db.query(
    "select id, task_id from assignments where id = any($1) order by id",
    [[A_SW1, A_SW2]],
  );
  expect(Object.fromEntries(moved.rows.map((row) => [row.id, row.task_id]))).toEqual({
    [A_SW1]: T_SW2,
    [A_SW2]: T_SW1,
  });
  // The first family now sees the new task as theirs.
  await first.page.goto(`/szulo/feladatok/${T_SW2}`);
  await expect(first.page.getByTestId("duty-detail-state")).toContainText("Vállalt feladat");
  await first.context.close();
  await second.context.close();
});

function page_h1(page: Page) {
  return page.getByRole("heading", { level: 1 });
}

test("a swap request can be declined or withdrawn from the incoming page", async ({ browser }) => {
  const first = await openSession(browser, parent1);
  const second = await openSession(browser, parent2);
  // The first family now holds "Csere kettő"; asks the second family for "Csere egy" back.
  await first.page.goto(`/szulo/feladatok/${T_SW2}/csere`);
  await first.page.getByTestId(`swap-candidate-${A_SW2}`).check();
  await first.page.getByTestId("swap-reason-input").fill("Mégis visszacserélnénk");
  await first.page.getByTestId("swap-request-form-submit-button").click();
  await expect(first.page.getByTestId("swap-pending-panel")).toBeVisible();

  await second.page.goto("/szulo/cserek");
  await second.page.getByRole("button", { name: /^Elutasítás: Csere kettő/ }).click();
  await expect(second.page.getByTestId("swap-board-state-success")).toContainText("elutasította");

  // Own request: ask again, then withdraw it.
  await first.page.goto(`/szulo/feladatok/${T_SW2}/csere`);
  await first.page.getByTestId(`swap-candidate-${A_SW2}`).check();
  await first.page.getByTestId("swap-reason-input").fill("Még egyszer");
  await first.page.getByTestId("swap-request-form-submit-button").click();
  await expect(first.page.getByTestId("swap-pending-panel")).toBeVisible();
  await first.page.goto("/szulo/cserek");
  await accessible(first.page, "own open requests");
  await first.page.getByRole("button", { name: /^Visszavonás: Cserekérelem/ }).click();
  await expect(first.page.getByTestId("swap-board-state-success")).toContainText("visszavonta");
  await first.context.close();
  await second.context.close();
});

test("a cancellation is requested by the parent and approved by the admin", async ({ browser }) => {
  const parent = await openSession(browser, parent2);
  await parent.page.goto(`/szulo/feladatok/${T_CANCEL}/lemondas`);
  await parent.page.getByTestId("cancellation-reason-input").fill("Elutazunk");
  await accessible(parent.page, "cancellation page");
  await parent.page.getByTestId("cancellation-request-form-submit-button").click();
  await expect(parent.page.getByTestId("cancellation-pending-panel")).toBeVisible();

  const head = await openSession(browser, boss);
  await head.page.goto("/admin/jovahagyasok");
  await accessible(head.page, "approvals list");
  await head.page.locator('[data-testid^="admin-approvals-list-open-"]').first().click();
  await expect(head.page.getByTestId("admin-approval-decision-form")).toBeVisible();
  await head.page.getByTestId("admin-approval-decision-form-submit-button").click();
  await expect(head.page.getByTestId("admin-approval-decision-form-state-success")).toBeVisible();
  const row = await oneValue<{ status: string }>("select status from assignments where id = $1", [
    A_CANCEL,
  ]);
  expect(row.status).toBe("removed");
  await parent.context.close();
  await head.context.close();
});

test("the extended admin forms create a family and a task, refuse a wrong assignment and save event notes", async ({
  browser,
}) => {
  const { context, page } = await openSession(browser, boss);

  // The family form: errors first, announced and tied to their fields.
  await page.goto("/admin/nyilvantartasok/uj");
  await page.getByTestId("admin-record-create-form-submit-button").click();
  await expect(page.getByTestId("admin-record-create-form-state-validation")).toBeVisible();
  await expect(page.getByTestId("admin-record-title-input")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await accessible(page, "family form errors");
  await page.getByTestId("admin-record-title-input").fill("Újfalusi család");
  await page.getByTestId("admin-family-group-select").selectOption({ label: "Boróka" });
  await page.getByTestId("admin-parent-0-name-input").fill("Újfalusi Zoltán");
  await page.getByTestId("admin-parent-0-email-input").fill("rossz-cim");
  await page.getByTestId("admin-record-create-form-submit-button").click();
  await expect(page.getByTestId("admin-parent-0-email-input")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  // What was typed is still there after the refusal.
  await expect(page.getByTestId("admin-parent-0-name-input")).toHaveValue("Újfalusi Zoltán");
  await page.getByTestId("admin-parent-0-email-input").fill("zoltan@example.test");
  await page.getByTestId("admin-parent-0-phone-input").fill("+36 30 111 2222");
  await page.getByTestId("admin-parent-0-profile-input").fill("Asztalos vagyok.");
  await page.getByTestId("admin-parent-0-consent-input").check();
  await accessible(page, "family form");
  await page.getByTestId("admin-record-create-form-submit-button").click();
  await expect(page.getByTestId("admin-record-create-form-state-success")).toBeVisible();
  const family = await oneValue<{ id: string }>(
    "select id from families where display_name = 'Újfalusi család'",
  );
  const stored = await oneValue<{ contact_email: string; optional_profile: string }>(
    "select c.contact_email, p.optional_profile from parents p join parent_contacts c on c.parent_id = p.id where p.family_id = $1",
    [family.id],
  );
  expect(stored).toEqual({
    contact_email: "zoltan@example.test",
    optional_profile: "Asztalos vagyok.",
  });
  const member = await oneValue<{ n: number }>(
    "select count(*)::int as n from group_memberships where family_id = $1 and group_id = $2 and status = 'active'",
    [family.id, G1],
  );
  expect(member.n).toBe(1);

  // The same family on its edit page, with the parent filled in and the membership to end.
  await page.goto(`/admin/nyilvantartasok/${family.id}`);
  await expect(page.getByTestId("admin-parent-0-name-input")).toHaveValue("Újfalusi Zoltán");
  await expect(page.getByTestId("admin-parent-0-consent-input")).toBeChecked();
  await expect(page.getByLabel("Tagság megszüntetése: Boróka")).toBeVisible();
  await accessible(page, "family edit form");

  // A school year form and a task form.
  await page.goto("/admin/nyilvantartasok/uj");
  await page.getByTestId("admin-record-kind-select").selectOption("school-year");
  await expect(page.getByTestId("admin-record-starts-on-input")).toBeVisible();
  await accessible(page, "school year form");

  await page.goto("/admin/feladatok/uj");
  await page.getByTestId("admin-task-title-input").fill("Új feladat");
  await page.getByTestId("admin-task-group-select").selectOption({ label: "Boróka" });
  await page.getByTestId("admin-task-capacity-input").fill("2");
  await page.getByTestId("admin-task-location-input").fill("Udvar");
  await page.getByTestId("admin-task-starts-at-input").fill("2027-03-10T09:00");
  await page.getByTestId("admin-task-ends-at-input").fill("2027-03-10T11:00");
  await accessible(page, "task form");
  await page.getByTestId("admin-task-create-form-submit-button").click();
  await expect(page.getByTestId("admin-task-create-form-state-success")).toBeVisible();
  const created = await oneValue<{ id: string; starts_at: Date }>(
    "select id, starts_at from tasks where title = 'Új feladat'",
  );
  expect(created.starts_at.toISOString()).toBe("2027-03-10T08:00:00.000Z");

  // Assignment: a family outside the group is refused with the Hungarian message; one in the group is placed.
  await page.goto(`/admin/feladatok/${created.id}`);
  await page.getByTestId("admin-assignment-family-select").selectOption({ label: "Hárs család" });
  await page.getByTestId("admin-assignment-form-submit-button").click();
  await expect(alertOf(page)).toContainText("nem jogosult erre a feladatra");
  await accessible(page, "assignment refused");
  await page.getByTestId("admin-assignment-family-select").selectOption({ label: "Fenyő család" });
  await page.getByTestId("admin-assignment-form-submit-button").click();
  await expect(page.getByTestId("admin-assignment-form-state-success")).toBeVisible();

  // Event notes: saved, and shown filled in on the next visit.
  await page.goto(`/admin/feladatok/${EVENT}`);
  await page.getByTestId("admin-event-allergen-note-input").fill("Dió nélkül");
  await page.getByTestId("admin-event-supply-note-input").fill("Terítők");
  await accessible(page, "event form");
  await page.getByTestId("admin-event-notes-form-submit-button").click();
  await expect(page.getByTestId("admin-event-notes-form-state-success")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("admin-event-allergen-note-input")).toHaveValue("Dió nélkül");
  const note = await oneValue<{ allergen_note: string }>(
    "select allergen_note from events where id = $1",
    [EVENT],
  );
  expect(note.allergen_note).toBe("Dió nélkül");
  await context.close();
});

test("an invited new parent is linked to the family and sees the tasks of its group", async ({
  browser,
}) => {
  const session = await service.passwordSignIn(boss.address, boss.password);
  if (!session.ok) throw new Error("the inviter could not sign in");
  const address = tag("invited");
  const created = await createInvitation(
    { accessToken: session.value.accessToken, accountId: boss.id },
    {
      email: address,
      role: "parent",
      scopeType: "family",
      scopeId: F4,
      targetId: P4_ROW,
      idempotencyKey: randomUUID(),
    },
    { service, admin, database, mailer, events: { emit: () => undefined }, appPublicUrl: ORIGIN },
  );
  expect(created.state).toBe("success");
  const link = /(http:\/\/\S+\/meghivas\/[A-Za-z0-9_-]{43})/.exec(await mailFor(address))![1]!;

  const context = await browser.newContext({ baseURL: ORIGIN });
  const page = await context.newPage();
  await page.goto(link);
  await expect(page.getByTestId("real-invitation-valid")).toBeVisible();
  await accessible(page, "invitation");
  await page.getByTestId("accept-invitation-password").fill(password());
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST"),
    page.getByTestId("accept-invitation-submit").click(),
  ]);
  await expect(page.getByTestId("signed-in-panel")).toBeVisible();

  const linked = await oneValue<{ account_id: string | null }>(
    "select account_id from parents where id = $1",
    [P4_ROW],
  );
  expect(linked.account_id).not.toBeNull();

  // The new parent's home is the parent area, and the list is that of the family's group only.
  await page.goto("/");
  await expect(page).toHaveURL(/\/szulo\/ertesitesek$/);
  await page.goto("/szulo/feladatok");
  await expect(page.getByTestId(`duty-card-${T_G3}`)).toBeVisible();
  await expect(page.getByTestId(`duty-card-${T_LAST}`)).toHaveCount(0);
  await expect(page.getByTestId(`duty-card-${T_G2}`)).toHaveCount(0);
  await accessible(page, "new parent task list");
  await context.close();
});

test("a teacher sees the schedule of the granted group only", async ({ browser }) => {
  const { context, page } = await openSession(browser, teacher);
  await page.goto("/teacher/schedule");
  await expect(page.getByRole("heading", { level: 1, name: "Beosztás" })).toBeVisible();
  await expect(page.getByTestId(`teacher-schedule-row-${T_LAST}`)).toBeVisible();
  await expect(page.getByTestId(`teacher-schedule-row-${T_SW1}`)).toBeVisible();
  await expect(page.getByTestId(`teacher-schedule-row-${T_G2}`)).toHaveCount(0);
  await expect(page.getByTestId(`teacher-schedule-row-${T_G3}`)).toHaveCount(0);
  // No contact details, notes or other groups' families.
  const text = await page.locator("main").innerText();
  expect(text).not.toContain("Hárs család");
  expect(text).not.toContain("@example.test");
  await accessible(page, "teacher schedule");

  // The address of a group the teacher is not granted gives no data.
  await page.goto(`/teacher/schedule?groupId=${G2}`);
  await expect(page.getByTestId(`teacher-schedule-row-${T_G2}`)).toHaveCount(0);
  expect(await page.locator("main").innerText()).not.toContain("Napraforgó-feladat");
  await context.close();
});
