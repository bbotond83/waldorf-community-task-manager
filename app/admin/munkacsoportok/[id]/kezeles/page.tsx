import { notFound } from "next/navigation";
import { isRecurringId } from "../../../../_recurring/recurring-form.ts";
import { resolveTodoActor } from "../../../../_todo/actor.ts";
import { parseManageTab, TodoManageScreen } from "../../../../_todo/TodoScreens.tsx";

/** The management page ("Kezelés") of a working group in the admin area; `?ful=` opens one of its four tabs. */
export default async function AdminGroupManagePage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ful?: string | string[] }>;
}>) {
  const { id } = await params;
  const { ful } = await searchParams;
  if (!isRecurringId(id)) notFound();
  const actor = await resolveTodoActor("admin");
  if (!actor) return null;
  return <TodoManageScreen actor={actor} groupId={id} tab={parseManageTab(ful)} />;
}
