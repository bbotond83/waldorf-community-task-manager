import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Role, Scope } from "../access/index.ts";
import { sessionGrantBindings } from "../access/session-grants.ts";
import {
  AuthorizationContract,
  FacadePipeline,
  InMemoryAuthorizationVersions,
  LibraryApplicationFacade,
  type DomainOutcome,
  type LibraryApplicationPort,
  type SessionContext,
} from "./index.ts";
import type { LibraryBookDetailModel, LibraryChangeModel, LibraryListModel } from "./contracts.ts";

const organization: Scope = { id: "org-1", type: "organization", organizationId: "org-1" };
const family: Scope = { id: "family-1", type: "family", organizationId: "org-1" };
const group: Scope = { id: "group-1", type: "group", organizationId: "org-1" };
const KEY = "key-0001-abcdefgh";
const CHANGE: LibraryChangeModel = { id: "x-1", version: 2 };
const LIST: LibraryListModel = {
  items: [
    {
      id: "b-1",
      title: "A kis herceg",
      authors: "Saint-Exupéry",
      version: 1,
      owner: { kind: "parent", displayName: "Fenyő Anna" },
      state: "available",
      isOwn: false,
      borrowedByMe: false,
    },
  ],
  canAdd: true,
};
const DETAIL: LibraryBookDetailModel = {
  book: {
    id: "b-1",
    title: "A kis herceg",
    authors: "Saint-Exupéry",
    version: 1,
    owner: { kind: "parent", displayName: "Fenyő Anna" },
    state: "available",
  },
  caller: {
    canEdit: false,
    canRemove: false,
    canBorrow: true,
    canReturn: false,
    canSetUntil: false,
    canWatch: false,
    isWatching: false,
  },
};

function session(role: Role, scope: Scope): SessionContext {
  return {
    subjectId: `${role}-synthetic`,
    authorizationVersion: 1,
    ...sessionGrantBindings(`${role}-synthetic`, role, [scope]),
    roles: [role],
    scopes: [scope],
  };
}

function setup(role: Role, answer?: DomainOutcome<LibraryChangeModel>) {
  const calls: Record<string, unknown>[] = [];
  const reply = answer ?? { state: "success" as const, data: CHANGE };
  const record =
    (name: string) =>
    async (input: unknown): Promise<DomainOutcome<LibraryChangeModel>> => {
      calls.push({ [name]: input });
      return reply;
    };
  const port: LibraryApplicationPort = {
    list: async (input) => {
      calls.push({ list: input });
      return { state: "success", data: LIST };
    },
    detail: async (bookId) => {
      calls.push({ detail: bookId });
      return { state: "success", data: DETAIL };
    },
    addBook: record("addBook"),
    changeBook: record("changeBook"),
    removeBook: record("removeBook"),
    borrow: record("borrow"),
    setUntil: record("setUntil"),
    returnBook: record("returnBook"),
    watch: record("watch"),
    unwatch: record("unwatch"),
  };
  const versions = new InMemoryAuthorizationVersions({ [`${role}-synthetic`]: 1 });
  const facade = new LibraryApplicationFacade(
    new FacadePipeline(new AuthorizationContract(versions)),
    port,
  );
  return { facade, calls };
}

const ROLES = [
  ["parent", family],
  ["kindergarten_teacher", organization],
  ["group_admin", group],
  ["super_admin", organization],
] as const;
const BOOK = { title: "T", authors: "A", description: "D" };

