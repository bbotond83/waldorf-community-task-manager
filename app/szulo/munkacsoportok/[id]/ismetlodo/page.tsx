import { notFound } from "next/navigation";
import { resolveRecurringActor } from "../../../../_recurring/actor.ts";
import { isRecurringId } from "../../../../_recurring/recurring-form.ts";
import { RecurringGroupScreen } from "../../../../_recurring/RecurringScreens.tsx";

/** A working group's recurring duties, for a parent (a coordinator who is a parent also keeps the schedules here). */
export default async function ParentGroupRecurringPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  if (!isRecurringId(id)) notFound();
  const actor = await resolveRecurringActor("szulo");
  if (!actor) return null;
  return <RecurringGroupScreen actor={actor} groupId={id} />;
}
