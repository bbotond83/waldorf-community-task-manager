import assert from "node:assert/strict";
import type pg from "pg";
import {
  callFunction,
  FAMILY_1,
  nextKey,
  ORGANIZATION,
  PARENT_F1,
  PARENT_F2,
  SUPER_ADMIN,
  uuid,
  YEAR_1,
} from "./directory-support.ts";
import { FAMILY_SIX, PARENT_SIX, seedRotaWorld } from "./rota-full-support.ts";
import { ADMIN_G1, TEACHER_G1 } from "./identity-support.ts";

/**
 * Shared helpers of the U8 database tests (animal care and the information page). All data is invented.
 *
 * The world is the rota world (six active families of the first community, each with a parent who can sign in) plus an
 * active working group named Állatgondozás in the first school year (2026/2027), and the year's slots, made by the
 * super admin. The first group's administrator (ADMIN_G1) coordinates the group named Boróka.
 */
export {
  ADMIN_G1,
  FAMILY_1,
  FAMILY_SIX,
  PARENT_F1,
  PARENT_F2,
  PARENT_SIX,
  SUPER_ADMIN,
  TEACHER_G1,
  YEAR_1,
};

export const CARE_GROUP = uuid(9701);
export const CARE_GROUP_NAME = "Állatgondozás";

export type Result = Awaited<ReturnType<typeof callFunction>>;

export async function seedAnimalWorld(
  db: pg.Client,
  schema: string,
  options: { slots?: boolean } = {},
): Promise<void> {
  await seedRotaWorld(db, schema);
  await db.query(
    "insert into groups (id, organization_id, school_year_id, name, description) values ($1, $2, $3, $4, 'Az állatok gondozása.')",
    [CARE_GROUP, ORGANIZATION, YEAR_1, CARE_GROUP_NAME],
  );
  if (options.slots !== false) {
    await createSlots(db, schema);
  }
}

export async function createSlots(db: pg.Client, schema: string): Promise<Result> {
  const result = await callFunction(db, schema, SUPER_ADMIN, "animal_slots_create($1, $2)", [
    nextKey("slots"),
    YEAR_1,
  ]);
  assert.equal(result.state, "success", JSON.stringify(result));
  return result;
}

/** The Budapest date of today as YYYY-MM-DD. */
export const todayOf = async (db: pg.Client): Promise<string> =>
  String(
    (
      await db.query(
        "select to_char((now() at time zone 'Europe/Budapest')::date, 'YYYY-MM-DD') as d",
      )
    ).rows[0].d,
  );

export type SlotRow = {
  slot_id: string;
  duty_id: string;
  version: number;
  slot_date: string;
  part: string;
};

/** The first slot of a part that is `minDays` or more days from today, with its duty. */
export async function slotAfter(
  db: pg.Client,
  minDays: number,
  part: "morning" | "afternoon" = "morning",
  skip = 0,
): Promise<SlotRow> {
  const row = await db.query(
    `select s.id as slot_id, t.id as duty_id, t.version, to_char(s.slot_date, 'YYYY-MM-DD') as slot_date, s.part
       from animal_slots s join tasks t on t.id = s.duty_id
      where s.part = $2 and s.slot_date >= (now() at time zone 'Europe/Budapest')::date + $1::integer
      order by s.slot_date offset $3 limit 1`,
    [minDays, part, skip],
  );
  assert.ok(row.rows[0], "no slot found");
  return row.rows[0] as SlotRow;
}

export const dutyVersion = async (db: pg.Client, duty: string): Promise<number> =>
  Number((await db.query("select version from tasks where id = $1", [duty])).rows[0].version);

export async function signUp(
  db: pg.Client,
  schema: string,
  account: string,
  duty: string,
): Promise<Result> {
  return callFunction(db, schema, account, "duty_sign_up($1, $2, $3)", [
    nextKey("su"),
    duty,
    await dutyVersion(db, duty),
  ]);
}

export type PlaceRow = { id: string; family_id: string; status: string; version: number };

/** The active place on a duty, if any. */
export async function activePlace(db: pg.Client, duty: string): Promise<PlaceRow | undefined> {
  return (
    await db.query(
      "select id, family_id, status, version from assignments where task_id = $1 and status <> 'removed'",
      [duty],
    )
  ).rows[0] as PlaceRow | undefined;
}

/** Moves a duty's start to a moment relative to now, as the schema owner. */
export const setStart = (db: pg.Client, duty: string, interval: string) =>
  db.query(
    "update tasks set starts_at = now() + $2::interval, ends_at = now() + $2::interval + interval '1 hour' where id = $1",
    [duty, interval],
  );

export const refused = (result: Result, state: string, code: string) =>
  assert.deepEqual([result.state, result.code], [state, code], JSON.stringify(result));

export const noticesOf = async (db: pg.Client, kind: string) =>
  (
    await db.query(
      "select parent_id, target_ref from notifications where kind = $1 order by created_at, parent_id",
      [kind],
    )
  ).rows as { parent_id: string; target_ref: string }[];

export const auditOf = async (db: pg.Client, action: string) =>
  (
    await db.query(
      "select outcome, details, target_id, actor_account_id from audit_events where action = $1 order by occurred_at, id",
      [action],
    )
  ).rows as {
    outcome: string;
    details: string | null;
    target_id: string;
    actor_account_id: string;
  }[];

/** A moment on the Sunday of next week at noon Budapest time, so the three days after it are Monday to Wednesday. */
export async function sundayNoon(db: pg.Client): Promise<{ moment: string; monday: string }> {
  const row = await db.query(
    `select to_char(d + 6, 'YYYY-MM-DD') as sunday, to_char(d + 7, 'YYYY-MM-DD') as monday
       from (select date_trunc('week', (now() at time zone 'Europe/Budapest')::date::timestamp + interval '7 days')::date as d) x`,
  );
  return { moment: `${row.rows[0].sunday}T12:00:00+01:00`, monday: String(row.rows[0].monday) };
}

/** A Wednesday noon of next week, a day on which the monthly reminder may run. */
export async function wednesdayNoon(db: pg.Client): Promise<string> {
  const row = await db.query(
    `select to_char(d + 9, 'YYYY-MM-DD') as wednesday
       from (select date_trunc('week', (now() at time zone 'Europe/Budapest')::date::timestamp)::date as d) x`,
  );
  return `${row.rows[0].wednesday}T12:00:00+01:00`;
}

export const runCheck = async (
  db: pg.Client,
  schema: string,
  fn: string,
  at: string,
): Promise<{ created: number; skipped: number; detail: string | null }> =>
  (await db.query(`select ${schema}.${fn}($1::timestamptz) as r`, [at])).rows[0].r;
