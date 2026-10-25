import { expect, type Browser, type Page } from "@playwright/test";
import { openDatabase } from "../../database/stack-support.ts";
import { signInAs, type BrowserWorld } from "./seeded-schema.ts";

/**
 * Real flows that produce data the seed does not contain, used by specs that need an open request or a notification.
 * They go through the screens a person would use, so what they leave behind is what the application itself writes.
 */

/** The first parent's family asks to give up the baking task; the request waits for an admin. */
export async function requestCancellation(page: Page, world: BrowserWorld): Promise<void> {
  await signInAs(page, world.account("parent-1"));
  await page.goto(`/szulo/feladatok/${world.id("task:1:1")}/lemondas`);
  await page.waitForLoadState("networkidle");
  await page.getByTestId("cancellation-reason-input").fill("Átmeneti akadály.");
  await page.getByTestId("cancellation-request-form-submit-button").click();
  await expect(page.getByTestId("cancellation-request-form-state-success")).toBeVisible();
}

/** The first parent's family takes the open place of the decorating task; the sign-up makes a notification. */
export async function signUpForDecorating(page: Page, world: BrowserWorld): Promise<void> {
  await signInAs(page, world.account("parent-1"));
  await page.goto(`/szulo/feladatok/${world.id("task:1:2")}`);
  await page.getByTestId("signup-form-submit-button").click();
  await expect(page.getByTestId("signup-form-state-success")).toBeVisible();
}

/**
 * A second notification for the first parent, written straight into the schema: the screens make one only when
 * something happens to a family, and a spec about read and unread needs two. It is a plain sign-up confirmation for
 * the seeded cleaning task, with a key of its own.
 */
export async function addCleaningNotice(world: BrowserWorld): Promise<void> {
  const db = await openDatabase();
  try {
    await db.query(`set search_path to "${world.schema}", pg_catalog`);
    await db.query(
      `insert into notifications (organization_id, parent_id, kind, target_type, target_ref, task_id, task_starts_at, dedupe_key)
       select p.organization_id, p.id, 'sign_up_confirmed', 'task', t.id, t.id, t.starts_at, 'browser-second-notice'
         from parents p, tasks t where p.id = $1 and t.id = $2`,
      [world.id("parent:1:1"), world.id("task:1:3")],
    );
  } finally {
    await db.end();
  }
}

/** The page of another person in a context of its own, so the first page keeps its sign-in. */
export async function withOtherPage(
  browser: Browser,
  baseURL: string | undefined,
  action: (other: Page) => Promise<void>,
): Promise<void> {
  const context = await browser.newContext({ baseURL });
  try {
    await action(await context.newPage());
  } finally {
    await context.close();
  }
}
