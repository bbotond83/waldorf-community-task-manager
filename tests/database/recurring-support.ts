import type pg from "pg";
import { callFunction, nextKey, ORGANIZATION, uuid, YEAR_1 } from "./directory-support.ts";
import { seedRotaWorld } from "./rota-full-support.ts";
import { ensureAccount } from "./stack-support.ts";

/**
 * Shared helpers of the U9 database tests (recurring duties). All data is invented. The world is the rota world (six
 * families of the first community, each with a parent who can sign in, two coordinators, a teacher, a super admin and
 * a second community) plus a family that was removed and anonymised, whose parent shows as korábbi tag.
 */
export const FAMILY_GONE = uuid(9911);
export const PARENT_ROW_GONE = uuid(9912);

/** Schedules and occurrences the tests write directly as the schema owner (invented ids). */
export const SCHEDULE_G1 = uuid(99001);
export const SCHEDULE_G2 = uuid(99002);
export const SCHEDULE_F1 = uuid(99003);
export const SCHEDULE_WATER = uuid(99004);
export const SCHEDULE_OFF = uuid(99005);
export const OCC = (n: number) => uuid(99100 + n);

export type Result = Awaited<ReturnType<typeof callFunction>>;

export async function seedRecurringWorld(db: pg.Client, schema: string): Promise<void> {
  await seedRotaWorld(db, schema);
  await db.query(
    `insert into families (id, organization_id, display_name, status, archived_at, anonymized_at)
     values ($1, $2, 'Anonimizált család', 'archived', now(), now())`,
    [FAMILY_GONE, ORGANIZATION],
  );
  await db.query(
    "insert into parents (id, organization_id, family_id, display_name, status) values ($1, $2, $3, 'Régi Rita', 'archived')",
    [PARENT_ROW_GONE, ORGANIZATION, FAMILY_GONE],
  );
  await ensureAccount(db, {
    id: "bbbbbbbb-0000-4000-8000-0000000000a1",
    organization: ORGANIZATION,
  });
}

/** A date relative to today, as YYYY-MM-DD in Budapest time. */
export const dayOffset = async (db: pg.Client, days: number): Promise<string> =>
  String(
    (
      await db.query(
        "select to_char((now() at time zone 'Europe/Budapest')::date + $1::integer, 'YYYY-MM-DD') as d",
        [days],
      )
    ).rows[0].d,
  );

type ScheduleOptions = {
  id?: string;
  kind?: "group" | "family" | "rota_week";
  group?: string | null;
  family?: string | null;
  job?: string | null;
  title?: string;
  category?: string;
  interval?: number;
  start?: string;
  from?: number | null;
  to?: number | null;
  active?: boolean;
  org?: string;
};

