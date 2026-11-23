import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { success } from "../../src/application/index.ts";
import type { RotaPlanModel, SchoolCalendarModel } from "../../src/application/index.ts";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error("REDIRECT:" + path);
  },
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const facade = vi.hoisted(() => ({ getCalendar: vi.fn(), getPlan: vi.fn() }));
vi.mock("../../app/_identity/rota-facade.ts", () => ({ resolveRotaFacade: async () => facade }));
vi.mock("../../app/_recurring/facade.ts", () => ({ resolveRecurringFacade: async () => undefined }));
vi.mock("../../app/admin/_lib/session.ts", () => ({
  resolveAdminSession: async () => ({
    state: "success",
    data: {
      applicationSession: {},
      scope: { id: "org", type: "organization", organizationId: "org" },
      groupIds: [],
    },
  }),
}));

const YEAR = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "2026/2027",
  startsOn: "2026-09-01",
  endsOn: "2027-06-15",
  changeoverDate: "2027-07-01",
  version: 1,
};

const CALENDAR: SchoolCalendarModel = {
  schoolYear: YEAR,
  schoolYears: [{ id: YEAR.id, name: YEAR.name }],
  weeks: [{ weekStart: "2026-09-07", isBreak: false }],
  warnings: [],
  hasPlan: true,
  standings: [
    { familyId: "00000000-0000-4000-8000-0000000000f1", displayName: "Minta család 1", standing: "staying", version: 0 },
    { familyId: "00000000-0000-4000-8000-0000000000f2", displayName: "Minta család 2", standing: "leaving", version: 2 },
    { familyId: "00000000-0000-4000-8000-0000000000f3", displayName: "Minta család 3", standing: "new", version: 1 },
  ],
  flaggedDuties: [
    {
      source: "rota",
      familyId: "00000000-0000-4000-8000-0000000000f2",
      familyDisplayName: "Minta család 2",
      title: "Belső takarítás",
      job: "indoor_cleaning",
      onDate: "2027-09-06",
      reason: "leaving_after_changeover",
    },
  ],
};

const PLAN: RotaPlanModel = {
  schoolYear: YEAR,
  plan: { id: "00000000-0000-4000-8000-0000000000b1", status: "draft", version: 1 },
  weekCount: 1,
  weeks: [
    { id: "00000000-0000-4000-8000-0000000000c1", job: "indoor_cleaning", weekStart: "2026-09-07", isBreak: false, familyId: "00000000-0000-4000-8000-0000000000f1", familyDisplayName: "Minta család 1", changedByAdmin: false, version: 1 },
    { id: "00000000-0000-4000-8000-0000000000c2", job: "front_garden", weekStart: "2026-09-07", isBreak: false, changedByAdmin: false, emptyReason: "cleared", version: 1 },
  ],
  families: [
    {
      familyId: "00000000-0000-4000-8000-0000000000f1",
      displayName: "Minta család 1",
      fullYear: true,
      counts: { indoor_cleaning: 3, front_garden: 1, water_carrying: 2, weekend_animal_care: 2 },
      aboveLowestJobs: ["indoor_cleaning"],
      weeks: 3,
      aboveLowest: true,
    },
  ],
  changedWeeks: 0,
  blockers: {
    emptyWeeks: ["2026-09-07"],
    breakWeeks: [],
    ineligibleWeeks: [],
    emptyRows: [{ weekStart: "2026-09-07", job: "front_garden" }],
    breakRows: [],
    ineligibleRows: [],
    flaggedWeeks: [
      { weekStart: "2027-09-06", job: "water_carrying", familyId: "f2", familyDisplayName: "Minta család 2", reason: "leaving_after_changeover" },
    ],
    clashWeeks: [{ weekStart: "2026-09-14", familyId: "f1", familyDisplayName: "Minta család 1" }],
  },
  warnings: {
    twoJobs: [
      { weekStart: "2026-09-21", familyId: "f1", familyDisplayName: "Minta család 1", jobs: ["water_carrying", "weekend_animal_care"] },
    ],
  },
  canPublish: false,
};

