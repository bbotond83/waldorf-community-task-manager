// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
const calls = vi.hoisted(() => ({ exec: vi.fn(), spawn: vi.fn() }));
vi.mock("node:child_process", () => ({ execFileSync: calls.exec, spawn: calls.spawn }));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
  process.exitCode = 0;
});
async function runSmoke(outcome: "ready" | "exited" | "timeout", forceKill = false) {
  const child = new EventEmitter() as EventEmitter & {
    exitCode: number | null;
    signalCode: string | null;
    stdout: EventEmitter & { destroy: ReturnType<typeof vi.fn> };
    stderr: EventEmitter & { destroy: ReturnType<typeof vi.fn> };
    kill: ReturnType<typeof vi.fn>;
  };
  child.exitCode = outcome === "exited" ? 7 : null;
  child.signalCode = null;
  child.stdout = Object.assign(new EventEmitter(), { destroy: vi.fn() });
  child.stderr = Object.assign(new EventEmitter(), { destroy: vi.fn() });
  child.kill = vi.fn((signal: string) => {
    if (!forceKill || signal === "SIGKILL") {
      child.signalCode = signal;
      child.emit("exit", 0);
    }
  });
  calls.spawn.mockReturnValue(child);
  calls.exec.mockReturnValue(undefined);
  vi.stubEnv("SMOKE_TIMEOUT_MS", "1");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      text: async () => (url.endsWith("/api/readiness") ? "" : "Helyi tesztprofil kiválasztása"),
    })),
  );
  const originalTimer = setTimeout;
  vi.spyOn(globalThis, "setTimeout").mockImplementation(((callback: () => void) =>
    originalTimer(callback, 0)) as typeof setTimeout);
  const now = Date.now();
  let sequence = 0;
  vi.spyOn(Date, "now").mockImplementation(() =>
    outcome === "timeout" ? now + sequence++ * 10 : now,
  );
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  // @ts-expect-error The retained executable script has no declarations.
  await import("../../scripts/start-smoke.mjs");
  return { child, log, error };
}
it("verifies root readiness and cleans owned server streams", async () => {
  const { child, log } = await runSmoke("ready");
  expect(log).toHaveBeenCalledWith("SMOKE_START_OK: waldorf-local-ready");
  expect(calls.exec).toHaveBeenCalledTimes(2);
  expect(calls.spawn.mock.calls[0]![1]).toContain("start");
  expect(child.kill).toHaveBeenCalledWith("SIGTERM");
  expect(child.stdout.destroy).toHaveBeenCalled();
  expect(child.stderr.destroy).toHaveBeenCalled();
});
it("reports exited child without false readiness", async () => {
  const { child, error } = await runSmoke("exited");
  expect(error).toHaveBeenCalledWith("SMOKE_START_EXITED: 7");
  expect(process.exitCode).toBe(1);
  expect(child.kill).toHaveBeenCalledWith("SIGTERM");
});
it("reports timeout and force kills an unresponsive owned child", async () => {
  const { child, error } = await runSmoke("timeout", true);
  expect(error).toHaveBeenCalledWith("SMOKE_START_TIMEOUT");
  expect(child.kill).toHaveBeenCalledWith("SIGKILL");
  expect(child.stdout.destroy).toHaveBeenCalled();
});
