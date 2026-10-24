import { randomUUID } from "node:crypto";
import { isProductionMode } from "../../../_identity/production-request.ts";
import { AdminBackLink, ADMIN_LIST_LINKS } from "../../_components/AdminBackLink.tsx";
import { AdminMutationForm, AdminTextField } from "../../_components/AdminMutationForm.tsx";
import { TaskFields } from "../../_components/TaskFields.tsx";
import { resolveAdminLookups } from "../../_lib/request-lookups.ts";
import { saveTaskAction } from "../../actions.ts";

export default async function NewTaskPage() {
  const production = await isProductionMode();
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
        longForm={production}
        clearOnSuccess
      >
        <input type="hidden" name="id" value="new" />
        <input type="hidden" name="expectedVersion" value="1" />
        <input type="hidden" name="idempotencyKey" value={`task:create:${randomUUID()}`} />
        {production ? (
          <TaskFields mode="create" lookups={lookups} />
        ) : (
          <>
            <label htmlFor="kind">Típus</label>
            <select id="kind" name="kind" data-testid="admin-task-kind-select">
              <option value="task">Feladat</option>
              <option value="event">Esemény</option>
            </select>
            <AdminTextField
              id="title"
              name="title"
              label="Megnevezés"
              required
              maxLength={120}
              testId="admin-task-title-input"
            />
          </>
        )}
      </AdminMutationForm>
    </section>
  );
}
