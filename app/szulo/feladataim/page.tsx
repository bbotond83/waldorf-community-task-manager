import { resolveTodoActor } from "../../_todo/actor.ts";
import { MyTasksScreen } from "../../_todo/TodoScreens.tsx";

/** My tasks: the family's duties, recurring duties and the to-do tasks the parent claimed. */
export default async function MyTasksPage() {
  const actor = await resolveTodoActor("szulo");
  if (!actor) return null;
  return <MyTasksScreen actor={actor} />;
}
