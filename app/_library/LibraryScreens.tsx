import type {
  ApplicationResult,
  LibraryBookDetailModel,
  LibraryBookItem,
} from "../../src/application/index.ts";
import {
  budapestToday,
  formatLibraryDate,
  isOverdue,
  latestReturnDate,
} from "../../src/application/library-format.ts";
import { terminalFailure } from "../../src/application/results.ts";
import { STATUS_ICON_CHARACTERS, type StatusSymbol } from "../../src/application/status-labels.ts";
import { StatusBadge } from "../../src/runtime/StatusBadge.tsx";
import { ParentStatePanel } from "../szulo/_components/ParentStatePanel.tsx";
import { resolveDirectoryFacade } from "../szulo/_lib/facade.ts";
import type { LibraryActor, LibraryArea } from "./actor.ts";
import { resolveLibraryFacade } from "./facade.ts";
import {
  BookForm,
  BorrowForm,
  LibrarySearch,
  RemoveForm,
  ReturnForm,
  SetUntilForm,
  WatchForm,
  type OwnerOption,
} from "./LibraryForms.tsx";

const symbol = (icon: keyof typeof STATUS_ICON_CHARACTERS): StatusSymbol => ({
  icon,
  character: STATUS_ICON_CHARACTERS[icon],
});

const HOUSE_RULES =
  "Kérjük, vigyázz a könyvekre, óvd a lapokat, és a kiolvasás után helyezd vissza a közös polcra, hogy más gyermekekhez is eljuthasson a varázslat!";

function OwnerLine({ owner }: Readonly<{ owner: LibraryBookItem["owner"] }>) {
  return <span>Tulajdonos: {owner.displayName}</span>;
}

/* ---------- List ---------- */

function BookCard({
  item,
  basePath,
  today,
}: Readonly<{ item: LibraryBookItem; basePath: string; today: string }>) {
  const late = item.borrowedByMe && isOverdue(item.until, today);
  return (
    <li className="library-card" data-testid={`library-card-${item.id}`}>
      <p className="library-chips">
        {item.state === "available" ? (
          <StatusBadge
            label="Elérhető"
            symbol={symbol("check")}
            testId={`library-available-${item.id}`}
          />
        ) : (
          <StatusBadge
            label="Kölcsönözve"
            symbol={symbol("ring")}
            testId={`library-borrowed-${item.id}`}
          />
        )}
        {item.isOwn && (
          <span className="library-chip" data-testid={`library-own-${item.id}`}>
            Saját könyved
          </span>
        )}
        {item.borrowedByMe && (
          <span className="library-chip" data-testid={`library-mine-${item.id}`}>
            Nálad van
          </span>
        )}
      </p>
      <h2 className="library-title">
        <a href={`${basePath}/${item.id}`} data-testid={`library-link-${item.id}`}>
          {item.title}
        </a>
      </h2>
      <p className="library-authors">{item.authors}</p>
      <p className="library-meta">
        <OwnerLine owner={item.owner} />
      </p>
      {item.state === "borrowed" && (
        <p className="library-loan-line" data-testid={`library-loan-${item.id}`}>
          {item.holderDisplayName && <span>Kölcsönvevő: {item.holderDisplayName}</span>}
          {item.until && <span>Visszahozás határideje: {formatLibraryDate(item.until)}</span>}
        </p>
      )}
      {late && (
        <p className="library-late" role="status" data-testid={`library-late-${item.id}`}>
          Kérjük, add le a csoportszobában vagy egyeztess a visszahozatalról!
        </p>
      )}
    </li>
  );
}

/**
 * The library list: every book of the community, with a search by title or author (BR130.1). The empty-library text
 * shows only after a successful read, so a failed read never reads as an empty shelf (NFR4.9). A teacher reads only.
 */
