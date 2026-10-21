import { readFileSync } from "node:fs";
import { createAdminAccess, type AdminAccess } from "../../src/identity/admin-client.ts";
import { isPlausibleEmail, normalizeEmail } from "../../src/identity/crypto.ts";
import { checkPassword } from "../../src/identity/password.ts";
import {
  describeFailure,
  parseArguments,
  parseEnvFile,
  PUBLIC_ENV_FILE,
  runAsCommand,
  SCHEMA_NAME,
  SERVICE_ENV_FILE,
  type Log,
  type SqlClient,
  ToolingError,
} from "./common.ts";
import { connectPostgres } from "./postgres.ts";
import { createTerminal, type Terminal } from "./terminal.ts";

export const FIRST_SUPER_ADMIN_HELP = `Usage: npm run db:first-super-admin -- --organization <id> --email <address> [--schema <name>]

Creates the first super admin of an organization (BR2.18): the sign-in user, the Account, the
organization-scope grant and its version row, and writes the audit event. It refuses when the
organization already has an active super admin.

It asks you to type the target host (it must match the database address) and then the password
twice, without echo. The password is never an argument, a file or an environment variable, so the
command needs an interactive terminal. If any step fails the new sign-in user is removed and nothing
else is left behind.

  --organization <id>  the organization's id (a UUID)
  --email <address>    the address the new super admin signs in with
  --schema <name>      schema of the database (default: public)
  --help               show this text

Reads DATABASE_URL, SUPABASE_URL and the sign-in service's admin key from the environment, or from
the git-ignored files ${PUBLIC_ENV_FILE} and ${SERVICE_ENV_FILE} that "npm run db:start" writes.`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADMIN_KEY_NAME = "SUPABASE_SERVICE_ROLE_KEY";

export interface FirstSuperAdminDeps {
  connect: (url: string) => Promise<SqlClient>;
  createAdmin: (options: { url: string; serviceKey: string; schema: string }) => AdminAccess;
  terminal: Terminal;
  readFile: (path: string) => string | undefined;
  environment: Readonly<Record<string, string | undefined>>;
  log: Log;
}

export function defaultFirstSuperAdminDeps(): FirstSuperAdminDeps {
  return {
    connect: connectPostgres,
    createAdmin: createAdminAccess,
    terminal: createTerminal(),
    readFile: (path) => {
      try {
        return readFileSync(path, "utf8");
      } catch {
        return undefined;
      }
    },
    environment: process.env,
    log: (line) => console.log(line),
  };
}

interface OperatorSettings {
  databaseUrl: string;
  apiUrl: string;
  adminKey: string;
}

function readSettings(deps: FirstSuperAdminDeps): OperatorSettings {
  const fromFiles = {
    ...parseEnvFile(deps.readFile(PUBLIC_ENV_FILE) ?? ""),
    ...parseEnvFile(deps.readFile(SERVICE_ENV_FILE) ?? ""),
  };
  const pick = (name: string) => deps.environment[name] || fromFiles[name];
  const databaseUrl = pick("DATABASE_URL");
  const apiUrl = pick("SUPABASE_URL");
  const adminKey = pick(ADMIN_KEY_NAME);
  const missing = [
    ["DATABASE_URL", databaseUrl],
    ["SUPABASE_URL", apiUrl],
    [ADMIN_KEY_NAME, adminKey],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new ToolingError("settings", `Missing ${missing.join(", ")}.`, {
      setting: missing.join(","),
    });
  }
  return { databaseUrl: databaseUrl!, apiUrl: apiUrl!, adminKey: adminKey! };
}

/** The host of the database address; query parameters and several hosts could redirect the connection. */
function databaseHost(address: string): string {
  let parsed: URL;
  try {
    parsed = new URL(address);
  } catch {
    throw new ToolingError("settings", "DATABASE_URL is not a valid address.", {
      setting: "DATABASE_URL",
    });
  }
  if (parsed.search !== "" || address.includes("?") || parsed.hostname.includes(",")) {
    throw new ToolingError(
      "settings",
      "DATABASE_URL must not carry query parameters or several hosts.",
      { setting: "DATABASE_URL" },
    );
  }
  return parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
}

const quote = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

