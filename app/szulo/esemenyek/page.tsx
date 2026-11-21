import { resolveEventActor } from "../../_events/actor.ts";
import { EventListScreen } from "../../_events/EventScreens.tsx";

export default async function EventsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ korabbi?: string }> }>) {
  const { korabbi } = await searchParams;
  const actor = await resolveEventActor("szulo");
  if (!actor) return null;
  return <EventListScreen actor={actor} past={korabbi === "1"} />;
}
