import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { SERIOUS, bindSeededSchema, signInAs } from "./support/seeded-schema.ts";

const world = bindSeededSchema();

test.beforeEach(async () => world().reseed());

/** The group page of each role area (U4, W4): a parent, a teacher and an administrator each read it in their own area. */
const BASE = {
  parent: "/szulo/munkacsoportok",
  teacher: "/teacher/munkacsoportok",
  admin: "/admin/munkacsoportok",
} as const;
type Area = keyof typeof BASE;

const REACH: Record<string, readonly Area[]> = {
  "parent-1": ["parent"],
  "group-admin-1": ["parent", "admin"],
  "teacher-1": ["teacher"],
  "super-admin": ["admin"],
};

const groupPath = (area: Area, n: number) => `${BASE[area]}/${world().id(`group:${n}`)}`;
const joinButton = (page: Page) => page.getByRole("button", { name: "Csatlakozom", exact: true });
const leaveButton = (page: Page) => page.getByRole("button", { name: "Kilépek", exact: true });

/** Opens the first of the six groups where the parent has the wanted button (they belong to one or two at the start). */
async function openGroupWithButton(page: Page, wanted: "Csatlakozom" | "Kilépek"): Promise<number> {
  for (let n = 1; n <= 6; n += 1) {
    await page.goto(groupPath("parent", n));
    await expect(page.getByTestId("parent-group-page")).toBeVisible();
    if ((await page.getByRole("button", { name: wanted, exact: true }).count()) > 0) return n;
  }
  throw new Error(`no seeded group offers ${wanted}`);
}

for (const [tag, areas] of Object.entries(REACH)) {
  test(`${tag}: each group page opens in the role's own areas and is refused in the others`, async ({
    page,
  }) => {
    await signInAs(page, world().account(tag));
    for (const area of Object.keys(BASE) as Area[]) {
      await page.goto(groupPath(area, 1));
      if (areas.includes(area)) {
        await expect(page.getByRole("heading", { level: 1, name: "Játszókert" })).toBeVisible();
        await expect(page.getByTestId(`${area}-group-members`)).toBeVisible();
        await expect(
          page
            .getByTestId(`${area}-group-members`)
            .getByText("Koordinátor", { exact: true })
            .first(),
        ).toBeVisible();
      } else {
        await expect(page.getByText("Nincs jogosultság", { exact: true }).first()).toBeVisible();
        await expect(page.getByTestId(`${area}-group-page`)).toHaveCount(0);
      }
    }
  });
}

test("a card of the list opens its group page", async ({ page }) => {
  await signInAs(page, world().account("parent-1"));
  await page.goto(BASE.parent);
  await page.getByRole("link", { name: "Karbantartó", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${world().id("group:2")}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Karbantartó" })).toBeVisible();
  await page.getByRole("link", { name: "Vissza a munkacsoportokhoz" }).click();
  await expect(page).toHaveURL(/\/szulo\/munkacsoportok$/);
});

test("a parent joins from the keyboard and leaves after a confirmation", async ({ page }) => {
  await signInAs(page, world().account("parent-1"));
  await openGroupWithButton(page, "Csatlakozom");
  await expect(leaveButton(page)).toHaveCount(0);
  const button = joinButton(page);
  const box = await button.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("parent-group-confirmation")).toHaveText(
    "Csatlakoztál a munkacsoporthoz.",
  );
  await expect(leaveButton(page)).toBeVisible();
  await expect(joinButton(page)).toHaveCount(0);
  await expect(page.getByText("Te", { exact: true })).toBeVisible();

  await leaveButton(page).click();
  await expect(page.getByTestId("parent-group-leave-confirm")).toBeVisible();
  await page.getByRole("button", { name: "Mégsem" }).click();
  await expect(leaveButton(page)).toBeVisible();
  await leaveButton(page).click();
  await page.getByRole("button", { name: "Igen, kilépek" }).click();
  await expect(page.getByTestId("parent-group-confirmation")).toHaveText(
    "Kiléptél a munkacsoportból.",
  );
  await expect(joinButton(page)).toBeVisible();
  await expect(page.getByText("Te", { exact: true })).toHaveCount(0);
});

test("a coordinator is warned before leaving, and Mégsem keeps the right", async ({ page }) => {
  await signInAs(page, world().account("group-admin-1"));
  await page.goto(groupPath("parent", 1));
  await leaveButton(page).click();
  await expect(page.getByTestId("parent-group-coordinator-warning")).toHaveText(
    "Ha kilépsz, megszűnik a koordinátori jogod ebben a csoportban.",
  );
  await page.getByRole("button", { name: "Mégsem" }).click();
  await expect(page.getByTestId("parent-group-coordinator-warning")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByTestId("parent-group-members").getByText("Koordinátor", { exact: true }).first(),
  ).toBeVisible();
});

test("the teacher page has no button, and the group admin's page has no coordinator action", async ({
  page,
}) => {
  await signInAs(page, world().account("teacher-1"));
  await page.goto(groupPath("teacher", 1));
  await expect(page.getByTestId("teacher-group-page")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Csatlakozom|Kilépek|Koordinátor|Visszavonom/ }),
  ).toHaveCount(0);

  await signInAs(page, world().account("group-admin-1"));
  await page.goto(groupPath("admin", 1));
  await expect(page.getByTestId("admin-group-members")).toBeVisible();
  await expect(page.getByTestId("admin-group-members").getByRole("button")).toHaveCount(0);
  await expect(page.getByTestId("admin-group-member-note")).toHaveCount(0);
});

