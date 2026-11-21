import assert from "node:assert/strict";
import test from "node:test";
import { envelope, fakeData, type FakeHandlers } from "../../tests/support/data-fakes.ts";
import { libraryMessage } from "./copy.ts";
import { createLibraryPort } from "./library.ts";

const id = (n: number) => `cccccccc-0000-4000-8000-${String(n).padStart(12, "0")}`;
const KEY = "library-key-0001";

function port(handlers: FakeHandlers) {
  const fake = fakeData(handlers);
  return { fake, port: createLibraryPort(fake.database) };
}

const available = {
  id: id(1),
  title: "A kis herceg",
  authors: "Saint-Exupéry",
  description: "Mese",
  version: 2,
  owner: { kind: "parent", display_name: "Fenyő Anna" },
  state: "available",
  holder_display_name: null,
  until: null,
  is_own: true,
  borrowed_by_me: false,
};
const borrowed = {
  ...available,
  id: id(2),
  description: null,
  owner: { kind: "typed", display_name: "Régi Gazda" },
  state: "borrowed",
  holder_display_name: "Napraforgó Csilla",
  until: "2026-12-01",
  is_own: false,
  borrowed_by_me: true,
};

test("the list carries each book with its owner, its state and who holds it, and whether the caller may add", async () => {
  const { port: library, fake } = port({
    rpc: () =>
      envelope("success", null, { items: [available, borrowed], caller: { can_add: true } }),
  });
  const outcome = await library.list({ search: "herceg" });
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  assert.equal(outcome.data.canAdd, true);
  assert.deepEqual(
    outcome.data.items.map((item) => [
      item.title,
      item.owner.kind,
      item.state,
      item.holderDisplayName,
      item.until,
      item.isOwn,
      item.borrowedByMe,
    ]),
    [
      ["A kis herceg", "parent", "available", undefined, undefined, true, false],
      ["A kis herceg", "typed", "borrowed", "Napraforgó Csilla", "2026-12-01", false, true],
    ],
  );
  assert.equal(outcome.data.items[0]?.description, "Mese");
  assert.equal(outcome.data.items[1]?.description, undefined);
  assert.ok(Object.isFrozen(outcome.data) && Object.isFrozen(outcome.data.items[0]));
  assert.deepEqual(fake.rpcCalls[0], { name: "library_list", args: { p_search: "herceg" } });
});

test("a list without a search sends none, and an unknown owner kind reads as a former member", async () => {
  const { port: library, fake } = port({
    rpc: () =>
      envelope("success", null, {
        items: [{ ...available, owner: { kind: "strange", display_name: "korábbi tag" } }],
      }),
  });
  const outcome = await library.list({});
  assert.ok(outcome.state === "success" && outcome.data.items[0]?.owner.kind === "former");
  assert.ok(outcome.state === "success" && outcome.data.canAdd === false);
  assert.deepEqual(fake.rpcCalls[0], { name: "library_list", args: { p_search: null } });
});

test("a refused list stays a refusal and never reads as an empty library", async () => {
  const { port: library } = port({
    rpc: () => envelope("denied", "session_inactive"),
  });
  assert.deepEqual(await library.list({}), { state: "denied" });
});

const detailBody = {
  book: {
    id: id(2),
    title: "Mese",
    authors: "Szerző",
    description: null,
    version: 3,
    owner: { kind: "former", display_name: "korábbi tag" },
    state: "borrowed",
  },
  loan: {
    id: id(9),
    version: 4,
    until: null,
    borrowed_at: "2026-11-01T10:00:00+00:00",
    holder_display_name: "Napraforgó Csilla",
    is_mine: true,
  },
  caller: {
    can_edit: false,
    can_remove: false,
    can_borrow: false,
    can_return: false,
    can_set_until: true,
    can_watch: false,
    is_watching: false,
  },
};

