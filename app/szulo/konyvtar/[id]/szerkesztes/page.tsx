import { notFound } from "next/navigation";
import { resolveLibraryActor } from "../../../../_library/actor.ts";
import { isLibraryId } from "../../../../_library/library-id.ts";
import { LibraryFormScreen } from "../../../../_library/LibraryScreens.tsx";

export default async function LibraryEditPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  if (!isLibraryId(id)) notFound();
  const actor = await resolveLibraryActor("szulo");
  if (!actor) return null;
  return <LibraryFormScreen actor={actor} bookId={id} />;
}
