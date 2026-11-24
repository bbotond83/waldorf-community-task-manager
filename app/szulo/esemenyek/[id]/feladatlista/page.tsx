import { notFound } from "next/navigation";
import { resolveEventActor } from "../../../../_events/actor.ts";
import { isEventId } from "../../../../_events/event-id.ts";
import { ChecklistEditorScreen } from "../../../../_checklists/ChecklistScreens.tsx";

/** The editor of an event's checklist, for the organising team (a coordinator who is a parent keeps it here). */
export default async function ChecklistEditorPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  if (!isEventId(id)) notFound();
  const actor = await resolveEventActor("szulo");
  if (!actor) return null;
  return <ChecklistEditorScreen actor={actor} eventId={id} />;
}
