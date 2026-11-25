import { notFound } from "next/navigation";
import { isEventId } from "../../../../_events/event-id.ts";
import { resolveTodoActor } from "../../../../_todo/actor.ts";
import { TodoPullScreen } from "../../../../_todo/TodoScreens.tsx";

/** "Teendők hozzáadása": the list of open to-do tasks to add to an event's checklist, for the event's coordinator. */
export default async function ParentEventTodoPullPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  if (!isEventId(id)) notFound();
  const actor = await resolveTodoActor("szulo");
  if (!actor) return null;
  return <TodoPullScreen actor={actor} eventId={id} />;
}
