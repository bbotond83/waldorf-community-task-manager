import nextEnv from "@next/env";
import { formatRuntimeConfigError, validateRuntimeConfig } from "../src/runtime/config.ts";

// Match Next's command defaults while preserving an explicit NODE_ENV.
const defaultMode = process.argv[2] === "development" ? "development" : "production";
Object.assign(process.env, { NODE_ENV: process.env.NODE_ENV || defaultMode });
let environmentLoadFailed = false;
const redactedLogger = {
  info: () => undefined,
  error: () => {
    environmentLoadFailed = true;
  },
};

try {
  nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV === "development", redactedLogger);
} catch {
  // Loader errors can contain file contents or credentials; expose only a stable code.
  environmentLoadFailed = true;
}
if (environmentLoadFailed) {
  console.error("CONFIG_ENV_LOAD_FAILED: invalid environment file");
  process.exit(1);
}

const result = validateRuntimeConfig(process.env);
if (!result.ok) {
  console.error(formatRuntimeConfigError(result.error));
  process.exit(1);
}

console.log(`RUNTIME_CONFIG_VALID: ${result.value.mode}`);
