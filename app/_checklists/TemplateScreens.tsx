import type { TemplateListModel } from "../../src/application/index.ts";
import { terminalFailure } from "../../src/application/results.ts";
import { STATUS_ICON_CHARACTERS, type StatusSymbol } from "../../src/application/status-labels.ts";
import { StatusBadge } from "../../src/runtime/StatusBadge.tsx";
import type { EventActor } from "../_events/actor.ts";
import { ParentStatePanel } from "../szulo/_components/ParentStatePanel.tsx";
import { TemplateEditorForm, TemplateRemovedForm } from "./ChecklistForms.tsx";
import { resolveChecklistFacade } from "./facade.ts";

const symbol = (icon: keyof typeof STATUS_ICON_CHARACTERS): StatusSymbol => ({
  icon,
  character: STATUS_ICON_CHARACTERS[icon],
});

/** Where the templates of an area live: the administrator's page, or a working group's page. */
export const templatesPath = (area: "szulo" | "admin" | "teacher", groupId?: string): string =>
  groupId ? `/${area}/munkacsoportok/${groupId}/sablonok` : `/${area}/sablonok`;

function TemplateRow({
  item,
  actor,
  groupId,
  manage,
  base,
}: Readonly<{
  item: TemplateListModel["items"][number];
  actor: EventActor;
  groupId?: string | undefined;
  manage: boolean;
  base: string;
}>) {
  const removed = item.status === "removed";
  return (
    <li
      className={`checklist-template${removed ? " checklist-template-removed" : ""}`}
      data-testid={`template-row-${item.id}`}
    >
      <div className="checklist-template-head">
        <h3 className="checklist-template-name">{item.name}</h3>
        <StatusBadge
          className="checklist-status"
          label={removed ? "Törölve" : "Aktív"}
          symbol={symbol(removed ? "cross" : "check")}
          testId={`template-status-${item.id}`}
        />
      </div>
      <p className="checklist-meta">
        {item.taskCount} feladat • {item.groupName ?? "Közösség"}
      </p>
      {manage && (
        <div className="checklist-actions">
          {!removed && (
            <a
              href={`${base}/${item.id}`}
              aria-label={`Szerkesztés: ${item.name}`}
              data-testid={`template-edit-${item.id}`}
            >
              Szerkesztés
            </a>
          )}
          <TemplateRemovedForm
            area={actor.area}
            groupId={groupId}
            template={item}
            removed={!removed}
          />
        </div>
      )}
    </li>
  );
}

/**
 * The templates an administrator keeps (all of them) or a coordinator keeps for their group. A person who may not manage
 * a template sees no buttons; a refused or failed read shows its own state, never an empty list.
 */
export async function TemplateListScreen({
  actor,
  groupId,
  saved,
}: Readonly<{ actor: EventActor; groupId?: string | undefined; saved?: boolean }>) {
  const checklists = await resolveChecklistFacade();
  const result = checklists
    ? groupId
      ? await checklists.templatesForGroup(actor.session, actor.scope, groupId)
      : await checklists.templates(actor.session, actor.scope)
    : terminalFailure();
  const base = templatesPath(actor.area, groupId);
  const backHref = groupId ? `/${actor.area}/munkacsoportok/${groupId}` : `/${actor.area}`;
  return (
    <section className="parent-page checklist-page" data-testid="template-list-page">
      <a href={backHref} className="parent-back-link" data-testid="template-back-link">
        {groupId ? "Vissza a munkacsoporthoz" : "Vissza az áttekintéshez"}
      </a>
      <header className="parent-detail-header">
        <p className="eyebrow">{groupId ? "Munkacsoport kezelés" : "Események és feladatok"}</p>
        <h1 tabIndex={-1}>Sablonok</h1>
        <p className="checklist-meta">
          A sablonból új esemény feladatlistája indítható. Segítségükkel az ismétlődő közösségi
          alkalmak előkészítése gördülékeny marad.
        </p>
      </header>
      {saved && (
        <p
          className="parent-action-state parent-action-state-success"
          role="status"
          data-testid="template-saved"
        >
          <strong>A sablont létrehoztuk.</strong>
        </p>
      )}
      <ParentStatePanel
        result={result}
        emptyMessage="A sablonok nem érhetők el."
        testId="template-list"
      >
        {(list) => {
          // A group list is read only by a person who may manage the group, so a list that was answered is a managed one.
          const manage = groupId ? true : list.canManageCommunity;
          const items = groupId
            ? list.items.filter((item) => item.workingGroupId === groupId)
            : list.items;
          return (
            <>
              {manage && (
                <p className="recurring-new">
                  <a className="button-link" href={`${base}/uj`} data-testid="template-new-link">
                    Új sablon
                  </a>
                </p>
              )}
              {items.length === 0 ? (
                <p className="parent-event-empty" role="status" data-testid="template-empty">
                  Még nincs sablon.
                </p>
              ) : (
                <ul className="checklist-templates" aria-label="Sablonok">
                  {items.map((item) => (
                    <TemplateRow
                      key={item.id}
                      item={item}
                      actor={actor}
                      groupId={groupId}
                      manage={manage}
                      base={base}
                    />
                  ))}
                </ul>
              )}
            </>
          );
        }}
      </ParentStatePanel>
    </section>
  );
}

/** The editor of one template, or of a new one (no `templateId`). A group page's editor adds the template to that group. */
export async function TemplateEditorScreen({
  actor,
  groupId,
  templateId,
}: Readonly<{ actor: EventActor; groupId?: string | undefined; templateId?: string }>) {
  const checklists = await resolveChecklistFacade();
  const result = templateId
    ? checklists
      ? await checklists.template(actor.session, actor.scope, templateId)
      : terminalFailure()
    : undefined;
  const base = templatesPath(actor.area, groupId);
  return (
    <section className="parent-page checklist-page" data-testid="template-editor-page">
      <a href={base} className="parent-back-link" data-testid="template-editor-back-link">
        Vissza a sablonokhoz
      </a>
      <header className="parent-detail-header">
        <p className="eyebrow">Események és feladatsablonok</p>
        <h1 tabIndex={-1}>{templateId ? "Sablon szerkesztése" : "Új sablon"}</h1>
        <p className="checklist-meta">
          Ismétlődő közösségi alkalmak feladatstruktúrájának és felelősségi köreinek megtervezése.{" "}
          {templateId && (
            <a href={`${base}/${templateId}`} data-testid="template-reload-link">
              Oldal újratöltése
            </a>
          )}
        </p>
      </header>
      {result === undefined ? (
        <TemplateEditorForm area={actor.area} groupId={groupId} backHref={base} />
      ) : (
        <ParentStatePanel
          result={result}
          emptyMessage="A sablon nem érhető el."
          testId="template-editor"
        >
          {(template) => (
            <TemplateEditorForm
              area={actor.area}
              groupId={template.workingGroupId ?? groupId}
              template={template}
              backHref={base}
            />
          )}
        </ParentStatePanel>
      )}
    </section>
  );
}
