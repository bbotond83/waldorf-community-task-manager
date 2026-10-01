import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const port = Number(process.env.SMOKE_PORT ?? 3210);
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 30_000);
const baseUrl = `http://127.0.0.1:${port}`;
const environment = {
  ...process.env,
  APP_RUNTIME_MODE: "synthetic",
  APP_SYNTHETIC_FIXTURE_VERSION: "waldorf-local-v1",
  APP_HOST: "127.0.0.1",
  APP_PORT: String(port),
};
// Preserve the prestart checks while owning the server process directly.
// Killing an npm wrapper can leave Next.js holding the captured output pipes.
execFileSync(process.execPath, ["scripts/validate-toolchain.mjs"], {
  env: environment,
  stdio: "inherit",
});
execFileSync(
  process.execPath,
  ["--experimental-strip-types", "scripts/validate-runtime-config.ts"],
  { env: environment, stdio: "inherit" },
);
const child = spawn(
  process.execPath,
  [
    fileURLToPath(import.meta.resolve("next/dist/bin/next")),
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    env: {
      ...environment,
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);

let output = "";
child.stdout.on("data", (chunk) => {
  output += String(chunk);
});
child.stderr.on("data", (chunk) => {
  output += String(chunk);
});

async function waitForReadiness() {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`SMOKE_START_EXITED: ${child.exitCode}`);
    }
    try {
      const readiness = await fetch(`${baseUrl}/api/readiness`);
      const root = await fetch(baseUrl);
      const rootBody = await root.text();
      if (readiness.ok && root.ok && rootBody.includes("Helyi tesztprofil kiválasztása")) {
        return;
      }
    } catch {
      // The loop retries until the documented timeout; no error detail is exposed.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("SMOKE_START_TIMEOUT");
}

try {
  await waitForReadiness();
  console.log("SMOKE_START_OK: waldorf-local-ready");
} catch (error) {
  const safeMessage = error instanceof Error ? error.message : "SMOKE_START_FAILED";
  console.error(safeMessage);
  console.error(output.slice(-2_000));
  process.exitCode = 1;
} finally {
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 2_000))]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await exited;
  }
  child.stdout.destroy();
  child.stderr.destroy();
}
