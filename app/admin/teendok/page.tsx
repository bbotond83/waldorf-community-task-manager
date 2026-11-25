import { resolveTodoActor } from "../../_todo/actor.ts";
import { parseTodoFilters, TodoListScreen } from "../../_todo/TodoScreens.tsx";

/** The community's to-do list in the admin area, with the way to add a task. */
export default async function AdminTodoPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const actor = await resolveTodoActor("admin");
  if (!actor) return null;
  return <TodoListScreen actor={actor} filters={parseTodoFilters(await searchParams)} />;
}
