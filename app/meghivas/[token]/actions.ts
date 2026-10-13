"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COPY } from "../../../src/identity/copy.ts";
import { writeTokenPair } from "../../../src/identity/cookies.ts";
import { type FormState, passwordFormState } from "../../../src/identity/form-state.ts";
import { acceptInvitation } from "../../../src/identity/invitations.ts";
import { getIdentityRuntime } from "../../../src/identity/runtime.ts";
import { composeRuntime } from "../../../src/runtime/composition.ts";
import { createSyntheticParentSessionFacade } from "../../../src/parent-web/index.ts";
import {
  createSyntheticSessionToken,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "../../../src/runtime/session/session.ts";
import { getSyntheticProfile } from "../../../src/runtime/synthetic/profiles.ts";

export type InvitationActionState = Readonly<{
  state: "initial" | "success" | "denied" | "terminal";
  message?: string;
  destination?: string;
}>;

export async function acceptInvitationAction(
  token: string,
  previousState: InvitationActionState,
): Promise<InvitationActionState> {
  void previousState;
  const composition = await composeRuntime();
  if (!composition.ok || composition.value.mode !== "synthetic")
    return { state: "terminal", message: "A meghívás most nem dolgozható fel." };
  const facade = createSyntheticParentSessionFacade(composition.value.application.authorization);
  const result = await facade.acceptInvitation(token, Object.freeze({}));
  if (result.state !== "success")
    return { state: "denied", message: "A meghívás nem használható." };
  const profile = getSyntheticProfile("parent-local")!;
  (await cookies()).set(
    SESSION_COOKIE_NAME,
    createSyntheticSessionToken(profile),
    sessionCookieOptions(false),
  );
  return {
    state: "success",
    message: "A meghívás elfogadva.",
    destination: result.data.destination,
  };
}

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

export async function resendInvitationAction(
  _state: InvitationActionState,
  formData: FormData,
): Promise<InvitationActionState> {
  const composition = await composeRuntime();
  if (!composition.ok || composition.value.mode !== "synthetic")
    return { state: "terminal", message: "A kérés most nem küldhető el." };
  const facade = createSyntheticParentSessionFacade(composition.value.application.authorization);
  await facade.resendInvitation(String(formData.get("identifier") ?? ""));
  return {
    state: "success",
    message:
      "Ha a megadott címhez tartozik meghívás, új üzenetet küldünk. Helyi módban a küldés szimulált.",
  };
}
