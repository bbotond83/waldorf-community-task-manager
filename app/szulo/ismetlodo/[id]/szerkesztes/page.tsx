import { notFound } from "next/navigation";
import { resolveRecurringActor } from "../../../../_recurring/actor.ts";
import { isRecurringId } from "../../../../_recurring/recurring-form.ts";
import { RecurringFormScreen } from "../../../../_recurring/RecurringScreens.tsx";

/** The form that changes one schedule; only a person who may manage its group reaches the form. */
export default async function EditRecurringPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  if (!isRecurringId(id)) notFound();
  const actor = await resolveRecurringActor("szulo");
  if (!actor) return null;
  return <RecurringFormScreen actor={actor} scheduleId={id} />;
}
