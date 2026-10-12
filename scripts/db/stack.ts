import { spawn } from "node:child_process";
import { chmodSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { redactSecrets } from "../../src/runtime/database/redact.ts";
import {
  DEFAULT_SCHEMA,
  formatEnvFile,
  type Log,
  parseEnvFile,
  PUBLIC_ENV_FILE,
  SERVICE_ENV_FILE,
  TARGETS_MS,
  timingLine,
  ToolingError,
} from "./common.ts";

/**
 * Start and stop of the local stack (BR1.1). The stack is the Supabase CLI's local development
 * stack, pinned in package.json: Postgres, the sign-in service, the data API gateway and the mail
 * catcher. Nothing is mocked: if Docker is missing the command stops and says so.
 */
export const PUBLISHED_PORTS = { api: 54321, database: 54322, mail: 54324 } as const;
/** The only services that may run; the others are switched off in supabase/config.toml. */
export const ALLOWED_SERVICES = ["db", "kong", "auth", "rest", "inbucket", "mailpit"] as const;
export const PROJECT_ID = "waldorf-community-task-manager";
export const ACKNOWLEDGE_ALL_INTERFACES = "DB_ALLOW_ALL_INTERFACES";

export interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

export interface StackDeps {
  run: (command: string, args: readonly string[]) => Promise<RunResult>;
  isPortOpen: (host: string, port: number) => Promise<boolean>;
  externalAddresses: () => string[];
  writeSecretFile: (path: string, content: string) => void;
  environment: Readonly<Record<string, string | undefined>>;
  log: Log;
  now: () => number;
  cliPath: string;
}

export function defaultStackDeps(): StackDeps {
  return {
    run: (command, args) =>
      new Promise((resolve) => {
        const child = spawn(command, [...args], { stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (chunk) => (stdout += String(chunk)));
        child.stderr.on("data", (chunk) => (stderr += String(chunk)));
        child.on("error", (error) =>
          resolve({ status: null, stdout, stderr: String(error.message) }),
        );
        child.on("close", (status) => resolve({ status, stdout, stderr }));
      }),
    isPortOpen: (host, port) =>
      new Promise((resolve) => {
        const socket = connect({ host, port, timeout: 1500 });
        socket.once("connect", () => {
          socket.destroy();
          resolve(true);
        });
        socket.once("error", () => resolve(false));
        socket.once("timeout", () => {
          socket.destroy();
          resolve(false);
        });
      }),
    externalAddresses: () =>
      Object.values(networkInterfaces())
        .flatMap((entries) => entries ?? [])
        .filter((entry) => entry.family === "IPv4" && !entry.internal)
        .map((entry) => entry.address),
    writeSecretFile: (path, content) => {
      writeFileSync(path, content, { mode: 0o600 });
      chmodSync(path, 0o600);
    },
    environment: process.env,
    log: (line) => console.log(line),
    now: () => Date.now(),
    cliPath: fileURLToPath(new URL("../../node_modules/.bin/supabase", import.meta.url)),
  };
}

export interface StackValues {
  apiUrl: string;
  databaseUrl: string;
  publicKey: string;
  serviceKey: string;
}

/** Reads `supabase status -o env`; the values stay in memory and in the ignored files. */
export function parseStatusValues(stdout: string): StackValues {
  const values = parseEnvFile(stdout);
  const missing = ["API_URL", "DB_URL", "ANON_KEY", "SERVICE_ROLE_KEY"].filter(
    (name) => !values[name],
  );
  if (missing.length > 0) {
    throw new ToolingError("status", `The stack status lacks ${missing.join(", ")}.`, {
      setting: missing.join(","),
    });
  }
  return {
    apiUrl: values.API_URL!,
    databaseUrl: values.DB_URL!,
    publicKey: values.ANON_KEY!,
    serviceKey: values.SERVICE_ROLE_KEY!,
  };
}

/** Containers of this project that are not one of the intended services. */
export function unexpectedServices(containerNames: readonly string[]): string[] {
  const prefix = "supabase_";
  const suffix = `_${PROJECT_ID}`;
  return containerNames
    .filter((name) => name.startsWith(prefix) && name.endsWith(suffix))
    .filter((name) => {
      const kind = name.slice(prefix.length, name.length - suffix.length);
      return !(ALLOWED_SERVICES as readonly string[]).includes(kind);
    });
}

async function portHolder(deps: StackDeps, port: number): Promise<string> {
  const result = await deps.run("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fc"]);
  const line = result.stdout.split("\n").find((entry) => entry.startsWith("c"));
  return line ? `the process "${line.slice(1)}"` : "another process";
}

/** Addresses of this machine (other than loopback) on which a published port answers. */
export async function findExposedPorts(
  deps: StackDeps,
): Promise<{ port: number; address: string }[]> {
  const exposed: { port: number; address: string }[] = [];
  for (const address of deps.externalAddresses()) {
    for (const port of Object.values(PUBLISHED_PORTS)) {
      if (await deps.isPortOpen(address, port)) exposed.push({ port, address });
    }
  }
  return exposed;
}

async function cli(deps: StackDeps, args: readonly string[]): Promise<RunResult> {
  return deps.run(deps.cliPath, args);
}

function tail(text: string, lines = 12): string {
  return text.trim().split("\n").slice(-lines).join("\n");
}

export async function startStack(
  deps: StackDeps,
  options: { allowAllInterfaces: boolean },
): Promise<number> {
  const started = deps.now();
  const { log } = deps;
  const secrets: string[] = [];
  try {
    log("[1/7] checking that Docker is available");
    const docker = await deps.run("docker", ["info", "--format", "{{.ServerVersion}}"]);
    if (docker.status !== 0) {
      throw new ToolingError(
        "docker",
        "Docker is not available. Start Docker Desktop and run the command again.",
      );
    }

    log("[2/7] checking ports");
    const running = (await cli(deps, ["status", "-o", "env"])).status === 0;
    if (running) {
      log("the stack is already running; verifying it");
    } else {
      for (const port of Object.values(PUBLISHED_PORTS)) {
        if (await deps.isPortOpen("127.0.0.1", port)) {
          throw new ToolingError(
            "ports",
            `Port ${port} is already in use by ${await portHolder(deps, port)}. Stop it and run the command again.`,
            { port: String(port) },
          );
        }
      }
      log("[3/7] starting Postgres, the sign-in service, the data API and the mail catcher");
      const start = await cli(deps, ["start"]);
      if (start.status !== 0) {
        throw new ToolingError("start", redactSecrets(tail(`${start.stdout}\n${start.stderr}`)));
      }
    }

    log("[4/7] reading the stack status");
    const status = await cli(deps, ["status", "-o", "env"]);
    if (status.status !== 0) {
      throw new ToolingError("status", redactSecrets(tail(`${status.stdout}\n${status.stderr}`)));
    }
    const values = parseStatusValues(status.stdout);
    secrets.push(values.publicKey, values.serviceKey, values.databaseUrl);

    log("[5/7] checking that only the intended services run");
    const containers = await deps.run("docker", ["ps", "--format", "{{.Names}}"]);
    const extra = unexpectedServices(containers.stdout.split("\n").map((line) => line.trim()));
    if (extra.length > 0) {
      throw new ToolingError("services", `Unexpected services are running: ${extra.join(", ")}.`);
    }

    log("[6/7] checking that the published ports are reachable on this machine only");
    const exposed = await findExposedPorts(deps);
    if (exposed.length > 0) {
      const detail = [...new Set(exposed.map((entry) => `${entry.address}:${entry.port}`))].join(
        ", ",
      );
      if (!options.allowAllInterfaces) {
        await cli(deps, ["stop"]);
        throw new ToolingError(
          "network",
          `The Supabase CLI publishes its ports on all network interfaces (reachable at ${detail}). ` +
            `The stack uses the CLI's well-known default keys, so anyone on the network could use it. ` +
            `The stack was stopped (data kept). Block inbound connections to ports ` +
            `${Object.values(PUBLISHED_PORTS).join(", ")} with a host firewall rule, then run the command ` +
            `with ${ACKNOWLEDGE_ALL_INTERFACES}=1 to acknowledge.`,
          { ports: Object.values(PUBLISHED_PORTS).join(",") },
        );
      }
      log(
        `WARNING: ports are reachable at ${detail}; running because ${ACKNOWLEDGE_ALL_INTERFACES}=1 acknowledges a host firewall rule`,
      );
    }

    log("[7/7] writing the local environment files");
    deps.writeSecretFile(
      PUBLIC_ENV_FILE,
      formatEnvFile(
        "Written by npm run db:start. Address and public key of the local stack (git-ignored).",
        {
          SUPABASE_URL: values.apiUrl,
          SUPABASE_ANON_KEY: values.publicKey,
          DATABASE_SCHEMA: DEFAULT_SCHEMA,
        },
      ),
    );
    deps.writeSecretFile(
      SERVICE_ENV_FILE,
      formatEnvFile(
        "Written by npm run db:start. Tooling only; the application never reads this file (git-ignored).",
        {
          DATABASE_URL: values.databaseUrl,
          SUPABASE_SERVICE_ROLE_KEY: values.serviceKey,
        },
      ),
    );
    log(
      `Local stack is running. Data API: ${values.apiUrl}  Database: 127.0.0.1:${PUBLISHED_PORTS.database}  ` +
        `Mail catcher: http://127.0.0.1:${PUBLISHED_PORTS.mail}`,
    );
    log(`Address and public key are in ${PUBLIC_ENV_FILE}; tooling values in ${SERVICE_ENV_FILE}.`);
    log(timingLine("start", deps.now() - started, TARGETS_MS.start));
    return 0;
  } catch (error) {
    const message =
      error instanceof ToolingError ? `step=${error.step}: ${error.message}` : String(error);
    log(`START FAILED ${redactSecrets(message, secrets)}`);
    log(timingLine("start (failed)", deps.now() - started));
    return 1;
  }
}

export async function stopStack(deps: StackDeps): Promise<number> {
  const started = deps.now();
  deps.log("[1/1] stopping the local stack (data is kept)");
  const result = await cli(deps, ["stop"]);
  if (result.status !== 0) {
    deps.log(`STOP FAILED step=stop: ${redactSecrets(tail(`${result.stdout}\n${result.stderr}`))}`);
    deps.log(timingLine("stop (failed)", deps.now() - started));
    return 1;
  }
  deps.log(timingLine("stop", deps.now() - started));
  return 0;
}
