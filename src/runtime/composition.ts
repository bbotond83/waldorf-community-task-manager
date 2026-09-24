import { validateRuntimeConfig, type RuntimeConfigResult } from "./config.ts";
import type { RuntimeComposition } from "./types.ts";

export type CompositionResult =
  | { ok: true; value: RuntimeComposition }
  | { ok: false; error: Extract<RuntimeConfigResult, { ok: false }>["error"] };

export async function composeRuntime(
  environment: Partial<Record<string, string | undefined>> = process.env,
): Promise<CompositionResult> {
  const config = validateRuntimeConfig(environment);
  if (!config.ok) {
    return config;
  }

  if (config.value.mode === "synthetic") {
    const { createSyntheticComposition } = await import("./synthetic/composition.ts");
    return { ok: true, value: createSyntheticComposition(config.value) };
  }

  const { createProductionComposition } = await import("./production/composition.ts");
  return { ok: true, value: createProductionComposition(config.value) };
}
