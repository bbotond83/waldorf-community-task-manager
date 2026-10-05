import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
export { assertLoginDuration, measureProfileLogin } from "./profile-login-measurement.ts";

async function restoreGeneratedTypes(distDir: string, previousEnv: string) {
  const configPath = "tsconfig.json";
  const configText = await readFile(configPath, "utf8");
  const config = JSON.parse(configText) as { include: string[] };
  // Remove only this owned server's generated entries, preserving other edits.
  const filtered = config.include.filter((path) => !path.startsWith(`${distDir}/`));
  if (filtered.length !== config.include.length) {
    config.include = filtered;
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  }
  const envText = await readFile("next-env.d.ts", "utf8");
  if (envText.includes(`./${distDir}/`)) {
    const priorImports = previousEnv.split("\n").filter((line) => line.startsWith("import "));
    const restored = envText
      .split("\n")
      .map((line) => {
        if (!line.includes(`./${distDir}/`)) return line;
        const file = line.match(/\/([^/]+\.d\.ts)"/)?.[1];
        const previous = priorImports.find((candidate) => file && candidate.includes(`/${file}"`));
        if (!previous) throw new Error(`Cannot restore generated type import: ${line}`);
        return previous;
      })
      .join("\n");
    await writeFile("next-env.d.ts", restored);
  }
}

export async function startLoginServer(mode: "development" | "production", port: number) {
  const previousEnv = await readFile("next-env.d.ts", "utf8");
  const distDir = `.next/login-performance-${process.pid}-${Date.now()}`;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    APP_RUNTIME_MODE: "synthetic",
    APP_PORT: String(port),
  };
  delete env.APP_LOGIN_TEST_DIST_DIR;
  if (mode === "development") env.APP_LOGIN_TEST_DIST_DIR = distDir;
  const child = spawn(
    "npm",
    [
      "run",
      mode === "development" ? "dev" : "start",
      ...(mode === "development" ? ["--", "--port", String(port)] : []),
    ],
    { env, detached: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  let hasClosed = false;
  const closed = new Promise<void>((resolve) =>
    child.once("close", () => {
      hasClosed = true;
      resolve();
    }),
  );
  const waitForClose = () =>
    new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 5000);
      closed.then(() => {
        clearTimeout(timeout);
        resolve(true);
      });
    });
  let output = "";
  child.stdout.on("data", (data: Buffer) => {
    output += data.toString();
  });
  child.stderr.on("data", (data: Buffer) => {
    output += data.toString();
  });
  let spawnError: Error | undefined;
  child.once("error", (error) => {
    spawnError = error;
  });
  const stop = async () => {
    // `close` also waits for inherited server output descriptors; npm exit alone does not.
    if (child.pid && !hasClosed) {
      process.kill(-child.pid, "SIGTERM");
      if (!(await waitForClose())) {
        process.kill(-child.pid, "SIGKILL");
        if (!(await waitForClose())) throw new Error("Owned login server did not close");
      }
    }
    if (mode === "development") await restoreGeneratedTypes(distDir, previousEnv);
  };
  const origin = `http://127.0.0.1:${port}`;
  try {
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      if (spawnError || child.exitCode !== null || child.signalCode !== null) {
        throw new Error(`Login server exited: ${spawnError?.message ?? ""}\n${output}`);
      }
      try {
        if ((await fetch(`${origin}/api/readiness`, { signal: AbortSignal.timeout(2000) })).ok) {
          return {
            origin,
            stop,
            output: () => output,
            cache: mode === "development" ? distDir : "prebuilt fresh process",
          };
        }
      } catch (error) {
        if (!(error instanceof TypeError) && !(error instanceof DOMException)) throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`Login server readiness timed out\n${output}`);
  } catch (error) {
    await stop();
    throw error;
  }
}
