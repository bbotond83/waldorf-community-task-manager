"use client";

import { useActionState, useEffect, useRef } from "react";
import { COPY } from "../../src/identity/copy.ts";
import type { FormState } from "../../src/identity/form-state.ts";
import { requestResetAction } from "./actions.ts";

const INITIAL: FormState = { status: "idle", message: "" };

/** The email field of the reset request (W6). The confirmation is the same for every address. */
export function RequestResetForm() {
  const [state, action, isPending] = useActionState(requestResetAction, INITIAL);
  const messageRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.status !== "idle") messageRef.current?.focus();
  }, [state]);

  return (
    <form
      action={action}
      className="parent-form identity-form"
      data-testid="request-reset-form"
      noValidate
    >
      <p
        ref={messageRef}
        tabIndex={-1}
        role={state.status === "error" ? "alert" : "status"}
        id="reset-request-message"
        data-testid={
          state.status === "error" ? "request-reset-error" : "request-reset-confirmation"
        }
        hidden={state.status === "idle"}
      >
        {state.message}
      </p>
      <label htmlFor="reset-email">{COPY.reset.emailLabel}</label>
      <input
        id="reset-email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.email ?? ""}
        aria-invalid={state.status === "error" ? true : undefined}
        aria-describedby={state.status === "error" ? "reset-request-message" : undefined}
        data-testid="request-reset-email"
      />
      <button type="submit" disabled={isPending} data-testid="request-reset-submit">
        {isPending ? COPY.reset.requestPending : COPY.reset.requestSubmit}
      </button>
    </form>
  );
}
