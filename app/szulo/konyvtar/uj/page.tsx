import { resolveLibraryActor } from "../../../_library/actor.ts";
import { LibraryFormScreen } from "../../../_library/LibraryScreens.tsx";

export default async function NewLibraryBookPage() {
  const actor = await resolveLibraryActor("szulo");
  if (!actor) return null;
  return <LibraryFormScreen actor={actor} />;
}
