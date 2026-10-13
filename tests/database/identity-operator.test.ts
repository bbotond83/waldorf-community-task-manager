import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import pg from "pg";
import { createAdminAccess } from "../../src/identity/admin-client.ts";
import { main } from "../../scripts/db/first-super-admin.ts";
import type { Terminal } from "../../scripts/db/terminal.ts";
import {
  auditEvents,
  count,
  IDENTITY_SCHEMAS,
  openIdentityDatabase,
  ORGANIZATION,
  seedIdentityWorld,
} from "./identity-support.ts";
import { openDatabase, serviceKey, stackSettings } from "./stack-support.ts";

const settings = stackSettings();
const apiUrl = settings.apiUrl.replace(/\/$/, "");

/** The sign-in user of an address, read through the sign-in service's admin interface. */
async function findUser(address: string): Promise<{ id: string } | undefined> {
  const response = await fetch(
    `${apiUrl}/auth/v1/admin/users?filter=${encodeURIComponent(address)}`,
    {
      headers: { apikey: serviceKey(), Authorization: `Bearer ${serviceKey()}` },
    },
  );
  const body = (await response.json()) as { users: { id: string; email: string }[] };
  return body.users.find((user) => user.email === address);
}

async function signIn(address: string, password: string): Promise<number> {
  const response = await fetch(`${apiUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: settings.publicKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: address, password }),
  });
  return response.status;
}

/** The first-super-admin command against the real stack, with a typed (scripted) terminal. */
for (const schema of IDENTITY_SCHEMAS) {
  describe(`first super admin command in ${schema}`, () => {
    let db: pg.Client;
    const newOrganization = "aaaaaaaa-0000-4000-8000-0000000000e1";
    const address = (tag: string) => `${schema}.${tag}@example.test`;
    const password = () => `Pw-${randomBytes(6).toString("hex")}-1`;

    before(async () => {
      db = await openIdentityDatabase(schema);
    });
    after(async () => {
      await db.end();
    });
    beforeEach(async () => {
      await seedIdentityWorld(db, schema);
    });

    const terminal = (secret: string, host = "127.0.0.1"): Terminal => ({
      ask: async () => host,
      askSecret: async () => secret,
    });

    async function run(
      email: string,
      secret: string,
      options: {
        host?: string;
        organization?: string;
        terminal?: Terminal;
        /** The connection drops right after the account was committed: the answer never arrives. */
        dropAfterCommit?: boolean;
        /** Every later connection (the proof check) fails too. */
        refuseLaterConnections?: boolean;
      } = {},
    ) {
      const lines: string[] = [];
      let connections = 0;
      const client = await openDatabase();
      try {
        const code = await main(
          [
            "--organization",
            options.organization ?? newOrganization,
            "--email",
            email,
            "--schema",
            schema,
          ],
          {
            connect: async () => {
              connections += 1;
              if (connections > 1) {
                if (options.refuseLaterConnections) throw new Error("connection refused");
                return (await openDatabase()) as never;
              }
              if (!options.dropAfterCommit) return client as never;
              return {
                query: async (sql: string, values?: unknown[]) => {
                  const result = await client.query(sql, values);
                  if (sql.includes("operator_first_super_admin"))
                    throw new Error("connection terminated");
                  return result;
                },
                end: () => client.end(),
              } as never;
            },
            createAdmin: createAdminAccess,
            terminal: options.terminal ?? terminal(secret, options.host),
            readFile: () => undefined,
            environment: {
              DATABASE_URL: settings.databaseUrl,
              SUPABASE_URL: apiUrl,
              SUPABASE_SERVICE_ROLE_KEY: serviceKey(),
            },
            log: (line) => lines.push(line),
          },
        );
        return { code, text: lines.join("\n") };
      } finally {
        // main() ends the connection it was given.
      }
    }

    it("creates the sign-in user, the Account, the organization grant and the version row, writes the event, and the person can sign in", async () => {
      const email = address("first");
      const secret = password();
      const result = await run(email, secret);
      assert.equal(result.code, 0, result.text);
      const user = await findUser(email);
      assert.ok(user);
      const account = (
        await db.query("select id, email, organization_id, status from accounts where email = $1", [
          email,
        ])
      ).rows[0];
      assert.deepEqual(
        { ...account, id: undefined },
        { id: undefined, email, organization_id: newOrganization, status: "active" },
      );
      assert.equal(account.id, user.id);
      const grant = (
        await db.query(
          "select role, scope_type, scope_id, organization_id, granted_by_account_id, revoked_at from app_role_grants where subject_id = $1",
          [user.id],
        )
      ).rows;
      assert.deepEqual(grant, [
        {
          role: "super_admin",
          scope_type: "organization",
          scope_id: newOrganization,
          organization_id: newOrganization,
          granted_by_account_id: null,
          revoked_at: null,
        },
      ]);
      assert.equal(
        (
          await db.query(
            "select authorization_version from app_authorization_versions where subject_id = $1",
            [user.id],
          )
        ).rows[0].authorization_version,
        1,
      );
      const [event] = (await auditEvents(db)).filter(
        (entry) => entry.action === "role.first_super_admin",
      );
      assert.deepEqual(
        [
          event!.actor_account_id,
          event!.actor_role,
          event!.target_id,
          event!.organization_id,
          event!.outcome,
        ],
        ["00000000-0000-0000-0000-000000000000", "system", user.id, newOrganization, "success"],
      );
      assert.equal(await signIn(email, secret), 200, "the typed password signs in");
      assert.equal(result.text.includes(secret), false);
    });

    it("refuses when the organization already has an active super admin and creates no sign-in user", async () => {
      const email = address("second");
      const result = await run(email, password(), { organization: ORGANIZATION });
      assert.equal(result.code, 1);
      assert.match(result.text, /already has an active super admin/);
      assert.equal(await findUser(email), undefined);
    });

    it("refuses a host that does not match and a password that breaks the rule, creating nothing", async () => {
      const wrongHost = await run(address("host"), password(), { host: "localhost" });
      assert.equal(wrongHost.code, 1);
      assert.match(wrongHost.text, /does not match/);
      const weak = await run(address("weak"), "short");
      assert.equal(weak.code, 1);
      assert.match(weak.text, /step=password/);
      assert.equal(await findUser(address("host")), undefined);
      assert.equal(await findUser(address("weak")), undefined);
      assert.equal(await count(db, "accounts", `organization_id = '${newOrganization}'`), 0);
    });

    it("removes the new sign-in user and leaves nothing behind when a step fails (injected failure)", async () => {
      const email = address("injected");
      await db.query(
        "create function fail_account_insert() returns trigger language plpgsql as $$ begin raise exception 'injected failure'; end $$",
      );
      await db.query(
        "create trigger inject_account_failure before insert on accounts for each row execute function fail_account_insert()",
      );
      try {
        const result = await run(email, password());
        assert.equal(result.code, 1);
        assert.match(result.text, /step=create-account/);
        assert.match(result.text, /removed/);
      } finally {
        await db.query("drop trigger inject_account_failure on accounts");
        await db.query("drop function fail_account_insert()");
      }
      assert.equal(await findUser(email), undefined);
      assert.equal(await count(db, "accounts", `email = '${email}'`), 0);
      assert.equal(await count(db, "app_role_grants", `organization_id = '${newOrganization}'`), 0);
      assert.equal(
        (await auditEvents(db)).filter((entry) => entry.action === "role.first_super_admin").length,
        0,
      );
    });

    it("keeps the new sign-in user when the connection dropped after the account was committed (never an Account without its user)", async () => {
      const email = address("dropped");
      const secret = password();
      const result = await run(email, secret, { dropAfterCommit: true });
      assert.equal(result.code, 1);
      assert.match(result.text, /account exists, so the sign-in user .* was kept/);
      const user = await findUser(email);
      assert.ok(user, "the sign-in user is still there");
      assert.equal(await count(db, "accounts", `id = '${user.id}'`), 1);
      assert.equal(await signIn(email, secret), 200);
    });

    it("keeps the new sign-in user when the existence check gets no answer either", async () => {
      const email = address("blind");
      const result = await run(email, password(), {
        dropAfterCommit: true,
        refuseLaterConnections: true,
      });
      assert.equal(result.code, 1);
      assert.match(result.text, /could not confirm whether the account exists/);
      assert.ok(await findUser(email));
      assert.equal(await count(db, "accounts", `email = '${email}'`), 1);
    });

    it("lets only one of two simultaneous runs for the same organization succeed, and removes the other's sign-in user", async () => {
      const first = address("race-a");
      const second = address("race-b");
      const [a, b] = await Promise.all([run(first, password()), run(second, password())]);
      assert.deepEqual([a.code, b.code].sort(), [0, 1]);
      const winner = a.code === 0 ? first : second;
      const loser = a.code === 0 ? second : first;
      assert.ok(await findUser(winner));
      assert.equal(await findUser(loser), undefined, "the loser's sign-in user is removed");
      assert.equal(
        await count(
          db,
          "app_role_grants",
          `organization_id = '${newOrganization}' and role = 'super_admin' and revoked_at is null`,
        ),
        1,
      );
      assert.equal(await count(db, "accounts", `organization_id = '${newOrganization}'`), 1);
    });

    it("refuses the function itself to every role except the schema owner", async () => {
      for (const role of ["anon", "authenticated", "service_role"]) {
        await db.query("begin");
        try {
          await db.query(`set local search_path to "${schema}", pg_catalog`);
          await db.query(`set local role ${role}`);
          await assert.rejects(
            () =>
              db.query("select operator_first_super_admin($1, $2, 'x@example.test')", [
                newOrganization,
                ORGANIZATION,
              ]),
            { code: "42501" },
            role,
          );
        } finally {
          await db.query("rollback");
        }
      }
    });
  });
}
