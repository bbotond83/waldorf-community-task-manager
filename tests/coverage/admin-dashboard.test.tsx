import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { requestWorld } from "../support/request-world.ts";
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

type Page = (input: Record<string, unknown>) => ReactNode | Promise<ReactNode>;

async function render(path: string, query = {}) {
  const page = (await import(path)).default as Page;
  const output = renderToStaticMarkup(
    (await page({ params: Promise.resolve({}), searchParams: Promise.resolve(query) })) as ReactNode,
  );
  return new DOMParser().parseFromString(output, "text/html");
}

it("renders the three overview cards as links to their lists", async () => {
  requestWorld.signIn("group_admin");
  const document = await render("../../app/admin/page.tsx");
  const hrefs = {
    "admin-dashboard-approvals": "/admin/jovahagyasok?state=pending",
    "admin-dashboard-records": "/admin/nyilvantartasok",
    "admin-dashboard-tasks": "/admin/feladatok",
  };
  for (const [id, href] of Object.entries(hrefs)) {
    const card = document.querySelector(`[data-testid="${id}"]`);
    expect(card?.tagName).toBe("A");
    expect(card?.getAttribute("href")).toBe(href);
  }
  for (const id of ["summary", "records-state", "tasks-state"]) {
    expect(document.querySelector(`[data-testid="admin-dashboard-${id}"]`)?.textContent).toMatch(
      /^\d+$/,
    );
  }
});

it("no longer renders the duplicate pending-requests card", async () => {
  requestWorld.signIn("group_admin");
  const document = await render("../../app/admin/page.tsx");
  expect(document.querySelector('[data-testid^="admin-dashboard-queue"]')).toBeNull();
  expect(document.body.textContent).not.toContain("Függőben lévő kérelmek");
});

it("shows the same open approvals count as the pending rows in the approvals list", async () => {
  requestWorld.signIn("group_admin");
  const overview = await render("../../app/admin/page.tsx");
  const count = Number(
    overview.querySelector('[data-testid="admin-dashboard-summary"]')?.textContent,
  );
  const list = await render("../../app/admin/jovahagyasok/page.tsx", { state: "pending" });
  const rows = list.querySelectorAll('[data-testid="admin-approvals-list"] li');
  expect(count).toBeGreaterThan(0);
  expect(rows).toHaveLength(count);
});

it("withholds the overview cards without a session", async () => {
  const document = await render("../../app/admin/page.tsx");
  expect(document.querySelector('[data-testid="admin-dashboard-approvals"]')).toBeNull();
});
