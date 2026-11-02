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
it("renders permitted duties with real projections", async () => {
  signIn("parent");
  const page = (await import("../../app/szulo/feladatok/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  expect(output.toLocaleLowerCase("hu")).toContain("feladat");
  expect(output).not.toContain("protectedReason");
});
it("renders each duty as one whole-card link without a separate details link", async () => {
  signIn("parent");
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
it("shows a symbol before each duty state word, in the list, the filter and the detail", async () => {
  signIn("parent");
  const list = (await import("../../app/szulo/feladatok/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await list(props("")));
  const document = new DOMParser().parseFromString(output, "text/html");
  for (const badge of document.querySelectorAll(".parent-state-badge")) {
    expect(badge.classList.contains("status-badge")).toBe(true);
    expect(badge.querySelector("svg[aria-hidden='true']")).not.toBeNull();
  }
  const options = [...document.querySelectorAll("#allapot option")].map((o) => o.textContent);
  expect(options[0]).toBe("Minden állapot");
  expect(options).toContain("● Jelentkezésre nyitott");
  expect(options).toContain("■ Betelt");
  expect(options).toContain("⊘ Nem jogosult");
  expect(options).toContain("✓ Vállalt feladat");
  expect(options).toContain("◔ Cserekérelem folyamatban");
  expect(options).toContain("◔ Lemondási kérelem folyamatban");
  const detail = (await import("../../app/szulo/feladatok/[id]/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const detailOutput = html(await detail(props("duty-garden")));
  expect(detailOutput).toMatch(/duty-detail-state"><span class="status-badge"><svg /);
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
  signIn("parent");
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
  signIn("parent");
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
  signIn("parent");
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
  signIn("parent");
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
  signIn("parent");
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
  signIn("parent");
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
  signIn("parent");
  const page = (await import("../../app/szulo/ertesitesek/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  expect(output.toLocaleLowerCase("hu")).toContain("értesít");
  expect(output).not.toContain("protectedReason");
});
it("renders each notification as one whole-card link plus one read checkbox beside it", async () => {
  signIn("parent");
  const page = (await import("../../app/szulo/ertesitesek/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  const document = new DOMParser().parseFromString(output, "text/html");
  const cards = [...document.querySelectorAll('li[data-testid^="notification-card-"]')];
  expect(cards.length).toBeGreaterThan(0);
  for (const card of cards) {
    const links = card.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0]!.getAttribute("href")).toMatch(/^\/szulo\//);
    expect(links[0]!.querySelector("h2")?.textContent).toBeTruthy();
    // The checkbox sits beside the link, never inside it.
    const checkboxes = card.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes).toHaveLength(1);
    expect(links[0]!.contains(checkboxes[0]!)).toBe(false);
    // The only button is the no-JavaScript fallback inside <noscript>.
    expect([...card.querySelectorAll("button")].filter((b) => !b.closest("noscript"))).toHaveLength(
      0,
    );
  }
  expect(output).not.toContain("Megnyitás");
  expect(output).not.toContain("Részletek");
  expect(output).toContain("Olvasottnak jelölöm");
});
it("withholds notifications content without session", async () => {
  const page = (await import("../../app/szulo/ertesitesek/page.tsx")).default as (
    input: ReturnType<typeof props>,
  ) => ReactNode | Promise<ReactNode>;
  const output = html(await page(props("")));
  expect(output).not.toContain('name="idempotencyKey"');
  expect(output).not.toContain("protectedReason");
});
it("gives a parent with a role but no linked record the guidance and a way to sign out", async () => {
  // Regression: this screen had no sign-out, and its back link reloaded the same screen.
  const Layout = (await import("../../app/szulo/layout.tsx")).default;
  signIn("parent");
  requestWorld.access.parent.parent = undefined;
  const output = html(await Layout({ children: "Owned child" }));
  expect(output).toContain("Nincs jogosultság");
  expect(output).not.toContain("Owned child");
  expect(output).toContain('data-testid="access-guidance"');
  expect(output).toContain('data-testid="sign-out-button"');
  expect(output).not.toContain("parent-access-home-link");
});
it("renders role layout, denial and configuration error", async () => {
  const Layout = (await import("../../app/szulo/layout.tsx")).default;
  signIn("parent");
  expect(html(await Layout({ children: "Owned child" }))).toContain("Owned child");
  signIn("teacher");
  expect(html(await Layout({ children: "Owned child" }))).not.toContain("Owned child");
  requestWorld.setUnavailable(true);
  expect(html(await Layout({ children: "Owned child" }))).not.toContain("Owned child");
});