test("a book page carries the book, its open loan and what the caller may do", async () => {
  const { port: library, fake } = port({ rpc: () => envelope("success", null, detailBody, id(2)) });
  const outcome = await library.detail(id(2));
  assert.equal(outcome.state, "success");
  if (outcome.state !== "success") return;
  assert.equal(outcome.data.book.owner.displayName, "korábbi tag");
  assert.equal(outcome.data.book.description, undefined);
  assert.deepEqual(
    [
      outcome.data.loan?.id,
      outcome.data.loan?.version,
      outcome.data.loan?.until,
      outcome.data.loan?.isMine,
    ],
    [id(9), 4, undefined, true],
  );
  assert.equal(outcome.data.caller.canSetUntil, true);
  assert.equal(outcome.data.caller.canReturn, false);
  assert.ok(Object.isFrozen(outcome.data) && Object.isFrozen(outcome.data.caller));
  assert.deepEqual(fake.rpcCalls[0], { name: "library_get", args: { p_book_id: id(2) } });
});

test("an available book has no loan, and an address that is not an identifier is denied without a call", async () => {
  const { port: library, fake } = port({
    rpc: () =>
      envelope(
        "success",
        null,
        { ...detailBody, book: { ...detailBody.book, state: "available" }, loan: null },
        id(2),
      ),
  });
  const outcome = await library.detail(id(2));
  assert.ok(outcome.state === "success" && outcome.data.loan === undefined);
  assert.deepEqual(await library.detail("not-an-id"), { state: "denied" });
  assert.equal(fake.rpcCalls.length, 1);
});

test("every command is one named function with the key and the version the screen saw", async () => {
  const { port: library, fake } = port({
    rpc: () => envelope("success", null, { version: 5 }, id(3)),
  });
  const book = { title: "T", authors: "A" };
  const results = await Promise.all([
    library.addBook({ idempotencyKey: KEY, ...book, description: "D", ownerParentId: id(7) }),
    library.changeBook({ idempotencyKey: KEY, bookId: id(3), expectedVersion: 2, ...book }),
    library.removeBook({ idempotencyKey: KEY, bookId: id(3), expectedVersion: 2 }),
    library.borrow({ idempotencyKey: KEY, bookId: id(3), expectedVersion: 2, until: "2026-12-01" }),
    library.setUntil({ idempotencyKey: KEY, loanId: id(4), expectedVersion: 1 }),
    library.returnBook({ idempotencyKey: KEY, bookId: id(3), expectedVersion: 3 }),
    library.watch({ idempotencyKey: KEY, bookId: id(3) }),
    library.unwatch({ idempotencyKey: KEY, bookId: id(3) }),
  ]);
  assert.ok(results.every((result) => result.state === "success"));
  assert.deepEqual(
    results.map((result) => result.state === "success" && [result.data.id, result.data.version]),
    Array(8).fill([id(3), 5]),
  );
  const calls = Object.fromEntries(fake.rpcCalls.map((call) => [call.name, call.args]));
  assert.deepEqual(calls.library_book_add, {
    p_idempotency_key: KEY,
    p_title: "T",
    p_authors: "A",
    p_description: "D",
    p_owner_parent_id: id(7),
  });
  assert.deepEqual(calls.library_book_change, {
    p_idempotency_key: KEY,
    p_book_id: id(3),
    p_expected_version: 2,
    p_title: "T",
    p_authors: "A",
    p_description: null,
    p_owner_parent_id: null,
  });
  assert.deepEqual(calls.library_book_borrow, {
    p_idempotency_key: KEY,
    p_book_id: id(3),
    p_expected_version: 2,
    p_until: "2026-12-01",
  });
  assert.deepEqual(calls.library_loan_set_until, {
    p_idempotency_key: KEY,
    p_loan_id: id(4),
    p_expected_version: 1,
    p_until: null,
  });
  assert.deepEqual(calls.library_watch_add, { p_idempotency_key: KEY, p_book_id: id(3) });
  assert.deepEqual(Object.keys(calls).sort(), [
    "library_book_add",
    "library_book_borrow",
    "library_book_change",
    "library_book_remove",
    "library_book_return",
    "library_loan_set_until",
    "library_watch_add",
    "library_watch_remove",
  ]);
});

