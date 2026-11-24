import { notFound } from "next/navigation";
import { resolveEventActor } from "../../../_events/actor.ts";
import { isChecklistId } from "../../../_checklists/checklist-form.ts";
import { TemplateEditorScreen } from "../../../_checklists/TemplateScreens.tsx";

export default async function AdminTemplatePage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  if (!isChecklistId(id)) notFound();
  const actor = await resolveEventActor("admin");
  if (!actor) return null;
  return <TemplateEditorScreen actor={actor} templateId={id} />;
}
