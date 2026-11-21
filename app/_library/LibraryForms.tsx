"use client";

import { useContext, type ReactNode } from "react";
import type { LibraryBookDetailModel } from "../../src/application/index.ts";
import type { LibraryArea } from "./actor.ts";
import {
  ParentFieldErrorsContext,
  ParentMutationForm,
} from "../szulo/_components/ParentMutationForm.tsx";
import {
  borrowAction,
  removeBookAction,
  returnBookAction,
  saveBookAction,
  setUntilAction,
  unwatchBookAction,
  watchBookAction,
} from "./actions.ts";

type Book = LibraryBookDetailModel["book"];

export type OwnerOption = Readonly<{ id: string; name: string }>;

/** The hidden fields every library form sends: the area it was opened in and a first key (the browser sends a fresh one). */
function Context({ area, keyName }: Readonly<{ area: LibraryArea; keyName: string }>) {
  return (
    <>
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="idempotencyKey" value={keyName} />
    </>
  );
}

function FieldError({ name, testId }: Readonly<{ name: string; testId: string }>) {
  const message = useContext(ParentFieldErrorsContext)[name];
  return message ? (
    <p id={`${name}-error`} className="parent-field-error" data-testid={`${testId}-error`}>
      {message}
    </p>
  ) : null;
}

function Field({
  id,
  name,
  label,
  testId,
  hint,
  children,
}: Readonly<{
  id: string;
  name: string;
  label: string;
  testId: string;
  hint?: string;
  children: ReactNode;
}>) {
  return (
    <div className="parent-field">
      <label htmlFor={id}>{label}</label>
      {hint && (
        <p id={`${id}-hint`} className="form-hint">
          {hint}
        </p>
      )}
      {children}
      <FieldError name={name} testId={testId} />
    </div>
  );
}

/** The return date field of the borrow and change forms: a native date picker, never required (BR133.1). */
function UntilField({
  id,
  defaultValue,
  min,
  max,
  label,
  hint,
  testId,
}: Readonly<{
  id: string;
  defaultValue?: string;
  min: string;
  max: string;
  label: string;
  hint?: string;
  testId: string;
}>) {
  const message = useContext(ParentFieldErrorsContext).until;
  return (
    <Field id={id} name="until" label={label} testId={testId} hint={hint}>
      <input
        id={id}
        name="until"
        type="date"
        defaultValue={defaultValue}
        min={min}
        max={max}
        aria-invalid={message ? true : undefined}
        aria-describedby={
          [hint ? `${id}-hint` : "", message ? "until-error" : ""].join(" ").trim() || undefined
        }
        data-testid={testId}
      />
    </Field>
  );
}

/** Adds a book, or changes one when `book` is given; a super admin also picks the owner (BR131.2, BR132.1). */
export function BookForm({
  area,
  book,
  owners,
  ownerParentId,
}: Readonly<{
  area: LibraryArea;
  book?: Book;
  /** Present only for a super admin, who may name another parent as the owner. */
  owners?: readonly OwnerOption[];
  ownerParentId?: string;
}>) {
  return (
    <ParentMutationForm
      action={saveBookAction}
      submitLabel={book ? "Mentés" : "Könyv felvétele"}
      testId="library-book-form"
      freshIdempotencyKey
    >
      <Context
        area={area}
        keyName={book ? `library-book:${book.id}:v${book.version}` : "library-book-add"}
      />
      {book && <input type="hidden" name="bookId" value={book.id} />}
      {book && <input type="hidden" name="expectedVersion" value={book.version} />}
      <Field id="library-title" name="title" label="Cím" testId="library-title">
        <input
          id="library-title"
          name="title"
          type="text"
          defaultValue={book?.title}
          maxLength={200}
          required
          data-testid="library-title"
        />
      </Field>
      <Field id="library-authors" name="authors" label="Szerző(k)" testId="library-authors">
        <input
          id="library-authors"
          name="authors"
          type="text"
          defaultValue={book?.authors}
          maxLength={200}
          required
          data-testid="library-authors"
        />
      </Field>
      <Field
        id="library-description"
        name="description"
        label="Rövid leírás"
        testId="library-description"
        hint="Nem kötelező, legfeljebb 1000 karakter."
      >
        <textarea
          id="library-description"
          name="description"
          rows={5}
          maxLength={1000}
          defaultValue={book?.description}
          aria-describedby="library-description-hint"
          data-testid="library-description"
        />
      </Field>
      {owners && (
        <Field
          id="library-owner"
          name="ownerParentId"
          label="Tulajdonos"
          testId="library-owner"
          hint="Ha üresen hagyod, te leszel a tulajdonos."
        >
          <select
            id="library-owner"
            name="ownerParentId"
            defaultValue={ownerParentId ?? ""}
            aria-describedby="library-owner-hint"
            data-testid="library-owner-select"
          >
            <option value="">{book ? "Nem változik" : "Te magad"}</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </select>
        </Field>
      )}
    </ParentMutationForm>
  );
}

