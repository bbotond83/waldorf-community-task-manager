import { expect, type Page } from "@playwright/test";

/**
 * Removes a family as the signed-in super administrator, from its record through the confirmation page to the result
 * (U14, W2). A family is no longer archived by one click on its record.
 */
export async function removeFamily(page: Page, familyId: string): Promise<void> {
  await page.goto(`/admin/nyilvantartasok/${familyId}`);
  await page.getByTestId("admin-family-remove-link").click();
  await page.getByTestId("admin-family-remove-form-submit-button").waitFor();
  await page.waitForLoadState("networkidle");
  await page.getByTestId("admin-family-remove-form-submit-button").click();
  await expect(page.getByTestId("admin-removal-success")).toHaveText("A család eltávolítva.");
}
