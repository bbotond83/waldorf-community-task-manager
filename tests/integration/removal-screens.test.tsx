/**
 * The four removal screens (U14): the parent and family confirmations, the result page and the restore page. The pages
 * are rendered with the real facades over port doubles; the database's side is covered by tests/database/removal-*.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AdminItemModel,
  RemovalPreviewModel,
  RemovalSubjectModel,
} from "../../src/application/index.ts";
import { RemovalForm } from "../../app/admin/_components/RemovalForm.tsx";
import { requestWorld, GROUP_DETAIL } from "../support/request-world.ts";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("../../app/_identity/production-request.ts", async () =>
  (await import("../support/request-world.ts")).requestWorldModule(),
);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
  useRouter: () => ({ refresh: vi.fn(), push: navigation.push }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const FAMILY = "aaaaaaaa-0000-4000-8000-0000000000f1";
const PARENT = "aaaaaaaa-0000-4000-8000-000000000001";
const OTHER_PARENT = "aaaaaaaa-0000-4000-8000-000000000002";
const GROUP = GROUP_DETAIL.group.id;
const BLOCKS = [
  "rota_planning",
  "dutychanges",
  "duties",
  "checklists",
  "todo",
  "library",
  "events",
  "recurring_duties",
  "notifications",
  "working_groups",
  "directory",
] as const;

const preview = (
  subject: RemovalSubjectModel,
  extra: Partial<RemovalPreviewModel> = {},
): RemovalPreviewModel => ({
  subject,
  version: 4,
  steps: BLOCKS.map((block) => ({ block, toClear: block === "duties" ? 2 : 0, toFlag: 0 })),
  totals: { toClear: 2, toFlag: 0 },
  groupsLeftWithoutCoordinator: [{ groupId: GROUP, groupName: "Kerti kör" }],
  ...extra,
});

const parentRow = (id: string, displayName: string) => ({
  id,
  displayName,
  version: 2,
  linked: false,
  invitation: "none" as const,
});

function familyRecord(extra: Partial<AdminItemModel> = {}): AdminItemModel {
  return {
    id: FAMILY,
    title: "Minta család",
    state: "active",
    version: 4,
    kind: "family",
    details: {
      parents: [parentRow(PARENT, "Minta Anna"), parentRow(OTHER_PARENT, "Minta Béla")],
      children: [],
      groups: [],
    },
    ...extra,
  } as AdminItemModel;
}

/** Answers the record read with `data`; every other read goes to the double as usual. */
function record(data: AdminItemModel) {
  const admin = requestWorld.ports.admin;
  const usual = admin.execute.bind(admin);
  vi.spyOn(admin, "execute").mockImplementation((async (input: Parameters<typeof usual>[0]) =>
    input.operation === "records.get" ? { state: "success", data } : usual(input)) as never);
}

function answerPreview(extra: Partial<RemovalPreviewModel> = {}) {
  requestWorld.ports.removal.preview = async (subject) => ({
    state: "success",
    data: preview(subject, extra),
  });
}

type Page = (input: unknown) => Promise<ReactNode>;
async function renderPage(path: string, input: unknown): Promise<HTMLElement> {
  const page = (await import(path)).default as Page;
  const holder = document.createElement("div");
  holder.innerHTML = renderToStaticMarkup(await page(input));
  return holder;
}
const params = (value: Record<string, string>, query: Record<string, unknown> = {}) => ({
  params: Promise.resolve(value),
  searchParams: Promise.resolve(query),
});
const byId = (root: HTMLElement, id: string) => root.querySelector(`[data-testid="${id}"]`);
const text = (root: HTMLElement, id: string) => byId(root, id)?.textContent ?? "";

const familyPage = () =>
  renderPage("../../app/admin/nyilvantartasok/[id]/eltavolitas/page.tsx", params({ id: FAMILY }));
const parentPage = () =>
  renderPage(
    "../../app/admin/nyilvantartasok/[id]/szulo/[parentId]/eltavolitas/page.tsx",
    params({ id: FAMILY, parentId: PARENT }),
  );
