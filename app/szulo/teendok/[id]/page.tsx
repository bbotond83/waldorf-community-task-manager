import { notFound } from "next/navigation";
import { isRecurringId } from "../../../_recurring/recurring-form.ts";
import { resolveTodoActor } from "../../../_todo/actor.ts";
import { TodoDetailScreen } from "../../../_todo/TodoScreens.tsx";

/** One to-do task's page for a parent. An address that is not an identifier is never sent to the database. */
export default async function ParentTodoDetailPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  if (!isRecurringId(id)) notFound();
  const actor = await resolveTodoActor("szulo");
  if (!actor) return null;
  return <TodoDetailScreen actor={actor} taskId={id} />;
}
