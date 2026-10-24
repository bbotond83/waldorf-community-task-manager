import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import {
  asActor,
  authenticated,
  CHILD_F1,
  CO_PARENT_F1,
  countAs,
  DIRECTORY_SCHEMAS,
  FAMILY_1,
  FAMILY_2,
  FAMILY_NO_GROUP,
  FAMILY_OTHER,
  GROUP_1,
  GROUP_2,
  GROUP_OTHER,
  openDirectoryDatabase,
  ORGANIZATION,
  OTHER_ORGANIZATION,
  PARENT_F1,
  PARENT_F2,
  PARENT_ROW_CO,
  PARENT_ROW_F1,
  PARENT_ROW_F2,
  seedDirectoryWorld,
  SUPER_ADMIN,
  uuid,
  VIEWERS,
  YEAR_1,
  YEAR_OTHER,
  type ViewerName,
} from "./directory-support.ts";
import { failureOf, openDatabase } from "./stack-support.ts";

const DIRECTORY_TABLES = [
  "organizations",
  "school_years",
  "groups",
  "families",
  "group_memberships",
  "parents",
  "parent_contacts",
  "children",
  "organization_settings",
  "reminder_settings",
] as const;

/** Directory and Settings tables: constraints, indexes, the role matrix and the service-role limits (BR30, NFR1.25, NFR1.26, NFR1.31, NFR3.6). */
for (const schema of DIRECTORY_SCHEMAS) {
  describe(`directory schema in ${schema}`, () => {
    let db: pg.Client;

    before(async () => {
      db = await openDirectoryDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedDirectoryWorld(db, schema);
    });

    const code = async (sql: string, values: unknown[] = []) =>
      (await failureOf(() => db.query(sql, values)))?.code;

    it("keeps school year and group names unique inside their parent, ignoring case, and refuses bad dates", async () => {
      assert.equal(
        await code(
          "insert into school_years (organization_id, name, starts_on, ends_on) values ($1, '2026/2027', '2027-09-01', '2028-06-30')",
          [ORGANIZATION],
        ),
        "23505",
      );
      assert.equal(
        await code(
          "insert into school_years (organization_id, name, starts_on, ends_on) values ($1, 'X', '2027-06-30', '2027-06-29')",
          [ORGANIZATION],
        ),
        "23514",
      );
      assert.equal(
        await code(
          "insert into groups (organization_id, school_year_id, name) values ($1, $2, 'BORÓKA')",
          [ORGANIZATION, YEAR_1],
        ),
        "23505",
      );
      // The same name in another school year is fine.
      await db.query(
        "insert into school_years (id, organization_id, name, starts_on, ends_on) values ($1, $2, '2027/2028', '2027-09-01', '2028-06-30')",
        [uuid(5101), ORGANIZATION],
      );
      assert.equal(
        await code(
          "insert into groups (organization_id, school_year_id, name) values ($1, $2, 'Boróka')",
          [ORGANIZATION, uuid(5101)],
        ),
        undefined,
      );
    });

    it("keeps every Directory row in the organization of its parent row (composite keys)", async () => {
      // A group in another organization's school year, a membership across organizations, a parent in
      // a family of another organization: all refused by the database, not by a function.
      assert.equal(
        await code(
          "insert into groups (organization_id, school_year_id, name) values ($1, $2, 'Új')",
          [ORGANIZATION, YEAR_OTHER],
        ),
        "23503",
      );
      assert.equal(
        await code(
          "insert into group_memberships (organization_id, family_id, group_id) values ($1, $2, $3)",
          [ORGANIZATION, FAMILY_NO_GROUP, GROUP_OTHER],
        ),
        "23503",
      );
      assert.equal(
        await code(
          "insert into parents (organization_id, family_id, display_name) values ($1, $2, 'Idegen')",
          [ORGANIZATION, FAMILY_OTHER],
        ),
        "23503",
      );
      assert.equal(
        await code(
          "insert into children (organization_id, family_id, display_name) values ($1, $2, 'Idegen')",
          [OTHER_ORGANIZATION, FAMILY_1],
        ),
        "23503",
      );
    });

    it("allows one sign-in account per parent and refuses a second link even in a race", async () => {
      assert.equal(
        await code("update parents set account_id = $1 where id = $2", [PARENT_F1, PARENT_ROW_F2]),
        "23505",
      );
      // Two connections link the same free account at once: exactly one wins.
      // A second connection must not take the schema lock the first one holds.
      const other = await openDatabase();
      try {
        await db.query(
          "insert into parents (id, organization_id, family_id, display_name) values ($1, $2, $3, 'Egy'), ($4, $2, $3, 'Kettő')",
          [uuid(6101), ORGANIZATION, FAMILY_NO_GROUP, uuid(6102)],
        );
        const account = uuid(6103);
        const link = "update parents set account_id = $1 where id = $2";
        await other.query(`set search_path to "${schema}", pg_catalog`);
        // The first link is still uncommitted when the second one starts: the second waits on the
        // unique key, and refuses when the first commits.
        await db.query("begin");
        await db.query(link, [account, uuid(6101)]);
        const second = failureOf(() => other.query(link, [account, uuid(6102)]));
        await new Promise((resolve) => setTimeout(resolve, 300));
        await db.query("commit");
        assert.equal((await second)?.code, "23505");
        assert.equal(
          (
            await db.query("select count(*)::int as n from parents where account_id = $1", [
              account,
            ])
          ).rows[0].n,
          1,
        );
      } finally {
        await other.end();
      }
    });

    it("allows one active membership per family and group, and keeps an ended one as history", async () => {
      assert.equal(
        await code(
          "insert into group_memberships (organization_id, family_id, group_id) values ($1, $2, $3)",
          [ORGANIZATION, FAMILY_1, GROUP_1],
        ),
        "23505",
      );
      await db.query(
        "update group_memberships set status = 'ended', ended_at = now() where family_id = $1 and group_id = $2",
        [FAMILY_1, GROUP_1],
      );
      await db.query(
        "insert into group_memberships (organization_id, family_id, group_id) values ($1, $2, $3)",
        [ORGANIZATION, FAMILY_1, GROUP_1],
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from group_memberships where family_id = $1 and group_id = $2",
            [FAMILY_1, GROUP_1],
          )
        ).rows[0].n,
        2,
      );
      assert.equal(
        await code(
          "update group_memberships set status = 'ended' where family_id = $1 and group_id = $2 and status = 'active'",
          [FAMILY_1, GROUP_1],
        ),
        "23514",
        "an ended membership needs its end time",
      );
    });

    it("stores the optional profile only with consent and validates contact fields", async () => {
      assert.equal(
        await code("update parents set optional_profile_consent = false where id = $1", [
          PARENT_ROW_F1,
        ]),
        "23514",
        "profile text without consent",
      );
      await db.query(
        "update parents set optional_profile_consent = false, optional_profile = null where id = $1",
        [PARENT_ROW_F1],
      );
      assert.equal(
        await code(
          "update parent_contacts set contact_email = 'Upper@Example.test' where parent_id = $1",
          [PARENT_ROW_F1],
        ),
        "23514",
      );
      assert.equal(
        await code("update parent_contacts set contact_email = 'no-at-sign' where parent_id = $1", [
          PARENT_ROW_F1,
        ]),
        "23514",
      );
      assert.equal(
        await code("update parent_contacts set contact_phone = 'call me' where parent_id = $1", [
          PARENT_ROW_F1,
        ]),
        "23514",
      );
      assert.equal(
        await code("update parent_contacts set locality = $2 where parent_id = $1", [
          PARENT_ROW_F1,
          "x".repeat(101),
        ]),
        "23514",
      );
    });

    it("raises the version and the update time on every accepted update and keeps archived families consistent", async () => {
      const before = (
        await db.query("select version, updated_at from families where id = $1", [FAMILY_1])
      ).rows[0];
      await db.query("update families set display_name = 'Fenyő család 2' where id = $1", [
        FAMILY_1,
      ]);
      const after = (
        await db.query("select version, updated_at from families where id = $1", [FAMILY_1])
      ).rows[0];
      assert.equal(after.version, before.version + 1);
      assert.ok(after.updated_at >= before.updated_at);
      assert.equal(
        await code("update families set status = 'archived' where id = $1", [FAMILY_1]),
        "23514",
        "archived needs archived_at",
      );
      assert.equal(
        await code("update families set archived_at = now() where id = $1", [FAMILY_1]),
        "23514",
        "archived_at needs the archived status",
      );
    });

    it("keeps settings unique per organization and limited to the two recipient options", async () => {
      await db.query("insert into reminder_settings (organization_id) values ($1)", [ORGANIZATION]);
      assert.equal(
        await code("insert into reminder_settings (organization_id) values ($1)", [ORGANIZATION]),
        "23505",
      );
      assert.equal(
        await code(
          "insert into reminder_settings (organization_id, threshold, recipient_scope) values ($1, 'other', 'everyone')",
          [ORGANIZATION],
        ),
        "23514",
      );
      await db.query(
        "insert into organization_settings (organization_id, key, value) values ($1, 'a.b', 'x')",
        [ORGANIZATION],
      );
      assert.equal(
        await code(
          "insert into organization_settings (organization_id, key, value) values ($1, 'a.b', 'y')",
          [ORGANIZATION],
        ),
        "23505",
      );
      assert.equal(
        await code(
          "insert into organization_settings (organization_id, key, value) values ($1, 'Bad Key', 'y')",
          [ORGANIZATION],
        ),
        "23514",
      );
    });

    it("has the indexes the policies and functions need (NFR3.6)", async () => {
      const indexes = (
        await db.query(
          "select tablename, indexdef from pg_indexes where schemaname = current_schema() and tablename = any($1)",
          [[...DIRECTORY_TABLES]],
        )
      ).rows as { tablename: string; indexdef: string }[];
      const has = (table: string, fragment: string) =>
        indexes.some((row) => row.tablename === table && row.indexdef.includes(fragment));
      assert.ok(has("group_memberships", "(family_id, status)"), "memberships by family");
      assert.ok(has("group_memberships", "(group_id, status)"), "memberships by group");
      assert.ok(has("group_memberships", "(family_id, group_id)"), "one active membership");
      assert.ok(has("parents", "(family_id)"), "parents by family");
      assert.ok(has("parents", "(account_id)"), "parents by account");
      assert.ok(has("children", "(family_id)"), "children by family");
      assert.ok(has("families", "(organization_id, status)"), "families by organization");
      assert.ok(has("groups", "(school_year_id, lower(name))"), "group names");
    });

    /** Rows each viewer sees in the seeded world (the second organization's rows are never counted for the first). */
    const MATRIX: Record<string, Partial<Record<ViewerName, number>>> = {
      organizations: {
        parent: 1,
        coParent: 1,
        parentOther: 1,
        teacher: 1,
        adminSame: 1,
        adminOther: 1,
        super: 1,
        nogrant: 1,
        deactivated: 0,
        signedOut: 0,
        otherOrganizationAdmin: 1,
      },
      school_years: {
        parent: 1,
        coParent: 1,
        parentOther: 1,
        teacher: 1,
        adminSame: 1,
        adminOther: 1,
        super: 1,
        nogrant: 0,
        deactivated: 0,
        signedOut: 0,
        otherOrganizationAdmin: 1,
      },
      groups: {
        parent: 1,
        coParent: 1,
        parentOther: 1,
        teacher: 1,
        adminSame: 1,
        adminOther: 1,
        super: 2,
        nogrant: 0,
        deactivated: 0,
        signedOut: 0,
        otherOrganizationAdmin: 1,
      },
      families: {
        parent: 1,
        coParent: 1,
        parentOther: 1,
        teacher: 0,
        adminSame: 1,
        adminOther: 1,
        super: 3,
        nogrant: 0,
        deactivated: 0,
        signedOut: 0,
        otherOrganizationAdmin: 1,
      },
      group_memberships: {
        parent: 1,
        coParent: 1,
        parentOther: 1,
        teacher: 0,
        adminSame: 1,
        adminOther: 1,
        super: 2,
        nogrant: 0,
        deactivated: 0,
        signedOut: 0,
        otherOrganizationAdmin: 1,
      },
      parents: {
        parent: 4,
        coParent: 4,
        parentOther: 1,
        teacher: 0,
        adminSame: 4,
        adminOther: 1,
        super: 5,
        nogrant: 0,
        deactivated: 0,
        signedOut: 0,
        otherOrganizationAdmin: 1,
      },
      parent_contacts: {
        parent: 2,
        coParent: 2,
        parentOther: 1,
        teacher: 0,
        adminSame: 2,
        adminOther: 1,
        super: 3,
        nogrant: 0,
        deactivated: 0,
        signedOut: 0,
        otherOrganizationAdmin: 1,
      },
      children: {
        parent: 1,
        coParent: 1,
        parentOther: 1,
        teacher: 0,
        adminSame: 1,
        adminOther: 1,
        super: 2,
        nogrant: 0,
        deactivated: 0,
        signedOut: 0,
        otherOrganizationAdmin: 1,
      },
    };

    it("shows each role exactly its rows of every table, the co-parent and every other role included (BR30.5, BR30.8, BR30.9, NFR1.26)", async () => {
      for (const [table, expected] of Object.entries(MATRIX)) {
        for (const [viewer, rows] of Object.entries(expected) as [ViewerName, number][]) {
          assert.equal(
            await countAs(db, schema, VIEWERS[viewer], table),
            rows,
            `${table} as ${viewer}`,
          );
        }
      }
    });

    it("shows the settings tables to admins only, per role", async () => {
      await db.query("insert into reminder_settings (organization_id) values ($1)", [ORGANIZATION]);
      await db.query(
        "insert into organization_settings (organization_id, key, value) values ($1, 'a', 'b')",
        [ORGANIZATION],
      );
      const expected: Record<ViewerName, number> = {
        parent: 0,
        coParent: 0,
        parentOther: 0,
        teacher: 0,
        adminSame: 1,
        adminOther: 1,
        super: 1,
        nogrant: 0,
        deactivated: 0,
        signedOut: 0,
        otherOrganizationAdmin: 0,
      };
      for (const table of ["reminder_settings", "organization_settings"]) {
        for (const [viewer, rows] of Object.entries(expected) as [ViewerName, number][]) {
          assert.equal(
            await countAs(db, schema, VIEWERS[viewer], table),
            rows,
            `${table} as ${viewer}`,
          );
        }
      }
    });

    it("hides contact details from other families, teachers and other groups, and shows them to the family and admins in reach (BR30.5)", async () => {
      const visibleTo = async (account: string) =>
        asActor(db, schema, authenticated(account), async () =>
          (await db.query("select parent_id from parent_contacts order by parent_id")).rows.map(
            (row) => row.parent_id as string,
          ),
        );
      assert.deepEqual(await visibleTo(PARENT_F1), [PARENT_ROW_F1, PARENT_ROW_CO]);
      assert.deepEqual(await visibleTo(CO_PARENT_F1), [PARENT_ROW_F1, PARENT_ROW_CO]);
      assert.deepEqual(await visibleTo(PARENT_F2), [PARENT_ROW_F2]);
      assert.deepEqual(await visibleTo(VIEWERS.teacher), []);
      assert.deepEqual(await visibleTo(VIEWERS.adminOther), [PARENT_ROW_F2]);
      assert.deepEqual(
        await visibleTo(VIEWERS.otherOrganizationAdmin).then((rows) => rows.length),
        1,
      );
    });

    it("keeps the optional profile out of the table rights and readable only by the parent and admins in reach, with consent (BR30.4)", async () => {
      const selecting = await failureOf(() =>
        asActor(db, schema, authenticated(PARENT_F1), () =>
          db.query("select optional_profile from parents"),
        ),
      );
      assert.equal(selecting?.code, "42501");
      const profileAs = (account: string, parentId: string) =>
        asActor(
          db,
          schema,
          authenticated(account),
          async () =>
            (await db.query("select directory_parent_profile($1) as profile", [parentId])).rows[0]
              .profile as string | null,
        );
      assert.equal(await profileAs(PARENT_F1, PARENT_ROW_F1), "Szívesen főzök.");
      assert.equal(await profileAs(VIEWERS.adminSame, PARENT_ROW_F1), "Szívesen főzök.");
      assert.equal(await profileAs(SUPER_ADMIN, PARENT_ROW_F1), "Szívesen főzök.");
      for (const account of [
        CO_PARENT_F1,
        PARENT_F2,
        VIEWERS.teacher,
        VIEWERS.adminOther,
        VIEWERS.nogrant,
      ]) {
        assert.equal(await profileAs(account, PARENT_ROW_F1), null, account);
      }
      await db.query(
        "update parents set optional_profile_consent = false, optional_profile = null where id = $1",
        [PARENT_ROW_F1],
      );
      assert.equal(await profileAs(PARENT_F1, PARENT_ROW_F1), null, "no consent, no text");
    });

    it("answers the empty string, never NULL, to a reader who may see the profile of a parent with consent but no text (R-01, BR30.4)", async () => {
      await db.query(
        "update parents set optional_profile_consent = true, optional_profile = null where id = $1",
        [PARENT_ROW_F1],
      );
      const profileAs = (account: string) =>
        asActor(
          db,
          schema,
          authenticated(account),
          async () =>
            (await db.query("select directory_parent_profile($1) as profile", [PARENT_ROW_F1]))
              .rows[0].profile as string | null,
        );
      for (const account of [PARENT_F1, VIEWERS.adminSame, SUPER_ADMIN]) {
        assert.equal(await profileAs(account), "", account);
      }
      // The rule of who may see it is unchanged: everyone else still gets nothing, not even an empty text.
      for (const account of [
        CO_PARENT_F1,
        PARENT_F2,
        VIEWERS.teacher,
        VIEWERS.adminOther,
        VIEWERS.nogrant,
      ]) {
        assert.equal(await profileAs(account), null, account);
      }
    });

    it("hides an archived family from its own parents and keeps it for admins in reach (BR30.8)", async () => {
      await db.query("update families set status = 'archived', archived_at = now() where id = $1", [
        FAMILY_1,
      ]);
      assert.equal(await countAs(db, schema, PARENT_F1, "families"), 0);
      assert.equal(await countAs(db, schema, PARENT_F1, "parents"), 0);
      assert.equal(await countAs(db, schema, PARENT_F1, "children"), 0);
      assert.equal(await countAs(db, schema, PARENT_F1, "parent_contacts"), 0);
      assert.equal(await countAs(db, schema, VIEWERS.adminSame, "families"), 1);
      assert.equal(await countAs(db, schema, SUPER_ADMIN, "families"), 3);
      // The group is still visible through the membership of the active family only.
      assert.equal(await countAs(db, schema, PARENT_F1, "groups"), 0);
    });

    it("isolates organizations in both directions", async () => {
      for (const table of [
        "school_years",
        "groups",
        "families",
        "parents",
        "parent_contacts",
        "children",
      ]) {
        assert.equal(
          await countAs(
            db,
            schema,
            VIEWERS.otherOrganizationAdmin,
            table,
            `organization_id = '${ORGANIZATION}'`,
          ),
          0,
          `${table}: other organization's admin reads nothing of the first`,
        );
        assert.equal(
          await countAs(
            db,
            schema,
            SUPER_ADMIN,
            table,
            `organization_id = '${OTHER_ORGANIZATION}'`,
          ),
          0,
          `${table}: first organization's super admin reads nothing of the other`,
        );
      }
      // Reach helpers answer false for a family or group of another organization.
      const reached = await asActor(
        db,
        schema,
        authenticated(SUPER_ADMIN),
        async () =>
          (
            await db.query(
              "select directory_reaches_family($1, $2) as own, directory_reaches_family($3, $4) as foreign_family, directory_reaches_family($1, $5) as orphan",
              [ORGANIZATION, FAMILY_1, OTHER_ORGANIZATION, FAMILY_OTHER, FAMILY_NO_GROUP],
            )
          ).rows[0],
      );
      assert.deepEqual(reached, { own: true, foreign_family: false, orphan: true });
    });

    it("gives a group admin reach to a family only through an active membership of their group", async () => {
      const reach = (account: string, family: string) =>
        asActor(
          db,
          schema,
          authenticated(account),
          async () =>
            (await db.query("select directory_reaches_family($1, $2) as r", [ORGANIZATION, family]))
              .rows[0].r as boolean,
        );
      assert.equal(await reach(VIEWERS.adminSame, FAMILY_1), true);
      assert.equal(await reach(VIEWERS.adminSame, FAMILY_2), false);
      assert.equal(await reach(VIEWERS.adminSame, FAMILY_NO_GROUP), false);
      // A second, active membership in the other group gives the other group admin reach as well.
      await db.query(
        "insert into group_memberships (organization_id, family_id, group_id) values ($1, $2, $3)",
        [ORGANIZATION, FAMILY_1, GROUP_2],
      );
      assert.equal(await reach(VIEWERS.adminOther, FAMILY_1), true);
      await db.query(
        "update group_memberships set status = 'ended', ended_at = now() where family_id = $1 and group_id = $2",
        [FAMILY_1, GROUP_2],
      );
      assert.equal(
        await reach(VIEWERS.adminOther, FAMILY_1),
        false,
        "an ended membership gives no reach",
      );
      assert.equal(await countAs(db, schema, CO_PARENT_F1, "children", `id = '${CHILD_F1}'`), 1);
    });

    it("gives no application role a right to write any table, anon no right at all, and the service role nothing", async () => {
      for (const table of DIRECTORY_TABLES) {
        const column = table === "organizations" ? "name" : "organization_id";
        const statements = [
          `insert into ${table} default values`,
          `update ${table} set ${column} = ${column}`,
          `delete from ${table}`,
        ];
        for (const sql of statements) {
          for (const actor of [
            authenticated(SUPER_ADMIN),
            { role: "anon" as const },
            { role: "service_role" as const },
          ]) {
            const failure = await failureOf(() => asActor(db, schema, actor, () => db.query(sql)));
            assert.equal(failure?.code, "42501", `${actor.role} on ${table}: ${sql}`);
          }
        }
        for (const actor of [{ role: "anon" as const }, { role: "service_role" as const }]) {
          const failure = await failureOf(() =>
            asActor(db, schema, actor, () => db.query(`select 1 from ${table}`)),
          );
          assert.equal(failure?.code, "42501", `${actor.role} reads ${table}`);
        }
      }
      const privileges = (
        await db.query(
          `select table_name, grantee, privilege_type from information_schema.role_table_grants
            where table_schema = current_schema() and table_name = any($1) and grantee = 'service_role'`,
          [[...DIRECTORY_TABLES]],
        )
      ).rows;
      assert.deepEqual(privileges, []);
    });
  });
}
