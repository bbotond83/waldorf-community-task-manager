import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { root } from "./stack-support.ts";
import {
  ADMIN_G1,
  ADMIN_G2,
  asActor,
  auditEvents,
  authenticated,
  count,
  FAMILY_1,
  failureOf,
  GROUP_1,
  GROUP_2,
  IDENTITY_SCHEMAS,
  openIdentityDatabase,
  ORGANIZATION,
  OUTSIDER,
  PARENT_F1,
  seedIdentityWorld,
  SUPER_ADMIN,
  tokenHashFor,
  uuid,
} from "./identity-support.ts";

/** Schema, constraints, indexes, column rights, the audit read policy and the service-role limits (BR2.13 to BR2.23). */
for (const schema of IDENTITY_SCHEMAS) {
  describe(`identity schema in ${schema}`, () => {
    let db: pg.Client;

    before(async () => {
      db = await openIdentityDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedIdentityWorld(db, schema);
    });

    const insertInvitation = (overrides: Record<string, unknown> = {}) => {
      const row = {
        email: "invited@example.test",
        role: "parent",
        scope_type: "family",
        scope_id: FAMILY_1,
        organization_id: ORGANIZATION,
        token_hash: tokenHashFor(`schema-${Math.random()}`),
        status: "pending",
        created_by_account_id: SUPER_ADMIN,
        ...overrides,
      };
      const columns = Object.keys(row);
      return db.query(
        `insert into invitations (${columns.join(", ")}) values (${columns.map((_, index) => `$${index + 1}`).join(", ")}) returning id`,
        Object.values(row),
      );
    };

    it("keeps accounts unique by lower-cased address and refuses an unknown status", async () => {
      const duplicate = await failureOf(() =>
        db.query("insert into accounts (id, email, organization_id) values ($1, $2, $3)", [
          uuid(7001),
          "identity." + PARENT_F1 + "@example.test",
          ORGANIZATION,
        ]),
      );
      assert.equal(duplicate?.code, "23505");
      const upper = await failureOf(() =>
        db.query(
          "insert into accounts (id, email, organization_id) values ($1, 'Upper@Example.test', $2)",
          [uuid(7002), ORGANIZATION],
        ),
      );
      assert.equal(upper?.code, "23514");
      const status = await failureOf(() =>
        db.query("update accounts set status = 'locked' where id = $1", [PARENT_F1]),
      );
      assert.equal(status?.code, "23514");
    });

    it("raises the account version on every change", async () => {
      const before = (await db.query("select version from accounts where id = $1", [PARENT_F1]))
        .rows[0].version;
      await db.query("update accounts set status = 'deactivated' where id = $1", [PARENT_F1]);
      const after = (await db.query("select version from accounts where id = $1", [PARENT_F1]))
        .rows[0].version;
      assert.equal(after, before + 1);
    });

    it("pairs invitation roles with scope types like grants do", async () => {
      for (const bad of [
        { role: "parent", scope_type: "group" },
        { role: "kindergarten_teacher", scope_type: "family" },
        { role: "kindergarten_teacher", scope_type: "group", scope_id: GROUP_1 },
        { role: "group_admin", scope_type: "group", scope_id: GROUP_1 },
        { role: "super_admin", scope_type: "organization", scope_id: GROUP_1 },
        { role: "teacher", scope_type: "group" },
      ]) {
        const error = await failureOf(() => insertInvitation(bad));
        assert.equal(error?.code, "23514", JSON.stringify(bad));
      }
      await insertInvitation({
        role: "super_admin",
        scope_type: "organization",
        scope_id: ORGANIZATION,
      });
      await insertInvitation({
        email: "teacher@example.test",
        role: "kindergarten_teacher",
        scope_type: "organization",
        scope_id: ORGANIZATION,
      });
    });

    it("allows one open invitation per email, role and scope, and a new one after it ends", async () => {
      const first = await insertInvitation();
      const duplicate = await failureOf(() => insertInvitation());
      assert.equal(duplicate?.code, "23505");
      await db.query(
        "update invitations set status = 'accepting', reserved_at = now() where id = $1",
        [first.rows[0].id],
      );
      assert.equal(
        (await failureOf(() => insertInvitation()))?.code,
        "23505",
        "accepting is still open",
      );
      for (const ended of ["revoked", "replaced", "accepted"]) {
        await db.query("update invitations set status = $2 where id = $1", [
          first.rows[0].id,
          ended,
        ]);
        await insertInvitation().then((row) =>
          db.query("update invitations set status = 'revoked' where id = $1", [row.rows[0].id]),
        );
      }
      assert.ok((await count(db, "invitations")) >= 2);
    });

    it("stores a token hash once, in hexadecimal, and defaults the expiry to seven days", async () => {
      assert.equal(
        (await failureOf(() => insertInvitation({ token_hash: "not-a-hash" })))?.code,
        "23514",
      );
      const hash = tokenHashFor("unique");
      await insertInvitation({ token_hash: hash });
      assert.equal(
        (await failureOf(() => insertInvitation({ email: "other@example.test", token_hash: hash })))
          ?.code,
        "23505",
      );
      const row = (
        await db.query(
          "select extract(epoch from expires_at - created_at) as seconds, version, status from invitations",
        )
      ).rows[0];
      assert.equal(Number(row.seconds), 7 * 24 * 3600);
      assert.equal(row.status, "pending");
    });

    it("never lets an application role select the token hash column", async () => {
      await insertInvitation();
      const allowed = await asActor(
        db,
        schema,
        authenticated(SUPER_ADMIN),
        async () =>
          (await db.query("select id, email, role, status, expires_at from invitations")).rows,
      );
      assert.equal(allowed.length, 1);
      for (const statement of ["select token_hash from invitations", "select * from invitations"]) {
        const error = await failureOf(() =>
          asActor(db, schema, authenticated(SUPER_ADMIN), () => db.query(statement)),
        );
        assert.equal(error?.code, "42501", statement);
      }
      const grants = await db.query(
        "select count(*)::int as n from information_schema.column_privileges where table_schema = current_schema() and table_name = 'invitations' and column_name = 'token_hash' and grantee in ('authenticated', 'anon', 'service_role', 'public')",
      );
      assert.equal(grants.rows[0].n, 0);
    });

    it("gives application roles no access at all to sign-in attempts and no write right on identity tables", async () => {
      for (const role of ["anon", "authenticated", "service_role"]) {
        for (const privilege of ["select", "insert", "update", "delete"]) {
          assert.equal(
            (
              await db.query("select has_table_privilege($1, 'sign_in_attempts', $2) as allowed", [
                role,
                privilege,
              ])
            ).rows[0].allowed,
            false,
            `${role} ${privilege}`,
          );
        }
        for (const table of [
          "accounts",
          "invitations",
          "app_role_grants",
          "app_authorization_versions",
        ]) {
          for (const privilege of ["insert", "update", "delete"]) {
            assert.equal(
              (
                await db.query("select has_table_privilege($1, $2::regclass, $3) as allowed", [
                  role,
                  table,
                  privilege,
                ])
              ).rows[0].allowed,
              false,
              `${role} ${privilege} ${table}`,
            );
          }
        }
      }
      assert.equal(
        (await db.query("select has_table_privilege('anon', 'accounts', 'select') as a")).rows[0].a,
        false,
      );
    });

    it("generates grant ids, records when a grant was made and keeps one active grant per scope", async () => {
      const row = (
        await db.query("select id, granted_at, granted_by_account_id from app_role_grants limit 1")
      ).rows[0];
      assert.ok(row.id);
      assert.ok(row.granted_at);
      const duplicate = await failureOf(() =>
        db.query(
          "insert into app_role_grants (subject_id, role, scope_type, scope_id, organization_id) values ($1, 'parent', 'family', $2, $3)",
          [PARENT_F1, FAMILY_1, ORGANIZATION],
        ),
      );
      assert.equal(duplicate?.code, "23505");
      await db.query(
        "update app_role_grants set revoked_at = now() where subject_id = $1 and scope_id = $2",
        [PARENT_F1, FAMILY_1],
      );
      await db.query(
        "insert into app_role_grants (subject_id, role, scope_type, scope_id, organization_id) values ($1, 'parent', 'family', $2, $3)",
        [PARENT_F1, FAMILY_1, ORGANIZATION],
      );
      const pairing = await failureOf(() =>
        db.query(
          "insert into app_role_grants (subject_id, role, scope_type, scope_id, organization_id) values ($1, 'parent', 'group', $2, $3)",
          [PARENT_F1, GROUP_1, ORGANIZATION],
        ),
      );
      assert.equal(pairing?.code, "23514");
    });

    it("accepts the two new audit actions and refuses unknown ones", async () => {
      for (const action of ["account.deactivate", "account.reactivate"]) {
        await db.query(
          "insert into audit_events (actor_account_id, actor_role, action, target_type, target_id, organization_id, outcome) values ($1, 'super_admin', $2, 'account', $3, $4, 'success')",
          [SUPER_ADMIN, action, PARENT_F1, ORGANIZATION],
        );
      }
      const error = await failureOf(() =>
        db.query(
          "insert into audit_events (actor_account_id, actor_role, action, target_type, target_id, organization_id, outcome) values ($1, 'super_admin', 'account.delete', 'account', $2, $3, 'success')",
          [SUPER_ADMIN, PARENT_F1, ORGANIZATION],
        ),
      );
      assert.equal(error?.code, "23514");
    });

    it("lets a super admin read the organization's audit events and a group admin only those of their group", async () => {
      const insert = (group: string | null, organization = ORGANIZATION) =>
        db.query(
          "insert into audit_events (actor_account_id, actor_role, action, target_type, target_id, organization_id, group_id, outcome) values ($1, 'super_admin', 'role.grant', 'account', $2, $3, $4, 'success')",
          [SUPER_ADMIN, PARENT_F1, organization, group],
        );
      await insert(GROUP_1);
      await insert(GROUP_2);
      await insert(null);
      await insert(null, "aaaaaaaa-0000-4000-8000-0000000000ff");
      const read = (account: string) =>
        asActor(db, schema, authenticated(account), async () =>
          (
            await db.query("select group_id from audit_events order by group_id nulls last")
          ).rows.map((row) => row.group_id),
        );
      assert.equal((await read(SUPER_ADMIN)).length, 3);
      assert.deepEqual(await read(ADMIN_G1), [GROUP_1]);
      assert.deepEqual(await read(ADMIN_G2), [GROUP_2]);
      assert.deepEqual(await read(PARENT_F1), []);
      assert.deepEqual(await read(OUTSIDER), []);
      const write = await failureOf(() =>
        asActor(db, schema, authenticated(SUPER_ADMIN), () =>
          db.query(
            "insert into audit_events (actor_account_id, actor_role, action, target_type, target_id, organization_id, outcome) values ($1, 'super_admin', 'role.grant', 'account', $1, $2, 'success')",
            [SUPER_ADMIN, ORGANIZATION],
          ),
        ),
      );
      assert.equal(write?.code, "42501");
      assert.equal((await auditEvents(db)).length, 4);
    });

    it("gives the service role no right on any table or sequence of the schema", async () => {
      const tables = (
        await db.query(
          "select c.relname from pg_class c where c.relnamespace = current_schema()::regnamespace and c.relkind in ('r', 'p', 'v', 'm', 'f') order by 1",
        )
      ).rows.map((row) => String(row.relname));
      assert.ok(tables.length >= 10, "the schema has its tables");
      for (const table of tables) {
        for (const privilege of [
          "select",
          "insert",
          "update",
          "delete",
          "truncate",
          "references",
          "trigger",
        ]) {
          assert.equal(
            (
              await db.query(
                "select has_table_privilege('service_role', $1::regclass, $2) as allowed",
                [table, privilege],
              )
            ).rows[0].allowed,
            false,
            `service_role ${privilege} ${table}`,
          );
        }
      }
      const sequences = (
        await db.query(
          "select c.relname from pg_class c where c.relnamespace = current_schema()::regnamespace and c.relkind = 'S'",
        )
      ).rows;
      for (const sequence of sequences) {
        assert.equal(
          (
            await db.query(
              "select has_sequence_privilege('service_role', $1::regclass, 'usage') as allowed",
              [sequence.relname],
            )
          ).rows[0].allowed,
          false,
        );
      }
    });

    it("drops the superseded first-migration audit table because nothing in the catalogue uses it (BR2.22)", async () => {
      assert.equal((await db.query("select to_regclass('app_audit_events') as t")).rows[0].t, null);
      const uses = await db.query(
        "select count(*)::int as n from pg_proc where pronamespace = current_schema()::regnamespace and prosrc ilike '%app_audit_events%'",
      );
      assert.equal(uses.rows[0].n, 0);
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from pg_policies where schemaname = current_schema() and (coalesce(qual, '') ilike '%app_audit_events%' or coalesce(with_check, '') ilike '%app_audit_events%')",
          )
        ).rows[0].n,
        0,
      );
    });
  });
}

