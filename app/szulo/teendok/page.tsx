import { resolveTodoActor } from "../../_todo/actor.ts";
import { parseTodoFilters, TodoListScreen } from "../../_todo/TodoScreens.tsx";

/** The community's to-do list, for a parent (also a coordinator or a super admin who is a parent). */
export default async function ParentTodoPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const actor = await resolveTodoActor("szulo");
  if (!actor) return null;
  return <TodoListScreen actor={actor} filters={parseTodoFilters(await searchParams)} />;
}
