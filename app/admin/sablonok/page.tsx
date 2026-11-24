import { resolveEventActor } from "../../_events/actor.ts";
import { TemplateListScreen } from "../../_checklists/TemplateScreens.tsx";

/** All checklist templates, for an administrator. */
export default async function AdminTemplatesPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ mentve?: string }> }>) {
  const { mentve } = await searchParams;
  const actor = await resolveEventActor("admin");
  if (!actor) return null;
  return <TemplateListScreen actor={actor} saved={mentve === "1"} />;
}
