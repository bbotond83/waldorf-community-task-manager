"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import type { ParentActionState } from "../_lib/action-state.ts";

export type ParentAction = (
  state: ParentActionState,
  formData: FormData,
) => Promise<ParentActionState>;

export function ParentMutationForm({
  action,
  submitLabel,
  testId,
  children,
}: Readonly<{
  action: ParentAction;
  submitLabel: string;
  testId: string;
  children?: ReactNode;
}>) {
  const [state, formAction, isPending] = useActionState(action, { state: "initial" });
  const stateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (["validation", "denied", "conflict", "invalidated", "terminal"].includes(state.state)) {
      stateRef.current?.focus();
    }
  }, [state.state]);

  return (
    <form action={formAction} className="parent-form" data-testid={testId}>
      {state.state !== "initial" && (
        <div
          ref={stateRef}
          id={`${testId}-state`}
          className={`parent-action-state parent-action-state-${state.state}`}
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
