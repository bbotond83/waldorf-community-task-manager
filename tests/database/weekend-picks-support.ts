import assert from "node:assert/strict";
import type pg from "pg";
import {
  ADMIN_G1,
  callFunction,
  FAMILY_1,
  FAMILY_2,
  FAMILY_NO_GROUP,
  PARENT_F1,
  PARENT_F2,
  SUPER_ADMIN,
  nextKey,
  YEAR_1,
} from "./directory-support.ts";
import { FAMILY_ADMIN_G1, FAMILY_SIX, PARENT_NG, PARENT_SIX } from "./rota-full-support.ts";
import { makeDraft, publish } from "./rota-support.ts";

/** Shared helpers of the weekend pick tests: one published plan whose chosen week has three named families. */
export const ACCOUNT_OF: Record<string, string> = {
  [FAMILY_1]: PARENT_F1,
  [FAMILY_2]: PARENT_F2,
  [FAMILY_NO_GROUP]: PARENT_NG,
  [FAMILY_SIX]: PARENT_SIX,
  [FAMILY_ADMIN_G1]: ADMIN_G1,
};

export type WeekendWorld = {
  week: string;
  indoor: { id: string; family: string };
  front: { id: string; family: string };
  weekend: { id: string; family: string };
};

/** The Monday of the n-th school week that starts at least `daysAhead` days from today (so its weekend is in the future). */
export async function futureWeek(db: pg.Client, daysAhead = 21, skip = 0): Promise<string> {
  const rows = await db.query(
    "select to_char(week_start, 'YYYY-MM-DD') as d from school_weeks($1) where week_start >= current_date + $2::integer order by week_start offset $3 limit 1",
    [YEAR_1, daysAhead, skip],
  );
  assert.ok(rows.rows[0], "the school year has a week that far ahead");
  return String(rows.rows[0].d);
}

/**
 * Makes a draft, gives one future week the three named families (indoor cleaning, front garden, weekend animal care)
 * and publishes it. Anything the test needs changed first goes in `before`, which runs after the draft exists.
 */
export async function publishedWeekend(
  db: pg.Client,
  schema: string,
  options: {
    week?: string;
    indoor?: string | null;
    front?: string;
    weekend?: string;
    before?: (planId: string) => Promise<void>;
  } = {},
): Promise<WeekendWorld> {
  const draft = await makeDraft(db, schema);
  const week = options.week ?? (await futureWeek(db));
  const families = {
    indoor_cleaning: options.indoor === undefined ? FAMILY_1 : options.indoor,
    front_garden: options.front ?? FAMILY_2,
    weekend_animal_care: options.weekend ?? FAMILY_NO_GROUP,
  };
  for (const [job, family] of Object.entries(families)) {
    await db.query(
      "update rota_weeks set family_id = $1, empty_reason = case when $1::uuid is null then 'cleared' end where plan_id = $2 and job = $3 and week_start = $4",
      [family, draft.id, job, week],
    );
  }
  if (options.before) await options.before(draft.id);
  const done = await publish(db, schema, draft);
  assert.equal(done.state, "success", JSON.stringify(done));
  const row = async (job: string) => {
    const result = await db.query(
      "select id, family_id from rota_weeks where plan_id = $1 and job = $2 and week_start = $3",
      [draft.id, job, week],
    );
    return { id: String(result.rows[0].id), family: String(result.rows[0].family_id) };
  };
  return {
    week,
    indoor: await row("indoor_cleaning"),
    front: await row("front_garden"),
    weekend: await row("weekend_animal_care"),
  };
}

/** The duty and the place of one slot of a weekend. */
export async function slotOf(db: pg.Client, world: WeekendWorld, slot: string) {
  const row = (
    await db.query(
      "select t.id as duty_id, a.id as place_id, a.version as place_version, a.family_id, a.source from weekend_slots s join tasks t on t.origin_kind = 'weekend_slot' and t.origin_id = s.id join assignments a on a.task_id = t.id and a.status <> 'removed' where s.weekend_week_id = $1 and s.slot = $2",
      [world.weekend.id, slot],
    )
  ).rows[0] as {
    duty_id: string;
    place_id: string;
    place_version: number;
    family_id: string;
    source: string;
  };
  return row;
}

export async function pickCommand(
  db: pg.Client,
  schema: string,
  account: string,
  weekId: string,
  slot: string,
  version: number,
  key = nextKey("pick"),
  command: "weekend_pick_set" | "weekend_pick_assign" = "weekend_pick_set",
) {
  return callFunction(db, schema, account, `${command}($1, $2, $3, $4)`, [
    key,
    weekId,
    slot,
    version,
  ]);
}

/** Every pick and its place agree, and a slot with no pick lies with the weekend family (BR63.9). Returns the problems. */
export async function pickInvariantProblems(db: pg.Client): Promise<string[]> {
  const rows = await db.query(
    `select 'pick place differs' as problem
       from weekend_picks pk
       join rota_weeks w on w.id = pk.rota_week_id
       join weekend_slots s on s.id = pk.weekend_slot_id
       join tasks t on t.origin_kind = 'weekend_slot' and t.origin_id = s.id
       join assignments a on a.task_id = t.id and a.status <> 'removed'
      where a.family_id <> w.family_id or a.source <> 'weekend_pick'
     union all
     select 'unpicked slot is not with the weekend family'
       from weekend_slots s
       join rota_weeks ww on ww.id = s.weekend_week_id
       join tasks t on t.origin_kind = 'weekend_slot' and t.origin_id = s.id
       join assignments a on a.task_id = t.id and a.status <> 'removed'
      where not exists (select 1 from weekend_picks pk where pk.weekend_slot_id = s.id)
        and (a.family_id <> ww.family_id or a.source <> 'rota_publish')
     union all
     select 'a slot without exactly one place'
       from weekend_slots s
       join tasks t on t.origin_kind = 'weekend_slot' and t.origin_id = s.id
      where (select count(*) from assignments a where a.task_id = t.id and a.status <> 'removed') <> 1`,
  );
  return rows.rows.map((row) => String(row.problem));
}

export { SUPER_ADMIN };
