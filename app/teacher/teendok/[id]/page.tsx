import { notFound } from "next/navigation";
import { isRecurringId } from "../../../_recurring/recurring-form.ts";
import { resolveTodoActor } from "../../../_todo/actor.ts";
import { TodoDetailScreen } from "../../../_todo/TodoScreens.tsx";

/** One to-do task's page for a teacher: read only. */
export default async function TeacherTodoDetailPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  if (!isRecurringId(id)) notFound();
  const actor = await resolveTodoActor("teacher");
  if (!actor) return null;
  return <TodoDetailScreen actor={actor} taskId={id} />;
}