test("a command without a version in the answer carries none", async () => {
  const { port: library } = port({ rpc: () => envelope("success") });
  const outcome = await library.watch({ idempotencyKey: KEY, bookId: id(3) });
  assert.deepEqual(outcome, { state: "success", data: { id: null, version: null } });
});

test("each refusal keeps its state, its code and its field reason", async () => {
  const answers: [Record<string, unknown>, unknown][] = [
    [
      { state: "conflict", code: "BOOK_NOT_AVAILABLE" },
      { state: "conflict", code: "BOOK_NOT_AVAILABLE" },
    ],
    [
      { state: "validation", code: "field_invalid", field: "until", reason: "before_today" },
      {
        state: "validation",
        fieldErrors: { until: "VAL-BEFORE-TODAY" },
        code: "field_invalid",
      },
    ],
    [
      { state: "validation", code: "field_invalid", field: "until", reason: "too_far" },
      { state: "validation", fieldErrors: { until: "VAL-TOO-FAR" }, code: "field_invalid" },
    ],
    [
      { state: "validation", code: "field_invalid", field: "book", reason: "own_book" },
      { state: "validation", fieldErrors: { book: "VAL-OWN-BOOK" }, code: "field_invalid" },
    ],
    [
      {
        state: "validation",
        code: "field_invalid",
        field: "owner_parent_id",
        reason: "not_a_parent",
      },
      {
        state: "validation",
        fieldErrors: { ownerParentId: "VAL-PERSON-INVALID" },
        code: "field_invalid",
      },
    ],
    [
      { state: "validation", code: "field_invalid", field: "book", reason: "not_found" },
      { state: "validation", fieldErrors: { book: "VAL-NOT-FOUND" }, code: "field_invalid" },
    ],
    [{ state: "denied", code: "BOOK_UNAVAILABLE" }, { state: "denied" }],
  ];
  for (const [answer, expected] of answers) {
    const { port: library } = port({
      rpc: () => envelope(answer.state as never, answer.code as never, answer),
    });
    const outcome = await library.borrow({
      idempotencyKey: KEY,
      bookId: id(3),
      expectedVersion: 1,
    });
    assert.deepEqual(outcome, expected, JSON.stringify(answer));
  }
});

test("each refusal reads as one Hungarian sentence, and an unknown refusal as the general one", () => {
  const codes = [
    "BOOK_NOT_AVAILABLE",
    "BOOK_NOT_ON_LOAN",
    "BOOK_ON_LOAN",
    "BOOK_AVAILABLE",
    "BOOK_REMOVED",
    "BOOK_UNAVAILABLE",
    "ALREADY_WATCHING",
    "VERSION_CONFLICT",
    "authorization_denied",
  ];
  const sentences = codes.map((code) => libraryMessage({ state: "conflict", code }));
  assert.equal(new Set(sentences).size, codes.length, "every code has its own sentence");
  assert.ok(
    sentences.every((sentence) => /[a-záéíóöőúüű]/i.test(sentence) && !sentence.includes("_")),
  );
  assert.equal(
    libraryMessage({ state: "denied" }),
    libraryMessage({ state: "conflict", code: "BOOK_UNAVAILABLE" }),
  );
  for (const reason of [
    "VAL-OWN-BOOK",
    "VAL-BEFORE-TODAY",
    "VAL-TOO-FAR",
    "VAL-HOLDER-OR-OWNER",
    "VAL-PERSON-INVALID",
  ]) {
    const message = libraryMessage({ state: "validation", fieldErrors: { field: reason } });
    assert.ok(!message.includes("VAL-"), reason);
  }
  assert.equal(
    libraryMessage({ state: "conflict", code: "SOMETHING_NEW" }),
    libraryMessage({ state: "validation", fieldErrors: { x: "VAL-UNKNOWN" } }),
  );
});
