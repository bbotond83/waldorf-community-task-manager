import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { QueryResult, SqlClient } from "./common.ts";
import {
  applyMigrations,
  assertValidSchemaName,
  checksumOf,
  findHardCodedSchema,
  type MigrationFile,
  readMigrationFiles,
} from "./runner.ts";

type Reply = (sql: string, values?: unknown[]) => QueryResult | Error | undefined;

/** A fake database connection that records every statement it is given. */
function fakeClient(reply: Reply = () => undefined) {
  const statements: { sql: string; values?: unknown[] }[] = [];
  let ended = false;
  const client: SqlClient = {
    async query(sql, values) {
      statements.push({ sql, values });
      const answer = reply(sql, values);
      if (answer instanceof Error) throw answer;
      return answer ?? { rows: [], rowCount: 0 };
    },
    async end() {
      ended = true;
    },
  };
  return { client, statements, ended: () => ended };
}

const file = (name: string, sql: string): MigrationFile => ({
  name,
  sql,
  checksum: checksumOf(sql),
});
const noLog = () => {};
let clock = 0;
const now = () => (clock += 5);

function trackingReply(applied: Record<string, string> = {}, tables = 0): Reply {
  return (sql) => {
    if (sql.includes("applied_migrations where schema_name")) {
      return {
        rows: Object.entries(applied).map(([filename, checksum]) => ({ filename, checksum })),
        rowCount: 0,
      };
    }
    if (sql.includes("information_schema.tables"))
      return { rows: [{ count: tables }], rowCount: 1 };
    return undefined;
  };
}

describe("migration runner", () => {
  it("applies pending files in the given order and records each one", async () => {
    const fake = fakeClient(trackingReply());
    const lines: string[] = [];
    const files = [
      file("20260101_a.sql", "create table a (id int);"),
      file("20260102_b.sql", "create table b (id int);"),
    ];
    const result = await applyMigrations({
      client: fake.client,
      schema: "worker_2",
      files,
      log: (line) => lines.push(line),
      now,
    });
    assert.deepEqual(result.applied, ["20260101_a.sql", "20260102_b.sql"]);
    const sqlRun = fake.statements.map((entry) => entry.sql);
    assert.ok(
      sqlRun.indexOf("create table a (id int);") < sqlRun.indexOf("create table b (id int);"),
    );
    const inserts = fake.statements.filter((entry) => entry.sql.includes("insert into"));
    assert.deepEqual(
      inserts.map((entry) => entry.values?.[1]),
      ["20260101_a.sql", "20260102_b.sql"],
    );
    assert.ok(lines.some((line) => line.includes("applied 20260101_a.sql to worker_2")));
  });

  it("creates the tracking table while holding a lock, so parallel workers cannot collide", async () => {
    const fake = fakeClient(trackingReply());
    await applyMigrations({ client: fake.client, schema: "worker_1", files: [], log: noLog, now });
    const sql = fake.statements.map((entry) => entry.sql);
    const lock = sql.findIndex((statement) => statement.includes("pg_advisory_lock"));
    const create = sql.findIndex((statement) => statement.includes("create table if not exists"));
    const unlock = sql.findIndex((statement) => statement.includes("pg_advisory_unlock"));
    assert.ok(lock >= 0 && lock < create && create < unlock);
  });

  it("sets the session search path to the target schema and catalogue, then resets it", async () => {
    const fake = fakeClient(trackingReply());
    await applyMigrations({
      client: fake.client,
      schema: "worker_3",
      files: [file("20260101_a.sql", "select 1;")],
      log: noLog,
      now,
    });
    const path = fake.statements.find((entry) => entry.sql.includes("set_config('search_path'"));
    assert.deepEqual(path?.values, ['"worker_3", pg_catalog']);
    assert.equal(fake.statements.at(-1)?.sql, "reset search_path");
  });

  it("skips files that are already applied and reports them as up to date", async () => {
    const a = file("20260101_a.sql", "select 1;");
    const fake = fakeClient(trackingReply({ [a.name]: a.checksum }));
    const result = await applyMigrations({
      client: fake.client,
      schema: "public",
      files: [a],
      log: noLog,
      now,
    });
    assert.deepEqual(result.applied, []);
    assert.deepEqual(result.upToDate, [a.name]);
    assert.equal(
      fake.statements.some((entry) => entry.sql === "select 1;"),
      false,
    );
  });

  it("stops at the failing file, names it and applies nothing after it", async () => {
    const fake = fakeClient((sql, values) => {
      if (sql === "boom;") return new Error("syntax error near boom");
      return trackingReply()(sql, values);
    });
    await assert.rejects(
      applyMigrations({
        client: fake.client,
        schema: "public",
        files: [
          file("20260101_a.sql", "select 1;"),
          file("20260102_bad.sql", "boom;"),
          file("20260103_c.sql", "select 3;"),
        ],
        log: noLog,
        now,
      }),
      (error: Error & { step?: string; detail?: Record<string, string> }) => {
        assert.equal(error.step, "apply");
        assert.equal(error.detail?.file, "20260102_bad.sql");
        assert.equal(error.detail?.schema, "public");
        assert.match(error.message, /syntax error/);
        return true;
      },
    );
    assert.equal(
      fake.statements.some((entry) => entry.sql === "select 3;"),
      false,
    );
    assert.equal(fake.statements.at(-1)?.sql, "reset search_path");
  });

  it("refuses a file that hard-codes a schema name before touching the database", async () => {
    const fake = fakeClient(trackingReply());
    await assert.rejects(
      applyMigrations({
        client: fake.client,
        schema: "worker_1",
        files: [
          file("20260101_a.sql", "select 1;"),
          file("20260102_fixed.sql", "create table public.t (id int);"),
        ],
        log: noLog,
        now,
      }),
      (error: Error & { step?: string; detail?: Record<string, string> }) => {
        assert.equal(error.step, "check-files");
        assert.equal(error.detail?.file, "20260102_fixed.sql");
        return true;
      },
    );
    assert.equal(fake.statements.length, 0);
  });

  it("refuses a file that changed after it was applied (forward-only)", async () => {
    const fake = fakeClient(trackingReply({ "20260101_a.sql": "old-checksum" }));
    await assert.rejects(
      applyMigrations({
        client: fake.client,
        schema: "public",
        files: [file("20260101_a.sql", "select 1;")],
        log: noLog,
        now,
      }),
      /changed after it was applied/,
    );
  });

  it("applies fresh-schema settings only to an empty schema", async () => {
    const settings = { "waldorf.authoritative_issuer_baseline": "verified-v1" };
    for (const [applied, tables, expected] of [
      [{}, 0, true],
      [{}, 3, false],
      [{ "20260100_old.sql": "x" }, 0, false],
    ] as const) {
      const fake = fakeClient(trackingReply(applied as Record<string, string>, tables));
      await applyMigrations({
        client: fake.client,
        schema: "public",
        files: [file("20260101_a.sql", "select 1;")],
        log: noLog,
        now,
        freshSchemaSettings: settings,
      });
      const set = fake.statements.some(
        (entry) =>
          entry.sql === "select set_config($1, $2, false)" && entry.values?.[1] === "verified-v1",
      );
      assert.equal(set, expected, JSON.stringify({ applied, tables }));
    }
  });

  it("keeps the original error when resetting the connection fails afterwards", async () => {
    const fake = fakeClient((sql, values) => {
      if (sql === "reset search_path") return new Error("connection closed");
      if (sql === "boom;") return new Error("original failure");
      return trackingReply()(sql, values);
    });
    await assert.rejects(
      applyMigrations({
        client: fake.client,
        schema: "public",
        files: [file("20260101_bad.sql", "boom;")],
        log: noLog,
        now,
      }),
      /original failure/,
    );
  });

  it("removes credentials from a failure message", async () => {
    const leaky = `failed at postgresql://postgres:hunter2pw@127.0.0.1:54322/postgres`;
    const fake = fakeClient((sql, values) =>
      sql === "boom;" ? new Error(leaky) : trackingReply()(sql, values),
    );
    await assert.rejects(
      applyMigrations({
        client: fake.client,
        schema: "public",
        files: [file("20260101_bad.sql", "boom;")],
        log: noLog,
        now,
      }),
      (error: Error) => !error.message.includes("hunter2pw"),
    );
  });

  it("validates schema names", () => {
    assert.doesNotThrow(() => assertValidSchemaName("worker_1"));
    for (const name of ["", "Public", "a-b", "1x", 'x"y', "x".repeat(64)]) {
      assert.throws(() => assertValidSchemaName(name), /lowercase/);
    }
  });
});

