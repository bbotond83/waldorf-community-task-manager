import { notFound } from "next/navigation";
import { resolveEventActor } from "../../../../../_events/actor.ts";
import { isChecklistId } from "../../../../../_checklists/checklist-form.ts";
import { TemplateEditorScreen } from "../../../../../_checklists/TemplateScreens.tsx";

export default async function GroupTemplatePage({
  params,
}: Readonly<{ params: Promise<{ id: string; templateId: string }> }>) {
  const { id, templateId } = await params;
  if (!isChecklistId(id) || !isChecklistId(templateId)) notFound();
  const actor = await resolveEventActor("szulo");
  if (!actor) return null;
  return <TemplateEditorScreen actor={actor} groupId={id} templateId={templateId} />;
}
