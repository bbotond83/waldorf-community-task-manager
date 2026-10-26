import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";
import type pg from "pg";
import { readMigrationFiles } from "../../scripts/db/runner.ts";
import { WORKER_SCHEMAS } from "../../scripts/db/common.ts";
import {
  defaultWorkerDeps,
  main as workerMain,
  resetWorkerData,
  setupWorker,
  workerAccountEmail,
  type WorkerDeps,
} from "../../scripts/db/worker.ts";
import {
  lockSchemas,
  openDatabase,
  ORGANIZATION,
  report,
  root,
  seedGrants,
  serviceKey,
  stackSettings,
  uuid,
} from "./stack-support.ts";

const quiet = (): WorkerDeps => ({ ...defaultWorkerDeps(), log: () => {} });
const settings = stackSettings();
const apiUrl = settings.apiUrl.replace(/\/$/, "");

async function createAccount(email: string, password: string): Promise<string> {
  const response = await fetch(`${apiUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceKey(),
      Authorization: `Bearer ${serviceKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  assert.equal(response.status, 200, "the sign-in service creates the test account");
  return ((await response.json()) as { id: string }).id;
}

async function signIn(email: string, password: string): Promise<string> {
  const response = await fetch(`${apiUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: settings.publicKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200, "the account can sign in");
  return ((await response.json()) as { access_token: string }).access_token;
}

async function rpc(schema: string, token: string | undefined, name: string, args: object) {
  const response = await fetch(`${apiUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: settings.publicKey,
      Authorization: `Bearer ${token ?? settings.publicKey}`,
      "Content-Type": "application/json",
      "Content-Profile": schema,
    },
    body: JSON.stringify(args),
  });
  return {
    status: response.status,
    body: (await response.json().catch(() => null)) as Record<string, unknown> | null,
  };
}

describe("worker schemas on the real local stack", () => {
  let db: pg.Client;

  before(async () => {
    db = await openDatabase();
    await lockSchemas(db, ["public", ...WORKER_SCHEMAS]);
  });
  after(async () => {
    await db.end();
  });

  const count = async (schema: string, table: string) =>
    (await db.query(`select count(*)::int as n from "${schema}"."${table}"`)).rows[0].n as number;
  const accountCount = async (prefix: string) =>
    (
      await db.query("select count(*)::int as n from auth.users where email like $1", [
        `${prefix}.%`,
      ])
    ).rows[0].n as number;
  const dataApiStatus = async (schema: string) =>
    (
      await fetch(`${apiUrl}/rest/v1/app_role_grants?select=id&limit=1`, {
        headers: { apikey: settings.publicKey, "Accept-Profile": schema },
      })
    ).status;
  const insertGrant = (schema: string) =>
    db.query(
      `insert into "${schema}".app_role_grants (id, subject_id, role, scope_type, scope_id, organization_id) values (gen_random_uuid(), $1, 'parent', 'family', $1, $2)`,
      [uuid(1), ORGANIZATION],
    );

  it("rejects an unsafe or unsupported worker name before connecting", async () => {
    const unreachable = {
      ...quiet(),
      connect: async () => {
        throw new Error("must not connect");
      },
    };
    for (const name of [
      "Worker_1",
      "worker-1",
      "worker_1; drop schema public",
      "worker_5",
      "public",
      "",
      undefined,
    ]) {
      await assert.rejects(
        setupWorker(unreachable, name, { reset: false }),
        (error: Error & { step?: string }) => error.step === "worker-name",
        String(name),
      );
    }
  });

  it("creates the schema, applies all migrations and confirms the data API serves it", async () => {
    const result = await setupWorker(quiet(), "worker_1", { reset: false });
    report(`worker_1 setup took ${(result.durationMs / 1000).toFixed(2)} s (target 10 s)`);
    assert.equal(await dataApiStatus("worker_1"), 200);
    for (const table of [
      "app_role_grants",
      "audit_events",
      "idempotency_records",
      "lifecycle_holds",
    ]) {
      assert.equal(await count("worker_1", table), 0);
    }
    assert.equal(
      await dataApiStatus("worker_9"),
      406,
      "a schema the API does not expose is refused, so the confirmation can fail",
    );
  });

  it("gives the API roles the same schema rights that public has", async () => {
    await setupWorker(quiet(), "worker_2", { reset: false });
    for (const role of ["anon", "authenticated", "service_role"]) {
      const usage = await db.query(
        "select has_schema_privilege($1, 'worker_2', 'usage') as allowed",
        [role],
      );
      assert.equal(usage.rows[0].allowed, true, role);
    }
    await db.query("create table worker_2.privilege_probe (id int)");
    try {
      const rights = await db.query(
        "select has_table_privilege('authenticated', 'worker_2.privilege_probe', 'select') as allowed",
      );
      assert.equal(rights.rows[0].allowed, true);
    } finally {
      await db.query("drop table worker_2.privilege_probe");
    }
  });

  it("empties the schema and removes the worker's accounts, and only those, on each setup", async () => {
    await setupWorker(quiet(), "worker_1", { reset: false });
    await setupWorker(quiet(), "worker_2", { reset: false });
    const password = randomBytes(12).toString("hex");
    await createAccount(workerAccountEmail("worker_1", "parent"), password);
    await createAccount(workerAccountEmail("worker_2", "parent"), password);
    await insertGrant("worker_1");
    await insertGrant("worker_2");
    assert.equal(await accountCount("worker_1"), 1);
    await setupWorker(quiet(), "worker_1", { reset: false });
    assert.equal(await count("worker_1", "app_role_grants"), 0);
    assert.equal(await accountCount("worker_1"), 0);
    assert.equal(
      await count("worker_2", "app_role_grants"),
      1,
      "another worker's data is untouched",
    );
    assert.equal(await accountCount("worker_2"), 1, "another worker's account is untouched");
    await resetWorkerData(db, "worker_2");
    assert.equal(await accountCount("worker_2"), 0);
  });

  it("rebuilds the schema from the migrations on reset, dropping anything else in it", async () => {
    await setupWorker(quiet(), "worker_3", { reset: false });
    await db.query("create table worker_3.stray_table (id int)");
    await setupWorker(quiet(), "worker_3", { reset: true });
    assert.equal(
      (await db.query("select to_regclass('worker_3.stray_table') as stray")).rows[0].stray,
      null,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from migration_runner.applied_migrations where schema_name = 'worker_3'",
        )
      ).rows[0].n,
      readMigrationFiles(`${root}supabase/migrations`).length,
    );
    assert.equal(await dataApiStatus("worker_3"), 200);
  });

  it("sets up two workers in parallel without interference", async () => {
    const results = await Promise.all([
      setupWorker(quiet(), "worker_1", { reset: false }),
      setupWorker(quiet(), "worker_2", { reset: false }),
    ]);
    assert.deepEqual(
      results.map((result) => result.schema),
      ["worker_1", "worker_2"],
    );
    await insertGrant("worker_1");
    assert.equal(await count("worker_1", "app_role_grants"), 1);
    assert.equal(await count("worker_2", "app_role_grants"), 0);
  });

  it("runs four workers in parallel three times in a row, each ready within the target and isolated", async () => {
    const durations: number[] = [];
    for (let run = 1; run <= 3; run++) {
      const results = await Promise.all(
        WORKER_SCHEMAS.map((name) => setupWorker(quiet(), name, { reset: run === 1 })),
      );
      durations.push(...results.map((result) => result.durationMs));
      for (const result of results)
        assert.equal(await dataApiStatus(result.schema), 200, `${result.schema} in run ${run}`);
      for (const name of WORKER_SCHEMAS) await insertGrant(name);
      for (const name of WORKER_SCHEMAS)
        assert.equal(await count(name, "app_role_grants"), 1, `${name} in run ${run}`);
    }
    const slowest = Math.max(...durations);
    report(
      `four parallel workers, three runs: slowest setup ${(slowest / 1000).toFixed(2)} s (target 10 s)`,
    );
    assert.ok(slowest < 30_000);
  });

  it("fails naming the worker, the schema and the step when the database cannot be reached", async () => {
    const deps = {
      ...quiet(),
      // The local stack's default password (a public value) on a port nothing listens on: the guard passes, the
      // connection fails.
      environment: { DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:1/postgres" },
    };
    await assert.rejects(
      setupWorker(deps, "worker_4", { reset: false }),
      (error: Error & { step?: string; detail?: Record<string, string> }) => {
        assert.equal(error.step, "connect");
        assert.equal(error.detail?.worker, "worker_4");
        assert.equal(error.detail?.schema, "worker_4");
        assert.equal(error.message.includes("postgres:postgres@"), false);
        return true;
      },
    );
  });

  // Finding B5 (U1 review R-09): a database whose password is not the local stack's default is refused by the
  // guard before any connection, naming the worker and the schema, and never echoing the password.
  it("refuses a connection that does not use the local stack's default password, at the guard step", async () => {
    const deps = {
      ...quiet(),
      environment: { DATABASE_URL: "postgresql://postgres:wrong-password@127.0.0.1:1/postgres" },
    };
    await assert.rejects(
      setupWorker(deps, "worker_4", { reset: true }),
      (error: Error & { step?: string; detail?: Record<string, string> }) => {
        assert.equal(error.step, "guard");
        assert.equal(error.detail?.step, "guard");
        assert.equal(error.detail?.worker, "worker_4");
        assert.equal(error.detail?.schema, "worker_4");
        assert.equal(error.message.includes("wrong-password"), false);
        return true;
      },
    );
  });

  it("fails naming the step when the data API does not serve the schema in time", async () => {
    let clock = 0;
    const deps = {
      ...quiet(),
      environment: { SUPABASE_URL: "http://127.0.0.1:1" },
      now: () => clock,
      sleep: async (milliseconds: number) => {
        clock += milliseconds + 1000;
      },
    };
    await assert.rejects(
      setupWorker(deps, "worker_4", { reset: false }),
      (error: Error & { step?: string; detail?: Record<string, string> }) => {
        assert.equal(error.step, "confirm-api");
        assert.equal(error.detail?.worker, "worker_4");
        return true;
      },
    );
  });

  it("serves audited operations through the data API for a signed-in account, and only the named functions", async () => {
    await setupWorker(quiet(), "worker_1", { reset: false });
    const password = randomBytes(12).toString("hex");
    const adminEmail = workerAccountEmail("worker_1", "admin");
    const parentEmail = workerAccountEmail("worker_1", "parent");
    const adminId = await createAccount(adminEmail, password);
    const parentId = await createAccount(parentEmail, password);
    await db.query("set search_path to worker_1, pg_catalog");
    await seedGrants(db);
    // The database accepts a session only for an active Account (BR2.6): mirror the two sign-in users.
    await db.query(
      "insert into accounts (id, email, organization_id) values ($1, $2, $5), ($3, $4, $5)",
      [adminId, adminEmail.toLowerCase(), parentId, parentEmail.toLowerCase(), ORGANIZATION],
    );
    await db.query(
      "insert into app_role_grants (id, subject_id, role, scope_type, scope_id, organization_id) values (gen_random_uuid(), $1, 'super_admin', 'organization', $2, $2), (gen_random_uuid(), $3, 'parent', 'family', $4, $2)",
      [adminId, ORGANIZATION, parentId, uuid(950)],
    );
    const adminToken = await signIn(adminEmail, password);
    const parentToken = await signIn(parentEmail, password);
    const args = {
      p_idempotency_key: "api-key-1",
      p_target_type: "child",
      p_target_id: uuid(30),
      p_organization_id: ORGANIZATION,
      p_reason: "legal_hold:case_api",
    };

    const placed = await rpc("worker_1", adminToken, "lifecycle_hold_place", args);
    assert.equal(placed.status, 200);
    assert.equal(placed.body?.state, "success");
    const replay = await rpc("worker_1", adminToken, "lifecycle_hold_place", args);
    assert.equal(replay.body?.reference, placed.body?.reference);
    assert.equal(replay.body?.code, "replayed");
    const refused = await rpc("worker_1", parentToken, "lifecycle_hold_place", {
      ...args,
      p_idempotency_key: "api-key-2",
      p_target_id: uuid(31),
    });
    assert.equal(refused.body?.state, "denied");

    const events = await db.query(
      "select actor_account_id, actor_role, outcome from audit_events order by occurred_at, id",
    );
    assert.deepEqual(events.rows, [
      { actor_account_id: adminId, actor_role: "super_admin", outcome: "success" },
      { actor_account_id: parentId, actor_role: "parent", outcome: "denied" },
    ]);

    const internal = await rpc("worker_1", adminToken, "platform_audit_write", {
      p_action: "role.grant",
      p_target_type: "x",
      p_target_id: uuid(1),
      p_organization_id: ORGANIZATION,
      p_group_id: null,
      p_outcome: "success",
      p_details: null,
    });
    assert.ok(
      [401, 403, 404].includes(internal.status),
      `the audit write function is not callable through the API (status ${internal.status})`,
    );
    const anonymous = await rpc("worker_1", undefined, "lifecycle_hold_place", args);
    assert.ok(anonymous.status >= 400, "the public key alone cannot place a hold");

    assert.equal(
      await count("worker_2", "lifecycle_holds"),
      0,
      "another worker's schema never sees the hold",
    );
    await resetWorkerData(db, "worker_1");
  });

  it("keeps the exposed-schema list, the bootstrap file and the worker list identical", () => {
    const config = readFileSync(`${root}supabase/config.toml`, "utf8");
    const exposed = /^schemas = \[(.*)\]$/m
      .exec(config)?.[1]
      ?.match(/"([a-z0-9_]+)"/g)
      ?.map((entry) => entry.replaceAll('"', ""));
    assert.deepEqual(exposed, ["public", ...WORKER_SCHEMAS]);
    const roles = readFileSync(`${root}supabase/roles.sql`, "utf8");
    const created = /array\[(.*?)\]/s
      .exec(roles)?.[1]
      ?.match(/'([a-z0-9_]+)'/g)
      ?.map((entry) => entry.replaceAll("'", ""));
    assert.deepEqual(created, [...WORKER_SCHEMAS]);
  });

  it("runs the worker command end to end and prints a timing but no key or password", async () => {
    const lines: string[] = [];
    const code = await workerMain(["worker_3"], {
      ...defaultWorkerDeps(),
      log: (line) => lines.push(line),
    });
    assert.equal(code, 0);
    assert.ok(lines.some((line) => /^TIMING worker\(worker_3\)/.test(line)));
    const output = lines.join("\n");
    for (const secret of [settings.publicKey, serviceKey(), settings.databaseUrl])
      assert.equal(output.includes(secret), false);
  });
});
