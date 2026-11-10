import { budapestToday } from "../../../src/application/rota-format.ts";
import { terminalFailure } from "../../../src/application/results.ts";
import { RotaOverview } from "../../../src/runtime/RotaOverview.tsx";
import { resolveRotaFacade } from "../../_identity/rota-facade.ts";
import { resolveParentSession } from "../_lib/session.ts";

export default async function ParentRotaPage({
  searchParams,
}: {
  searchParams: Promise<{ csalad?: string }>;
}) {
  const [session, facade, { csalad = "" }] = await Promise.all([
    resolveParentSession(),
    resolveRotaFacade(),
    searchParams,
  ]);
  const result =
    session.state === "success" && facade
      ? await facade.getOverview(session.data.applicationSession, session.data.familyScope)
      : terminalFailure();
  return (
    <RotaOverview
      result={result}
      today={budapestToday()}
      filter={csalad}
      action="/szulo/beosztas"
      cardHref={(id) => `/szulo/beosztas/${id}`}
    />
  );
}