describe("hard-coded schema check", () => {
  it("flags qualified names, fixed search paths, fixed lookups and schema creation", () => {
    assert.ok(findHardCodedSchema("select * from public.t"));
    assert.ok(findHardCodedSchema("select * from worker_2 . t"));
    assert.ok(
      findHardCodedSchema(
        "create function f() returns int set search_path = public as $$ select 1 $$",
      ),
    );
    assert.ok(
      findHardCodedSchema(
        "create function f() returns int set search_path to public as $$ select 1 $$",
      ),
    );
    assert.ok(findHardCodedSchema("select 1 where schemaname = 'public'"));
    assert.ok(findHardCodedSchema("create schema extra"));
  });

  it("accepts schema-neutral SQL, comments, the public pseudo-role and pinned search paths", () => {
    assert.equal(
      findHardCodedSchema("-- uses public.t in a comment\nselect 1 /* worker_1.t */"),
      undefined,
    );
    assert.equal(findHardCodedSchema("revoke all on function f() from public"), undefined);
    assert.equal(
      findHardCodedSchema(
        "create function f() returns int set search_path from current as $$ select 1 $$",
      ),
      undefined,
    );
    assert.equal(findHardCodedSchema("select 1 where table_schema = current_schema()"), undefined);
    assert.equal(findHardCodedSchema("select auth.uid(), pg_catalog.now()"), undefined);
  });

  it("finds no hard-coded schema in any migration file of the repository", () => {
    const directory = new URL("../../supabase/migrations/", import.meta.url);
    const names = readdirSync(directory).filter((name) => name.endsWith(".sql"));
    assert.ok(names.length >= 4);
    for (const name of names) {
      assert.equal(
        findHardCodedSchema(readFileSync(new URL(name, directory), "utf8")),
        undefined,
        name,
      );
    }
  });
});

describe("migration files", () => {
  it("reads only .sql files, in name order, with a checksum of the content", () => {
    const directory = mkdtempSync(join(tmpdir(), "runner-files-"));
    try {
      writeFileSync(join(directory, "20260102_b.sql"), "select 2;");
      writeFileSync(join(directory, "20260101_a.sql"), "select 1;");
      writeFileSync(join(directory, "notes.md"), "ignored");
      const files = readMigrationFiles(directory);
      assert.deepEqual(
        files.map((entry) => entry.name),
        ["20260101_a.sql", "20260102_b.sql"],
      );
      assert.equal(files[0]?.checksum, checksumOf("select 1;"));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
