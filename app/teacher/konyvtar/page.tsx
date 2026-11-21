import { resolveLibraryActor } from "../../_library/actor.ts";
import { LibraryListScreen } from "../../_library/LibraryScreens.tsx";

export default async function TeacherLibraryPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ kereses?: string }> }>) {
  const { kereses } = await searchParams;
  const actor = await resolveLibraryActor("teacher");
  if (!actor) return null;
  return <LibraryListScreen actor={actor} search={(kereses ?? "").trim().slice(0, 100)} />;
}
