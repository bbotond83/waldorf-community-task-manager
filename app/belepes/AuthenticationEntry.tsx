"use client";

import { useActionState, useEffect, useRef } from "react";
import { authenticateParentAction } from "./actions.ts";

export function AuthenticationEntry({ intendedPath }: Readonly<{ intendedPath: string }>) {
  const [state, action, isPending] = useActionState(authenticateParentAction, {
    state: "initial" as const,
  });
  const stateRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.state === "validation" || state.state === "denied" || state.state === "terminal") {
      stateRef.current?.focus();
    }
  }, [state.state]);
  return (
    <form action={action} className="parent-form" data-testid="authentication-form">
      {state.state !== "initial" && (
        <div
          ref={stateRef}
          tabIndex={-1}
          role={state.state === "success" ? "status" : "alert"}
          aria-live={state.state === "success" ? "polite" : "assertive"}
          data-testid={`authentication-state-${state.state}`}
        >
          <strong>{state.message}</strong>
          {state.destination && (
            <>
              {" "}
              <a href={state.destination} data-testid="authentication-destination-link">
                Tovább a szülői felületre
              </a>
            </>
          )}
        </div>
      )}
      <input type="hidden" name="intendedPath" value={intendedPath} />
      <label htmlFor="identifier">Helyi tesztazonosító</label>
      <input
        id="identifier"
        name="identifier"
        defaultValue="parent-local"
        autoComplete="username"
        required
        data-testid="authentication-identifier-input"
      />
      <button type="submit" disabled={isPending} data-testid="authentication-submit-button">
        {isPending ? "Bejelentkezés folyamatban" : "Bejelentkezés"}
      </button>
    </form>
  );
}
