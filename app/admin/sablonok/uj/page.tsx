import { resolveEventActor } from "../../../_events/actor.ts";
import { TemplateEditorScreen } from "../../../_checklists/TemplateScreens.tsx";

export default async function AdminNewTemplatePage() {
  const actor = await resolveEventActor("admin");
  if (!actor) return null;
  return <TemplateEditorScreen actor={actor} />;
}
