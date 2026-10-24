import type pg from "pg";
import {
  ADMIN_G1,
  ADMIN_G2,
  asActor,
  authenticated,
  callAs,
  DEACTIVATED,
  FAMILY_1,
  FAMILY_2,
  GROUP_1,
  GROUP_2,
  openIdentityDatabase,
  ORGANIZATION,
  OTHER_ADMIN,
  OTHER_ORGANIZATION,
  OUTSIDER,
  PARENT_F1,
  PARENT_F2,
  seedIdentityWorld,
  SIGNED_OUT,
  SUPER_ADMIN,
  TEACHER_G1,
  uuid,
} from "./identity-support.ts";
import { ensureAccount, type Envelope } from "./stack-support.ts";

export {
  ADMIN_G1,
  ADMIN_G2,
  asActor,
  authenticated,
  callAs,
  DEACTIVATED,
  FAMILY_1,
  FAMILY_2,
  GROUP_1,
  GROUP_2,
  ORGANIZATION,
  OTHER_ADMIN,
  OTHER_ORGANIZATION,
  OUTSIDER,
  PARENT_F1,
  PARENT_F2,
  SIGNED_OUT,
  SUPER_ADMIN,
  TEACHER_G1,
  uuid,
};

/** The two schemas every U3 database test file runs in: a worker schema and the default one (NFR6.9). */
export const DIRECTORY_SCHEMAS = ["worker_3", "public"] as const;

/** A second parent account of the first family (the co-parent of answer Q8). */
export const CO_PARENT_F1 = "bbbbbbbb-0000-4000-8000-000000000018";

export const YEAR_1 = uuid(501);
export const YEAR_OTHER = uuid(502);
export const GROUP_OTHER = uuid(503);
/** A family of the first organization with no group membership: reached by super admins only. */
export const FAMILY_NO_GROUP = uuid(504);
export const FAMILY_OTHER = uuid(505);
export const PARENT_ROW_F1 = uuid(601);
export const PARENT_ROW_CO = uuid(602);
export const PARENT_ROW_F2 = uuid(603);
export const PARENT_ROW_DEACTIVATED = uuid(604);
export const PARENT_ROW_SIGNED_OUT = uuid(605);
export const PARENT_ROW_OTHER = uuid(606);
export const CHILD_F1 = uuid(701);
export const CHILD_F2 = uuid(702);
export const CHILD_OTHER = uuid(703);

/** The viewers of the role matrix, in the order of the plan: every role of NFR1.26. */
export const VIEWERS = {
  parent: PARENT_F1,
  coParent: CO_PARENT_F1,
  parentOther: PARENT_F2,
  teacher: TEACHER_G1,
  adminSame: ADMIN_G1,
  adminOther: ADMIN_G2,
  super: SUPER_ADMIN,
  nogrant: OUTSIDER,
  deactivated: DEACTIVATED,
  signedOut: SIGNED_OUT,
  otherOrganizationAdmin: OTHER_ADMIN,
} as const;
export type ViewerName = keyof typeof VIEWERS;

export async function openDirectoryDatabase(schema: string): Promise<pg.Client> {
  return openIdentityDatabase(schema);
}

/**
 * Empties the schema and seeds the identity world plus a small directory on top of it: the two groups
 * and two families of the identity world, a family without a group, a co-parent, the parents linked to
 * the identity accounts, contacts and children, and a second organization with its own family.
 */
