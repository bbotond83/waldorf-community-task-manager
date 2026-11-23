import { notFound } from "next/navigation";
import { resolveRecurringActor } from "../../../../_recurring/actor.ts";
import { isRecurringId } from "../../../../_recurring/recurring-form.ts";
import { RecurringGroupScreen } from "../../../../_recurring/RecurringScreens.tsx";

/** A working group's recurring duties for a teacher: the list only, with no button. */
export default async function TeacherGroupRecurringPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  if (!isRecurringId(id)) notFound();
  const actor = await resolveRecurringActor("teacher");
  if (!actor) return null;
  return <RecurringGroupScreen actor={actor} groupId={id} />;
}
