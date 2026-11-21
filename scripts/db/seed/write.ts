import type { SqlClient } from "../common.ts";
import type { SeedPlan } from "./data.ts";
import { seedId } from "./ids.ts";

const quote = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

/** A column of an insert: a plain name, or a name with an SQL expression around its one placeholder. */
export type Column = string | { name: string; sql: (placeholder: string) => string };

const CHUNK_ROWS = 200;

/**
 * Inserts rows with fixed ids and skips any row that already exists (`on conflict do nothing`), which is what makes a
 * second seed change nothing (NFR3.18). Table and column names are constants of this module, never input.
 */
export async function insertRows(
  client: SqlClient,
  table: string,
  columns: readonly Column[],
  rows: readonly (readonly unknown[])[],
): Promise<void> {
  const names = columns.map((column) => quote(typeof column === "string" ? column : column.name));
  for (let start = 0; start < rows.length; start += CHUNK_ROWS) {
    const chunk = rows.slice(start, start + CHUNK_ROWS);
    const values: unknown[] = [];
    const tuples = chunk.map((row) => {
      const placeholders = columns.map((column, position) => {
        values.push(row[position] ?? null);
        const placeholder = `$${values.length}`;
        return typeof column === "string" ? placeholder : column.sql(placeholder);
      });
      return `(${placeholders.join(", ")})`;
    });
    await client.query(
      `insert into ${quote(table)} (${names.join(", ")}) values ${tuples.join(", ")} on conflict do nothing`,
      values,
    );
  }
}

/** A timestamp given as hours from the start of today, in the database's own clock. */
const atHours = (name: string): Column => ({
  name,
  sql: (placeholder) =>
    `date_trunc('day', now()) + make_interval(hours => ${placeholder}::integer)`,
});

/**
 * Writes a plan into its schema in ONE transaction (NFR3.19): either every row is there afterwards or none was added.
 * The rows are written as the schema owner (row rules do not apply), in the order the foreign keys need. Run on a
 * schema that already holds the same plan it changes nothing.
 */
