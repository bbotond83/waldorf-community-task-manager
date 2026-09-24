import { formatRuntimeConfigError, validateRuntimeConfig } from "../src/runtime/config.ts";

const result = validateRuntimeConfig(process.env);
if (!result.ok) {
  console.error(formatRuntimeConfigError(result.error));
  process.exit(1);
}

console.log(`RUNTIME_CONFIG_VALID: ${result.value.mode}`);
