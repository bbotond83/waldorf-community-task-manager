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
async function runSmoke(
  outcome: "ready" | "exited" | "timeout" | "old-route",
  forceKill = false,
) {
  const child = new EventEmitter() as EventEmitter & {
    exitCode: number | null;
    signalCode: string | null;
    stdout: EventEmitter & { destroy: ReturnType<typeof vi.fn> };
    stderr: EventEmitter & { destroy: ReturnType<typeof vi.fn> };
    kill: ReturnType<typeof vi.fn>;
  };
  calls.exec.mockReset();
  calls.spawn.mockReset();
  const requests: string[] = [];
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
    vi.fn().mockImplementation(async (url: string) => {
      const removed = /\/api\/synthetic\/|\/belepes$/.test(url);
      const status = removed && outcome !== "old-route" ? 404 : 200;
      requests.push(url);
      return {
        ok: status === 200,
        status,
        text: async () => (url.endsWith("/api/readiness") ? "" : "Biztonságos bejelentkezés"),
      };
    }),
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
  return { child, log, error, requests };
}
it("supplies the three runtime settings to the build when the shell gives none", async () => {
  vi.stubEnv("APP_SESSION_SECRET", "");
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_ANON_KEY", "");
  await runSmoke("ready");
  const environment = calls.exec.mock.calls[0]![2].env as Record<string, string>;
  expect(environment.APP_SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
  expect(environment.SUPABASE_URL).toBe("http://127.0.0.1:54321");
  expect(environment.SUPABASE_ANON_KEY.length).toBeGreaterThanOrEqual(20);
  expect("APP_RUNTIME_MODE" in environment).toBe(false);
});
it("keeps real runtime settings from the shell", async () => {
  vi.stubEnv("SUPABASE_URL", "http://localhost:54321");
  await runSmoke("ready");
  const environment = calls.exec.mock.calls[0]![2].env as Record<string, string>;
  expect(environment.SUPABASE_URL).toBe("http://localhost:54321");
});
it("asks the old demo routes and requires each to answer not found", async () => {
  const { requests, log } = await runSmoke("ready");
  for (const path of ["/api/synthetic/session", "/api/synthetic/reset", "/belepes"]) {
    expect(requests.some((url) => url.endsWith(path))).toBe(true);
  }
  expect(log).toHaveBeenCalledWith("SMOKE_START_OK: waldorf-local-ready");
});
it("fails when an old demo route still answers", async () => {
  const { error } = await runSmoke("old-route");
  expect(error).toHaveBeenCalledWith(
    expect.stringContaining("SMOKE_REMOVED_ROUTE_PRESENT: POST /api/synthetic/session answered 200"),
  );
  expect(process.exitCode).toBe(1);
});
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
