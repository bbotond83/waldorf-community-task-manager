import { expect, test, type Page } from "@playwright/test";
import { defaultCommandDeps } from "../../../scripts/db/seed-support.ts";
import { resetSchema } from "../../../scripts/db/reset.ts";
import { defaultSeedDeps, seedSchema } from "../../../scripts/db/seed.ts";
import { seedAccount, seedId, type SeedAccount } from "../../../scripts/db/seed/index.ts";
import { schemaForProject } from "./projects.ts";

/**
 * The one door every browser spec file goes through (NFR3.20). It registers a `beforeAll` that empties the schema of
 * the running project and, unless the spec builds its own world (`seed: false`), fills it with the small seed, so each
 * file starts from the same known data and no file depends on what an earlier one left. The returned object is read
 * inside tests and hooks only: the schema is not known when the file is loaded, because each project owns another one.
 *
 * `tests/browser/support/uses-seeded-schema.test.ts` fails when a spec file does not call this function.
 */
export interface BrowserWorld {
  readonly schema: string;
  readonly seeded: boolean;
  /** A seeded account by its tag (`super-admin`, `group-admin-1`, `teacher-1`, `parent-1` ...); only when seeded. */
  account(tag: string): SeedAccount;
  /** The derived id of a seeded record (`task:1:1`, `family:2`, `group:1` ...). */
  id(key: string): string;
  /** Empties and seeds the schema again, for a test that changes data and must not leave it for the next one. */
  reseed(): Promise<void>;
}

export interface BrowserSchemaOptions {
  /** `false` empties the schema and leaves it empty, for a spec that creates its own records. Default: seed. */
  seed?: boolean;
}

export function bindSeededSchema(options: BrowserSchemaOptions = {}): () => BrowserWorld {
  const seeded = options.seed !== false;
  let current: BrowserWorld | undefined;
  const fill = async (schema: string) => {
    await resetSchema({ ...defaultCommandDeps(), log: () => undefined }, { schema });
    if (seeded) {
      await seedSchema({ ...defaultSeedDeps(), log: () => undefined }, { schema, size: "small" });
    }
  };
  test.beforeAll(async ({}, testInfo) => {
    const schema = schemaForProject(testInfo.project.name);
    await fill(schema);
    current = {
      schema,
      seeded,
      account: (tag) => {
        if (!seeded) throw new Error("BROWSER_WORLD_NOT_SEEDED: this spec builds its own records");
        return seedAccount(schema, tag, "small");
      },
      id: (key) => seedId(schema, key),
      reseed: () => fill(schema),
    };
  });
  return () => {
    if (!current) throw new Error("BROWSER_WORLD_NOT_READY: used before the beforeAll hook ran");
    return current;
  };
}

/**
 * Waits until the person is signed in: the browser has left the sign-in page (the sign-in action and the sign-in
 * page both send a signed-in person to the home page of their role) and holds the session cookie. It does not
 * look at the role home itself, because an account without a linked record gets an access-denied page there.
 */
export async function expectSignedIn(page: Page): Promise<void> {
  await expect(page).not.toHaveURL(/\/bejelentkezes(\?|$)/);
  await expect
    .poll(async () =>
      (await page.context().cookies()).some((cookie) => cookie.name === "wb_access"),
    )
    .toBe(true);
}

/**
 * Signs in through the real sign-in screen and waits until the role home page has opened. Answers how long the
 * sign-in took in milliseconds, for the timing check.
 */
export async function signInAs(page: Page, account: SeedAccount): Promise<number> {
  await page.goto("/bejelentkezes");
  // An existing session sends the visit away from the sign-in page: end it first, then ask for the form again.
  if (!(await page.getByTestId("sign-in-form").isVisible())) {
    await signOut(page);
    await page.goto("/bejelentkezes");
  }
  await page.getByTestId("sign-in-email").fill(account.email);
  await page.getByTestId("sign-in-password").fill(account.password);
  const started = Date.now();
  await page.getByTestId("sign-in-submit").click();
  await expectSignedIn(page);
  await expect(page.getByTestId("sign-out-button").first()).toBeVisible();
  return Date.now() - started;
}

/** Ends the current session with the shell's sign-out button and waits for the sign-in form. */
export async function signOut(page: Page): Promise<void> {
  await page.getByTestId("sign-out-button").first().click();
  await expect(page.getByTestId("sign-in-form")).toBeVisible();
}

/** Signs in as a seeded account and opens a page. */
export async function signInAndOpen(page: Page, account: SeedAccount, path: string): Promise<void> {
  await signInAs(page, account);
  await page.goto(path);
}

export const SERIOUS = ({ impact }: { impact?: string | null }) =>
  impact === "serious" || impact === "critical";
