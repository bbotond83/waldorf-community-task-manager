import type { DatabaseClient } from "../runtime/database/client.ts";
import type { TokenPair } from "./cookies.ts";
import { readTokenClaims, type SignInService } from "./service.ts";

/**
 * What a request is: signed out, signed in (with the tokens to send on, possibly renewed), or unable to
 * tell because a dependency is down (BR2.5 to BR2.8). The sign-in service's own session is the session; the
 * database accepts a request only for an active session of an active account (BR2.6), and this module asks
 * it through `current_session_is_active()` with the request's own token, so a signed-out, expired,
 * deactivated or never-registered token is signed out here too.
 */
export type SessionResolution =
  | Readonly<{ status: "signed-out"; clearCookies: boolean }>
  | Readonly<{
      status: "signed-in";
      accountId: string;
      sessionId: string;
      accessToken: string;
      /** Set when the tokens were refreshed: the caller must store them (the old refresh token is spent). */
      renewed?: TokenPair;
    }>
  | Readonly<{ status: "unavailable" }>;

export type SessionDeps = Readonly<{
  service: SignInService;
  database: DatabaseClient;
  now: () => number;
}>;

/** Access tokens are refreshed when fewer seconds than this remain. */
export const REFRESH_MARGIN_SECONDS = 60;

const RETRY = { idempotencyKey: "session", action: "session.check" } as const;

export async function resolveSession(
  tokens: TokenPair | undefined,
  deps: SessionDeps,
  options: Readonly<{ canPersist: boolean }> = { canPersist: true },
): Promise<SessionResolution> {
  if (!tokens) return { status: "signed-out", clearCookies: false };

  let accessToken = tokens.accessToken;
  let renewed: TokenPair | undefined;
  const claims = readTokenClaims(accessToken);
  const expires = typeof claims?.exp === "number" ? claims.exp : 0;
  if (expires - deps.now() / 1000 < REFRESH_MARGIN_SECONDS) {
    // A refresh spends the refresh token. Where the new tokens cannot be stored (rendering a page), do
    // not refresh: the person is treated as signed out and the next action that can store cookies renews.
    if (!options.canPersist) return { status: "signed-out", clearCookies: false };
    const refreshed = await deps.service.refresh(tokens.refreshToken);
    if (!refreshed.ok) {
      return refreshed.kind === "rejected"
        ? { status: "signed-out", clearCookies: true }
        : { status: "unavailable" };
    }
    accessToken = refreshed.value.accessToken;
    renewed = { accessToken, refreshToken: refreshed.value.refreshToken };
  }

  const active = await deps.database
    .forSession(accessToken)
    .read<boolean>((client) => client.rpc("current_session_is_active") as never, RETRY);
  if (active.state === "dependency-failure-retryable") return { status: "unavailable" };
  if (active.state !== "success" || active.data !== true) {
    return { status: "signed-out", clearCookies: true };
  }
  const live = readTokenClaims(accessToken);
  const accountId = live?.sub;
  const sessionId = live?.session_id;
  if (typeof accountId !== "string" || typeof sessionId !== "string") {
    return { status: "signed-out", clearCookies: true };
  }
  return {
    status: "signed-in",
    accountId,
    sessionId,
    accessToken,
    ...(renewed ? { renewed } : {}),
  };
}

/** Ends only the request's own session in the sign-in service (scope local); other sessions are unaffected. */
export async function endSession(
  tokens: TokenPair | undefined,
  deps: Pick<SessionDeps, "service" | "now">,
): Promise<"ended" | "unavailable"> {
  if (!tokens) return "ended";
  let accessToken = tokens.accessToken;
  const expires = readTokenClaims(accessToken)?.exp;
  if (typeof expires !== "number" || expires - deps.now() / 1000 < REFRESH_MARGIN_SECONDS) {
    // An expired access token cannot sign out; the refresh token still can, so exchange it first.
    const refreshed = await deps.service.refresh(tokens.refreshToken);
    if (!refreshed.ok) return refreshed.kind === "rejected" ? "ended" : "unavailable";
    accessToken = refreshed.value.accessToken;
  }
  const outcome = await deps.service.signOut(accessToken);
  if (outcome.ok) return "ended";
  // An expired or already-ended session answers with a rejection: the person is signed out either way.
  return outcome.kind === "rejected" ? "ended" : "unavailable";
}
