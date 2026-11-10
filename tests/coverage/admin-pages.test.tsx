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
it("renders permitted overview with real projections", async () => {
  signIn("super_admin");
  const page = (await import("../../app/admin/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  expect(output.toLocaleLowerCase("hu")).toContain("áttekintés");
  expect(output).not.toContain("protectedReason");
});
it("withholds overview content without session", async () => {
  const page = (await import("../../app/admin/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  expect(output).not.toContain('name="idempotencyKey"');
  expect(output).not.toContain("protectedReason");
});
it("renders permitted records with real projections", async () => {
  signIn("super_admin");
  const page = (await import("../../app/admin/nyilvantartasok/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  expect(output.toLocaleLowerCase("hu")).toContain("nyilvántartások");
  expect(output).not.toContain("protectedReason");
});
it("withholds records content without session", async () => {
  const page = (await import("../../app/admin/nyilvantartasok/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  expect(output).not.toContain('name="idempotencyKey"');
  expect(output).not.toContain("protectedReason");
});
it("renders permitted record detail with real projections", async () => {
  signIn("super_admin");
  const page = (await import("../../app/admin/nyilvantartasok/[id]/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("family-feny")));
  expect(output.toLocaleLowerCase("hu")).toContain("elem részletei");
  expect(output.toLocaleLowerCase("hu")).not.toContain("rekord");
  expect(output).not.toContain("protectedReason");
});
it("withholds record detail content without session", async () => {
  const page = (await import("../../app/admin/nyilvantartasok/[id]/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("family-feny")));
  expect(output).not.toContain('name="idempotencyKey"');
  expect(output).not.toContain("protectedReason");
});
it("renders permitted new record with real projections", async () => {
  signIn("super_admin");
  const page = (await import("../../app/admin/nyilvantartasok/uj/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  expect(output.toLocaleLowerCase("hu")).toContain("nyilvántartás");
  expect(output).not.toContain("protectedReason");
});
it("withholds new record content without session", async () => {
  const page = (await import("../../app/admin/nyilvantartasok/uj/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  expect(output).toContain('name="title"');
  expect(output).not.toContain("protectedReason");
});
it("renders permitted tasks with real projections", async () => {
  signIn("super_admin");
  const page = (await import("../../app/admin/feladatok/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  expect(output.toLocaleLowerCase("hu")).toContain("feladatok és események");
  expect(output).not.toContain("protectedReason");
});
it("withholds tasks content without session", async () => {
  const page = (await import("../../app/admin/feladatok/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  expect(output).not.toContain('name="idempotencyKey"');
  expect(output).not.toContain("protectedReason");
});
it("renders permitted task detail with real projections", async () => {
  signIn("super_admin");
  const page = (await import("../../app/admin/feladatok/[id]/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("task-kert")));
  expect(output.toLocaleLowerCase("hu")).toContain("feladat");
  expect(output).not.toContain("protectedReason");
});
it("withholds task detail content without session", async () => {
  const page = (await import("../../app/admin/feladatok/[id]/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("task-kert")));
  expect(output).not.toContain('name="idempotencyKey"');
  expect(output).not.toContain("protectedReason");
});
it("renders permitted new task with real projections", async () => {
  signIn("super_admin");
  const page = (await import("../../app/admin/feladatok/uj/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  expect(output.toLocaleLowerCase("hu")).toContain("feladat");
  expect(output).not.toContain("protectedReason");
});
it("withholds new task content without session", async () => {
  const page = (await import("../../app/admin/feladatok/uj/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  expect(output).toContain('name="title"');
  expect(output).not.toContain("protectedReason");
});
it("renders permitted approvals with real projections", async () => {
  signIn("super_admin");
  const page = (await import("../../app/admin/jovahagyasok/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  expect(output.toLocaleLowerCase("hu")).toContain("jóváhagyások");
  expect(output).not.toContain("protectedReason");
});
it("withholds approvals content without session", async () => {
  const page = (await import("../../app/admin/jovahagyasok/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  expect(output).not.toContain('name="idempotencyKey"');
  expect(output).not.toContain("protectedReason");
});
it("renders permitted approval detail with real projections", async () => {
  signIn("super_admin");
  const page = (await import("../../app/admin/jovahagyasok/[id]/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("approval-csere")));
  expect(output.toLocaleLowerCase("hu")).toContain("kérelem");
  expect(output).not.toContain("protectedReason");
});
it("withholds approval detail content without session", async () => {
  const page = (await import("../../app/admin/jovahagyasok/[id]/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("approval-csere")));
  expect(output).not.toContain('name="idempotencyKey"');
  expect(output).not.toContain("protectedReason");
});
it("renders permitted archive with real projections", async () => {
  signIn("super_admin");
  const page = (await import("../../app/admin/archivum/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  expect(output.toLocaleLowerCase("hu")).toContain("archívum");
  expect(output).not.toContain("protectedReason");
});
it("withholds archive content without session", async () => {
  const page = (await import("../../app/admin/archivum/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  expect(output).not.toContain('name="idempotencyKey"');
  expect(output).not.toContain("protectedReason");
});
it("renders permitted archive detail with real projections", async () => {
  signIn("super_admin");
  const page = (await import("../../app/admin/archivum/[id]/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("family-napraforgo")));
  expect(output.toLocaleLowerCase("hu")).toContain("archív");
  expect(output).not.toContain("protectedReason");
});
it("withholds archive detail content without session", async () => {
  const page = (await import("../../app/admin/archivum/[id]/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("family-napraforgo")));
  expect(output).not.toContain('name="idempotencyKey"');
  expect(output).not.toContain("protectedReason");
});
it("renders permitted reminders with real projections", async () => {
  signIn("super_admin");
  const page = (await import("../../app/admin/emlekeztetok/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  expect(output.toLocaleLowerCase("hu")).toContain("emlékeztet");
  expect(output).not.toContain("protectedReason");
});
it("withholds reminders content without session", async () => {
  const page = (await import("../../app/admin/emlekeztetok/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  expect(output).not.toContain('name="idempotencyKey"');
  expect(output).not.toContain("protectedReason");
});
it("renders permitted privacy with real projections", async () => {
  signIn("super_admin");
  const page = (await import("../../app/admin/adatvedelem/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  expect(output.toLocaleLowerCase("hu")).toContain("adat-életciklus");
  expect(output).not.toContain("protectedReason");
});
it("withholds privacy content without session", async () => {
  const page = (await import("../../app/admin/adatvedelem/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  expect(output).not.toContain('name="idempotencyKey"');
  expect(output).not.toContain("protectedReason");
});
it("renders permitted settings with real projections", async () => {
  signIn("super_admin");
  const page = (await import("../../app/admin/beallitasok/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  expect(output.toLocaleLowerCase("hu")).toContain("beállítások");
  expect(output).not.toContain("protectedReason");
});
it("withholds settings content without session", async () => {
  const page = (await import("../../app/admin/beallitasok/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  expect(output).not.toContain('name="idempotencyKey"');
  expect(output).not.toContain("protectedReason");
});
it("renders role layout, denial and configuration error", async () => {
  const Layout = (await import("../../app/admin/layout.tsx")).default;
  signIn("super_admin");
  expect(html(await Layout({ children: "Owned child" }))).toContain("Owned child");
  signIn("parent");
  expect(html(await Layout({ children: "Owned child" }))).not.toContain("Owned child");
  requestWorld.setUnavailable(true);
  expect(html(await Layout({ children: "Owned child" }))).not.toContain("Owned child");
});
it("shows loading and recoverable error without secret details", async () => {
  const Loading = (await import("../../app/admin/loading.tsx")).default;
  const ErrorView = (await import("../../app/admin/error.tsx")).default;
  expect(html(<Loading />)).toContain('role="status"');
  expect(html(<ErrorView error={new Error("invented-secret")} reset={() => {}} />)).not.toContain(
    "invented-secret",
  );
});
