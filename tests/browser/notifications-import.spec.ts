import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import type pg from "pg";
import { createAdminAccess } from "../../src/identity/admin-client.ts";
import { DIRECTORY_SHEET, SHEET_REGISTRY } from "../../src/import-parser/template.ts";
import {
  buildWorkbook,
  directoryRow,
  taskRow,
  type RowSpec,
  type WorkbookSpec,
} from "../support/workbook.ts";
import {
  lockSchemas,
  openDatabase,
  prepareSchema,
  serviceKey,
  stackSettings,
  uuid,
} from "../database/stack-support.ts";

/**
 * Notifications and the Excel import on a production build against the real local stack (U4, step 25).
 *
 * A super admin uploads a fictitious workbook, resolves two conflicts, confirms and sees the real counts; a
 * second import follows the first through the "new upload" link; a commit that the database interrupts is
 * recovered; the import is closed to everybody who is not a super admin; a parent sees only their own
 * notifications after a sign-up and a swap; an admin sees the simulated reminders. Every import step is scanned
 * for WCAG 2.2 AA violations, and the time of an upload with preview is reported (NFR4.10).
 *
 * The interrupted commit uses a failure injected into the real database: a trigger that makes every insert
 * into `tasks` fail with a retryable error class (a lost-transaction code), created and dropped by the test.
 * It is the same honest seam the database tests use, and it needs no code path of its own in the application.
 * The production server is started here on its own port, over the schema named below.
 */
const SCHEMA = process.env.IDENTITY_BROWSER_SCHEMA ?? "worker_4";
const PORT = Number(process.env.NOTIFICATIONS_IMPORT_BROWSER_PORT ?? 3141);
const ORIGIN = `http://127.0.0.1:${PORT}`;

const ORG = "aaaaaaaa-0000-4000-8000-000000000001";
const YEAR = uuid(9601);
const G1 = uuid(9611);
const F_PARENT1 = uuid(9621);
const F_PARENT2 = uuid(9622);
const F_OLD = uuid(9623);
const P1_ROW = uuid(9631);
const P2_ROW = uuid(9632);
const P_OLD_ROW = uuid(9633);
const T_SOON = uuid(9641);
const T_SW1 = uuid(9642);
const T_SW2 = uuid(9643);
const A_SW1 = uuid(9651);
const A_SW2 = uuid(9652);

const GROUP = "Bükköny";
const TASK_SHEET = SHEET_REGISTRY.find(
  (entry) => entry.mode === "interactive" && entry.sheet !== DIRECTORY_SHEET,
)!.sheet;

const settings = stackSettings();
const apiUrl = settings.apiUrl.replace(/\/$/, "");
const admin = createAdminAccess({ url: apiUrl, serviceKey: serviceKey(), schema: SCHEMA });

let db: pg.Client;
let server: ChildProcess | undefined;
const password = () => `Pw-${randomBytes(6).toString("hex")}-1`;

test.describe.configure({ mode: "serial" });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one production server, one browser");
});

