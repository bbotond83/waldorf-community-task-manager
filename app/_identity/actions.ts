"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { clearTokenPair, readTokenPair } from "../../src/identity/cookies.ts";
import { getIdentityRuntime } from "../../src/identity/runtime.ts";
import { endSession } from "../../src/identity/session.ts";

/**
 * Sign out (W3, BR2.8): ends only this browser's session in the sign-in service (scope local) and clears the
 * cookies. Other sessions of the same or other accounts are unaffected. When the service cannot be reached
 * the cookies are cleared anyway, so this browser is signed out; the session then ends by itself (BR2.5).
 */
export async function signOutAction(): Promise<void> {
  const store = await cookies();
  const tokens = readTokenPair(store);
  let appPublicUrl = "http://127.0.0.1:3000";
  try {
    const runtime = getIdentityRuntime();
    appPublicUrl = runtime.settings.appPublicUrl;
    const outcome = await endSession(tokens, { service: runtime.service, now: () => Date.now() });
    runtime.events.emit("sign_out", {}, outcome);
  } catch {
    // Configuration or network trouble: clear the cookies below regardless.
  }
  clearTokenPair(store, appPublicUrl);
  redirect("/bejelentkezes");
}
