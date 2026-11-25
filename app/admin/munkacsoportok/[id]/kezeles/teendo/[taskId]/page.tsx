import { notFound } from "next/navigation";
import { isRecurringId } from "../../../../../../_recurring/recurring-form.ts";
import { resolveTodoActor } from "../../../../../../_todo/actor.ts";
import { TodoFormScreen } from "../../../../../../_todo/TodoScreens.tsx";

/** The form that changes one of the group's tasks, in the admin area. */
export default async function AdminGroupEditTodoPage({
  params,
}: Readonly<{ params: Promise<{ id: string; taskId: string }> }>) {
  const { id, taskId } = await params;
  if (!isRecurringId(id) || !isRecurringId(taskId)) notFound();
  const actor = await resolveTodoActor("admin");
  if (!actor) return null;
  return <TodoFormScreen actor={actor} groupId={id} taskId={taskId} />;
}
