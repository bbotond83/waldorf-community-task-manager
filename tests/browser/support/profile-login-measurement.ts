import { expect, type Page, type Request } from "@playwright/test";
import type { SyntheticProfile } from "../../../src/runtime/synthetic/profiles.ts";

export type LoginMeasurement = {
  profile: string;
  destination: string;
  elapsed: number | null;
  observedElapsed: number;
  requestElapsedLowerBound: number | null;
  result: "success" | "over-budget" | "failed";
  error?: string;
  requests: { path: string; method: string; duration: number }[];
};

export function assertLoginDuration(elapsed: number) {
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > 5000) {
    throw new Error(`Profile login must complete within 5000 ms; observed ${elapsed} ms`);
  }
}

export async function assertProfileMainReady(page: Page, profile: SyntheticProfile) {
  await expect(
    page.getByTestId(
      profile.role === "parent"
        ? "parent-duties-page"
        : profile.role === "kindergarten-teacher"
          ? "teacher-schedule-page"
          : "admin-dashboard-page",
    ),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${profile.homePath.replaceAll("/", "\\/")}(\\?.*)?$`));
  await expect(page.getByTestId("app-shell-profile-summary")).toContainText(profile.label);
  for (const item of profile.navigation) {
    const link = page.getByTestId(`app-shell-navigation-${item.id}`);
    await expect(link).toBeVisible();
    await expect(link).toBeEnabled();
    await expect(link).toHaveAttribute("href", item.href);
  }
  if (profile.role === "parent") {
    await expect(
      page.getByRole("heading", { name: "Családi feladatok", exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("duties")).toBeVisible();
    await expect(page.getByTestId("duty-list").locator("li").first()).toBeVisible();
    await expect(page.getByTestId("duty-filter-select")).toBeEnabled();
    await expect(page.getByTestId("duty-filter-submit-button")).toBeEnabled();
  } else if (profile.role === "kindergarten-teacher") {
    await expect(page.getByRole("heading", { name: "Beosztás", exact: true })).toBeVisible();
    await expect(page.getByTestId("teacher-schedule")).toBeVisible();
    await expect(
      page.getByTestId("teacher-schedule-table").locator("tbody tr").first(),
    ).toBeVisible();
    await expect(page.getByTestId("teacher-schedule-group-select")).toBeEnabled();
    await expect(page.getByTestId("teacher-schedule-filter-submit-button")).toBeEnabled();
  } else {
    await expect(page.getByRole("heading", { name: "Áttekintés", exact: true })).toBeVisible();
    for (const id of [
      "admin-dashboard-summary",
      "admin-dashboard-records-state",
      "admin-dashboard-tasks-state",
      "admin-dashboard-queue-state",
    ]) {
      await expect(page.getByTestId(id)).toBeVisible();
      await expect(page.getByTestId(id)).toHaveText(/^\d+$/);
    }
    await expect(page.getByTestId("app-shell-navigation-admin-tasks")).toBeEnabled();
  }
}

export async function measureProfileLogin(
  page: Page,
  profile: SyntheticProfile,
  record: (measurement: LoginMeasurement) => void = () => {},
) {
  const requests: LoginMeasurement["requests"] = [];
  const requestStarts = new Map<object, number>();
  let observedSubmission: number | undefined;
  const onRequest = (request: Request) => {
    requestStarts.set(request, Date.now());
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/synthetic/session")
      observedSubmission = Date.now();
  };
  const onFinished = (request: Request) => {
    requests.push({
      path: new URL(request.url()).pathname,
      method: request.method(),
      duration: Date.now() - (requestStarts.get(request) ?? Date.now()),
    });
  };
  page.on("request", onRequest);
  page.on("requestfinished", onFinished);
  page.on("requestfailed", onFinished);
  let elapsed: number | null = null;
  let failure: unknown;
  const observedStart = Date.now();
  try {
    await page.evaluate(() => {
      sessionStorage.removeItem("login-performance-start");
      document.addEventListener(
        "submit",
        () => {
          sessionStorage.setItem(
            "login-performance-start",
            String(performance.timeOrigin + performance.now()),
          );
        },
        { once: true },
      );
    });
    await page.getByTestId(`profile-selector-${profile.id}-button`).click();
    await expect(
      page.getByRole("heading", { name: `Üdvözlünk, ${profile.label}!`, exact: true }),
    ).toBeVisible();
    const home = profile.navigation.find((item) => item.href === profile.homePath);
    if (!home) throw new Error(`Missing main navigation for ${profile.id}`);
    await page.getByTestId(`app-shell-navigation-${home.id}`).click();
    await assertProfileMainReady(page, profile);
  } catch (error) {
    failure = error;
  } finally {
    elapsed = await page
      .evaluate(() => {
        const start = sessionStorage.getItem("login-performance-start");
        return start === null ? null : performance.timeOrigin + performance.now() - Number(start);
      })
      .catch(() => null);
    page.off("request", onRequest);
    page.off("requestfinished", onFinished);
    page.off("requestfailed", onFinished);
    // Preserve failed/over-budget samples before assertions can terminate the test.
    record({
      profile: profile.id,
      destination: profile.homePath,
      elapsed,
      observedElapsed: Date.now() - observedStart,
      requestElapsedLowerBound:
        observedSubmission === undefined ? null : Date.now() - observedSubmission,
      result:
        failure || elapsed === null || !Number.isFinite(elapsed) || elapsed < 0
          ? "failed"
          : elapsed > 5000
            ? "over-budget"
            : "success",
      ...(failure ? { error: failure instanceof Error ? failure.message : String(failure) } : {}),
      requests,
    });
  }
  if (failure) throw failure;
  if (elapsed === null) throw new Error("Login submission timer was not recorded");
  assertLoginDuration(elapsed);
  return elapsed;
}

export function permittedNavigationIds(profile: SyntheticProfile) {
  // AdminLayout's existing withCoreNavigation adds these scoped core pages to all administrators.
  return new Set([
    ...profile.navigation.map((item) => item.id),
    ...(profile.homePath === "/admin" ? ["admin-records", "admin-archive"] : []),
  ]);
}

export async function exercisePrimaryControl(page: Page, profile: SyntheticProfile) {
  if (profile.role === "parent") {
    await page.getByTestId("duty-filter-submit-button").click();
    await assertProfileMainReady(page, profile);
  } else if (profile.role === "kindergarten-teacher") {
    await page.getByTestId("teacher-schedule-filter-submit-button").click();
    await assertProfileMainReady(page, profile);
  } else {
    await page.getByTestId("app-shell-navigation-admin-tasks").click();
    await expect(page).toHaveURL(/\/admin\/feladatok$/);
    await expect(
      page.getByRole("heading", { name: "Feladatok és események", exact: true }),
    ).toBeVisible();
  }
}
