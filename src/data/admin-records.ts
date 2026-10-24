import type {
  AdminItemDetails,
  AdminItemKind,
  AdminItemModel,
  AdminListModel,
  AdminParentDetail,
  DomainOutcome,
} from "../application/index.ts";
import type { DataGateway } from "./gateway.ts";
import {
  defined,
  likePattern,
  payloadFlag,
  payloadNumber,
  payloadObjects,
  payloadText,
  payloadTexts,
  type Payload,
} from "./payload.ts";
import { refused, toOutcome } from "./results.ts";
import { asRows, flag, integer, isUuid, optionalText, text, type Row } from "./values.ts";

/**
 * The admin operations on records (records.list, records.get, records.save, records.archive,
 * records.restore): families with their parents and children, groups and school years (W1 to W4). Reads are
 * policy-filtered table reads, so an admin sees exactly the rows their reach allows; changes call the
 * named functions, which check the reach again. A change whose payload names only a title keeps working: the
 * adapter fills every other field from the stored record (see `admin-payloads.ts`).
 */
export type RecordKind = "family" | "child" | "group" | "school_year";

export type RecordCall = Readonly<{ payload: Payload; idempotencyKey?: string }>;

type Found = Readonly<{ kind: RecordKind; row: Row }>;

const TABLES: Readonly<Record<RecordKind, { table: string; columns: string; name: string }>> =
  Object.freeze({
    family: { table: "families", columns: "id,display_name,status,version", name: "display_name" },
    child: {
      table: "children",
      columns: "id,family_id,display_name,status,version",
      name: "display_name",
    },
    group: {
      table: "groups",
      columns: "id,school_year_id,name,status,version",
      name: "name",
    },
    school_year: {
      table: "school_years",
      columns: "id,name,starts_on,ends_on,status,version",
      name: "name",
    },
  });

const KINDS = Object.keys(TABLES) as readonly RecordKind[];

/** The kind a screen names: `school-year` is the screen's word, `record` means "look it up". */
export function recordKindOf(value: string | undefined): RecordKind | undefined {
  const normalized = value === "school-year" ? "school_year" : value;
  return KINDS.find((kind) => kind === normalized);
}

/** The word a screen uses for a record kind (`school-year` is the screen's spelling). */
function itemKind(kind: RecordKind): AdminItemKind {
  return kind === "school_year" ? "school-year" : kind;
}

function toItem(kind: RecordKind, row: Row): AdminItemModel {
  return Object.freeze({
    id: text(row, "id"),
    title: text(row, TABLES[kind].name),
    state: text(row, "status"),
    version: integer(row, "version"),
    kind: itemKind(kind),
  });
}

async function readRows(
  gateway: DataGateway,
  kind: RecordKind,
  refine: (query: Filterable) => Filterable,
): Promise<readonly Row[]> {
  const { table, columns } = TABLES[kind];
  const data = await gateway.select(`records.${table}`, (client) =>
    refine(client.from(table).select(columns) as unknown as Filterable).limit(1000),
  );
  return asRows(data);
}

/** The few query methods used here; the real builder has them all. */
interface Filterable {
  eq(column: string, value: string): Filterable;
  in(column: string, values: readonly string[]): Filterable;
  ilike(column: string, pattern: string): Filterable;
  order(column: string, options?: { ascending: boolean }): Filterable;
  limit(count: number): Filterable;
}

async function findRecord(gateway: DataGateway, id: string): Promise<Found | undefined> {
  if (!isUuid(id)) return undefined;
  const found = await Promise.all(
    KINDS.map(async (kind) => ({
      kind,
      rows: await readRows(gateway, kind, (q) => q.eq("id", id)),
    })),
  );
  const hit = found.find((entry) => entry.rows.length > 0);
  return hit ? { kind: hit.kind, row: hit.rows[0]! } : undefined;
}

/** records.list: every kind, filtered by the status and a search text, sorted by name. */
export async function listRecords(
  gateway: DataGateway,
  payload: Payload,
): Promise<DomainOutcome<AdminListModel>> {
  const search = payloadText(payload, "q")?.trim();
  const state = payloadText(payload, "state");
  const lists = await Promise.all(
    KINDS.map(async (kind) => {
      const rows = await readRows(gateway, kind, (query) => {
        let refined = query;
        if (state === "active" || state === "archived") refined = refined.eq("status", state);
        if (search) refined = refined.ilike(TABLES[kind].name, likePattern(search));
        return refined.order(TABLES[kind].name);
      });
      return rows.map((row) => toItem(kind, row));
    }),
  );
  const items = lists.flat().toSorted((a, b) => a.title.localeCompare(b.title, "hu"));
  return items.length > 0
    ? { state: "success", data: { items: Object.freeze(items) } }
    : { state: "empty" };
}

