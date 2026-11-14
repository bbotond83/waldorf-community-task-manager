"use client";

import { useContext } from "react";
import { ParentFieldErrorsContext } from "./ParentMutationForm.tsx";

/**
 * A labelled text input or text area of a parent form. A refused submit shows its message right below the field,
 * tied to it for assistive technology, and keeps what was typed (the form is sent from its submit handler).
 */
export function ParentTextField({
  id,
  name,
  label,
  testId,
  hint,
  multiline = false,
  type = "text",
  defaultValue,
  maxLength,
  autoComplete,
}: Readonly<{
  id: string;
  name: string;
  label: string;
  testId: string;
  hint?: string;
  multiline?: boolean;
  type?: "text" | "email" | "tel" | "password";
  defaultValue?: string;
  maxLength?: number;
  autoComplete?: string;
}>) {
  const message = useContext(ParentFieldErrorsContext)[name];
  const describedBy = [hint ? `${id}-hint` : undefined, message ? `${id}-error` : undefined]
    .filter(Boolean)
    .join(" ");
  const shared = {
    id,
    name,
    defaultValue,
    maxLength,
    "aria-invalid": message ? true : undefined,
    "aria-describedby": describedBy || undefined,
    "data-testid": testId,
  } as const;
  return (
    <div className="parent-field">
      <label htmlFor={id}>{label}</label>
      {hint && (
        <p id={`${id}-hint`} className="form-hint">
          {hint}
        </p>
      )}
      {multiline ? (
        <textarea rows={3} {...shared} />
      ) : (
        <input type={type} autoComplete={autoComplete} {...shared} />
      )}
      {message && (
        <p id={`${id}-error`} className="parent-field-error" data-testid={`${testId}-error`}>
          {message}
        </p>
      )}
    </div>
  );
}
