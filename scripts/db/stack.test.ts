import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { PUBLIC_ENV_FILE, SERVICE_ENV_FILE } from "./common.ts";
import { main as startMain, START_HELP } from "./start.ts";
import { main as stopMain, STOP_HELP } from "./stop.ts";
import {
  ACKNOWLEDGE_ALL_INTERFACES,
  defaultStackDeps,
  findExposedPorts,
  parseStatusValues,
  PROJECT_ID,
  PUBLISHED_PORTS,
  type RunResult,
  type StackDeps,
  startStack,
  stopStack,
  unexpectedServices,
} from "./stack.ts";

// Fake credentials generated for the tests; the real values never appear in this file.
const FAKE_ANON = `eyJ${"a".repeat(14)}.${"b".repeat(14)}.${"c".repeat(14)}`;
const FAKE_SERVICE = `eyJ${"d".repeat(14)}.${"e".repeat(14)}.${"f".repeat(14)}`;
const FAKE_URL = "postgresql://postgres:fake-db-password@127.0.0.1:54322/postgres";
const STATUS = [
  `API_URL="http://127.0.0.1:54321"`,
  `DB_URL="${FAKE_URL}"`,
  `ANON_KEY="${FAKE_ANON}"`,
  `SERVICE_ROLE_KEY="${FAKE_SERVICE}"`,
].join("\n");
const ok = (stdout = ""): RunResult => ({ status: 0, stdout, stderr: "" });
const names = (...kinds: string[]) =>
  kinds.map((kind) => `supabase_${kind}_${PROJECT_ID}`).join("\n");

interface Setup {
  dockerUp?: boolean;
  running?: boolean;
  openLoopbackPorts?: number[];
  exposedPorts?: number[];
  containers?: string;
  startResult?: RunResult;
  statusAfterStart?: RunResult;
  stopResult?: RunResult;
  environment?: Record<string, string>;
}

function fakeDeps(setup: Setup = {}) {
  const lines: string[] = [];
  const commands: string[] = [];
  const files: Record<string, string> = {};
  let started = false;
  let clock = 0;
  const deps: StackDeps = {
    async run(command, args) {
      const text = `${command.split("/").pop()} ${args.join(" ")}`;
      commands.push(text);
      if (command === "docker" && args[0] === "info")
        return setup.dockerUp === false
          ? { status: 1, stdout: "", stderr: "daemon" }
          : ok("29.8.2");
      if (command === "docker" && args[0] === "ps")
        return ok(setup.containers ?? names("db", "kong", "auth", "rest", "inbucket"));
      if (command === "lsof") return ok("p123\ncOtherServer\n");
      if (args[0] === "status") {
        if (started || setup.running) return setup.statusAfterStart ?? ok(STATUS);
        return { status: 1, stdout: "", stderr: "not running" };
      }
      if (args[0] === "start") {
        started = true;
        return setup.startResult ?? ok(`started ${FAKE_ANON}`);
      }
      if (args[0] === "stop") return setup.stopResult ?? ok();
      return ok();
    },
    async isPortOpen(host, port) {
      if (host === "127.0.0.1") return (setup.openLoopbackPorts ?? []).includes(port) && !started;
      return (setup.exposedPorts ?? []).includes(port);
    },
    externalAddresses: () => ["192.168.0.10"],
    writeSecretFile: (path, content) => {
      files[path] = content;
    },
    environment: setup.environment ?? {},
    log: (line) => lines.push(line),
    now: () => (clock += 1000),
    cliPath: "/repo/node_modules/.bin/supabase",
  };
  return { deps, lines, commands, files };
}

