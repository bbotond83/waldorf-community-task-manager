import type pg from "pg";
import { ensureAccount } from "./stack-support.ts";
import { caller, seedGroupWorld } from "./working-groups-support.ts";
import { ORGANIZATION, OTHER_ORGANIZATION, uuid } from "./directory-support.ts";

export { caller, seedGroupWorld };
export type Call = ReturnType<typeof caller>;

/** The super admin of the shared world gets a parent record and a family of their own, so they can own and borrow. */
export const FAMILY_SUPER = uuid(9601);
export const PARENT_ROW_SUPER = uuid(9602);
/** A parent who was removed, and a parent with no sign-in account (invented). */
export const FAMILY_REMOVED = uuid(9603);
export const PARENT_ROW_REMOVED = uuid(9604);
export const FAMILY_NO_ACCOUNT_LIB = uuid(9605);
export const PARENT_ROW_NO_ACCOUNT_LIB = uuid(9606);
/** A family and parent of the second community. */
export const FAMILY_OTHER_LIB = uuid(9607);
export const PARENT_ROW_OTHER_LIB = uuid(9608);

/** Books the tests add on top of the group world (invented ids). */
export const BOOK_A = uuid(9701);
export const BOOK_B = uuid(9702);
export const BOOK_TYPED = uuid(9703);
export const BOOK_FORMER = uuid(9704);
export const BOOK_REMOVED = uuid(9705);
export const BOOK_OTHER_ORG = uuid(9706);

type BookOptions = {
  id: string;
  owner?: string | null;
  ownerName?: string | null;
  title?: string;
  authors?: string;
  description?: string | null;
  removed?: boolean;
  org?: string;
};

