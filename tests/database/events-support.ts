import type pg from "pg";
import { caller, seedGroupWorld } from "./working-groups-support.ts";
import { ORGANIZATION, uuid } from "./directory-support.ts";

export { caller, seedGroupWorld };
export type Call = ReturnType<typeof caller>;

/** Events the tests add on top of the group world (invented ids). Group 1 is the group of ADMIN_G1. */
export const COMMUNITY_EVENT = uuid(9501);
export const GROUP_EVENT = uuid(9502);
export const PAST_EVENT = uuid(9503);
export const CANCELLED_EVENT = uuid(9504);
export const FOOD_EVENT = uuid(9505);

export const inDays = (days: number): string =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

type EventOptions = {
  id: string;
  group?: string | null;
  title?: string;
  startsInDays?: number;
  endsInDays?: number;
  status?: "planned" | "cancelled";
  food?: boolean;
  deadline?: string | null;
};

/** One event row of the first community, written as the schema owner. */
export async function insertEvent(db: pg.Client, options: EventOptions): Promise<string> {
  await db.query(
    `insert into events (id, organization_id, group_id, title, location, starts_at, ends_at, status, food_signup_on, signup_deadline)
     values ($1, $2, $3, $4, 'Terem', $5, $6, $7, $8, $9)`,
    [
      options.id,
      ORGANIZATION,
      options.group ?? null,
      options.title ?? "Teszt ünnep",
      inDays(options.startsInDays ?? 10),
      inDays(options.endsInDays ?? (options.startsInDays ?? 10) + 0.1),
      options.status ?? "planned",
      options.food ?? false,
      options.deadline ?? null,
    ],
  );
  return options.id;
}

/** The standard set: a community event, a group-1 event, a finished one, a cancelled one, one with food sign-up. */
export async function seedEventWorld(db: pg.Client, schema: string): Promise<void> {
  await seedGroupWorld(db, schema);
  await insertEvent(db, { id: COMMUNITY_EVENT, group: null, title: "Közös ünnep" });
  await insertEvent(db, { id: GROUP_EVENT, group: uuid(101), title: "Csoport ünnep" });
  await insertEvent(db, {
    id: PAST_EVENT,
    group: null,
    title: "Régi ünnep",
    startsInDays: -10,
    endsInDays: -9.9,
  });
  await insertEvent(db, {
    id: CANCELLED_EVENT,
    group: null,
    title: "Elmaradt",
    status: "cancelled",
  });
  await insertEvent(db, { id: FOOD_EVENT, group: null, title: "Közös étkezés", food: true });
}

export const eventVersion = async (db: pg.Client, id: string): Promise<number> =>
  (await db.query("select version from events where id = $1", [id])).rows[0].version as number;

export const auditRows = async (db: pg.Client, action: string) =>
  (
    await db.query(
      "select outcome, details, target_id, group_id from audit_events where action = $1 order by occurred_at, id",
      [action],
    )
  ).rows as {
    outcome: string;
    details: string | null;
    target_id: string;
    group_id: string | null;
  }[];

export const noticeRows = async (db: pg.Client, parent: string, kind: string) =>
  (
    await db.query(
      "select id, target_type, target_ref from notifications where parent_id = $1 and kind = $2",
      [parent, kind],
    )
  ).rows as { id: string; target_type: string; target_ref: string }[];
