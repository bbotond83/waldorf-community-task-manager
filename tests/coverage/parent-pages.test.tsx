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
it("renders permitted duties with real projections", async () => {
  signIn("parent-local");
  const page = (await import("../../app/szulo/feladatok/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  expect(output.toLocaleLowerCase("hu")).toContain("feladat");
  expect(output).not.toContain("protectedReason");
});
it("renders each duty as one whole-card link without a separate details link", async () => {
  signIn("parent-local");
  const page = (await import("../../app/szulo/feladatok/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page({ ...props(""), searchParams: Promise.resolve({ allapot: "available" }) }));
  const document = new DOMParser().parseFromString(output, "text/html");
  const cards = [...document.querySelectorAll('li[data-testid^="duty-card-"]')];
  expect(cards.length).toBeGreaterThan(0);
  for (const card of cards) {
    const links = card.querySelectorAll("a");
    expect(links).toHaveLength(1);
    const link = links[0]!;
    expect(link.getAttribute("href")).toMatch(/^\/szulo\/feladatok\/[^?]+\?allapot=available$/);
    expect(link.querySelector("h2")?.textContent).toBeTruthy();
    expect(card.querySelectorAll("button, a a")).toHaveLength(0);
  }
  expect(output).not.toContain("Részletek");
});
it("withholds duties content without session", async () => {
  const page = (await import("../../app/szulo/feladatok/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  expect(output).not.toContain('name="idempotencyKey"');
  expect(output).not.toContain("protectedReason");
});
it("renders permitted available duty with real projections", async () => {
  signIn("parent-local");
  const page = (await import("../../app/szulo/feladatok/[id]/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("duty-garden")));
  expect(output.toLocaleLowerCase("hu")).toContain("kert");
  expect(output).not.toContain("protectedReason");
});
it("withholds available duty content without session", async () => {
  const page = (await import("../../app/szulo/feladatok/[id]/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("duty-garden")));
  expect(output).not.toContain('name="idempotencyKey"');
  expect(output).not.toContain("protectedReason");
});
it("renders permitted full duty with real projections", async () => {
  signIn("parent-local");
  const page = (await import("../../app/szulo/feladatok/[id]/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("duty-full")));
  expect(output.toLocaleLowerCase("hu")).toContain("betelt");
  expect(output).not.toContain("protectedReason");
});
it("withholds full duty content without session", async () => {
  const page = (await import("../../app/szulo/feladatok/[id]/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("duty-full")));
  expect(output).not.toContain('name="idempotencyKey"');
  expect(output).not.toContain("protectedReason");
});
it("renders permitted ineligible duty with real projections", async () => {
  signIn("parent-local");
  const page = (await import("../../app/szulo/feladatok/[id]/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("duty-ineligible")));
  expect(output.toLocaleLowerCase("hu")).toContain("jogosult");
  expect(output).not.toContain("protectedReason");
});
it("withholds ineligible duty content without session", async () => {
  const page = (await import("../../app/szulo/feladatok/[id]/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("duty-ineligible")));
  expect(output).not.toContain('name="idempotencyKey"');
  expect(output).not.toContain("protectedReason");
});
it("renders permitted assigned duty with real projections", async () => {
  signIn("parent-local");
  const page = (await import("../../app/szulo/feladatok/[id]/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("duty-assigned")));
  expect(output.toLocaleLowerCase("hu")).toContain("cserekérelem");
  expect(output).not.toContain("protectedReason");
});
it("withholds assigned duty content without session", async () => {
  const page = (await import("../../app/szulo/feladatok/[id]/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("duty-assigned")));
  expect(output).not.toContain('name="idempotencyKey"');
  expect(output).not.toContain("protectedReason");
});
it("renders permitted swap with real projections", async () => {
  signIn("parent-local");
  const page = (await import("../../app/szulo/feladatok/[id]/csere/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("duty-assigned")));
  expect(output.toLocaleLowerCase("hu")).toContain("csere");
  expect(output).not.toContain("protectedReason");
});
it("withholds swap content without session", async () => {
  const page = (await import("../../app/szulo/feladatok/[id]/csere/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("duty-assigned")));
  expect(output).not.toContain('name="idempotencyKey"');
  expect(output).not.toContain("protectedReason");
});
it("renders permitted cancellation with real projections", async () => {
  signIn("parent-local");
  const page = (await import("../../app/szulo/feladatok/[id]/lemondas/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("duty-assigned")));
  expect(output.toLocaleLowerCase("hu")).toContain("lemond");
  expect(output).not.toContain("protectedReason");
});
it("withholds cancellation content without session", async () => {
  const page = (await import("../../app/szulo/feladatok/[id]/lemondas/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("duty-assigned")));
  expect(output).not.toContain('name="idempotencyKey"');
  expect(output).not.toContain("protectedReason");
});
it("renders permitted notifications with real projections", async () => {
  signIn("parent-local");
  const page = (await import("../../app/szulo/ertesitesek/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  expect(output.toLocaleLowerCase("hu")).toContain("értesít");
  expect(output).not.toContain("protectedReason");
});
it("withholds notifications content without session", async () => {
  const page = (await import("../../app/szulo/ertesitesek/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  expect(output).not.toContain('name="idempotencyKey"');
  expect(output).not.toContain("protectedReason");
});
it("renders role layout, denial and configuration error", async () => {
  const Layout = (await import("../../app/szulo/layout.tsx")).default;
  signIn("parent-local");
  expect(html(await Layout({ children: "Owned child" }))).toContain("Owned child");
  signIn("kindergarten-teacher-local");
  expect(html(await Layout({ children: "Owned child" }))).not.toContain("Owned child");
  vi.stubEnv("APP_RUNTIME_MODE", "invalid");
  expect(html(await Layout({ children: "Owned child" }))).not.toContain("Owned child");
});
