import { notFound } from "next/navigation";
import { resolveEventActor } from "../../../../_events/actor.ts";
import { isChecklistId } from "../../../../_checklists/checklist-form.ts";
import { TemplateListScreen } from "../../../../_checklists/TemplateScreens.tsx";

/** A working group's templates: a coordinator keeps their own group's, a super admin any. */
export default async function GroupTemplatesPage({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ id: string }>; searchParams: Promise<{ mentve?: string }> }>) {
  const { id } = await params;
  const { mentve } = await searchParams;
  if (!isChecklistId(id)) notFound();
  const actor = await resolveEventActor("admin");
  if (!actor) return null;
  return <TemplateListScreen actor={actor} groupId={id} saved={mentve === "1"} />;
}
