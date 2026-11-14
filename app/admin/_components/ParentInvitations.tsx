import { randomUUID } from "node:crypto";
import Link from "next/link";
import type { AdminParentDetail } from "../../../src/application/index.ts";
import {
  STATUS_ICON_CHARACTERS,
  type StatusIconKey,
} from "../../../src/application/status-labels.ts";
import { StatusBadge } from "../../../src/runtime/StatusBadge.tsx";
import { sendInvitationAction } from "../parent-actions.ts";
import { AdminMutationForm } from "./AdminMutationForm.tsx";

/** The word and icon of each invitation state: never colour alone. */
function accountState(parent: AdminParentDetail): { label: string; icon: StatusIconKey } {
  if (parent.linked) return { label: "Fiókja van", icon: "check" };
  if (parent.invitation === "pending") return { label: "Meghívó elküldve", icon: "clock" };
  if (parent.invitation === "expired") return { label: "A meghívó lejárt", icon: "warning" };
  return { label: "Még nincs meghívó", icon: "ring" };
}

/**
 * The parents of a family with their sign-in state and the two things a super admin does with each: the invitation
 * and the removal (US3.6, US3.7). A parent with an account gets no invitation; the removal page explains what it does.
 */
export function ParentInvitations({
  familyId,
  parents,
}: Readonly<{ familyId: string; parents: readonly AdminParentDetail[] }>) {
  return (
    <section
      className="admin-parents-panel"
      aria-labelledby="admin-parents-heading"
      data-testid="admin-parents-panel"
    >
      <h2 id="admin-parents-heading">Szülők és meghívók</h2>
      <ul className="admin-parents-list">
        {parents.map((parent) => {
          const state = accountState(parent);
          return (
            <li
              key={parent.id}
              className="admin-parents-item"
              data-testid={`admin-parent-row-${parent.id}`}
            >
              <div>
                <h3>{parent.displayName}</h3>
                {parent.email && <p>{parent.email}</p>}
                <StatusBadge
                  label={state.label}
                  symbol={{ icon: state.icon, character: STATUS_ICON_CHARACTERS[state.icon] }}
                  testId={`admin-parent-state-${parent.id}`}
                />
              </div>
              <div className="admin-parents-actions">
                {!parent.linked && (
                  <AdminMutationForm
                    action={sendInvitationAction}
                    submitLabel={parent.invitation === "none" ? "Meghívó küldése" : "Új meghívó"}
                    testId={`admin-parent-invite-${parent.id}`}
                    longForm
                  >
                    <input type="hidden" name="parentId" value={parent.id} />
                    <input type="hidden" name="familyId" value={familyId} />
                    <input
                      type="hidden"
                      name="idempotencyKey"
                      value={`invite:${parent.id.slice(0, 8)}:${randomUUID()}`}
                    />
                  </AdminMutationForm>
                )}
                <Link
                  className="button-link button-link-secondary"
                  href={`/admin/nyilvantartasok/${familyId}/szulo/${parent.id}/eltavolitas`}
                  data-testid={`admin-parent-remove-link-${parent.id}`}
                >
                  Eltávolítás
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