export async function getRecord(
  gateway: DataGateway,
  payload: Payload,
): Promise<DomainOutcome<AdminItemModel>> {
  const found = await findRecord(gateway, payloadText(payload, "id") ?? "");
  if (!found) return { state: "denied" };
  const item = toItem(found.kind, found.row);
  return {
    state: "success",
    data: Object.freeze({ ...item, details: await detailsOf(gateway, found) }),
  };
}

async function readTable(
  gateway: DataGateway,
  table: string,
  columns: string,
  refine: (query: Filterable) => Filterable,
): Promise<readonly Row[]> {
  const data = await gateway.select(`records.${table}`, (client) =>
    refine(client.from(table).select(columns) as unknown as Filterable).limit(1000),
  );
  return asRows(data);
}

/**
 * What a form needs to edit a stored record: the fields of its kind and, for a family, its parents with
 * their contact details, its children and the groups it is an active member of. The reads are policy-filtered
 * like every other read, so an admin outside the family's reach gets nothing here either.
 */
async function detailsOf(gateway: DataGateway, found: Found): Promise<AdminItemDetails> {
  const { kind, row } = found;
  if (kind === "group") return Object.freeze({ schoolYearId: text(row, "school_year_id") });
  if (kind === "school_year") {
    return Object.freeze({ startsOn: text(row, "starts_on"), endsOn: text(row, "ends_on") });
  }
  if (kind === "child") return Object.freeze({ familyId: text(row, "family_id") });
  const familyId = text(row, "id");
  const [parents, children, memberships] = await Promise.all([
    readTable(
      gateway,
      "parents",
      // The profile text is no readable column; it comes from `directory_parent_profile` below.
      "id,display_name,optional_profile_consent,account_id,version",
      (q) => q.eq("family_id", familyId).eq("status", "active").order("display_name"),
    ),
    readTable(gateway, "children", "id,display_name,version", (q) =>
      q.eq("family_id", familyId).eq("status", "active").order("display_name"),
    ),
    readTable(gateway, "group_memberships", "group_id", (q) =>
      q.eq("family_id", familyId).eq("status", "active"),
    ),
  ]);
  const groupIds = memberships.map((membership) => text(membership, "group_id"));
  const [contacts, groups] = await Promise.all([
    parents.length
      ? readTable(
          gateway,
          "parent_contacts",
          "parent_id,contact_email,contact_phone,locality",
          (q) =>
            q.in(
              "parent_id",
              parents.map((parent) => text(parent, "id")),
            ),
        )
      : Promise.resolve([] as readonly Row[]),
    groupIds.length
      ? readTable(gateway, "groups", "id,name", (q) => q.in("id", groupIds).order("name"))
      : Promise.resolve([] as readonly Row[]),
  ]);
  // The optional profile exists only with consent, and only the function may read it (BR30.4).
  const profiles = await Promise.all(
    parents.map(async (parent) => {
      if (parent.optional_profile_consent !== true) return undefined;
      const answer = await gateway.select("records.profile", (client) =>
        client.rpc("directory_parent_profile", { p_parent_id: text(parent, "id") }),
      );
      return typeof answer === "string" && answer !== "" ? answer : undefined;
    }),
  );
  return Object.freeze({
    parents: Object.freeze(
      parents.map((parent, index) =>
        parentDetail(
          parent,
          contacts.find((contact) => contact.parent_id === parent.id),
          profiles[index],
        ),
      ),
    ),
    children: Object.freeze(
      children.map((child) =>
        Object.freeze({
          id: text(child, "id"),
          version: integer(child, "version"),
          displayName: text(child, "display_name"),
        }),
      ),
    ),
    groups: Object.freeze(
      groups.map((group) => Object.freeze({ id: text(group, "id"), name: text(group, "name") })),
    ),
  });
}

