import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { ADMIN_FUNCTIONS, BAN_FOREVER, createAdminAccess } from "./admin-client.ts";
import type { FetchLike } from "./service.ts";

const SERVICE_KEY = ["service", "credential", "value", "for", "tests", "only"].join("-");

type Seen = { url: string; init: RequestInit };

function adminWith(respond: (seen: Seen) => Response | Promise<Response>) {
  const seen: Seen[] = [];
  const fetchLike: FetchLike = async (url, init) => {
    const entry = { url, init };
    seen.push(entry);
    return respond(entry);
  };
  return {
    seen,
    admin: createAdminAccess({
      url: "http://127.0.0.1:54321",
      serviceKey: SERVICE_KEY,
      schema: "worker_2",
      fetch: fetchLike,
    }),
  };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("the server-only admin access (BR2.16, BR2.23)", () => {
  it("creates a confirmed user tagged with the invitation id and returns only the id", async () => {
    const { admin, seen } = adminWith(() => json(200, { id: "user-1", email: "x@example.test" }));
    const outcome = await admin.createUser({
      email: "x@example.test",
      password: "password-1x",
      invitationId: "inv-1",
    });
    assert.deepEqual(outcome, { ok: true, value: { id: "user-1" } });
    assert.equal(seen[0]!.url, "http://127.0.0.1:54321/auth/v1/admin/users");
    assert.deepEqual(JSON.parse(String(seen[0]!.init.body)), {
      email: "x@example.test",
      password: "password-1x",
      email_confirm: true,
      app_metadata: { invitation_id: "inv-1" },
    });
    const headers = seen[0]!.init.headers as Record<string, string>;
    assert.equal(headers.Authorization, `Bearer ${SERVICE_KEY}`);
  });

  it("reports a rejected create with the service's code, and an unusable answer as unavailable", async () => {
    const taken = adminWith(() => json(422, { error_code: "email_exists" }));
    assert.deepEqual(
      await taken.admin.createUser({ email: "a@example.test", password: "x", invitationId: "i" }),
      {
        ok: false,
        kind: "rejected",
        status: 422,
        code: "email_exists",
      },
    );
    const odd = adminWith(() => json(200, {}));
    assert.deepEqual(
      await odd.admin.createUser({ email: "a@example.test", password: "x", invitationId: "i" }),
      {
        ok: false,
        kind: "unavailable",
      },
    );
  });

  it("sets a password, bans and unbans for a long time, and deletes a user, each addressed by id", async () => {
    const { admin, seen } = adminWith(() => json(200, {}));
    assert.equal((await admin.setPassword("u 1", "new-password-1")).ok, true);
    assert.equal((await admin.setBan("u1", true)).ok, true);
    assert.equal((await admin.setBan("u1", false)).ok, true);
    assert.equal((await admin.deleteUser("u1")).ok, true);
    assert.deepEqual(
      seen.map((entry) => [entry.init.method, entry.url.slice("http://127.0.0.1:54321".length)]),
      [
        ["PUT", "/auth/v1/admin/users/u%201"],
        ["PUT", "/auth/v1/admin/users/u1"],
        ["PUT", "/auth/v1/admin/users/u1"],
        ["DELETE", "/auth/v1/admin/users/u1"],
      ],
    );
    assert.deepEqual(JSON.parse(String(seen[1]!.init.body)), { ban_duration: BAN_FOREVER });
    assert.deepEqual(JSON.parse(String(seen[2]!.init.body)), { ban_duration: "none" });
  });

  it("calls only the named admin-access functions, in the configured schema", async () => {
    const { admin, seen } = adminWith(() =>
      json(200, { state: "success", reference: null, code: "open", extra: 5 }),
    );
    const result = await admin.callFunction("sign_in_lockout_check", { p_email_hash: "h" });
    assert.deepEqual(result, {
      ok: true,
      value: { state: "success", reference: null, code: "open", fields: { extra: 5 } },
    });
    assert.equal(seen[0]!.url, "http://127.0.0.1:54321/rest/v1/rpc/sign_in_lockout_check");
    const headers = seen[0]!.init.headers as Record<string, string>;
    assert.equal(headers["Content-Profile"], "worker_2");
    assert.equal(headers["Accept-Profile"], "worker_2");
    await assert.rejects(
      () => admin.callFunction("account_find_by_email" as never, {}),
      /ADMIN_FUNCTION_NOT_ALLOWED/,
    );
    assert.equal(seen.length, 1, "nothing was sent for the refused name");
    assert.equal((ADMIN_FUNCTIONS as readonly string[]).includes("account_find_by_email"), false);
    assert.equal(
      (ADMIN_FUNCTIONS as readonly string[]).includes("operator_first_super_admin"),
      false,
    );
  });

  it("maps database errors and outages of a function call to rejected and unavailable, and a body without a state to unavailable", async () => {
    const failing = adminWith(() => json(400, { code: "P0001", message: "boom" }));
    assert.deepEqual(await failing.admin.callFunction("identity_housekeeping", {}), {
      ok: false,
      kind: "rejected",
      status: 400,
      code: "P0001",
    });
    const down = adminWith(() => json(503, {}));
    assert.deepEqual(await down.admin.callFunction("identity_housekeeping", {}), {
      ok: false,
      kind: "unavailable",
    });
    const stateless = adminWith(() => json(200, { hello: 1 }));
    assert.deepEqual(await stateless.admin.callFunction("identity_housekeeping", {}), {
      ok: false,
      kind: "unavailable",
    });
    const broken = createAdminAccess({
      url: "http://127.0.0.1:1",
      serviceKey: SERVICE_KEY,
      schema: "public",
      fetch: async () => {
        throw new Error(`connect failed with ${SERVICE_KEY}`);
      },
    });
    const outcome = await broken.setBan("u1", true);
    assert.deepEqual(outcome, { ok: false, kind: "unavailable" });
    assert.equal(
      JSON.stringify(outcome).includes(SERVICE_KEY),
      false,
      "no message carries the key",
    );
  });

  it("keeps the service-role key name and the admin modules out of every other source file (the bundle test checks the build)", () => {
    const root = fileURLToPath(new URL("../../", import.meta.url));
    const allowed = new Set(["src/identity/admin-client.ts", "src/identity/admin-runtime.ts"]);
    const offenders: string[] = [];
    const walk = (directory: string) => {
      for (const name of readdirSync(`${root}${directory}`)) {
        const relative = `${directory}/${name}`;
        if (statSync(`${root}${relative}`).isDirectory()) walk(relative);
        else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) {
          const text = readFileSync(`${root}${relative}`, "utf8");
          if (/SERVICE_ROLE_KEY/.test(text) && !allowed.has(relative))
            offenders.push(`${relative}: key name`);
          if (/admin-(runtime|client)/.test(text) && !/^(src\/identity\/|tests\/)/.test(relative))
            offenders.push(`${relative}: admin module`);
        }
      }
    };
    for (const folder of ["src", "app"]) walk(folder);
    assert.deepEqual(offenders, []);
  });
});
