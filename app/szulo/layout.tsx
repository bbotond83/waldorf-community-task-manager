import type { ReactNode } from "react";
import { AppShell } from "../../src/runtime/AppShell.tsx";
import { shellHeaderAction } from "../_identity/shell-action.tsx";
import { ParentAccessState } from "./_components/ParentAccessState.tsx";
import { resolveParentSession } from "./_lib/session.ts";

export const dynamic = "force-dynamic";

export default async function ParentLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await resolveParentSession();
  if (session.state !== "success") {
    return (
      <ParentAccessState
        kind={session.state}
        homePath={session.state === "denied" ? session.homePath : undefined}
      />
    );
  }
  return (
    <AppShell profile={session.data.profile} headerAction={await shellHeaderAction()}>
      {children}
    </AppShell>
  );
}
