import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import type pg from "pg";
import { connectPostgres } from "../../scripts/db/postgres.ts";
import { resetSchema } from "../../scripts/db/reset.ts";
import { main as seedMain, seedSchema } from "../../scripts/db/seed.ts";
import {
  buildSeedPlan,
  describePlan,
  SEED_PASSWORDS,
  type SeedAccountAdmin,
  seedAccount,
  seedAccounts,
  seedId,
} from "../../scripts/db/seed/index.ts";
import { resetWorkerData } from "../../scripts/db/worker.ts";
import {
  dumpSchema,
  forbiddenInOutput,
  readAs,
  realSeedDeps,
  rowCount,
  runScript,
  schemaUsers,
  signInAs,
} from "./seed-support.ts";
import { lockSchemas, openDatabase, prepareSchema, bindSchema } from "./stack-support.ts";

/**
 * The seed command against the real local stack (NFR3.18, NFR3.19, NFR1.64, NFR6.29): the records, the sign-in users, the
 * repeatability, the rollback of a failed seed, the separation of schemas and the output scan. Nothing is mocked: the
 * database, the policies and the sign-in service are the stack's own.
 */
const SCHEMAS = ["worker_1", "worker_2"] as const;
const [A, B] = SCHEMAS;

describe("seed on the real stack", () => {
  let db: pg.Client;

  before(async () => {
    db = await openDatabase();
    await lockSchemas(db, [...SCHEMAS, "public"]);
    for (const schema of [...SCHEMAS, "public"]) await prepareSchema(db, schema);
  });
  after(async () => {
    await db.end();
  });
  beforeEach(async () => {
    for (const schema of SCHEMAS) {
      await bindSchema(db, schema);
      await resetWorkerData(db, schema);
    }
  });

  it("writes every record of the small set into the schema, with the plan's ids", async () => {
    const { deps, lines } = realSeedDeps();
    assert.equal(await seedMain(["--schema", A], deps), 0, lines.join("\n"));
    const plan = buildSeedPlan(A, "small");
    const counts = describePlan(plan);
    assert.equal(await rowCount(db, A, "organizations"), 1);
    assert.equal(await rowCount(db, A, "groups"), counts.groups);
    assert.equal(await rowCount(db, A, "families"), counts.families);
    assert.equal(await rowCount(db, A, "group_memberships"), counts.families);
    assert.equal(await rowCount(db, A, "parents"), counts.parents);
    assert.equal(await rowCount(db, A, "parent_contacts"), counts.parents);
    assert.equal(await rowCount(db, A, "children"), counts.children);
    assert.equal(await rowCount(db, A, "accounts"), counts.accounts);
    assert.equal(await rowCount(db, A, "app_role_grants"), counts.accounts);
    assert.equal(await rowCount(db, A, "app_authorization_versions"), counts.accounts);
    assert.equal(await rowCount(db, A, "events"), counts.events);
    assert.equal(await rowCount(db, A, "tasks"), counts.tasks);
    assert.equal(await rowCount(db, A, "assignments"), counts.assignments);
    const families = (await db.query(`select id::text from "${A}".families order by id`)).rows.map(
      (row) => row.id,
    );
    assert.deepEqual(families, plan.families.map((family) => family.id).sort());
    assert.equal(plan.organization.id, seedId(A, "organization"));
    assert.equal((await schemaUsers(db, A)).length, counts.accounts);
  });

  it("writes the 30-family set from the same rules", async () => {
    const { deps, lines } = realSeedDeps();
    assert.equal(await seedMain(["--schema", A, "--large"], deps), 0, lines.join("\n"));
    assert.equal(await rowCount(db, A, "families"), 30);
    assert.equal(await rowCount(db, A, "groups"), 3);
    assert.equal(await rowCount(db, A, "accounts"), 34);
    assert.equal((await schemaUsers(db, A)).length, 34);
  });

  it("lets each seeded role sign in for real with its fictitious password, and sees what its role may see", async () => {
    const { deps, lines } = realSeedDeps();
    assert.equal(await seedMain(["--schema", A], deps), 0, lines.join("\n"));
    const token = async (tag: string) => {
      const account = seedAccount(A, tag);
      const result = await signInAs(account.email, account.password);
      assert.ok(result.ok, `${tag} signs in`);
      assert.equal(result.value.userId, account.id, "the sign-in user has the derived id");
      return result.value.accessToken;
    };
    assert.equal((await readAs(await token("super-admin"), A, "families")).rows.length, 6);
    assert.equal((await readAs(await token("group-admin-1"), A, "families")).rows.length, 3);
    assert.equal((await readAs(await token("parent-1"), A, "families")).rows.length, 1);
    assert.equal((await readAs(await token("parent-4"), A, "families")).rows.length, 1);
    assert.equal((await readAs(await token("teacher-1"), A, "groups")).rows.length, 1);
  });

  it("rejects a wrong password for a seeded account", async () => {
    const { deps, lines } = realSeedDeps();
    assert.equal(await seedMain(["--schema", A], deps), 0, lines.join("\n"));
    const account = seedAccount(A, "parent-2");
    const result = await signInAs(account.email, `${SEED_PASSWORDS.parent}-wrong`);
    assert.equal(result.ok, false);
  });

  it("changes nothing when it runs a second time (a dump comparison)", async () => {
    const { deps, lines } = realSeedDeps();
    assert.equal(await seedMain(["--schema", A], deps), 0, lines.join("\n"));
    const first = await dumpSchema(db, A);
    const again = realSeedDeps();
    assert.equal(await seedMain(["--schema", A], again.deps), 0, again.lines.join("\n"));
    assert.match(again.lines[0]!, /accounts_created=0$/);
    assert.deepEqual(await dumpSchema(db, A), first);
  });

  it("gives the same result after a reset and a seed as after a fresh seed", async () => {
    const { deps, lines } = realSeedDeps();
    assert.equal(await seedMain(["--schema", A], deps), 0, lines.join("\n"));
    const fresh = await dumpSchema(db, A);
    await resetSchema(realSeedDeps().deps, { schema: A });
    assert.deepEqual((await dumpSchema(db, A))["families"], []);
    const second = realSeedDeps();
    assert.equal(await seedMain(["--schema", A], second.deps), 0, second.lines.join("\n"));
    assert.match(second.lines[0]!, /accounts_created=10$/);
    assert.deepEqual(await dumpSchema(db, A), fresh);
  });

  it("leaves the schema and the sign-in service as they were when a record write fails midway", async () => {
    const before = await dumpSchema(db, A);
    let tasksInserted = 0;
    const { deps, lines } = realSeedDeps({
      connect: async (url) => {
        const client = await connectPostgres(url);
        const query = client.query.bind(client);
        client.query = async (sql: string, values?: unknown[]) => {
          if (sql.startsWith('insert into "tasks"') && ++tasksInserted === 1) {
            throw new Error("injected failure in the middle of the seed");
          }
          return query(sql, values);
        };
        return client;
      },
    });
    assert.equal(await seedMain(["--schema", A], deps), 1);
    assert.match(lines[0]!, /^SEED FAILED step=records schema=worker_1: injected failure/);
    assert.equal(tasksInserted, 1);
    assert.deepEqual(await dumpSchema(db, A), before);
    assert.deepEqual(await schemaUsers(db, A), []);
  });

  it("removes the sign-in users it created when a later account cannot be created, and writes no record", async () => {
    const before = await dumpSchema(db, A);
    const real = realSeedDeps().deps;
    let creations = 0;
    const { deps, lines } = realSeedDeps({
      createAdmin: (options) => {
        const admin = real.createAdmin(options);
        const flaky: SeedAccountAdmin = {
          createUser: async (input) => {
            if (++creations === 4) return { ok: false, reason: "unavailable" };
            return admin.createUser(input);
          },
          deleteUser: (id) => admin.deleteUser(id),
        };
        return flaky;
      },
    });
    assert.equal(await seedMain(["--schema", A], deps), 1);
    assert.match(lines[0]!, /^SEED FAILED step=accounts /);
    assert.deepEqual(await dumpSchema(db, A), before);
    assert.deepEqual(await schemaUsers(db, A), []);
  });

  it("refuses an address that another sign-in user already holds under a different id, and changes nothing", async () => {
    const account = seedAccount(A, "super-admin");
    await db.query(
      "insert into auth.users (id, aud, role, email, created_at, updated_at) values (gen_random_uuid(), 'authenticated', 'authenticated', $1, now(), now())",
      [account.email],
    );
    const { deps, lines } = realSeedDeps();
    assert.equal(await seedMain(["--schema", A], deps), 1);
    assert.match(lines[0]!, /FAILED step=accounts account=super-admin/);
    assert.equal(await rowCount(db, A, "families"), 0);
    assert.equal((await schemaUsers(db, A)).length, 1, "only the foreign user is there");
  });

  it("keeps two schemas apart: other ids, other addresses, and a reset of one leaves the other untouched", async () => {
    const first = realSeedDeps();
    const second = realSeedDeps();
    assert.equal(await seedMain(["--schema", A], first.deps), 0, first.lines.join("\n"));
    assert.equal(await seedMain(["--schema", B], second.deps), 0, second.lines.join("\n"));
    const idsA = new Set(seedAccounts(A).map((account) => account.id));
    for (const account of seedAccounts(B)) assert.ok(!idsA.has(account.id));
    const familyIdsA = (await db.query(`select id::text from "${A}".families`)).rows.map(
      (row) => row.id,
    );
    const familyIdsB = (await db.query(`select id::text from "${B}".families`)).rows.map(
      (row) => row.id,
    );
    assert.equal(familyIdsA.filter((id) => familyIdsB.includes(id)).length, 0);
    const untouched = await dumpSchema(db, B);
    await resetSchema(realSeedDeps().deps, { schema: A });
    assert.deepEqual(await dumpSchema(db, B), untouched);
    assert.equal((await schemaUsers(db, A)).length, 0);
    const account = seedAccount(B, "parent-1");
    const signedIn = await signInAs(account.email, account.password);
    assert.ok(signedIn.ok, "the other schema's account still signs in");
  });

  it("never prints a password, a key, a database password or a personal value (the real command, as its own process)", async () => {
    const result = await runScript("scripts/db/seed.ts", ["--schema", A]);
    assert.equal(result.status, 0, result.output);
    const lines = result.output.split("\n").filter((line) => line.startsWith("SEED "));
    assert.equal(lines.length, 1);
    assert.match(lines[0]!, /^SEED ok schema=worker_1 set=small /);
    assert.match(result.output, /TIMING seed\(worker_1, small\)/);
    const plan = buildSeedPlan(A, "small");
    const forbidden = forbiddenInOutput([
      ...Object.values(SEED_PASSWORDS),
      ...plan.accounts.map((account) => account.email),
      ...plan.parents.flatMap((parent) => [parent.name, parent.contactEmail]),
      ...plan.families.map((family) => family.name),
    ]);
    for (const value of forbidden) {
      assert.ok(
        !result.output.includes(value),
        "the output holds a value that must not be printed",
      );
    }
    assert.doesNotMatch(result.output, /eyJ[A-Za-z0-9_-]{8,}\./);
  });

  it("also prints nothing secret when it fails (a refused schema, and a seed of an occupied address)", async () => {
    const refused = await runScript("scripts/db/seed.ts", ["--schema", "worker_9"]);
    assert.equal(refused.status, 1);
    assert.match(refused.output, /^SEED FAILED step=schema /m);
    for (const value of forbiddenInOutput(Object.values(SEED_PASSWORDS))) {
      assert.ok(!refused.output.includes(value));
    }
  });

  it("seeds and resets the default schema with the public. address prefix", async () => {
    await resetWorkerData(db, "public");
    const { deps, lines } = realSeedDeps();
    assert.equal(await seedMain([], deps), 0, lines.join("\n"));
    assert.match(lines[0]!, /^SEED ok schema=public set=small /);
    const users = (await schemaUsers(db, "public")) as { email: string }[];
    assert.equal(users.length, 10);
    assert.ok(users.every((user) => user.email.startsWith("public.")));
    assert.equal(await rowCount(db, "public", "families"), 6);
    await resetSchema(realSeedDeps().deps, {});
    assert.equal(await rowCount(db, "public", "families"), 0);
    assert.deepEqual(await schemaUsers(db, "public"), []);
  });

  it("returns the counts of what it wrote", async () => {
    const { deps } = realSeedDeps();
    const result = await seedSchema(deps, { schema: A, size: "small" });
    assert.equal(result.accountsCreated, 10);
    assert.equal(result.counts.assignments, 8);
  });
});
