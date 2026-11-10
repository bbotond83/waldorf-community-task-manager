import type { Scope } from "../../../src/access/index.ts";
import { COMMUNITY_GROUP } from "../../../src/application/admin-payloads.ts";
import type {
  AdminApplicationFacade,
  AdminItemModel,
  ApplicationResult,
  SessionContext,
  WorkingGroupApplicationFacade,
} from "../../../src/application/index.ts";

/** One choice of a selector on an admin form. */
export type LookupOption = Readonly<{ value: string; label: string }>;

/** An event a task can belong to; its group lets the form offer only the events of the task's scope. */
export type EventOption = LookupOption & Readonly<{ groupId: string }>;

/**
 * The choices the extended admin forms offer: the school years (a super admin's), the working groups a person may
 * name on an item (W4, W5), the active families by name and the planned events. A list that cannot be read is simply
 * empty, and the form then asks for a choice nobody can make instead of failing.
 */
export type AdminLookups = Readonly<{
  schoolYears: readonly LookupOption[];
  groups: readonly LookupOption[];
  families: readonly LookupOption[];
  events: readonly EventOption[];
}>;

export const NO_LOOKUPS: AdminLookups = Object.freeze({
  schoolYears: [],
  groups: [],
  families: [],
  events: [],
});

function itemsOf(
  result: ApplicationResult<{ items: readonly AdminItemModel[] }>,
): readonly AdminItemModel[] {
  return result.state === "success" || result.state === "recovery" ? result.data.items : [];
}

function options(items: readonly AdminItemModel[], kind: AdminItemModel["kind"]): LookupOption[] {
  return items
    .filter((item) => item.kind === kind && item.state === "active")
    .map((item) => ({ value: item.id, label: item.title }));
}

/** A super admin's `groupIds` is empty: they name any group, or the whole community. */
export async function loadAdminLookups(
  facade: AdminApplicationFacade,
  workingGroups: Pick<WorkingGroupApplicationFacade, "list">,
  session: SessionContext,
  scope: Scope,
  groupIds: readonly string[],
): Promise<AdminLookups> {
  const isSuper = groupIds.length === 0;
  const [records, tasks, groups, families] = await Promise.all([
    isSuper ? facade.listRecords(session, scope, { state: "active" }) : undefined,
    facade.listTasks(session, scope),
    workingGroups.list(session, scope),
    facade.listFamilyNames(session, scope),
  ]);
  const events: EventOption[] = itemsOf(tasks)
    .filter((item) => item.kind === "event" && item.state === "scheduled")
    .map((item) => ({
      value: item.id,
      label: item.title,
      groupId: item.details?.groupId ?? COMMUNITY_GROUP,
    }));
  const groupItems = groups.state === "success" ? groups.data.items : [];
  const groupChoices = groupItems
    .filter((group) => isSuper || groupIds.includes(group.id))
    .map((group) => ({ value: group.id, label: group.name }));
  return Object.freeze({
    schoolYears: records ? options(itemsOf(records), "school-year") : [],
    groups: isSuper
      ? [{ value: COMMUNITY_GROUP, label: "Egész közösség" }, ...groupChoices]
      : groupChoices,
    families:
      families.state === "success"
        ? families.data.items.map((family) => ({ value: family.id, label: family.displayName }))
        : [],
    events,
  });
}
