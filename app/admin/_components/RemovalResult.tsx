import Link from "next/link";
import type {
  ApplicationResult,
  CoordinatorGroupModel,
  FlaggedItemListModel,
  RemovalSubjectModel,
} from "../../../src/application/index.ts";
import { formatShortDay } from "../../../src/application/rota-format.ts";
import { REMOVAL_FLAGGED_KIND_LABELS, REMOVAL_TEXTS } from "../../../src/data/copy.ts";
import { AsyncStatePanel } from "./AsyncStatePanel.tsx";

/** What the address of a result page may carry: flags and group ids, never a name (see `app/admin/_lib/removal.ts`). */
export type RemovalResultQuery = Readonly<Record<string, string | string[] | undefined>>;

const WORDS = {
  parent: { done: REMOVAL_TEXTS.parentRemoved, notRemoved: "Ez a szülő nincs eltávolítva." },
  family: { done: REMOVAL_TEXTS.familyRemoved, notRemoved: "Ez a család nincs eltávolítva." },
} as const;

/** The group ids the address names; the page reads which of them still have no coordinator. */
export const namedGroups = (query: RemovalResultQuery): readonly string[] =>
  query.csoport === undefined ? [] : [query.csoport].flat();

/**
 * What a removal left to handle (U14, W7): shown right after the removal and again from the archived family. The
 * success message and the sign-out warning appear only right after it, and only once the subject really is gone.
 * Items and groups already handled are no longer listed.
 */
export function RemovalResult({
  kind,
  removed,
  flagged,
  groups,
  query,
}: Readonly<{
  kind: RemovalSubjectModel["kind"];
  removed: boolean;
  flagged: ApplicationResult<FlaggedItemListModel>;
  groups: readonly CoordinatorGroupModel[];
  query: RemovalResultQuery;
}>) {
  const justRemoved = query.allapot === "eltavolitva";
  return (
    <AsyncStatePanel
      result={flagged}
      testId="admin-removal-result-state"
      emptyMessage="Nincs intézendő tétel."
    >
      {(data) =>
        !removed ? (
          <p role="status" data-testid="admin-removal-not-removed">
            {WORDS[kind].notRemoved}
          </p>
        ) : (
          <div className="admin-detail-grid">
            {justRemoved && (
              <div
                className="admin-action-state admin-action-state-success"
                role="status"
                data-testid="admin-removal-success"
              >
                <strong>{WORDS[kind].done}</strong>
              </div>
            )}
            {justRemoved && query.kijelentkezes === "sikertelen" && (
              <p
                className="admin-action-state admin-action-state-conflict"
                role="alert"
                data-testid="admin-removal-sign-out-warning"
              >
                {REMOVAL_TEXTS.signOutWarning}
              </p>
            )}
            <section data-testid="admin-removal-flagged">
              <h2>{REMOVAL_TEXTS.flaggedItems}</h2>
              {data.items.length === 0 ? (
                <p>Nincs intézendő tétel.</p>
              ) : (
                <ul className="admin-removal-items">
                  {data.items.map((item) => (
                    <li key={`${item.kind}:${item.itemId}:${item.onDate ?? ""}`}>
                      <span className="eyebrow">{REMOVAL_FLAGGED_KIND_LABELS[item.kind]}</span>
                      <Link className="admin-removal-item-link" href={item.link}>
                        {item.label}
                      </Link>
                      {item.onDate && <span>{formatShortDay(item.onDate)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {groups.length > 0 && (
              <section className="admin-rota-warning" data-testid="admin-removal-groups">
                <h2>{REMOVAL_TEXTS.groupsLeftWithoutCoordinator}</h2>
                <ul className="admin-removal-items">
                  {groups.map((group) => (
                    <li key={group.groupId}>
                      <span>{group.groupName}</span>
                      <Link
                        className="admin-removal-item-link"
                        href={`/admin/munkacsoportok/${group.groupId}`}
                        aria-label={`Koordinátor kijelölése: ${group.groupName}`}
                      >
                        Koordinátor kijelölése
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )
      }
    </AsyncStatePanel>
  );
}
