import { resolveEventActor } from "../../../_events/actor.ts";
import { isEventId } from "../../../_events/event-id.ts";
import { EventFormScreen } from "../../../_events/EventScreens.tsx";

export default async function NewEventPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ csoport?: string }> }>) {
  const { csoport } = await searchParams;
  const actor = await resolveEventActor("szulo");
  if (!actor) return null;
  return <EventFormScreen actor={actor} presetGroupId={isEventId(csoport) ? csoport : undefined} />;
}
