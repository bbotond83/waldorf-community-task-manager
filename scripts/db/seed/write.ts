import type { SqlClient } from "../common.ts";
import type { SeedPlan } from "./data.ts";

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
      ["id", "organization_id", "name", "starts_on", "ends_on"],
      [
        [
          plan.schoolYear.id,
          organization,
          plan.schoolYear.name,
          plan.schoolYear.startsOn,
          plan.schoolYear.endsOn,
        ],
      ],
    );
    await insertRows(
      client,
      "groups",
      ["id", "organization_id", "school_year_id", "name"],
      plan.groups.map((group) => [group.id, organization, plan.schoolYear.id, group.name]),
    );
    await insertRows(
      client,
      "families",
      ["id", "organization_id", "display_name"],
      plan.families.map((family) => [family.id, organization, family.name]),
    );
    await insertRows(
      client,
      "group_memberships",
      ["id", "organization_id", "family_id", "group_id"],
      plan.families.map((family) => [family.membershipId, organization, family.id, family.groupId]),
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
      [
        "id",
        "organization_id",
        "family_id",
        "account_id",
        "display_name",
        "optional_profile",
        "optional_profile_consent",
      ],
      plan.parents.map((parent) => [
        parent.id,
        organization,
        parent.familyId,
        parent.accountId,
        parent.name,
        parent.optionalProfile,
        parent.consent,
      ]),
    );
    await insertRows(
      client,
      "parent_contacts",
      ["parent_id", "organization_id", "contact_email", "contact_phone", "locality"],
      plan.parents.map((parent) => [
        parent.id,
        organization,
        parent.contactEmail,
        parent.contactPhone,
        parent.locality,
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
      plan.accounts.map((account) => [
        account.grantId,
        account.id,
        account.role,
        account.scopeType,
        account.scopeId,
        organization,
      ]),
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
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  }
}
