import type {
  DomainOutcome,
  LibraryApplicationPort,
  LibraryBookDetailModel,
  LibraryBookItem,
  LibraryChangeModel,
  LibraryListModel,
  LibraryLoanModel,
  LibraryOwner,
} from "../application/index.ts";
import type { DatabaseClient } from "../runtime/database/client.ts";
import { DataGateway, type Envelope } from "./gateway.ts";
import { toOutcome } from "./results.ts";
import { asRow, asRows, flag, integer, isUuid, optionalText, text, type Row } from "./values.ts";

const OWNER_KINDS = ["parent", "typed", "former"] as const;

function toOwner(value: unknown): LibraryOwner {
  const row = asRow(value);
  const kind = (OWNER_KINDS as readonly string[]).includes(String(row.kind))
    ? (row.kind as LibraryOwner["kind"])
    : "former";
  return Object.freeze({ kind, displayName: text(row, "display_name") });
}

const state = (row: Row): "available" | "borrowed" =>
  row.state === "borrowed" ? "borrowed" : "available";

function toItem(row: Row): LibraryBookItem {
  const description = optionalText(row, "description");
  const holder = optionalText(row, "holder_display_name");
  const until = optionalText(row, "until");
  return Object.freeze({
    id: text(row, "id"),
    title: text(row, "title"),
    authors: text(row, "authors"),
    version: integer(row, "version"),
    owner: toOwner(row.owner),
    state: state(row),
    isOwn: flag(row, "is_own"),
    borrowedByMe: flag(row, "borrowed_by_me"),
    ...(description ? { description } : {}),
    ...(holder ? { holderDisplayName: holder } : {}),
    ...(until ? { until } : {}),
  });
}

function toList(envelope: Envelope): LibraryListModel {
  const caller = asRow(envelope.caller ?? {});
  return Object.freeze({
    items: Object.freeze(asRows(envelope.items).map(toItem)),
    canAdd: caller.can_add === true,
  });
}

function toLoan(value: unknown): LibraryLoanModel {
  const row = asRow(value);
  const until = optionalText(row, "until");
  return Object.freeze({
    id: text(row, "id"),
    version: integer(row, "version"),
    borrowedAt: text(row, "borrowed_at"),
    holderDisplayName: text(row, "holder_display_name"),
    isMine: flag(row, "is_mine"),
    ...(until ? { until } : {}),
  });
}

function toDetail(envelope: Envelope): LibraryBookDetailModel {
  const book = asRow(envelope.book);
  const caller = asRow(envelope.caller);
  const description = optionalText(book, "description");
  const hasLoan = envelope.loan !== null && envelope.loan !== undefined;
  return Object.freeze({
    book: Object.freeze({
      id: text(book, "id"),
      title: text(book, "title"),
      authors: text(book, "authors"),
      version: integer(book, "version"),
      owner: toOwner(book.owner),
      state: state(book),
      ...(description ? { description } : {}),
    }),
    ...(hasLoan ? { loan: toLoan(envelope.loan) } : {}),
    caller: Object.freeze({
      canEdit: flag(caller, "can_edit"),
      canRemove: flag(caller, "can_remove"),
      canBorrow: flag(caller, "can_borrow"),
      canReturn: flag(caller, "can_return"),
      canSetUntil: flag(caller, "can_set_until"),
      canWatch: flag(caller, "can_watch"),
      isWatching: flag(caller, "is_watching"),
    }),
  });
}

function toChange(envelope: Envelope): LibraryChangeModel {
  return Object.freeze({
    id: typeof envelope.reference === "string" ? envelope.reference : null,
    version:
      typeof envelope.version === "number" && Number.isInteger(envelope.version)
        ? envelope.version
        : null,
  });
}

/**
 * The database's library reads and commands (U13). Every command is one named function with the idempotency key and,
 * where a row is changed, the version the screen saw. A refusal stays a refusal, never an empty list; an address that
 * is not an identifier names nothing and reads as denied without asking the database.
 */
export function createLibraryPort(database: DatabaseClient): LibraryApplicationPort {
  const gateway = new DataGateway(database);
  const change = async (
    name: string,
    args: Readonly<Record<string, unknown>>,
    key: string,
  ): Promise<DomainOutcome<LibraryChangeModel>> =>
    toOutcome(await gateway.call(name, args, key), toChange);
  const DENIED: DomainOutcome<never> = { state: "denied" };
  return {
    async list({ search }) {
      return toOutcome(await gateway.call("library_list", { p_search: search ?? null }), toList);
    },
    async detail(bookId) {
      if (!isUuid(bookId)) return DENIED;
      return toOutcome(await gateway.call("library_get", { p_book_id: bookId }), toDetail);
    },
    addBook: ({ idempotencyKey, title, authors, description, ownerParentId }) =>
      change(
        "library_book_add",
        {
          p_idempotency_key: idempotencyKey,
          p_title: title,
          p_authors: authors,
          p_description: description ?? null,
          p_owner_parent_id: ownerParentId ?? null,
        },
        idempotencyKey,
      ),
    changeBook: ({
      idempotencyKey,
      bookId,
      expectedVersion,
      title,
      authors,
      description,
      ownerParentId,
    }) =>
      change(
        "library_book_change",
        {
          p_idempotency_key: idempotencyKey,
          p_book_id: bookId,
          p_expected_version: expectedVersion,
          p_title: title,
          p_authors: authors,
          p_description: description ?? null,
          p_owner_parent_id: ownerParentId ?? null,
        },
        idempotencyKey,
      ),
    removeBook: ({ idempotencyKey, bookId, expectedVersion }) =>
      change(
        "library_book_remove",
        {
          p_idempotency_key: idempotencyKey,
          p_book_id: bookId,
          p_expected_version: expectedVersion,
        },
        idempotencyKey,
      ),
    borrow: ({ idempotencyKey, bookId, expectedVersion, until }) =>
      change(
        "library_book_borrow",
        {
          p_idempotency_key: idempotencyKey,
          p_book_id: bookId,
          p_expected_version: expectedVersion,
          p_until: until ?? null,
        },
        idempotencyKey,
      ),
    setUntil: ({ idempotencyKey, loanId, expectedVersion, until }) =>
      change(
        "library_loan_set_until",
        {
          p_idempotency_key: idempotencyKey,
          p_loan_id: loanId,
          p_expected_version: expectedVersion,
          p_until: until ?? null,
        },
        idempotencyKey,
      ),
    returnBook: ({ idempotencyKey, bookId, expectedVersion }) =>
      change(
        "library_book_return",
        {
          p_idempotency_key: idempotencyKey,
          p_book_id: bookId,
          p_expected_version: expectedVersion,
        },
        idempotencyKey,
      ),
    watch: ({ idempotencyKey, bookId }) =>
      change(
        "library_watch_add",
        { p_idempotency_key: idempotencyKey, p_book_id: bookId },
        idempotencyKey,
      ),
    unwatch: ({ idempotencyKey, bookId }) =>
      change(
        "library_watch_remove",
        { p_idempotency_key: idempotencyKey, p_book_id: bookId },
        idempotencyKey,
      ),
  };
}
