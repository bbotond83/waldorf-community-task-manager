import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import type { SeedAccount } from "../../scripts/db/seed/index.ts";
import { openDatabase } from "../database/stack-support.ts";
import { bindSeededSchema, openLinkSignedOut, signInAs, signOut } from "./support/seeded-schema.ts";

/**
 * The account and records flows of U3 that need real mail and real sign-in users: the new password, the e-mail
 * change with its confirmation link, the invitation of a parent without an account, and the removal of a parent.
 * Runs on the seeded small set against the local stack and its mail catcher.
 */
const world = bindSeededSchema();
const MAIL_API = "http://127.0.0.1:54324/api/v1";

test.beforeEach(async () => world().reseed());

async function mailFor(address: string): Promise<string> {
  const deadline = Date.now() + 15_000;
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
    if (Date.now() > deadline) throw new Error(`no mail arrived for ${address}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

async function trySignIn(page: Page, account: Pick<SeedAccount, "email" | "password">) {
  await page.goto("/bejelentkezes");
  await page.getByTestId("sign-in-email").fill(account.email);
  await page.getByTestId("sign-in-password").fill(account.password);
  await page.getByTestId("sign-in-submit").click();
}

test("a parent changes the password, and only the new one signs in", async ({ page }) => {
  const account = world().account("parent-2");
  const fresh = `Uj-${randomBytes(6).toString("hex")}-9a`;
  await signInAs(page, account);
  await page.goto("/szulo/fiokom");
  const form = page.getByTestId("account-password-form");
  await form.getByLabel("Jelenlegi jelszó").fill(account.password);
  await form.getByLabel("Új jelszó", { exact: true }).fill(fresh);
  await form.getByLabel("Új jelszó még egyszer").fill(fresh);
  await form.getByRole("button", { name: "Jelszó módosítása" }).click();
  await expect(page.getByTestId("account-password-form-state-success")).toBeVisible();
  await expect(page.getByTestId("account-password-form-state-success")).toContainText(
    "A jelszavad megváltozott.",
  );
  await signOut(page);
  await trySignIn(page, account);
  await expect(page.getByTestId("sign-in-form")).toBeVisible();
  await signInAs(page, { ...account, password: fresh });
});

/** The seed finds its users by address, so a user whose address changed must go before the next reseed. */
async function deleteAuthUser(id: string): Promise<void> {
  const db = await openDatabase();
  try {
    await db.query("delete from auth.users where id = $1", [id]);
  } finally {
    await db.end();
  }
}

test("an e-mail change waits for the link in the mail, then the new address signs in", async ({
  page,
}) => {
  const account = world().account("parent-3");
  const address = `uj-${randomBytes(5).toString("hex")}@example.test`;
  test.info().annotations.push({ type: "cleanup", description: "auth user deleted afterwards" });
  await signInAs(page, account);
  await page.goto("/szulo/fiokom");
  const form = page.getByTestId("account-email-form");
  await form.getByLabel("Új e-mail-cím").fill(address);
  await form.getByLabel("Jelenlegi jelszó").fill(account.password);
  await form.getByRole("button", { name: "Megerősítő levél küldése" }).click();
  await expect(page.getByTestId("account-email-form-state-success")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("account-email-pending")).toContainText(address);
  // The old address still signs in until the link is used.
  const text = await mailFor(address);
  const link = text.match(/\/email-megerosites\/[A-Za-z0-9_-]+/)?.[0];
  expect(link, "the mail carries the confirmation link").toBeTruthy();
  await openLinkSignedOut(page, link!);
  await page.getByTestId("email-confirm-form").getByRole("button").click();
  await expect(page.getByTestId("email-confirm-success")).toBeVisible();
  await signInAs(page, { ...account, email: address });
  await page.goto("/szulo/fiokom");
  await expect(page.getByTestId("account-signin-email")).toContainText(address);
  await expect(page.getByTestId("account-email-pending")).toHaveCount(0);
  // The link works once: a second use is no longer valid.
  await openLinkSignedOut(page, link!);
  await page.getByTestId("email-confirm-form").getByRole("button").click();
  await expect(page.getByTestId("email-confirm-not-valid")).toBeVisible();
});

test.afterEach(async () => {
  await deleteAuthUser(world().account("parent-3").id);
});

test("a pending e-mail change can be cancelled with Mégse", async ({ page }) => {
  const account = world().account("parent-4");
  await signInAs(page, account);
  await page.goto("/szulo/fiokom");
  const form = page.getByTestId("account-email-form");
  await form
    .getByLabel("Új e-mail-cím")
    .fill(`megse-${randomBytes(4).toString("hex")}@example.test`);
  await form.getByLabel("Jelenlegi jelszó").fill(account.password);
  await form.getByRole("button", { name: "Megerősítő levél küldése" }).click();
  await expect(page.getByTestId("account-email-form-state-success")).toBeVisible();
  await page.reload();
  const pending = page.getByTestId("account-email-pending");
  await expect(pending).toBeVisible();
  await pending.getByRole("button", { name: "Mégse" }).click();
  await expect(page.getByTestId("account-email-pending")).toHaveCount(0);
});

test("a super admin invites a parent without an account, and the mail arrives", async ({
  page,
}) => {
  const family = world().id("family:3");
  const parent = world().id("parent:3:2");
  await signInAs(page, world().account("super-admin"));
  await page.goto(`/admin/nyilvantartasok/${family}`);
  await expect(page.getByTestId(`admin-parent-state-${parent}`)).toContainText("Még nincs meghívó");
  await page
    .getByTestId(`admin-parent-invite-${parent}`)
    .getByRole("button", { name: "Meghívó küldése" })
    .click();
  await expect(page.getByTestId(`admin-parent-invite-${parent}-state-success`)).toBeVisible();
  await page.reload();
  await expect(page.getByTestId(`admin-parent-state-${parent}`)).toContainText("Meghívó elküldve");
  await expect(
    page.getByTestId(`admin-parent-invite-${parent}`).getByRole("button", { name: "Új meghívó" }),
  ).toBeVisible();
  const text = await mailFor("csalad3.szulo2@example.test");
  expect(text).toContain("/meghivas/");
});

test("removing a parent ends their sign-in, and the only parent of a family is refused", async ({
  page,
}) => {
  const family = world().id("family:3");
  const removed = world().id("parent:3:1");
  const account = world().account("parent-3");
  await signInAs(page, world().account("super-admin"));
  await page.goto(`/admin/nyilvantartasok/${family}/szulo/${removed}/eltavolitas`);
  await expect(page.getByTestId("admin-parent-remove-summary")).toContainText("eltávolítása");
  await page.getByTestId("admin-parent-remove-form").getByRole("button").click();
  // The page refreshes after the removal, so the form gives way to the plain "no longer in the family" line.
  await expect(page.getByTestId("admin-parent-remove-missing")).toContainText(
    "Ez a szülő már nem szerepel a családban.",
  );
  await expect(page.getByRole("link", { name: "Vissza a családhoz" })).toBeVisible();
  await signOut(page);
  await trySignIn(page, account);
  await expect(page.getByTestId("sign-in-form")).toBeVisible();
  await expect(page).toHaveURL(/\/bejelentkezes/);

  // Only one parent is left in the family now: removing them is refused with a plain text.
  await signInAs(page, world().account("super-admin"));
  await page.goto(`/admin/nyilvantartasok/${family}/szulo/${world().id("parent:3:2")}/eltavolitas`);
  await expect(page.getByTestId("admin-parent-remove-last")).toBeVisible();
  await expect(page.getByTestId("admin-parent-remove-form")).toHaveCount(0);
});
