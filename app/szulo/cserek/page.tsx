import Link from "next/link";
import type { SwapRequestItemModel } from "../../../src/application/index.ts";
import { SwapRequestsBoard, type SwapRequestView } from "../_components/SwapRequestsBoard.tsx";
import { ParentStatePanel } from "../_components/ParentStatePanel.tsx";
import { resolveParentFacade } from "../_lib/facade.ts";
import { resolveParentSession } from "../_lib/session.ts";
import { formatBudapestDate } from "../feladatok/page.tsx";

/**
 * The swap requests of the family (BR31.4, BR32.7): the ones other families addressed to it, to confirm or
 * decline, and its own open swap and cancellation requests, to withdraw.
 */
export default async function SwapRequestsPage() {
  const session = await resolveParentSession();
  const facade = await resolveParentFacade();
  if (session.state !== "success" || !facade) return null;
  const result = await facade.listSwapRequests(session.data.applicationSession, {
    familyScope: session.data.familyScope,
    familyId: session.data.familyId,
  });
  const requests =
    result.state === "success" ? result.data.requests : result.state === "empty" ? [] : undefined;
  return (
    <section className="parent-page" data-testid="swap-requests-page">
      <header>
        <p className="eyebrow">Szülői felület</p>
        <h1 tabIndex={-1} autoFocus>
          Cserék és kérelmek
        </h1>
        <p>
          Itt válaszolhat a másik családoktól érkezett cserekérelmekre, és visszavonhatja a saját
          nyitott kérelmeit.
        </p>
      </header>
      {/* An empty list still shows the board: the result of the last answer must outlive the request. */}
      {requests ? (
        <SwapRequestsBoard
          incoming={requests.filter((item) => item.direction === "incoming").map(view)}
          outgoing={requests.filter((item) => item.direction === "outgoing").map(view)}
        />
      ) : (
        <ParentStatePanel
          result={result}
          emptyMessage="Jelenleg nincs nyitott cserekérelem."
          testId="swap-requests"
        >
          {() => null}
        </ParentStatePanel>
      )}
      <p>
        <Link href="/szulo/feladatok" data-testid="swap-requests-tasks-link">
          Vissza a családi feladatokhoz
        </Link>
      </p>
    </section>
  );
}

function view(item: SwapRequestItemModel): SwapRequestView {
  return {
    ...item,
    ownWhen: formatBudapestDate(item.ownTaskStartsAt),
    ...(item.partnerTaskStartsAt !== undefined
      ? { partnerWhen: formatBudapestDate(item.partnerTaskStartsAt) }
      : {}),
  };
}
