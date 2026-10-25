import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import * as actions from "../../app/szulo/actions.ts";
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
  requestWorld.signIn("parent");
});

type Page = (input: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) => ReactNode | Promise<ReactNode>;

async function render(path: string, id: string, query: Record<string, string> = {}) {
  const page = (await import(path)).default as Page;
  return renderToStaticMarkup(
    await page({ params: Promise.resolve({ id }), searchParams: Promise.resolve(query) }),
  );
}

const detail = (id: string, query: Record<string, string> = {}) =>
  render("../../app/szulo/feladatok/[id]/page.tsx", id, query);

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const initial = { state: "initial" } as const;

async function requestSwap() {
  return actions.requestSwapAction(
    initial,
    form({
      id: "duty-assigned",
      assignmentId: "assignment-lampas",
      counterpart: "assignment-counterpart:1",
      expectedVersion: "4",
      idempotencyKey: "swap:duty-assigned:v4",
      reason: "Invented reason",
    }),
  );
}

it("links a task notification to its task page carrying the notification id", async () => {
  const output = await render("../../app/szulo/ertesitesek/page.tsx", "");
  const doc = new DOMParser().parseFromString(output, "text/html");
  expect(
    doc.querySelector('[data-testid="notification-link-notice-7-day"]')!.getAttribute("href"),
  ).toBe("/szulo/feladatok/duty-assigned?ertesites=notice-7-day");
  expect(
    doc.querySelector('[data-testid="notification-link-notice-stale"]')!.getAttribute("href"),
  ).toBe("/szulo/ertesitesek");
});

it("greys out exactly the read notifications and keeps the text Olvasott", async () => {
  const before = new DOMParser().parseFromString(
    await render("../../app/szulo/ertesitesek/page.tsx", ""),
    "text/html",
  );
  const unread = before.querySelector('[data-testid="notification-card-notice-7-day"]')!;
  const stale = before.querySelector('[data-testid="notification-card-notice-stale"]')!;
  expect(unread.classList.contains("notification-card-read")).toBe(false);
  expect(unread.textContent).toContain("Olvasatlan");
  expect(stale.classList.contains("notification-card-read")).toBe(true);
  expect(stale.textContent).toContain("Olvasott");

  await actions.markNotificationReadAction(
    initial,
    form({ id: "notice-7-day", idempotencyKey: "notice:notice-7-day:read" }),
  );
  const after = new DOMParser().parseFromString(
    await render("../../app/szulo/ertesitesek/page.tsx", ""),
    "text/html",
  );
  const read = after.querySelector('[data-testid="notification-card-notice-7-day"]')!;
  expect(read.classList.contains("notification-card-read")).toBe(true);
  expect(read.textContent).toContain("Olvasott");
  expect(read.querySelector<HTMLInputElement>('input[type="checkbox"]')!.disabled).toBe(true);
});

it("shows the back link to the notifications for a task opened from its notification", async () => {
  const output = await detail("duty-assigned", { ertesites: "notice-7-day" });
  const doc = new DOMParser().parseFromString(output, "text/html");
  const back = doc.querySelector('[data-testid="duty-detail-back-link"]')!;
  expect(back.textContent).toBe("Vissza az értesítésekhez");
  expect(back.getAttribute("href")).toBe("/szulo/ertesitesek");
});

it("keeps the task list back link without a notification, and never marks read while rendering", async () => {
  const output = await detail("duty-assigned", { allapot: "assigned" });
  const doc = new DOMParser().parseFromString(output, "text/html");
  const back = doc.querySelector('[data-testid="duty-detail-back-link"]')!;
  expect(back.textContent).toBe("Vissza a feladatokhoz");
  expect(back.getAttribute("href")).toBe("/szulo/feladatok?allapot=assigned");
  // Rendering the task page with a notification context leaves the notification unread.
  await detail("duty-assigned", { ertesites: "notice-7-day" });
  const list = new DOMParser().parseFromString(
    await render("../../app/szulo/ertesitesek/page.tsx", ""),
    "text/html",
  );
  expect(list.querySelector('[data-testid="notification-card-notice-7-day"]')!.textContent).toContain(
    "Olvasatlan",
  );
});

it.each([
  ["an unknown notification", { ertesites: "notice-unknown" }, "/szulo/feladatok/duty-assigned"],
  ["another task's notification", { ertesites: "notice-24-hour" }, "/szulo/feladatok/duty-assigned"],
  ["the stale list notification", { ertesites: "notice-stale" }, "/szulo/feladatok/duty-assigned"],
  [
    "an invalid value with a list filter",
    { ertesites: "!", allapot: "assigned" },
    "/szulo/feladatok/duty-assigned?allapot=assigned",
  ],
])("behaves as if the parameter were absent for %s", async (_name, query, target) => {
  await expect(detail("duty-assigned", query)).rejects.toThrow("REDIRECT:" + target);
});

it("shows the pending notice and hides both request links while a request waits", async () => {
  const open = await detail("duty-assigned");
  expect(open).toContain('data-testid="swap-request-link"');
  expect(open).toContain('data-testid="cancellation-request-link"');
  expect(open).not.toContain("Cserekérelem folyamatban");

  expect((await requestSwap()).state).toBe("success");
  const pending = await detail("duty-assigned");
  expect(pending).toContain('data-testid="pending-swap-notice"');
  expect(pending).toContain("Cserekérelem folyamatban");
  expect(pending).not.toContain('data-testid="swap-request-link"');
  expect(pending).not.toContain('data-testid="cancellation-request-link"');
  // The task page and the task list read the same state word.
  expect(pending).toMatch(
    /data-testid="duty-detail-state"><span class="status-badge"><svg [^>]*aria-hidden="true"[^>]*>.*<\/svg>Cserekérelem folyamatban<\/span>/s,
  );
});

it("shows the cancellation notice for a waiting cancellation request", async () => {
  await actions.requestCancellationAction(
    initial,
    form({
      id: "duty-assigned",
      assignmentId: "assignment-lampas",
      expectedVersion: "4",
      idempotencyKey: "cancel:duty-assigned:v4",
      reason: "Invented reason",
    }),
  );
  const pending = await detail("duty-assigned");
  expect(pending).toContain('data-testid="pending-cancellation-notice"');
  expect(pending).toContain("Lemondási kérelem folyamatban");
  expect(pending).not.toContain('data-testid="cancellation-request-link"');
});

it("replaces the request form by the pending notice and a link back to the task", async () => {
  const swap = "../../app/szulo/feladatok/[id]/csere/page.tsx";
  const cancellation = "../../app/szulo/feladatok/[id]/lemondas/page.tsx";
  expect(await render(swap, "duty-assigned")).toContain('name="reason"');
  expect(await render(cancellation, "duty-assigned")).toContain('name="reason"');

  await requestSwap();
  for (const path of [swap, cancellation]) {
    const output = await render(path, "duty-assigned");
    expect(output).not.toContain('name="reason"');
    expect(output).toContain("Cserekérelem folyamatban");
    expect(output).toContain("Vissza a feladathoz");
    expect(output).toContain('href="/szulo/feladatok/duty-assigned"');
  }
});
