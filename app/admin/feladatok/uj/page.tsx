import { randomUUID } from "node:crypto";
import { AdminMutationForm } from "../../_components/AdminMutationForm.tsx";
import { saveTaskAction } from "../../actions.ts";

export default function NewTaskPage() {
  return (
    <section className="admin-page" data-testid="admin-task-create-page">
      <header>
        <p className="eyebrow">Feladatok és események</p>
        <h1 tabIndex={-1}>Új feladat vagy esemény</h1>
      </header>
      <AdminMutationForm
        action={saveTaskAction}
        submitLabel="Létrehozás"
        testId="admin-task-create-form"
      >
        <input type="hidden" name="id" value="new" />
        <input type="hidden" name="expectedVersion" value="1" />
        <input type="hidden" name="idempotencyKey" value={`task:create:${randomUUID()}`} />
        <label htmlFor="kind">Típus</label>
        <select id="kind" name="kind" data-testid="admin-task-kind-select">
          <option value="task">Feladat</option>
          <option value="event">Esemény</option>
        </select>
        <label htmlFor="title">Megnevezés</label>
        <input
          id="title"
          name="title"
          required
          maxLength={120}
          data-testid="admin-task-title-input"
        />
      </AdminMutationForm>
    </section>
  );
}
