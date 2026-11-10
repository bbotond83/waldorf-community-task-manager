import type pg from "pg";
import { GROUP_1, GROUP_2, ORGANIZATION, uuid, YEAR_1 } from "./identity-support.ts";

/** The size U3 is built for without special tuning (NFR3.5): families, groups, tasks and assignments. */
export const DATASET = { families: 150, groups: 10, tasks: 300, assignments: 1500 } as const;

export const DATASET_GROUPS = [
  GROUP_1,
  GROUP_2,
  ...Array.from({ length: DATASET.groups - 2 }, (_, index) => uuid(1001 + index)),
];
export const datasetFamily = (n: number) => uuid(2000 + n);
export const datasetTask = (t: number) => uuid(3000 + t);

/**
 * The size U4 adds (NFR3.12): 3000 notifications and 600 reminder jobs (a 7-day and a 24-hour job for each of the
 * 300 tasks), with the five families that hold a place on a task as the recipients of its jobs. One parent holds
 * `heavyParent` of the notifications, so a single list is as long as it ever gets for a person.
 */
export const NOTIFICATION_DATASET = { notifications: 3000, jobs: 600, heavyParent: 1000 } as const;

/**
 * Adds the notifications and reminder jobs of `NOTIFICATION_DATASET` on top of `loadDataset`. The jobs are due (scheduled
 * a minute ago) and queued, so the tick has all 600 to run; the notifications are spread over the parents of the data
 * set, and `heavyParent` of them belong to the given parent row. Rows are written as the schema owner.
 */
export async function loadNotificationDataset(
  db: pg.Client,
  heavyParentRow: string,
): Promise<void> {
  const org = `'${ORGANIZATION}'::uuid`;
  await db.query(
    `insert into reminder_jobs (organization_id, task_id, threshold, task_starts_at, scheduled_for, correlation_id)
     select ${org}, t.id, th.v, t.starts_at, now() - interval '1 minute', left(md5(t.id::text || th.v), 12)
       from tasks t cross join (values ('7d'), ('24h')) th(v) where t.title like 'Adat feladat%'`,
  );
  await db.query(
    `insert into reminder_recipients (organization_id, reminder_job_id, family_id)
     select ${org}, j.id, a.family_id from reminder_jobs j join assignments a on a.task_id = j.task_id`,
  );
  await db.query(
    `insert into notifications (organization_id, parent_id, kind, target_type, target_ref, task_id, task_starts_at, dedupe_key, created_at)
     select ${org},
            case when n < ${NOTIFICATION_DATASET.heavyParent} then $1::uuid
                 else ('cccccccc-0000-4000-8000-' || lpad((4000 + n % ${DATASET.families})::text, 12, '0'))::uuid end,
            'sign_up_confirmed', 'task', t.id, t.id, t.starts_at, 'dataset-' || n, now() - (n || ' minutes')::interval
       from generate_series(0, ${NOTIFICATION_DATASET.notifications - 1}) n
       join tasks t on t.id = ('cccccccc-0000-4000-8000-' || lpad((3000 + n % ${DATASET.tasks})::text, 12, '0'))::uuid`,
    [heavyParentRow],
  );
}

/**
 * Loads the deterministic data set into the schema the connection is bound to: 150 families (one parent, a
 * contact and a membership each, spread over the 10 groups), 300 tasks (30 per group) and 1500 assignments
 * (five per task, from the 15 families of the task's group, so no family holds a task twice). It needs the
 * identity world (the organization, the school year and the first two groups) and creates its own rows only;
 * nothing outside the schema is touched. Used by the timing and race tests (NFR3.5, NFR4.6).
 */
export async function loadDataset(db: pg.Client): Promise<void> {
  const id = (base: number, expression: string) =>
    `('cccccccc-0000-4000-8000-' || lpad((${base} + ${expression})::text, 12, '0'))::uuid`;
  const groups = `array[${DATASET_GROUPS.map((group) => `'${group}'::uuid`).join(", ")}]`;
  const org = `'${ORGANIZATION}'::uuid`;
  await db.query(
    `insert into groups (id, organization_id, school_year_id, name, description)
     select ${id(1001, "g")}, ${org}, '${YEAR_1}'::uuid, 'Adat csoport ' || g, 'Adat leírás' from generate_series(0, ${DATASET.groups - 3}) g`,
  );
  await db.query(
    `insert into families (id, organization_id, display_name)
     select ${id(2000, "n")}, ${org}, 'Adat család ' || n from generate_series(0, ${DATASET.families - 1}) n`,
  );
  await db.query(
    `insert into parents (id, organization_id, family_id, display_name)
     select ${id(4000, "n")}, ${org}, ${id(2000, "n")}, 'Adat szülő ' || n from generate_series(0, ${DATASET.families - 1}) n`,
  );
  await db.query(
    `insert into group_memberships (organization_id, parent_id, group_id)
     select ${org}, ${id(4000, "n")}, (${groups})[1 + n % ${DATASET.groups}] from generate_series(0, ${DATASET.families - 1}) n`,
  );
  await db.query(
    `insert into parent_contacts (parent_id, organization_id, contact_email, contact_phone, locality)
     select ${id(4000, "n")}, ${org}, 'adat' || n || '@example.test', '+36 30 555 ' || lpad(n::text, 4, '0'), 'Pécs'
       from generate_series(0, ${DATASET.families - 1}) n`,
  );
  await db.query(
    `insert into tasks (id, organization_id, group_id, title, capacity, starts_at, ends_at, location)
     select ${id(3000, "t")}, ${org}, (${groups})[1 + t % ${DATASET.groups}], 'Adat feladat ' || t, 8,
            now() + ((1 + t % 60) || ' days')::interval, now() + ((1 + t % 60) || ' days')::interval + interval '2 hours', 'Terem'
       from generate_series(0, ${DATASET.tasks - 1}) t`,
  );
  // Task t belongs to group t % 10 whose families are n = group + 10 * m (m = 0..14): five of them per task.
  await db.query(
    `insert into assignments (organization_id, task_id, family_id, source)
     select ${org}, ${id(3000, "t")}, ${id(2000, "(t % 10) + 10 * (((t / 10) * 5 + k) % 15)")}, 'admin_assign'
       from generate_series(0, ${DATASET.tasks - 1}) t, generate_series(0, 4) k`,
  );
}
