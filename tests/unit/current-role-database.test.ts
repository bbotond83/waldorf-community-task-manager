// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";

const seams = vi.hoisted(() => ({
  exec: vi.fn(),
  access: vi.fn(),
  temporary: vi.fn(),
  mkdir: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("node:child_process", () => ({ execFile: seams.exec }));
vi.mock("node:fs/promises", () => ({
  access: seams.access,
  mkdtemp: seams.temporary,
  mkdir: seams.mkdir,
  rm: seams.remove,
}));
import {
  createRoleDatabase,
  postgresBinaries,
} from "../../scripts/verification/current-role-database.ts";

beforeEach(() => {
  vi.clearAllMocks();
  seams.access.mockResolvedValue(undefined);
  seams.temporary.mockResolvedValue("/private/tmp/roles-db-owned");
  seams.mkdir.mockResolvedValue(undefined);
  seams.remove.mockResolvedValue(undefined);
  seams.exec.mockImplementation((binary, args, _options, callback) => {
    callback(
      null,
      binary.endsWith("psql") && args.includes("--version") ? "psql (PostgreSQL) 18.6\n" : "\n",
      "",
    );
  });
});

it("requires executable supported tool paths and rejects relative paths", async () => {
  expect((await postgresBinaries("/invented/bin")).psql).toBe("/invented/bin/psql");
  await expect(postgresBinaries("relative")).rejects.toThrow("ABSOLUTE_DIRECTORY");
  expect(seams.access).toHaveBeenCalledTimes(3);
});
it("fails explicitly when tools are absent, never skipping a check", async () => {
  seams.access.mockRejectedValue(new Error("missing"));
  await expect(postgresBinaries("/missing")).rejects.toThrow("POSTGRES_TOOLS_UNAVAILABLE");
});
it("resolves default toolchain and creates a private socket-only fresh cluster", async () => {
  const cluster = await createRoleDatabase();
  expect(cluster.version).toBe("psql (PostgreSQL) 18.6");
  const calls = seams.exec.mock.calls;
  expect(calls[0]![1]).toContain("--auth-host=reject");
  expect(calls[1]![1]).toContain(
    "-F -k /private/tmp/roles-db-owned/socket -h '' -p 55439 -c unix_socket_permissions=0700",
  );
  expect(calls[0]![2].env).not.toHaveProperty("PGPASSWORD");
  expect(calls[0]![2].env).not.toHaveProperty("DATABASE_URL");
  await cluster.close();
});
it("pins every query to its private socket/user and validates database identifiers", async () => {
  const cluster = await createRoleDatabase("/invented/bin");
  await cluster.query("SELECT 1", "case_1");
  const call = seams.exec.mock.calls.at(-1)!;
  expect(call[1]).toContain("/private/tmp/roles-db-owned/socket");
  expect(call[1]).toContain("ON_ERROR_STOP=1");
  expect(call[2].env.PGOPTIONS).toBe("-c statement_timeout=8000 -c lock_timeout=5000");
  expect(() => cluster.query("SELECT 1", "live-host;evil")).toThrow(
    "INVALID_DISPOSABLE_DATABASE_NAME",
  );
  await cluster.query("SELECT 1");
  await cluster.close();
});
it("stops server before removing owned directory, and close is idempotent", async () => {
  const cluster = await createRoleDatabase("/invented/bin");
  await cluster.close();
  await cluster.close();
  expect(seams.exec.mock.calls.filter((call) => call[1].includes("stop"))).toHaveLength(1);
  expect(seams.remove).toHaveBeenCalledWith(cluster.temporary, { recursive: true, force: true });
});
it("keeps diagnosis directory if shutdown fails instead of removing a live cluster", async () => {
  const cluster = await createRoleDatabase("/invented/bin");
  seams.exec.mockImplementation((_binary, args, _options, callback) =>
    callback(args.includes("stop") ? new Error("stop failed") : null, "", ""),
  );
  await expect(cluster.close()).rejects.toThrow("stop failed");
  expect(seams.remove).not.toHaveBeenCalled();
});
it("rejects unsupported version and cleans up its started cluster", async () => {
  seams.exec.mockImplementation((_binary, args, _options, callback) =>
    callback(null, args.includes("--version") ? "psql (PostgreSQL) 17.9" : "", ""),
  );
  await expect(createRoleDatabase("/invented/bin")).rejects.toThrow("VERSION_UNSUPPORTED");
  expect(seams.remove).toHaveBeenCalled();
});
it("checks authoritative status after start timeout and stops a server that did start", async () => {
  seams.exec.mockImplementation((_binary, args, _options, callback) =>
    callback(args.includes("start") ? new Error("readiness timeout") : null, "", ""),
  );
  await expect(createRoleDatabase("/invented/bin")).rejects.toThrow("readiness timeout");
  expect(seams.exec.mock.calls.some((call) => call[1].includes("status"))).toBe(true);
  expect(seams.exec.mock.calls.some((call) => call[1].includes("stop"))).toBe(true);
  expect(seams.remove).toHaveBeenCalled();
});
it("removes failed initialization directory when no server exists", async () => {
  seams.exec.mockImplementation((_binary, args, _options, callback) =>
    callback(
      args.includes("status") ? new Error("not running") : new Error("init failure"),
      "",
      "",
    ),
  );
  await expect(createRoleDatabase("/invented/bin")).rejects.toThrow("init failure");
  expect(seams.remove).toHaveBeenCalled();
});
it("surfaces both setup and cleanup errors and preserves running diagnosis data", async () => {
  seams.exec.mockImplementation((_binary, args, _options, callback) =>
    callback(args.includes("status") ? null : new Error("setup or stop failed"), "", ""),
  );
  await expect(createRoleDatabase("/invented/bin")).rejects.toThrow("SETUP_AND_CLEANUP_FAILED");
  expect(seams.remove).not.toHaveBeenCalled();
});
