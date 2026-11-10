import { budapestToday } from "../../../src/application/rota-format.ts";
import { terminalFailure } from "../../../src/application/results.ts";
import { RotaOverview } from "../../../src/runtime/RotaOverview.tsx";
import { resolveRotaFacade } from "../../_identity/rota-facade.ts";
import { resolveTeacherSession } from "../_lib/session.ts";

/** The teacher reads the same overview as a parent, without a family of their own and without duty cards. */
export default async function TeacherRotaPage({
  searchParams,
}: {
  searchParams: Promise<{ csalad?: string }>;
}) {
  const [session, facade, { csalad = "" }] = await Promise.all([
    resolveTeacherSession(),
    resolveRotaFacade(),
    searchParams,
  ]);
  const result =
    session.state === "success" && facade
      ? await facade.getOverview(session.data.applicationSession, session.data.scope)
      : terminalFailure();
  return (
    <RotaOverview
      result={result}
      today={budapestToday()}
      filter={csalad}
      action="/teacher/beosztas"
      cardHref={() => "/teacher/beosztas"}
    />
  );
}
