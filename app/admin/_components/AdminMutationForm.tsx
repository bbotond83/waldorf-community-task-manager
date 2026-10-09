"use client";

import Link from "next/link";
import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { AdminAction, AdminActionState } from "../actions.ts";

const FieldErrorsContext = createContext<Readonly<Record<string, string>>>({});

/**
 * A form that posts to an admin action and shows the outcome. The browser's own required-field
 * check is switched off (`noValidate`) so an empty required field reaches the action and gets
 * the same Hungarian message next to the field and in the summary. With `successLink` the
 * confirmation carries a link (for example back to the list); the form itself stays on the page.
 */
export function AdminMutationForm({
  action,
  submitLabel,
  testId,
  children,
  successLink,
}: Readonly<{
  action: AdminAction;
  submitLabel: string;
  testId: string;
  children: ReactNode;
  successLink?: Readonly<{ href: string; label: string }>;
}>) {
  const [state, formAction, isPending] = useActionState(action, { state: "initial" });
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (["validation", "denied", "conflict", "invalidated", "terminal"].includes(state.state)) {
      summaryRef.current?.focus();
    }
  }, [state.state]);

  return (
    <form action={formAction} className="admin-form" id={testId} noValidate data-testid={testId}>
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
          {state.state === "success" && successLink && (
            <p>
              <Link
                className="admin-form-success-link"
                href={successLink.href}
                data-testid={`${testId}-success-link`}
              >
                {successLink.label}
              </Link>
            </p>
          )}
        </div>
      )}
      <FieldErrorsContext value={state.state === "validation" ? (state.fieldErrors ?? {}) : {}}>
        {children}
      </FieldErrorsContext>
      <button type="submit" disabled={isPending} data-testid={`${testId}-submit-button`}>
        {isPending ? "Feldolgozás folyamatban" : submitLabel}
      </button>
    </form>
  );
}

/**
 * A labelled text input of an admin form. When the last submit reported an error for this field
 * the message is shown right below the input and tied to it for assistive technology.
 */
export function AdminTextField({
  id,
  label,
  testId,
  ...input
}: Readonly<{
  id: string;
  label: string;
  testId: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  maxLength?: number;
}>) {
  const message = useContext(FieldErrorsContext)[input.name];
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        {...input}
        aria-invalid={message ? true : undefined}
        aria-describedby={message ? `${id}-error` : undefined}
        data-testid={testId}
      />
      {message && (
        <p id={`${id}-error`} className="admin-field-error" data-testid={`${testId}-error`}>
          {message}
        </p>
      )}
    </>
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
