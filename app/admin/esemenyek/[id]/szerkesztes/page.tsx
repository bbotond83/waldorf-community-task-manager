import { notFound } from "next/navigation";
import { resolveEventActor } from "../../../../_events/actor.ts";
import { isEventId } from "../../../../_events/event-id.ts";
import { EventFormScreen } from "../../../../_events/EventScreens.tsx";

export default async function EditEventPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mentve?: string }>;
}>) {
  const { id } = await params;
  const { mentve } = await searchParams;
  if (!isEventId(id)) notFound();
  const actor = await resolveEventActor("admin");
  if (!actor) return null;
  return (
    <EventFormScreen
      actor={actor}
      eventId={id}
      saved={mentve === "uj" || mentve === "1" ? mentve : undefined}
    />
  );
}