/** Files that may mention the superseded table: the migrations that create, convert and drop it, and their tests. */
const MAY_MENTION_AUDIT_TABLE = new Set([
  "supabase/migrations/20260806_access_rls.sql",
  "supabase/migrations/20261006_current_roles.sql",
  "supabase/migrations/20261019_identity_privileges.sql",
  "tests/database/current-role-migration.test.ts",
  "tests/database/fixtures/current-role-baseline.sql",
  "tests/database/identity-schema.test.ts",
]);

function listFiles(directory: string, found: string[] = []): string[] {
  for (const name of readdirSync(directory)) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".git")) continue;
    const path = `${directory}/${name}`;
    if (statSync(path).isDirectory()) listFiles(path, found);
    else if (/\.(ts|tsx|sql|json|mjs)$/.test(name)) found.push(path);
  }
  return found;
}

describe("superseded audit table references (BR2.22)", () => {
  it("is mentioned by no source file outside the migrations that create and drop it and their tests", () => {
    const offenders = ["src", "app", "scripts", "tests", "supabase"]
      .flatMap((folder) => listFiles(`${root}${folder}`))
      .map((path) => path.slice(root.length))
      .filter((path) => !MAY_MENTION_AUDIT_TABLE.has(path))
      .filter((path) => readFileSync(`${root}${path}`, "utf8").includes("app_audit_events"));
    assert.deepEqual(offenders, []);
  });
});
