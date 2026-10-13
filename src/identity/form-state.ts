import type { ApplicationResult } from "../application/contracts.ts";
import { COPY } from "./copy.ts";
import { INVITATION_BUSY, INVITATION_NOT_VALID, PASSWORD_RULE } from "./invitations.ts";
import { RESET_NOT_VALID } from "./reset.ts";
import { SIGN_IN_LOCKED } from "./sign-in.ts";

/**
 * What a form shows after it was submitted: nothing yet, one Hungarian message with the field it belongs to,
 * or a confirmation. The mapping from an explicit result state to text lives here, so every screen says the
 * same thing for the same outcome and no raw error ever reaches a person (BR2.1, BR2.20). A password is
 * never part of the state; the address may be, so the person does not retype it after an error.
 */
export type FormState = Readonly<{
  status: "idle" | "error" | "success";
  message: string;
  field?: "email" | "password";
  kind?: "not-valid";
  email?: string;
}>;

export const IDLE_FORM: FormState = { status: "idle", message: "" };

export function signInFormState(result: ApplicationResult<unknown>, email: string): FormState {
  if (result.state === "success") return { status: "success", message: "" };
  if (result.state === "denied" && result.code === SIGN_IN_LOCKED) {
    return { status: "error", message: COPY.signIn.locked, email };
  }
  if (
    result.state === "dependency-failure-retryable" ||
    result.state === "dependency-failure-terminal"
  ) {
    return { status: "error", message: COPY.signIn.temporary, email };
  }
  return { status: "error", message: COPY.signIn.invalid, email };
}

export function passwordFormState(
  result: ApplicationResult<unknown>,
  notValidMessage: string,
): FormState {
  if (result.state === "success") return { status: "success", message: "" };
  if (result.state === "validation" && result.code === PASSWORD_RULE) {
    return { status: "error", message: COPY.password.ruleError, field: "password" };
  }
  if (
    result.state === "denied" &&
    (result.code === INVITATION_NOT_VALID || result.code === RESET_NOT_VALID)
  ) {
    return { status: "error", message: notValidMessage, kind: "not-valid" };
  }
  if (result.state === "conflict")
    return { status: "error", message: notValidMessage, kind: "not-valid" };
  if (result.state === "dependency-failure-retryable" && result.code === INVITATION_BUSY) {
    return { status: "error", message: COPY.common.temporary };
  }
  return { status: "error", message: COPY.common.temporary };
}
