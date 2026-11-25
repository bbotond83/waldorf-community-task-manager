import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { SERIOUS, bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

/**
 * The critical to-do flow (U12): a parent browses the list, takes a task, finishes it and takes the mark back, and sees
 * the task on My tasks; a coordinator opens the management page from the group page, adds, changes and frees tasks and
 * meets an outdated form; a coordinator adds tasks to an event's list; a teacher reads and has no button; a super admin
 * reaches the admin list and forms. Each page the flow opens is checked for serious or critical accessibility
 * violations and for sideways overflow. All names are invented.
 */
const world = bindSeededSchema();

test.beforeEach(async () => world().reseed());

async function expectAccessible(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(SERIOUS), label).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${label} overflows sideways`).toBeLessThanOrEqual(0);
}

test("a parent browses, takes a task, finishes it, takes the mark back and finds it on My tasks", async ({
  page,
}) => {
  const task = world().id("todo:1");
  await signInAs(page, world().account("parent-2"));
  await page.goto("/szulo/teendok");
  await expect(page.getByTestId("todo-list-page")).toBeVisible();
  await expectAccessible(page, "to-do list");

  // The default list hides a done task and a task that starts later; the toggle shows them.
  await expect(page.getByTestId(`todo-item-${task}`)).toBeVisible();
  await expect(page.getByText("Ablakpárkányok lemosása")).toHaveCount(0);
  await expect(page.getByText("Tavaszi virághagymák")).toHaveCount(0);
  await page.getByTestId("todo-filter-hidden").check();
  await page.getByTestId("todo-filter-submit").click();
  await expect(page.getByText("Ablakpárkányok lemosása")).toBeVisible();
  await expect(page.getByText("Tavaszi virághagymák")).toBeVisible();
  await expect(page.locator(".todo-status-done").first()).toContainText("Kész");

  // A filter with no match says so and offers the way back.
  await page.goto("/szulo/teendok?allapot=postponed&fontossag=1");
  await expect(page.getByTestId("todo-no-match")).toContainText("Nincs találat");
  await page.getByRole("link", { name: "Szűrők törlése" }).click();
  await expect(page.getByTestId(`todo-item-${task}`)).toBeVisible();

  // The claim button is 44 pixels tall at least and names its task for screen readers.
  const claim = page.getByTestId(`todo-claim-form-${task}-submit-button`);
  await expect(claim).toHaveAccessibleName("Vállalom: Kerítés festése");
  expect((await claim.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await claim.click();
  // The card changes at once: it is now held, and its buttons are the claimant's. The page's status region says the
  // result for screen readers, because the button that was pressed is gone after the refresh.
  await expect(page.getByTestId(`todo-item-${task}`)).toHaveAttribute("data-state", "claimed");
  const region = page.getByTestId("todo-status-region");
  await expect(region).toHaveAttribute("role", "status");
  await expect(region).toHaveAttribute("aria-live", "polite");
  await expect(region).toHaveText("Vállaltad a teendőt.");
  await expect(page.getByTestId(`todo-done-form-${task}`)).toBeVisible();

  // On the task page the status shows who holds it, with the buttons of the claimant.
  await page.goto(`/szulo/teendok/${task}`);
  await expect(page.getByTestId("todo-detail-page")).toBeVisible();
  await expect(page.getByTestId("todo-fact-claimant")).toBeVisible();
  await expect(page.getByTestId("todo-history")).toContainText("Vállalva");
  await expectAccessible(page, "task page of the claimant");
  await page.getByTestId(`todo-done-form-${task}-submit-button`).click();
  await expect(page.getByTestId("todo-fact-done")).toBeVisible();
  await expect(page.getByTestId("todo-history")).toContainText("Késznek jelölve");
  await expect(page.getByTestId("todo-status-region")).toHaveText("Késznek jelölted.");
  await page.getByTestId(`todo-undo-form-${task}-submit-button`).click();
  await expect(page.getByTestId(`todo-giveback-form-${task}`)).toBeVisible();
  await expect(page.getByTestId("todo-fact-done")).toHaveCount(0);
  await expect(page.getByTestId("todo-status-region")).toHaveText("A kész jelölés visszavonva.");

  // My tasks shows the claimed task, and the page is accessible.
  await page.goto("/szulo/feladataim");
  await expect(page.getByTestId("my-tasks-page")).toBeVisible();
  await expect(page.getByTestId("my-tasks-page")).toContainText("Kerítés festése");
  await expectAccessible(page, "My tasks");

  // Giving the task back frees it for others.
  await page.goto(`/szulo/teendok/${task}`);
  await page.getByTestId(`todo-giveback-form-${task}-submit-button`).click();
  await expect(page.getByTestId(`todo-claim-form-${task}`)).toBeVisible();
  await expect(page.getByTestId("todo-status-region")).toHaveText("Visszaadtad a teendőt.");
  await page.goto("/szulo/feladataim");
  await expect(page.getByTestId("my-tasks-page")).not.toContainText("Kerítés festése");
});

test("a task claimed by someone else shows no button to a parent of another family", async ({
  page,
}) => {
  const task = world().id("todo:2");
  await signInAs(page, world().account("parent-4"));
  await page.goto(`/szulo/teendok/${task}`);
  await expect(page.getByTestId("todo-detail-page")).toBeVisible();
  await expect(page.getByTestId("todo-fact-claimant")).toBeVisible();
  await expect(page.getByTestId("todo-detail-actions")).toHaveCount(0);
  await expect(page.getByTestId("todo-update-form")).toHaveCount(0);
  await expectAccessible(page, "task page of another family");
});

test("a coordinator opens Kezelés from the group page, adds, changes and frees tasks, and meets an outdated form", async ({
  page,
  context,
}) => {
  const group = world().id("group:1");
  const otherGroup = world().id("group:2");
  const claimed = world().id("todo:2");
  await signInAs(page, world().account("group-admin-1"));
  await page.goto(`/szulo/munkacsoportok/${group}`);
  await expect(page.getByTestId("group-todo")).toBeVisible();
  await expect(page.getByTestId("group-templates-link")).toHaveCount(0);
  // The group page keeps its read-only link to the recurring duties for a parent.
  await expect(page.getByTestId("group-recurring-link")).toBeVisible();
  await expectAccessible(page, "group page with the to-do section");
  await page.getByTestId("group-manage-link").click();
  await expect(page.getByTestId("manage-page")).toBeVisible();
  await expect(page.getByTestId("manage-tabs")).toContainText("Teendők");
  await expect(page.getByTestId("manage-tabs")).toContainText("Ismétlődő feladatok");
  await expect(page.getByTestId("manage-tabs")).toContainText("Sablonok");
  await expect(page.getByTestId("manage-tabs")).toContainText("Tagok");
  await expectAccessible(page, "management page");

  // The other three tabs open inline on the same page, one at a time, each with its own content.
  await page.getByTestId("manage-tab-recurring").click();
  await expect(page).toHaveURL(/kezeles\?ful=ismetlodo$/);
  await expect(page.getByTestId("manage-recurring")).toBeVisible();
  await expect(page.getByTestId("manage-tab-recurring")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("manage-list")).toHaveCount(0);
  await expectAccessible(page, "management page, recurring tab");
  await page.getByTestId("manage-tab-templates").click();
  await expect(page).toHaveURL(/kezeles\?ful=sablonok$/);
  await expect(page.getByTestId("manage-templates")).toBeVisible();
  await expect(page.getByTestId("manage-recurring")).toHaveCount(0);
  await expectAccessible(page, "management page, templates tab");
  await page.getByTestId("manage-tab-members").click();
  await expect(page).toHaveURL(/kezeles\?ful=tagok$/);
  await expect(page.getByTestId("parent-group-members")).toBeVisible();
  await expect(page.getByTestId("manage-templates")).toHaveCount(0);
  await expectAccessible(page, "management page, members tab");
  await page.getByTestId("manage-tab-todo").click();
  await expect(page.getByTestId("manage-list")).toBeVisible();

  // A new task: an empty topic is refused next to the field, then the task is saved.
  await page.getByTestId("manage-new-link").click();
  await expect(page.getByTestId("todo-form-page")).toBeVisible();
  await expectAccessible(page, "new task form");
  await page.getByTestId("todo-topic").fill("   ");
  await page.getByTestId("todo-form-submit-button").click();
  await expect(page.getByTestId("todo-topic-error")).toBeVisible();
  await page.getByTestId("todo-topic").fill("Homokozó árnyékoló");
  await page.getByTestId("todo-priority").selectOption("2");
  await page.getByTestId("todo-deadline").fill("2031-05-20");
  await page.getByTestId("todo-form-submit-button").click();
  await expect(page.getByTestId("todo-form-state-success")).toBeVisible();
  await page.goto(`/szulo/munkacsoportok/${group}/kezeles`);
  await expect(page.getByTestId("manage-list")).toContainText("Homokozó árnyékoló");

  // The claim of another parent is freed by the coordinator.
  await expect(page.getByTestId(`manage-item-${claimed}`)).toContainText("Vállalta");
  await page.getByTestId(`todo-free-form-${claimed}-submit-button`).click();
  await expect(page.getByTestId(`manage-item-${claimed}`)).toContainText("Szabad");
  await expect(page.getByTestId(`todo-free-form-${claimed}`)).toHaveCount(0);
  await expect(page.getByTestId("todo-status-region")).toHaveText("A teendő újra szabad.");

  // An outdated form is answered with the reload sentence, and the banner shows only then.
  const task = world().id("todo:1");
  await page.goto(`/szulo/munkacsoportok/${group}/kezeles/teendo/${task}`);
  await expect(page.getByTestId("todo-form-page")).toBeVisible();
  await expect(page.getByTestId("todo-topic")).toHaveValue("Kerítés festése");
  await expect(page.locator('[data-testid^="todo-form-state-"]')).toHaveCount(0);
  const other = await context.newPage();
  await other.goto(`/szulo/munkacsoportok/${group}/kezeles/teendo/${task}`);
  await other.getByTestId("todo-topic").fill("Kerítés festése másodszor");
  await other.getByTestId("todo-form-submit-button").click();
  await expect(other.getByTestId("todo-form-state-success")).toBeVisible();
  await other.close();
  await page.getByTestId("todo-topic").fill("Kerítés festése harmadszor");
  await page.getByTestId("todo-form-submit-button").click();
  await expect(page.getByTestId("todo-form-state-conflict")).toContainText(
    "Közben valaki módosította, töltsd újra.",
  );

  // Another group's management page is refused, never shown empty.
  await page.goto(`/szulo/munkacsoportok/${otherGroup}/kezeles`);
  await expect(page.getByTestId("manage-state-denied")).toBeVisible();
  await expect(page.getByTestId("manage-empty")).toHaveCount(0);
  await page.goto(`/szulo/munkacsoportok/${otherGroup}/kezeles/teendo`);
  await page.getByTestId("todo-topic").fill("Nem az enyém");
  await page.getByTestId("todo-form-submit-button").click();
  await expect(page.getByTestId("todo-form-state-denied")).toBeVisible();
});

test("a coordinator adds tasks to an event's list; a parent has no such page", async ({ page }) => {
  const event = world().id("event:1");
  const task = world().id("todo:1");
  await signInAs(page, world().account("group-admin-1"));
  await page.goto(`/szulo/esemenyek/${event}`);
  await expect(page.getByTestId("checklist-pull-link")).toBeVisible();
  await page.getByTestId("checklist-pull-link").click();
  await expect(page.getByTestId("todo-pull-page")).toBeVisible();
  await expectAccessible(page, "pull list");
  const submit = page.getByTestId("todo-pull-form-submit-button");
  await expect(submit).toHaveText("Kijelöltek hozzáadása (0)");
  await page.getByTestId(`todo-pull-check-${task}`).check();
  await expect(submit).toHaveText("Kijelöltek hozzáadása (1)");
  await submit.click();
  await expect(page.getByTestId("todo-pull-form-state-success")).toContainText(
    "1 teendő hozzáadva.",
  );

  // A second press adds nothing and says the task was already on the list.
  await submit.click();
  await expect(page.getByTestId("todo-pull-form-state-success")).toContainText("már a listán volt");

  // The task page now says it was pulled into the event.
  await page.goto(`/szulo/teendok/${task}`);
  await expect(page.getByTestId("todo-event-links")).toContainText("Felvéve az eseményre");

  await signInAs(page, world().account("parent-1"));
  await page.goto(`/szulo/esemenyek/${event}/teendok`);
  await expect(page.getByTestId("todo-pull-denied")).toBeVisible();
});

test("a teacher reads the list and a task and has no button; a super admin reaches the admin list and forms", async ({
  page,
}) => {
  const task = world().id("todo:1");
  await signInAs(page, world().account("teacher-1"));
  await page.goto("/teacher/teendok");
  await expect(page.getByTestId("todo-list-page")).toBeVisible();
  await expect(page.getByTestId(`todo-item-${task}`)).toBeVisible();
  await expect(page.locator('[data-testid^="todo-claim-form-"]')).toHaveCount(0);
  await expect(page.getByTestId("todo-new-link")).toHaveCount(0);
  await expectAccessible(page, "to-do list of a teacher");
  await page.goto(`/teacher/teendok/${task}`);
  await expect(page.getByTestId("todo-detail-page")).toBeVisible();
  await expect(page.getByTestId("todo-edit-link")).toHaveCount(0);
  await expect(page.locator("main form")).toHaveCount(0);

  await signInAs(page, world().account("super-admin"));
  await page.goto("/admin/teendok");
  await expect(page.getByTestId("todo-list-page")).toBeVisible();
  await expect(page.getByTestId("todo-filter-attention")).toBeVisible();
  await expectAccessible(page, "admin to-do list");
  await page.getByTestId("todo-new-link").click();
  await expect(page.getByTestId("todo-form-page")).toBeVisible();
  await page.getByTestId("todo-owner").selectOption({ index: 1 });
  await page.getByTestId("todo-topic").fill("Udvari világítás");
  await page.getByTestId("todo-form-submit-button").click();
  await expect(page.getByTestId("todo-form-state-success")).toBeVisible();
  const familyTask = world().id("todo:7");
  await page.goto(`/admin/teendok/${familyTask}/szerkesztes`);
  await expect(page.getByTestId("todo-form-page")).toBeVisible();
  await expect(page.getByTestId("todo-topic")).toHaveValue("Komposztláda szita cseréje");
  await expect(page.getByTestId("todo-owner-line")).toBeVisible();
  await expectAccessible(page, "admin form of a family task");

  // "Átadás másik családnak": the super admin hands the family's task to another family from the task page.
  await page.goto(`/admin/teendok/${familyTask}`);
  await page.getByTestId("todo-handover-link").click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/teendok/${familyTask}/szerkesztes#todo-new-owner-family$`),
  );
  const chooser = page.getByTestId("todo-new-owner-family");
  await expect(chooser).toHaveAccessibleName("Átadás másik családnak");
  await expect(chooser.locator("option").first()).toHaveText("Nem változik");
  const newFamily = (await chooser.locator("option").nth(1).textContent())!;
  await chooser.selectOption({ index: 1 });
  await page.getByTestId("todo-form-submit-button").click();
  await expect(page.getByTestId("todo-form-state-success")).toBeVisible();
  await page.goto(`/admin/teendok/${familyTask}`);
  await expect(page.getByTestId("todo-owner")).toContainText(newFamily);

  // A coordinator is not offered the hand-over: the family's task is not theirs to change.
  await signInAs(page, world().account("group-admin-1"));
  await page.goto(`/admin/teendok/${familyTask}/szerkesztes`);
  await expect(page.getByTestId("todo-form-denied")).toBeVisible();
  await expect(page.getByTestId("todo-new-owner-family")).toHaveCount(0);
});

test("a person who may not read My tasks is shown a refusal", async ({ page }) => {
  await signInAs(page, world().account("teacher-1"));
  await page.goto("/szulo/feladataim");
  await expect(page.getByTestId("my-tasks-page")).toHaveCount(0);
});
