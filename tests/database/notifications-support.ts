import type pg from "pg";
import { ORGANIZATION, uuid } from "./directory-support.ts";

export { DIRECTORY_SCHEMAS as NOTIFICATION_SCHEMAS } from "./directory-support.ts";

let counter = 0;
const next = (prefix: string) => `${prefix}-${Date.now()}-${++counter}`;

/** Inserts a reminder job as the schema owner (row rules do not apply) and returns its id. */
export async function insertJob(
  db: pg.Client,
  args: {
    task: string;
    threshold?: "7d" | "24h";
    status?: string;
    organization?: string;
    startsAt?: string;
    /** The Budapest date the job is due (default: yesterday, so it is due). */
    dueOn?: string;
    id?: string;
  },
): Promise<string> {
  const result = await db.query(
    `insert into reminder_jobs (id, organization_id, task_id, threshold, task_starts_at, due_on, status, correlation_id)
     values (coalesce($1::uuid, gen_random_uuid()), $2, $3, $4, coalesce($5::timestamptz, now() + interval '10 days'),
             coalesce($6::date, (now() at time zone 'Europe/Budapest')::date - 1), $7, $8)
     returning id`,
    [
      args.id ?? null,
      args.organization ?? ORGANIZATION,
      args.task,
      args.threshold ?? "24h",
      args.startsAt ?? null,
      args.dueOn ?? null,
      args.status ?? "queued",
      `corr-${Math.random().toString(16).slice(2, 12)}`,
    ],
  );
  return result.rows[0].id as string;
}

/** Inserts a notification as the schema owner and returns its id. */
export async function insertNotification(
  db: pg.Client,
  args: {
    parent: string;
    kind?: string;
    targetType?: string;
    target?: string;
    task?: string;
    key?: string;
    organization?: string;
    job?: string | null;
    readAt?: string | null;
    createdAt?: string;
  },
): Promise<string> {
  const result = await db.query(
    `insert into notifications (organization_id, parent_id, kind, target_type, target_ref, task_id, task_starts_at,
                                reminder_job_id, dedupe_key, read_at, created_at)
     values ($1, $2, $3, $4, $5, $6, now() + interval '10 days', $7, $8, $9, coalesce($10::timestamptz, now()))
     returning id`,
    [
      args.organization ?? ORGANIZATION,
      args.parent,
      args.kind ?? "sign_up_confirmed",
      args.targetType ?? "task",
      args.target ?? uuid(9001),
      args.task ?? uuid(9001),
      args.job ?? null,
      args.key ?? next("seed"),
      args.readAt ?? null,
      args.createdAt ?? null,
    ],
  );
  return result.rows[0].id as string;
}

/** Inserts an email delivery for a notice as the schema owner (a failed one by default) and returns its id. */
export async function insertDelivery(
  db: pg.Client,
  args: {
    notice: string;
    parent: string;
    kind?: string;
    target?: string;
    status?: "queued" | "sending" | "retry_wait" | "sent" | "failed" | "cancelled";
    round?: number;
    attempts?: number;
    organization?: string;
  },
): Promise<string> {
  const status = args.status ?? "failed";
  const attempts = args.attempts ?? (status === "failed" ? 3 : 0);
  const result = await db.query(
    `insert into email_deliveries (organization_id, notice_id, parent_id, kind, target_type, target_id, item_date,
                                   status, round, attempts_in_round, claimed_at, last_attempt_at, finished_at)
     values ($1, $2, $3, $4, 'task', $5, (now() at time zone 'Europe/Budapest')::date + 3, $6, $7, $8,
             case when $6 = 'sending' then now() end,
             case when $8 > 0 then now() end,
             case when $6 in ('sent', 'failed', 'cancelled') then now() end)
     returning id`,
    [
      args.organization ?? ORGANIZATION,
      args.notice,
      args.parent,
      args.kind ?? "sign_up_confirmed",
      args.target ?? uuid(9001),
      status,
      args.round ?? 1,
      attempts,
    ],
  );
  return result.rows[0].id as string;
}
