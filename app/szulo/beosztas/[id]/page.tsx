import { terminalFailure } from "../../../../src/application/results.ts";
import { RotaDutyCard } from "../../../../src/runtime/RotaOverview.tsx";
import { resolveRotaFacade } from "../../../_identity/rota-facade.ts";
import { resolveParentSession } from "../../_lib/session.ts";

export default async function ParentRotaDutyPage({ params }: { params: Promise<{ id: string }> }) {
  const [session, facade, { id }] = await Promise.all([
    resolveParentSession(),
    resolveRotaFacade(),
    params,
  ]);
  // A made-up or foreign id reaches the database like any other and comes back as the same refusal.
  const result =
    session.state === "success" && facade
      ? await facade.getDutyCard(session.data.applicationSession, session.data.familyScope, id)
      : terminalFailure();
  return <RotaDutyCard result={result} backHref="/szulo/beosztas" />;
}
