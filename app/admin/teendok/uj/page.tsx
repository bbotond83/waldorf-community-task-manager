import { isRecurringId } from "../../../_recurring/recurring-form.ts";
import { resolveTodoActor } from "../../../_todo/actor.ts";
import { TodoFormScreen } from "../../../_todo/TodoScreens.tsx";
import { resolveWorkingGroupFacade } from "../../../teacher/_lib/facade.ts";

/** The form that adds a task. With a group in the address (`?csoport=`) the group is fixed; otherwise the super admin chooses one. */
export default async function AdminNewTodoPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const actor = await resolveTodoActor("admin");
  if (!actor) return null;
  const { csoport } = await searchParams;
  const groupId = typeof csoport === "string" && isRecurringId(csoport) ? csoport : undefined;
  let groups: readonly { id: string; name: string }[] = [];
  if (!groupId) {
    const facade = await resolveWorkingGroupFacade();
    const found = facade ? await facade.list(actor.session, actor.scope) : undefined;
    if (found && (found.state === "success" || found.state === "recovery")) {
      groups = found.data.items.map((group) => ({ id: group.id, name: group.name }));
    }
  }
  return <TodoFormScreen actor={actor} groupId={groupId} groups={groups} />;
}