describe("start command", () => {
  it("starts the stack, writes the two ignored files and prints a final timing", async () => {
    const fake = fakeDeps();
    assert.equal(await startStack(fake.deps, { allowAllInterfaces: false }), 0);
    assert.ok(fake.commands.some((command) => command.endsWith("supabase start")));
    assert.ok(
      fake.lines.some(
        (line) => line.startsWith("TIMING start ") && line.includes("target 90.0 s: met"),
      ),
    );
    assert.match(fake.files[PUBLIC_ENV_FILE]!, /SUPABASE_URL=http:\/\/127\.0\.0\.1:54321/);
    assert.match(fake.files[PUBLIC_ENV_FILE]!, /DATABASE_SCHEMA=public/);
    assert.match(fake.files[PUBLIC_ENV_FILE]!, /SMTP_HOST=127\.0\.0\.1/);
    assert.match(fake.files[PUBLIC_ENV_FILE]!, new RegExp(`SMTP_PORT=${PUBLISHED_PORTS.smtp}`));
    assert.equal(fake.files[PUBLIC_ENV_FILE]!.includes(FAKE_SERVICE), false);
    assert.ok(fake.files[SERVICE_ENV_FILE]!.includes(`SUPABASE_SERVICE_ROLE_KEY=${FAKE_SERVICE}`));
  });

  it("never prints keys, passwords or connection addresses", async () => {
    for (const setup of [{}, { running: true }, { containers: names("db", "studio") }]) {
      const fake = fakeDeps(setup);
      await startStack(fake.deps, { allowAllInterfaces: false });
      const output = fake.lines.join("\n");
      for (const secret of [FAKE_ANON, FAKE_SERVICE, "fake-db-password", FAKE_URL]) {
        assert.equal(output.includes(secret), false, secret);
      }
    }
  });

  it("redacts keys that the CLI itself prints when it fails to start", async () => {
    const fake = fakeDeps({
      startResult: { status: 1, stdout: `key ${FAKE_ANON}`, stderr: `at ${FAKE_URL}` },
    });
    assert.equal(await startStack(fake.deps, { allowAllInterfaces: false }), 1);
    const output = fake.lines.join("\n");
    assert.match(output, /START FAILED step=start/);
    assert.equal(output.includes(FAKE_ANON), false);
    assert.equal(output.includes("fake-db-password"), false);
  });

  it("stops with a clear message when Docker is not available", async () => {
    const fake = fakeDeps({ dockerUp: false });
    assert.equal(await startStack(fake.deps, { allowAllInterfaces: false }), 1);
    assert.match(fake.lines.join("\n"), /step=docker: Docker is not available/);
    assert.equal(
      fake.commands.some((command) => command.endsWith("supabase start")),
      false,
    );
  });

  it("names the port and the process when a port is already in use", async () => {
    const fake = fakeDeps({ openLoopbackPorts: [PUBLISHED_PORTS.database] });
    assert.equal(await startStack(fake.deps, { allowAllInterfaces: false }), 1);
    const output = fake.lines.join("\n");
    assert.match(
      output,
      new RegExp(`Port ${PUBLISHED_PORTS.database} is already in use by the process "OtherServer"`),
    );
  });

  it("verifies an already running stack instead of starting a second one", async () => {
    const fake = fakeDeps({ running: true });
    assert.equal(await startStack(fake.deps, { allowAllInterfaces: false }), 0);
    assert.equal(
      fake.commands.some((command) => command.endsWith("supabase start")),
      false,
    );
    assert.ok(fake.lines.some((line) => line.includes("already running")));
  });

  it("fails when the status lacks a value", async () => {
    const fake = fakeDeps({ statusAfterStart: ok(`API_URL="http://127.0.0.1:54321"`) });
    assert.equal(await startStack(fake.deps, { allowAllInterfaces: false }), 1);
    assert.match(fake.lines.join("\n"), /step=status/);
  });

  it("fails when the status command itself fails", async () => {
    const fake = fakeDeps({
      running: true,
      statusAfterStart: { status: 2, stdout: "", stderr: "broken" },
    });
    // The first status call decides "running"; make the second one fail.
    let calls = 0;
    const original = fake.deps.run;
    fake.deps.run = async (command, args) => {
      if (args[0] === "status" && ++calls === 2)
        return { status: 2, stdout: "", stderr: `bad ${FAKE_ANON}` };
      return original(command, args);
    };
    assert.equal(await startStack(fake.deps, { allowAllInterfaces: false }), 1);
    assert.equal(fake.lines.join("\n").includes(FAKE_ANON), false);
  });

  it("stops and fails when a service outside the intended set is running", async () => {
    const fake = fakeDeps({
      containers: names("db", "kong", "auth", "rest", "inbucket", "studio"),
    });
    assert.equal(await startStack(fake.deps, { allowAllInterfaces: false }), 1);
    assert.match(fake.lines.join("\n"), /Unexpected services are running: supabase_studio_/);
  });

  it("fails closed and stops the stack when the ports are reachable from other addresses", async () => {
    const fake = fakeDeps({ exposedPorts: [PUBLISHED_PORTS.database] });
    assert.equal(await startStack(fake.deps, { allowAllInterfaces: false }), 1);
    const output = fake.lines.join("\n");
    assert.match(output, /step=network/);
    assert.match(output, new RegExp(ACKNOWLEDGE_ALL_INTERFACES));
    assert.ok(fake.commands.some((command) => command.endsWith("supabase stop")));
    assert.equal(Object.keys(fake.files).length, 0);
  });

  it("continues with a warning when the exposure is acknowledged", async () => {
    const fake = fakeDeps({ exposedPorts: [PUBLISHED_PORTS.api] });
    assert.equal(await startStack(fake.deps, { allowAllInterfaces: true }), 0);
    assert.ok(fake.lines.some((line) => line.startsWith("WARNING: ports are reachable")));
  });

  it("main reads the acknowledgement from the flag or the environment and shows help", async () => {
    const flagged = fakeDeps({ exposedPorts: [PUBLISHED_PORTS.api] });
    assert.equal(await startMain(["--allow-all-interfaces"], flagged.deps), 0);
    const environment = fakeDeps({
      exposedPorts: [PUBLISHED_PORTS.api],
      environment: { [ACKNOWLEDGE_ALL_INTERFACES]: "1" },
    });
    assert.equal(await startMain([], environment.deps), 0);
    const refused = fakeDeps({ exposedPorts: [PUBLISHED_PORTS.api] });
    assert.equal(await startMain([], refused.deps), 1);
    const help = fakeDeps();
    assert.equal(await startMain(["--help"], help.deps), 0);
    assert.equal(help.lines[0], START_HELP);
  });
});

