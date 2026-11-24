import { AnimalCareScreen } from "../../_animal/AnimalScreens.tsx";
import { ParentAccessState } from "../_components/ParentAccessState.tsx";
import { resolveParentSession } from "../_lib/session.ts";

export default async function AnimalCarePage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ uzenet?: string }> }>) {
  const { uzenet } = await searchParams;
  const session = await resolveParentSession();
  if (session.state !== "success") return <ParentAccessState kind="denied" />;
  const notice = uzenet === "jelentkezes" || uzenet === "lemondas" ? uzenet : undefined;
  return (
    <AnimalCareScreen
      session={session.data.applicationSession}
      scope={session.data.familyScope}
      notice={notice}
    />
  );
}
