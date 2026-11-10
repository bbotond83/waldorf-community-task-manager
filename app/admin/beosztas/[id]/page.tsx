import { RotaDutyCard } from "../../../../src/runtime/RotaOverview.tsx";
import { resolveRotaFacade } from "../../../_identity/rota-facade.ts";
import { AdminAccessState } from "../../_components/AdminAccessState.tsx";
import { resolveAdminSession } from "../../_lib/session.ts";

/**
 * A super admin reads any published duty card, read-only (BR24.2). A group admin is denied here; one who is also a
 * parent of the holding family opens the card from the parent area instead.
 */
export default async function AdminRotaDutyPage({ params }: { params: Promise<{ id: string }> }) {
  const [session, facade, { id }] = await Promise.all([
    resolveAdminSession(),
    resolveRotaFacade(),
    params,
  ]);
  if (session.state !== "success" || !facade) return <AdminAccessState kind="denied" embedded />;
  // A made-up id reaches the database like any other and comes back as the same refusal.
  const result = await facade.getDutyCard(session.data.applicationSession, session.data.scope, id);
  return <RotaDutyCard result={result} backHref="/admin/beosztas" />;
}