async function startServer(): Promise<void> {
  server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(PORT)],
    {
      env: {
        ...process.env,
        SUPABASE_URL: apiUrl,
        SUPABASE_ANON_KEY: settings.publicKey,
        SUPABASE_SERVICE_ROLE_KEY: serviceKey(),
        APP_RUNTIME_MODE: "production",
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
        expect((await response.json()).mode).toBe("production");
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
  db = await openDatabase();
  await lockSchemas(db, [SCHEMA]);
  await prepareSchema(db, SCHEMA);
  await db.query(`set search_path to "${SCHEMA}", pg_catalog`);
  await db.query("insert into organizations (id, name) values ($1, 'Teszt iskola')", [ORG]);
  await db.query(
    "insert into school_years (id, organization_id, name, starts_on, ends_on) values ($1, $2, '2026/2027', '2026-09-01', '2027-06-30')",
    [YEAR, ORG],
  );
  await db.query(
    "insert into groups (id, organization_id, school_year_id, name) values ($1, $2, $3, $4)",
    [G1, ORG, YEAR, GROUP],
  );
  for (const [id, name] of [
    [F_PARENT1, "Fenyő család"],
    [F_PARENT2, "Diófa család"],
    [F_OLD, "Cseresznye család"],
  ]) {
    await db.query("insert into families (id, organization_id, display_name) values ($1, $2, $3)", [
      id,
      ORG,
      name,
    ]);
    await db.query(
      "insert into group_memberships (organization_id, family_id, group_id) values ($1, $2, $3)",
      [ORG, id, G1],
    );
  }
  // The family the import will meet with a different e-mail address: a conflict to resolve.
  await db.query(
    "insert into parents (id, organization_id, family_id, display_name) values ($1, $2, $3, 'Cseresznye Csaba')",
    [P_OLD_ROW, ORG, F_OLD],
  );
  await db.query(
    "insert into parent_contacts (parent_id, organization_id, contact_email, contact_phone, locality) values ($1, $2, 'regi@example.test', '+36 30 111 2222', 'Pécs')",
    [P_OLD_ROW, ORG],
  );
  const soon = new Date(Date.now() + 20 * 3_600_000);
  const later = (hours: number) => new Date(soon.getTime() + hours * 3_600_000).toISOString();
  const task = (id: string, title: string, capacity: number, startsAt: string, endsAt: string) =>
    db.query(
      "insert into tasks (id, organization_id, group_id, title, capacity, starts_at, ends_at, location) values ($1, $2, $3, $4, $5, $6, $7, 'Kert')",
      [id, ORG, G1, title, capacity, startsAt, endsAt],
    );
  await task(T_SOON, "Sürgős kertrendezés", 2, soon.toISOString(), later(2));
  await task(T_SW1, "Csere egy", 1, later(24 * 8), later(24 * 8 + 2));
  await task(T_SW2, "Csere kettő", 1, later(24 * 9), later(24 * 9 + 2));
  await startServer();
});

