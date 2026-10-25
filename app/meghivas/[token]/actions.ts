"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COPY } from "../../../src/identity/copy.ts";
import { writeTokenPair } from "../../../src/identity/cookies.ts";
import { type FormState, passwordFormState } from "../../../src/identity/form-state.ts";
import { acceptInvitation } from "../../../src/identity/invitations.ts";
import { getIdentityRuntime } from "../../../src/identity/runtime.ts";

/**
 * Accepts a real invitation (W5, BR2.11): reserves it, creates the sign-in user, creates the Account and the
 * grant in one transaction, and signs the person in. The token comes from the page address and the key from
 * the rendered page; neither is ever returned.
 */
export async function acceptRealInvitationAction(
  token: string,
  idempotencyKey: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  let runtime: ReturnType<typeof getIdentityRuntime>;
  try {
    runtime = getIdentityRuntime();
  } catch {
    return { status: "error", message: COPY.common.temporary };
  }
  const result = await acceptInvitation(
    { token, password, idempotencyKey },
    {
      service: runtime.service,
      admin: runtime.admin,
      database: runtime.database,
      mailer: runtime.mailer,
      events: runtime.events,
      appPublicUrl: runtime.settings.appPublicUrl,
    },
  );
  if (result.state !== "success") return passwordFormState(result, COPY.invitation.notValid);
  if (!result.data.tokens) redirect("/bejelentkezes");
  writeTokenPair(await cookies(), result.data.tokens, runtime.settings.appPublicUrl);
  redirect("/bejelentkezes");
}
