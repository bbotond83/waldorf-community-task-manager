// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
const loader = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@next/env", () => ({ default: { loadEnvConfig: loader.load } }));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
  loader.load.mockReset();
});
async function runtime(mode: string | undefined, failure?: "throw" | "diagnostic") {
  vi.resetModules();
  vi.stubEnv("APP_RUNTIME_MODE", "synthetic");
  vi.stubEnv("NODE_ENV", "");
  const argv = vi
    .spyOn(process, "argv", "get")
    .mockReturnValue(["node", "validator", ...(mode ? [mode] : [])]);
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("SIMULATED_EXIT");
  });
  loader.load.mockImplementation((_root, _dev, logger) => {
    if (failure === "throw") throw new Error("invented-secret");
    if (failure === "diagnostic") logger.error("invented-secret");
  });
  try {
    await import("../../scripts/validate-runtime-config.ts");
  } catch (e) {
    expect((e as Error).message).toBe("SIMULATED_EXIT");
  }
  argv.mockRestore();
  return { log, error };
}
it.each([
  [undefined, false],
  ["production", false],
  ["development", true],
])("uses default/explicit %s Next mode", async (mode, development) => {
  const { log } = await runtime(mode);
  expect(loader.load).toHaveBeenCalledWith(process.cwd(), development, expect.any(Object));
  expect(log).toHaveBeenCalledWith("RUNTIME_CONFIG_VALID: synthetic");
});
it.each(["throw", "diagnostic"] as const)("redacts %s loader failure", async (failure) => {
  const { error } = await runtime("production", failure);
  expect(error).toHaveBeenCalledWith("CONFIG_ENV_LOAD_FAILED: invalid environment file");
  expect(JSON.stringify(error.mock.calls)).not.toContain("invented-secret");
});
it("retains explicit test NODE_ENV and variable-only schema failure", async () => {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("APP_RUNTIME_MODE", "invented-invalid");
  loader.load.mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("SIMULATED_EXIT");
  });
  await expect(import("../../scripts/validate-runtime-config.ts")).rejects.toThrow(
    "SIMULATED_EXIT",
  );
  expect(process.env.NODE_ENV).toBe("test");
  expect(error).toHaveBeenCalledWith("CONFIG_RUNTIME_MODE_INVALID: invalid APP_RUNTIME_MODE");
});
it("checks the actual toolchain entrypoint and rejects unsupported npm", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  vi.stubEnv("npm_config_user_agent", "npm/11.19.0 node/v24.21.0");
  // @ts-expect-error The retained JavaScript CLI has no declarations.
  await import("../../scripts/validate-toolchain.mjs");
  expect(log).toHaveBeenCalledWith("TOOLCHAIN_VALID: Node 24.x / npm 11.x");
  vi.resetModules();
  vi.stubEnv("npm_config_user_agent", "npm/10.0.0");
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("SIMULATED_EXIT");
  });
  // @ts-expect-error The retained JavaScript CLI has no declarations.
  await expect(import("../../scripts/validate-toolchain.mjs")).rejects.toThrow("SIMULATED_EXIT");
  expect(error).toHaveBeenCalledWith("TOOLCHAIN_NPM_UNSUPPORTED: required npm 11.x");
});
