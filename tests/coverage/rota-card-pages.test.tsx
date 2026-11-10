import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { ROTA_CARD_DUTY_ID, requestWorld, type RoleKey } from "../support/request-world.ts";

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

type CardPage = (input: { params: Promise<{ id: string }> }) => Promise<ReactNode>;

beforeEach(() => requestWorld.reset());

async function render(area: "admin" | "szulo", role: RoleKey | undefined, id = ROTA_CARD_DUTY_ID) {
  requestWorld.signIn(role);
  const page = (await import(`../../app/${area}/beosztas/[id]/page.tsx`)).default as CardPage;
  return renderToStaticMarkup(await page({ params: Promise.resolve({ id }) }));
}

it("shows the super admin any published duty card in the admin area, read-only (BR24.2)", async () => {
  const output = await render("admin", "super_admin");
  expect(output).toContain('data-testid="rota-card-details"');
  expect(output).toContain("Minta család 1");
  expect(output).toContain('href="/admin/beosztas"');
  expect(output).not.toContain("<button");
});

it("gives the super admin the same refusal for a made-up card id", async () => {
  const output = await render("admin", "super_admin", "made-up");
  expect(output).toContain('data-testid="rota-denied"');
  expect(output).not.toContain("rota-card-details");
});

it("refuses a group admin without a parent grant, and a signed-out visitor, in the admin area", async () => {
  for (const role of ["group_admin", undefined] as const) {
    const output = await render("admin", role);
    expect(output).not.toContain("rota-card-details");
    expect(output).not.toContain("Minta család 1");
  }
});

it("opens the parent card for a group admin who is also a parent of the family, and refuses one who is not (BR24.2)", async () => {
  // As seeded, the group admin holds the group admin grant and a family link but no parent grant.
  expect(await render("szulo", "group_admin")).not.toContain("rota-card-details");
  const admin = requestWorld.access.group_admin;
  const link = admin.parent as { family_id: string; organization_id: string };
  admin.grants.push({
    id: "parent-grant",
    role: "parent",
    scope_type: "family",
    scope_id: link.family_id,
    organization_id: link.organization_id,
  });
  const output = await render("szulo", "group_admin");
  expect(output).toContain('data-testid="rota-card-details"');
  expect(output).toContain('href="/szulo/beosztas"');
});
