import { notFound } from "next/navigation";
import { resolveEventActor } from "../../../_events/actor.ts";
import { EventDetailScreen } from "../../../_events/EventScreens.tsx";
import { isEventId } from "../../../_events/event-id.ts";

export default async function EventPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  if (!isEventId(id)) notFound();
  const actor = await resolveEventActor("szulo");
  if (!actor) return null;
  return <EventDetailScreen actor={actor} eventId={id} />;
}
