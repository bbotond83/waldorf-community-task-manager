import assert from "node:assert/strict";
import type pg from "pg";
import {
  ASSIGNMENT_F1_T1,
  ASSIGNMENT_F2_T3,
  callFunction,
  nextKey,
  ORGANIZATION,
  REQUEST_1,
  TASK_1,
  TASK_2,
  TASK_3,
  uuid,
} from "./directory-support.ts";
import { FAMILY_SIX, PARENT_SIX, seedRotaWorld } from "./rota-full-support.ts";
import { FAMILY_ADMIN_G1, PARENT_ROW_ADMIN_G1 } from "./working-groups-support.ts";

/**
 * Shared helpers of the U7 database tests (swaps and duty changes). All data is invented.
 *
 * The world is the rota world (six families with a parent who can sign in) with the three manual duties of the
 * coordination world made ready for swaps: the first family holds an active place on `TASK_1` (group 1), the second
 * family on `TASK_3` (group 2), and the first coordinator's family on `TASK_2` (group 1, capacity one).
 */
export {
  ASSIGNMENT_F1_T1 as PLACE_F1_T1,
  ASSIGNMENT_F2_T3 as PLACE_F2_T3,
  FAMILY_SIX,
  PARENT_SIX,
  TASK_1,
  TASK_2,
  TASK_3,
};
export const PLACE_AG1_T2 = uuid(9801);

export type Result = Awaited<ReturnType<typeof callFunction>>;

export async function seedSwapWorld(db: pg.Client, schema: string): Promise<void> {
  await seedRotaWorld(db, schema);
  await db.query("update change_requests set status = 'withdrawn' where id = $1", [REQUEST_1]);
  await db.query("update assignments set status = 'active' where id = $1", [ASSIGNMENT_F1_T1]);
  await db.query(
    "insert into assignments (id, organization_id, task_id, family_id, parent_id, source) values ($1, $2, $3, $4, $5, 'admin_assign')",
    [PLACE_AG1_T2, ORGANIZATION, TASK_2, FAMILY_ADMIN_G1, PARENT_ROW_ADMIN_G1],
  );
}

export type PlaceRow = {
  id: string;
  task_id: string;
  family_id: string;
  status: string;
  version: number;
};

export const placeRow = async (db: pg.Client, id: string): Promise<PlaceRow> =>
  (
    await db.query(
      "select id, task_id, family_id, status, version from assignments where id = $1",
      [id],
    )
  ).rows[0] as PlaceRow;

export const requestVersion = async (db: pg.Client, id: string): Promise<number> =>
  Number(
    (await db.query("select version from change_requests where id = $1", [id])).rows[0]?.version ??
      1,
  );

export const requestRow = async (db: pg.Client, id: string) =>
  (await db.query("select * from change_requests where id = $1", [id])).rows[0] as Record<
    string,
    unknown
  >;

/** The notices of one kind a parent record got (invented data only). */
export const noticesOf = async (db: pg.Client, parent: string, kind: string) =>
  (
    await db.query(
      "select id, target_type, target_ref from notifications where parent_id = $1 and kind = $2 order by created_at, id",
      [parent, kind],
    )
  ).rows as { id: string; target_type: string; target_ref: string }[];

export const auditOf = async (db: pg.Client, action: string, outcome?: string) =>
  (
    await db.query(
      "select outcome, details, target_id, group_id, actor_account_id from audit_events where action = $1 and ($2::text is null or outcome = $2) order by occurred_at, id",
      [action, outcome ?? null],
    )
  ).rows as {
    outcome: string;
    details: string | null;
    target_id: string;
    group_id: string | null;
    actor_account_id: string;
  }[];

/** Moves a duty's start to a moment relative to now, as the schema owner. */
export const setStart = (db: pg.Client, task: string, interval: string) =>
  db.query(
    "update tasks set starts_at = now() + $2::interval, ends_at = now() + $2::interval + interval '2 hours' where id = $1",
    [task, interval],
  );

/** Every call of the swap functions as a signed-in account. */
export function swapCalls(db: pg.Client, schema: string) {
  const fn = (account: string, sql: string, values: unknown[] = []): Promise<Result> =>
    callFunction(db, schema, account, sql, values);
  return {
    fn,
    candidates: (
      account: string,
      place: string,
      from: string | null = null,
      to: string | null = null,
    ) => fn(account, "swap_candidates($1, $2, $3)", [place, from, to]),
    request: async (
      account: string,
      source: string,
      target: string,
      options: {
        sourceVersion?: number;
        targetVersion?: number;
        reason?: string | null;
        key?: string;
      } = {},
    ) =>
      fn(account, "swap_request($1, $2, $3, $4, $5, $6)", [
        options.key ?? nextKey("sw"),
        source,
        options.sourceVersion ?? (await placeRow(db, source)).version,
        target,
        options.targetVersion ?? (await placeRow(db, target)).version,
        options.reason === undefined ? "Időpont-ütközés" : options.reason,
      ]),
    respond: async (
      account: string,
      id: string,
      accept: boolean,
      version: number | null = null,
      key = nextKey("rs"),
    ) =>
      fn(account, "swap_respond($1, $2, $3, $4)", [
        key,
        id,
        accept,
        version ?? (await requestVersion(db, id)),
      ]),
    withdraw: (account: string, id: string, key = nextKey("wd")) =>
      fn(account, "swap_withdraw($1, $2)", [key, id]),
    incoming: (account: string) => fn(account, "swap_incoming()"),
    cancel: async (
      account: string,
      place: string,
      version?: number,
      reason: string | null = "Beteg lettem",
      key = nextKey("cn"),
    ) =>
      fn(account, "cancellation_request($1, $2, $3, $4)", [
        key,
        place,
        version ?? (await placeRow(db, place)).version,
        reason,
      ]),
    decide: async (
      account: string,
      id: string,
      approve: boolean,
      version: number | null = null,
      key = nextKey("cd"),
    ) =>
      fn(account, "cancellation_decide($1, $2, $3, $4)", [
        key,
        id,
        approve,
        version ?? (await requestVersion(db, id)),
      ]),
    reassign: (
      account: string,
      duty: string,
      version: number,
      family: string | null,
      key = nextKey("ra"),
    ) => fn(account, "duty_reassign($1, $2, $3, $4)", [key, duty, version, family]),
    reverse: async (
      account: string,
      id: string,
      version: number | null = null,
      key = nextKey("rv"),
    ) =>
      fn(account, "swap_reverse($1, $2, $3)", [key, id, version ?? (await requestVersion(db, id))]),
    /** The same commands with no version at all, as a caller that forgot it would send them. */
    withoutVersion: (account: string, sql: string, id: string, flag?: boolean) =>
      fn(
        account,
        sql,
        flag === undefined ? [nextKey("nv"), id, null] : [nextKey("nv"), id, flag, null],
      ),
    list: (account: string, year: string | null = null) => fn(account, "swap_list($1)", [year]),
    cancellations: (account: string) => fn(account, "cancellation_list()"),
  };
}

export const refused = (result: Result, state: string, code: string) =>
  assert.deepEqual([result.state, result.code], [state, code], JSON.stringify(result));
