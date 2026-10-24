"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";
import type { ParentActionState } from "../_lib/action-state.ts";
import { freshKey, keyPrefix } from "./fresh-key.ts";

export type ParentAction = (
  state: ParentActionState,
  formData: FormData,
) => Promise<ParentActionState>;

/**
 * A form that posts to a parent action and shows the outcome. With `afterSuccess` the fields and
 * the submit button are replaced by that content once the action succeeded, so the same request
 * cannot be sent twice (the swap and cancellation request pages use it for their pending notice).
 * `alreadyDone` shows that content from the start, for a request that was sent earlier; keeping
 * the same form mounted lets the confirmation survive the refresh that follows a success.
 * With `freshIdempotencyKey` every attempt sends a new key made from the form's own key prefix, because
 * the real database refuses a key that is used again with different content; the page-made key stays in
 * the form as the fallback for a send that does not run in the browser.
 */
export function ParentMutationForm({
  action,
  submitLabel,
  testId,
  children,
  afterSuccess,
  alreadyDone = false,
  freshIdempotencyKey = false,
}: Readonly<{
  action: ParentAction;
  submitLabel: string;
  testId: string;
  children?: ReactNode;
  afterSuccess?: ReactNode;
  alreadyDone?: boolean;
  freshIdempotencyKey?: boolean;
}>) {
  const [state, dispatch, isPending] = useActionState(action, { state: "initial" });
  // A React form action empties the fields once it has run, which would drop a typed reason and a chosen
  // partner after a refused attempt. A form with fresh keys is therefore sent from its submit handler, which
  // leaves the fields as they are.
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(
      event.currentTarget,
      (event.nativeEvent as SubmitEvent).submitter,
    );
    const current = formData.get("idempotencyKey");
    formData.set("idempotencyKey", freshKey(keyPrefix(typeof current === "string" ? current : "")));
    startTransition(() => dispatch(formData));
  }
  const stateRef = useRef<HTMLDivElement>(null);
  const replaced = (state.state === "success" || alreadyDone) && afterSuccess !== undefined;

  useEffect(() => {
    if (["validation", "denied", "conflict", "invalidated", "terminal"].includes(state.state)) {
      stateRef.current?.focus();
    }
  }, [state.state]);

  return (
    <form
      action={freshIdempotencyKey ? undefined : dispatch}
      onSubmit={freshIdempotencyKey ? send : undefined}
      className="parent-form"
      data-testid={testId}
    >
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
      {replaced ? (
        afterSuccess
      ) : (
        <>
          {children}
          <button type="submit" disabled={isPending} data-testid={`${testId}-submit-button`}>
            {isPending ? "Feldolgozás folyamatban" : submitLabel}
          </button>
        </>
      )}
    </form>
  );
}
