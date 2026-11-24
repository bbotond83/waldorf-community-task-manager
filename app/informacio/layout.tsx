import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "../../src/runtime/AppShell.tsx";
import { resolveInfoActor } from "../_info/actor.ts";
import { shellHeaderAction } from "../_identity/shell-action.tsx";

export const dynamic = "force-dynamic";

/** The information page is every role's: the shell is the one of whichever role the signed-in account holds. */
export default async function InformationLayout({ children }: Readonly<{ children: ReactNode }>) {
  const actor = await resolveInfoActor();
  if (!actor) redirect("/");
  return (
    <AppShell profile={actor.profile} headerAction={await shellHeaderAction()}>
      {children}
    </AppShell>
  );
}
