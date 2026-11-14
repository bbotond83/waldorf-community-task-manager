"use server";

import { confirmEmailChange } from "../../../src/identity/account-changes.ts";
import { accountChangeDeps, getIdentityRuntime } from "../../../src/identity/runtime.ts";

export type ConfirmState = Readonly<{ status: "idle" | "success" | "not-valid" | "error" }>;

/**
 * Confirms the new sign-in address (W5). It is a POST from the button of the page, so a mail scanner that only opens
 * the link cannot spend it. Every refusal of the link reads alike; only a failure to reach the service reads as an
 * error the person can retry.
 */
export async function confirmEmailAction(token: string): Promise<ConfirmState> {
  let runtime: ReturnType<typeof getIdentityRuntime>;
  try {
    runtime = getIdentityRuntime();
  } catch {
    return { status: "error" };
  }
  const result = await confirmEmailChange(token, accountChangeDeps(runtime));
  if (result.state === "success") return { status: "success" };
  if (result.state === "dependency-failure-retryable") return { status: "error" };
  return { status: "not-valid" };
}
