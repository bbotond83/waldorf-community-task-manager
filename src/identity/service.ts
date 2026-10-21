import type { TokenPair } from "./cookies.ts";

/**
 * The sign-in service (the stack's own GoTrue) as the application uses it on behalf of a person: password
 * sign-in, token refresh, local sign-out, the recovery email, the one-time exchange of a reset link, and a
 * new password. Calls go over HTTP with the public key only; the service-role key never comes here (it
 * belongs to the admin module). Every outcome is explicit: accepted, rejected with the service's error
 * code, rate limited (the service answered 429: a burst from the server's one address, which the whole
 * community shares), or unavailable (network failure, timeout or a server-side error, so the caller may
 * retry).
 */
export type ServiceOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; kind: "rejected"; code: string; status: number }
  | { ok: false; kind: "rate_limited" }
  | { ok: false; kind: "unavailable" };

export type AuthSession = Readonly<
  TokenPair & {
    userId: string;
    sessionId: string;
    email: string;
  }
>;

export interface SignInService {
  passwordSignIn(email: string, password: string): Promise<ServiceOutcome<AuthSession>>;
  refresh(refreshToken: string): Promise<ServiceOutcome<AuthSession>>;
  signOut(accessToken: string): Promise<ServiceOutcome<null>>;
  requestRecovery(email: string): Promise<ServiceOutcome<null>>;
  verifyRecovery(tokenHash: string): Promise<ServiceOutcome<AuthSession>>;
  updatePassword(accessToken: string, password: string): Promise<ServiceOutcome<null>>;
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export const SERVICE_TIMEOUT_MS = 8000;

type TokenResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
  user?: { id?: unknown; email?: unknown };
};

/** Reads a claim of a JWT without verifying it: the database and the service verify; this is for routing only. */
export function readTokenClaims(token: string): Record<string, unknown> | undefined {
  const parts = token.split(".");
  if (parts.length !== 3) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as unknown;
    return payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function parseSession(body: TokenResponse): AuthSession | undefined {
  if (typeof body.access_token !== "string" || typeof body.refresh_token !== "string") {
    return undefined;
  }
  const claims = readTokenClaims(body.access_token);
  const sessionId = claims?.session_id;
  const userId = body.user?.id;
  if (typeof sessionId !== "string" || typeof userId !== "string") return undefined;
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    userId,
    sessionId,
    email: typeof body.user?.email === "string" ? body.user.email : "",
  };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const parsed = (await response.json()) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function createSignInService(options: {
  url: string;
  publicKey: string;
  fetch?: FetchLike;
}): SignInService {
  const base = `${options.url.replace(/\/$/, "")}/auth/v1`;
  const doFetch = options.fetch ?? ((url, init) => fetch(url, init));

  async function call<T>(
    path: string,
    init: { method: string; body?: unknown; bearer?: string },
    accept: (body: Record<string, unknown>) => T | undefined,
  ): Promise<ServiceOutcome<T>> {
    let response: Response;
    try {
      response = await doFetch(`${base}${path}`, {
        method: init.method,
        headers: {
          apikey: options.publicKey,
          Authorization: `Bearer ${init.bearer ?? options.publicKey}`,
          "Content-Type": "application/json",
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(SERVICE_TIMEOUT_MS),
      });
    } catch {
      return { ok: false, kind: "unavailable" };
    }
    if (response.status === 429) return { ok: false, kind: "rate_limited" };
    if (response.status >= 500) return { ok: false, kind: "unavailable" };
    const body = await readJson(response);
    if (response.status >= 400) {
      const code = typeof body.error_code === "string" ? body.error_code : "rejected";
      return { ok: false, kind: "rejected", code, status: response.status };
    }
    const value = accept(body);
    return value === undefined ? { ok: false, kind: "unavailable" } : { ok: true, value };
  }

  const session = (body: Record<string, unknown>) => parseSession(body as TokenResponse);
  const nothing = () => null;

  return {
    passwordSignIn: (email, password) =>
      call("/token?grant_type=password", { method: "POST", body: { email, password } }, session),
    refresh: (refreshToken) =>
      call(
        "/token?grant_type=refresh_token",
        { method: "POST", body: { refresh_token: refreshToken } },
        session,
      ),
    signOut: (accessToken) =>
      call("/logout?scope=local", { method: "POST", bearer: accessToken }, nothing),
    requestRecovery: (email) => call("/recover", { method: "POST", body: { email } }, nothing),
    verifyRecovery: (tokenHash) =>
      call(
        "/verify",
        { method: "POST", body: { type: "recovery", token_hash: tokenHash } },
        session,
      ),
    updatePassword: (accessToken, password) =>
      call("/user", { method: "PUT", body: { password }, bearer: accessToken }, nothing),
  };
}
