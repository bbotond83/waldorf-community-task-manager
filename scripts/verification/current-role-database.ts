import { execFile } from "node:child_process";
import { access, mkdtemp, mkdir, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
const tools = ["psql", "initdb", "pg_ctl"] as const;
const port = "55439";
const user = "waldorf_test";

/** Resolve only executables, never a connection string or an existing cluster. */
export async function postgresBinaries(
  directory?: string,
): Promise<Record<(typeof tools)[number], string>> {
  const candidates = directory
    ? [directory]
    : [
        "/opt/homebrew/opt/postgresql@18/bin",
        ...(process.env.PATH ?? "").split(":").filter(isAbsolute),
      ];
  for (const candidate of candidates) {
    if (!isAbsolute(candidate)) throw new Error("POSTGRES_TOOLS_REQUIRE_ABSOLUTE_DIRECTORY");
    const paths = Object.fromEntries(tools.map((tool) => [tool, join(candidate, tool)])) as Record<
      (typeof tools)[number],
      string
    >;
    try {
      await Promise.all(Object.values(paths).map((path) => access(path, constants.X_OK)));
      return paths;
    } catch {
      /* Try the next explicit executable directory; never skip verification. */
    }
  }
  throw new Error(
    "POSTGRES_TOOLS_UNAVAILABLE: install PostgreSQL 18 and expose psql, initdb and pg_ctl on PATH",
  );
}

/** Fresh invented-data PostgreSQL, private socket only; no ambient PG credentials. */
export async function createRoleDatabase(directory?: string) {
  const binaries = await postgresBinaries(directory);
  const temporary = await mkdtemp(join(tmpdir(), "roles-db-"));
  const data = join(temporary, "data");
  const socket = join(temporary, "socket");
  const env = {
    NODE_ENV: "test" as const,
    PATH: process.env.PATH,
    LANG: "C",
    LC_ALL: "C",
    PGOPTIONS: "-c statement_timeout=8000 -c lock_timeout=5000",
  };
  const run = async (binary: string, args: string[], timeout = 15000) => {
    return new Promise<string>((resolve, reject) => {
      execFile(
        binary,
        args,
        { env, encoding: "utf8", timeout, maxBuffer: 8 * 1024 * 1024 },
        (error, stdout) => {
          if (error) reject(error);
          else resolve(stdout.trim());
        },
      );
    });
  };
  let started = false;
  const close = async () => {
    try {
      if (started) {
        await run(binaries.pg_ctl, ["-D", data, "-m", "immediate", "-w", "-t", "10", "stop"]);
        started = false;
      }
    } finally {
      // On shutdown failure keep the owned directory for diagnosis; never delete a running cluster.
      if (!started) await rm(temporary, { recursive: true, force: true });
    }
  };
  try {
    await mkdir(socket, { mode: 0o700 });
    await run(binaries.initdb, [
      "-D",
      data,
      "-U",
      user,
      "--auth-local=trust",
      "--auth-host=reject",
      "--no-locale",
      "--encoding=UTF8",
    ]);
    await run(binaries.pg_ctl, [
      "-D",
      data,
      "-l",
      join(temporary, "server.log"),
      "-o",
      `-F -k ${socket} -h '' -p ${port} -c unix_socket_permissions=0700`,
      "-w",
      "-t",
      "10",
      "start",
    ]);
    started = true;
    const query = (sql: string, database = "postgres") => {
      if (!/^[a-z][a-z0-9_]*$/.test(database)) throw new Error("INVALID_DISPOSABLE_DATABASE_NAME");
      return run(binaries.psql, [
        "--no-psqlrc",
        "--host",
        socket,
        "--port",
        port,
        "--username",
        user,
        "--dbname",
        database,
        "--set",
        "ON_ERROR_STOP=1",
        "--tuples-only",
        "--no-align",
        "--quiet",
        "--command",
        sql,
      ]);
    };
    const version = await run(binaries.psql, ["--version"]);
    if (!/^psql \(PostgreSQL\) 18\./.test(version))
      throw new Error("POSTGRES_VERSION_UNSUPPORTED: PostgreSQL 18 required");
    return { query, close, version, temporary };
  } catch (failure) {
    // pg_ctl may have started the server before a readiness timeout. Its status is authoritative.
    if (!started) {
      try {
        await run(binaries.pg_ctl, ["-D", data, "status"]);
        started = true;
      } catch {
        /* No server to stop. */
      }
    }
    try {
      await close();
    } catch (cleanup) {
      throw new AggregateError([failure, cleanup], "POSTGRES_SETUP_AND_CLEANUP_FAILED");
    }
    throw failure;
  }
}
