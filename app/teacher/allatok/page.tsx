import { AnimalCareScreen } from "../../_animal/AnimalScreens.tsx";
import { TeacherAccessState } from "../_components/TeacherAccessState.tsx";
import { resolveTeacherSession } from "../_lib/session.ts";

/** The teacher reads who looks after the animals each day; the sign-up controls stay on the parent page. */
export default async function TeacherAnimalCarePage() {
  const session = await resolveTeacherSession();
  if (session.state !== "success") return <TeacherAccessState kind="denied" />;
  return (
    <AnimalCareScreen
      session={session.data.applicationSession}
      scope={session.data.scope}
      notice={undefined}
      readOnly
    />
  );
}