export async function main(
  argv: readonly string[],
  deps: FirstSuperAdminDeps = defaultFirstSuperAdminDeps(),
): Promise<number> {
  const { flags } = parseArguments(argv);
  if (flags.has("help")) {
    deps.log(FIRST_SUPER_ADMIN_HELP);
    return 0;
  }

  let client: SqlClient | undefined;
  let createdUser: { id: string; admin: AdminAccess } | undefined;
  let proofTarget: { url: string; schemaId: string } | undefined;
  let step = "arguments";
  const secrets: string[] = [];
  try {
    const organization = flags.get("organization");
    const emailArgument = flags.get("email");
    const schema = typeof flags.get("schema") === "string" ? String(flags.get("schema")) : "public";
    if (typeof organization !== "string" || !UUID.test(organization)) {
      throw new ToolingError("arguments", "--organization must be the organization's id (a UUID).");
    }
    const email = typeof emailArgument === "string" ? normalizeEmail(emailArgument) : "";
    if (!isPlausibleEmail(email)) {
      throw new ToolingError("arguments", "--email must be an email address.");
    }
    if (!SCHEMA_NAME.test(schema)) {
      throw new ToolingError("arguments", "--schema must be a lowercase identifier.");
    }

    step = "settings";
    const settings = readSettings(deps);
    secrets.push(settings.adminKey, settings.databaseUrl);
    const host = databaseHost(settings.databaseUrl);
    const proofUrl = settings.databaseUrl;

    step = "connect";
    client = await deps.connect(settings.databaseUrl);
    const schemaId = quote(schema);
    proofTarget = { url: proofUrl, schemaId };

    step = "check-existing";
    const existing = await client.query(
      `select exists (
         select 1 from ${schemaId}.app_role_grants g join ${schemaId}.accounts a on a.id = g.subject_id
          where g.organization_id = $1 and g.role = 'super_admin' and g.revoked_at is null and a.status = 'active'
       ) as present`,
      [organization],
    );
    if (existing.rows[0]?.present === true) {
      throw new ToolingError(
        "check-existing",
        "This organization already has an active super admin; nothing was changed.",
      );
    }

    step = "confirm-host";
    const typedHost = (await deps.terminal.ask(`Type the database host to confirm (${host}): `))
      .trim()
      .toLowerCase()
      .replace(/^\[|\]$/g, "");
    if (typedHost !== host) {
      throw new ToolingError(
        "confirm-host",
        "The typed host does not match the database address; nothing was changed.",
      );
    }

    step = "password";
    const password = await deps.terminal.askSecret("New password (not shown): ");
    secrets.push(password);
    const rule = checkPassword(password);
    if (!rule.ok) {
      throw new ToolingError(
        "password",
        "The password must have 8 to 72 characters with at least one letter and one digit; nothing was changed.",
      );
    }
    const repeated = await deps.terminal.askSecret("Repeat the password: ");
    secrets.push(repeated);
    if (repeated !== password) {
      throw new ToolingError("password", "The two passwords differ; nothing was changed.");
    }

    step = "create-user";
    const admin = deps.createAdmin({ url: settings.apiUrl, serviceKey: settings.adminKey, schema });
    const created = await admin.createUser({
      email,
      password,
      invitationId: "operator-first-super-admin",
    });
    if (!created.ok) {
      throw new ToolingError(
        "create-user",
        created.kind === "rejected"
          ? `The sign-in service refused the new user (${created.code}).`
          : "The sign-in service could not be reached.",
      );
    }
    createdUser = { id: created.value.id, admin };

    step = "create-account";
    await client.query(`set search_path to ${schemaId}, pg_catalog`);
    const result = await client.query("select operator_first_super_admin($1, $2, $3) as result", [
      organization,
      created.value.id,
      email,
    ]);
    const envelope = result.rows[0]?.result as { state?: string; code?: string } | undefined;
    if (envelope?.state !== "success") {
      throw new ToolingError(
        "create-account",
        envelope?.code === "super_admin_exists"
          ? "Another process created the first super admin first."
          : `The database refused the account (${envelope?.code ?? "no answer"}).`,
      );
    }
    deps.log(
      `First super admin created: organization ${organization}, account ${created.value.id}.`,
    );
    createdUser = undefined;
    return 0;
  } catch (error) {
    if (createdUser) {
      // The new sign-in user is deleted ONLY when a successful answer, from a connection of its own (the first
      // one may be gone), proves that no Account exists for it. If the answer is missing or unknown (for example
      // the connection dropped after the account was committed) the user is kept and named: deleting it could
      // leave an Account without a sign-in user.
      let present: boolean | undefined;
      try {
        const checker = await deps.connect(proofTarget!.url);
        try {
          const answer = await checker.query(
            `select exists (select 1 from ${proofTarget!.schemaId}.accounts where id = $1) as present`,
            [createdUser.id],
          );
          present = answer.rows[0]?.present as boolean | undefined;
        } finally {
          await checker.end().catch(() => undefined);
        }
      } catch {
        present = undefined;
      }
      if (present === false) {
        const removed = await createdUser.admin
          .deleteUser(createdUser.id)
          .catch(() => ({ ok: false as const }));
        deps.log(
          removed.ok
            ? "The new sign-in user was removed; nothing is left behind."
            : `WARNING: the new sign-in user ${createdUser.id} could not be removed; remove it by hand.`,
        );
      } else {
        deps.log(
          present === true
            ? `The account exists, so the sign-in user ${createdUser.id} was kept; the first super admin was created.`
            : `WARNING: could not confirm whether the account exists; the sign-in user ${createdUser.id} was kept. Check the account by id, then remove the user by hand only if there is none.`,
        );
      }
    }
    deps.log(
      describeFailure(
        error instanceof ToolingError
          ? error
          : new ToolingError(step, error instanceof Error ? error.message : String(error)),
        secrets,
      ),
    );
    return 1;
  } finally {
    await client?.end();
  }
}

await runAsCommand(import.meta, () => main(process.argv.slice(2)));
