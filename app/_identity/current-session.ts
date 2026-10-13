import "server-only";
import { cookies } from "next/headers";
import { readTokenPair } from "../../src/identity/cookies.ts";
import { getIdentityRuntime, isIdentityConfigured } from "../../src/identity/runtime.ts";
import { resolveSession, type SessionResolution } from "../../src/identity/session.ts";

/**
 * The real session of the current request, for pages (BR2.7). A page cannot store cookies, so it never
 * refreshes tokens: an expired access token reads as signed out until the next action that can renew it.
 * Without the identity settings the answer is signed out, so the old picker and the synthetic profiles are
 * not affected (BR2.19).
 */
export async function currentSession(): Promise<SessionResolution> {
  if (!isIdentityConfigured()) return { status: "signed-out", clearCookies: false };
  const tokens = readTokenPair(await cookies());
  if (!tokens) return { status: "signed-out", clearCookies: false };
  try {
    const runtime = getIdentityRuntime();
    return await resolveSession(
      tokens,
      { service: runtime.service, database: runtime.database, now: () => Date.now() },
      { canPersist: false },
    );
  } catch {
    return { status: "unavailable" };
  }
}
