import { z } from "zod";

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(["127.0.0.1", "localhost", "[::1]"]);

/**
 * The database address: https anywhere, or http only on the machine itself (FR1.3), so the application can run
 * against the local database stack and never sends traffic unencrypted over a network.
 */
function isAcceptableDatabaseAddress(value: string): boolean {
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "https:") return parsed.hostname.length > 0;
    return parsed.protocol === "http:" && LOOPBACK_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * The one runtime configuration (FR1.3): the session secret, the database address and the public key. There is no
 * mode switch and no fallback; a missing or invalid setting stops startup and the error names the setting.
 */
const runtimeConfigSchema = z.object({
  APP_SESSION_SECRET: z.string().min(32),
  SUPABASE_URL: z.string().url().refine(isAcceptableDatabaseAddress),
  SUPABASE_ANON_KEY: z.string().min(20),
});

export type RuntimeConfig = {
  sessionSecret: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export type RuntimeConfigError = {
  code: "CONFIG_PRODUCTION_INVALID";
  variable: string;
  message: string;
};

export type RuntimeConfigResult =
  { ok: true; value: RuntimeConfig } | { ok: false; error: RuntimeConfigError };

type RuntimeEnvironment = Partial<Record<string, string | undefined>>;

function firstInvalidVariable(error: z.ZodError): string {
  return String(error.issues[0]?.path[0] ?? "SUPABASE_URL");
}

export function validateRuntimeConfig(environment: RuntimeEnvironment): RuntimeConfigResult {
  const parsed = runtimeConfigSchema.safeParse(environment);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "CONFIG_PRODUCTION_INVALID",
        variable: firstInvalidVariable(parsed.error),
        message: "Runtime configuration is invalid.",
      },
    };
  }

  return {
    ok: true,
    value: {
      sessionSecret: parsed.data.APP_SESSION_SECRET,
      supabaseUrl: parsed.data.SUPABASE_URL,
      supabaseAnonKey: parsed.data.SUPABASE_ANON_KEY,
    },
  };
}

export function formatRuntimeConfigError(error: RuntimeConfigError): string {
  return `${error.code}: invalid ${error.variable}`;
}
