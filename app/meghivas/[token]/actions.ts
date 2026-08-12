"use server";

import { cookies } from "next/headers";
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