export async function writeSeedPlan(client: SqlClient, plan: SeedPlan): Promise<void> {
  const organization = plan.organization.id;
  await client.query("begin");
  try {
    await client.query(`set local search_path to ${quote(plan.schema)}, pg_catalog`);
    await insertRows(
      client,
      "organizations",
      ["id", "name"],
      [[organization, plan.organization.name]],
    );
    await insertRows(
      client,
      "school_years",
      ["id", "organization_id", "name", "starts_on", "ends_on", "changeover_date"],
      [
        [
          plan.schoolYear.id,
          organization,
          plan.schoolYear.name,
          plan.schoolYear.startsOn,
          plan.schoolYear.endsOn,
          plan.schoolYear.changeoverDate,
        ],
      ],
    );
    await insertRows(
      client,
      "break_weeks",
      ["id", "organization_id", "school_year_id", "week_start", "label"],
      plan.breakWeeks.map((week) => [
        week.id,
        organization,
        plan.schoolYear.id,
        week.weekStart,
        week.label,
      ]),
    );
    await insertRows(
      client,
      "groups",
      ["id", "organization_id", "school_year_id", "name", "description"],
      plan.groups.map((group) => [
        group.id,
        organization,
        plan.schoolYear.id,
        group.name,
        group.description,
      ]),
    );
    await insertRows(
      client,
      "families",
      ["id", "organization_id", "display_name"],
      plan.families.map((family) => [family.id, organization, family.name]),
    );
    await insertRows(
      client,
      "accounts",
      ["id", "email", "organization_id"],
      plan.accounts.map((account) => [account.id, account.email, organization]),
    );
    await insertRows(
      client,
      "parents",
      ["id", "organization_id", "family_id", "account_id", "display_name"],
      plan.parents.map((parent) => [
        parent.id,
        organization,
        parent.familyId,
        parent.accountId,
        parent.name,
      ]),
    );
    await insertRows(
      client,
      "group_memberships",
      ["id", "organization_id", "parent_id", "group_id"],
      plan.memberships.map((membership) => [
        membership.id,
        organization,
        membership.parentId,
        membership.groupId,
      ]),
    );
    await insertRows(
      client,
      "parent_profiles",
      [
        "parent_id",
        "organization_id",
        "email_on_record",
        "phone",
        "residence",
        "occupation",
        "hobby",
        "how_i_support",
        "sharing_consent",
      ],
      plan.parents.map((parent) => [
        parent.id,
        organization,
        parent.contactEmail,
        parent.contactPhone,
        parent.residence,
        parent.occupation,
        parent.hobby,
        parent.howISupport,
        parent.sharing,
      ]),
    );
    await insertRows(
      client,
      "children",
      ["id", "organization_id", "family_id", "display_name"],
      plan.children.map((child) => [child.id, organization, child.familyId, child.name]),
    );
    await insertRows(
      client,
      "app_role_grants",
      ["id", "subject_id", "role", "scope_type", "scope_id", "organization_id"],
      [
        ...plan.accounts.map((account) => [
          account.grantId,
          account.id,
          account.role,
          account.scopeType,
          account.scopeId,
          organization,
        ]),
        ...plan.extraGrants.map((grant) => [
          grant.id,
          grant.subjectId,
          grant.role,
          grant.scopeType,
          grant.scopeId,
          organization,
        ]),
      ],
    );
    await insertRows(
      client,
      "app_authorization_versions",
      ["subject_id", "authorization_version"],
      plan.accounts.map((account) => [account.id, 1]),
    );
    await insertRows(
      client,
      "events",
      [
        "id",
        "organization_id",
        "group_id",
        "title",
        "location",
        atHours("starts_at"),
        atHours("ends_at"),
        "food_signup_on",
      ],
      plan.events.map((event) => [
        event.id,
        organization,
        event.groupId,
        event.title,
        event.location,
        event.startsAtHours,
        event.endsAtHours,
        event.foodSignupOn,
      ]),
    );
    await insertRows(
      client,
      "event_notices",
      ["id", "organization_id", "event_id", "position", "text"],
      plan.eventNotices.map((row) => [row.id, organization, row.eventId, row.position, row.text]),
    );
    await insertRows(
      client,
      "event_roles",
      [
        "id",
        "organization_id",
        "event_id",
        "name",
        "parent_id",
        "person_name",
        "is_organiser",
        "created_at",
      ],
      // A role's age decides which one the teacher schedule shows (the oldest). The rows go in together, so each gets
      // its own second: the first role of an event is then the oldest in every schema, whatever its random id.
      plan.eventRoles.map((row, index) => [
        row.id,
        organization,
        row.eventId,
        row.name,
        row.parentId,
        row.personName,
        row.isOrganiser,
        new Date(Date.now() - (plan.eventRoles.length - index) * 1000).toISOString(),
      ]),
    );
    await insertRows(
      client,
      "tasks",
      [
        "id",
        "organization_id",
        "group_id",
        "event_id",
        "title",
        "capacity",
        atHours("starts_at"),
        atHours("ends_at"),
        "location",
      ],
      plan.tasks.map((task) => [
        task.id,
        organization,
        task.groupId,
        task.eventId,
        task.title,
        task.capacity,
        task.startsAtHours,
        task.endsAtHours,
        task.location,
      ]),
    );
    await insertRows(
      client,
      "assignments",
      ["id", "organization_id", "task_id", "family_id", "parent_id", "source"],
      plan.assignments.map((assignment) => [
        assignment.id,
        organization,
        assignment.taskId,
        assignment.familyId,
        assignment.parentId,
        assignment.source,
      ]),
    );
    await insertRows(
      client,
      "event_signups",
      ["id", "organization_id", "event_id", "parent_id", "family_id", "note"],
      plan.eventSignups.map((row) => [
        row.id,
        organization,
        row.eventId,
        row.parentId,
        row.familyId,
        row.note,
      ]),
    );
    await insertRows(
      client,
      "food_offers",
      [
        "id",
        "organization_id",
        "event_id",
        "parent_id",
        "category",
        "text",
        "has_milk",
        "has_egg",
        "has_garlic",
      ],
      plan.foodOffers.map((row) => [
        row.id,
        organization,
        row.eventId,
        row.parentId,
        row.category,
        row.text,
        row.hasMilk,
        row.hasEgg,
        row.hasGarlic,
      ]),
    );
    await writeLibrary(client, plan);
    await writeNotices(client, plan);
    await writeRota(client, plan);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  }
}

/** The invented library: books, their loans (closed and open) and the watches on borrowed books (U13). */
async function writeLibrary(client: SqlClient, plan: SeedPlan): Promise<void> {
  const organization = plan.organization.id;
  await insertRows(
    client,
    "books",
    [
      "id",
      "organization_id",
      "title",
      "authors",
      "description",
      "owner_parent_id",
      "owner_name",
      "source_key",
    ],
    plan.books.map((book) => [
      book.id,
      organization,
      book.title,
      book.authors,
      book.description,
      book.ownerParentId,
      book.ownerName,
      book.sourceKey,
    ]),
  );
  await insertRows(
    client,
    "loans",
    [
      "id",
      "organization_id",
      "book_id",
      "borrower_parent_id",
      "borrower_family_id",
      {
        name: "borrowed_at",
        sql: (placeholder) =>
          `date_trunc('day', now()) - make_interval(days => ${placeholder}::integer) + interval '10 hours'`,
      },
      {
        name: "until",
        sql: (placeholder) =>
          `case when ${placeholder}::integer is null then null else (current_date + ${placeholder}::integer) end`,
      },
      {
        name: "returned_at",
        sql: (placeholder) =>
          `case when ${placeholder}::integer is null then null else date_trunc('day', now()) - make_interval(days => ${placeholder}::integer) + interval '12 hours' end`,
      },
    ],
    plan.loans.map((loan) => [
      loan.id,
      organization,
      loan.bookId,
      loan.borrowerParentId,
      loan.borrowerFamilyId,
      loan.borrowedDaysAgo,
      loan.untilInDays,
      loan.returnedDaysAgo,
    ]),
  );
  await insertRows(
    client,
    "return_watches",
    ["id", "organization_id", "book_id", "parent_id"],
    plan.watches.map((watch) => [watch.id, organization, watch.bookId, watch.parentId]),
  );
}

