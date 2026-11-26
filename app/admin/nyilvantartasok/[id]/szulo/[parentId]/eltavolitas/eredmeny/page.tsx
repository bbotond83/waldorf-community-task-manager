import Link from "next/link";
import {
  namedGroups,
  RemovalResult,
  type RemovalResultQuery,
} from "../../../../../../_components/RemovalResult.tsx";
import { resolveAdminFacade } from "../../../../../../_lib/facade.ts";
import {
  readFlaggedItems,
  readGroupsWithoutCoordinator,
} from "../../../../../../_lib/removal-reads.ts";
import { resolveAdminSession } from "../../../../../../_lib/session.ts";

/** What a parent's removal left to handle (U14, W7). The parent is gone once the family record no longer lists them. */
export default async function ParentRemovalResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; parentId: string }>;
  searchParams: Promise<RemovalResultQuery>;
}) {
  const { id, parentId } = await params;
  const query = await searchParams;
  const session = await resolveAdminSession();
  const facade = await resolveAdminFacade();
  const record =
    session.state === "success" && facade
      ? await facade.getRecord(session.data.applicationSession, session.data.scope, "record", id)
      : undefined;
  const parents = record?.state === "success" ? record.data.details?.parents : undefined;
  const removed = parents !== undefined && !parents.some((parent) => parent.id === parentId);
  const flagged = await readFlaggedItems({ kind: "parent", id: parentId });
  const groups = removed ? await readGroupsWithoutCoordinator(namedGroups(query)) : [];
  return (
    <section className="admin-page" data-testid="admin-parent-removal-result-page">
      <header>
        <Link className="admin-back-link" href={`/admin/nyilvantartasok/${id}`}>
          Vissza a családhoz
        </Link>
        <p className="eyebrow">Nyilvántartások</p>
        <h1 tabIndex={-1} autoFocus>
          Az eltávolítás eredménye
        </h1>
      </header>
      <RemovalResult
        kind="parent"
        removed={removed}
        flagged={flagged}
        groups={groups}
        query={query}
      />
    </section>
  );
}
