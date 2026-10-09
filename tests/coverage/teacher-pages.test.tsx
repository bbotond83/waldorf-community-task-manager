import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { createSyntheticSessionToken } from "../../src/runtime/session/session.ts";
import { getSyntheticProfile } from "../../src/runtime/synthetic/profiles.ts";
import { resetSyntheticAdminFixtures } from "../../src/admin-core/synthetic-admin.ts";
import { resetSyntheticAdvancedFixtures } from "../../src/admin-advanced/index.ts";
import { resetSyntheticParentState } from "../../src/parent-web/index.ts";
const boundary = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (boundary.token ? { value: boundary.token } : undefined) }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error("REDIRECT:" + path);
  },
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
beforeEach(() => {
  vi.stubEnv("APP_RUNTIME_MODE", "synthetic");
  boundary.token = undefined;
  resetSyntheticAdminFixtures();
  resetSyntheticAdvancedFixtures();
  resetSyntheticParentState();
});
afterEach(() => vi.unstubAllEnvs());
function signIn(id: string) {
  boundary.token = createSyntheticSessionToken(getSyntheticProfile(id)!);
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
  signIn("kindergarten-teacher-local");
  const page = (await import("../../app/teacher/schedule/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  expect(output.toLocaleLowerCase("hu")).toContain("beosztás");
  expect(output).not.toContain("protectedReason");
});
it("Teacher withholds schedule content without session", async () => {
  const page = (await import("../../app/teacher/schedule/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  await expect(page(props(""))).rejects.toThrow("REDIRECT:/");
});
it("Teacher renders permitted detail with real projections", async () => {
  signIn("kindergarten-teacher-local");
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
  signIn("kindergarten-teacher-local");
  expect(html(await Layout({ children: "Owned child" }))).toContain("Owned child");
  signIn("parent-local");
  expect(html(await Layout({ children: "Owned child" }))).not.toContain("Owned child");
  vi.stubEnv("APP_RUNTIME_MODE", "invalid");
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
 signIn("kindergarten-teacher-local");
 const Page = (await import("../../app/teacher/schedule/page.tsx")).default;
 const output = html(await Page({ searchParams: Promise.resolve({ from: "2026-02-30", to: "2026-03-01" }) }));
 expect(output).toContain("teacher-schedule-validation"); expect(output).not.toContain("Kitalált Dóra");
});
it("Teacher source absence has equal explicit detail fields", async () => {
 signIn("kindergarten-teacher-local");
 const Page = (await import("../../app/teacher/schedule/[id]/page.tsx")).default;
 const output = html(await Page({ params: Promise.resolve({ id: "schedule-coverage" }), searchParams: Promise.resolve({ groupId: "group-sunflower" }) }));
 for (const text of ["Nincs kijelölt felelős", "Nincs beosztott", "Nincs elérhető állapot"]) expect(output).toContain(text);
 expect(output).not.toContain("sourceRecordId"); expect(output).not.toContain("organizationId");
});
it("Teacher denied group and item expose no requested identifiers or names", async () => {
 signIn("kindergarten-teacher-local");
 const Page = (await import("../../app/teacher/schedule/page.tsx")).default;
 const Detail = (await import("../../app/teacher/schedule/[id]/page.tsx")).default;
 const output = html(await Page({ searchParams: Promise.resolve({ groupId: "group-ungranted" }) }));
 expect(output).toContain("teacher-schedule-denied"); expect(output).not.toContain("group-ungranted"); expect(output).not.toContain("Kitalált");
 const detail = html(await Detail({ params: Promise.resolve({ id: "schedule-unrelated" }), searchParams: Promise.resolve({}) }));
 expect(detail).not.toContain("schedule-unrelated"); expect(detail).toContain("teacher-detail-denied");
});
it("Teacher fixture failures and retry preserve safe current business filters", async () => {
 signIn("kindergarten-teacher-local");
 const Page = (await import("../../app/teacher/schedule/page.tsx")).default;
 for (const fixture of ["retryable", "terminal", "empty", "denied"]) {
  const output = html(await Page({ searchParams: Promise.resolve({ fixture, from: "2026-08-14", to: "2026-08-14" }) }));
  expect(output).not.toContain("Kitalált Fanni");
  expect(output).not.toContain("sourceRecordId");
  if (fixture === "retryable") { expect(output).toContain("teacher-schedule-retry-link"); expect(output).toContain("from=2026-08-14"); expect(output).not.toContain("fixture=retryable"); }
  if (fixture === "terminal") expect(output).not.toContain("teacher-schedule-retry-link");
 }
});
