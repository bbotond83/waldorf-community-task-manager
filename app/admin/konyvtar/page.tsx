import { resolveLibraryActor } from "../../_library/actor.ts";
import { LibraryListScreen } from "../../_library/LibraryScreens.tsx";

export default async function AdminLibraryPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ kereses?: string }> }>) {
  const { kereses } = await searchParams;
  const actor = await resolveLibraryActor("admin");
  if (!actor) return null;
  return <LibraryListScreen actor={actor} search={(kereses ?? "").trim().slice(0, 100)} />;
}
