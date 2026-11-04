import { randomUUID } from "node:crypto";
import type { AdminItemModel, ApplicationResult } from "../../../../src/application/index.ts";
import { AdminBackLink } from "../../_components/AdminBackLink.tsx";
import { AdminMutationForm } from "../../_components/AdminMutationForm.tsx";
import { AsyncStatePanel } from "../../_components/AsyncStatePanel.tsx";
import { decideApprovalAction } from "../../actions.ts";
import { resolveAdminFacade } from "../../_lib/facade.ts";
import { resolveAdminSession } from "../../_lib/session.ts";
import { denied, terminalFailure } from "../../../../src/application/results.ts";
import { statusDisplay } from "../../../../src/application/status-labels.ts";
import { StatusBadge } from "../../../../src/runtime/StatusBadge.tsx";

export default async function ApprovalDetailPage({
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
    const list = await facade.listApprovals(session.data.applicationSession, session.data.scope);
    if (list.state === "success" || list.state === "recovery") {
      const approval = list.data.items.find((item) => item.id === id);
      result = approval ? { ...list, data: approval } : denied();
    } else {
      result = list;
    }
  }
  return (
    <section className="admin-page admin-approvals-page" data-testid="admin-approval-detail-page">
      <header>
        <AdminBackLink
          list="approvals"
          returnQuery={typeof query.vissza === "string" ? query.vissza : undefined}
        />
        <p className="eyebrow">Jóváhagyások</p>
        <h1 tabIndex={-1}>Kérelem elbírálása</h1>
      </header>
      <AsyncStatePanel
        result={result}
        testId="admin-approval-detail-state"
        emptyMessage="A kérelem nem található."
      >
        {(approval) => (
          <div className="admin-detail-grid">
            <section>
              <h2>{approval.title}</h2>
              <p>
                Állapot: <StatusBadge {...statusDisplay(approval.state)} />
              </p>
              <p className="admin-safe-reason">
                A kérelem részletei a jóváhagyási típus engedélyezett, személyes adatot nem
                tartalmazó összefoglalója.
              </p>
            </section>
            <AdminMutationForm
              action={decideApprovalAction}
              submitLabel="Döntés rögzítése"
              testId="admin-approval-decision-form"
            >
              <input type="hidden" name="id" value={approval.id} />
              <input type="hidden" name="expectedVersion" value={approval.version ?? 1} />
              <input
                type="hidden"
                name="idempotencyKey"
                value={`approval:decide:${approval.id}:${randomUUID()}`}
              />
              <fieldset>
                <legend>Döntés</legend>
                <label>
                  <input
                    type="radio"
                    name="decision"
                    value="approved"
                    defaultChecked
                    data-testid="admin-approval-approve-radio"
                  />{" "}
                  Jóváhagyás
                </label>
                <label>
                  <input
                    type="radio"
                    name="decision"
                    value="rejected"
                    data-testid="admin-approval-reject-radio"
                  />{" "}
                  Elutasítás
                </label>
              </fieldset>
              <p className="form-hint">
                Átmeneti hiba esetén ugyanaz a műveleti kulcs használható újra; minden más eredmény
                végleges.
              </p>
            </AdminMutationForm>
          </div>
        )}
      </AsyncStatePanel>
    </section>
  );
}
