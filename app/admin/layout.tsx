import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "../../src/runtime/AppShell.tsx";
import { AdminAccessState } from "./_components/AdminAccessState.tsx";
import { resolveAdminSession } from "./_lib/session.ts";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await resolveAdminSession();
  if (session.state === "signed-out") redirect("/");
  if (session.state === "denied") return <AdminAccessState kind="denied" />;
  if (session.state === "configuration-error") {
    return <AdminAccessState kind="configuration-error" message={session.message} />;
  }
  return <AppShell profile={session.data.profile}>{children}</AppShell>;
}