export async function seedDirectoryWorld(db: pg.Client, schema: string): Promise<void> {
  // The identity world already holds the organizations, the first school year, the two groups, the two
  // families with their memberships and the two parents of the parent accounts; this adds the rest.
  await seedIdentityWorld(db, schema);
  await ensureAccount(db, { id: CO_PARENT_F1, organization: ORGANIZATION });
  await db.query(
    "insert into school_years (id, organization_id, name, starts_on, ends_on) values ($1, $2, '2026/2027', '2026-09-01', '2027-06-30')",
    [YEAR_OTHER, OTHER_ORGANIZATION],
  );
  await db.query(
    "insert into groups (id, organization_id, school_year_id, name) values ($1, $2, $3, 'Boróka')",
    [GROUP_OTHER, OTHER_ORGANIZATION, YEAR_OTHER],
  );
  await db.query(
    "insert into families (id, organization_id, display_name) values ($1, $3, 'Csoport nélküli család'), ($2, $4, 'Idegen család')",
    [FAMILY_NO_GROUP, FAMILY_OTHER, ORGANIZATION, OTHER_ORGANIZATION],
  );
  await db.query(
    "insert into group_memberships (organization_id, family_id, group_id) values ($1, $2, $3)",
    [OTHER_ORGANIZATION, FAMILY_OTHER, GROUP_OTHER],
  );
  const parent = (
    id: string,
    family: string,
    name: string,
    account: string | null,
    org = ORGANIZATION,
  ) =>
    db.query(
      "insert into parents (id, organization_id, family_id, display_name, account_id) values ($1, $2, $3, $4, $5)",
      [id, org, family, name, account],
    );
  await parent(PARENT_ROW_CO, FAMILY_1, "Fenyő Béla", CO_PARENT_F1);
  await parent(PARENT_ROW_DEACTIVATED, FAMILY_1, "Fenyő Dóra", DEACTIVATED);
  await parent(PARENT_ROW_SIGNED_OUT, FAMILY_1, "Fenyő Emma", SIGNED_OUT);
  await parent(PARENT_ROW_OTHER, FAMILY_OTHER, "Idegen Flóra", null, OTHER_ORGANIZATION);
  const contact = (parentId: string, email: string, org = ORGANIZATION) =>
    db.query(
      "insert into parent_contacts (parent_id, organization_id, contact_email, contact_phone, locality) values ($1, $2, $3, '+36 30 111 2222', 'Pécs')",
      [parentId, org, email],
    );
  await contact(PARENT_ROW_F1, "anna@example.test");
  await contact(PARENT_ROW_CO, "bela@example.test");
  await contact(PARENT_ROW_F2, "csilla@example.test");
  await contact(PARENT_ROW_OTHER, "flora@example.test", OTHER_ORGANIZATION);
  await db.query(
    "insert into children (id, organization_id, family_id, display_name) values ($1, $4, $5, 'Fenyő Gergő'), ($2, $4, $6, 'Napraforgó Hanna'), ($3, $7, $8, 'Idegen Ilona')",
    [
      CHILD_F1,
      CHILD_F2,
      CHILD_OTHER,
      ORGANIZATION,
      FAMILY_1,
      FAMILY_2,
      OTHER_ORGANIZATION,
      FAMILY_OTHER,
    ],
  );
}

export const EVENT_1 = uuid(801);
export const EVENT_2 = uuid(802);
export const EVENT_OTHER = uuid(804);
/** A task of group 1 with an event and three places. */
export const TASK_1 = uuid(811);
/** A task of group 1 without an event and one place. */
export const TASK_2 = uuid(812);
export const TASK_3 = uuid(813);
export const TASK_OTHER = uuid(814);
export const ASSIGNMENT_F1_T1 = uuid(821);
export const ASSIGNMENT_F2_T3 = uuid(822);
export const ASSIGNMENT_OTHER = uuid(823);
export const REQUEST_1 = uuid(831);
export const NOTE_1 = uuid(841);
export const NOTE_2 = uuid(842);

/**
 * Seeds Coordination on top of the directory world: an event with notes and two tasks in group 1, an event
 * and a task in group 2, the first and second family's places, one open cancellation request and a
 * contribution note for each place, and an event, task and place of the second organization. Tasks start
 * ten days from now.
 */
