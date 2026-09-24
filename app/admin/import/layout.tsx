import type { ReactNode } from "react";
import { AdminAccessState } from "../_components/AdminAccessState.tsx";
import { resolveAdminSession } from "../_lib/session.ts";

export default async function AdminImportAuthorizationBoundary({
  children,
}: Readonly<{ children: ReactNode }>) {
  const session = await resolveAdminSession();
  if (
    session.state !== "success" ||
    session.data.applicationSession.roles.includes("group_admin")
  ) {
    return <AdminAccessState kind="denied" embedded />;
  }
  return children;
}
