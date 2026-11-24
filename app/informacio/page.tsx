import { resolveInfoActor } from "../_info/actor.ts";
import { InformationScreen } from "../_info/InformationScreens.tsx";

export default async function InformationPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ szerkesztes?: string }> }>) {
  const { szerkesztes } = await searchParams;
  const actor = await resolveInfoActor();
  if (!actor) return null;
  return <InformationScreen actor={actor} editKey={szerkesztes} />;
}