test("a super admin appoints and revokes a coordinator, and a group left bare says so", async ({
  page,
}) => {
  await signInAs(page, world().account("super-admin"));
  await page.goto(groupPath("admin", 1));
  await expect(page.getByTestId("admin-group-member-note")).toContainText(
    "Koordinátor csak a csoport tagja lehet.",
  );
  const members = page.getByTestId("admin-group-members");
  await expect(members).toBeVisible();
  const before = await members.getByText("Koordinátor", { exact: true }).count();

  // A parent without an active account cannot be appointed (a refusal in words); the first one that can, is.
  const appointButtons = members.getByRole("button", { name: "Koordinátorrá teszem" });
  await expect(appointButtons.first()).toBeVisible();
  const candidates = await appointButtons.count();
  let appointed = false;
  for (let index = 0; index < candidates && !appointed; index += 1) {
    await appointButtons.nth(index).click();
    const success = page.getByText("Koordinátor lett.", { exact: true });
    const refusal = page.getByText("Csak aktív fiókkal rendelkező szülő lehet koordinátor.");
    await expect(success.or(refusal).first()).toBeVisible();
    appointed = (await success.count()) > 0;
  }
  expect(appointed, "one member can be appointed").toBe(true);
  await expect(members.getByText("Koordinátor", { exact: true })).toHaveCount(before + 1);

  // Revoke every coordinator: the page then says that nobody coordinates the group.
  const revokeButtons = members.getByRole("button", { name: "Visszavonom a jogot" });
  while ((await revokeButtons.count()) > 0) {
    const left = await revokeButtons.count();
    await revokeButtons.first().click();
    await expect(revokeButtons).toHaveCount(left - 1);
  }
  await expect(page.getByTestId("admin-group-no-coordinator")).toHaveText(
    "Ennek a csoportnak most nincs koordinátora. Amíg nincs, csak az adminisztrátor kezelheti.",
  );
  await expect(members.getByText("Koordinátor", { exact: true })).toHaveCount(0);
  await expect(members.getByRole("button", { name: "Koordinátorrá teszem" }).first()).toBeVisible();
});

test("a missing group reads as unavailable for every role, with the way back", async ({ page }) => {
  await signInAs(page, world().account("parent-1"));
  for (const id of ["00000000-0000-4000-8000-000000000000", "nincs-ilyen"]) {
    await page.goto(`${BASE.parent}/${id}`);
    await expect(page.getByTestId("parent-group-unavailable")).toContainText(
      "Ez a munkacsoport nem érhető el.",
    );
    await expect(page.getByTestId("parent-group-error")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Vissza a munkacsoportokhoz" })).toHaveAttribute(
      "href",
      BASE.parent,
    );
  }
});

test("the group pages fit a phone, show a visible focus and have no serious accessibility problem", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const cases: readonly (readonly [string, Area])[] = [
    ["parent-1", "parent"],
    ["teacher-1", "teacher"],
    ["super-admin", "admin"],
  ];
  for (const [tag, area] of cases) {
    await signInAs(page, world().account(tag));
    await page.goto(groupPath(area, 1));
    await expect(page.getByTestId(`${area}-group-page`)).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${area} page overflows sideways`).toBeLessThanOrEqual(0);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter(SERIOUS), area).toEqual([]);
  }
  await signInAs(page, world().account("parent-1"));
  await openGroupWithButton(page, "Csatlakozom");
  await page.keyboard.press("Tab");
  await joinButton(page).focus();
  const outline = await joinButton(page).evaluate(
    (element) => getComputedStyle(element).outlineStyle,
  );
  expect(outline).not.toBe("none");
});
