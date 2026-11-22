import { resolveRecurringActor } from "../../../_recurring/actor.ts";
import { isRecurringId } from "../../../_recurring/recurring-form.ts";
import { RecurringFormScreen } from "../../../_recurring/RecurringScreens.tsx";

/** The form for a new recurring duty of the group named in the address (`?csoport=`). */
export default async function NewRecurringPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ csoport?: string }> }>) {
  const { csoport } = await searchParams;
  const actor = await resolveRecurringActor("szulo");
  if (!actor) return null;
  return (
    <RecurringFormScreen actor={actor} groupId={isRecurringId(csoport) ? csoport : undefined} />
  );
}
