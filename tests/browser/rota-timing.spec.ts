import { expect, test } from "@playwright/test";
import { resetSchema } from "../../scripts/db/reset.ts";
import { defaultSeedDeps, seedSchema } from "../../scripts/db/seed.ts";
import { defaultCommandDeps } from "../../scripts/db/seed-support.ts";
import { seedAccount } from "../../scripts/db/seed/index.ts";
import { bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

/**
 * Times the pages of NFR9.1 and a full-year publish on the 30-family set (NFR9.1, NFR9.2). It does nothing unless
 * `ROTA_TIMING` is set, so the ordinary runs never fill the schema with the large set.
 */
const ENABLED = Boolean(process.env.ROTA_TIMING);
test.skip(!ENABLED, "set ROTA_TIMING=1 to time the rota pages on the 30-family set");

const world = bindSeededSchema({ seed: false });

test.beforeAll(async ({}, testInfo) => {
  const schema = world().schema;
  await resetSchema({ ...defaultCommandDeps(), log: () => undefined }, { schema });
  await seedSchema({ ...defaultSeedDeps(), log: () => undefined }, { schema, size: "large" });
  testInfo.annotations.push({ type: "schema", description: schema });
});

async function timed(page: import("@playwright/test").Page, path: string): Promise<number> {
  const started = Date.now();
  await page.goto(path, { waitUntil: "load" });
  return Date.now() - started;
}

test("rota pages and a full-year publish on the 30-family set", async ({ page }) => {
  const schema = world().schema;
  const account = (tag: string) => seedAccount(schema, tag, "large");
  await signInAs(page, account("super-admin"));

  await page.goto("/admin/beosztas");
  let started = Date.now();
  await page.getByTestId("admin-rota-draft-form-submit-button").click();
  await page.getByTestId("admin-rota-weeks").waitFor();
  const draftMs = Date.now() - started;
  started = Date.now();
  await page.getByTestId("admin-rota-publish-form-submit-button").click();
  await page.getByTestId("admin-rota-head").getByText("Közzétéve").first().waitFor();
  const publishMs = Date.now() - started;

  const results: Record<string, number> = { draftMs, publishMs };
  for (const [name, path] of [
    ["admin-tanev", "/admin/tanev"],
    ["admin-beosztas", "/admin/beosztas"],
  ] as const) {
    results[name] = Math.max(
      await timed(page, path),
      await timed(page, path),
      await timed(page, path),
    );
  }
  await signInAs(page, account("parent-1"));
  results["parent-overview"] = Math.max(
    await timed(page, "/szulo/beosztas"),
    await timed(page, "/szulo/beosztas"),
    await timed(page, "/szulo/beosztas"),
  );
  const href = await page.locator('a[href^="/szulo/beosztas/"]').first().getAttribute("href");
  results["duty-card"] = Math.max(
    await timed(page, href!),
    await timed(page, href!),
    await timed(page, href!),
  );
  console.log(`ROTA_TIMING ${JSON.stringify(results)}`);
  expect(publishMs).toBeLessThan(5000);
  expect(draftMs).toBeLessThan(5000);
  for (const name of ["admin-tanev", "admin-beosztas", "parent-overview", "duty-card"]) {
    expect(results[name], name).toBeLessThan(2000);
  }
});
