import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { describe, it } from "node:test";
import type { AdminAccess } from "../../src/identity/admin-client.ts";
import { type SqlClient, ToolingError } from "./common.ts";
import { type FirstSuperAdminDeps, FIRST_SUPER_ADMIN_HELP, main } from "./first-super-admin.ts";
import { createTerminal, type Terminal } from "./terminal.ts";

const ORGANIZATION = "aaaaaaaa-0000-4000-8000-000000000001";
const USER_ID = "bbbbbbbb-0000-4000-8000-0000000000aa";
const PASSWORD = ["Typed", "Password", "1x"].join("-");
// Built from parts so the test file holds no address that looks like real data.
const DATABASE_URL = [
  "postgresql://",
  "operator",
  ":",
  "pw-for-test",
  "@127.0.0.1:54322/postgres",
].join("");
const ADMIN_KEY = ["fake", "admin", "key", "for", "tests", "0123456789"].join("-");

type Script = {
  existing?: boolean;
  operator?: { state: string; code?: string };
  queryError?: Error;
  /** What a check from a new connection finds: an Account for the new user, none, or no answer at all. */
  accountPresent?: boolean | "error";
  create?: Awaited<ReturnType<AdminAccess["createUser"]>>;
  deleteOk?: boolean;
  answers?: string[];
  secrets?: string[];
  environment?: Record<string, string | undefined>;
  files?: Record<string, string>;
};

