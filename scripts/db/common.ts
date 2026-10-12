import { redactSecrets } from "../../src/runtime/database/redact.ts";

/** Shared pieces of the local-stack tooling (U1). Output never contains keys or passwords. */
export type Log = (line: string) => void;

export interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number | null;
}

/** The small part of a Postgres client the tooling uses; `pg.Client` satisfies it. */
export interface SqlClient {
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
  end(): Promise<void>;
}

/** Written by `db:start`: address and public key only; the app may read this file. */
export const PUBLIC_ENV_FILE = ".env.database.local";
/** Written by `db:start`: tooling-only values (database address, service credential). */
export const SERVICE_ENV_FILE = ".env.service.local";

export const DEFAULT_SCHEMA = "public";
export const WORKER_SCHEMAS = ["worker_1", "worker_2", "worker_3", "worker_4"] as const;
export const SCHEMA_NAME = /^[a-z][a-z0-9_]{0,62}$/;

/** Reported targets (NFR4): a missed target is shown, never a failure. */
export const TARGETS_MS = {
  start: 90_000,
  migrate: 30_000,
  worker: 10_000,
  scan: 15_000,
} as const;

/** A tooling failure that names the step (and file, schema or setting) that failed (NFR1.12). */
export class ToolingError extends Error {
  readonly step: string;
  readonly detail: Readonly<Record<string, string>>;

  constructor(step: string, message: string, detail: Record<string, string> = {}) {
    super(message);
    this.name = "ToolingError";
    this.step = step;
    this.detail = detail;
  }
}

export function formatSeconds(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(1)} s`;
}

/** One final timing line, with the target it is compared with. */
export function timingLine(label: string, milliseconds: number, targetMs?: number): string {
  const target =
    targetMs === undefined
      ? ""
      : ` (target ${formatSeconds(targetMs)}: ${milliseconds <= targetMs ? "met" : "MISSED, reported only"})`;
  return `TIMING ${label} ${formatSeconds(milliseconds)}${target}`;
}

export function parseEnvFile(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || line.trimStart().startsWith("#")) continue;
    values[match[1]!] = match[2]!.replace(/^(["'])(.*)\1$/, "$2");
  }
  return values;
}

export function formatEnvFile(header: string, entries: Readonly<Record<string, string>>): string {
  const lines = Object.entries(entries).map(([name, value]) => `${name}=${value}`);
  return `# ${header}\n${lines.join("\n")}\n`;
}

/** What the tooling needs to reach the local stack. */
export interface ToolingSettings {
  databaseUrl: string;
  apiUrl: string;
  publicKey: string;
}

type EnvironmentReader = {
  environment: Readonly<Record<string, string | undefined>>;
  readFile: (path: string) => string | undefined;
};

/** Reads settings from the process environment first, then from the ignored local files. */
export function loadToolingSettings(reader: EnvironmentReader): ToolingSettings {
  const fromFiles = {
    ...parseEnvFile(reader.readFile(PUBLIC_ENV_FILE) ?? ""),
    ...parseEnvFile(reader.readFile(SERVICE_ENV_FILE) ?? ""),
  };
  const pick = (name: string) => reader.environment[name] || fromFiles[name];
  const databaseUrl = pick("DATABASE_URL");
  const apiUrl = pick("SUPABASE_URL");
  const publicKey = pick("SUPABASE_ANON_KEY");
  const missing = [
    ["DATABASE_URL", databaseUrl],
    ["SUPABASE_URL", apiUrl],
    ["SUPABASE_ANON_KEY", publicKey],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new ToolingError(
      "settings",
      `Missing ${missing.join(", ")}. Run "npm run db:start" first (it writes ${SERVICE_ENV_FILE} and ${PUBLIC_ENV_FILE}).`,
      { setting: missing.join(",") },
    );
  }
  return { databaseUrl: databaseUrl!, apiUrl: apiUrl!, publicKey: publicKey! };
}

/** The message shown for any failure: step first, secrets removed. */
export function describeFailure(error: unknown, secrets: readonly string[] = []): string {
  if (error instanceof ToolingError) {
    const detail = Object.entries(error.detail)
      .map(([key, value]) => `${key}=${value}`)
      .join(" ");
    return redactSecrets(
      `FAILED step=${error.step}${detail ? ` ${detail}` : ""}: ${error.message}`,
      secrets,
    );
  }
  const message = error instanceof Error ? error.message : String(error);
  return redactSecrets(`FAILED step=unexpected: ${message}`, secrets);
}

/**
 * Runs `run` and sets the process exit code only when the file is started as a command
 * (`node file.ts`), never when a test imports it.
 */
export async function runAsCommand(
  meta: Readonly<{ main?: boolean }>,
  run: () => Promise<number>,
): Promise<void> {
  if (meta.main) process.exitCode = await run();
}

/** Splits `--name value` and `--flag` arguments; anything else is a positional value. */
export function parseArguments(argv: readonly string[]) {
  const flags = new Map<string, string | true>();
  const positional: string[] = [];
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]!;
    if (!argument.startsWith("--")) {
      positional.push(argument);
      continue;
    }
    const name = argument.slice(2);
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags.set(name, next);
      index++;
    } else {
      flags.set(name, true);
    }
  }
  return { flags, positional };
}
