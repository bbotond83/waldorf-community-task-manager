import { type FetchLike, SERVICE_TIMEOUT_MS, type ServiceOutcome } from "./service.ts";

/**
 * The server's admin access to the sign-in service: creating, updating, banning and deleting sign-in
 * users, and calling the pre-session database functions (BR2.16, BR2.23). It is built from a service-role
 * key that is handed in by the one server-only module that reads it (`admin-runtime.ts`); this file never
 * reads the environment or a file itself, never logs, and every message it produces is free of the key.
 * No client component may import it: a bundle test proves the key, its name and these modules never reach
 * browser output.
 */
export type AdminUser = Readonly<{ id: string }>;

/** What a pre-session database function answers: the envelope plus any extra fields it returns. */
export type AdminFunctionResult = Readonly<{
  state: string;
  reference: string | null;
  code: string | null;
  fields: Readonly<Record<string, unknown>>;
}>;

export interface AdminAccess {
  createUser(input: {
    email: string;
    password: string;
    invitationId: string;
  }): Promise<ServiceOutcome<AdminUser>>;
  setPassword(userId: string, password: string): Promise<ServiceOutcome<null>>;
  setBan(userId: string, banned: boolean): Promise<ServiceOutcome<null>>;
  deleteUser(userId: string): Promise<ServiceOutcome<null>>;
  /** Calls one of the functions the elevated list marks as admin access (never any other). */
  callFunction(
    name: AdminFunctionName,
    args: Readonly<Record<string, unknown>>,
  ): Promise<ServiceOutcome<AdminFunctionResult>>;
}

/** The admin-access functions of the elevated list (BR2.23); the privilege test keeps the database in step. */
export const ADMIN_FUNCTIONS = [
  "sign_in_lockout_check",
  "sign_in_attempt_record",
  "sign_in_attempt_clear",
  "account_recovery_check",
  "invitation_lookup",
  "invitation_reserve",
  "invitation_release",
  "invitation_accept",
  "sessions_remove",
  "identity_housekeeping",
  "identity_ban_mismatches",
] as const;
export type AdminFunctionName = (typeof ADMIN_FUNCTIONS)[number];

/** Ban duration that stands for "forever" for the sign-in service (about 100 years). */
export const BAN_FOREVER = "876000h";

export function createAdminAccess(options: {
  url: string;
  serviceKey: string;
  schema: string;
  fetch?: FetchLike;
}): AdminAccess {
  const base = options.url.replace(/\/$/, "");
  const doFetch = options.fetch ?? ((url, init) => fetch(url, init));

  async function call(
    path: string,
    init: { method: string; body?: unknown; headers?: Record<string, string> },
  ): Promise<
    | { ok: true; status: number; body: Record<string, unknown> }
    | { ok: false; kind: "unavailable" }
    | { ok: false; kind: "rejected"; status: number; code: string }
  > {
    let response: Response;
    try {
      response = await doFetch(`${base}${path}`, {
        method: init.method,
        headers: {
          apikey: options.serviceKey,
          Authorization: `Bearer ${options.serviceKey}`,
          "Content-Type": "application/json",
          ...init.headers,
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(SERVICE_TIMEOUT_MS),
      });
    } catch {
      return { ok: false, kind: "unavailable" };
    }
    if (response.status >= 500 || response.status === 429)
      return { ok: false, kind: "unavailable" };
    let body: Record<string, unknown> = {};
    try {
      const parsed = (await response.json()) as unknown;
      if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
    } catch {
      body = {};
    }
    if (response.status >= 400) {
      const code =
        typeof body.error_code === "string"
          ? body.error_code
          : typeof body.code === "string"
            ? body.code
            : "rejected";
      return { ok: false, kind: "rejected", status: response.status, code };
    }
    return { ok: true, status: response.status, body };
  }

  const nothing = async (
    path: string,
    method: string,
    body?: unknown,
  ): Promise<ServiceOutcome<null>> => {
    const result = await call(path, { method, body });
    return result.ok ? { ok: true, value: null } : result;
  };

  return {
    async createUser({ email, password, invitationId }) {
      const result = await call("/auth/v1/admin/users", {
        method: "POST",
        body: {
          email,
          password,
          email_confirm: true,
          app_metadata: { invitation_id: invitationId },
        },
      });
      if (!result.ok) return result;
      const id = result.body.id;
      return typeof id === "string"
        ? { ok: true, value: { id } }
        : { ok: false, kind: "unavailable" };
    },
    setPassword: (userId, password) =>
      nothing(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, "PUT", { password }),
    setBan: (userId, banned) =>
      nothing(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, "PUT", {
        ban_duration: banned ? BAN_FOREVER : "none",
      }),
    deleteUser: (userId) => nothing(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, "DELETE"),
    async callFunction(name, args) {
      if (!(ADMIN_FUNCTIONS as readonly string[]).includes(name)) {
        throw new Error(`ADMIN_FUNCTION_NOT_ALLOWED: ${name}`);
      }
      const result = await call(`/rest/v1/rpc/${name}`, {
        method: "POST",
        body: args,
        headers: { "Content-Profile": options.schema, "Accept-Profile": options.schema },
      });
      if (!result.ok) return result;
      const { state, reference, code, ...fields } = result.body;
      if (typeof state !== "string") return { ok: false, kind: "unavailable" };
      return {
        ok: true,
        value: {
          state,
          reference: typeof reference === "string" ? reference : null,
          code: typeof code === "string" ? code : null,
          fields,
        },
      };
    },
  };
}