function setup(script: Script = {}) {
  const lines: string[] = [];
  const queries: { sql: string; values: unknown[] | undefined }[] = [];
  const asked: string[] = [];
  const created: unknown[] = [];
  const deleted: string[] = [];
  let ended = 0;
  const client: SqlClient = {
    async query(sql, values) {
      queries.push({ sql, values });
      if (script.queryError && sql.includes("operator_first_super_admin")) throw script.queryError;
      if (sql.includes(".accounts where id")) {
        if (script.accountPresent === "error") throw new Error("connection refused");
        return { rows: [{ present: script.accountPresent ?? false }], rowCount: 1 };
      }
      if (sql.includes("select exists"))
        return { rows: [{ present: script.existing ?? false }], rowCount: 1 };
      if (sql.includes("operator_first_super_admin")) {
        return { rows: [{ result: script.operator ?? { state: "success" } }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
    async end() {
      ended += 1;
    },
  };
  const answers = [...(script.answers ?? ["127.0.0.1"])];
  const secrets = [...(script.secrets ?? [PASSWORD, PASSWORD])];
  const terminal: Terminal = {
    async ask(question) {
      asked.push(question);
      return answers.shift() ?? "";
    },
    async askSecret(question) {
      asked.push(question);
      return secrets.shift() ?? "";
    },
  };
  const admin: AdminAccess = {
    async createUser(input) {
      created.push(input);
      return script.create ?? { ok: true, value: { id: USER_ID } };
    },
    async setPassword() {
      throw new Error("not used");
    },
    async setBan() {
      throw new Error("not used");
    },
    async deleteUser(id) {
      deleted.push(id);
      return script.deleteOk === false
        ? { ok: false, kind: "unavailable" }
        : { ok: true, value: null };
    },
    async callFunction() {
      throw new Error("not used");
    },
  };
  const deps: FirstSuperAdminDeps = {
    connect: async () => client,
    createAdmin: () => admin,
    terminal,
    readFile: (path) => script.files?.[path],
    environment: script.environment ?? {
      DATABASE_URL,
      SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_SERVICE_ROLE_KEY: ADMIN_KEY,
    },
    log: (line) => lines.push(line),
  };
  return { deps, lines, queries, asked, created, deleted, ended: () => ended };
}

const args = ["--organization", ORGANIZATION, "--email", "First.Admin@Example.test"];
const output = (run: ReturnType<typeof setup>) => run.lines.join("\n");

describe("the first-super-admin command (BR2.18, NFR1.14, NFR6.6)", () => {
  it("prints its help without touching anything", async () => {
    const run = setup();
    assert.equal(await main(["--help"], run.deps), 0);
    assert.equal(run.lines[0], FIRST_SUPER_ADMIN_HELP);
    assert.equal(run.queries.length, 0);
  });

  it("asks for the host, then the password twice, creates the user and the account, and prints no secret", async () => {
    const run = setup();
    assert.equal(await main(args, run.deps), 0);
    assert.match(
      output(run),
      /First super admin created: organization aaaaaaaa-0000-4000-8000-000000000001, account bbbbbbbb/,
    );
    assert.deepEqual(run.created, [
      {
        email: "first.admin@example.test",
        password: PASSWORD,
        invitationId: "operator-first-super-admin",
      },
    ]);
    const call = run.queries.find((entry) => entry.sql.includes("operator_first_super_admin"));
    assert.deepEqual(call?.values, [ORGANIZATION, USER_ID, "first.admin@example.test"]);
    assert.ok(run.queries.some((entry) => entry.sql.startsWith('set search_path to "public"')));
    assert.deepEqual(run.deleted, []);
    assert.equal(run.ended(), 1);
    for (const secret of [PASSWORD, ADMIN_KEY, DATABASE_URL, "pw-for-test"]) {
      assert.equal(output(run).includes(secret), false);
    }
    assert.equal(run.asked.length, 3);
  });

  it("reads the password only from the terminal: no argument, file or environment variable is used", async () => {
    const run = setup({
      environment: {
        DATABASE_URL,
        SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_SERVICE_ROLE_KEY: ADMIN_KEY,
        PASSWORD: "from-the-environment-1",
        FIRST_ADMIN_PASSWORD: "from-the-environment-2",
      },
    });
    assert.equal(await main([...args, "--password", "from-an-argument-1"], run.deps), 0);
    assert.deepEqual(
      run.created.map((entry) => (entry as { password: string }).password),
      [PASSWORD],
    );
  });

  it("reads the settings from the git-ignored files when the environment has none", async () => {
    const run = setup({
      environment: {},
      files: {
        ".env.database.local": "SUPABASE_URL=http://127.0.0.1:54321\n",
        ".env.service.local": `DATABASE_URL=${DATABASE_URL}\nSUPABASE_SERVICE_ROLE_KEY=${ADMIN_KEY}\n`,
      },
    });
    assert.equal(await main(args, run.deps), 0);
  });

  it("stops with a message for a missing setting, a bad address and a bad schema, changing nothing", async () => {
    const missing = setup({ environment: {} });
    assert.equal(await main(args, missing.deps), 1);
    assert.match(
      output(missing),
      /step=settings.*Missing DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY/,
    );
    const query = setup({
      environment: {
        DATABASE_URL: `${DATABASE_URL}?host=other`,
        SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_SERVICE_ROLE_KEY: ADMIN_KEY,
      },
    });
    assert.equal(await main(args, query.deps), 1);
    assert.match(output(query), /query parameters/);
    const invalid = setup({
      environment: {
        DATABASE_URL: "not a url",
        SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_SERVICE_ROLE_KEY: ADMIN_KEY,
      },
    });
    assert.equal(await main(args, invalid.deps), 1);
    assert.match(output(invalid), /not a valid address/);
    for (const bad of [
      ["--email", "a@example.test"],
      ["--organization", "nope", "--email", "a@example.test"],
      ["--organization", ORGANIZATION],
      ["--organization", ORGANIZATION, "--email", "nope"],
      [...args, "--schema", "Bad-Schema"],
    ]) {
      const run = setup();
      assert.equal(await main(bad, run.deps), 1, bad.join(" "));
      assert.match(output(run), /step=arguments/);
      assert.equal(run.queries.length, 0);
    }
  });

  it("refuses when the organization already has an active super admin, before asking anything", async () => {
    const run = setup({ existing: true });
    assert.equal(await main(args, run.deps), 1);
    assert.match(output(run), /already has an active super admin; nothing was changed/);
    assert.equal(run.asked.length, 0);
    assert.deepEqual(run.created, []);
  });

  it("refuses when the typed host does not match the database address, even a similar one", async () => {
    for (const typed of ["", "localhost", "example.org", "127.0.0.2"]) {
      const run = setup({ answers: [typed] });
      assert.equal(await main(args, run.deps), 1, typed);
      assert.match(output(run), /typed host does not match/);
      assert.deepEqual(run.created, []);
      assert.equal(
        run.asked.length,
        1,
        "the password is not asked for when the host does not match",
      );
    }
    const loose = setup({ answers: ["  127.0.0.1  "] });
    assert.equal(await main(args, loose.deps), 0, "surrounding spaces are ignored");
  });

  it("matches a bracketed IPv6 host", async () => {
    const run = setup({
      answers: ["::1"],
      environment: {
        DATABASE_URL: "postgresql://u:p@[::1]:54322/postgres",
        SUPABASE_URL: "http://[::1]:54321",
        SUPABASE_SERVICE_ROLE_KEY: ADMIN_KEY,
      },
    });
    assert.equal(await main(args, run.deps), 0);
  });

  it("refuses a password that breaks the rule or that was typed differently the second time", async () => {
    for (const secrets of [
      ["short1", "short1"],
      ["onlyletters", "onlyletters"],
      ["123456789", "123456789"],
      [PASSWORD, `${PASSWORD}x`],
    ]) {
      const run = setup({ secrets });
      assert.equal(await main(args, run.deps), 1, secrets.join());
      assert.match(output(run), /step=password/);
      assert.deepEqual(run.created, []);
      for (const secret of secrets)
        assert.equal(output(run).includes(secret) && secret.length > 8, false);
    }
  });

  it("names the failing step when the sign-in service refuses or cannot be reached, creating nothing", async () => {
    const refused = setup({
      create: { ok: false, kind: "rejected", status: 422, code: "weak_password" },
    });
    assert.equal(await main(args, refused.deps), 1);
    assert.match(output(refused), /step=create-user.*weak_password/);
    const down = setup({ create: { ok: false, kind: "unavailable" } });
    assert.equal(await main(args, down.deps), 1);
    assert.match(output(down), /could not be reached/);
    assert.deepEqual([...refused.deleted, ...down.deleted], []);
  });

  it("removes the new sign-in user when the database refuses or fails, and leaves nothing else", async () => {
    const lost = setup({ operator: { state: "conflict", code: "super_admin_exists" } });
    assert.equal(await main(args, lost.deps), 1);
    assert.match(output(lost), /Another process created the first super admin first/);
    assert.deepEqual(lost.deleted, [USER_ID]);
    const refused = setup({ operator: { state: "validation", code: "sign_in_user_missing" } });
    assert.equal(await main(args, refused.deps), 1);
    assert.match(output(refused), /sign_in_user_missing/);
    assert.deepEqual(refused.deleted, [USER_ID]);
    const blank = setup({ operator: { state: "denied" } });
    assert.equal(await main(args, blank.deps), 1);
    assert.match(output(blank), /no answer|refused the account/);
    const broken = setup({ queryError: new Error(`connection lost for ${DATABASE_URL}`) });
    assert.equal(await main(args, broken.deps), 1);
    assert.deepEqual(broken.deleted, [USER_ID]);
    assert.equal(output(broken).includes("pw-for-test"), false, "the address password is redacted");
    assert.match(output(broken), /step=create-account/);
    assert.equal(
      broken.ended(),
      2,
      "the command's connection and the proof check's own connection",
    );
  });

  it("keeps the sign-in user when the connection dropped after the account was committed", async () => {
    const run = setup({ queryError: new Error("connection terminated"), accountPresent: true });
    assert.equal(await main(args, run.deps), 1);
    assert.deepEqual(run.deleted, [], "the Account exists, so its sign-in user is never deleted");
    assert.match(output(run), /account exists, so the sign-in user bbbbbbbb.* was kept/);
  });

  it("keeps the sign-in user when the existence check itself gets no answer", async () => {
    const run = setup({ queryError: new Error("connection terminated"), accountPresent: "error" });
    assert.equal(await main(args, run.deps), 1);
    assert.deepEqual(run.deleted, []);
    assert.match(output(run), /could not confirm whether the account exists/);
    const refused = setup({
      operator: { state: "validation", code: "x" },
      accountPresent: "error",
    });
    assert.equal(await main(args, refused.deps), 1);
    assert.deepEqual(refused.deleted, []);
  });

  it("warns by id when the new sign-in user cannot be removed", async () => {
    const run = setup({
      operator: { state: "conflict", code: "super_admin_exists" },
      deleteOk: false,
    });
    assert.equal(await main(args, run.deps), 1);
    assert.match(
      output(run),
      /WARNING: the new sign-in user bbbbbbbb-0000-4000-8000-0000000000aa could not be removed/,
    );
  });
});

describe("the operator terminal (BR2.18)", () => {
  function fakeTerminal(isTTY: boolean) {
    const input = Object.assign(new PassThrough(), {
      isTTY,
      setRawMode: isTTY ? () => input : undefined,
    });
    const output = new PassThrough();
    const written: string[] = [];
    output.on("data", (chunk) => written.push(String(chunk)));
    return { input, output, written, terminal: createTerminal(input, output) };
  }

  it("refuses to ask anything without an interactive terminal", async () => {
    const { terminal } = fakeTerminal(false);
    await assert.rejects(
      () => terminal.askSecret("Password: "),
      (error: ToolingError) => error.step === "terminal",
    );
    await assert.rejects(
      () => terminal.ask("Host: "),
      (error: ToolingError) => error.step === "terminal",
    );
  });

  it("reads a secret without echoing it, handling backspace, and shows only the question", async () => {
    const { input, written, terminal } = fakeTerminal(true);
    const answer = terminal.askSecret("Password: ");
    input.write("abc");
    input.write("\u007fd1\r");
    assert.equal(await answer, "abd1");
    const shown = written.join("");
    assert.ok(shown.startsWith("Password: "));
    assert.equal(/abc|abd1/.test(shown), false);
  });

  it("cancels on Ctrl+C", async () => {
    const { input, terminal } = fakeTerminal(true);
    const answer = terminal.askSecret("Password: ");
    input.write("ab\u0003");
    await assert.rejects(
      () => answer,
      (error: ToolingError) => error.step === "terminal",
    );
  });

  it("asks a visible question and returns the typed line", async () => {
    const { input, written, terminal } = fakeTerminal(true);
    const answer = terminal.ask("Host: ");
    input.write("127.0.0.1\n");
    assert.equal((await answer).trim(), "127.0.0.1");
    assert.ok(written.join("").includes("Host: "));
  });
});
