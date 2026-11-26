"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { AdminAction } from "../actions.ts";
import { AdminMutationForm } from "./AdminMutationForm.tsx";

/**
 * The confirm button of a removal and the way back. A committed removal answers with the page that lists what is left
 * to handle, and the form goes there. The move is made as the answer arrives, not by an effect of the form: the
 * refreshed confirmation page no longer shows the form.
 */
export function RemovalForm({
  action,
  submitLabel,
  testId,
  cancelHref,
  children,
}: Readonly<{
  action: AdminAction;
  submitLabel: string;
  testId: string;
  cancelHref: string;
  children: ReactNode;
}>) {
  const router = useRouter();
  const leading: AdminAction = async (state, data) => {
    const result = await action(state, data);
    if (result.resultPath) router.push(result.resultPath);
    return result;
  };
  return (
    <>
      <AdminMutationForm action={leading} submitLabel={submitLabel} testId={testId} longForm>
        {children}
      </AdminMutationForm>
      <Link className="admin-back-link" href={cancelHref} data-testid={`${testId}-cancel`}>
        Mégsem
      </Link>
    </>
  );
}