type Page = (input: { searchParams: Promise<Record<string, string | undefined>> }) => Promise<ReactNode>;

beforeEach(() => {
  facade.getCalendar.mockReset().mockResolvedValue(success(CALENDAR));
  facade.getPlan.mockReset().mockResolvedValue(success(PLAN));
});

async function render(path: "tanev" | "beosztas", query: Record<string, string | undefined> = {}) {
  const page = (await import(`../../app/admin/${path}/page.tsx`)).default as Page;
  return renderToStaticMarkup(await page({ searchParams: Promise.resolve(query) }));
}

it("Tanév lists every family with its standing, a save form for each, the changeover note and the flagged duties", async () => {
  const output = await render("tanev");
  expect(output).toContain("Összesen: 3 család · 1 Marad, 1 Távozik, 1 Új");
  expect(output).toContain('data-testid="admin-standing-form-00000000-0000-4000-8000-0000000000f2"');
  expect(output).toContain('<option value="leaving" selected="">Távozik</option>');
  expect(output).toContain("Az évváltás napja: 2027. július 1.");
  expect(output).toContain('data-testid="admin-flagged-duties"');
  expect(output).toContain("A család az évváltás után távozik.");
});

it("Tanév leaves out the flagged list when nothing is flagged and says so when there is no family", async () => {
  facade.getCalendar.mockResolvedValue(success({ ...CALENDAR, flaggedDuties: [], standings: [] }));
  const output = await render("tanev");
  expect(output).not.toContain("admin-flagged-duties");
  expect(output).toContain('data-testid="admin-standings-empty"');
});

it("Beosztás tervezése shows the tabs of the four rotas, the indoor cleaning first, with its own counts", async () => {
  const output = await render("beosztas");
  for (const job of ["indoor_cleaning", "front_garden", "water_carrying", "weekend_animal_care"]) {
    expect(output).toContain(`data-testid="admin-rota-tab-${job}"`);
  }
  expect(output).toContain("Belső takarítás – iskolai hetek beosztása");
  expect(output).toContain('aria-current="page"');
  expect(output).toContain("3 hét");
  expect(output).toContain("Több hét a többinél");
});

it("Beosztás tervezése shows another rota on its tab, with the reason of an empty week and its own counts", async () => {
  const output = await render("beosztas", { beosztas: "front_garden" });
  expect(output).toContain("Előkert – iskolai hetek beosztása");
  expect(output).toContain("1 hét");
  expect(output).not.toContain("Több hét a többinél");
  expect(output).toContain("Üres: még nincs család");
  const weekend = await render("beosztas", { beosztas: "weekend_animal_care" });
  expect(weekend).toContain('data-testid="admin-rota-weekend-note"');
  const fallback = await render("beosztas", { beosztas: "nem-ilyen" });
  expect(fallback).toContain("Belső takarítás – iskolai hetek beosztása");
});

it("Beosztás tervezése names the rota and the week of every blocker, and warns without blocking about two rotas", async () => {
  const output = await render("beosztas");
  expect(output).toContain('data-testid="admin-rota-blockers-empty"');
  expect(output).toContain("Előkert: 2026. szept. 7–13.");
  expect(output).toContain('data-testid="admin-rota-blockers-flagged"');
  expect(output).toContain("Vízhordás:");
  expect(output).toContain("A család az évváltás után távozik.");
  expect(output).toContain('data-testid="admin-rota-blockers-clash"');
  expect(output).toContain('data-testid="admin-rota-warnings"');
  expect(output).toContain("Vízhordás, Hétvégi állatgondozás");
  expect(output).not.toContain('data-testid="admin-rota-publish-form"');
});

it("Beosztás tervezése offers the family counts of the shown rota in the cell editor", async () => {
  const output = await render("beosztas");
  expect(output).toContain("Minta család 1 (3 hét)");
});
