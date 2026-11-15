import { expect, test, type Page } from "@playwright/test";
import { bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

/**
 * Takes the screenshots of the working-group pages for the owner's comparison with the Stitch designs (team practice:
 * owner review, no automatic picture comparison). It does nothing unless `WORKING_GROUP_SCREENSHOTS` names the folder to
 * write to. Every shot first checks that the page is the intended one and not an error, denied or not-found page.
 */
const FOLDER = process.env.WORKING_GROUP_SCREENSHOTS;
test.skip(!FOLDER, "set WORKING_GROUP_SCREENSHOTS to a folder to take the screenshots");

const world = bindSeededSchema();

const SIZES = {
  phone: { width: 390, height: 844 },
  computer: { width: 1280, height: 900 },
} as const;

async function shoot(page: Page, name: string, expectHeading: string) {
  await page.waitForLoadState("networkidle");
  const heading = await page.locator("h1").first().innerText();
  expect(heading, `${name}: the page is the intended one`).toBe(expectHeading);
  const body = await page.locator("body").innerText();
  expect(body, `${name}: no error or denied page`).not.toMatch(
    /Nincs jogosultság|Hiba történt|nem érhető el|This page could not be found|Application error|Internal Server Error/,
  );
  for (const [label, size] of Object.entries(SIZES)) {
    await page.setViewportSize(size);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${FOLDER}/${name}-${label}.png`, fullPage: true });
  }
}

const groupPath = (area: string, n: number) =>
  `/${area}/munkacsoportok/${world().id(`group:${n}`)}`;

test("screenshots of the parent, teacher and admin group pages in each state", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "one browser is enough for the pictures");
  const joinButton = page.getByRole("button", { name: "Csatlakozom", exact: true });
  const leaveButton = page.getByRole("button", { name: "Kilépek", exact: true });

  // The parent who is not yet a member: the first of the six groups where the join button shows.
  await signInAs(page, world().account("parent-1"));
  let n = 1;
  for (; n <= 6; n += 1) {
    await page.goto(groupPath("szulo", n));
    await expect(page.getByTestId("parent-group-page")).toBeVisible();
    if ((await joinButton.count()) > 0) break;
  }
  const groupName = await page.locator("h1").first().innerText();
  await shoot(page, "1-szulo-nem-tag", groupName);
  await joinButton.click();
  await expect(page.getByTestId("parent-group-confirmation")).toBeVisible();
  await shoot(page, "2-szulo-csatlakozott", groupName);
  await leaveButton.click();
  await expect(page.getByTestId("parent-group-leave-confirm")).toBeVisible();
  await shoot(page, "3-szulo-kilepes-megerosites", groupName);

  // A coordinator who presses Kilépek is told the right ends with it.
  await signInAs(page, world().account("group-admin-1"));
  await page.goto(groupPath("szulo", 1));
  await leaveButton.click();
  await expect(page.getByTestId("parent-group-coordinator-warning")).toBeVisible();
  await shoot(page, "4-szulo-koordinator-kilepes", "Játszókert");

  await signInAs(page, world().account("teacher-1"));
  await page.goto(groupPath("teacher", 1));
  await expect(page.getByTestId("teacher-group-members")).toBeVisible();
  await shoot(page, "5-pedagogus", "Játszókert");

  // The super admin appoints a member, then takes every coordinator right of the group back.
  await signInAs(page, world().account("super-admin"));
  await page.goto(groupPath("admin", 1));
  await expect(page.getByTestId("admin-group-members")).toBeVisible();
  await shoot(page, "6-admin", "Játszókert");
  const members = page.getByTestId("admin-group-members");
  const appoint = members.getByRole("button", { name: "Koordinátorrá teszem" });
  await appoint.first().click();
  await expect(page.getByText("Koordinátor lett.")).toBeVisible();
  await shoot(page, "7-admin-kinevezes", "Játszókert");
  const revoke = members.getByRole("button", { name: "Visszavonom a jogot" });
  while ((await revoke.count()) > 0) {
    const left = await revoke.count();
    await revoke.first().click();
    await expect(revoke).toHaveCount(left - 1);
  }
  await expect(page.getByTestId("admin-group-no-coordinator")).toBeVisible();
  await shoot(page, "8-admin-nincs-koordinator", "Játszókert");
});
