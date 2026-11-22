import { terminalFailure } from "../../../../src/application/results.ts";
import { RotaDutyCard } from "../../../../src/runtime/RotaOverview.tsx";
import { resolveRotaFacade } from "../../../_identity/rota-facade.ts";
import { BottleLine, loadBottleLine } from "../../../_recurring/RecurringScreens.tsx";
import { WeekendPicker } from "../../_components/WeekendPicker.tsx";
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
  // The card of a water week also carries the bottle-cleaning line of that week (BR147.2).
  const bottle =
    session.state === "success"
      ? await loadBottleLine(
          {
            area: "szulo",
            session: session.data.applicationSession,
            scope: session.data.familyScope,
          },
          result,
          id,
        )
      : undefined;
  return (
    <RotaDutyCard
      result={result}
      backHref="/szulo/beosztas"
      renderPicker={(card, own) => <WeekendPicker card={card} own={own} />}
      extra={bottle ? <BottleLine result={bottle} /> : undefined}
    />
  );
}
