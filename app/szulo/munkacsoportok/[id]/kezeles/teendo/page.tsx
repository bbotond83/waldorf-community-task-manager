import { notFound } from "next/navigation";
import { isRecurringId } from "../../../../../_recurring/recurring-form.ts";
import { resolveTodoActor } from "../../../../../_todo/actor.ts";
import { TodoFormScreen } from "../../../../../_todo/TodoScreens.tsx";

/** The form that adds a task to the group. */
export default async function ParentGroupNewTodoPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  if (!isRecurringId(id)) notFound();
  const actor = await resolveTodoActor("szulo");
  if (!actor) return null;
  return <TodoFormScreen actor={actor} groupId={id} />;
}