/**
 * The standings and the four-rota plan of the year (BR60.1, BR61.1). The draft is computed by the database's own draft
 * function, so it is the draft a super admin would get. A published set (the large one) goes through the same steps as
 * publishing: the weekly duties, the five weekend slots and duties of every weekend, then a few picks that move an
 * opening to the picking family, then the plan is marked published. The statements are the same for both sets; the
 * published flag and the number of picks are values. A plan that is already published is left as it is.
 */
async function writeRota(client: SqlClient, plan: SeedPlan): Promise<void> {
  const organization = plan.organization.id;
  const { rotaPlan } = plan;
  await insertRows(
    client,
    "family_year_standings",
    ["id", "organization_id", "family_id", "school_year_id", "standing"],
    plan.standings.map((entry) => [
      entry.id,
      organization,
      entry.familyId,
      plan.schoolYear.id,
      entry.standing,
    ]),
  );
  await insertRows(
    client,
    "rota_plans",
    ["id", "organization_id", "school_year_id"],
    [[rotaPlan.id, organization, plan.schoolYear.id]],
  );
  await client.query(
    `insert into rota_weeks (id, organization_id, plan_id, job, week_start, family_id, empty_reason)
     select md5($2::text || ':' || d.o_job || ':' || d.o_week_start::text)::uuid,
            $1::uuid, $2::uuid, d.o_job, d.o_week_start, d.o_family_id, d.o_empty_reason
       from rota_draft_compute($1::uuid, $3::uuid) d
     on conflict do nothing`,
    [organization, rotaPlan.id, plan.schoolYear.id],
  );
  const toPublish = `exists (select 1 from rota_plans p where p.id = $1::uuid and p.status = 'draft') and $2::boolean`;
  await client.query(
    `insert into weekend_slots (organization_id, weekend_week_id, slot)
     select w.organization_id, w.id, s.slot
       from rota_weeks w
      cross join (values ('saturday_opening'), ('saturday_closing'), ('sunday_opening'), ('sunday_closing'),
                         ('shelter_cleaning')) s(slot)
      where ${toPublish} and w.plan_id = $1::uuid and w.job = 'weekend_animal_care' and w.family_id is not null
     on conflict do nothing`,
    [rotaPlan.id, rotaPlan.published],
  );
  await client.query(
    `select count(duty_create('rota_week', w.id, rota_job_title(w.job), 'rota_' || w.job,
                              w.week_start::timestamp at time zone 'Europe/Budapest',
                              ((w.week_start + 6)::timestamp + interval '23 hours 59 minutes 59 seconds')
                                at time zone 'Europe/Budapest',
                              null, array[w.family_id], 'rota_publish'))
       from rota_weeks w
      where ${toPublish} and w.plan_id = $1::uuid and w.job <> 'weekend_animal_care' and w.family_id is not null`,
    [rotaPlan.id, rotaPlan.published],
  );
  await client.query(
    `select count(duty_create('weekend_slot', s.id, weekend_slot_title(s.slot), weekend_slot_category(s.slot),
                              x.starts_at, x.ends_at, null, array[w.family_id], 'rota_publish'))
       from weekend_slots s
       join rota_weeks w on w.id = s.weekend_week_id
      cross join lateral weekend_slot_window(w.week_start, s.slot) x
      where ${toPublish} and w.plan_id = $1::uuid`,
    [rotaPlan.id, rotaPlan.published],
  );
  await client.query(
    `with chosen as (
       select w.id as week_id, w.organization_id, w.family_id as picker, s.id as slot_id, t.id as task_id
         from rota_weeks w
         join rota_weeks ww on ww.plan_id = w.plan_id and ww.week_start = w.week_start and ww.job = 'weekend_animal_care'
         join weekend_slots s on s.weekend_week_id = ww.id and s.slot = 'saturday_opening'
         join tasks t on t.origin_kind = 'weekend_slot' and t.origin_id = s.id
        where ${toPublish} and w.plan_id = $1::uuid and w.job = 'indoor_cleaning' and w.family_id is not null
          and ww.family_id is not null and ww.family_id <> w.family_id and w.week_start > current_date
          and not exists (select 1 from weekend_picks pk where pk.rota_week_id = w.id)
        order by w.week_start
        limit $3::integer),
     moved as (
       update assignments a set family_id = c.picker, source = 'weekend_pick'
         from chosen c where a.task_id = c.task_id and a.status <> 'removed'
       returning a.task_id)
     insert into weekend_picks (organization_id, rota_week_id, weekend_slot_id, source)
     select c.organization_id, c.week_id, c.slot_id, 'family' from chosen c`,
    [rotaPlan.id, rotaPlan.published, rotaPlan.picks],
  );
  await client.query(
    `update rota_plans set status = 'published', published_at = now(), published_by = $3::uuid
      where id = $1::uuid and status = 'draft' and $2::boolean`,
    [rotaPlan.id, rotaPlan.published, rotaPlan.publishedBy],
  );
}

