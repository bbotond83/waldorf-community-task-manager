"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { COPY } from "../../../src/identity/copy.ts";
import type { FormState } from "../../../src/identity/form-state.ts";
import { checkPassword } from "../../../src/identity/password.ts";
import { acceptRealInvitationAction } from "./actions.ts";

const INITIAL: FormState = { status: "idle", message: "" };

type Props = Readonly<{ token: string; idempotencyKey: string }>;

/**
 * Sets the password of a real invitation (W5). The idempotency key is made when the page is rendered, so a
 * second click on the same page returns the stored result instead of acting twice.
 */
export function AcceptInvitationForm({ token, idempotencyKey }: Props) {
  const [state, action, isPending] = useActionState(
    acceptRealInvitationAction.bind(null, token, idempotencyKey),
    INITIAL,
  );
  const [ruleError, setRuleError] = useState("");
  const messageRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.status === "error") messageRef.current?.focus();
  }, [state]);

  const fieldError =
    ruleError || (state.status === "error" && state.field === "password" ? state.message : "");
  const formError = state.status === "error" && state.field !== "password" ? state.message : "";

  return (
    <form
      action={action}
      className="parent-form identity-form"
      data-testid="accept-invitation-form"
      noValidate
      onSubmit={(event) => {
        const password = String(new FormData(event.currentTarget).get("password") ?? "");
        if (!checkPassword(password).ok) {
          setRuleError(COPY.password.ruleError);
          event.preventDefault();
        } else {
          setRuleError("");
        }
      }}
    >
      <p
        ref={messageRef}
        tabIndex={-1}
        role="alert"
        data-testid="accept-invitation-error"
        hidden={!formError}
      >
        {formError}
      </p>
      <label htmlFor="invitation-password">{COPY.invitation.passwordLabel}</label>
      <p id="invitation-password-rule" data-testid="accept-invitation-rule">
        {COPY.password.hint}
      </p>
      <input
        id="invitation-password"
        name="password"
        type="password"
        autoComplete="new-password"
        aria-invalid={fieldError ? true : undefined}
        aria-describedby={
          fieldError
            ? "invitation-password-rule invitation-password-error"
            : "invitation-password-rule"
        }
        data-testid="accept-invitation-password"
      />
      {fieldError && (
        <p role="alert" id="invitation-password-error" data-testid="accept-invitation-field-error">
          {fieldError}
        </p>
      )}
      <button type="submit" disabled={isPending} data-testid="accept-invitation-submit">
        {isPending ? COPY.invitation.pending : COPY.invitation.submit}
      </button>
    </form>
  );
}
