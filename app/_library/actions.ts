"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ApplicationResult } from "../../src/application/index.ts";
import type { ParentActionState } from "../szulo/_lib/action-state.ts";
import {
  isLibraryArea,
  LIBRARY_BASE_PATH,
  resolveLibraryActor,
  type LibraryActor,
} from "./actor.ts";
import { resolveLibraryFacade } from "./facade.ts";
import { mapLibraryResult } from "./library-result.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KEY = /^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const NO_ACCESS: ParentActionState = { state: "denied", message: "Ez a könyv nem érhető el." };
const INVALID: ParentActionState = {
  state: "validation",
  message: "A kérés érvénytelen. Frissítsd az oldalt, és próbáld újra.",
  code: "VAL-INVALID",
};

const text = (formData: FormData, field: string): string => {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
};

/**
 * The person, the facade and the checked key of one library form. The commands belong to the parent and admin pages: a
 * form sent from the teacher area, or from anywhere that is not a signed-in parent or admin, is refused before the
 * database.
 */
async function boundary(formData: FormData) {
  const idempotencyKey = text(formData, "idempotencyKey");
  const area = text(formData, "area");
  if (!isLibraryArea(area) || area === "teacher" || !KEY.test(idempotencyKey)) {
    return { ok: false as const, state: INVALID };
  }
  const [actor, library] = await Promise.all([resolveLibraryActor(area), resolveLibraryFacade()]);
  if (!actor || !library) return { ok: false as const, state: NO_ACCESS };
  return { ok: true as const, actor, library, idempotencyKey };
}

function uuidField(formData: FormData, field: string): string | undefined {
  const value = text(formData, field);
  return UUID.test(value) ? value : undefined;
}

function versionField(formData: FormData): number | undefined {
  const value = Number(formData.get("expectedVersion"));
  return Number.isInteger(value) && value >= 1 ? value : undefined;
}

/** The return date field: empty means none; anything else must be a calendar date, and the database checks the range. */
function untilField(formData: FormData): { value?: string; invalid?: boolean } {
  const raw = text(formData, "until").trim();
  if (raw === "") return {};
  return DATE.test(raw) ? { value: raw } : { invalid: true };
}

const INVALID_DATE: ParentActionState = {
  state: "validation",
  message: "Ellenőrizd a megadott adatokat.",
  code: "VAL-INVALID",
  fieldErrors: { until: "Adj meg érvényes dátumot." },
};

/** Refreshes the library list and, for a book id that is a UUID, its page, in both areas. */
function refresh(bookId?: string): void {
  for (const base of Object.values(LIBRARY_BASE_PATH)) {
    revalidatePath(base);
    if (bookId && UUID.test(bookId)) revalidatePath(`${base}/${bookId}`);
  }
}

function succeeded<T>(result: ApplicationResult<T>): boolean {
  return result.state === "success" || result.state === "recovery";
}

type BookFields = { title: string; authors: string; description?: string; ownerParentId?: string };

function bookFields(formData: FormData, actor: LibraryActor): BookFields {
  const description = text(formData, "description").trim();
  const owner = uuidField(formData, "ownerParentId");
  // Only a super admin names an owner; for anyone else the database would refuse it, so it is not sent.
  const mayNameOwner = actor.session.roles.includes("super_admin");
  return {
    title: text(formData, "title").trim(),
    authors: text(formData, "authors").trim(),
    ...(description ? { description } : {}),
    ...(owner && mayNameOwner ? { ownerParentId: owner } : {}),
  };
}

