"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import type { AdminAction, AdminActionState } from "../actions.ts";

export function AdminMutationForm({
  action,
  submitLabel,
  testId,
  children,
}: Readonly<{ action: AdminAction; submitLabel: string; testId: string; children: ReactNode }>) {
  const [state, formAction, isPending] = useActionState(action, { state: "initial" });
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (["validation", "denied", "conflict", "invalidated", "terminal"].includes(state.state)) {
      summaryRef.current?.focus();
    }
  }, [state.state]);

  return (
    <form action={formAction} className="admin-form" data-testid={testId}>
      {state.state !== "initial" && (
        <div
          ref={summaryRef}
          id="hibajelzes"
          className={`admin-action-state admin-action-state-${state.state}`}
          role={state.state === "success" ? "status" : "alert"}
          aria-live={state.state === "success" ? "polite" : "assertive"}
          tabIndex={-1}
          data-testid={`${testId}-state-${state.state}`}
        >
          <strong>{state.message}</strong>
          {state.fieldErrors && (
            <ul>
              {Object.entries(state.fieldErrors).map(([field, message]) => (
                <li key={field}>
                  <a href={`#${field}`}>{message}</a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {children}
      <button type="submit" disabled={isPending} data-testid={`${testId}-submit-button`}>
        {isPending ? "Feldolgozás folyamatban" : submitLabel}
      </button>
    </form>
  );
}

export function ErrorSummary({ state }: Readonly<{ state: AdminActionState }>) {
  if (state.state !== "validation" || !state.fieldErrors) return null;
  return (
    <div id="hibajelzes" role="alert" tabIndex={-1} data-testid="admin-error-summary">
      <h2>Ellenőrizze a mezőket</h2>
      <ul>
        {Object.entries(state.fieldErrors).map(([field, message]) => (
          <li key={field}>
            <a href={`#${field}`}>{message}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
