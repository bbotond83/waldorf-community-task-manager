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

beforeEach(() => {
  requestWorld.reset();
  requestWorld.signIn("super_admin");
});

type Page = (input: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) => ReactNode | Promise<ReactNode>;

async function render(path: string, id = "", query: Record<string, string> = {}) {
  const page = (await import(path)).default as Page;
  const markup = renderToStaticMarkup(
    await page({ params: Promise.resolve({ id }), searchParams: Promise.resolve(query) }),
  );
  return new DOMParser().parseFromString(markup, "text/html");
}

/** The visible text of a page: what stays when the closed developer section is removed. */
function visibleText(doc: Document): string {
  const copy = doc.body.cloneNode(true) as HTMLElement;
  copy.querySelectorAll("details.developer-details").forEach((node) => node.remove());
  return copy.textContent ?? "";
}

const detailPages = [
  ["records", "../../app/admin/nyilvantartasok/[id]/page.tsx", "family-feny", "/admin/nyilvantartasok", "Vissza a nyilvántartásokhoz"],
  ["tasks", "../../app/admin/feladatok/[id]/page.tsx", "task-kert", "/admin/feladatok", "Vissza a feladatokhoz és eseményekhez"],
  ["approvals", "../../app/admin/jovahagyasok/[id]/page.tsx", "approval-csere", "/admin/jovahagyasok", "Vissza a jóváhagyásokhoz"],
  ["archive", "../../app/admin/archivum/[id]/page.tsx", "year-2026", "/admin/archivum", "Vissza az archívumhoz"],
  ["new record form", "../../app/admin/nyilvantartasok/uj/page.tsx", "", "/admin/nyilvantartasok", "Vissza a nyilvántartásokhoz"],
  ["new task form", "../../app/admin/feladatok/uj/page.tsx", "", "/admin/feladatok", "Vissza a feladatokhoz és eseményekhez"],
] as const;

it.each(detailPages)(
  "shows a back link on the %s page, worded for its list",
  async (_name, path, id, href, label) => {
    const doc = await render(path, id);
    const link = doc.querySelector('[data-testid="admin-back-link"]');
    expect(link?.getAttribute("href")).toBe(href);
    expect(link?.textContent).toBe(label);
  },
);

it("keeps the list's filter in the back link of a page opened from a filtered list", async () => {
  const doc = await render("../../app/admin/feladatok/[id]/page.tsx", "task-kert", {
    vissza: "q=kert&state=open",
  });
  expect(doc.querySelector('[data-testid="admin-back-link"]')?.getAttribute("href")).toBe(
    "/admin/feladatok?q=kert&state=open",
  );
});

it("makes list cards carry the filter to the detail page", async () => {
  const doc = await render("../../app/admin/feladatok/page.tsx", "", { state: "open" });
  const links = [...doc.querySelectorAll('[data-testid^="admin-tasks-list-open-"]')];
  expect(links.length).toBeGreaterThan(0);
  for (const link of links) {
    expect(link.getAttribute("href")).toMatch(/\?vissza=state%3Dopen$/);
  }
});

it.each([
  ["records", "../../app/admin/nyilvantartasok/page.tsx", ["active", "archived"]],
  ["tasks", "../../app/admin/feladatok/page.tsx", ["open", "scheduled"]],
  ["approvals", "../../app/admin/jovahagyasok/page.tsx", ["pending", "approved", "rejected"]],
] as const)("offers only the %s statuses and returns a result for each", async (_n, path, values) => {
  const doc = await render(path);
  const offered = [...doc.querySelectorAll("#admin-filter-state option")].map((option) =>
    option.getAttribute("value"),
  );
  expect(offered).toEqual(["", ...values]);
  for (const value of values.filter((state) => state !== "rejected")) {
    const filtered = await render(path, "", { state: value });
    expect(filtered.querySelector(".admin-collection li")).not.toBeNull();
    expect(filtered.querySelector('[data-testid="admin-filter-unknown-note"]')).toBeNull();
  }
});

it("lists an approved request under the Jóváhagyva filter", async () => {
  const doc = await render("../../app/admin/jovahagyasok/page.tsx", "", { state: "approved" });
  expect(doc.querySelector(".admin-collection li")).not.toBeNull();
  expect(doc.querySelector(".admin-collection")?.textContent).toContain("Jóváhagyva");
});

it("shows the unfiltered list and a short note for a status the list does not offer", async () => {
  const unfiltered = await render("../../app/admin/feladatok/page.tsx");
  const old = await render("../../app/admin/feladatok/page.tsx", "", { state: "pending" });
  expect(old.querySelector('[data-testid="admin-filter-unknown-note"]')).not.toBeNull();
  expect(old.querySelectorAll(".admin-collection li").length).toBe(
    unfiltered.querySelectorAll(".admin-collection li").length,
  );
  expect(old.querySelector('[role="alert"]')).toBeNull();
});

const technicalText = /Verzió:|Korreláció|Kapacitási helyzet|Forgatókönyv|corr-/;

it.each([
  ["task detail", "../../app/admin/feladatok/[id]/page.tsx", "task-kert", ["Verzió:"]],
  ["record detail", "../../app/admin/nyilvantartasok/[id]/page.tsx", "family-feny", ["Verzió:"]],
  ["reminders", "../../app/admin/emlekeztetok/page.tsx", "", ["Korreláció", "corr-"]],
] as const)(
  "keeps the technical text of the %s page in a closed Fejlesztői részletek section",
  async (_name, path, id, texts) => {
    const doc = await render(path, id);
    const sections = doc.querySelectorAll("details.developer-details");
    expect(sections).toHaveLength(1);
    expect(sections[0]!.hasAttribute("open")).toBe(false);
    expect(sections[0]!.querySelector("summary")?.textContent).toBe("Fejlesztői részletek");
    for (const text of texts) expect(sections[0]!.textContent).toContain(text);
    expect(visibleText(doc)).not.toMatch(technicalText);
  },
);

it("keeps the assignment form whole without any scenario control, whatever the address says", async () => {
  const doc = await render("../../app/admin/feladatok/[id]/page.tsx", "task-kert", {
    scenario: "full",
  });
  expect(doc.querySelector('[data-testid="admin-assignment-scenario-select"]')).toBeNull();
  expect(doc.getElementById("admin-assignment-form")).not.toBeNull();
  expect(doc.querySelector('input[name="expectedVersion"]')).not.toBeNull();
});

it.each([
  ["../../app/admin/feladatok/[id]/page.tsx", "task-kert"],
  ["../../app/admin/adatvedelem/page.tsx", ""],
  ["../../app/admin/beallitasok/page.tsx", ""],
  ["../../app/admin/jovahagyasok/[id]/page.tsx", "approval-csere"],
  ["../../app/admin/archivum/[id]/page.tsx", "year-2026"],
])("offers no scenario control or hidden scenario field on %s", async (path, id) => {
  const doc = await render(path, id, { scenario: "conflict" });
  expect(doc.querySelectorAll('[name="scenario"], [id*="scenario"], [data-testid*="scenario"]')).toHaveLength(
    0,
  );
});

it("keeps the retry correlation field of the reminders page and the privacy forms without developer controls", async () => {
  const privacy = await render("../../app/admin/adatvedelem/page.tsx");
  expect(privacy.querySelectorAll("details.developer-details")).toHaveLength(0);
  const reminders = await render("../../app/admin/emlekeztetok/page.tsx");
  expect(reminders.querySelector('input[name="correlationId"]')).not.toBeNull();
});