const familyResult = (query: Record<string, unknown> = {}) =>
  renderPage(
    "../../app/admin/nyilvantartasok/[id]/eltavolitas/eredmeny/page.tsx",
    params({ id: FAMILY }, query),
  );
const parentResult = (query: Record<string, unknown> = {}) =>
  renderPage(
    "../../app/admin/nyilvantartasok/[id]/szulo/[parentId]/eltavolitas/eredmeny/page.tsx",
    params({ id: FAMILY, parentId: PARENT }, query),
  );

beforeEach(() => {
  vi.restoreAllMocks();
  navigation.push.mockReset();
  requestWorld.reset();
  requestWorld.signIn("super_admin");
});

describe("the removal confirmations (W1, W2, W6)", () => {
  it("shows a family's consequences, counts per area with a total, the groups, the button and the way back", async () => {
    record(familyRecord());
    answerPreview();
    const page = await familyPage();
    expect(page.querySelector("h1")?.textContent).toBe("Család eltávolítása");
    expect(page.querySelector("h2")?.textContent).toBe("Minta család eltávolítása");
    const summary = text(page, "admin-family-remove-summary");
    for (const sentence of [
      "minden szülő bejelentkezése megszűnik",
      "törlődnek a névjegyzékből (a lezárt bejelentkezési fiók az e-mail-címet megőrzi)",
      "a jövőbeli kézi feladathelyek felszabadulnak",
      "a beosztás és az állatgondozás helyei megmaradnak, és átosztásra várnak",
      "„korábbi család”",
      "30 napig visszaállítható",
    ]) {
      expect(summary).toContain(sentence);
    }
    const rows = page.querySelectorAll(".admin-removal-table tbody tr");
    expect(rows).toHaveLength(12);
    expect(text(page, "admin-removal-row-duties")).toBe("Feladathelyek20");
    expect(text(page, "admin-removal-row-total")).toBe("Összesen20");
    expect(page.querySelectorAll(".admin-removal-cards > li")).toHaveLength(12);
    expect(text(page, "admin-removal-groups")).toContain("Kerti kör");
    expect(text(page, "admin-removal-groups")).toContain(
      "Az eltávolítás után jelölj ki új koordinátort.",
    );
    const form = byId(page, "admin-family-remove-form")!;
    expect(form.querySelector('input[name="kind"]')?.getAttribute("value")).toBe("family");
    expect(form.querySelector('input[name="expectedVersion"]')?.getAttribute("value")).toBe("4");
    expect(byId(page, "admin-family-remove-form-cancel")?.textContent).toBe("Mégsem");
  });

  it.each([
    ["SELF_REMOVAL", "Ezt egy másik főadminisztrátornak kell elvégeznie"],
    ["last_super_admin", "Az utolsó főadminisztrátor nem távolítható el."],
  ] as const)("shows the refusal %s on both pages, with no button", async (refusal, words) => {
    record(familyRecord());
    answerPreview({ refusal });
    const family = await familyPage();
    expect(text(family, "admin-family-remove-refusal")).toBe(words);
    expect(byId(family, "admin-family-remove-form")).toBeNull();
    const parent = await parentPage();
    expect(text(parent, "admin-parent-remove-refusal")).toBe(words);
    expect(byId(parent, "admin-parent-remove-form")).toBeNull();
  });

  it("says a family is already removed and leads to what is left, and shows another role nothing", async () => {
    record(familyRecord({ state: "archived" }));
    answerPreview({ refusal: "VERSION_CONFLICT" });
    const done = await familyPage();
    expect(text(done, "admin-family-remove-done")).toBe("Ez a család már el lett távolítva.");
    expect(done.querySelector(`a[href$="/${FAMILY}/eltavolitas/eredmeny"]`)).not.toBeNull();
    requestWorld.signIn("teacher");
    const other = await familyPage();
    expect(byId(other, "admin-family-remove-summary")).toBeNull();
  });

  it("shows a parent's counts and form, and sends the only parent to the family's removal", async () => {
    record(familyRecord());
    answerPreview();
    const page = await parentPage();
    expect(page.querySelector("h2")?.textContent).toBe("Minta Anna eltávolítása");
    expect(text(page, "admin-parent-remove-summary")).toContain("„korábbi tag”");
    expect(byId(page, "admin-removal-counts")).not.toBeNull();
    expect(byId(page, "admin-parent-remove-form")).not.toBeNull();
    vi.restoreAllMocks();
    record(
      familyRecord({
        details: { parents: [parentRow(PARENT, "Minta Anna")], children: [], groups: [] },
      } as Partial<AdminItemModel>),
    );
    const only = await parentPage();
    expect(byId(only, "admin-parent-remove-last")).not.toBeNull();
    expect(
      only.querySelector(`a[href="/admin/nyilvantartasok/${FAMILY}/eltavolitas"]`),
    ).not.toBeNull();
    expect(byId(only, "admin-parent-remove-form")).toBeNull();
  });

  it("goes to the result page the action names, and stays put on a refusal", async () => {
    const answers = [
      { state: "conflict" as const, message: "Nem." },
      {
        state: "success" as const,
        message: "Kész.",
        resultPath: "/admin/eredmeny?allapot=eltavolitva",
      },
    ];
    render(
      <RemovalForm
        action={async () => answers.shift()!}
        submitLabel="Család eltávolítása"
        testId="removal"
        cancelHref="/admin"
      >
        <input type="hidden" name="idempotencyKey" value="remove:abc:0000" />
      </RemovalForm>,
    );
    fireEvent.click(screen.getByTestId("removal-submit-button"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Nem."));
    expect(navigation.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("removal-submit-button"));
    await waitFor(() =>
      expect(navigation.push).toHaveBeenCalledWith("/admin/eredmeny?allapot=eltavolitva"),
    );
  });
});

describe("the removal result (W7)", () => {
  const ITEMS = [
    {
      kind: "future_place" as const,
      itemId: "p1",
      label: "Belső takarítás",
      onDate: "2026-12-07",
      link: "/admin/tanev",
    },
    { kind: "held_book" as const, itemId: "b1", label: "Mesekönyv", link: "/admin/konyvtar/b1" },
  ];
  const answerItems = (items: typeof ITEMS | [] = ITEMS) => {
    requestWorld.ports.removal.flaggedItems = async (subject) => ({
      state: "success",
      data: { subject, items },
    });
  };
  const withoutCoordinator = () => {
    requestWorld.ports.workingGroups.detailOutcome = {
      state: "success",
      data: { ...GROUP_DETAIL, hasCoordinator: false },
    };
  };

  it("right after a removal shows success, the warning, each item with its link and the groups", async () => {
    record(familyRecord({ state: "archived" }));
    answerItems();
    withoutCoordinator();
    const page = await familyResult({
      allapot: "eltavolitva",
      kijelentkezes: "sikertelen",
      csoport: [GROUP, "not-an-id"],
    });
    expect(byId(page, "admin-removal-success")?.getAttribute("role")).toBe("status");
    expect(text(page, "admin-removal-success")).toBe("A család eltávolítva.");
    expect(text(page, "admin-removal-sign-out-warning")).toContain(
      "Egy kijelentkeztetés nem sikerült",
    );
    const flagged = byId(page, "admin-removal-flagged")!;
    expect(flagged.querySelector("h2")?.textContent).toBe("Intézendő tételek");
    expect(flagged.querySelectorAll("li")).toHaveLength(2);
    expect(flagged.textContent).toContain("Jövőbeli beosztás");
    expect(flagged.textContent).toContain("2026. dec. 7.");
    expect(flagged.querySelector('a[href="/admin/konyvtar/b1"]')?.textContent).toBe("Mesekönyv");
    const groups = byId(page, "admin-removal-groups")!;
    expect(groups.querySelectorAll("li")).toHaveLength(1);
    expect(groups.querySelector("a")?.getAttribute("href")).toBe(`/admin/munkacsoportok/${GROUP}`);
    expect(groups.querySelector("a")?.textContent).toBe("Koordinátor kijelölése");
  });

  it("visited later shows what is left only: no success, and no group that has a coordinator again", async () => {
    record(familyRecord({ state: "archived" }));
    answerItems([]);
    const page = await familyResult({ csoport: GROUP });
    expect(byId(page, "admin-removal-success")).toBeNull();
    expect(byId(page, "admin-removal-sign-out-warning")).toBeNull();
    expect(text(page, "admin-removal-flagged")).toContain("Nincs intézendő tétel.");
    expect(byId(page, "admin-removal-groups")).toBeNull();
  });

  it("claims no success from the address alone, for a family or a parent that is still there", async () => {
    record(familyRecord());
    answerItems([]);
    for (const page of [
      await familyResult({ allapot: "eltavolitva" }),
      await parentResult({ allapot: "eltavolitva" }),
    ]) {
      expect(byId(page, "admin-removal-not-removed")).not.toBeNull();
      expect(byId(page, "admin-removal-success")).toBeNull();
    }
  });

  it("shows a removed parent's result, and another role no item", async () => {
    record(
      familyRecord({
        details: { parents: [parentRow(OTHER_PARENT, "Minta Béla")], children: [], groups: [] },
      } as Partial<AdminItemModel>),
    );
    answerItems();
    const page = await parentResult({ allapot: "eltavolitva" });
    expect(text(page, "admin-removal-success")).toBe("A szülő eltávolítva.");
    requestWorld.signIn("teacher");
    const other = await parentResult({ allapot: "eltavolitva" });
    expect(other.textContent).not.toContain("Mesekönyv");
  });
});

describe("the family record and the archived family (W2, W5)", () => {
  const recordPage = () =>
    renderPage("../../app/admin/nyilvantartasok/[id]/page.tsx", params({ id: FAMILY }));
  const archivePage = () =>
    renderPage("../../app/admin/archivum/[id]/page.tsx", params({ id: FAMILY }));

  it("offers a family the confirmation page instead of a one-click archive; other records keep the button", async () => {
    record(familyRecord());
    const family = await recordPage();
    expect(byId(family, "admin-family-remove-link")?.getAttribute("href")).toBe(
      `/admin/nyilvantartasok/${FAMILY}/eltavolitas`,
    );
    expect(byId(family, "admin-record-archive-form")).toBeNull();
    vi.restoreAllMocks();
    record({ id: FAMILY, title: "Kerti kör", state: "active", version: 1, kind: "group" });
    const group = await recordPage();
    expect(byId(group, "admin-record-archive-form")).not.toBeNull();
    expect(byId(group, "admin-family-remove-link")).toBeNull();
  });

  it("says what a restore brings back and what it does not, and links to the items left", async () => {
    record(familyRecord({ state: "archived" }));
    const page = await archivePage();
    const summary = byId(page, "admin-family-restore-summary")!;
    expect([...summary.querySelectorAll("h3")].map((heading) => heading.textContent)).toEqual([
      "Ami visszaáll:",
      "Ami nem áll vissza:",
    ]);
    expect(summary.querySelectorAll("li")).toHaveLength(8);
    expect(summary.textContent).toContain("minden szülőnek új meghívó kell");
    expect(summary.querySelector("a")?.getAttribute("href")).toBe(
      `/admin/nyilvantartasok/${FAMILY}/eltavolitas/eredmeny`,
    );
    expect(byId(page, "admin-record-restore-form")).not.toBeNull();
  });

  it.each([
    ["an archived working group", { kind: "group", state: "archived" }],
    ["an anonymised family", { title: "Anonimizált család", state: "archived" }],
    ["a family that is not archived", { state: "active" }],
  ])("adds nothing for %s", async (_label, extra) => {
    record(familyRecord(extra as Partial<AdminItemModel>));
    expect(byId(await archivePage(), "admin-family-restore-summary")).toBeNull();
  });
});
