import { type FetchLike, SERVICE_TIMEOUT_MS } from "../../../src/identity/service.ts";
import { type SqlClient, ToolingError } from "../common.ts";
import type { SeedAccount } from "./data.ts";

/**
 * Creates the seeded sign-in users through the sign-in service's admin interface (NFR2.30). The service is shared by
 * every schema, so each account has the id the seed derived for its schema and an address that starts with the schema
 * name; the accounts of one schema are never the accounts of another (the infrastructure design, "Seed accounts per
 * schema"). The address prefix is the same namespace `db:worker` uses: `db:worker <schema> --reset` and the reset
 * command remove exactly the users whose address starts with `<schema>.`.
 *
 * Nothing here logs or returns a password.
 */
export interface SeedAccountAdmin {
  createUser(input: {
    id: string;
    email: string;
    password: string;
  }): Promise<{ ok: true } | { ok: false; reason: string }>;
  deleteUser(id: string): Promise<boolean>;
}

/** The admin interface of the local sign-in service, built from the stack's service key (tooling only). */
export function createSeedAccountAdmin(options: {
  url: string;
  serviceKey: string;
  fetch?: FetchLike;
}): SeedAccountAdmin {
  const base = options.url.replace(/\/$/, "");
  const doFetch = options.fetch ?? ((url, init) => fetch(url, init));
  const request = (path: string, method: string, body?: unknown) =>
    doFetch(`${base}${path}`, {
      method,
      headers: {
        apikey: options.serviceKey,
        Authorization: `Bearer ${options.serviceKey}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(SERVICE_TIMEOUT_MS),
    });
  const remove = async (id: string): Promise<boolean> => {
    try {
      const response = await request(`/auth/v1/admin/users/${encodeURIComponent(id)}`, "DELETE");
      return response.status < 300 || response.status === 404;
    } catch {
      return false;
    }
  };
  return {
    async createUser({ id, email, password }) {
      let response: Response;
      try {
        response = await request("/auth/v1/admin/users", "POST", {
          id,
          email,
          password,
          email_confirm: true,
        });
      } catch {
        return { ok: false, reason: "unavailable" };
      }
      let body: Record<string, unknown> = {};
      try {
        const parsed = (await response.json()) as unknown;
        if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
      } catch {
        body = {};
      }
      if (response.status >= 500 || response.status === 429)
        return { ok: false, reason: "unavailable" };
      if (response.status >= 400) {
        const code = typeof body.error_code === "string" ? body.error_code : "rejected";
        return { ok: false, reason: code };
      }
      if (body.id !== id) {
        // The service did not use the fixed id: the account would not be the one the records name.
        if (typeof body.id === "string") await remove(body.id);
        return { ok: false, reason: "id_not_honoured" };
      }
      return { ok: true };
    },
    deleteUser: remove,
  };
}

export interface ProvisionResult {
  /** Ids of the users this run created (and would remove again after a failure). */
  created: string[];
  /** Users that were already there with the right id. */
  existing: number;
}

/**
 * Makes sure every account of the plan has a sign-in user with its derived id. A user that already exists with the
 * right id is kept (a second seed changes nothing); one with the same address and another id stops the seed, because
 * the records would then point at someone else. If one creation fails, the users this run created are removed again
 * and the failure names the step, never a password.
 */
export async function provisionAccounts(options: {
  client: SqlClient;
  admin: SeedAccountAdmin;
  accounts: readonly SeedAccount[];
  concurrency?: number;
}): Promise<ProvisionResult> {
  const { client, admin, accounts } = options;
  const found = await client.query(
    "select id::text as id, lower(email) as email from auth.users where lower(email) = any($1::text[])",
    [accounts.map((account) => account.email.toLowerCase())],
  );
  const byEmail = new Map(found.rows.map((row) => [String(row.email), String(row.id)]));
  const missing: SeedAccount[] = [];
  let existing = 0;
  for (const account of accounts) {
    const present = byEmail.get(account.email.toLowerCase());
    if (present === undefined) missing.push(account);
    else if (present === account.id) existing++;
    else {
      throw new ToolingError(
        "accounts",
        "A sign-in user with the address of a seeded account already exists under another id; run the reset for this schema first. Nothing was changed.",
        { account: account.tag },
      );
    }
  }

  const created: string[] = [];
  let failure: ToolingError | undefined;
  let next = 0;
  const worker = async () => {
    while (!failure) {
      const account = missing[next++];
      if (!account) return;
      const result = await admin.createUser({
        id: account.id,
        email: account.email,
        password: account.password,
      });
      if (result.ok) created.push(account.id);
      else {
        failure = new ToolingError(
          "accounts",
          `The sign-in service did not create a seeded account (${result.reason}); nothing was changed.`,
          { account: account.tag },
        );
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, options.concurrency ?? 4) }, worker));
  if (failure) {
    await removeAccounts(admin, created);
    throw failure;
  }
  return { created, existing };
}

/** Removes sign-in users by id (the compensation of a failed seed); returns how many could not be removed. */
export async function removeAccounts(
  admin: SeedAccountAdmin,
  ids: readonly string[],
): Promise<number> {
  let failed = 0;
  for (const id of ids) if (!(await admin.deleteUser(id))) failed++;
  return failed;
}
