"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { COPY } from "../../src/identity/copy.ts";
import type { FormState } from "../../src/identity/form-state.ts";
import { signInAction } from "./actions.ts";

const INITIAL: FormState = { status: "idle", message: "" };

/**
 * Email and password form (W1). Field state is held by the browser; nothing but the address comes back from
 * the server, so no credential stays in client state after a submit. Errors sit in a live region and are
 * linked to their field.
 */
export function SignInForm() {
  const [state, action, isPending] = useActionState(signInAction, INITIAL);
  const [missing, setMissing] = useState<{ email?: string; password?: string }>({});
  const messageRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.status === "error") messageRef.current?.focus();
  }, [state]);

  const describedBy = (field: "email" | "password") =>
    missing[field] ? `signin-${field}-error` : undefined;

  return (
    <form
      action={action}
      className="parent-form identity-form"
      data-testid="sign-in-form"
      noValidate
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        const next: { email?: string; password?: string } = {};
        if (!String(data.get("email") ?? "").trim()) next.email = COPY.signIn.emailRequired;
        if (!String(data.get("password") ?? "")) next.password = COPY.signIn.passwordRequired;
        setMissing(next);
        if (next.email || next.password) event.preventDefault();
      }}
    >
      <p
        ref={messageRef}
        tabIndex={-1}
        role="alert"
        id="signin-form-error"
        data-testid="sign-in-error"
        hidden={state.status !== "error"}
      >
        {state.status === "error" ? state.message : ""}
      </p>
      <label htmlFor="signin-email">{COPY.signIn.emailLabel}</label>
      <input
        id="signin-email"
        name="email"
        type="email"
        autoComplete="username"
        defaultValue={state.email ?? ""}
        aria-invalid={missing.email ? true : undefined}
        aria-describedby={describedBy("email")}
        data-testid="sign-in-email"
      />
      {missing.email && (
        <p role="alert" id="signin-email-error" data-testid="sign-in-email-error">
          {missing.email}
        </p>
      )}
      <label htmlFor="signin-password">{COPY.signIn.passwordLabel}</label>
      <input
        id="signin-password"
        name="password"
        type="password"
        autoComplete="current-password"
        aria-invalid={missing.password ? true : undefined}
        aria-describedby={describedBy("password")}
        data-testid="sign-in-password"
      />
      {missing.password && (
        <p role="alert" id="signin-password-error" data-testid="sign-in-password-error">
          {missing.password}
        </p>
      )}
      <button type="submit" disabled={isPending} data-testid="sign-in-submit">
        {isPending ? COPY.signIn.pending : COPY.signIn.submit}
      </button>
    </form>
  );
}
