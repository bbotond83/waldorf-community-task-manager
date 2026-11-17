import assert from "node:assert/strict";
import type pg from "pg";
import { callFunction, nextKey, SUPER_ADMIN, YEAR_1 } from "./directory-support.ts";

/** Shared helpers of the U2 database tests: make a draft, read it, and list a school year's weeks. */

export type PlanHandle = { id: string; version: number };

export async function makeDraft(
  db: pg.Client,
  schema: string,
  account: string = SUPER_ADMIN,
  year: string = YEAR_1,
): Promise<PlanHandle> {
  const made = await callFunction(db, schema, account, "rota_plan_make($1, $2)", [
    nextKey("make"),
    year,
  ]);
  assert.equal(made.state, "success", JSON.stringify(made));
  return { id: String(made.reference), version: Number(made.version) };
}

export type PlanWeek = {
  id: string;
  week_start: string;
  is_break: boolean;
  family_id: string | null;
  empty_reason: string | null;
  changed_by_admin: boolean;
  version: number;
};

export type PlanView = {
  state: string;
  code: string | null;
  plan: { id: string; status: string; version: number } | null;
  items: PlanWeek[];
  families: { family_id: string; weeks: number; above_lowest: boolean }[];
  changed_weeks: number;
  blockers: { empty_weeks: unknown[]; break_weeks: unknown[]; ineligible_weeks: unknown[] };
  can_publish: boolean;
};

/** The whole read of a plan as the four-rota function returns it. */
export type FullPlanView = Omit<PlanView, "items" | "families"> & {
  items: (PlanWeek & { job: string })[];
  families: {
    family_id: string;
    full_year: boolean;
    counts: Record<string, number>;
    above_lowest: string[];
  }[];
  blockers: {
    empty_weeks: unknown[];
    break_weeks: unknown[];
    ineligible_weeks: unknown[];
    flagged_weeks: unknown[];
    clash_weeks: unknown[];
  };
  warnings: { two_jobs: unknown[] };
};

export async function readFullPlan(
  db: pg.Client,
  schema: string,
  account: string = SUPER_ADMIN,
  year: string = YEAR_1,
): Promise<FullPlanView> {
  return (await callFunction(db, schema, account, "rota_plan_get($1)", [
    year,
  ])) as unknown as FullPlanView;
}

/**
 * The indoor-cleaning view of a plan: the rota the U2 tests were written for. Items are the indoor-cleaning weeks,
 * `weeks` is each family's indoor-cleaning count and `above_lowest` says whether indoor cleaning is uneven.
 */
export async function readPlan(
  db: pg.Client,
  schema: string,
  account: string = SUPER_ADMIN,
  year: string = YEAR_1,
): Promise<PlanView> {
  const full = await readFullPlan(db, schema, account, year);
  if (!full.items) return full as unknown as PlanView;
  return {
    ...full,
    items: full.items.filter((w) => w.job === "indoor_cleaning"),
    families: full.families.map((f) => ({
      family_id: f.family_id,
      weeks: f.counts.indoor_cleaning ?? 0,
      above_lowest: f.above_lowest.includes("indoor_cleaning"),
    })),
  };
}

export async function schoolWeekStarts(db: pg.Client, year: string = YEAR_1): Promise<string[]> {
  const rows = await db.query(
    "select to_char(week_start, 'YYYY-MM-DD') as week_start from school_weeks($1) order by 1",
    [year],
  );
  return rows.rows.map((row) => String(row.week_start));
}

/** A parent account of each active family in the fixture, to name as holders. */
export async function publish(
  db: pg.Client,
  schema: string,
  plan: PlanHandle,
  account: string = SUPER_ADMIN,
  key: string = nextKey("publish"),
) {
  return callFunction(db, schema, account, "rota_plan_publish($1, $2, $3)", [
    key,
    plan.id,
    plan.version,
  ]);
}
