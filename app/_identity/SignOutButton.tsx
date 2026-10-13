"use client";

import { useFormStatus } from "react-dom";
import { COPY } from "../../src/identity/copy.ts";
import { signOutAction } from "./actions.ts";

function Button() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="secondary-button"
      disabled={pending}
      data-testid="sign-out-button"
    >
      {pending ? COPY.signOut.pending : COPY.signOut.label}
    </button>
  );
}

/** Ends the current session (BR2.8). */
export function SignOutButton() {
  return (
    <form action={signOutAction} data-testid="sign-out-form">
      <Button />
    </form>
  );
}
