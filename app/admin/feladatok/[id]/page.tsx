import { randomUUID } from "node:crypto";
import { AdminBackLink } from "../../_components/AdminBackLink.tsx";
import {
  AdminMutationForm,
  AdminSelectField,
  AdminTextareaField,
  AdminTextField,
} from "../../_components/AdminMutationForm.tsx";
import { TaskFields } from "../../_components/TaskFields.tsx";
import { resolveAdminLookups } from "../../_lib/request-lookups.ts";
import { AsyncStatePanel } from "../../_components/AsyncStatePanel.tsx";
import { DeveloperDetails } from "../../_components/DeveloperDetails.tsx";
import { assignTaskAction, saveEventNotesAction, saveTaskAction } from "../../actions.ts";
import { resolveAdminFacade } from "../../_lib/facade.ts";
import { resolveAdminSession } from "../../_lib/session.ts";
import type { AdminItemModel, ApplicationResult } from "../../../../src/application/index.ts";
import { denied, terminalFailure } from "../../../../src/application/results.ts";
import { statusDisplay } from "../../../../src/application/status-labels.ts";
import { StatusBadge } from "../../../../src/runtime/StatusBadge.tsx";

/** The real-data form is used when the data source says what the item is; the synthetic one never does. */
function isTaskKind(kind: AdminItemModel["kind"]): kind is "task" | "event" {
  return kind === "task" || kind === "event";
}

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
  const lookups = await resolveAdminLookups();
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
        <AdminBackLink
          list="tasks"
          returnQuery={typeof query.vissza === "string" ? query.vissza : undefined}
        />
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
              <p>
                Állapot: <StatusBadge {...statusDisplay(task.state)} />
              </p>
            </section>
            <AdminMutationForm
              action={saveTaskAction}
              submitLabel="Módosítás mentése"
              testId="admin-task-edit-form"
              longForm={isTaskKind(task.kind)}
            >
              <input type="hidden" name="id" value={task.id} />
              <input type="hidden" name="expectedVersion" value={task.version ?? 1} />
              <input
                type="hidden"
                name="idempotencyKey"
                value={`task:save:${task.id}:${randomUUID()}`}
              />
              {isTaskKind(task.kind) ? (
                <TaskFields
                  mode="edit"
                  kind={task.kind}
                  title={task.title}
                  state={task.state}
                  details={task.details}
                  lookups={lookups}
                />
              ) : (
                <>
                  <input
                    type="hidden"
                    name="kind"
                    value={task.state === "scheduled" ? "event" : "task"}
                  />
                  <AdminTextField
                    id="title"
                    name="title"
                    label="Megnevezés"
                    defaultValue={task.title}
                    required
                    testId="admin-task-title-input"
                  />
                </>
              )}
            </AdminMutationForm>
            {task.kind !== "event" && (
              <AdminMutationForm
                action={assignTaskAction}
                submitLabel="Hozzárendelés"
                testId="admin-assignment-form"
                longForm={task.kind === "task"}
              >
                <input type="hidden" name="id" value={task.id} />
                <input type="hidden" name="expectedVersion" value={task.version ?? 1} />
                <input
                  type="hidden"
                  name="idempotencyKey"
                  value={`assignment:${task.id}:${randomUUID()}`}
                />
                {task.kind === "task" && (
                  <>
                    <input type="hidden" name="familySelector" value="1" />
                    <AdminSelectField
                      id="familyId"
                      name="familyId"
                      label="Család"
                      options={lookups.families}
                      placeholder="Válasszon családot"
                      required
                      hint="A család csak akkor kaphatja meg a feladatot, ha tagja a feladat csoportjának, és van szabad hely."
                      testId="admin-assignment-family-select"
                    />
                  </>
                )}
              </AdminMutationForm>
            )}
            {task.state === "scheduled" && (
              <AdminMutationForm
                action={saveEventNotesAction}
                submitLabel="Megjegyzések mentése"
                testId="admin-event-notes-form"
                longForm={task.kind === "event"}
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
                  <AdminTextareaField
                    id="allergenNote"
                    name="allergenNote"
                    label="Allergénnel kapcsolatos adminisztrátori megjegyzés"
                    defaultValue={task.details?.allergenNote}
                    maxLength={300}
                    testId="admin-event-allergen-note-input"
                  />
                  <AdminTextareaField
                    id="supplyNote"
                    name="supplyNote"
                    label="Eszközigény"
                    defaultValue={task.details?.supplyNote}
                    maxLength={300}
                    testId="admin-event-supply-note-input"
                  />
                  <AdminTextareaField
                    id="foodNote"
                    name="foodNote"
                    label="Ételhez kapcsolódó megjegyzés"
                    defaultValue={task.details?.foodNote}
                    maxLength={300}
                    testId="admin-event-food-note-input"
                  />
                </fieldset>
              </AdminMutationForm>
            )}
            <DeveloperDetails>
              <p>Verzió: {task.version}</p>
              <label htmlFor="scenario">Kapacitási helyzet</label>
              <select
                id="scenario"
                name="scenario"
                form="admin-assignment-form"
                defaultValue={typeof query.scenario === "string" ? query.scenario : "eligible"}
                data-testid="admin-assignment-scenario-select"
              >
                <option value="eligible">Jogosult, van hely</option>
                <option value="ineligible">Nem jogosult</option>
                <option value="full">Betelt kapacitás</option>
                <option value="retryable">Átmeneti szolgáltatáshiba</option>
                <option value="terminal">Végleges szolgáltatáshiba</option>
              </select>
            </DeveloperDetails>
          </div>
        )}
      </AsyncStatePanel>
    </section>
  );
}
