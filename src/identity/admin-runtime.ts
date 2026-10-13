import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readDatabaseConfig } from "../runtime/database/config.ts";
import { type AdminAccess, createAdminAccess } from "./admin-client.ts";

/**
 * The only module that reads the sign-in service's service-role key (BR2.16, BR2.23). The general runtime
 * configuration refuses a service credential (U1 BR1.3, BR1.4) and stays unchanged; this module reads the
 * key itself, from the process environment or from the git-ignored tooling file `npm run db:start` writes
 * (`.env.service.local`), and hands it to the admin client. It is marked server-only, so a client component
 * that imports it fails the build, and a bundle test proves the key name and these modules never appear in
 * browser output.
 */
export const SERVICE_KEY_NAME = "SUPABASE_SERVICE_ROLE_KEY";
export const SERVICE_ENV_FILE_NAME = ".env.service.local";

type Environment = Readonly<Record<string, string | undefined>>;

/** Reads one value from the text of an env file (`NAME=value`, optional quotes, comments ignored). */
export function readEnvFileValue(text: string, name: string): string | undefined {
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1 || trimmed.slice(0, separator).trim() !== name) continue;
    const value = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^(["'])(.*)\1$/, "$2");
    return value.length > 0 ? value : undefined;
  }
  return undefined;
}

export type ServiceKeySources = Readonly<{
  environment: Environment;
  readFile: (path: string) => string | undefined;
  directory: string;
}>;

export function readServiceKey(sources: ServiceKeySources): string | undefined {
  const fromEnvironment = sources.environment[SERVICE_KEY_NAME]?.trim();
  if (fromEnvironment) return fromEnvironment;
  const text = sources.readFile(join(sources.directory, SERVICE_ENV_FILE_NAME));
  return text === undefined ? undefined : readEnvFileValue(text, SERVICE_KEY_NAME);
}

/** Builds the admin access, or throws a coded error that names the setting and never shows a value. */
export function buildAdminAccess(
  environment: Environment,
  sources: Pick<ServiceKeySources, "readFile" | "directory">,
): AdminAccess {
  const config = readDatabaseConfig(environment);
  if (!config.ok) throw new Error(`ADMIN_ACCESS_UNAVAILABLE: ${config.error.code}`);
  const serviceKey = readServiceKey({ environment, ...sources });
  if (!serviceKey) throw new Error(`ADMIN_ACCESS_UNAVAILABLE: ${SERVICE_KEY_NAME} is not set`);
  return createAdminAccess({ url: config.value.url, serviceKey, schema: config.value.schema });
}

let shared: AdminAccess | undefined;

/** The admin access of this server process. */
export function getAdminAccess(): AdminAccess {
  shared ??= buildAdminAccess(process.env, {
    directory: process.cwd(),
    readFile: (path) => {
      try {
        return readFileSync(path, "utf8");
      } catch {
        return undefined;
      }
    },
  });
  return shared;
}

export function resetAdminAccessForTests(): void {
  shared = undefined;
}