test.afterAll(async () => {
  stopServer();
  // Never leave an injected failure behind, whatever the tests did.
  await db?.query("drop trigger if exists injected_failure on tasks").catch(() => undefined);
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

async function oneValue<T>(sql: string, params: unknown[] = []): Promise<T> {
  return (await db.query(sql, params)).rows[0] as T;
}

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const file = (name: string, bytes: Uint8Array | Buffer) => ({
  name,
  mimeType: XLSX_TYPE,
  buffer: Buffer.from(bytes),
});

async function upload(page: Page, name: string, bytes: Uint8Array | Buffer) {
  await page.getByTestId("admin-import-file-input").setInputFiles(file(name, bytes));
  await page.getByTestId("admin-import-preview-form-submit-button").click();
}

/** Workbook 1: one new family, one family that exists with another e-mail (conflict 1), a task row for a family nobody knows (conflict 2). */
const workbookWithTwoConflicts = () =>
  buildWorkbook({
    rows: {
      [DIRECTORY_SHEET]: [
        directoryRow({
          Csoport: GROUP,
          Család: "Mézes család",
          "Szülő neve": "Mézes Márta",
          "E-mail": "marta@example.test",
          Telefon: "+36 20 333 4444",
          Helység: "Pécs",
          "Opcionális profil": "Szeret főzni.",
          Hozzájárulás: "igen",
        }),
        directoryRow({ Csoport: GROUP, Család: "Mézes család", "Gyermek neve": "Mézes Máté" }),
        directoryRow({
          Csoport: GROUP,
          Család: "Cseresznye család",
          "Szülő neve": "Cseresznye Cili",
          "E-mail": "cili@example.test",
        }),
      ],
      [TASK_SHEET]: [
        taskRow({
          Csoport: GROUP,
          Esemény: "Tavaszi nagytakarítás",
          Feladat: "Havi takarítás",
          Kategória: "takarítás",
          Kezdés: "2027-02-10 10:00",
          Befejezés: "2027-02-10 12:00",
          Helyszín: "Tornaterem",
          Létszám: 2,
          Család: "Mézes család",
        }),
        taskRow({
          Csoport: GROUP,
          Feladat: "Kerti munka",
          Kezdés: "2027-02-11 09:00",
          Befejezés: "2027-02-11 11:00",
          Létszám: 3,
          Család: "Nincs ilyen család",
        }),
      ],
    },
  });

/** A workbook with one new family and one task for it: no conflicts. */
const simpleWorkbook = (family: string, task: string, day: string) =>
  buildWorkbook({
    rows: {
      [DIRECTORY_SHEET]: [
        directoryRow({
          Csoport: GROUP,
          Család: family,
          "Szülő neve": `${family} szülő`,
          "E-mail": `${family
            .split(" ")[0]!
            .toLowerCase()
            .normalize("NFD")
            .replace(/[^a-z]/g, "")}@example.test`,
        }),
      ],
      [TASK_SHEET]: [
        taskRow({
          Csoport: GROUP,
          Feladat: task,
          Kezdés: `${day} 09:00`,
          Befejezés: `${day} 11:00`,
          Létszám: 2,
          Család: family,
        }),
      ],
    },
  });

/** A directory sheet of `count` new families (for the timing of an upload with preview). */
function manyFamilies(count: number): Uint8Array {
  const rows: RowSpec[] = [];
  for (let index = 0; index < count; index += 1) {
    rows.push(
      directoryRow({
        Csoport: GROUP,
        Család: `Tömeges család ${index}`,
        "Szülő neve": `Tömeges Szülő ${index}`,
        "E-mail": `tomeges${index}@example.test`,
        Telefon: "+36 30 555 1212",
        Helység: "Pécs",
      }),
    );
  }
  const spec: WorkbookSpec = { rows: { [DIRECTORY_SHEET]: rows } };
  return buildWorkbook(spec);
}

let boss: Awaited<ReturnType<typeof newUser>>;
let groupAdmin: Awaited<ReturnType<typeof newUser>>;
let parent1: Awaited<ReturnType<typeof newUser>>;
let parent2: Awaited<ReturnType<typeof newUser>>;

test("the people of the test world exist", async () => {
  boss = await newUser("boss", { role: "super_admin", scopeType: "organization", scope: ORG });
  groupAdmin = await newUser("groupadmin", {
    role: "group_admin",
    scopeType: "group",
    scope: G1,
  });
  parent1 = await newUser(
    "parent1",
    { role: "parent", scopeType: "family", scope: F_PARENT1 },
    { id: P1_ROW, family: F_PARENT1, name: "Fenyő Anna" },
  );
  parent2 = await newUser(
    "parent2",
    { role: "parent", scopeType: "family", scope: F_PARENT2 },
    { id: P2_ROW, family: F_PARENT2, name: "Diófa Béla" },
  );
  await db.query(
    "insert into assignments (id, organization_id, task_id, family_id, source) values ($1,$2,$3,$4,'admin_assign'), ($5,$2,$6,$7,'admin_assign')",
    [A_SW1, ORG, T_SW1, F_PARENT1, A_SW2, T_SW2, F_PARENT2],
  );
});

test("only a super admin reaches the import: a group admin and a parent get no upload", async ({
  browser,
}) => {
  const head = await openSession(browser, groupAdmin);
  await head.page.goto("/admin");
  await expect(head.page.getByTestId("app-shell-navigation-admin-import")).toHaveCount(0);
  await head.page.goto("/admin/import");
  await expect(head.page.getByRole("heading", { name: "Nincs jogosultság" })).toBeVisible();
  await expect(head.page.getByTestId("admin-import-file-input")).toHaveCount(0);
  await accessible(head.page, "import denied");
  await head.context.close();

  const parent = await openSession(browser, parent1);
  await parent.page.goto("/admin/import");
  await expect(parent.page.getByTestId("admin-import-file-input")).toHaveCount(0);
  await expect(parent.page.getByRole("heading", { name: "Importálás" })).toHaveCount(0);
  await parent.context.close();
  const runs = await oneValue<{ n: number }>("select count(*)::int as n from import_runs");
  expect(runs.n).toBe(0);
});

test("the upload step refuses an empty form, a file that is not a workbook, an unsafe cell and an oversized file in Hungarian", async ({
  browser,
}) => {
  const { context, page } = await openSession(browser, boss);
  await page.goto("/admin/import");
  await expect(page.getByRole("heading", { name: "Importálás" })).toBeVisible();
  // No scenario selects and no demo workbook in production mode.
  await expect(page.getByTestId("admin-import-fixture-select")).toHaveCount(0);
  await expect(page.getByTestId("admin-import-scenario-select")).toHaveCount(0);
  await expect(page.getByLabel("Munkafüzet (.xlsx)")).toBeVisible();
  await accessible(page, "import upload");

  await page.getByTestId("admin-import-preview-form-submit-button").click();
  await expect(page.getByTestId("admin-import-file-input-error")).toHaveText(
    "Válasszon ki egy .xlsx munkafüzetet.",
  );
  await expect(page.getByTestId("admin-import-file-input")).toHaveAttribute("aria-invalid", "true");
  await accessible(page, "import upload empty");

  await upload(page, "nem-munkafuzet.xlsx", Buffer.from("ez egy sima szöveg, nem munkafüzet"));
  await expect(alertOf(page)).toContainText("A munkafüzet nem olvasható.");
  await accessible(page, "import upload malformed");

  const unsafe = buildWorkbook({
    rows: {
      [DIRECTORY_SHEET]: [
        directoryRow({ Csoport: GROUP, Család: "Veszélyes család", "Szülő neve": "=1+1" }),
      ],
    },
  });
  await upload(page, "veszelyes.xlsx", unsafe);
  await expect(alertOf(page)).toContainText("nem biztonságos cellát");

  // 5.5 MB passes the 6 MB request limit of the server and is refused by the 5 MB rule of the action.
  await upload(page, "nagy.xlsx", Buffer.alloc(5_500_000, 1));
  await expect(alertOf(page)).toContainText("A munkafüzet legfeljebb 5 MB lehet.");

  const runs = await oneValue<{ n: number }>("select count(*)::int as n from import_runs");
  expect(runs.n).toBe(0);
  await context.close();
});

test("an upload with preview of 2000 rows is timed, and an open run can be cancelled", async ({
  browser,
}, testInfo) => {
  const { context, page } = await openSession(browser, boss);
  await page.goto("/admin/import");
  const started = Date.now();
  await upload(page, "tomeges.xlsx", manyFamilies(2000));
  await expect(page.getByTestId("admin-import-preview")).toBeVisible({ timeout: 60_000 });
  const elapsed = Date.now() - started;
  console.log(`IMPORT UPLOAD WITH PREVIEW (2000 rows, browser): ${elapsed} ms`);
  testInfo.annotations.push({
    type: "import upload with preview time",
    description: `${elapsed} ms for 2000 rows`,
  });
  expect(elapsed).toBeLessThan(60_000);
  await expect(page.getByTestId("admin-import-source")).toHaveText("tomeges.xlsx");

  await page.getByTestId("admin-import-cancel-form-submit-button").click();
  await expect(page.getByTestId("admin-import-file-input")).toBeVisible();
  const run = await oneValue<{ status: string; staged: number }>(
    "select r.status, (select count(*)::int from import_staged_rows s where s.import_run_id = r.id) as staged from import_runs r where workbook_name = 'tomeges.xlsx'",
  );
  expect(run).toEqual({ status: "cancelled", staged: 0 });
  await context.close();
});

test("a super admin uploads a workbook, resolves two conflicts, confirms and sees the real counts", async ({
  browser,
}) => {
  const { context, page } = await openSession(browser, boss);
  await page.goto("/admin/import");
  await upload(page, "tavaszi-feladatok.xlsx", workbookWithTwoConflicts());

  await expect(page.getByTestId("admin-import-preview")).toBeVisible();
  await expect(page.getByTestId("admin-import-source")).toHaveText("tavaszi-feladatok.xlsx");
  const run = await oneValue<{ id: string; version: number; total_rows: number }>(
    "select id, version, total_rows from import_runs where workbook_name = 'tavaszi-feladatok.xlsx'",
  );
  await expect(page.getByTestId("admin-import-preview")).toContainText(String(run.total_rows));
  const forms = page.getByTestId("admin-import-conflict-form");
  await expect(forms).toHaveCount(2);
  await expect(forms.nth(0)).toContainText("Az elem már létezik.");
  await expect(forms.nth(1)).toContainText("Ismeretlen család.");
  // Nothing to import into for the unknown family: only 'keep existing' is offered there.
  await expect(forms.nth(1).getByRole("radio")).toHaveCount(1);
  await expect(page.getByTestId("admin-import-commit-form")).toHaveCount(0);
  await expect(page.locator('[name="scenario"]')).toHaveCount(0);
  await accessible(page, "import conflicts");

  // No choice made: announced and tied to the field.
  await forms.nth(0).getByTestId("admin-import-conflict-form-submit-button").click();
  await expect(alertOf(page)).toContainText("Válasszon feloldási módot.");

  // The first conflict: the version the form sends is the run's real version.
  await expect(forms.nth(0).locator('input[name="expectedVersion"]')).toHaveValue(
    String(run.version),
  );
  await forms.nth(0).getByLabel("Importált adat használata").check();
  await forms.nth(0).getByTestId("admin-import-conflict-form-submit-button").click();
  await expect(page.getByTestId("admin-import-conflict-form")).toHaveCount(1);
  const afterFirst = await oneValue<{ version: number }>(
    "select version from import_runs where id = $1",
    [run.id],
  );
  expect(afterFirst.version).toBeGreaterThan(run.version);
  const second = page.getByTestId("admin-import-conflict-form");
  await expect(second.locator('input[name="expectedVersion"]')).toHaveValue(
    String(afterFirst.version),
  );
  await second.getByLabel("Meglévő adat megtartása").check();
  await second.getByTestId("admin-import-conflict-form-submit-button").click();

  // Confirmation with the real size of the run.
  const commit = page.getByTestId("admin-import-commit-form");
  await expect(commit).toBeVisible();
  await expect(page.getByTestId("admin-import-confirm-text")).toContainText(
    `${run.total_rows} sorát`,
  );
  await expect(page.getByTestId("admin-import-confirm-text")).toContainText(
    "2 feloldott ütközéssel",
  );
  await expect(page.locator("main")).not.toContainText("3 engedélyezett változást");
  await accessible(page, "import confirm");
  // Without the tick the database refuses, and the page says so in Hungarian.
  await commit.getByTestId("admin-import-commit-form-submit-button").click();
  await expect(alertOf(page)).toContainText("Jelölje be, hogy megerősíti a következményeket.");
  await page.getByTestId("admin-import-confirm-checkbox").check();
  await page.getByTestId("admin-import-commit-form-submit-button").click();

  const outcome = page.getByTestId("admin-import-outcome");
  await expect(outcome).toBeVisible();
  const done = await oneValue<{ status: string; imported_rows: number; skipped_rows: number }>(
    "select status, imported_rows, skipped_rows from import_runs where id = $1",
    [run.id],
  );
  expect(done.status).toBe("committed");
  expect(done.imported_rows).toBeGreaterThan(0);
  await expect(page.getByTestId("admin-import-outcome-counts")).toHaveText(
    new RegExp(
      `^${done.imported_rows} elem jött létre vagy módosult, ${done.skipped_rows} sor változatlan maradt`,
    ),
  );
  await expect(outcome).not.toContainText("3 elem módosult");
  await expect(outcome).not.toContainText("OUTSTANDING");
  await expect(page.getByTestId("admin-import-new-upload-link")).toBeVisible();
  await accessible(page, "import result");

  // The data is really there: the new family, the task with its place, the changed contact of the old one.
  const family = await oneValue<{ n: number }>(
    "select count(*)::int as n from families where display_name = 'Mézes család'",
  );
  expect(family.n).toBe(1);
  const place = await oneValue<{ n: number }>(
    "select count(*)::int as n from assignments a join tasks t on t.id = a.task_id join families f on f.id = a.family_id where t.title = 'Havi takarítás' and f.display_name = 'Mézes család' and a.status <> 'removed'",
  );
  expect(place.n).toBe(1);
  const skipped = await oneValue<{ n: number }>(
    "select count(*)::int as n from tasks where title = 'Kerti munka'",
  );
  expect(skipped.n).toBe(0);
  const staged = await oneValue<{ n: number }>(
    "select count(*)::int as n from import_staged_rows where import_run_id = $1",
    [run.id],
  );
  expect(staged.n).toBe(0);
  await context.close();
});

test("a second import follows the first through the new-upload link", async ({ browser }) => {
  const { context, page } = await openSession(browser, boss);
  await page.goto("/admin/import");
  // The finished first run is still on screen, with the way to a new upload.
  await expect(page.getByTestId("admin-import-outcome")).toBeVisible();
  await page.getByTestId("admin-import-new-upload-link").click();
  await expect(page).toHaveURL(/\/admin\/import\?uj=[0-9a-f-]{36}$/);
  await expect(page.getByTestId("admin-import-file-input")).toBeVisible();
  await accessible(page, "import new upload");

  await upload(
    page,
    "oszi-feladatok.xlsx",
    simpleWorkbook("Hársfa család", "Őszi kertápolás", "2027-03-02"),
  );
  await expect(page.getByTestId("admin-import-source")).toHaveText("oszi-feladatok.xlsx");
  await expect(page.getByTestId("admin-import-conflict-form")).toHaveCount(0);
  const commit = page.getByTestId("admin-import-commit-form");
  await expect(commit).toBeVisible();
  const second = await oneValue<{ total_rows: number }>(
    "select total_rows from import_runs where workbook_name = 'oszi-feladatok.xlsx'",
  );
  await expect(page.getByTestId("admin-import-confirm-text")).toContainText(
    `${second.total_rows} sorát`,
  );
  await page.getByTestId("admin-import-confirm-checkbox").check();
  await commit.getByTestId("admin-import-commit-form-submit-button").click();
  await expect(page.getByTestId("admin-import-outcome")).toBeVisible();
  const runs = await db.query(
    "select workbook_name, status, imported_rows from import_runs where status = 'committed' order by committed_at",
  );
  expect(runs.rows.map((row) => row.workbook_name)).toEqual([
    "tavaszi-feladatok.xlsx",
    "oszi-feladatok.xlsx",
  ]);
  await expect(page.getByTestId("admin-import-outcome-counts")).toContainText(
    `${runs.rows[1]!.imported_rows} elem jött létre vagy módosult`,
  );
  const family = await oneValue<{ n: number }>(
    "select count(*)::int as n from assignments a join tasks t on t.id = a.task_id where t.title = 'Őszi kertápolás' and a.status <> 'removed'",
  );
  expect(family.n).toBe(1);
  await context.close();
});

test("a commit the database interrupts is recovered without a partial result", async ({
  browser,
}) => {
  const { context, page } = await openSession(browser, boss);
  await page.goto("/admin/import");
  await page.getByTestId("admin-import-new-upload-link").click();
  await upload(
    page,
    "megszakadt.xlsx",
    simpleWorkbook("Hársfa Két család", "Ablakmosás", "2027-03-09"),
  );
  await expect(page.getByTestId("admin-import-commit-form")).toBeVisible();

  // The failure: every insert into tasks fails with a lost-transaction code, which the application treats as retryable.
  await db.query(
    "create or replace function injected_failure() returns trigger language plpgsql as $f$ begin raise exception 'injected failure' using errcode = '40001'; end $f$",
  );
  await db.query(
    "create trigger injected_failure before insert on tasks for each row execute function injected_failure()",
  );
  const before = await oneValue<{ families: number; tasks: number }>(
    "select (select count(*)::int from families) as families, (select count(*)::int from tasks) as tasks",
  );
  await page.getByTestId("admin-import-confirm-checkbox").check();
  await page.getByTestId("admin-import-commit-form-submit-button").click();

  // The screen now offers the recovery, and nothing was published.
  const recovery = page.getByTestId("admin-import-recovery-form");
  await expect(recovery).toBeVisible();
  await expect(page.getByTestId("admin-import-commit-form")).toHaveCount(0);
  await expect(recovery).toContainText("A mentés megszakadt, részleges közzététel nem történt.");
  await accessible(page, "import interrupted");
  const interrupted = await oneValue<{ status: string; staged: number }>(
    "select status, (select count(*)::int from import_staged_rows s where s.import_run_id = r.id) as staged from import_runs r where workbook_name = 'megszakadt.xlsx'",
  );
  expect(interrupted.status).toBe("interrupted");
  expect(interrupted.staged).toBeGreaterThan(0);
  expect(
    await oneValue<{ families: number; tasks: number }>(
      "select (select count(*)::int from families) as families, (select count(*)::int from tasks) as tasks",
    ),
  ).toEqual(before);

  // Resuming while the failure persists is refused with the transient-failure message and changes nothing.
  await recovery.getByTestId("admin-import-recovery-form-submit-button").click();
  await expect(alertOf(page)).toContainText("Átmeneti hiba történt.");
  expect(
    (
      await oneValue<{ status: string }>(
        "select status from import_runs where workbook_name = 'megszakadt.xlsx'",
      )
    ).status,
  ).toBe("interrupted");

  // The cause is gone: the recovery completes the import.
  await db.query("drop trigger injected_failure on tasks");
  await page.reload();
  await page
    .getByTestId("admin-import-recovery-form")
    .getByTestId("admin-import-recovery-form-submit-button")
    .click();
  await expect(page.getByTestId("admin-import-outcome")).toBeVisible();
  const done = await oneValue<{ status: string }>(
    "select status from import_runs where workbook_name = 'megszakadt.xlsx'",
  );
  expect(done.status).toBe("recovered");
  const added = await oneValue<{ n: number }>(
    "select count(*)::int as n from tasks where title = 'Ablakmosás'",
  );
  expect(added.n).toBe(1);
  await accessible(page, "import recovered");
  await context.close();
});

test("a parent sees only their own notifications after a sign-up and a swap", async ({
  browser,
}) => {
  const first = await openSession(browser, parent1);
  const second = await openSession(browser, parent2);
  await first.page.goto("/szulo/ertesitesek");
  await expect(first.page.getByTestId("notifications-empty")).toBeVisible();

  // A sign-up gives the signing family its confirmation notice, and nobody else.
  await first.page.goto(`/szulo/feladatok/${T_SOON}`);
  await first.page.getByTestId("signup-form-submit-button").click();
  await expect(first.page.getByTestId("signup-form-state-success")).toBeVisible();
  await first.page.goto("/szulo/ertesitesek");
  const cards = first.page.locator('[data-testid^="notification-card-"]');
  await expect(cards.first()).toBeVisible();
  await expect(first.page.getByTestId("notification-list")).toContainText("Sürgős kertrendezés");
  await accessible(first.page, "parent notifications");
  await second.page.goto("/szulo/ertesitesek");
  await expect(second.page.getByTestId("notifications-empty")).toBeVisible();

  // A swap: the other family is told of the request, then both of the decision.
  await first.page.goto(`/szulo/feladatok/${T_SW1}/csere`);
  await first.page.getByTestId(`swap-candidate-${A_SW2}`).check();
  await first.page.getByTestId("swap-reason-input").fill("Beteg a gyerek");
  await first.page.getByTestId("swap-request-form-submit-button").click();
  await expect(first.page.getByTestId("swap-pending-panel")).toBeVisible();
  await second.page.goto("/szulo/ertesitesek");
  await expect(second.page.locator('[data-testid^="notification-card-"]')).toHaveCount(1);
  await expect(second.page.getByTestId("notification-list")).toContainText("Csere egy");
  await expect(second.page.getByTestId("notification-list")).not.toContainText(
    "Sürgős kertrendezés",
  );

  await second.page.goto("/szulo/cserek");
  await second.page.getByRole("button", { name: /^Megerősítés: Csere egy/ }).click();
  await expect(second.page.getByTestId("swap-board-state-success")).toContainText(
    "A csere megtörtént",
  );
  await second.page.goto("/szulo/ertesitesek");
  await expect(second.page.locator('[data-testid^="notification-card-"]')).toHaveCount(2);
  await first.page.goto("/szulo/ertesitesek");
  await expect(first.page.getByTestId("notification-list")).toContainText("Csere");
  await accessible(second.page, "parent notifications after a swap");

  // The database agrees: every notification belongs to the parent who sees it.
  const owners = await db.query(
    "select parent_id, count(*)::int as n from notifications group by parent_id order by parent_id",
  );
  expect(owners.rows.map((row) => row.parent_id).sort()).toEqual([P1_ROW, P2_ROW].sort());
  await first.context.close();
  await second.context.close();
});

test("an admin sees the simulated reminders of the task a family signed up for", async ({
  browser,
}) => {
  const { context, page } = await openSession(browser, boss);
  await page.goto("/admin/emlekeztetok");
  await expect(page.getByRole("heading", { name: "Emlékeztetők felügyelete" })).toBeVisible();
  const list = page.getByTestId("admin-reminder-list");
  await expect(list).toBeVisible();
  await expect(list).toContainText("Sürgős kertrendezés");
  await expect(list).toContainText("Szimulált kézbesítés");
  await accessible(page, "reminders list");
  await context.close();
});
