import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { empty, success, type AdminItemModel } from "../../src/application/index.ts";

const world = vi.hoisted(() => ({
  request: { state: "signed-out" } as unknown,
  access: { state: "signed-out" } as unknown,
  redirected: undefined as string | undefined,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    world.redirected = path;
    throw new Error(`REDIRECT:${path}`);
  },
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/szulo/feladatok",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../../app/_identity/actions.ts", () => ({ signOutAction: vi.fn() }));
vi.mock("../../app/_identity/production-request.ts", () => ({
  productionRequest: async () => world.request,
}));
vi.mock("../../src/runtime/production/access.ts", () => ({
  resolveAdminAccess: async () => world.access,
}));

import Home from "../../app/page.tsx";
import { shellHeaderAction } from "../../app/_identity/shell-action.tsx";
import { resolveProductionHome } from "../../app/_identity/production-home.ts";
import { AppShell } from "../../src/runtime/AppShell.tsx";
import { loadAdminLookups, NO_LOOKUPS } from "../../app/admin/_lib/lookups.ts";
import { shellProfile } from "../support/role-profiles.ts";
import { freshKey, keyPrefix } from "../../app/szulo/_components/fresh-key.ts";

const READY = {
  state: "ready",
  accountId: "account-1",
  services: { database: { forSession: vi.fn() } },
};

beforeEach(() => {
  world.request = { state: "signed-out" };
  world.access = { state: "signed-out" };
  world.redirected = undefined;
  vi.stubEnv("APP_SESSION_SECRET", "a-production-only-secret-with-32-chars");
  vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("SUPABASE_ANON_KEY", "placeholder-anon-key-value");
});
afterEach(() => vi.unstubAllEnvs());

describe("where a signed-in person of the production mode belongs", () => {
  it("is signed out without a session", async () => {
    expect(await resolveProductionHome()).toEqual({ state: "signed-out" });
  });

  it("is unavailable when the session cannot be read", async () => {
    world.request = { state: "unavailable" };
    expect(await resolveProductionHome()).toEqual({ state: "unavailable" });
  });

  it("goes to the home of an admin", async () => {
    world.request = READY;
    world.access = { state: "success", data: { profile: { homePath: "/admin" } } };
    expect(await resolveProductionHome()).toEqual({ state: "ready", path: "/admin" });
  });

  it("goes to the home of the strongest other role the account holds", async () => {
    world.request = READY;
    world.access = { state: "denied", homePath: "/szulo/ertesitesek" };
    expect(await resolveProductionHome()).toEqual({ state: "ready", path: "/szulo/ertesitesek" });
  });

  it("has no role for an account without any", async () => {
    world.request = READY;
    world.access = { state: "denied" };
    expect(await resolveProductionHome()).toEqual({ state: "no-role" });
  });

  it("reports an unavailable database and a session that ended meanwhile", async () => {
    world.request = READY;
    world.access = { state: "unavailable" };
    expect(await resolveProductionHome()).toEqual({ state: "unavailable" });
    world.access = { state: "signed-out" };
    expect(await resolveProductionHome()).toEqual({ state: "signed-out" });
  });
});

describe("the home page of the production mode", () => {
  it("points a signed-out person at the sign-in page and offers no test profile", async () => {
    render(await Home());
    expect(screen.getByRole("heading", { name: "Biztonságos bejelentkezés" })).toBeVisible();
    expect(screen.getByTestId("production-sign-in-link")).toHaveAttribute("href", "/bejelentkezes");
    expect(document.body).not.toHaveTextContent("nincs összekötve");
    expect(screen.queryByText(/Tesztprofil/)).not.toBeInTheDocument();
  });

  it("sends a signed-in person to the home of their role", async () => {
    world.request = READY;
    world.access = { state: "success", data: { profile: { homePath: "/admin" } } };
    await expect(Home()).rejects.toThrow("REDIRECT:/admin");
    expect(world.redirected).toBe("/admin");
  });

  it("tells an account without a role so, with a way to sign out", async () => {
    world.request = READY;
    world.access = { state: "denied" };
    render(await Home());
    expect(screen.getByTestId("production-no-role")).toHaveTextContent("nem tartozik szerepkör");
    expect(screen.getByTestId("sign-out-button")).toBeVisible();
  });

  it("announces a service that cannot answer", async () => {
    world.request = { state: "unavailable" };
    render(await Home());
    expect(screen.getByRole("alert")).toHaveTextContent("átmenetileg nem érhető el");
  });
});

describe("the header of the page shell", () => {
  const profile = shellProfile("parent");

  it("shows the sign-out button instead of the switcher for a real session", async () => {
    render(
      <AppShell profile={profile} headerAction={await shellHeaderAction()}>
        x
      </AppShell>,
    );
    expect(screen.getByTestId("sign-out-button")).toBeVisible();
    expect(screen.queryByTestId("app-shell-switch-profile-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("app-shell-switch-profile-form")).not.toBeInTheDocument();
  });
});

describe("the choices of the extended admin forms", () => {
  const item = (overrides: Partial<AdminItemModel>): AdminItemModel => ({
    id: "x",
    title: "x",
    state: "active",
    ...overrides,
  });

  it("offers the active school years, groups and families and the planned events with their group", async () => {
    const facade = {
      listRecords: async () =>
        success({
          items: [
            item({ id: "y-1", title: "2026/2027", kind: "school-year" }),
            item({ id: "y-2", title: "Régi", kind: "school-year", state: "archived" }),
            item({ id: "g-1", title: "Boróka", kind: "group" }),
            item({ id: "f-1", title: "Fenyő család", kind: "family" }),
            item({ id: "c-1", title: "Gergő", kind: "child" }),
            item({ id: "n-1", title: "Nincs fajta" }),
          ],
        }),
      listTasks: async () =>
        success({
          items: [
            item({
              id: "e-1",
              title: "Ünnep",
              kind: "event",
              state: "scheduled",
              details: { groupId: "g-1" },
            }),
            item({
              id: "e-2",
              title: "Törölt",
              kind: "event",
              state: "cancelled",
              details: { groupId: "g-1" },
            }),
            item({ id: "e-3", title: "Csoport nélkül", kind: "event", state: "scheduled" }),
            item({
              id: "t-1",
              title: "Sütés",
              kind: "task",
              state: "open",
              details: { groupId: "g-1" },
            }),
          ],
        }),
    };
    const lookups = await loadAdminLookups(facade as never, {} as never, {} as never);
    expect(lookups).toEqual({
      schoolYears: [{ value: "y-1", label: "2026/2027" }],
      groups: [{ value: "g-1", label: "Boróka" }],
      families: [{ value: "f-1", label: "Fenyő család" }],
      events: [{ value: "e-1", label: "Ünnep", groupId: "g-1" }],
    });
  });

  it("offers nothing when a list cannot be read", async () => {
    const facade = { listRecords: async () => empty(), listTasks: async () => empty() };
    expect(await loadAdminLookups(facade as never, {} as never, {} as never)).toEqual(NO_LOOKUPS);
  });
});

describe("the idempotency key of one attempt", () => {
  it("is new every time, readable and valid for the actions", () => {
    const keys = new Set(Array.from({ length: 20 }, () => freshKey("swap")));
    expect(keys.size).toBe(20);
    for (const key of keys) expect(key).toMatch(/^swap:[0-9a-f]{32}$/);
  });

  it("takes the first part of the key a form carries and falls back for anything odd", () => {
    expect(keyPrefix("swap:duty-1:v4")).toBe("swap");
    expect(keyPrefix("record:save:abc")).toBe("record");
    expect(keyPrefix("")).toBe("attempt");
    expect(keyPrefix(":x")).toBe("attempt");
    expect(keyPrefix("x".repeat(60))).toBe("attempt");
    expect(keyPrefix("a b:c")).toBe("attempt");
  });
});