function parentDetail(
  parent: Row,
  contact: Row | undefined,
  profile: string | undefined,
): AdminParentDetail {
  const email = contact ? optionalText(contact, "contact_email") : undefined;
  const phone = contact ? optionalText(contact, "contact_phone") : undefined;
  const locality = contact ? optionalText(contact, "locality") : undefined;
  return Object.freeze({
    id: text(parent, "id"),
    version: integer(parent, "version"),
    displayName: text(parent, "display_name"),
    ...(email !== undefined ? { email } : {}),
    ...(phone !== undefined ? { phone } : {}),
    ...(locality !== undefined ? { locality } : {}),
    ...(profile !== undefined ? { optionalProfile: profile } : {}),
    optionalProfileConsent: flag(parent, "optional_profile_consent"),
    linked: parent.account_id !== null && parent.account_id !== undefined,
  });
}

/** What a screen may send as the name of a record. */
function nameOf(payload: Payload): string | undefined {
  return payloadText(payload, "displayName", "name", "title")?.trim();
}

function parentBody(entry: Payload): Record<string, unknown> {
  const contact = defined({
    email: payloadText(entry, "email"),
    phone: payloadText(entry, "phone"),
    locality: payloadText(entry, "locality"),
  });
  return defined({
    id: payloadText(entry, "id"),
    expected_version: payloadNumber(entry, "expectedVersion"),
    display_name: payloadText(entry, "displayName"),
    optional_profile: payloadText(entry, "optionalProfile"),
    optional_profile_consent: payloadFlag(entry, "optionalProfileConsent"),
    contact: Object.keys(contact).length > 0 ? contact : undefined,
  });
}

function childBody(entry: Payload): Record<string, unknown> {
  return defined({
    id: payloadText(entry, "id"),
    expected_version: payloadNumber(entry, "expectedVersion"),
    display_name: payloadText(entry, "displayName"),
  });
}

async function readFamily(gateway: DataGateway, familyId: string): Promise<Row | undefined> {
  return (await readRows(gateway, "family", (q) => q.eq("id", familyId)))[0];
}

export async function saveRecord(
  gateway: DataGateway,
  call: RecordCall,
): Promise<DomainOutcome<AdminItemModel>> {
  const { payload, idempotencyKey } = call;
  const id = payloadText(payload, "id") ?? "new";
  const creating = id === "new";
  const expectedVersion = payloadNumber(payload, "expectedVersion");
  const given = recordKindOf(payloadText(payload, "kind"));
  const found = creating ? undefined : await findRecord(gateway, id);
  if (!creating && !found) return { state: "denied" };
  const kind = found?.kind ?? given;
  if (!kind) return refused({ kind: "VAL-REQUIRED" }, "field_invalid");
  if (found && given && given !== found.kind)
    return refused({ kind: "VAL-INVALID" }, "field_invalid");
  const key = idempotencyKey ?? "";
  const current = found?.row;

  switch (kind) {
    case "family": {
      const body = defined({
        family_id: creating ? null : id,
        expected_version: creating ? undefined : expectedVersion,
        display_name: nameOf(payload) ?? (current ? text(current, "display_name") : undefined),
        parents: payloadObjects(payload, "parents")?.map(parentBody),
        children: payloadObjects(payload, "children")?.map(childBody),
        add_group_ids: payloadTexts(payload, "addGroupIds"),
        end_group_ids: payloadTexts(payload, "endGroupIds"),
      });
      const envelope = await gateway.call(
        "directory_save",
        { p_idempotency_key: key, p_family: body },
        key,
      );
      return toOutcome(envelope, (result) =>
        Object.freeze({
          id: result.reference ?? id,
          title: String(body.display_name ?? ""),
          state: "active",
          version: versionOf(result, (expectedVersion ?? 0) + 1),
        }),
      );
    }
    case "group": {
      const body = defined({
        id: creating ? null : id,
        expected_version: creating ? undefined : expectedVersion,
        name: nameOf(payload) ?? (current ? text(current, "name") : undefined),
        school_year_id: payloadText(payload, "schoolYearId"),
      });
      const envelope = await gateway.call(
        "structure_save",
        { p_idempotency_key: key, p_kind: "group", p_payload: body },
        key,
      );
      return toOutcome(envelope, (result) =>
        Object.freeze({
          id: result.reference ?? id,
          title: String(body.name ?? ""),
          state: "active",
          version: versionOf(result, (expectedVersion ?? 0) + 1),
        }),
      );
    }
    case "school_year": {
      const body = defined({
        id: creating ? null : id,
        expected_version: creating ? undefined : expectedVersion,
        name: nameOf(payload) ?? (current ? text(current, "name") : undefined),
        starts_on:
          payloadText(payload, "startsOn") ?? (current ? text(current, "starts_on") : undefined),
        ends_on: payloadText(payload, "endsOn") ?? (current ? text(current, "ends_on") : undefined),
      });
      const envelope = await gateway.call(
        "structure_save",
        { p_idempotency_key: key, p_kind: "school_year", p_payload: body },
        key,
      );
      return toOutcome(envelope, (result) =>
        Object.freeze({
          id: result.reference ?? id,
          title: String(body.name ?? ""),
          state: "active",
          version: versionOf(result, (expectedVersion ?? 0) + 1),
        }),
      );
    }
    case "child":
      return saveChild(gateway, { creating, id, current, expectedVersion, payload, key });
  }
}

