"use server";

import { after } from "next/server";
import { COPY } from "../../src/identity/copy.ts";
import { isPlausibleEmail, normalizeEmail } from "../../src/identity/crypto.ts";
import type { FormState } from "../../src/identity/form-state.ts";
import { getIdentityRuntime } from "../../src/identity/runtime.ts";
import { requestPasswordReset } from "../../src/identity/reset.ts";

/**
 * Asks for a password reset email (W6, BR2.12). Whatever the address is, a valid-looking one always gets the
 * same confirmation, so the screen never reveals who has an account.
 */
export async function requestResetAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!isPlausibleEmail(email)) {
    return { status: "error", message: COPY.reset.emailInvalid, field: "email", email };
  }
  try {
    const runtime = getIdentityRuntime();
    await requestPasswordReset(email, {
      service: runtime.service,
      admin: runtime.admin,
      events: runtime.events,
      emailKeySecret: runtime.emailKeySecret,
      defer: (task) => after(task),
    });
  } catch {
    // The confirmation is the same even when sending failed; the event line records the failure.
  }
  return { status: "success", message: COPY.reset.confirmation };
}
