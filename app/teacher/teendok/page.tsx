import { resolveTodoActor } from "../../_todo/actor.ts";
import { parseTodoFilters, TodoListScreen } from "../../_todo/TodoScreens.tsx";

/** The community's to-do list for a teacher: read only, no buttons. */
export default async function TeacherTodoPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const actor = await resolveTodoActor("teacher");
  if (!actor) return null;
  return <TodoListScreen actor={actor} filters={parseTodoFilters(await searchParams)} />;
}