export async function seedCoordinationWorld(db: pg.Client, schema: string): Promise<void> {
  await seedDirectoryWorld(db, schema);
  await db.query(
    `insert into events (id, organization_id, group_id, title, location, coordinator_name, starts_at, ends_at, allergen_note, supply_note, food_note)
     values ($1, $4, $5, 'Őszi ünnep', 'Tornaterem', 'Kovács Mária', now() + interval '10 days', now() + interval '10 days 3 hours', 'mogyoró', 'terítők', 'sütemény'),
            ($2, $4, $6, 'Munkanap', 'Kert', null, now() + interval '12 days', now() + interval '12 days 4 hours', null, null, null),
            ($3, $7, $8, 'Idegen ünnep', null, null, now() + interval '10 days', now() + interval '10 days 2 hours', 'tej', null, null)`,
    [
      EVENT_1,
      EVENT_2,
      EVENT_OTHER,
      ORGANIZATION,
      GROUP_1,
      GROUP_2,
      OTHER_ORGANIZATION,
      GROUP_OTHER,
    ],
  );
  await db.query(
    `insert into tasks (id, organization_id, group_id, event_id, title, capacity, starts_at, ends_at, location)
     values ($1, $5, $6, $7, 'Sütés', 3, now() + interval '10 days', now() + interval '10 days 2 hours', 'Konyha'),
            ($2, $5, $6, null, 'Kerti munka', 1, now() + interval '11 days', now() + interval '11 days 2 hours', 'Kert'),
            ($3, $5, $8, $9, 'Díszítés', 2, now() + interval '12 days', now() + interval '12 days 2 hours', 'Terem'),
            ($4, $10, $11, null, 'Idegen feladat', 2, now() + interval '10 days', now() + interval '10 days 2 hours', 'Terem')`,
    [
      TASK_1,
      TASK_2,
      TASK_3,
      TASK_OTHER,
      ORGANIZATION,
      GROUP_1,
      EVENT_1,
      GROUP_2,
      EVENT_2,
      OTHER_ORGANIZATION,
      GROUP_OTHER,
    ],
  );
  await db.query(
    `insert into assignments (id, organization_id, task_id, family_id, parent_id, source, status)
     values ($1, $4, $5, $6, $7, 'parent_sign_up', 'cancellation_pending'),
            ($2, $4, $8, $9, $10, 'parent_sign_up', 'active'),
            ($3, $11, $12, $13, null, 'admin_assign', 'active')`,
    [
      ASSIGNMENT_F1_T1,
      ASSIGNMENT_F2_T3,
      ASSIGNMENT_OTHER,
      ORGANIZATION,
      TASK_1,
      FAMILY_1,
      PARENT_ROW_F1,
      TASK_3,
      FAMILY_2,
      PARENT_ROW_F2,
      OTHER_ORGANIZATION,
      TASK_OTHER,
      FAMILY_OTHER,
    ],
  );
  await db.query(
    `insert into change_requests (id, organization_id, assignment_id, kind, requested_by_parent_id, source_task_id, source_assignment_version)
     values ($1, $2, $3, 'cancellation', $4, $5, 1)`,
    [REQUEST_1, ORGANIZATION, ASSIGNMENT_F1_T1, PARENT_ROW_F1, TASK_1],
  );
  await db.query(
    `insert into contribution_notes (id, organization_id, assignment_id, text)
     values ($1, $3, $4, 'Almás pite'), ($2, $3, $5, 'Girland')`,
    [NOTE_1, NOTE_2, ORGANIZATION, ASSIGNMENT_F1_T1, ASSIGNMENT_F2_T3],
  );
}

/** Rows a viewer can see in a table, counted through the data API's role and row-level policies. */
export async function countAs(
  db: pg.Client,
  schema: string,
  account: string,
  table: string,
  where = "true",
): Promise<number> {
  return asActor(db, schema, authenticated(account), async () => {
    const result = await db.query(`select count(*)::int as n from ${table} where ${where}`);
    return result.rows[0].n as number;
  });
}

/** Calls a function as a signed-in account and returns its envelope (see `callAs`). */
export function callFunction(
  db: pg.Client,
  schema: string,
  account: string,
  sql: string,
  values: readonly unknown[] = [],
): Promise<Envelope & Record<string, unknown>> {
  return callAs(db, schema, authenticated(account), sql, values);
}

let keyCounter = 0;
/** A fresh idempotency key for one call. */
export const nextKey = (label = "k"): string => `${label}-${Date.now()}-${++keyCounter}`;
