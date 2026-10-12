/**
 * Runtime configuration of the database connection (BR1.3, BR1.4).
 *
 * The application reads exactly four settings: the database address, the public key, the session
 * secret and the schema name. It never reads a service credential: that one belongs to the local
 * tooling only. There is no synthetic fallback and no mode switch; a bad setting stops startup and
 * the message names the setting, never its value.
 */
export const EXAMPLE_SESSION_SECRET = "replace-with-a-random-value-of-at-least-32-characters";
export const DEFAULT_DATABASE_SCHEMA = "public";
export const MIN_SESSION_SECRET_LENGTH = 32;

export type DatabaseConfig = Readonly<{
  url: string;
  publicKey: string;
  sessionSecret: string;
  schema: string;
}>;

export type DatabaseConfigErrorCode =
  | "CONFIG_DATABASE_URL_INVALID"
  | "CONFIG_DATABASE_PUBLIC_KEY_INVALID"
  | "CONFIG_SESSION_SECRET_INVALID"
  | "CONFIG_DATABASE_SCHEMA_INVALID";

export type DatabaseConfigError = Readonly<{
  code: DatabaseConfigErrorCode;
  variable: string;
  message: string;
}>;

export type DatabaseConfigResult =
  { ok: true; value: DatabaseConfig } | { ok: false; error: DatabaseConfigError };

type Environment = Readonly<Record<string, string | undefined>>;

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const SCHEMA_NAME = /^[a-z][a-z0-9_]{0,62}$/;

function failure(
  code: DatabaseConfigErrorCode,
  variable: string,
  message: string,
): DatabaseConfigResult {
  return { ok: false, error: { code, variable, message } };
}

function isAcceptableUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol === "https:") return parsed.hostname.length > 0;
  return parsed.protocol === "http:" && LOOPBACK_HOSTS.has(parsed.hostname);
}

/** True for a JWT whose role claim is the service role, or for a stack secret key. */
function looksLikeServiceCredential(key: string): boolean {
  if (key.startsWith("sb_secret_")) return true;
  const parts = key.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as {
      role?: unknown;
    };
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

export function readDatabaseConfig(environment: Environment): DatabaseConfigResult {
  const url = environment.SUPABASE_URL?.trim() ?? "";
  if (!isAcceptableUrl(url)) {
    return failure(
      "CONFIG_DATABASE_URL_INVALID",
      "SUPABASE_URL",
      "SUPABASE_URL must be an https address, or an http address on 127.0.0.1, localhost or ::1.",
    );
  }

  const publicKey = environment.SUPABASE_ANON_KEY?.trim() ?? "";
  if (publicKey.length < 20 || looksLikeServiceCredential(publicKey)) {
    return failure(
      "CONFIG_DATABASE_PUBLIC_KEY_INVALID",
      "SUPABASE_ANON_KEY",
      "SUPABASE_ANON_KEY must be set to the public key (never a service credential).",
    );
  }

  const sessionSecret = environment.APP_SESSION_SECRET?.trim() ?? "";
  if (
    sessionSecret.length < MIN_SESSION_SECRET_LENGTH ||
    sessionSecret === EXAMPLE_SESSION_SECRET
  ) {
    return failure(
      "CONFIG_SESSION_SECRET_INVALID",
      "APP_SESSION_SECRET",
      `APP_SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters and differ from the example value.`,
    );
  }

  const schema = environment.DATABASE_SCHEMA?.trim() || DEFAULT_DATABASE_SCHEMA;
  if (!SCHEMA_NAME.test(schema)) {
    return failure(
      "CONFIG_DATABASE_SCHEMA_INVALID",
      "DATABASE_SCHEMA",
      "DATABASE_SCHEMA must be a lowercase identifier (letters, digits, underscores).",
    );
  }

  return { ok: true, value: { url, publicKey, sessionSecret, schema } };
}

export function formatDatabaseConfigError(error: DatabaseConfigError): string {
  return `${error.code}: ${error.message}`;
}

/** Throws at startup with the failing setting named; the value is never part of the message. */
export function requireDatabaseConfig(environment: Environment): DatabaseConfig {
  const result = readDatabaseConfig(environment);
  if (!result.ok) throw new Error(formatDatabaseConfigError(result.error));
  return result.value;
}
