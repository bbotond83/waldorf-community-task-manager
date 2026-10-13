/**
 * The session cookies (BR2.5). They hold the sign-in service's tokens only, are httpOnly (never readable by
 * browser scripts), sameSite lax, and secure whenever the site is served over https. The cookie lifetime is
 * the 30 days of the inactivity limit and is renewed whenever the tokens are refreshed.
 */
export const ACCESS_COOKIE = "wb_access";
export const REFRESH_COOKIE = "wb_refresh";
export const SESSION_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export type SessionCookieOptions = Readonly<{
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
}>;

/** True when the address people open the app at uses https. */
export function isSecureOrigin(appPublicUrl: string): boolean {
  try {
    return new URL(appPublicUrl).protocol === "https:";
  } catch {
    return false;
  }
}

export function sessionCookieOptions(appPublicUrl: string): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureOrigin(appPublicUrl),
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  };
}

export function clearedCookieOptions(appPublicUrl: string): SessionCookieOptions {
  return { ...sessionCookieOptions(appPublicUrl), maxAge: 0 };
}

export type TokenPair = Readonly<{ accessToken: string; refreshToken: string }>;

export interface CookieStore {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options: SessionCookieOptions): void;
}

export function readTokenPair(store: Pick<CookieStore, "get">): TokenPair | undefined {
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  return accessToken && refreshToken ? { accessToken, refreshToken } : undefined;
}

export function writeTokenPair(
  store: Pick<CookieStore, "set">,
  tokens: TokenPair,
  appPublicUrl: string,
): void {
  const options = sessionCookieOptions(appPublicUrl);
  store.set(ACCESS_COOKIE, tokens.accessToken, options);
  store.set(REFRESH_COOKIE, tokens.refreshToken, options);
}

export function clearTokenPair(store: Pick<CookieStore, "set">, appPublicUrl: string): void {
  const options = clearedCookieOptions(appPublicUrl);
  store.set(ACCESS_COOKIE, "", options);
  store.set(REFRESH_COOKIE, "", options);
}
