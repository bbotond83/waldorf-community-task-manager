import type { ReactNode } from "react";
import { AppShell } from "../../src/runtime/AppShell.tsx";
import { StaffAccessState } from "./_components/StaffAccessState.tsx";
import { resolveStaffSession } from "./_lib/session.ts";

export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await resolveStaffSession();
  if (session.state !== "success") return <StaffAccessState kind={session.state} />;
  return <AppShell profile={session.data.profile}>{children}</AppShell>;
}
