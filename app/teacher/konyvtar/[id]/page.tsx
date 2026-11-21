import { notFound } from "next/navigation";
import { resolveLibraryActor } from "../../../_library/actor.ts";
import { isLibraryId } from "../../../_library/library-id.ts";
import { LibraryBookScreen } from "../../../_library/LibraryScreens.tsx";

export default async function TeacherLibraryBookPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  if (!isLibraryId(id)) notFound();
  const actor = await resolveLibraryActor("teacher");
  if (!actor) return null;
  return <LibraryBookScreen actor={actor} bookId={id} />;
}
