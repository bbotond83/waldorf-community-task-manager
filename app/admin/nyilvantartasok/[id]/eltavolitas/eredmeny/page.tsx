import { AdminBackLink } from "../../../../_components/AdminBackLink.tsx";
import {
  namedGroups,
  RemovalResult,
  type RemovalResultQuery,
} from "../../../../_components/RemovalResult.tsx";
import { resolveAdminFacade } from "../../../../_lib/facade.ts";
import { readFlaggedItems, readGroupsWithoutCoordinator } from "../../../../_lib/removal-reads.ts";
import { resolveAdminSession } from "../../../../_lib/session.ts";

/** What a family's removal left to handle (U14, W7). Also reached later from the archived family. */
export default async function FamilyRemovalResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<RemovalResultQuery>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const session = await resolveAdminSession();
  const facade = await resolveAdminFacade();
  const record =
    session.state === "success" && facade
      ? await facade.getRecord(session.data.applicationSession, session.data.scope, "record", id)
      : undefined;
  const removed =
    record?.state === "success" &&
    record.data.kind === "family" &&
    record.data.state === "archived";
  const flagged = await readFlaggedItems({ kind: "family", id });
  const groups = removed ? await readGroupsWithoutCoordinator(namedGroups(query)) : [];
  return (
    <section className="admin-page" data-testid="admin-family-removal-result-page">
      <header>
        <AdminBackLink list="records" />
        <p className="eyebrow">Nyilvántartások</p>
        <h1 tabIndex={-1} autoFocus>
          Az eltávolítás eredménye
        </h1>
      </header>
      <RemovalResult
        kind="family"
        removed={removed}
        flagged={flagged}
        groups={groups}
        query={query}
      />
    </section>
  );
}
