import { randomUUID } from "node:crypto";
import { AdminMutationForm } from "../../_components/AdminMutationForm.tsx";
import { AsyncStatePanel } from "../../_components/AsyncStatePanel.tsx";
import { assignTaskAction, saveEventNotesAction, saveTaskAction } from "../../actions.ts";
import { resolveAdminFacade } from "../../_lib/facade.ts";
import { resolveAdminSession } from "../../_lib/session.ts";
import type { AdminItemModel, ApplicationResult } from "../../../../src/application/index.ts";
import { denied, terminalFailure } from "../../../../src/application/results.ts";
import { statusLabel } from "../../../../src/application/status-labels.ts";

export default async function TaskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const session = await resolveAdminSession();
  const facade = await resolveAdminFacade();
  let result: ApplicationResult<AdminItemModel> = terminalFailure();
  if (session.state === "success" && facade) {
    const list = await facade.listTasks(session.data.applicationSession, session.data.scope);
    if (list.state === "success" || list.state === "recovery") {
      const item = list.data.items.find((candidate) => candidate.id === id);
      result = item ? { ...list, data: item } : denied();
    } else {
      result = list;
    }
  }
  return (
    <section className="admin-page" data-testid="admin-task-detail-page">
      <header>
        <p className="eyebrow">Feladatok és események</p>
        <h1 tabIndex={-1}>Részletek és kapacitás</h1>
      </header>
      <AsyncStatePanel
        result={result}
        testId="admin-task-detail-state"
        emptyMessage="A feladat nem található."
      >
        {(task) => (
          <div className="admin-detail-grid">
            <section>
              <h2>{task.title}</h2>
              <p>Állapot: {statusLabel(task.state)}</p>
              <p>Verzió: {task.version}</p>
            </section>
            <AdminMutationForm
              action={saveTaskAction}
              submitLabel="Módosítás mentése"
              testId="admin-task-edit-form"
            >
              <input type="hidden" name="id" value={task.id} />
              <input type="hidden" name="expectedVersion" value={task.version ?? 1} />
              <input
                type="hidden"
                name="idempotencyKey"
                value={`task:save:${task.id}:${randomUUID()}`}
              />
              <input
                type="hidden"
                name="kind"
                value={task.state === "scheduled" ? "event" : "task"}
              />
              <label htmlFor="title">Megnevezés</label>
              <input
                id="title"
                name="title"
                defaultValue={task.title}
                required
                data-testid="admin-task-title-input"
              />
            </AdminMutationForm>
            <AdminMutationForm
              action={assignTaskAction}
              submitLabel="Hozzárendelés"
              testId="admin-assignment-form"
            >
              <input type="hidden" name="id" value={task.id} />
              <input type="hidden" name="expectedVersion" value={task.version ?? 1} />
              <input
                type="hidden"
                name="idempotencyKey"
                value={`assignment:${task.id}:${randomUUID()}`}
              />
              <label htmlFor="scenario">Kapacitási helyzet</label>
              <select
                id="scenario"
                name="scenario"
                defaultValue={typeof query.scenario === "string" ? query.scenario : "eligible"}
                data-testid="admin-assignment-scenario-select"
              >
                <option value="eligible">Jogosult, van hely</option>
                <option value="ineligible">Nem jogosult</option>
                <option value="full">Betelt kapacitás</option>
                <option value="retryable">Átmeneti szolgáltatáshiba</option>
                <option value="terminal">Végleges szolgáltatáshiba</option>
              </select>
            </AdminMutationForm>
            {task.state === "scheduled" && (
              <AdminMutationForm
                action={saveEventNotesAction}
                submitLabel="Megjegyzések mentése"
                testId="admin-event-notes-form"
              >
                <input type="hidden" name="id" value={task.id} />
                <input type="hidden" name="expectedVersion" value={task.version ?? 1} />
                <input
                  type="hidden"
                  name="idempotencyKey"
                  value={`event:notes:${task.id}:${randomUUID()}`}
                />
                <fieldset>
                  <legend>Engedélyezett eseménymegjegyzések</legend>
                  <label htmlFor="allergenNote">
                    Allergénnel kapcsolatos adminisztrátori megjegyzés
                  </label>
                  <textarea
                    id="allergenNote"
                    name="allergenNote"
                    maxLength={300}
                    data-testid="admin-event-allergen-note-input"
                  />
                  <label htmlFor="supplyNote">Eszközigény</label>
                  <textarea
                    id="supplyNote"
                    name="supplyNote"
                    maxLength={300}
                    data-testid="admin-event-supply-note-input"
                  />
                  <label htmlFor="foodNote">Ételhez kapcsolódó megjegyzés</label>
                  <textarea
                    id="foodNote"
                    name="foodNote"
                    maxLength={300}
                    data-testid="admin-event-food-note-input"
                  />
                </fieldset>
              </AdminMutationForm>
            )}
          </div>
        )}
      </AsyncStatePanel>
    </section>
  );
}
