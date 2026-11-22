import { resolveRecurringActor } from "../../_recurring/actor.ts";
import { RecurringMineScreen } from "../../_recurring/RecurringScreens.tsx";

/** My recurring duties: the family's, the water weeks it holds and its groups'. */
export default async function MyRecurringPage() {
  const actor = await resolveRecurringActor("szulo");
  if (!actor) return null;
  return <RecurringMineScreen actor={actor} />;
}
