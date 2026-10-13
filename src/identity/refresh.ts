import { readDatabaseConfig } from "../runtime/database/config.ts";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  type SessionCookieOptions,
  clearedCookieOptions,
  sessionCookieOptions,
  type TokenPair,
} from "./cookies.ts";
import { createSignInService, readTokenClaims, type SignInService } from "./service.ts";

/**
 * The per-request token refresh (BR2.5, BR2.7). The access token lives about an hour; the session lives 30
 * days since the last activity. A step that can store cookies (the request proxy) looks at every page request:
 * when the access token is missing or about to expire and a refresh token is present, it exchanges the pair
 * once and hands back the renewed cookies, so a person who keeps using the app stays signed in. A refresh the
 * service refuses (session ended, revoked or idle for 30 days) clears the cookies. When the service cannot be
 * reached nothing changes and the next request tries again.
 */
export const REFRESH_MARGIN_SECONDS = 60;

export type RefreshDecision =
  | Readonly<{ action: "none" }>
  | Readonly<{ action: "renew"; tokens: TokenPair; options: SessionCookieOptions }>
  | Readonly<{ action: "clear"; options: SessionCookieOptions }>;

export type CookieReader = { get(name: string): { value: string } | undefined };

export async function decideRefresh(
  cookies: CookieReader,
  deps: Readonly<{ service: SignInService; now: () => number; appPublicUrl: string }>,
): Promise<RefreshDecision> {
  const refreshToken = cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return { action: "none" };
  const accessToken = cookies.get(ACCESS_COOKIE)?.value;
  const expires = accessToken ? readTokenClaims(accessToken)?.exp : undefined;
  const fresh =
    typeof expires === "number" && expires - deps.now() / 1000 >= REFRESH_MARGIN_SECONDS;
  if (fresh) return { action: "none" };

  const outcome = await deps.service.refresh(refreshToken);
  if (outcome.ok) {
    return {
      action: "renew",
      tokens: { accessToken: outcome.value.accessToken, refreshToken: outcome.value.refreshToken },
      options: sessionCookieOptions(deps.appPublicUrl),
    };
  }
  return outcome.kind === "unavailable"
    ? { action: "none" }
    : { action: "clear", options: clearedCookieOptions(deps.appPublicUrl) };
}

/** The refresh dependencies from the process environment, or nothing when identity is not configured. */
export function refreshDepsFromEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): { service: SignInService; now: () => number; appPublicUrl: string } | undefined {
  const config = readDatabaseConfig(environment);
  if (!config.ok) return undefined;
  return {
    service: createSignInService({ url: config.value.url, publicKey: config.value.publicKey }),
    now: () => Date.now(),
    appPublicUrl: environment.APP_PUBLIC_URL?.trim() || "http://127.0.0.1:3000",
  };
}