/**
 * The invented notices, their email deliveries and tries, and the invented run records. Only ids, states and counts are
 * written: no address is stored in a delivery, and a failed delivery has three failed tries in its first round, so the
 * failure screen has something to show.
 */
async function writeNotices(client: SqlClient, plan: SeedPlan): Promise<void> {
  const organization = plan.organization.id;
  await insertRows(
    client,
    "notifications",
    [
      "id",
      "organization_id",
      "parent_id",
      "kind",
      "target_type",
      "target_ref",
      "task_id",
      {
        name: "task_starts_at",
        sql: (placeholder) => `(select t.starts_at from tasks t where t.id = ${placeholder}::uuid)`,
      },
      "dedupe_key",
    ],
    plan.notices.map((notice) => [
      notice.id,
      organization,
      notice.parentId,
      "sign_up_confirmed",
      "task",
      notice.taskId,
      notice.taskId,
      notice.taskId,
      `seed:${notice.id}`,
    ]),
  );
  const nowWhen = (name: string): Column => ({
    name,
    sql: (placeholder) => `case when ${placeholder}::boolean then now() end`,
  });
  await insertRows(
    client,
    "email_deliveries",
    [
      "id",
      "organization_id",
      "notice_id",
      "parent_id",
      "kind",
      "target_type",
      "target_id",
      {
        name: "item_date",
        sql: (placeholder) =>
          `(select (t.starts_at at time zone 'Europe/Budapest')::date from tasks t where t.id = ${placeholder}::uuid)`,
      },
      "status",
      "attempts_in_round",
      nowWhen("last_attempt_at"),
      nowWhen("finished_at"),
    ],
    plan.notices.map((notice) => [
      notice.deliveryId,
      organization,
      notice.id,
      notice.parentId,
      "sign_up_confirmed",
      "task",
      notice.taskId,
      notice.taskId,
      notice.deliveryStatus,
      notice.deliveryStatus === "failed" ? 3 : notice.deliveryStatus === "sent" ? 1 : 0,
      notice.deliveryStatus !== "queued",
      notice.deliveryStatus !== "queued",
    ]),
  );
  await insertRows(
    client,
    "email_attempts",
    ["id", "delivery_id", "round", "attempt_number", "outcome", "reason_code"],
    plan.notices.flatMap((notice) =>
      notice.deliveryStatus === "sent"
        ? [
            [
              seedId(plan.schema, `attempt:${notice.deliveryId}:1`),
              notice.deliveryId,
              1,
              1,
              "sent",
              null,
            ],
          ]
        : notice.deliveryStatus === "failed"
          ? [1, 2, 3].map((attempt) => [
              seedId(plan.schema, `attempt:${notice.deliveryId}:${attempt}`),
              notice.deliveryId,
              1,
              attempt,
              "failed",
              "mail_unavailable",
            ])
          : [],
    ),
  );
  await insertRows(
    client,
    "timed_runs",
    ["id", "run_kind", atHours("run_at"), atHours("finished_at")],
    plan.timedRuns.map((run) => [run.id, run.runKind, run.atHours, run.atHours]),
  );
  await insertRows(
    client,
    "timed_check_runs",
    [
      "id",
      "run_id",
      "check_name",
      "run_kind",
      atHours("started_at"),
      "outcome",
      "created",
      "skipped",
      "error_code",
    ],
    plan.timedRuns.flatMap((run) =>
      run.checks.map((check) => [
        check.id,
        run.id,
        check.name,
        run.runKind,
        run.atHours,
        check.outcome,
        check.created,
        0,
        check.errorCode,
      ]),
    ),
  );
}
