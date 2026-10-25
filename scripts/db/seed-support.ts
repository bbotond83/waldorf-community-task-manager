import { readFileSync } from "node:fs";
import { redactSecrets } from "../../src/runtime/database/redact.ts";
import {
  describeFailure,
  loadToolingSettings,
  type Log,
  parseEnvFile,
  PUBLIC_ENV_FILE,
  type SqlClient,
  SERVICE_ENV_FILE,
  ToolingError,
} from "./common.ts";
import { connectPostgres } from "./postgres.ts";
import { SEED_PASSWORDS } from "./seed/data.ts";

/** The limits of the seed, reset and sign-in timing tests (NFR4.17 to NFR4.19). The commands report; the tests fail above them. */
export const SEED_TARGETS_MS = {
  seed: 60_000,
  seedLarge: 120_000,
  reset: 30_000,
  signIn: 5_000,
} as const;

/** What the seed and reset commands need from outside: the connection, the files, the environment, the clock and the log. */
export interface CommandDeps {
  connect: (url: string) => Promise<SqlClient>;
  readFile: (path: string) => string | undefined;
  environment: Readonly<Record<string, string | undefined>>;
  log: Log;
  now: () => number;
}

export function defaultCommandDeps(): CommandDeps {
  return {
    connect: connectPostgres,
    readFile: (path) => {
      try {
        return readFileSync(path, "utf8");
      } catch {
        return undefined;
      }
    },
    environment: process.env,
    log: (line) => console.log(line),
    now: () => Date.now(),
  };
}

const SERVICE_KEY_NAME = "SUPABASE_SERVICE_ROLE_KEY";

/** The sign-in service's admin key of the local stack, from the environment or the ignored local files. */
export function loadServiceKey(reader: Pick<CommandDeps, "environment" | "readFile">): string {
  const fromFiles = {
    ...parseEnvFile(reader.readFile(PUBLIC_ENV_FILE) ?? ""),
    ...parseEnvFile(reader.readFile(SERVICE_ENV_FILE) ?? ""),
  };
  const key = reader.environment[SERVICE_KEY_NAME] || fromFiles[SERVICE_KEY_NAME];
  if (!key) {
    throw new ToolingError(
      "settings",
      `Missing ${SERVICE_KEY_NAME}. Run "npm run db:start" first (it writes ${SERVICE_ENV_FILE}).`,
      { setting: SERVICE_KEY_NAME },
    );
  }
  return key;
}

/** Everything that must never reach the output: the test passwords of the seed and any secret the command read. */
export const knownSecrets = (extra: readonly string[] = []): string[] => [
  ...Object.values(SEED_PASSWORDS),
  ...extra,
];

/** Every secret a command can read (database address, public and service keys) plus the seeded passwords. */
export function collectSecrets(deps: Pick<CommandDeps, "environment" | "readFile">): string[] {
  const values: string[] = [deps.environment.DATABASE_URL ?? ""];
  try {
    values.push(loadServiceKey(deps));
  } catch {
    // not set: nothing to hide
  }
  try {
    const settings = loadToolingSettings(deps);
    values.push(settings.databaseUrl, settings.publicKey);
  } catch {
    // not set or refused: the failure itself is reported
  }
  return knownSecrets(values);
}

/**
 * One failure line: the command name, the failing step (with the schema, file or setting when known), an event code and no
 * secret. An unexpected error is reported once, here (NFR6.29).
 */
export function failureLine(
  command: "SEED" | "RESET",
  error: unknown,
  step: string,
  secrets: readonly string[],
): string {
  const wrapped =
    error instanceof ToolingError
      ? error
      : new ToolingError(
          step,
          redactSecrets(error instanceof Error ? error.message : String(error), secrets),
        );
  const event = `${command.toLowerCase()}_failed`;
  return `${command} ${describeFailure(wrapped, secrets)} event=${event}`;
}