describe("the library facade", () => {
  it("lets every signed-in role read the list and a book page; a search is trimmed and an empty one dropped", async () => {
    for (const [role, scope] of ROLES) {
      const { facade, calls } = setup(role);
      const listed = await facade.list(session(role, scope), scope, { search: "  herceg " });
      assert.equal(listed.state, "success", role);
      assert.ok(listed.state === "success" && listed.data.items[0]?.title === "A kis herceg");
      assert.equal(
        (await facade.list(session(role, scope), scope, { search: "   " })).state,
        "success",
      );
      assert.equal((await facade.list(session(role, scope), scope)).state, "success");
      const detail = await facade.detail(session(role, scope), scope, "b-1");
      assert.equal(detail.state, "success", role);
      if (detail.state === "success") assert.equal(Object.isFrozen(detail.data), true);
      assert.deepEqual(calls, [
        { list: { search: "herceg" } },
        { list: {} },
        { list: {} },
        { detail: "b-1" },
      ]);
    }
  });

  it("passes every command on with its key and version and without the scope", async () => {
    const { facade, calls } = setup("parent");
    const s = session("parent", family);
    const base = { scope: family, idempotencyKey: KEY };
    const results = await Promise.all([
      facade.addBook(s, { ...base, ...BOOK, ownerParentId: "p-1" }),
      facade.changeBook(s, { ...base, bookId: "b-1", expectedVersion: 2, ...BOOK }),
      facade.removeBook(s, { ...base, bookId: "b-1", expectedVersion: 2 }),
      facade.borrow(s, { ...base, bookId: "b-1", expectedVersion: 2, until: "2026-12-01" }),
      facade.setUntil(s, { ...base, loanId: "l-1", expectedVersion: 3 }),
      facade.returnBook(s, { ...base, bookId: "b-1", expectedVersion: 4 }),
      facade.watch(s, { ...base, bookId: "b-1" }),
      facade.unwatch(s, { ...base, bookId: "b-1" }),
    ]);
    assert.ok(results.every((result) => result.state === "success"));
    assert.deepEqual(calls[0], { addBook: { idempotencyKey: KEY, ...BOOK, ownerParentId: "p-1" } });
    assert.deepEqual(calls[3], {
      borrow: { idempotencyKey: KEY, bookId: "b-1", expectedVersion: 2, until: "2026-12-01" },
    });
    assert.deepEqual(calls[7], { unwatch: { idempotencyKey: KEY, bookId: "b-1" } });
    assert.ok(calls.every((call) => !JSON.stringify(call).includes("scope")));
  });

  it("lets a super admin act too, and refuses a teacher every command before the port is reached", async () => {
    const admin = setup("super_admin");
    const added = await admin.facade.addBook(session("super_admin", organization), {
      scope: organization,
      idempotencyKey: KEY,
      ...BOOK,
    });
    assert.equal(added.state, "success");
    const teacher = setup("kindergarten_teacher");
    const s = session("kindergarten_teacher", organization);
    const base = { scope: organization, idempotencyKey: KEY };
    const refused = await Promise.all([
      teacher.facade.addBook(s, { ...base, ...BOOK }),
      teacher.facade.changeBook(s, { ...base, bookId: "b-1", expectedVersion: 1, ...BOOK }),
      teacher.facade.removeBook(s, { ...base, bookId: "b-1", expectedVersion: 1 }),
      teacher.facade.borrow(s, { ...base, bookId: "b-1", expectedVersion: 1 }),
      teacher.facade.setUntil(s, { ...base, loanId: "l-1", expectedVersion: 1 }),
      teacher.facade.returnBook(s, { ...base, bookId: "b-1", expectedVersion: 1 }),
      teacher.facade.watch(s, { ...base, bookId: "b-1" }),
      teacher.facade.unwatch(s, { ...base, bookId: "b-1" }),
    ]);
    assert.ok(refused.every((result) => result.state === "denied"));
    assert.deepEqual(teacher.calls, []);
  });

  it("refuses a malformed key or a missing version before the port is reached", async () => {
    const { facade, calls } = setup("parent");
    const s = session("parent", family);
    const badKey = await facade.addBook(s, { scope: family, idempotencyKey: "x", ...BOOK });
    assert.equal(badKey.state, "validation");
    const noVersion = await facade.borrow(s, {
      scope: family,
      idempotencyKey: KEY,
      bookId: "b-1",
      expectedVersion: 0,
    });
    assert.equal(noVersion.state, "validation");
    assert.deepEqual(calls, []);
  });

  it("returns a refusal of the database as the application result, never as success", async () => {
    const { facade } = setup("parent", { state: "conflict", code: "BOOK_NOT_AVAILABLE" });
    const result = await facade.borrow(session("parent", family), {
      scope: family,
      idempotencyKey: KEY,
      bookId: "b-1",
      expectedVersion: 1,
    });
    assert.deepEqual([result.state, result.code], ["conflict", "BOOK_NOT_AVAILABLE"]);
  });
});
