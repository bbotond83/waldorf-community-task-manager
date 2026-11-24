import { AnimalSettingsScreen } from "../../_animal/AnimalScreens.tsx";
import { resolveRotaFacade } from "../../_identity/rota-facade.ts";
import { AdminAccessState } from "../_components/AdminAccessState.tsx";
import { resolveAdminSession } from "../_lib/session.ts";

export default async function AdminAnimalCarePage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ tanev?: string }> }>) {
  const [session, rota, { tanev }] = await Promise.all([
    resolveAdminSession(),
    resolveRotaFacade(),
    searchParams,
  ]);
  if (session.state !== "success" || !rota) return <AdminAccessState kind="denied" embedded />;
  const calendar = await rota.getCalendar(
    session.data.applicationSession,
    session.data.scope,
    tanev || undefined,
  );
  const year =
    calendar.state === "success" || calendar.state === "recovery"
      ? calendar.data.schoolYear
      : undefined;
  return (
    <AnimalSettingsScreen
      session={session.data.applicationSession}
      scope={session.data.scope}
      schoolYearId={year?.id}
      schoolYearName={year?.name}
    />
  );
}