export async function LibraryListScreen({
  actor,
  search,
}: Readonly<{ actor: LibraryActor; search: string }>) {
  const library = await resolveLibraryFacade();
  const result = library
    ? await library.list(actor.session, actor.scope, search ? { search } : {})
    : terminalFailure();
  const today = budapestToday();
  return (
    <section className="parent-page library-page" data-testid="library-list-page">
      <header className="library-header">
        <p className="eyebrow">Közösségi élet</p>
        <h1 tabIndex={-1}>Könyvtár</h1>
        <p className="library-intro">
          Közösségi kölcsönzőkönyvtár szülőknek és pedagógusoknak: Waldorf-pedagógia, mesék,
          gyermeknevelés és kézművesség.
        </p>
      </header>
      <LibrarySearch action={actor.basePath} value={search} />
      {(result.state === "success" || result.state === "recovery") && result.data.canAdd && (
        <p className="parent-page-actions">
          <a href={`${actor.basePath}/uj`} data-testid="library-new-link">
            Új könyv
          </a>
        </p>
      )}
      <ParentStatePanel result={result} emptyMessage="A könyvtár még üres." testId="library-state">
        {(model) =>
          model.items.length === 0 ? (
            <p className="library-empty" role="status" data-testid="library-empty">
              {search ? "Nincs a keresésnek megfelelő könyv." : "A könyvtár még üres."}
            </p>
          ) : (
            <ul className="library-list" aria-label="Könyvek" data-testid="library-list">
              {model.items.map((item) => (
                <BookCard key={item.id} item={item} basePath={actor.basePath} today={today} />
              ))}
            </ul>
          )
        }
      </ParentStatePanel>
      <aside className="library-rules" data-testid="library-rules">
        <h2>Könyvtári házirend</h2>
        <p>{HOUSE_RULES}</p>
      </aside>
    </section>
  );
}

/* ---------- Book page ---------- */

function Actions({
  area,
  basePath,
  detail,
  today,
  latest,
}: Readonly<{
  area: LibraryArea;
  basePath: string;
  detail: LibraryBookDetailModel;
  today: string;
  latest: string;
}>) {
  const { book, loan, caller } = detail;
  const any =
    caller.canBorrow ||
    caller.canWatch ||
    caller.isWatching ||
    caller.canReturn ||
    (caller.canSetUntil && loan !== undefined) ||
    caller.canEdit ||
    caller.canRemove;
  if (!any) return null;
  return (
    <section
      className="library-section"
      aria-labelledby="library-actions-title"
      data-testid="library-actions"
    >
      <h2 id="library-actions-title">Műveletek</h2>
      {caller.canBorrow && <BorrowForm area={area} book={book} today={today} latest={latest} />}
      {caller.canSetUntil && loan && (
        <SetUntilForm
          area={area}
          book={book}
          loanId={loan.id}
          loanVersion={loan.version}
          until={loan.until}
          today={today}
          latest={latest}
        />
      )}
      {(caller.canWatch || caller.isWatching) && (
        <WatchForm area={area} book={book} watching={caller.isWatching} />
      )}
      {caller.canReturn && <ReturnForm area={area} book={book} />}
      {(caller.canEdit || caller.canRemove) && (
        <div className="library-owner-actions">
          {caller.canEdit && (
            <p className="parent-page-actions">
              <a href={`${basePath}/${book.id}/szerkesztes`} data-testid="library-edit-link">
                Szerkesztés
              </a>
            </p>
          )}
          {caller.canRemove && <RemoveForm area={area} book={book} />}
        </div>
      )}
    </section>
  );
}

