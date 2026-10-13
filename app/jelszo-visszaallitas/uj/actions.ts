"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COPY } from "../../../src/identity/copy.ts";
import { writeTokenPair } from "../../../src/identity/cookies.ts";
import { type FormState, passwordFormState } from "../../../src/identity/form-state.ts";
import { completePasswordReset } from "../../../src/identity/reset.ts";
import { getIdentityRuntime } from "../../../src/identity/runtime.ts";

/**
 * Sets the new password (W6). The emailed link only showed the page; the single-use code is exchanged here,
 * on the submit, so a mail scanner that merely opened the link cannot spend it.
 */
export async function setNewPasswordAction(
  tokenHash: string,
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
  const result = await completePasswordReset(
    { tokenHash, password },
    {
      service: runtime.service,
      admin: runtime.admin,
      events: runtime.events,
      emailKeySecret: runtime.emailKeySecret,
    },
  );
  if (result.state !== "success") return passwordFormState(result, COPY.reset.notValid);
  writeTokenPair(await cookies(), result.data.tokens, runtime.settings.appPublicUrl);
  redirect("/bejelentkezes");
}