/** Adds a book (BR131.1) or, with a book id and version, changes one (BR132); either ends on the book's page. */
export async function saveBookAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const fields = bookFields(formData, ctx.actor);
  const bookId = uuidField(formData, "bookId");
  const expectedVersion = versionField(formData);
  const changing = text(formData, "bookId") !== "";
  if (changing && (!bookId || expectedVersion === undefined)) return INVALID;
  const result =
    changing && bookId && expectedVersion !== undefined
      ? await ctx.library.changeBook(ctx.actor.session, {
          scope: ctx.actor.scope,
          idempotencyKey: ctx.idempotencyKey,
          bookId,
          expectedVersion,
          ...fields,
        })
      : await ctx.library.addBook(ctx.actor.session, {
          scope: ctx.actor.scope,
          idempotencyKey: ctx.idempotencyKey,
          ...fields,
        });
  if (!succeeded(result)) return mapLibraryResult(result, "");
  const target = bookId ?? (result.state === "success" ? result.data.id : null);
  refresh(target ?? undefined);
  redirect(target && UUID.test(target) ? `${ctx.actor.basePath}/${target}` : ctx.actor.basePath);
}

/** Removes a book that is not on loan (BR132.2); the list is the next page. */
export async function removeBookAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const bookId = uuidField(formData, "bookId");
  const expectedVersion = versionField(formData);
  if (!bookId || expectedVersion === undefined) return INVALID;
  const result = await ctx.library.removeBook(ctx.actor.session, {
    scope: ctx.actor.scope,
    idempotencyKey: ctx.idempotencyKey,
    bookId,
    expectedVersion,
  });
  if (!succeeded(result)) return mapLibraryResult(result, "");
  refresh(bookId);
  redirect(ctx.actor.basePath);
}

export async function borrowAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const bookId = uuidField(formData, "bookId");
  const expectedVersion = versionField(formData);
  const until = untilField(formData);
  if (!bookId || expectedVersion === undefined) return INVALID;
  if (until.invalid) return INVALID_DATE;
  const result = await ctx.library.borrow(ctx.actor.session, {
    scope: ctx.actor.scope,
    idempotencyKey: ctx.idempotencyKey,
    bookId,
    expectedVersion,
    ...(until.value ? { until: until.value } : {}),
  });
  if (succeeded(result)) refresh(bookId);
  return mapLibraryResult(result, "A könyvet kölcsönvetted.");
}

export async function setUntilAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const loanId = uuidField(formData, "loanId");
  const expectedVersion = versionField(formData);
  const until = untilField(formData);
  if (!loanId || expectedVersion === undefined) return INVALID;
  if (until.invalid) return INVALID_DATE;
  const result = await ctx.library.setUntil(ctx.actor.session, {
    scope: ctx.actor.scope,
    idempotencyKey: ctx.idempotencyKey,
    loanId,
    expectedVersion,
    ...(until.value ? { until: until.value } : {}),
  });
  if (succeeded(result)) refresh(uuidField(formData, "bookId"));
  return mapLibraryResult(result, "A visszahozás napját mentettük.");
}

/** The owner (or a super admin) takes the book back; the borrower's own "return" is the owner's act here (BR134). */
export async function returnBookAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const bookId = uuidField(formData, "bookId");
  const expectedVersion = versionField(formData);
  if (!bookId || expectedVersion === undefined) return INVALID;
  const result = await ctx.library.returnBook(ctx.actor.session, {
    scope: ctx.actor.scope,
    idempotencyKey: ctx.idempotencyKey,
    bookId,
    expectedVersion,
  });
  if (succeeded(result)) refresh(bookId);
  return mapLibraryResult(result, "A könyv visszakerült a közös polcra.");
}

async function watching(formData: FormData, on: boolean): Promise<ParentActionState> {
  const ctx = await boundary(formData);
  if (!ctx.ok) return ctx.state;
  const bookId = uuidField(formData, "bookId");
  if (!bookId) return INVALID;
  const input = { scope: ctx.actor.scope, idempotencyKey: ctx.idempotencyKey, bookId };
  const result = on
    ? await ctx.library.watch(ctx.actor.session, input)
    : await ctx.library.unwatch(ctx.actor.session, input);
  if (succeeded(result)) refresh(bookId);
  return mapLibraryResult(
    result,
    on ? "Értesítést küldünk, ha a könyv visszakerül." : "Az értesítést lemondtad.",
  );
}

export async function watchBookAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  return watching(formData, true);
}

export async function unwatchBookAction(
  _state: ParentActionState,
  formData: FormData,
): Promise<ParentActionState> {
  return watching(formData, false);
}
