"use client";

import Link from "next/link";
import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";
import { freshKey, keyPrefix } from "../../szulo/_components/fresh-key.ts";
import type { AdminAction, AdminActionState } from "../actions.ts";

const FieldErrorsContext = createContext<Readonly<Record<string, string>>>({});

/**
 * A form that posts to an admin action and shows the outcome. The browser's own required-field
 * check is switched off (`noValidate`) so an empty required field reaches the action and gets
 * the same Hungarian message next to the field and in the summary. With `successLink` the
 * confirmation carries a link (for example back to the list); the form itself stays on the page.
 *
 * `longForm` is for the extended record and task forms (BR32.7): a React form action empties the fields
 * once it has run, which would throw away a long entry after one mistyped value, so a long form is sent
 * from its submit handler instead, keeps what was typed when the server refuses it, and clears itself
 * only after a created record was saved. It also sends a new idempotency key with every attempt, because
 * the database refuses a key that is used again with different content.
 */
export function AdminMutationForm({
  action,
  submitLabel,
  testId,
  children,
  successLink,
  longForm = false,
  clearOnSuccess = false,
}: Readonly<{
  action: AdminAction;
  submitLabel: string;
  testId: string;
  children: ReactNode;
  successLink?: Readonly<{ href: string; label: string }>;
  longForm?: boolean;
  clearOnSuccess?: boolean;
}>) {
  const [state, formAction, isPending] = useActionState(action, { state: "initial" });
  const summaryRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (["validation", "denied", "conflict", "invalidated", "terminal"].includes(state.state)) {
      summaryRef.current?.focus();
    }
    if (state.state === "success" && longForm && clearOnSuccess) formRef.current?.reset();
  }, [state.state, longForm, clearOnSuccess]);

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
    const current = data.get("idempotencyKey");
    data.set("idempotencyKey", freshKey(keyPrefix(typeof current === "string" ? current : "")));
    startTransition(() => formAction(data));
  }

  return (
    <form
      ref={formRef}
      action={longForm ? undefined : formAction}
      onSubmit={longForm ? send : undefined}
      className="admin-form"
      id={testId}
      noValidate
      data-testid={testId}
    >
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
  hint,
  ...input
}: Readonly<{
  id: string;
  label: string;
  testId: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  maxLength?: number;
  /** The input type: text by default; email, tel, date, datetime-local and number are used by the record and task forms. */
  type?: "text" | "email" | "tel" | "date" | "datetime-local" | "number";
  min?: number;
  max?: number;
  /** A short help text read together with the label. */
  hint?: string;
}>) {
  const message = useContext(FieldErrorsContext)[input.name];
  const describedBy = [hint ? `${id}-hint` : undefined, message ? `${id}-error` : undefined]
    .filter(Boolean)
    .join(" ");
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        {...input}
        aria-invalid={message ? true : undefined}
        aria-describedby={describedBy || undefined}
        data-testid={testId}
      />
      {hint && (
        <p id={`${id}-hint`} className="form-hint">
          {hint}
        </p>
      )}
      {message && (
        <p id={`${id}-error`} className="admin-field-error" data-testid={`${testId}-error`}>
          {message}
        </p>
      )}
    </>
  );
}

/** A labelled choice from a list. `placeholder` adds an empty first option (the choice is then not preselected). */
export function AdminSelectField({
  id,
  label,
  testId,
  name,
  options,
  defaultValue,
  required,
  placeholder,
  hint,
  onChange,
  value,
}: Readonly<{
  id: string;
  label: string;
  testId: string;
  name: string;
  options: readonly Readonly<{ value: string; label: string }>[];
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  /** With `value`, the field is controlled by the form (the record form shows fields by the chosen type). */
  value?: string;
  onChange?: (value: string) => void;
}>) {
  const message = useContext(FieldErrorsContext)[name];
  const describedBy = [hint ? `${id}-hint` : undefined, message ? `${id}-error` : undefined]
    .filter(Boolean)
    .join(" ");
  const controlled = value !== undefined ? { value } : { defaultValue };
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        name={name}
        required={required}
        {...controlled}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        aria-invalid={message ? true : undefined}
        aria-describedby={describedBy || undefined}
        data-testid={testId}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && (
        <p id={`${id}-hint`} className="form-hint">
          {hint}
        </p>
      )}
      {message && (
        <p id={`${id}-error`} className="admin-field-error" data-testid={`${testId}-error`}>
          {message}
        </p>
      )}
    </>
  );
}

/** A labelled file chooser (the workbook upload). Its hint and its error are tied to it like the text input's. */
export function AdminFileField({
  id,
  label,
  testId,
  name,
  accept,
  hint,
}: Readonly<{
  id: string;
  label: string;
  testId: string;
  name: string;
  accept?: string;
  hint?: string;
}>) {
  const message = useContext(FieldErrorsContext)[name];
  const describedBy = [hint ? `${id}-hint` : undefined, message ? `${id}-error` : undefined]
    .filter(Boolean)
    .join(" ");
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="file"
        name={name}
        accept={accept}
        aria-invalid={message ? true : undefined}
        aria-describedby={describedBy || undefined}
        data-testid={testId}
      />
      {hint && (
        <p id={`${id}-hint`} className="form-hint">
          {hint}
        </p>
      )}
      {message && (
        <p id={`${id}-error`} className="admin-field-error" data-testid={`${testId}-error`}>
          {message}
        </p>
      )}
    </>
  );
}

/** A labelled multi-line text of an admin form, with its error tied to it like the text input. */
export function AdminTextareaField({
  id,
  label,
  testId,
  hint,
  ...input
}: Readonly<{
  id: string;
  label: string;
  testId: string;
  name: string;
  defaultValue?: string;
  maxLength?: number;
  required?: boolean;
  hint?: string;
}>) {
  const message = useContext(FieldErrorsContext)[input.name];
  const describedBy = [hint ? `${id}-hint` : undefined, message ? `${id}-error` : undefined]
    .filter(Boolean)
    .join(" ");
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        {...input}
        aria-invalid={message ? true : undefined}
        aria-describedby={describedBy || undefined}
        data-testid={testId}
      />
      {hint && (
        <p id={`${id}-hint`} className="form-hint">
          {hint}
        </p>
      )}
      {message && (
        <p id={`${id}-error`} className="admin-field-error" data-testid={`${testId}-error`}>
          {message}
        </p>
      )}
    </>
  );
}

/** A labelled tick box. The label is after the box and clickable; an error is tied to the box. */
export function AdminCheckboxField({
  id,
  label,
  testId,
  name,
  value,
  defaultChecked,
  hint,
}: Readonly<{
  id: string;
  label: string;
  testId: string;
  name: string;
  value?: string;
  defaultChecked?: boolean;
  hint?: string;
}>) {
  const message = useContext(FieldErrorsContext)[name];
  const describedBy = [hint ? `${id}-hint` : undefined, message ? `${id}-error` : undefined]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="admin-checkbox-field">
      <label htmlFor={id} className="admin-checkbox-label">
        <input
          type="checkbox"
          id={id}
          name={name}
          value={value ?? "on"}
          defaultChecked={defaultChecked}
          aria-invalid={message ? true : undefined}
          aria-describedby={describedBy || undefined}
          data-testid={testId}
        />
        <span>{label}</span>
      </label>
      {hint && (
        <p id={`${id}-hint`} className="form-hint">
          {hint}
        </p>
      )}
      {message && (
        <p id={`${id}-error`} className="admin-field-error" data-testid={`${testId}-error`}>
          {message}
        </p>
      )}
    </div>
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
