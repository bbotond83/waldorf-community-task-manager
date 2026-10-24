import { z } from "zod";

const syntheticConfigSchema = z.object({
  APP_RUNTIME_MODE: z.literal("synthetic"),
  APP_SYNTHETIC_FIXTURE_VERSION: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9-]{2,63}$/i)
    .default("waldorf-local-v1"),
});

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(["127.0.0.1", "localhost", "[::1]"]);

/**
 * The database address: https anywhere, or http only on the machine itself (FR1.3), so the production
 * build can run against the local database stack and never sends traffic unencrypted over a network.
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

const productionConfigSchema = z.object({
  APP_RUNTIME_MODE: z.literal("production"),
  APP_SESSION_SECRET: z.string().min(32),
  SUPABASE_URL: z.string().url().refine(isAcceptableDatabaseAddress),
  SUPABASE_ANON_KEY: z.string().min(20),
});

export type SyntheticRuntimeConfig = {
  mode: "synthetic";
  fixtureVersion: string;
};

export type ProductionRuntimeConfig = {
  mode: "production";
  sessionSecret: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export type RuntimeConfig = SyntheticRuntimeConfig | ProductionRuntimeConfig;

export type RuntimeConfigError = {
  code: "CONFIG_RUNTIME_MODE_INVALID" | "CONFIG_SYNTHETIC_INVALID" | "CONFIG_PRODUCTION_INVALID";
  variable: string;
  message: string;
};

export type RuntimeConfigResult =
  { ok: true; value: RuntimeConfig } | { ok: false; error: RuntimeConfigError };

type RuntimeEnvironment = Partial<Record<string, string | undefined>>;

function firstInvalidVariable(error: z.ZodError): string {
  return String(error.issues[0]?.path[0] ?? "APP_RUNTIME_MODE");
}

export function validateRuntimeConfig(environment: RuntimeEnvironment): RuntimeConfigResult {
  const mode = environment.APP_RUNTIME_MODE;
  if (mode !== "synthetic" && mode !== "production") {
    return {
      ok: false,
      error: {
        code: "CONFIG_RUNTIME_MODE_INVALID",
        variable: "APP_RUNTIME_MODE",
        message: "APP_RUNTIME_MODE must be synthetic or production.",
      },
    };
  }

  if (mode === "synthetic") {
    const parsed = syntheticConfigSchema.safeParse(environment);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: "CONFIG_SYNTHETIC_INVALID",
          variable: firstInvalidVariable(parsed.error),
          message: "Synthetic runtime configuration is invalid.",
        },
      };
    }

    return {
      ok: true,
      value: { mode: "synthetic", fixtureVersion: parsed.data.APP_SYNTHETIC_FIXTURE_VERSION },
    };
  }

  const parsed = productionConfigSchema.safeParse(environment);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "CONFIG_PRODUCTION_INVALID",
        variable: firstInvalidVariable(parsed.error),
        message: "Production runtime configuration is invalid.",
      },
    };
  }

  return {
    ok: true,
    value: {
      mode: "production",
      sessionSecret: parsed.data.APP_SESSION_SECRET,
      supabaseUrl: parsed.data.SUPABASE_URL,
      supabaseAnonKey: parsed.data.SUPABASE_ANON_KEY,
    },
  };
}

export function formatRuntimeConfigError(error: RuntimeConfigError): string {
  return `${error.code}: invalid ${error.variable}`;
}
