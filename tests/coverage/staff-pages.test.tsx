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
it("renders permitted schedule with real projections", async () => {
  signIn("staff-local");
  const page = (await import("../../app/munkatars/beosztas/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  expect(output.toLocaleLowerCase("hu")).toContain("beosztás");
  expect(output).not.toContain("protectedReason");
});
it("withholds schedule content without session", async () => {
  const page = (await import("../../app/munkatars/beosztas/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  expect(output).not.toContain('name="idempotencyKey"');
  expect(output).not.toContain("protectedReason");
});
it("renders permitted detail with real projections", async () => {
  signIn("staff-local");
  const page = (await import("../../app/munkatars/beosztas/[id]/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("schedule-garden")));
  expect(output.toLocaleLowerCase("hu")).toContain("reggeli udvari felügyelet");
  expect(output).not.toContain("protectedReason");
});
it("withholds detail content without session", async () => {
  const page = (await import("../../app/munkatars/beosztas/[id]/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("schedule-garden")));
  expect(output).not.toContain('name="idempotencyKey"');
  expect(output).not.toContain("protectedReason");
});
it("renders role layout, denial and configuration error", async () => {
  const Layout = (await import("../../app/munkatars/layout.tsx")).default;
  signIn("staff-local");
  expect(html(await Layout({ children: "Owned child" }))).toContain("Owned child");
  signIn("parent-local");
  expect(html(await Layout({ children: "Owned child" }))).not.toContain("Owned child");
  vi.stubEnv("APP_RUNTIME_MODE", "invalid");
  expect(html(await Layout({ children: "Owned child" }))).not.toContain("Owned child");
});
it("shows loading and recoverable error without secret details", async () => {
  const Loading = (await import("../../app/munkatars/loading.tsx")).default;
  const ErrorView = (await import("../../app/munkatars/error.tsx")).default;
  expect(html(<Loading />)).toContain('role="status"');
  expect(html(<ErrorView error={new Error("invented-secret")} reset={() => {}} />)).not.toContain(
    "invented-secret",
  );
});
it("preserves first filter values and denies unknown groups without granting scope", async () => {
  const { parseStaffFilters, staffFilterQuery, DEFAULT_STAFF_FILTERS } =
    await import("../../app/munkatars/_lib/filters.ts");
  const filters = parseStaffFilters({
    csoport: ["invented-unrecognized", "ignored"],
    kezdet: ["2026-08-15"],
    veg: ["2026-08-16"],
    scenario: ["invalid"],
  });
  expect(filters.groupScope.id).toBe("group-unrecognized");
  expect(filters.from).toBe("2026-08-15");
  expect(filters.to).toBe("2026-08-16");
  expect(filters.scenario).toBe(DEFAULT_STAFF_FILTERS.scenario);
  expect(new URLSearchParams(staffFilterQuery(filters)).get("csoport")).toBe(
    "invented-unrecognized",
  );
  expect(new URLSearchParams(staffFilterQuery(filters)).has("scenario")).toBe(false);
});
