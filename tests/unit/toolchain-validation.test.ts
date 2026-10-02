// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve("scripts/validate-toolchain.mjs"), "utf8");

function validate(node: string, userAgent?: string) {
  const logs: string[] = [];
  const errors: string[] = [];
  let exitCode = 0;
  const exited = Symbol("toolchain exited");
  try {
    runInNewContext(source, {
      process: {
        versions: { node },
        env: { npm_config_user_agent: userAgent },
        exit: (code: number) => {
          exitCode = code;
          throw exited;
        },
      },
      console: {
        log: (message: string) => logs.push(message),
        error: (message: string) => errors.push(message),
      },
    });
  } catch (error) {
    if (error !== exited) throw error;
  }
  return { logs, errors, exitCode };
}

describe("supported toolchain diagnostics", () => {
  it("accepts Node 24 and npm 11", () => {
    expect(validate("24.21.0", "npm/11.19.0 node/v24.21.0")).toEqual({
      logs: ["TOOLCHAIN_VALID: Node 24.x / npm 11.x"],
      errors: [],
      exitCode: 0,
    });
  });

  it.each([
    ["26.10.0", "npm/11.19.0", "TOOLCHAIN_NODE_UNSUPPORTED: required Node 24.x"],
    ["24.21.0", "npm/10.0.0", "TOOLCHAIN_NPM_UNSUPPORTED: required npm 11.x"],
    ["24.21.0", undefined, "TOOLCHAIN_NPM_UNSUPPORTED: required npm 11.x"],
  ])("rejects unsupported or absent metadata (%s, %s)", (node, userAgent, diagnostic) => {
    expect(validate(node!, userAgent)).toEqual({ logs: [], errors: [diagnostic], exitCode: 1 });
  });
});