describe("stop command", () => {
  it("stops the stack and prints a timing", async () => {
    const fake = fakeDeps();
    assert.equal(await stopStack(fake.deps), 0);
    assert.ok(fake.commands.some((command) => command.endsWith("supabase stop")));
    assert.ok(fake.lines.some((line) => line.startsWith("TIMING stop ")));
  });

  it("reports a failure with the step and a redacted message", async () => {
    const fake = fakeDeps({
      stopResult: { status: 1, stdout: "", stderr: `fail ${FAKE_SERVICE}` },
    });
    assert.equal(await stopStack(fake.deps), 1);
    const output = fake.lines.join("\n");
    assert.match(output, /STOP FAILED step=stop/);
    assert.equal(output.includes(FAKE_SERVICE), false);
  });

  it("main stops or prints help", async () => {
    const fake = fakeDeps();
    assert.equal(await stopMain([], fake.deps), 0);
    const help = fakeDeps();
    assert.equal(await stopMain(["--help"], help.deps), 0);
    assert.equal(help.lines[0], STOP_HELP);
  });
});

describe("stack helpers", () => {
  it("parses the status values and names what is missing", () => {
    assert.deepEqual(parseStatusValues(STATUS), {
      apiUrl: "http://127.0.0.1:54321",
      databaseUrl: FAKE_URL,
      publicKey: FAKE_ANON,
      serviceKey: FAKE_SERVICE,
    });
    assert.throws(() => parseStatusValues(`API_URL=x`), /DB_URL, ANON_KEY, SERVICE_ROLE_KEY/);
  });

  it("lists only containers of this project that are not intended services", () => {
    const list = [
      ...names("db", "kong", "auth", "rest", "inbucket", "studio", "realtime").split("\n"),
      "supabase_db_other-project",
      "unrelated",
    ];
    assert.deepEqual(unexpectedServices(list), [
      `supabase_studio_${PROJECT_ID}`,
      `supabase_realtime_${PROJECT_ID}`,
    ]);
  });

  it("finds exposed ports per external address", async () => {
    const fake = fakeDeps({ exposedPorts: [PUBLISHED_PORTS.api, PUBLISHED_PORTS.mail] });
    assert.deepEqual(await findExposedPorts(fake.deps), [
      { port: PUBLISHED_PORTS.api, address: "192.168.0.10" },
      { port: PUBLISHED_PORTS.mail, address: "192.168.0.10" },
    ]);
    assert.deepEqual(await findExposedPorts(fakeDeps().deps), []);
  });
});

describe("default dependencies", () => {
  it("runs a real command and reports a missing command as a failed run", async () => {
    const deps = defaultStackDeps();
    const good = await deps.run(process.execPath, [
      "-e",
      "console.log('hello'); console.error('warn')",
    ]);
    assert.equal(good.status, 0);
    assert.equal(good.stdout.trim(), "hello");
    assert.equal(good.stderr.trim(), "warn");
    const missing = await deps.run("definitely-not-a-command-xyz", []);
    assert.equal(missing.status, null);
  });

  it("detects an open and a closed local port", async () => {
    const deps = defaultStackDeps();
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    try {
      assert.equal(await deps.isPortOpen("127.0.0.1", port), true);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
    assert.equal(await deps.isPortOpen("127.0.0.1", port), false);
  });

  it("lists external IPv4 addresses and writes secret files readable only by the owner", () => {
    const deps = defaultStackDeps();
    for (const address of deps.externalAddresses()) assert.match(address, /^\d+\.\d+\.\d+\.\d+$/);
    const directory = mkdtempSync(join(tmpdir(), "stack-files-"));
    try {
      const path = join(directory, "secret.env");
      deps.writeSecretFile(path, "A=1\n");
      assert.equal(readFileSync(path, "utf8"), "A=1\n");
      assert.equal(statSync(path).mode & 0o777, 0o600);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
    assert.ok(deps.cliPath.endsWith("node_modules/.bin/supabase"));
    assert.equal(typeof deps.now(), "number");
  });
});