/** One book page: the book, who holds it and what the caller may do, read in a single call (NFR9.4). */
export async function LibraryBookScreen({
  actor,
  bookId,
}: Readonly<{ actor: LibraryActor; bookId: string }>) {
  const library = await resolveLibraryFacade();
  const result: ApplicationResult<LibraryBookDetailModel> = library
    ? await library.detail(actor.session, actor.scope, bookId)
    : terminalFailure();
  const today = budapestToday();
  return (
    <section className="parent-page library-page" data-testid="library-book-page">
      <p className="parent-page-actions">
        <a href={actor.basePath} data-testid="library-back-link">
          Vissza a könyvtárhoz
        </a>
      </p>
      <ParentStatePanel
        result={result}
        emptyMessage="Ez a könyv nem érhető el."
        testId="library-book-state"
      >
        {(detail) => {
          const { book, loan } = detail;
          const late = loan?.isMine === true && isOverdue(loan.until, today);
          return (
            <>
              <header className="library-header">
                <p className="eyebrow">Közösségi könyvtár</p>
                <h1 tabIndex={-1} data-testid="library-book-title">
                  {book.title}
                </h1>
                <p className="library-authors">{book.authors}</p>
                <p className="library-chips">
                  {book.state === "available" ? (
                    <StatusBadge
                      label="Elérhető"
                      symbol={symbol("check")}
                      testId="library-book-available"
                    />
                  ) : (
                    <StatusBadge
                      label="Kölcsönözve"
                      symbol={symbol("ring")}
                      testId="library-book-borrowed"
                    />
                  )}
                  {loan?.isMine && (
                    <span className="library-chip" data-testid="library-book-mine">
                      Nálad van
                    </span>
                  )}
                </p>
              </header>
              <section className="library-section" data-testid="library-book-info">
                <p className="library-meta">
                  <OwnerLine owner={book.owner} />
                </p>
                {book.description && (
                  <p className="library-description" data-testid="library-book-description">
                    {book.description}
                  </p>
                )}
                {loan && (
                  <p className="library-loan-line" data-testid="library-book-loan">
                    <span>Kölcsönvevő: {loan.holderDisplayName}</span>
                    <span>Kölcsönzés napja: {formatLibraryDate(loan.borrowedAt)}</span>
                    {loan.until && (
                      <span>Visszahozás határideje: {formatLibraryDate(loan.until)}</span>
                    )}
                  </p>
                )}
                {late && (
                  <p className="library-late" role="status" data-testid="library-book-late">
                    Kérjük, add le a csoportszobában vagy egyeztess a visszahozatalról!
                  </p>
                )}
              </section>
              <Actions
                area={actor.area}
                basePath={actor.basePath}
                detail={detail}
                today={today}
                latest={latestReturnDate(today)}
              />
              <aside className="library-rules" data-testid="library-rules">
                <h2>Közösségi könyvtári házirend</h2>
                <p>{HOUSE_RULES}</p>
              </aside>
            </>
          );
        }}
      </ParentStatePanel>
    </section>
  );
}

/* ---------- Book form ---------- */

async function ownerOptions(actor: LibraryActor): Promise<OwnerOption[] | undefined> {
  // Only a super admin names another parent as the owner; everyone else is the owner of the book they add.
  if (!actor.session.roles.includes("super_admin")) return undefined;
  const directory = await resolveDirectoryFacade();
  const result = directory ? await directory.list(actor.session, actor.scope) : undefined;
  if (!result || (result.state !== "success" && result.state !== "recovery")) return [];
  return result.data.families
    .flatMap((family) =>
      family.parents.map((parent) => ({
        id: parent.id,
        name: `${parent.fullName} (${family.familyName})`,
      })),
    )
    .toSorted((a, b) => a.name.localeCompare(b.name, "hu"));
}

/** The new-book form, or, with a book id, the form that changes it (only its owner or a super admin reaches it). */
export async function LibraryFormScreen({
  actor,
  bookId,
}: Readonly<{ actor: LibraryActor; bookId?: string }>) {
  const library = await resolveLibraryFacade();
  const owners = await ownerOptions(actor);
  const result: ApplicationResult<LibraryBookDetailModel> | undefined =
    bookId && library ? await library.detail(actor.session, actor.scope, bookId) : undefined;
  const failed =
    bookId !== undefined && result === undefined
      ? terminalFailure<LibraryBookDetailModel>()
      : result;
  return (
    <section className="parent-page library-page" data-testid="library-form-page">
      <p className="parent-page-actions">
        <a
          href={bookId ? `${actor.basePath}/${bookId}` : actor.basePath}
          data-testid="library-form-back-link"
        >
          Vissza
        </a>
      </p>
      {failed ? (
        <ParentStatePanel
          result={failed}
          emptyMessage="Ez a könyv nem érhető el."
          testId="library-form-state"
        >
          {(detail) =>
            detail.caller.canEdit ? (
              <>
                <h1 tabIndex={-1}>Könyv szerkesztése</h1>
                <BookForm area={actor.area} book={detail.book} owners={owners} />
              </>
            ) : (
              <section
                className="parent-state"
                role="alert"
                data-testid="library-form-state-denied"
              >
                <h2>Hiba történt</h2>
                <p>Ezt a könyvet nem szerkesztheted.</p>
              </section>
            )
          }
        </ParentStatePanel>
      ) : (
        <>
          <h1 tabIndex={-1}>Új könyv</h1>
          <BookForm area={actor.area} owners={owners} />
        </>
      )}
    </section>
  );
}
