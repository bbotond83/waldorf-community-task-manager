/**
 * The password rule (BR2.4): 8 to 72 characters (72 is the byte limit of the sign-in service's
 * hashing), at least one letter and at least one digit. The same text is checked on screen and on the
 * server; the sign-in service applies its own checks as well.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;

export type PasswordRuleViolation = "too_short" | "too_long" | "no_letter" | "no_digit";

export type PasswordCheck = { ok: true } | { ok: false; violation: PasswordRuleViolation };

export function checkPassword(password: string): PasswordCheck {
  if ([...password].length < PASSWORD_MIN_LENGTH) return { ok: false, violation: "too_short" };
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    return { ok: false, violation: "too_long" };
  }
  if (!/\p{L}/u.test(password)) return { ok: false, violation: "no_letter" };
  if (!/[0-9]/.test(password)) return { ok: false, violation: "no_digit" };
  return { ok: true };
}
