import { notFound } from "next/navigation";
import { isEventId } from "../../../../_events/event-id.ts";
import { resolveTodoActor } from "../../../../_todo/actor.ts";
import { TodoPullScreen } from "../../../../_todo/TodoScreens.tsx";

/** "Teendők hozzáadása" in the admin area. */
export default async function AdminEventTodoPullPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  if (!isEventId(id)) notFound();
  const actor = await resolveTodoActor("admin");
  if (!actor) return null;
  return <TodoPullScreen actor={actor} eventId={id} />;
}
