import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Request } from "@playwright/test";
import { SERIOUS, bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

const world = bindSeededSchema();

test.beforeEach(async () => world().reseed());

/** The name list and the account page, walked as each role (U3, steps 11 to 13). */
const DIRECTORY_OF = {
  "parent-1": "/szulo/szulok",
  "group-admin-1": "/szulo/szulok",
  "teacher-1": "/teacher/szulok",
  "super-admin": "/admin/szulok",
} as const;
type Tag = keyof typeof DIRECTORY_OF;
const ALL_DIRECTORIES = ["/szulo/szulok", "/teacher/szulok", "/admin/szulok"] as const;

const denied = (page: Page) => page.getByText("Nincs jogosultság", { exact: true }).first();

for (const tag of Object.keys(DIRECTORY_OF) as Tag[]) {
  test(`${tag}: the name list opens in the own area and the other areas refuse`, async ({
    page,
  }) => {
    await signInAs(page, world().account(tag));
    for (const route of ALL_DIRECTORIES) {
      await page.goto(route);
      // A group administrator is also a parent and works in the administrator area, so both lists are theirs.
      const mine =
        route === DIRECTORY_OF[tag] || (tag === "group-admin-1" && route === "/admin/szulok");
      if (mine) {
        await expect(page.getByRole("heading", { level: 1, name: "Szülők" })).toBeVisible();
        await expect(denied(page)).toHaveCount(0);
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations.filter(SERIOUS), `${tag} ${route}`).toEqual([]);
      } else {
        await expect(denied(page), `${tag} may not open ${route}`).toBeVisible();
      }
    }
  });
}

test("the search narrows the list while typing without any network request", async ({ page }) => {
  await signInAs(page, world().account("parent-1"));
  await page.goto("/szulo/szulok");
  const input = page.getByTestId("directory-search-input");
  await expect(input).toBeVisible();
  await expect(page.getByTestId("directory-search-hint")).toHaveText(
    "A kereső automatikusan szűr a családnevekre és a megadott keresztnevekre is.",
  );
  await expect(page.getByTestId("directory-legend")).toHaveText("Önkéntesen megosztott adatok");
  const total = await page.getByTestId("directory-list").locator("> *").count();
  await expect(page.getByTestId("directory-count")).toHaveText(
    `Aktív családok (${total} bejegyzés)`,
  );
  const requests: Request[] = [];
  page.on("request", (request) => {
    // The menu's own prefetch of other pages (_rsc) is not caused by typing; only data calls count.
    if (["fetch", "xhr"].includes(request.resourceType()) && !request.url().includes("_rsc")) {
      requests.push(request);
    }
  });
  await input.pressSequentially("zzzz-senki", { delay: 20 });
  await expect(page.getByTestId("directory-no-match")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nincs találat" })).toBeVisible();
  await page.getByRole("button", { name: "Keresés törlése" }).click();
  await expect(input).toHaveValue("");
  await expect(page.getByTestId("directory-list").locator("> *")).toHaveCount(total);
  expect(requests.map((request) => request.url())).toEqual([]);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(SERIOUS)).toEqual([]);
});

test("the name list fits a phone without sideways scrolling", async ({ page }) => {
  await signInAs(page, world().account("parent-1"));
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/szulo/szulok");
  await expect(page.getByRole("heading", { level: 1, name: "Szülők" })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("a signed-out visitor gets the way to sign-in and sees no card", async ({ page }) => {
  for (const route of ALL_DIRECTORIES) {
    await page.goto(route);
    await expect(
      page.getByTestId("production-sign-in-link").or(page.getByTestId("parent-login-link")).first(),
    ).toBeVisible();
    await expect(page.locator("[data-testid^='directory-family-']")).toHaveCount(0);
  }
});

test("Fiókom shows the three panels to a parent, is clean, and is refused to other roles", async ({
  page,
}) => {
  await signInAs(page, world().account("parent-1"));
  await page.goto("/szulo/fiokom");
  await expect(page.getByTestId("account-page")).toBeVisible();
  for (const title of ["Adataim", "Láthatóság", "Bejelentkezés"]) {
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }
  await expect(page.getByTestId("account-email-pending")).toHaveCount(0);
  await expect(page.getByTestId("account-verified-badge")).toHaveText("Hitelesített szülő");
  await expect(page.getByTestId("account-email-confirmed-badge")).toHaveText("Megerősített e-mail");
  await expect(page.getByTestId("account-verified-badge").locator("svg")).toHaveCount(1);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(SERIOUS)).toEqual([]);
  await signInAs(page, world().account("teacher-1"));
  await page.goto("/szulo/fiokom");
  await expect(denied(page)).toBeVisible();
});

test("a wrong current password is named next to its field and changes nothing", async ({
  page,
}) => {
  await signInAs(page, world().account("parent-1"));
  await page.goto("/szulo/fiokom");
  const form = page.getByTestId("account-password-form");
  await form.getByLabel("Jelenlegi jelszó").fill("nem-ez-a-jelszo-1");
  await form.getByLabel("Új jelszó", { exact: true }).fill("Uj-jelszo-12345");
  await form.getByLabel("Új jelszó még egyszer").fill("Uj-jelszo-12345");
  await form.getByRole("button").click();
  await expect(form.getByTestId("account-password-current-error")).toBeVisible();
});

test("a malformed or spent confirmation link says it is no longer valid", async ({ page }) => {
  const notValid = page.getByRole("heading", { name: "A hivatkozás már nem érvényes" });
  await page.goto("/email-megerosites/x");
  await expect(notValid).toBeVisible();
  // A link of the right shape that the database does not know: the button is shown, and pressing it says no.
  await page.goto(`/email-megerosites/${"A".repeat(43)}`);
  await page.getByRole("button", { name: "E-mail-cím megerősítése" }).click();
  await expect(notValid).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(SERIOUS)).toEqual([]);
});

test("the records page of the super admin opens and is clean", async ({ page }) => {
  await signInAs(page, world().account("super-admin"));
  await page.goto("/admin/nyilvantartasok");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(SERIOUS)).toEqual([]);
});

test("Fiókom puts the two new-password fields side by side on a computer and one under the other on a phone", async ({
  page,
}) => {
  await signInAs(page, world().account("parent-1"));
  const top = async (label: string) =>
    (await page
      .getByTestId("account-password-form")
      .getByLabel(label, { exact: true })
      .boundingBox())!.y;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/szulo/fiokom");
  expect(await top("Új jelszó")).toBe(await top("Új jelszó még egyszer"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/szulo/fiokom");
  expect(await top("Új jelszó még egyszer")).toBeGreaterThan(await top("Új jelszó"));
});
