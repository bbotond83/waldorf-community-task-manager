import type { Scope } from "../access/index.ts";
import type {
  ApplicationResult,
  LibraryBookDetailModel,
  LibraryChangeModel,
  LibraryListModel,
  SessionContext,
} from "./contracts.ts";
import type { DomainOutcome, FacadePipeline } from "./facade-pipeline.ts";
import { validateIdempotencyKey, validateMutationContext } from "./validation.ts";

type Outcome<T> = Promise<DomainOutcome<T>>;
type Key = { idempotencyKey: string };
type Versioned = Key & { expectedVersion: number };
type BookFields = { title: string; authors: string; description?: string; ownerParentId?: string };

/** One database function per method, with the idempotency key and, where a row changes, the version the screen saw. */
export interface LibraryApplicationPort {
  list(input: { search?: string }): Outcome<LibraryListModel>;
  detail(bookId: string): Outcome<LibraryBookDetailModel>;
  addBook(input: Key & BookFields): Outcome<LibraryChangeModel>;
  changeBook(input: Versioned & BookFields & { bookId: string }): Outcome<LibraryChangeModel>;
  removeBook(input: Versioned & { bookId: string }): Outcome<LibraryChangeModel>;
  borrow(input: Versioned & { bookId: string; until?: string }): Outcome<LibraryChangeModel>;
  setUntil(input: Versioned & { loanId: string; until?: string }): Outcome<LibraryChangeModel>;
  returnBook(input: Versioned & { bookId: string }): Outcome<LibraryChangeModel>;
  watch(input: Key & { bookId: string }): Outcome<LibraryChangeModel>;
  unwatch(input: Key & { bookId: string }): Outcome<LibraryChangeModel>;
}

type Command<T> = Readonly<{ scope: Scope }> & T;

/**
 * The library pages every signed-in role reads (a teacher reads only) and the commands of parents and super admins
 * (U13; BR130 to BR140). The caller names the scope of a right it holds; the database repeats every check and decides
 * who owns, borrows and returns.
 */
export class LibraryApplicationFacade {
  private readonly pipeline: FacadePipeline;
  private readonly domain: LibraryApplicationPort;

  constructor(pipeline: FacadePipeline, domain: LibraryApplicationPort) {
    this.pipeline = pipeline;
    this.domain = domain;
  }

  list(
    session: SessionContext,
    scope: Scope,
    options: { search?: string } = {},
  ): Promise<ApplicationResult<LibraryListModel>> {
    const search = options.search?.trim();
    return this.read(session, scope, () => this.domain.list(search ? { search } : {}));
  }

  /** One book page. A missing, removed or other-community book reads as denied. */
  detail(
    session: SessionContext,
    scope: Scope,
    bookId: string,
  ): Promise<ApplicationResult<LibraryBookDetailModel>> {
    return this.read(session, scope, () => this.domain.detail(bookId));
  }

  addBook(session: SessionContext, input: Command<Key & BookFields>) {
    return this.command(session, input, "create", () => this.domain.addBook(withoutScope(input)));
  }

  changeBook(session: SessionContext, input: Command<Versioned & BookFields & { bookId: string }>) {
    return this.command(session, input, "update", () =>
      this.domain.changeBook(withoutScope(input)),
    );
  }

  removeBook(session: SessionContext, input: Command<Versioned & { bookId: string }>) {
    return this.command(session, input, "delete", () =>
      this.domain.removeBook(withoutScope(input)),
    );
  }

  borrow(session: SessionContext, input: Command<Versioned & { bookId: string; until?: string }>) {
    return this.command(session, input, "create", () => this.domain.borrow(withoutScope(input)));
  }

  setUntil(
    session: SessionContext,
    input: Command<Versioned & { loanId: string; until?: string }>,
  ) {
    return this.command(session, input, "update", () => this.domain.setUntil(withoutScope(input)));
  }

  returnBook(session: SessionContext, input: Command<Versioned & { bookId: string }>) {
    return this.command(session, input, "update", () =>
      this.domain.returnBook(withoutScope(input)),
    );
  }

  watch(session: SessionContext, input: Command<Key & { bookId: string }>) {
    return this.command(session, input, "create", () => this.domain.watch(withoutScope(input)));
  }

  unwatch(session: SessionContext, input: Command<Key & { bookId: string }>) {
    return this.command(session, input, "delete", () => this.domain.unwatch(withoutScope(input)));
  }

  private read<T>(
    session: SessionContext,
    scope: Scope,
    run: () => DomainOutcome<T> | Promise<DomainOutcome<T>>,
  ): Promise<ApplicationResult<T>> {
    return this.pipeline.invoke<T>({
      session,
      matrixRowId: "AUTH-LIBRARY",
      action: "read",
      resource: "library",
      scope,
      invoke: run,
      project: (model) => Object.freeze(model) as Readonly<T>,
    });
  }

  private command(
    session: SessionContext,
    input: Command<Key & { expectedVersion?: number }>,
    action: "create" | "update" | "delete",
    run: () => Outcome<LibraryChangeModel>,
  ): Promise<ApplicationResult<LibraryChangeModel>> {
    return this.pipeline.invoke<LibraryChangeModel>({
      session,
      matrixRowId: "AUTH-LIBRARY-COMMANDS",
      action,
      resource: "library_book",
      scope: input.scope,
      idempotencyKey: input.idempotencyKey,
      validate: () => keyCheck(input),
      invoke: run,
      project: (model) => Object.freeze({ ...model }),
    });
  }
}

function withoutScope<T extends { scope: Scope }>(input: T): Omit<T, "scope"> {
  const rest: Partial<T> = { ...input };
  delete rest.scope;
  return rest as Omit<T, "scope">;
}

/** The key, and the version when the command carries one. */
function keyCheck(input: Key & { expectedVersion?: number }) {
  if (input.expectedVersion === undefined) return validateIdempotencyKey(input.idempotencyKey);
  const checked = validateMutationContext({
    idempotencyKey: input.idempotencyKey,
    expectedVersion: input.expectedVersion,
  });
  return checked.state === "validation" ? checked : undefined;
}
