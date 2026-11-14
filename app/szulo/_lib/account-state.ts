import type { ApplicationResult } from "../../../src/application/index.ts";
import { DIRECTORY_REFUSAL_MESSAGES } from "../../../src/data/copy.ts";
import { COPY } from "../../../src/identity/copy.ts";
import { mapParentResult, type ParentActionState } from "./action-state.ts";

/** Which form field each refusal code belongs to, so the message appears next to it. */
const FIELD_OF_CODE: Readonly<Record<string, string>> = Object.freeze({
  PASSWORD_CURRENT_WRONG: "currentPassword",
  PASSWORD_SAME: "newPassword",
  PASSWORD_INVALID: "newPassword",
  PASSWORD_REJECTED: "newPassword",
  EMAIL_INVALID: "email",
  EMAIL_UNAVAILABLE: "email",
  EMAIL_RATE_LIMITED: "email",
  PROFILE_FIELD_INVALID: "profile",
});

const MESSAGE_OF_CODE: Readonly<Record<string, string>> = Object.freeze({
  ...DIRECTORY_REFUSAL_MESSAGES,
  PASSWORD_CURRENT_WRONG: COPY.account.passwordCurrentWrong,
  PASSWORD_SAME: COPY.account.passwordSame,
  PASSWORD_INVALID: COPY.password.ruleError,
  PASSWORD_REJECTED: COPY.password.rejectedNewLink,
  SIGN_IN_LOCKED: COPY.account.passwordLocked,
  EMAIL_MAIL_NOT_SENT: COPY.account.emailMailNotSent,
});

/**
 * The state a form of the "Fiókom" page shows for a result. The refusal code decides the words (one Hungarian text per
 * code, shared with the admin screens) and, for a refused field, which field carries them; a code with no words
 * falls back to the general message of the result state. No text names another person (NFR1.4).
 */
export function mapAccountResult<T>(
  result: ApplicationResult<T>,
  successMessage: string,
): ParentActionState {
  const mapped = mapParentResult(result, successMessage);
  const message =
    result.state !== "success" && Object.hasOwn(MESSAGE_OF_CODE, result.code)
      ? MESSAGE_OF_CODE[result.code]
      : undefined;
  if (!message) return mapped;
  if (result.state === "validation") {
    const field = FIELD_OF_CODE[result.code] ?? "request";
    return {
      ...mapped,
      message: "Ellenőrizze a megadott adatokat.",
      fieldErrors: { [field]: message },
    };
  }
  return { ...mapped, message };
}
