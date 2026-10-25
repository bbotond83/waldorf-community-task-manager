import { randomUUID } from "node:crypto";
import { AdminBackLink, ADMIN_LIST_LINKS } from "../../_components/AdminBackLink.tsx";
import { AdminMutationForm } from "../../_components/AdminMutationForm.tsx";
import { TaskFields } from "../../_components/TaskFields.tsx";
import { resolveAdminLookups } from "../../_lib/request-lookups.ts";
import { saveTaskAction } from "../../actions.ts";

export default async function NewTaskPage() {
  const lookups = await resolveAdminLookups();
  return (
    <section className="admin-page" data-testid="admin-task-create-page">
      <header>
        <AdminBackLink list="tasks" />
        <p className="eyebrow">Feladatok és események</p>
        <h1 tabIndex={-1}>Új feladat vagy esemény</h1>
      </header>
      <AdminMutationForm
        action={saveTaskAction}
        submitLabel="Létrehozás"
        testId="admin-task-create-form"
        successLink={ADMIN_LIST_LINKS.tasks}
        longForm
        clearOnSuccess
      >
        <input type="hidden" name="id" value="new" />
        <input type="hidden" name="expectedVersion" value="1" />
        <input type="hidden" name="idempotencyKey" value={`task:create:${randomUUID()}`} />
        <TaskFields mode="create" lookups={lookups} />
      </AdminMutationForm>
    </section>
  );
}
