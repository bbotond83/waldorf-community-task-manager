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
    scheduledFor?: string;
    attempt?: number;
    id?: string;
  },
): Promise<string> {
  const result = await db.query(
    `insert into reminder_jobs (id, organization_id, task_id, threshold, task_starts_at, scheduled_for, status, attempt, correlation_id)
     values (coalesce($1::uuid, gen_random_uuid()), $2, $3, $4, coalesce($5::timestamptz, now() + interval '10 days'),
             coalesce($6::timestamptz, now() - interval '1 minute'), $7, $8, $9)
     returning id`,
    [
      args.id ?? null,
      args.organization ?? ORGANIZATION,
      args.task,
      args.threshold ?? "24h",
      args.startsAt ?? null,
      args.scheduledFor ?? null,
      args.status ?? "queued",
      args.attempt ?? 0,
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
