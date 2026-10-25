import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { requestWorld, type RoleKey } from "../support/request-world.ts";
vi.mock("server-only", () => ({}));
vi.mock("../../app/_identity/production-request.ts", async () =>
  (await import("../support/request-world.ts")).requestWorldModule(),
);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error("REDIRECT:" + path);
  },
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
beforeEach(() => requestWorld.reset());
function signIn(role: RoleKey) {
  requestWorld.signIn(role);
}
const props = (id: string, query = {}) => ({
  params: Promise.resolve({ id }),
  searchParams: Promise.resolve(query),
  children: "Owned child",
});
function html(node: ReactNode) {
  return renderToStaticMarkup(node);
}
it("Teacher renders permitted schedule with real projections", async () => {
  signIn("teacher");
  const page = (await import("../../app/teacher/schedule/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  expect(output.toLocaleLowerCase("hu")).toContain("beosztás");
  expect(output).not.toContain("protectedReason");
});
it("Teacher first visit lists every granted group with empty filter fields", async () => {
  signIn("teacher");
  const page = (await import("../../app/teacher/schedule/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  expect(output).toContain("Minden csoport");
  expect(output).not.toContain("required");
  expect(output).not.toMatch(/name="from"[^>]*value="[^"]/);
  expect(output).not.toMatch(/name="to"[^>]*value="[^"]/);
  for (const id of ["schedule-garden", "schedule-crafts", "schedule-coverage"])
    expect(output).toContain(`teacher-schedule-row-${id}`);
  // The source word "Ütemezett" is shown as the shared word, with its symbol.
  expect(output).toContain("Ütemezve");
  expect(output).not.toContain("Ütemezett");
  expect(output).toContain('data-status-icon="calendar"');
});
it("Teacher single date and chosen group narrow the list, a swapped range keeps its message", async () => {
  signIn("teacher");
  const page = (await import("../../app/teacher/schedule/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const afterFrom = html(await page({ ...props(""), searchParams: Promise.resolve({ from: "2026-08-14" }) }));
  expect(afterFrom).not.toContain("teacher-schedule-row-schedule-garden");
  expect(afterFrom).toContain("teacher-schedule-row-schedule-crafts");
  const sunflower = html(
    await page({ ...props(""), searchParams: Promise.resolve({ groupId: "group-sunflower" }) }),
  );
  expect(sunflower).toContain("teacher-schedule-row-schedule-coverage");
  expect(sunflower).not.toContain("teacher-schedule-row-schedule-crafts");
  const swapped = html(
    await page({
      ...props(""),
      searchParams: Promise.resolve({ from: "2026-08-20", to: "2026-08-12" }),
    }),
  );
  expect(swapped).toContain("Érvénytelen szűrés");
  expect(swapped).toContain("legfeljebb 31 napos");
});
it("Teacher withholds schedule content without session", async () => {
  const page = (await import("../../app/teacher/schedule/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  await expect(page(props(""))).rejects.toThrow("REDIRECT:/");
});
it("Teacher renders permitted detail with real projections", async () => {
  signIn("teacher");
  const page = (await import("../../app/teacher/schedule/[id]/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("schedule-garden")));
  expect(output.toLocaleLowerCase("hu")).toContain("reggeli udvari felügyelet");
  expect(output).not.toContain("protectedReason");
});
it("Teacher withholds detail content without session", async () => {
  const page = (await import("../../app/teacher/schedule/[id]/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  await expect(page(props("schedule-garden"))).rejects.toThrow("REDIRECT:/");
});
it("Teacher renders role layout, denial and configuration error", async () => {
  const Layout = (await import("../../app/teacher/layout.tsx")).default;
  signIn("teacher");
  expect(html(await Layout({ children: "Owned child" }))).toContain("Owned child");
  signIn("parent");
  expect(html(await Layout({ children: "Owned child" }))).not.toContain("Owned child");
  requestWorld.setUnavailable(true);
  expect(html(await Layout({ children: "Owned child" }))).not.toContain("Owned child");
});
it("Teacher shows loading and recoverable error without secret details", async () => {
  const Loading = (await import("../../app/teacher/loading.tsx")).default;
  const ErrorView = (await import("../../app/teacher/error.tsx")).default;
  expect(html(<Loading />)).toContain('role="status"');
  expect(html(<ErrorView error={new Error("invented-secret")} reset={() => {}} />)).not.toContain(
    "invented-secret",
  );
});
it("Teacher invalid filters render safe correction and no rows", async () => {
 signIn("teacher");
 const Page = (await import("../../app/teacher/schedule/page.tsx")).default;
 const output = html(await Page({ searchParams: Promise.resolve({ from: "2026-02-30", to: "2026-03-01" }) }));
 expect(output).toContain("teacher-schedule-validation"); expect(output).not.toContain("Kitalált Dóra");
});
it("Teacher source absence has equal explicit detail fields", async () => {
 signIn("teacher");
 const Page = (await import("../../app/teacher/schedule/[id]/page.tsx")).default;
 const output = html(await Page({ params: Promise.resolve({ id: "schedule-coverage" }), searchParams: Promise.resolve({ groupId: "group-sunflower" }) }));
 for (const text of ["Nincs kijelölt felelős", "Nincs beosztott", "Nincs elérhető állapot"]) expect(output).toContain(text);
 expect(output).not.toContain("sourceRecordId"); expect(output).not.toContain("organizationId");
});
it("Teacher denied group and item expose no requested identifiers or names", async () => {
 signIn("teacher");
 const Page = (await import("../../app/teacher/schedule/page.tsx")).default;
 const Detail = (await import("../../app/teacher/schedule/[id]/page.tsx")).default;
 const output = html(await Page({ searchParams: Promise.resolve({ groupId: "group-ungranted" }) }));
 expect(output).toContain("teacher-schedule-denied"); expect(output).not.toContain("group-ungranted"); expect(output).not.toContain("Kitalált");
 const detail = html(await Detail({ params: Promise.resolve({ id: "schedule-unrelated" }), searchParams: Promise.resolve({}) }));
 expect(detail).not.toContain("schedule-unrelated"); expect(detail).toContain("teacher-detail-denied");
});
it("Teacher source failures and retry preserve safe current business filters", async () => {
  signIn("teacher");
  const Page = (await import("../../app/teacher/schedule/page.tsx")).default;
  for (const scenario of ["retryable", "terminal", "empty", "denied"] as const) {
    requestWorld.setTeacherScenario(scenario);
    const output = html(
      await Page({
        searchParams: Promise.resolve({ from: "2026-08-14", to: "2026-08-14" }),
      }),
    );
    // Failure, empty and denied answers show no row at all; the filter form still shows the chosen dates.
    expect(output).not.toContain("teacher-schedule-row-");
    expect(output).not.toContain("sourceRecordId");
    if (scenario === "retryable") {
      expect(output).toContain("teacher-schedule-retry-link");
      expect(output).toContain("from=2026-08-14");
      expect(output).not.toContain("fixture=");
    }
    if (scenario === "terminal") expect(output).not.toContain("teacher-schedule-retry-link");
  }
});
it("Teacher ignores a fixture word in the address: nothing in the page changes", async () => {
  signIn("teacher");
  const Page = (await import("../../app/teacher/schedule/page.tsx")).default;
  const plain = html(await Page({ searchParams: Promise.resolve({}) }));
  const tagged = html(await Page({ searchParams: Promise.resolve({ fixture: "terminal" }) }));
  expect(tagged).toBe(plain);
});