/** One book row, written as the schema owner. */
export async function insertBook(db: pg.Client, options: BookOptions): Promise<string> {
  const typed = options.ownerName ?? null;
  await db.query(
    `insert into books (id, organization_id, title, authors, description, owner_parent_id, owner_name, source_key, removed_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      options.id,
      options.org ?? ORGANIZATION,
      options.title ?? "Teszt könyv",
      options.authors ?? "Teszt Szerző",
      options.description ?? null,
      options.owner ?? null,
      typed,
      typed ? `row-${options.id}` : null,
      options.removed ? new Date().toISOString() : null,
    ],
  );
  return options.id;
}

type LoanOptions = {
  book: string;
  parent: string | null;
  family: string | null;
  until?: string | null;
  returnedAt?: string | null;
  borrowedAt?: string | null;
};

/** One loan row, written as the schema owner. */
export async function insertLoan(db: pg.Client, options: LoanOptions): Promise<string> {
  const result = await db.query(
    `insert into loans (organization_id, book_id, borrower_parent_id, borrower_family_id, borrowed_at, until, returned_at)
     values ((select organization_id from books where id = $1), $1, $2, $3, coalesce($4::timestamptz, now()), $5, $6)
     returning id`,
    [
      options.book,
      options.parent,
      options.family,
      options.borrowedAt ?? null,
      options.until ?? null,
      options.returnedAt ?? null,
    ],
  );
  return result.rows[0].id as string;
}

export async function insertWatch(db: pg.Client, book: string, parent: string): Promise<void> {
  await db.query(
    "insert into return_watches (organization_id, book_id, parent_id) select organization_id, id, $2 from books where id = $1",
    [book, parent],
  );
}

/**
 * The group world plus the library's cast: the super admin as a parent, a removed parent, a parent with no account, a
 * parent of another community, and the standard books: A (owned by the first family's parent), B (owned by the second
 * family's parent), one with a typed owner name, one with no owner, one removed, one of the other community.
 */
export async function seedLibraryWorld(db: pg.Client, schema: string): Promise<void> {
  await seedGroupWorld(db, schema);
  // A removed family is an archived and anonymised one: its people show as korábbi tag (C6).
  await db.query(
    `insert into families (id, organization_id, display_name) values
       ($1, $4, 'Admin család'), ($2, $4, 'Fiók nélküli család'), ($3, $5, 'Idegen család')`,
    [FAMILY_SUPER, FAMILY_NO_ACCOUNT_LIB, FAMILY_OTHER_LIB, ORGANIZATION, OTHER_ORGANIZATION],
  );
  await db.query(
    `insert into families (id, organization_id, display_name, status, archived_at, anonymized_at)
     values ($1, $2, 'Anonimizált család', 'archived', now(), now())`,
    [FAMILY_REMOVED, ORGANIZATION],
  );
  await db.query(
    `insert into parents (id, organization_id, family_id, display_name, account_id, status) values
       ($1, $5, $6, 'Admin Anna', $7, 'active'),
       ($2, $5, $8, 'Régi Rita', null, 'archived'),
       ($3, $5, $9, 'Fiók Nélküli Fanni', null, 'active'),
       ($4, $10, $11, 'Idegen Ilona', null, 'active')`,
    [
      PARENT_ROW_SUPER,
      PARENT_ROW_REMOVED,
      PARENT_ROW_NO_ACCOUNT_LIB,
      PARENT_ROW_OTHER_LIB,
      ORGANIZATION,
      FAMILY_SUPER,
      "bbbbbbbb-0000-4000-8000-000000000001",
      FAMILY_REMOVED,
      FAMILY_NO_ACCOUNT_LIB,
      OTHER_ORGANIZATION,
      FAMILY_OTHER_LIB,
    ],
  );
  await ensureAccount(db, {
    id: "bbbbbbbb-0000-4000-8000-000000000001",
    organization: ORGANIZATION,
  });
}

/** The standard books of the cast, for the tests that read and change them. */
export async function seedBooks(db: pg.Client, ownerA: string, ownerB: string): Promise<void> {
  await insertBook(db, {
    id: BOOK_A,
    owner: ownerA,
    title: "A kis herceg",
    authors: "Saint-Exupéry",
    description: "Mese.",
  });
  await insertBook(db, {
    id: BOOK_B,
    owner: ownerB,
    title: "Pál utcai fiúk",
    authors: "Molnár Ferenc",
  });
  await insertBook(db, {
    id: BOOK_TYPED,
    ownerName: "Régi Gazda",
    title: "Mese a hóemberről",
    authors: "Ismeretlen",
  });
  await insertBook(db, { id: BOOK_FORMER, title: "Gazdátlan könyv", authors: "Valaki" });
  await insertBook(db, {
    id: BOOK_REMOVED,
    owner: ownerA,
    title: "Törölt könyv",
    authors: "Senki",
    removed: true,
  });
  await insertBook(db, {
    id: BOOK_OTHER_ORG,
    owner: PARENT_ROW_OTHER_LIB,
    title: "Idegen könyv",
    authors: "Más",
    org: OTHER_ORGANIZATION,
  });
}

export const bookRow = async (db: pg.Client, id: string) =>
  (
    await db.query(
      "select id, title, authors, description, owner_parent_id, owner_name, removed_at, version from books where id = $1",
      [id],
    )
  ).rows[0] as
    | {
        id: string;
        title: string;
        authors: string;
        description: string | null;
        owner_parent_id: string | null;
        owner_name: string | null;
        removed_at: Date | null;
        version: number;
      }
    | undefined;

export const loanRows = async (db: pg.Client, book: string) =>
  (
    await db.query(
      "select id, borrower_parent_id, borrower_family_id, until::text as until, returned_at, version from loans where book_id = $1 order by borrowed_at, id",
      [book],
    )
  ).rows as {
    id: string;
    borrower_parent_id: string | null;
    borrower_family_id: string | null;
    until: string | null;
    returned_at: Date | null;
    version: number;
  }[];

export const watchRows = async (db: pg.Client, book: string) =>
  (
    await db.query("select parent_id from return_watches where book_id = $1 order by parent_id", [
      book,
    ])
  ).rows.map((row) => row.parent_id as string);

export const auditRows = async (db: pg.Client, action: string) =>
  (
    await db.query(
      "select outcome, details, target_id, group_id, actor_account_id from audit_events where action = $1 order by occurred_at, id",
      [action],
    )
  ).rows as {
    outcome: string;
    details: string | null;
    target_id: string;
    group_id: string | null;
    actor_account_id: string;
  }[];

export const noticeRows = async (db: pg.Client, parent: string, kind: string) =>
  (
    await db.query(
      "select id, target_type, target_ref from notifications where parent_id = $1 and kind = $2",
      [parent, kind],
    )
  ).rows as { id: string; target_type: string; target_ref: string }[];

export const inDaysDate = (days: number): string => {
  const now = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Budapest" }).format(now);
};