export function BorrowForm({
  area,
  book,
  today,
  latest,
}: Readonly<{ area: LibraryArea; book: Book; today: string; latest: string }>) {
  return (
    <ParentMutationForm
      action={borrowAction}
      submitLabel="Kölcsönveszem"
      testId="library-borrow-form"
      freshIdempotencyKey
    >
      <Context area={area} keyName={`library-borrow:${book.id}:v${book.version}`} />
      <input type="hidden" name="bookId" value={book.id} />
      <input type="hidden" name="expectedVersion" value={book.version} />
      <UntilField
        id="library-borrow-until"
        label="Visszahozás napja (nem kötelező)"
        hint="Ha nem adsz meg dátumot, a könyv addig nálad marad, amíg vissza nem adod."
        min={today}
        max={latest}
        testId="library-borrow-until"
      />
    </ParentMutationForm>
  );
}

export function SetUntilForm({
  area,
  book,
  loanId,
  loanVersion,
  until,
  today,
  latest,
}: Readonly<{
  area: LibraryArea;
  book: Book;
  loanId: string;
  loanVersion: number;
  until?: string;
  today: string;
  latest: string;
}>) {
  return (
    <ParentMutationForm
      action={setUntilAction}
      submitLabel="Dátum mentése"
      testId="library-until-form"
      freshIdempotencyKey
    >
      <Context area={area} keyName={`library-until:${loanId}:v${loanVersion}`} />
      <input type="hidden" name="bookId" value={book.id} />
      <input type="hidden" name="loanId" value={loanId} />
      <input type="hidden" name="expectedVersion" value={loanVersion} />
      <UntilField
        id="library-until"
        label="Visszahozás tervezett napja"
        defaultValue={until}
        min={today}
        max={latest}
        testId="library-until"
      />
    </ParentMutationForm>
  );
}

export function ReturnForm({ area, book }: Readonly<{ area: LibraryArea; book: Book }>) {
  return (
    <ParentMutationForm
      action={returnBookAction}
      submitLabel="Visszakaptam"
      testId="library-return-form"
      freshIdempotencyKey
    >
      <Context area={area} keyName={`library-return:${book.id}:v${book.version}`} />
      <input type="hidden" name="bookId" value={book.id} />
      <input type="hidden" name="expectedVersion" value={book.version} />
    </ParentMutationForm>
  );
}

export function WatchForm({
  area,
  book,
  watching,
}: Readonly<{ area: LibraryArea; book: Book; watching: boolean }>) {
  return (
    <ParentMutationForm
      action={watching ? unwatchBookAction : watchBookAction}
      submitLabel={watching ? "Mégsem kérem" : "Értesítést kérek"}
      testId={watching ? "library-unwatch-form" : "library-watch-form"}
      freshIdempotencyKey
    >
      <Context area={area} keyName={`library-${watching ? "unwatch" : "watch"}:${book.id}`} />
      <input type="hidden" name="bookId" value={book.id} />
    </ParentMutationForm>
  );
}

export function RemoveForm({ area, book }: Readonly<{ area: LibraryArea; book: Book }>) {
  return (
    <ParentMutationForm
      action={removeBookAction}
      submitLabel="Törlés"
      submitAriaLabel={`A könyv törlése: ${book.title}`}
      testId="library-remove-form"
      freshIdempotencyKey
    >
      <Context area={area} keyName={`library-remove:${book.id}:v${book.version}`} />
      <input type="hidden" name="bookId" value={book.id} />
      <input type="hidden" name="expectedVersion" value={book.version} />
    </ParentMutationForm>
  );
}

/** The search box of the list: a plain GET form, so it works without scripts and the address holds the search. */
export function LibrarySearch({ action, value }: Readonly<{ action: string; value: string }>) {
  return (
    <form method="get" action={action} role="search" className="library-search">
      <label htmlFor="library-search-input">Keresés cím vagy szerző szerint</label>
      <input
        id="library-search-input"
        name="kereses"
        type="search"
        defaultValue={value}
        maxLength={100}
        placeholder="Keresés cím vagy szerző szerint…"
        data-testid="library-search-input"
      />
      <button type="submit" data-testid="library-search-button">
        Keresés
      </button>
    </form>
  );
}
