import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "../../app/page";
import Root from "../../app/layout";
import Invitation from "../../app/meghivas/[token]/page";
import Denied from "../../app/hozzaferes-megtagadva/page";
import { GET } from "../../app/api/readiness/route";
import { requestWorld, type RoleKey } from "../support/request-world.ts";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../../app/_identity/production-request.ts", async () =>
  (await import("../support/request-world.ts")).requestWorldModule(),
);

function stubRuntime(overrides: Record<string, string | undefined> = {}) {
  const settings: Record<string, string | undefined> = {
    APP_SESSION_SECRET: "invented".repeat(6),
    SUPABASE_URL: "https://invented.invalid",
    SUPABASE_ANON_KEY: "invented".repeat(6),
    ...overrides,
  };
  for (const [name, value] of Object.entries(settings)) {
    if (value === undefined) vi.stubEnv(name, "");
    else vi.stubEnv(name, value);
  }
}
beforeEach(() => {
  requestWorld.reset();
  stubRuntime();
});
afterEach(() => vi.unstubAllEnvs());

async function redirectTarget(): Promise<string | undefined> {
  try {
    await Home();
  } catch (error) {
    return (error as { digest?: string }).digest?.split(";")[2];
  }
  return undefined;
}

it("points a visitor without a session at the sign-in page, and shows nothing of any profile", async () => {
  const output = renderToStaticMarkup(await Home());
  expect(output).toContain("Biztonságos bejelentkezés");
  expect(output).toContain('data-testid="production-sign-in-link"');
  expect(output).toContain('href="/bejelentkezes"');
  expect(output).not.toContain("profileId");
  expect(output).not.toContain("invented");
});

it.each([
  ["parent", "/szulo/ertesitesek"],
  ["teacher", "/teacher/schedule"],
  ["group_admin", "/admin"],
  ["super_admin", "/admin"],
] as const satisfies readonly [RoleKey, string][])(
  "redirects a signed-in %s to the default page of the role",
  async (role, path) => {
    requestWorld.signIn(role);
    await expect(Home()).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
    expect(await redirectTarget()).toBe(path);
  },
);

it("tells a signed-in account without any role so, with the sign-out button, and never redirects it", async () => {
  requestWorld.signIn("parent");
  requestWorld.access.parent.grants = [];
  const output = renderToStaticMarkup(await Home());
  expect(output).toContain('data-testid="production-no-role"');
  expect(output).toContain("Kijelentkezés");
});

it("says the sign-in service is unavailable when it cannot answer", async () => {
  requestWorld.setUnavailable(true);
  const output = renderToStaticMarkup(await Home());
  expect(output).toContain('data-testid="production-unavailable"');
  expect(output).not.toContain("production-sign-in-link");
});

it("never renders the removed welcome heading", async () => {
  requestWorld.signIn("parent");
  let markup = "";
  try {
    markup = renderToStaticMarkup(await Home());
  } catch {
    markup = "";
  }
  expect(markup).not.toContain("Üdvözlünk");
});

it("renders a safe configuration error that names the setting and never a value", async () => {
  stubRuntime({ SUPABASE_URL: "http://example.org" });
  const output = renderToStaticMarkup(await Home());
  expect(output).toContain('data-testid="runtime-configuration-error"');
  expect(output).toContain("CONFIG_PRODUCTION_INVALID");
  expect(output).toContain("SUPABASE_URL");
  expect(output).not.toContain("example.org");
});

it("returns the readiness status without a mode, and safe error codes", async () => {
  const ready = await (await GET()).json();
  expect(ready).toEqual({ status: "ready", marker: "waldorf-local-ready" });
  stubRuntime({ APP_SESSION_SECRET: "short" });
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    status: "not-ready",
    code: "CONFIG_PRODUCTION_INVALID",
  });
});

it("renders Hungarian root and safe denied navigation", () => {
  expect(renderToStaticMarkup(<Root>Owned child</Root>)).toContain('lang="hu"');
  expect(renderToStaticMarkup(<Denied />)).toContain('href="/"');
});

it("shows the logo linking to the start page on the public pages", async () => {
  const outputs = [
    renderToStaticMarkup(<Denied />),
    renderToStaticMarkup(await Invitation({ params: Promise.resolve({ token: "not-a-token" }) })),
  ];
  for (const output of outputs) {
    expect(output).toContain('data-testid="brand-link"');
    expect(output).toContain("Cinkotai Waldorf Óvoda");
  }
});

it.each(["parent-valid-invitation", "parent-expired-invitation", "x", "A".repeat(43)])(
  "answers %s with the same plain not-valid page and no account disclosure",
  async (token) => {
    const output = renderToStaticMarkup(await Invitation({ params: Promise.resolve({ token }) }));
    expect(output).toContain('data-testid="real-invitation-not-valid"');
    expect(output).toContain("Ez a meghívó már nem érvényes");
    expect(output).toContain('data-testid="invitation-login-link"');
    expect(output).toContain('href="/bejelentkezes"');
    expect(output).not.toContain("invented@example.invalid");
    expect(output).not.toContain("invitation-accept-form");
  },
);

it("Teacher compatibility handlers are fixed redirects without session creation", async () => {
  const { GET } = await import("../../app/munkatars/beosztas/route.ts");
  const response = GET(
    new Request("http://local/munkatars/beosztas?scenario=terminal&returnTo=https://evil"),
  );
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe("/teacher/schedule");
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(await response.text()).toBe("");
});
