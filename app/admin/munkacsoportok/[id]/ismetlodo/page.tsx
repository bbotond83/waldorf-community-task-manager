import { notFound } from "next/navigation";
import { resolveRecurringActor } from "../../../../_recurring/actor.ts";
import { isRecurringId } from "../../../../_recurring/recurring-form.ts";
import { RecurringGroupScreen } from "../../../../_recurring/RecurringScreens.tsx";

/** A working group's recurring duties for an administrator: a super admin keeps the schedules and can skip. */
export default async function AdminGroupRecurringPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  if (!isRecurringId(id)) notFound();
  const actor = await resolveRecurringActor("admin");
  if (!actor) return null;
  return <RecurringGroupScreen actor={actor} groupId={id} />;
}
