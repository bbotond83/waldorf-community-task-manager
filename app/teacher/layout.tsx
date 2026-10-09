import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "../../src/runtime/AppShell.tsx";
import { TeacherAccessState } from "./_components/TeacherAccessState.tsx";
import { resolveTeacherSession } from "./_lib/session.ts";

export const dynamic = "force-dynamic";

export default async function TeacherLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await resolveTeacherSession();
  if (session.state === "signed-out") redirect("/");
  if (session.state !== "success") return <TeacherAccessState kind={session.state} />;
  return <AppShell profile={session.data.profile}>{children}</AppShell>;
}
