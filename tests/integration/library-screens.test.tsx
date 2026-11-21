import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  denied,
  success,
  terminalFailure,
  type LibraryBookDetailModel,
  type LibraryBookItem,
  type LibraryListModel,
} from "../../src/application/index.ts";

const BOOK = "11111111-1111-4111-8111-111111111111";
const LOAN = "22222222-2222-4222-8222-222222222222";

const world = vi.hoisted(() => ({
  facadeOn: true,
  facade: { list: vi.fn(), detail: vi.fn() },
  directory: { list: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("../../app/_library/facade.ts", () => ({
  resolveLibraryFacade: async () => (world.facadeOn ? world.facade : undefined),
}));
vi.mock("../../app/szulo/_lib/facade.ts", () => ({
  resolveDirectoryFacade: async () => world.directory,
}));

import {
  LibraryBookScreen,
  LibraryFormScreen,
  LibraryListScreen,
} from "../../app/_library/LibraryScreens.tsx";

const actorFor = (area: "szulo" | "teacher", roles: string[] = ["parent"]) =>
  ({ area, basePath: `/${area}/konyvtar`, session: { roles }, scope: {} }) as never;

const item = (id: string, over: Partial<LibraryBookItem> = {}): LibraryBookItem => ({
  id,
  title: "A kis herceg",
  authors: "Saint-Exupéry",
  version: 1,
  owner: { kind: "parent", displayName: "Szabó Anna" },
  state: "available",
  isOwn: false,
  borrowedByMe: false,
  ...over,
});

const list = (items: LibraryBookItem[], canAdd = true): LibraryListModel => ({ items, canAdd });

const caller = {
  canEdit: false,
  canRemove: false,
  canBorrow: false,
  canReturn: false,
  canSetUntil: false,
  canWatch: false,
  isWatching: false,
};

const detail = (
  over: Partial<LibraryBookDetailModel["caller"]> = {},
  extra: Partial<LibraryBookDetailModel> = {},
): LibraryBookDetailModel => ({
  book: {
    id: BOOK,
    title: "A kis herceg",
    authors: "Saint-Exupéry",
    description: "Mese.",
    version: 3,
    owner: { kind: "parent", displayName: "Szabó Anna" },
    state: "available",
  },
  caller: { ...caller, ...over },
  ...extra,
});

const html = async (node: Promise<unknown>) => renderToStaticMarkup((await node) as never);

beforeEach(() => {
  world.facadeOn = true;
  world.facade.list.mockReset();
  world.facade.detail.mockReset();
  world.directory.list.mockReset();
});

describe("the library list", () => {
  it("shows each book with its state, owner, holder and date, links to its page and reads once", async () => {
    world.facade.list.mockResolvedValue(
      success(
        list([
          item(BOOK, { isOwn: true }),
          item("b2", {
            title: "Pál utcai fiúk",
            state: "borrowed",
            holderDisplayName: "Napraforgó Csilla",
            until: "2026-12-01",
          }),
        ]),
      ),
    );
    const out = await html(LibraryListScreen({ actor: actorFor("szulo"), search: "" }));
    expect(world.facade.list).toHaveBeenCalledTimes(1);
    expect(out).toContain(`href="/szulo/konyvtar/${BOOK}"`);
    expect(out).toContain("Saját könyved");
    expect(out).toContain("Kölcsönvevő: Napraforgó Csilla");
    expect(out).toContain("Visszahozás határideje: 2026. 12. 01.");
    expect(out).toContain('data-testid="library-new-link"');
    expect(out).toContain("Könyvtári házirend");
  });

  it("warns about a late book the caller holds, and not about one another holds", async () => {
    world.facade.list.mockResolvedValue(
      success(
        list([
          item("late", { state: "borrowed", borrowedByMe: true, until: "2020-01-01" }),
          item("other", { state: "borrowed", until: "2020-01-01" }),
        ]),
      ),
    );
    const out = await html(LibraryListScreen({ actor: actorFor("szulo"), search: "" }));
    expect(out).toContain('data-testid="library-late-late"');
    expect(out).not.toContain('data-testid="library-late-other"');
  });

  it("says the library is empty only after a successful read, and a search with no match differently", async () => {
    world.facade.list.mockResolvedValue(success(list([])));
    expect(await html(LibraryListScreen({ actor: actorFor("szulo"), search: "" }))).toContain(
      "A könyvtár még üres.",
    );
    expect(await html(LibraryListScreen({ actor: actorFor("szulo"), search: "xyz" }))).toContain(
      "Nincs a keresésnek megfelelő könyv.",
    );
    expect(world.facade.list).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), {
      search: "xyz",
    });
    world.facade.list.mockResolvedValue(terminalFailure());
    const failed = await html(LibraryListScreen({ actor: actorFor("szulo"), search: "" }));
    expect(failed).toContain("Hiba történt");
    expect(failed).not.toContain("A könyvtár még üres.");
    world.facadeOn = false;
    const missing = await html(LibraryListScreen({ actor: actorFor("szulo"), search: "" }));
    expect(missing).not.toContain("A könyvtár még üres.");
  });

  it("shows no new-book link to a reader who may not add, as for a teacher", async () => {
    world.facade.list.mockResolvedValue(success(list([item(BOOK)], false)));
    const out = await html(LibraryListScreen({ actor: actorFor("teacher"), search: "" }));
    expect(out).not.toContain("library-new-link");
    expect(out).toContain(`href="/teacher/konyvtar/${BOOK}"`);
  });
});

describe("the book page", () => {
  it("reads the book in one call and offers only what the caller may do", async () => {
    world.facade.detail.mockResolvedValue(success(detail({ canBorrow: true, canWatch: false })));
    const out = await html(LibraryBookScreen({ actor: actorFor("szulo"), bookId: BOOK }));
    expect(world.facade.detail).toHaveBeenCalledTimes(1);
    expect(world.directory.list).not.toHaveBeenCalled();
    expect(out).toContain("library-borrow-form");
    expect(out).toContain("Kölcsönveszem");
    for (const absent of [
      "library-return-form",
      "library-remove-form",
      "library-edit-link",
      "library-watch-form",
    ]) {
      expect(out).not.toContain(absent);
    }
  });

  it("shows the borrower the date change and the late reminder, and the owner the return, edit and remove", async () => {
    const loan = {
      id: LOAN,
      version: 2,
      borrowedAt: "2020-01-01",
      until: "2020-02-01",
      holderDisplayName: "Én",
      isMine: true,
    };
    world.facade.detail.mockResolvedValue(
      success(
        detail({ canSetUntil: true }, { loan, book: { ...detail().book, state: "borrowed" } }),
      ),
    );
    const mine = await html(LibraryBookScreen({ actor: actorFor("szulo"), bookId: BOOK }));
    expect(mine).toContain("library-until-form");
    expect(mine).toContain('data-testid="library-book-late"');
    world.facade.detail.mockResolvedValue(
      success(
        detail(
          { canReturn: true, canEdit: true, canRemove: false },
          { loan: { ...loan, isMine: false } },
        ),
      ),
    );
    const owner = await html(LibraryBookScreen({ actor: actorFor("szulo"), bookId: BOOK }));
    expect(owner).toContain("library-return-form");
    expect(owner).toContain(`href="/szulo/konyvtar/${BOOK}/szerkesztes"`);
    expect(owner).not.toContain("library-book-late");
    expect(owner).not.toContain("library-remove-form");
  });

  it("offers Mégsem kérem to someone who already watches, and Értesítést kérek to someone who may", async () => {
    world.facade.detail.mockResolvedValue(success(detail({ isWatching: true })));
    expect(await html(LibraryBookScreen({ actor: actorFor("szulo"), bookId: BOOK }))).toContain(
      "Mégsem kérem",
    );
    world.facade.detail.mockResolvedValue(success(detail({ canWatch: true })));
    expect(await html(LibraryBookScreen({ actor: actorFor("szulo"), bookId: BOOK }))).toContain(
      "Értesítést kérek",
    );
  });

  it("shows no action block to a reader with no rights, and an error page for an unavailable book", async () => {
    world.facade.detail.mockResolvedValue(success(detail()));
    expect(
      await html(LibraryBookScreen({ actor: actorFor("teacher"), bookId: BOOK })),
    ).not.toContain('data-testid="library-actions"');
    world.facade.detail.mockResolvedValue(denied());
    const out = await html(LibraryBookScreen({ actor: actorFor("szulo"), bookId: BOOK }));
    expect(out).toContain("library-book-state-denied");
    expect(out).not.toContain("library-book-title");
  });
});

describe("the book form", () => {
  it("shows the new-book form with no owner choice for a parent", async () => {
    const out = await html(LibraryFormScreen({ actor: actorFor("szulo") }));
    expect(out).toContain("Új könyv");
    expect(out).not.toContain("library-owner-select");
    expect(world.facade.detail).not.toHaveBeenCalled();
    expect(world.directory.list).not.toHaveBeenCalled();
  });

  it("gives a super admin the owner choice from the directory, sorted by name", async () => {
    world.directory.list.mockResolvedValue(
      success({
        families: [
          { familyName: "Kiss család", parents: [{ id: "p2", fullName: "Kiss Béla" }] },
          { familyName: "Antal család", parents: [{ id: "p1", fullName: "Antal Anna" }] },
        ],
      }),
    );
    const out = await html(LibraryFormScreen({ actor: actorFor("szulo", ["super_admin"]) }));
    expect(world.directory.list).toHaveBeenCalledTimes(1);
    expect(out.indexOf("Antal Anna")).toBeGreaterThan(0);
    expect(out.indexOf("Antal Anna")).toBeLessThan(out.indexOf("Kiss Béla"));
    world.directory.list.mockResolvedValue(terminalFailure());
    expect(await html(LibraryFormScreen({ actor: actorFor("szulo", ["super_admin"]) }))).toContain(
      "library-owner-select",
    );
  });

  it("opens the change form for someone who may edit, and refuses everyone else", async () => {
    world.facade.detail.mockResolvedValue(success(detail({ canEdit: true })));
    const edit = await html(LibraryFormScreen({ actor: actorFor("szulo"), bookId: BOOK }));
    expect(edit).toContain("Könyv szerkesztése");
    expect(edit).toContain('value="A kis herceg"');
    expect(world.facade.detail).toHaveBeenCalledTimes(1);
    world.facade.detail.mockResolvedValue(success(detail()));
    expect(await html(LibraryFormScreen({ actor: actorFor("szulo"), bookId: BOOK }))).toContain(
      "Ezt a könyvet nem szerkesztheted.",
    );
    world.facade.detail.mockResolvedValue(denied());
    expect(await html(LibraryFormScreen({ actor: actorFor("szulo"), bookId: BOOK }))).toContain(
      "library-form-state-denied",
    );
    world.facadeOn = false;
    expect(await html(LibraryFormScreen({ actor: actorFor("szulo"), bookId: BOOK }))).toContain(
      "library-form-state",
    );
  });
});
