"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { COPY } from "../../../src/identity/copy.ts";
import type { FormState } from "../../../src/identity/form-state.ts";
import { checkPassword } from "../../../src/identity/password.ts";
import { setNewPasswordAction } from "./actions.ts";

const INITIAL: FormState = { status: "idle", message: "" };

type Props = Readonly<{ tokenHash: string }>;

/**
 * The new-password form (W6). The password rule is shown next to the field and checked before submit; the
 * server checks it again. The link's code is exchanged on submit, not when the page opens.
 */
export function SetPasswordForm({ tokenHash }: Props) {
  const [state, action, isPending] = useActionState(
    setNewPasswordAction.bind(null, tokenHash),
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
      data-testid="set-password-form"
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
        data-testid="set-password-error"
        hidden={!formError}
      >
        {formError}
      </p>
      {state.status === "error" && state.kind === "not-valid" && (
        <a href="/jelszo-visszaallitas" data-testid="set-password-request-link">
          {COPY.reset.requestNewLink}
        </a>
      )}
      <label htmlFor="new-password">{COPY.reset.newPasswordLabel}</label>
      <p id="new-password-rule" data-testid="set-password-rule">
        {COPY.password.hint}
      </p>
      <input
        id="new-password"
        name="password"
        type="password"
        autoComplete="new-password"
        aria-invalid={fieldError ? true : undefined}
        aria-describedby={fieldError ? "new-password-rule new-password-error" : "new-password-rule"}
        data-testid="set-password-input"
      />
      {fieldError && (
        <p role="alert" id="new-password-error" data-testid="set-password-field-error">
          {fieldError}
        </p>
      )}
      <button type="submit" disabled={isPending} data-testid="set-password-submit">
        {isPending ? COPY.reset.newPending : COPY.reset.newSubmit}
      </button>
    </form>
  );
}
