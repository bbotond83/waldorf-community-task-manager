"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COPY } from "../../src/identity/copy.ts";
import { writeTokenPair } from "../../src/identity/cookies.ts";
import { type FormState, signInFormState } from "../../src/identity/form-state.ts";
import { getIdentityRuntime } from "../../src/identity/runtime.ts";
import { signIn } from "../../src/identity/sign-in.ts";

/**
 * The sign-in server action (W1). The screen never calls the sign-in service or the database itself: this
 * action does, and answers with a Hungarian message for every outcome. Credentials are read from the form,
 * used once and never returned.
 */
export async function signInAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  let runtime: ReturnType<typeof getIdentityRuntime>;
  try {
    runtime = getIdentityRuntime();
  } catch {
    return { status: "error", message: COPY.signIn.temporary, email };
  }
  const result = await signIn(
    { email, password },
    {
      service: runtime.service,
      admin: runtime.admin,
      database: runtime.database,
      events: runtime.events,
      emailKeySecret: runtime.emailKeySecret,
      now: () => Date.now(),
      housekeeping: async () => {
        const done = await runtime.admin.callFunction("identity_housekeeping", {});
        runtime.events.emit(done.ok ? "housekeeping_done" : "housekeeping_failed");
      },
    },
  );
  if (result.state !== "success") return signInFormState(result, email);
  writeTokenPair(await cookies(), result.data, runtime.settings.appPublicUrl);
  redirect("/bejelentkezes");
}
