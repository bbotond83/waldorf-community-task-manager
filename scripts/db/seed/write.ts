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
        "coordinator_name",
        atHours("starts_at"),
        atHours("ends_at"),
        "allergen_note",
        "supply_note",
        "food_note",
      ],
      plan.events.map((event) => [
        event.id,
        organization,
        event.groupId,
        event.title,
        event.location,
        event.coordinator,
        event.startsAtHours,
        event.endsAtHours,
        event.allergenNote,
        event.supplyNote,
        event.foodNote,
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
    await writeNotices(client, plan);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  }
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
