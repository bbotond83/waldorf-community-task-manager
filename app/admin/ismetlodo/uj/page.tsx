import { resolveRecurringActor } from "../../../_recurring/actor.ts";
import { isRecurringId } from "../../../_recurring/recurring-form.ts";
import { RecurringFormScreen } from "../../../_recurring/RecurringScreens.tsx";

/** The form for a new recurring duty of the group named in the address, for an administrator. */
export default async function AdminNewRecurringPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ csoport?: string }> }>) {
  const { csoport } = await searchParams;
  const actor = await resolveRecurringActor("admin");
  if (!actor) return null;
  return (
    <RecurringFormScreen actor={actor} groupId={isRecurringId(csoport) ? csoport : undefined} />
  );
}
