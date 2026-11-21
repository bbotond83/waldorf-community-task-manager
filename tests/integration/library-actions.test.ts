import { beforeEach, describe, expect, it, vi } from "vitest";
import { conflict, denied, success, validation } from "../../src/application/index.ts";

const BOOK = "11111111-1111-4111-8111-111111111111";
const LOAN = "22222222-2222-4222-8222-222222222222";
const OWNER = "33333333-3333-4333-8333-333333333333";
const KEY = "library-test:abcdef0123";
const familyScope = { id: "family-1", type: "family", organizationId: "org" };

const world = vi.hoisted(() => ({
  actor: undefined as unknown,
  facadeOn: true,
  library: {
    addBook: vi.fn(),
    changeBook: vi.fn(),
    removeBook: vi.fn(),
    borrow: vi.fn(),
    setUntil: vi.fn(),
    returnBook: vi.fn(),
    watch: vi.fn(),
    unwatch: vi.fn(),
  },
  revalidated: [] as string[],
  redirected: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => world.revalidated.push(path) }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    world.redirected.push(path);
    throw new Error("NEXT_REDIRECT");
  },
}));
vi.mock("../../app/_library/actor.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../app/_library/actor.ts")>()),
  resolveLibraryActor: async () => world.actor,
}));
vi.mock("../../app/_library/facade.ts", () => ({
  resolveLibraryFacade: async () => (world.facadeOn ? world.library : undefined),
}));

import {
  borrowAction,
  removeBookAction,
  returnBookAction,
  saveBookAction,
  setUntilAction,
  unwatchBookAction,
  watchBookAction,
} from "../../app/_library/actions.ts";

const initial = { state: "initial" } as const;

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries({ area: "szulo", idempotencyKey: KEY, ...values })) {
    data.set(key, value);
  }
  return data;
}

const parentActor = {
  area: "szulo",
  basePath: "/szulo/konyvtar",
  scope: familyScope,
  session: { roles: ["parent"] },
};

beforeEach(() => {
  world.actor = parentActor;
  world.facadeOn = true;
  world.revalidated.length = 0;
  world.redirected.length = 0;
  for (const fn of Object.values(world.library)) {
    fn.mockReset().mockResolvedValue(success({ id: BOOK, version: 2 }));
  }
});

describe("the boundary shared by every library action", () => {
  it("refuses a wrong or teacher area, a bad key, a signed-out person and a missing facade before the database", async () => {
    for (const area of ["elnok", "teacher"]) {
      expect(
        await borrowAction(initial, form({ area, bookId: BOOK, expectedVersion: "1" })),
      ).toMatchObject({
        state: "validation",
      });
    }
    expect(
      await borrowAction(
        initial,
        form({ idempotencyKey: "x", bookId: BOOK, expectedVersion: "1" }),
      ),
    ).toMatchObject({ state: "validation" });
    world.actor = undefined;
    expect(await borrowAction(initial, form({ bookId: BOOK, expectedVersion: "1" }))).toMatchObject(
      {
        state: "denied",
        message: "Ez a könyv nem érhető el.",
      },
    );
    world.actor = parentActor;
    world.facadeOn = false;
    expect(await borrowAction(initial, form({ bookId: BOOK, expectedVersion: "1" }))).toMatchObject(
      {
        state: "denied",
      },
    );
    expect(world.library.borrow).not.toHaveBeenCalled();
  });
});

