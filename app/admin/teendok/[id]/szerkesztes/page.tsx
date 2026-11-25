import { notFound } from "next/navigation";
import { isRecurringId } from "../../../../_recurring/recurring-form.ts";
import { resolveTodoActor } from "../../../../_todo/actor.ts";
import { TodoFormScreen } from "../../../../_todo/TodoScreens.tsx";

/** The form that changes a task (its id in the address). Only a person who manages the task's owner sees the form. */
export default async function AdminEditTodoPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  if (!isRecurringId(id)) notFound();
  const actor = await resolveTodoActor("admin");
  if (!actor) return null;
  return <TodoFormScreen actor={actor} taskId={id} />;
}
