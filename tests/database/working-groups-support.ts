import type pg from "pg";
import {
  ADMIN_G1,
  ADMIN_G2,
  callFunction,
  CO_PARENT_F1,
  FAMILY_1,
  GROUP_1,
  GROUP_2,
  ORGANIZATION,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_CO,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  seedCoordinationWorld,
  SUPER_ADMIN,
  uuid,
} from "./directory-support.ts";
import {
  FAMILY_ADMIN_G1,
  FAMILY_ADMIN_G2,
  PARENT_ROW_ADMIN_G1,
  PARENT_ROW_ADMIN_G2,
} from "./identity-support.ts";

export {
  ADMIN_G1,
  ADMIN_G2,
  CO_PARENT_F1,
  FAMILY_1,
  FAMILY_ADMIN_G1,
  FAMILY_ADMIN_G2,
  GROUP_1,
  GROUP_2,
  ORGANIZATION,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_ADMIN_G1,
  PARENT_ROW_ADMIN_G2,
  PARENT_ROW_CO,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  SUPER_ADMIN,
};

/** An archived group of the first community, and one membership row of each coordinator and member (invented ids). */
export const GROUP_ARCHIVED = uuid(9401);
export const MEMBERSHIP_F1 = uuid(9411);
export const MEMBERSHIP_F2 = uuid(9412);
export const MEMBERSHIP_ADMIN_G1 = uuid(9413);
export const MEMBERSHIP_ADMIN_G2 = uuid(9414);
/** A member without a sign-in account, and a family that is not active. */
export const FAMILY_NO_ACCOUNT = uuid(9421);
export const PARENT_ROW_NO_ACCOUNT = uuid(9422);
export const MEMBERSHIP_NO_ACCOUNT = uuid(9423);

/**
 * The coordination world with U4's shape on top: each coordinator is a member of the group they coordinate and holds
 * a parent right on their own family (so they have a current parent, BR40.1); a group nobody coordinates is archived
 * on purpose in `GROUP_ARCHIVED`; the first family's parent is a member of the first group and the second family's
 * parent of the second. No member is a coordinator except the two coordinators of the shared world.
 */
export async function seedGroupWorld(db: pg.Client, schema: string): Promise<void> {
  await seedCoordinationWorld(db, schema);
  await db.query(
    "insert into app_role_grants (subject_id, role, scope_type, scope_id, organization_id) values ($1, 'parent', 'family', $2, $5), ($3, 'parent', 'family', $4, $5)",
    [ADMIN_G1, FAMILY_ADMIN_G1, ADMIN_G2, FAMILY_ADMIN_G2, ORGANIZATION],
  );
  await db.query(
    "insert into group_memberships (id, organization_id, parent_id, group_id) values ($1, $5, $2, $3), ($4, $5, $6, $7)",
    [
      MEMBERSHIP_ADMIN_G1,
      PARENT_ROW_ADMIN_G1,
      GROUP_1,
      MEMBERSHIP_ADMIN_G2,
      ORGANIZATION,
      PARENT_ROW_ADMIN_G2,
      GROUP_2,
    ],
  );
  await db.query("update group_memberships set id = $1 where parent_id = $2 and group_id = $3", [
    MEMBERSHIP_F1,
    PARENT_ROW_F1,
    GROUP_1,
  ]);
  await db.query("update group_memberships set id = $1 where parent_id = $2 and group_id = $3", [
    MEMBERSHIP_F2,
    PARENT_ROW_F2,
    GROUP_2,
  ]);
  const year = (await db.query("select school_year_id from groups where id = $1", [GROUP_1]))
    .rows[0].school_year_id as string;
  await db.query(
    "insert into groups (id, organization_id, school_year_id, name, description, status) values ($1, $2, $3, 'Régi csoport', 'Egy lezárt csoport.', 'archived')",
    [GROUP_ARCHIVED, ORGANIZATION, year],
  );
}

/** A member with no sign-in account and a profile that ticks the sharing box (so only the account is missing). */
export async function addMemberWithoutAccount(db: pg.Client, group = GROUP_1): Promise<void> {
  await db.query(
    "insert into families (id, organization_id, display_name) values ($1, $2, 'Fiók nélküli család')",
    [FAMILY_NO_ACCOUNT, ORGANIZATION],
  );
  await db.query(
    "insert into parents (id, organization_id, family_id, display_name, account_id) values ($1, $2, $3, 'Fiók Nélküli Péter', null)",
    [PARENT_ROW_NO_ACCOUNT, ORGANIZATION, FAMILY_NO_ACCOUNT],
  );
  await db.query(
    "insert into parent_profiles (parent_id, organization_id, email_on_record, phone, sharing_consent) values ($1, $2, 'peter@example.test', '+36 30 111 2222', true)",
    [PARENT_ROW_NO_ACCOUNT, ORGANIZATION],
  );
  await db.query(
    "insert into group_memberships (id, organization_id, parent_id, group_id) values ($1, $2, $3, $4)",
    [MEMBERSHIP_NO_ACCOUNT, ORGANIZATION, PARENT_ROW_NO_ACCOUNT, group],
  );
}

/** The unrevoked group-admin grants that have no active membership of the same group: BR41.8 says there are none. */
export async function groupAdminWithoutMembership(db: pg.Client): Promise<string[]> {
  const result = await db.query(
    `select g.id from app_role_grants g
      where g.role = 'group_admin' and g.revoked_at is null
        and not exists (select 1 from parents p
                          join group_memberships m on m.parent_id = p.id and m.group_id = g.scope_id and m.status = 'active'
                         where p.account_id = g.subject_id)
      order by g.id`,
  );
  return result.rows.map((row) => row.id as string);
}

/** The state of one membership row, read as the schema owner. */
export async function membershipRow(db: pg.Client, id: string) {
  const result = await db.query(
    "select id, parent_id, group_id, status, version, end_reason, ended_at from group_memberships where id = $1",
    [id],
  );
  return result.rows[0] as
    | {
        id: string;
        parent_id: string;
        group_id: string;
        status: string;
        version: number;
        end_reason: string | null;
        ended_at: Date | null;
      }
    | undefined;
}

/** The unrevoked group-admin grants of an account, as ids. */
export async function openGrants(
  db: pg.Client,
  account: string,
  group?: string,
): Promise<string[]> {
  const result = await db.query(
    `select id from app_role_grants
      where subject_id = $1 and role = 'group_admin' and revoked_at is null and ($2::uuid is null or scope_id = $2)
      order by id`,
    [account, group ?? null],
  );
  return result.rows.map((row) => row.id as string);
}

/** The audit events of one account and action, oldest first, details included. */
export async function auditFor(db: pg.Client, account: string, action: string) {
  const result = await db.query(
    "select outcome, details, group_id, actor_account_id from audit_events where target_id = $1 and action = $2 order by occurred_at, id",
    [account, action],
  );
  return result.rows as {
    outcome: string;
    details: string | null;
    group_id: string | null;
    actor_account_id: string;
  }[];
}

export type Call = ReturnType<typeof caller>;
/** A function-call shortcut: `call(account, "working_group_join($1, $2)", [key, group])`. */
export function caller(connection: () => pg.Client, schema: string) {
  return (account: string, sql: string, values: unknown[] = []) =>
    callFunction(connection(), schema, account, sql, values);
}
