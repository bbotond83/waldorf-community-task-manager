import { notFound } from "next/navigation";
import { resolveRecurringActor } from "../../../../_recurring/actor.ts";
import { isRecurringId } from "../../../../_recurring/recurring-form.ts";
import { RecurringFormScreen } from "../../../../_recurring/RecurringScreens.tsx";

/** The form that changes one group schedule, for an administrator. */
export default async function AdminEditRecurringPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  if (!isRecurringId(id)) notFound();
  const actor = await resolveRecurringActor("admin");
  if (!actor) return null;
  return <RecurringFormScreen actor={actor} scheduleId={id} />;
}
