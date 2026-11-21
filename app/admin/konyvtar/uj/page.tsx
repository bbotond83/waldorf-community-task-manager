import { resolveLibraryActor } from "../../../_library/actor.ts";
import { LibraryFormScreen } from "../../../_library/LibraryScreens.tsx";

export default async function NewAdminLibraryBookPage() {
  const actor = await resolveLibraryActor("admin");
  if (!actor) return null;
  return <LibraryFormScreen actor={actor} />;
}
