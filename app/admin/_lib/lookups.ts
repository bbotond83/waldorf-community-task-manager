import type { Scope } from "../../../src/access/index.ts";
import type {
  AdminApplicationFacade,
  AdminItemModel,
  ApplicationResult,
  SessionContext,
} from "../../../src/application/index.ts";

/** One choice of a selector on an admin form. */
export type LookupOption = Readonly<{ value: string; label: string }>;

/** An event a task can belong to; its group lets the form offer only the events of the task's group. */
export type EventOption = LookupOption & Readonly<{ groupId: string }>;

/**
 * The choices the extended admin forms offer (BR32.7): the active school years, groups and families of the
 * admin's reach and the planned events. They come from the same policy-filtered lists the list pages use, so
 * an admin is offered exactly what they may use; a list that cannot be read is simply empty, and the form
 * then asks for a choice nobody can make instead of failing.
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

export async function loadAdminLookups(
  facade: AdminApplicationFacade,
  session: SessionContext,
  scope: Scope,
): Promise<AdminLookups> {
  const [records, tasks] = await Promise.all([
    facade.listRecords(session, scope, { state: "active" }),
    facade.listTasks(session, scope),
  ]);
  const recordItems = itemsOf(records);
  const events: EventOption[] = itemsOf(tasks)
    .filter((item) => item.kind === "event" && item.state === "scheduled")
    .flatMap((item) =>
      item.details?.groupId
        ? [{ value: item.id, label: item.title, groupId: item.details.groupId }]
        : [],
    );
  return Object.freeze({
    schoolYears: options(recordItems, "school-year"),
    groups: options(recordItems, "group"),
    families: options(recordItems, "family"),
    events,
  });
}
