import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { COPY } from "../../src/identity/copy.ts";
import { SERIOUS, bindSeededSchema, signOut } from "./support/seeded-schema.ts";

// The page shows no records, so the project's schema is emptied and left empty.
bindSeededSchema({ seed: false });

test("@a11y the no-access page has no serious or critical accessibility violations", async ({
  page,
}) => {
  await page.goto("/hozzaferes-megtagadva");
  await expect(page.getByRole("heading", { name: "Nincs jogosultság", exact: true })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(SERIOUS).map((violation) => violation.id)).toEqual([]);
});

test("the no-access page explains what to do and offers sign-out", async ({ page }) => {
  await page.goto("/hozzaferes-megtagadva");
  await expect(page.getByTestId("access-guidance")).toHaveText(COPY.noAccess.guidance);
  await signOut(page);
  await expect(page).toHaveURL(/\/bejelentkezes$/);
});