describe("saving a book", () => {
  it("adds a book with trimmed fields, never names an owner for a parent, and ends on the book's page", async () => {
    await expect(
      saveBookAction(
        initial,
        form({ title: "  Cím ", authors: " Szerző ", description: " ", ownerParentId: OWNER }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(world.library.addBook).toHaveBeenCalledWith(parentActor.session, {
      scope: familyScope,
      idempotencyKey: KEY,
      title: "Cím",
      authors: "Szerző",
    });
    expect(world.redirected).toEqual([`/szulo/konyvtar/${BOOK}`]);
    expect(world.revalidated).toContain("/szulo/konyvtar");
    expect(world.revalidated).toContain(`/teacher/konyvtar/${BOOK}`);
  });

  it("sends the owner a super admin names, and changes a book with its version", async () => {
    world.actor = { ...parentActor, session: { roles: ["super_admin"] } };
    await expect(
      saveBookAction(
        initial,
        form({
          title: "C",
          authors: "S",
          ownerParentId: OWNER,
          bookId: BOOK,
          expectedVersion: "3",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(world.library.changeBook).toHaveBeenCalledWith(
      world.library.changeBook.mock.calls[0]![0],
      expect.objectContaining({ bookId: BOOK, expectedVersion: 3, ownerParentId: OWNER }),
    );
    expect(world.library.addBook).not.toHaveBeenCalled();
  });

  it("refuses a change without a real book id or version, and shows a refusal as words next to the field", async () => {
    expect(
      await saveBookAction(
        initial,
        form({ title: "C", authors: "S", bookId: "x", expectedVersion: "1" }),
      ),
    ).toMatchObject({ state: "validation", code: "VAL-INVALID" });
    expect(
      await saveBookAction(initial, form({ title: "C", authors: "S", bookId: BOOK })),
    ).toMatchObject({ state: "validation" });
    world.library.addBook.mockResolvedValue(validation({ title: "VAL-REQUIRED" }));
    expect(await saveBookAction(initial, form({ title: "", authors: "S" }))).toMatchObject({
      state: "validation",
      fieldErrors: { title: "A mező kitöltése kötelező." },
    });
    expect(world.redirected).toEqual([]);
  });
});

describe("borrowing, the date, returning and watching", () => {
  it("borrows with a date and refreshes the pages; a bad date never reaches the database", async () => {
    expect(
      await borrowAction(
        initial,
        form({ bookId: BOOK, expectedVersion: "2", until: "2026-12-01" }),
      ),
    ).toMatchObject({ state: "success", message: "A könyvet kölcsönvetted." });
    expect(world.library.borrow).toHaveBeenCalledWith(
      parentActor.session,
      expect.objectContaining({ bookId: BOOK, expectedVersion: 2, until: "2026-12-01" }),
    );
    expect(world.revalidated).toContain(`/szulo/konyvtar/${BOOK}`);
    world.library.borrow.mockClear();
    expect(
      await borrowAction(initial, form({ bookId: BOOK, expectedVersion: "2", until: "holnap" })),
    ).toMatchObject({ state: "validation", fieldErrors: { until: "Adj meg érvényes dátumot." } });
    await borrowAction(initial, form({ bookId: BOOK, expectedVersion: "2" }));
    expect(world.library.borrow.mock.calls[0]![1]).not.toHaveProperty("until");
  });

  it("maps a refusal to one Hungarian sentence and never shows a raw code", async () => {
    world.library.borrow.mockResolvedValue(conflict("BOOK_NOT_AVAILABLE"));
    const taken = await borrowAction(initial, form({ bookId: BOOK, expectedVersion: "2" }));
    expect(taken).toMatchObject({
      state: "conflict",
      message: "Közben valaki kölcsönvette ezt a könyvet.",
    });
    world.library.returnBook.mockResolvedValue(conflict("VERSION_CONFLICT"));
    expect(
      await returnBookAction(initial, form({ bookId: BOOK, expectedVersion: "2" })),
    ).toMatchObject({ state: "conflict", message: "Közben valaki módosította, töltsd újra." });
    world.library.returnBook.mockResolvedValue(denied());
    expect(
      (await returnBookAction(initial, form({ bookId: BOOK, expectedVersion: "2" }))).message,
    ).not.toMatch(/[A-Z_]{6,}/);
  });

  it("changes the return date of a loan, clears it when empty, and returns and watches a book", async () => {
    await setUntilAction(
      initial,
      form({ loanId: LOAN, bookId: BOOK, expectedVersion: "4", until: "2026-12-24" }),
    );
    expect(world.library.setUntil.mock.calls[0]![1]).toMatchObject({
      loanId: LOAN,
      expectedVersion: 4,
      until: "2026-12-24",
    });
    await setUntilAction(initial, form({ loanId: LOAN, expectedVersion: "4" }));
    expect(world.library.setUntil.mock.calls[1]![1]).not.toHaveProperty("until");
    expect(
      await setUntilAction(initial, form({ loanId: "x", expectedVersion: "4" })),
    ).toMatchObject({
      state: "validation",
    });
    expect(
      await returnBookAction(initial, form({ bookId: BOOK, expectedVersion: "2" })),
    ).toMatchObject({
      state: "success",
      message: "A könyv visszakerült a közös polcra.",
    });
    expect(await watchBookAction(initial, form({ bookId: BOOK }))).toMatchObject({
      state: "success",
    });
    expect(await unwatchBookAction(initial, form({ bookId: BOOK }))).toMatchObject({
      state: "success",
      message: "Az értesítést lemondtad.",
    });
    expect(await watchBookAction(initial, form({ bookId: "x" }))).toMatchObject({
      state: "validation",
    });
  });

  it("removes a book and ends on the list; a retryable failure is offered again", async () => {
    await expect(
      removeBookAction(initial, form({ bookId: BOOK, expectedVersion: "2" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(world.redirected).toEqual(["/szulo/konyvtar"]);
    expect(await removeBookAction(initial, form({ bookId: BOOK }))).toMatchObject({
      state: "validation",
    });
    world.library.borrow.mockResolvedValue({
      state: "dependency-failure-retryable",
      code: "X",
      retry: { idempotencyKey: KEY, action: "borrow" },
    });
    expect(await borrowAction(initial, form({ bookId: BOOK, expectedVersion: "2" }))).toMatchObject(
      {
        state: "retryable",
      },
    );
  });
});
