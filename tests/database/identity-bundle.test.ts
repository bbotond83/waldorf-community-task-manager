import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { describe, it } from "node:test";
import { root, serviceKey } from "./stack-support.ts";

/**
 * The bundle test (NFR1.5, BR2.23): the production build's browser output never contains the sign-in
 * service's service-role key, its name, or the server-only admin modules. Needs the build: run
 * `npm run build` first (the verification pipeline does).
 */
function filesUnder(directory: string, found: string[] = []): string[] {
  for (const name of readdirSync(directory)) {
    const path = `${directory}/${name}`;
    if (statSync(path).isDirectory()) filesUnder(path, found);
    else found.push(path);
  }
  return found;
}

const CLIENT_OUTPUT = `${root}.next/static`;
const SERVER_OUTPUT = `${root}.next/server`;

/** Markers that must never reach the browser: the key's name and the code that handles it. */
const FORBIDDEN_IN_BROWSER = [
  "SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE",
  "admin-runtime",
  "admin-client",
  "createAdminAccess",
  "ADMIN_FUNCTION_NOT_ALLOWED",
  "ADMIN_ACCESS_UNAVAILABLE",
  "getIdentityRuntime",
  "invitation_accept",
  "sessions_remove",
];

describe("the production bundle (NFR1.5)", () => {
  it("has a build to scan", () => {
    assert.ok(existsSync(CLIENT_OUTPUT), "run `npm run build` first");
    assert.ok(filesUnder(CLIENT_OUTPUT).length > 5);
  });

  it("keeps the service-role key, its name and the admin modules out of every browser file", () => {
    const key = serviceKey();
    const offenders: string[] = [];
    for (const path of filesUnder(CLIENT_OUTPUT)) {
      if (!/\.(js|css|map|html|json|txt)$/.test(path)) continue;
      const text = readFileSync(path, "utf8");
      for (const marker of [...FORBIDDEN_IN_BROWSER, key]) {
        if (text.includes(marker))
          offenders.push(
            `${path.slice(root.length)} contains ${marker === key ? "the key value" : marker}`,
          );
      }
    }
    assert.deepEqual(offenders, []);
  });

  it("finds the admin modules in the server output, so the scan is meaningful", () => {
    const server = filesUnder(SERVER_OUTPUT).filter((path) => path.endsWith(".js"));
    assert.ok(
      server.some((path) => readFileSync(path, "utf8").includes("ADMIN_FUNCTION_NOT_ALLOWED")),
      "the server build holds the admin client",
    );
  });

  it("never writes the key value into the server output either (it is read at run time, never inlined)", () => {
    const key = serviceKey();
    const inlined = filesUnder(`${root}.next`)
      .filter((path) => /\.(js|json|html|txt|map)$/.test(path) && !path.includes("/cache/"))
      .filter((path) => readFileSync(path, "utf8").includes(key));
    assert.deepEqual(
      inlined.map((path) => path.slice(root.length)),
      [],
    );
  });
});
