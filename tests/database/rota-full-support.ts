import assert from "node:assert/strict";
import type pg from "pg";
import {
  callFunction,
  FAMILY_1,
  FAMILY_2,
  FAMILY_NO_GROUP,
  nextKey,
  ORGANIZATION,
  SUPER_ADMIN,
  uuid,
  YEAR_1,
} from "./directory-support.ts";
import { ensureAccount } from "./stack-support.ts";
import { FAMILY_ADMIN_G1, FAMILY_ADMIN_G2, seedGroupWorld } from "./working-groups-support.ts";

/**
 * Shared helpers of the U6 database tests (full rotas and weekend picks). All data is invented. The world has six
 * active families of the first community, each with a parent who can sign in: the first and second family, the
 * family without a group, the two coordinator families and a sixth family.
 */
export { FAMILY_1, FAMILY_2, FAMILY_NO_GROUP, FAMILY_ADMIN_G1, FAMILY_ADMIN_G2 };

export const FAMILY_SIX = uuid(9501);
export const PARENT_NG = "bbbbbbbb-0000-4000-8000-000000000021";
export const PARENT_SIX = "bbbbbbbb-0000-4000-8000-000000000022";
const PARENT_ROW_NG = uuid(9502);
const PARENT_ROW_SIX = uuid(9503);

/** The six families and the account of one parent of each, in the order of their names (lower case). */
export const ROTA_FAMILIES = [
  FAMILY_NO_GROUP,
  FAMILY_ADMIN_G1,
  FAMILY_1,
  FAMILY_ADMIN_G2,
  FAMILY_2,
  FAMILY_SIX,
] as const;

export async function seedRotaWorld(db: pg.Client, schema: string): Promise<void> {
  await seedGroupWorld(db, schema);
  await ensureAccount(db, { id: PARENT_NG, organization: ORGANIZATION });
  await ensureAccount(db, { id: PARENT_SIX, organization: ORGANIZATION });
  await db.query(
    "insert into families (id, organization_id, display_name) values ($1, $2, 'Hatodik család')",
    [FAMILY_SIX, ORGANIZATION],
  );
  await db.query(
    "insert into parents (id, organization_id, family_id, display_name, account_id) values ($1, $3, $4, 'Csoport Nélküli Péter', $5), ($2, $3, $6, 'Hatodik Hanna', $7)",
    [
      PARENT_ROW_NG,
      PARENT_ROW_SIX,
      ORGANIZATION,
      FAMILY_NO_GROUP,
      PARENT_NG,
      FAMILY_SIX,
      PARENT_SIX,
    ],
  );
  await db.query(
    "insert into app_role_grants (subject_id, role, scope_type, scope_id, organization_id) values ($1, 'parent', 'family', $2, $5), ($3, 'parent', 'family', $4, $5)",
    [PARENT_NG, FAMILY_NO_GROUP, PARENT_SIX, FAMILY_SIX, ORGANIZATION],
  );
  await db.query(
    "insert into app_authorization_versions (subject_id, authorization_version) select subject_id, 1 from app_role_grants on conflict do nothing",
  );
}

/** Sets the changeover date of the first school year (as the schema owner). */
export async function setChangeover(db: pg.Client, date: string, year = YEAR_1): Promise<void> {
  await db.query("update school_years set changeover_date = $1 where id = $2", [date, year]);
}

export async function setStanding(
  db: pg.Client,
  schema: string,
  family: string,
  standing: "staying" | "leaving" | "new",
  year: string = YEAR_1,
  account: string = SUPER_ADMIN,
) {
  const row = await db.query(
    "select version from family_year_standings where family_id = $1 and school_year_id = $2",
    [family, year],
  );
  const version = row.rows.length ? Number(row.rows[0].version) : 0;
  const result = await callFunction(
    db,
    schema,
    account,
    "family_standing_set($1, $2, $3, $4, $5)",
    [nextKey("standing"), family, year, standing, version],
  );
  assert.equal(result.state, "success", JSON.stringify(result));
  return result;
}

/** The ids of the active families of the first community, ordered like the draft orders them. */
export async function activeFamilyIds(db: pg.Client): Promise<string[]> {
  return (
    await db.query(
      "select id from families where organization_id = $1 and status = 'active' order by lower(display_name), id",
      [ORGANIZATION],
    )
  ).rows.map((row) => String(row.id));
}

/** The date of the Monday of the week that holds `daysFromToday` days from today, as YYYY-MM-DD (Budapest time). */
export async function mondayOf(db: pg.Client, daysFromToday: number): Promise<string> {
  const row = await db.query(
    "select to_char(date_trunc('week', ((now() at time zone 'Europe/Budapest')::date + $1::integer)::timestamp), 'YYYY-MM-DD') as d",
    [daysFromToday],
  );
  return String(row.rows[0].d);
}