/**
 * A child is saved with its family (the database function changes a family and its children together). The
 * family's own version is read just before, so only the child's version is checked here.
 */
async function saveChild(
  gateway: DataGateway,
  input: Readonly<{
    creating: boolean;
    id: string;
    current: Row | undefined;
    expectedVersion: number | undefined;
    payload: Payload;
    key: string;
  }>,
): Promise<DomainOutcome<AdminItemModel>> {
  const familyId = input.current
    ? text(input.current, "family_id")
    : (payloadText(input.payload, "familyId") ?? "");
  const family = isUuid(familyId) ? await readFamily(gateway, familyId) : undefined;
  if (!family) return refused({ familyId: "VAL-NOT-FOUND" }, "field_invalid");
  const name =
    nameOf(input.payload) ?? (input.current ? text(input.current, "display_name") : undefined);
  const envelope = await gateway.call(
    "directory_save",
    {
      p_idempotency_key: input.key,
      p_family: {
        family_id: familyId,
        expected_version: integer(family, "version"),
        display_name: text(family, "display_name"),
        children: [
          defined({
            id: input.creating ? undefined : input.id,
            expected_version: input.creating ? undefined : input.expectedVersion,
            display_name: name,
          }),
        ],
      },
    },
    input.key,
  );
  const outcome = toOutcome(envelope, () => true);
  if (outcome.state !== "success") return outcome as DomainOutcome<AdminItemModel>;
  return readChild(gateway, input.creating ? undefined : input.id, familyId, name ?? "");
}

async function readChild(
  gateway: DataGateway,
  id: string | undefined,
  familyId: string,
  name: string,
): Promise<DomainOutcome<AdminItemModel>> {
  // `directory_save` does not return the ids it creates, so a new child is found again by its family and
  // name, and when names repeat the newest one is the one just made (newest first, the id breaks a tie).
  const rows = await readRows(gateway, "child", (query) =>
    id
      ? query.eq("id", id)
      : query
          .eq("family_id", familyId)
          .eq("display_name", name)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false }),
  );
  const row = rows[0];
  return row ? { state: "success", data: toItem("child", row) } : { state: "denied" };
}

function versionOf(envelope: Row, fallback: number): number {
  return typeof envelope.version === "number" ? envelope.version : Math.max(1, fallback);
}

/** records.archive and records.restore: a family has its own use case, the rest share one function. */
export async function changeRecordState(
  gateway: DataGateway,
  call: RecordCall,
  change: "archive" | "restore",
): Promise<DomainOutcome<Readonly<{ completed: true }>>> {
  const { payload } = call;
  const id = payloadText(payload, "id") ?? "";
  const expectedVersion = payloadNumber(payload, "expectedVersion");
  const key = call.idempotencyKey ?? "";
  const found = await findRecord(gateway, id);
  if (!found) return { state: "denied" };
  const envelope =
    found.kind === "family"
      ? await gateway.call(
          change === "archive" ? "family_archive" : "family_restore",
          { p_idempotency_key: key, p_family_id: id, p_expected_version: expectedVersion ?? null },
          key,
        )
      : await gateway.call(
          change === "archive" ? "directory_archive_item" : "directory_restore_item",
          {
            p_idempotency_key: key,
            p_kind: found.kind,
            p_id: id,
            p_expected_version: expectedVersion ?? null,
          },
          key,
        );
  return toOutcome(envelope, () => Object.freeze({ completed: true as const }));
}