/** One schedule row, written as the schema owner. */
export async function insertSchedule(db: pg.Client, options: ScheduleOptions): Promise<string> {
  const kind = options.kind ?? "group";
  const id = options.id ?? uuid(99000 + Math.floor(Math.random() * 90));
  await db.query(
    `insert into recurring_schedules (id, organization_id, title, category, owner_kind, working_group_id, family_id,
       rota_job, interval_kind, interval_count, start_date, season_from_month, season_to_month, is_active)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      id,
      options.org ?? ORGANIZATION,
      options.title ?? "Heti kerti munka",
      options.category ?? "kert",
      kind,
      options.group ?? null,
      options.family ?? null,
      options.job ?? null,
      kind === "rota_week" ? "rota_weeks" : "weeks",
      options.interval ?? 1,
      options.start ?? "2026-09-07",
      options.from ?? null,
      options.to ?? null,
      options.active ?? true,
    ],
  );
  return id;
}

type OccurrenceOptions = {
  id: string;
  schedule: string;
  due: string;
  status?: "open" | "done" | "skipped";
  doneBy?: string | null;
  doneAt?: string | null;
  doneByRemoved?: boolean;
  reason?: string | null;
  skippedBy?: string | null;
  skippedByAccount?: string | null;
  skippedByRemoved?: boolean;
  rotaWeek?: string | null;
  dueNotice?: string | null;
  overdueNotice?: string | null;
};

/** One occurrence row, written as the schema owner. */
export async function insertOccurrence(db: pg.Client, options: OccurrenceOptions): Promise<string> {
  const status = options.status ?? "open";
  await db.query(
    `insert into recurring_occurrences (id, organization_id, schedule_id, due_date, rota_week_id, status,
       done_by_parent_id, done_at, done_by_removed, skipped_reason, skipped_at, skipped_by_parent_id,
       skipped_by_account_id, skipped_by_removed, due_notice_sent_at, overdue_notice_sent_at)
     values ($1, (select organization_id from recurring_schedules where id = $2), $2, $3, $4, $5, $6, $7, $8, $9,
       $10, $11, $12, $13, $14, $15)`,
    [
      options.id,
      options.schedule,
      options.due,
      options.rotaWeek ?? null,
      status,
      options.doneBy ?? null,
      options.doneAt ?? (status === "done" ? new Date().toISOString() : null),
      options.doneByRemoved ?? false,
      options.reason ?? (status === "skipped" ? "Kihagyva a próbához." : null),
      status === "skipped" ? new Date().toISOString() : null,
      options.skippedBy ?? null,
      options.skippedByAccount ??
        (status === "skipped" ? "bbbbbbbb-0000-4000-8000-000000000001" : null),
      options.skippedByRemoved ?? false,
      options.dueNotice ?? null,
      options.overdueNotice ?? null,
    ],
  );
  return options.id;
}

/**
 * A published rota plan of the first school year with one row per given week and job, written as the schema owner.
 * A week with `family: null` is an empty week (nobody holds it). The ids of the rows are returned in order.
 */
export async function publishWeeks(
  db: pg.Client,
  weeks: readonly { monday: string; family: string | null; job?: string }[],
): Promise<string[]> {
  await db.query(
    `insert into rota_plans (organization_id, school_year_id, status, published_at, published_by)
     values ($1, $2, 'published', now(), 'bbbbbbbb-0000-4000-8000-000000000001')
     on conflict (school_year_id) do nothing`,
    [ORGANIZATION, YEAR_1],
  );
  const ids: string[] = [];
  for (const week of weeks) {
    const row = await db.query(
      `insert into rota_weeks (organization_id, plan_id, job, week_start, family_id, empty_reason)
       values ($1, (select id from rota_plans where school_year_id = $2), $3, $4, $5, $6)
       returning id`,
      [
        ORGANIZATION,
        YEAR_1,
        week.job ?? "water_carrying",
        week.monday,
        week.family,
        week.family ? null : "no_family",
      ],
    );
    ids.push(String(row.rows[0].id));
  }
  return ids;
}

/** The Monday of the week that holds `days` days from today, as YYYY-MM-DD in Budapest time. */
export const mondayAfter = async (db: pg.Client, days: number): Promise<string> =>
  String(
    (
      await db.query(
        "select to_char(date_trunc('week', ((now() at time zone 'Europe/Budapest')::date + $1::integer)::timestamp), 'YYYY-MM-DD') as d",
        [days],
      )
    ).rows[0].d,
  );

export const occurrenceRow = async (db: pg.Client, id: string) =>
  (
    await db.query(
      `select id, schedule_id, to_char(due_date, 'YYYY-MM-DD') as due_date, status, done_by_parent_id, done_at,
              done_by_removed, skipped_reason, skipped_by_parent_id, skipped_by_account_id, skipped_by_removed,
              due_notice_sent_at, overdue_notice_sent_at, version, rota_week_id
         from recurring_occurrences where id = $1`,
      [id],
    )
  ).rows[0] as
    | {
        id: string;
        schedule_id: string;
        due_date: string;
        status: string;
        done_by_parent_id: string | null;
        done_at: Date | null;
        done_by_removed: boolean;
        skipped_reason: string | null;
        skipped_by_parent_id: string | null;
        skipped_by_account_id: string | null;
        skipped_by_removed: boolean;
        due_notice_sent_at: Date | null;
        overdue_notice_sent_at: Date | null;
        version: number;
        rota_week_id: string | null;
      }
    | undefined;

export const scheduleRow = async (db: pg.Client, id: string) =>
  (
    await db.query(
      `select id, title, category, owner_kind, working_group_id, family_id, rota_job, interval_kind, interval_count,
              to_char(start_date, 'YYYY-MM-DD') as start_date, season_from_month, season_to_month, is_active, version
         from recurring_schedules where id = $1`,
      [id],
    )
  ).rows[0] as
    | {
        id: string;
        title: string;
        category: string;
        owner_kind: string;
        working_group_id: string | null;
        family_id: string | null;
        rota_job: string | null;
        interval_kind: string;
        interval_count: number;
        start_date: string;
        season_from_month: number | null;
        season_to_month: number | null;
        is_active: boolean;
        version: number;
      }
    | undefined;

export const occurrencesOf = async (db: pg.Client, schedule: string) =>
  (
    await db.query(
      "select id, to_char(due_date, 'YYYY-MM-DD') as due_date, status, version from recurring_occurrences where schedule_id = $1 order by due_date, id",
      [schedule],
    )
  ).rows as { id: string; due_date: string; status: string; version: number }[];

export const noticesFor = async (db: pg.Client, parent: string, kind: string) =>
  (
    await db.query(
      "select id, target_type, target_ref from notifications where parent_id = $1 and kind = $2 order by created_at, id",
      [parent, kind],
    )
  ).rows as { id: string; target_type: string; target_ref: string }[];

export const auditFor = async (db: pg.Client, action: string, outcome?: string) =>
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

/** The calls of the recurring functions as a signed-in account. */
export function recurringCalls(connection: () => pg.Client, schema: string) {
  const fn = (account: string, sql: string, values: unknown[] = []): Promise<Result> =>
    callFunction(connection(), schema, account, sql, values);
  return {
    fn,
    key: nextKey,
    save: (
      account: string,
      input: {
        id?: string | null;
        version?: number | null;
        title?: string | null;
        category?: string | null;
        kind?: string | null;
        group?: string | null;
        family?: string | null;
        job?: string | null;
        interval?: number | null;
        start?: string | null;
        from?: number | null;
        to?: number | null;
        key?: string;
      },
    ) =>
      fn(
        account,
        "recurring_schedule_save($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)",
        [
          input.key ?? nextKey("save"),
          input.id ?? null,
          input.version ?? null,
          input.title === undefined ? "Heti kerti munka" : input.title,
          input.category === undefined ? "kert" : input.category,
          input.kind ?? null,
          input.group ?? null,
          input.family ?? null,
          input.job ?? null,
          input.interval === undefined ? 1 : input.interval,
          input.start === undefined ? "2026-09-07" : input.start,
          input.from ?? null,
          input.to ?? null,
        ],
      ),
    setActive: (
      account: string,
      schedule: string,
      version: number,
      active: boolean,
      key = nextKey("active"),
    ) =>
      fn(account, "recurring_schedule_set_active($1, $2, $3, $4)", [
        key,
        schedule,
        version,
        active,
      ]),
    done: (account: string, occurrence: string, version: number, key = nextKey("done")) =>
      fn(account, "recurring_occurrence_mark_done($1, $2, $3)", [key, occurrence, version]),
    undo: (account: string, occurrence: string, version: number, key = nextKey("undo")) =>
      fn(account, "recurring_occurrence_undo_done($1, $2, $3)", [key, occurrence, version]),
    skip: (
      account: string,
      occurrence: string,
      version: number,
      reason: string | null,
      key = nextKey("skip"),
    ) =>
      fn(account, "recurring_occurrence_skip($1, $2, $3, $4)", [key, occurrence, version, reason]),
  };
}
