import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import Home from "../../app/page";
import Root from "../../app/layout";
import Login from "../../app/belepes/page";
import Invitation from "../../app/meghivas/[token]/page";
import Denied from "../../app/hozzaferes-megtagadva/page";
import { GET } from "../../app/api/readiness/route";
import { POST as select } from "../../app/api/synthetic/session/route";
import { POST as reset } from "../../app/api/synthetic/reset/route";
import { createSyntheticSessionToken } from "../../src/runtime/session/session";
import { getSyntheticProfile } from "../../src/runtime/synthetic/profiles";
const boundary = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (boundary.token ? { value: boundary.token } : undefined) }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
beforeEach(() => {
  vi.stubEnv("APP_RUNTIME_MODE", "synthetic");
  boundary.token = undefined;
});
afterEach(() => vi.unstubAllEnvs());
it("renders profile selection and authenticated home navigation", async () => {
  expect(renderToStaticMarkup(await Home())).toContain("profileId");
  boundary.token = createSyntheticSessionToken(getSyntheticProfile("parent-local")!);
  const output = renderToStaticMarkup(await Home());
  expect(output).toContain("Üdvözlünk");
  expect(output).toContain("/szulo/feladatok");
  expect(output).not.toContain("/admin");
});
it("renders safe configuration and production boundaries", async () => {
  vi.stubEnv("APP_RUNTIME_MODE", "invalid");
  expect(renderToStaticMarkup(await Home())).toContain("APP_RUNTIME_MODE");
  vi.stubEnv("APP_RUNTIME_MODE", "production");
  vi.stubEnv("APP_SESSION_SECRET", "invented".repeat(6));
  vi.stubEnv("SUPABASE_URL", "https://invented.invalid");
  vi.stubEnv("SUPABASE_ANON_KEY", "invented".repeat(6));
  const output = renderToStaticMarkup(await Home());
  expect(output).toContain("Biztonságos bejelentkezés");
  expect(output).not.toContain("invented");
});
it("returns real readiness status and safe error codes", async () => {
  expect(await (await GET()).json()).toMatchObject({ status: "ready", mode: "synthetic" });
  vi.stubEnv("APP_RUNTIME_MODE", "invalid");
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    status: "not-ready",
    code: "CONFIG_RUNTIME_MODE_INVALID",
  });
});
it("renders Hungarian root and safe denied navigation", () => {
  expect(renderToStaticMarkup(<Root>Owned child</Root>)).toContain('lang="hu"');
  expect(renderToStaticMarkup(<Denied />)).toContain('href="/"');
});
it("sanitizes login targets and renders authenticated notice", async () => {
  expect(
    renderToStaticMarkup(
      await Login({ searchParams: Promise.resolve({ tovabb: "https://invented.invalid" }) }),
    ),
  ).toContain("/szulo/feladatok");
  boundary.token = createSyntheticSessionToken(getSyntheticProfile("parent-local")!);
  expect(
    renderToStaticMarkup(
      await Login({ searchParams: Promise.resolve({ tovabb: "/szulo/ertesitesek" }) }),
    ),
  ).toContain("upcoming-duty-notice");
});
it.each(["valid", "expired", "used", "invalid"])(
  "renders invitation %s without account disclosures",
  async (state) => {
    const output = renderToStaticMarkup(
      await Invitation({ params: Promise.resolve({ token: `parent-${state}-invitation` }) }),
    );
    expect(output).toContain(`invitation-page-${state}`);
    expect(output).not.toContain("invented@example.invalid");
  },
);
function request(profileId: string, origin = "http://localhost") {
  const form = new FormData();
  form.set("profileId", profileId);
  return new NextRequest("http://localhost/api/synthetic/session", {
    method: "POST",
    headers: { origin, host: "localhost" },
    body: form,
  });
}
it("creates and clears secure scoped session cookies", async () => {
  const selected = await select(request("parent-local"));
  expect(selected.status).toBe(303);
  expect(selected.headers.get("set-cookie")).toContain("HttpOnly");
  expect(selected.headers.get("set-cookie")).toContain("SameSite=lax");
  expect(selected.headers.get("clear-site-data")).toBe('"cache"');
  expect((await select(request(""))).headers.get("set-cookie")).toContain(
    "Expires=Thu, 01 Jan 1970",
  );
});
it("rejects foreign origins and invalid profile bodies", async () => {
  expect((await select(request("parent-local", "https://invented.invalid"))).status).toBe(403);
  expect((await select(request("unknown"))).status).toBe(400);
  expect(
    (
      await select(
        new NextRequest("http://localhost/api/synthetic/session", {
          method: "POST",
          headers: { origin: "http://localhost", host: "localhost" },
          body: "malformed",
        }),
      )
    ).status,
  ).toBe(400);
});
it("resets synthetic fixtures and hides routes outside synthetic mode", async () => {
  expect(await (await reset(request("parent-local"))).json()).toMatchObject({
    code: "SYNTHETIC_FIXTURE_RESET",
  });
  expect((await reset(request("parent-local", "https://invented.invalid"))).status).toBe(403);
  vi.stubEnv("APP_RUNTIME_MODE", "invalid");
  expect((await reset(request("parent-local"))).status).toBe(404);
  expect((await select(request("parent-local"))).status).toBe(404);
});
