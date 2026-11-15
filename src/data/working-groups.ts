import type {
  DomainOutcome,
  FamilyNameListModel,
  WorkingGroupApplicationPort,
  WorkingGroupChangeModel,
  WorkingGroupDetailModel,
  WorkingGroupItem,
  WorkingGroupMember,
} from "../application/index.ts";
import type { DatabaseClient } from "../runtime/database/client.ts";
import { DataGateway, type Envelope } from "./gateway.ts";
import { toItemsOutcome, toOutcome } from "./results.ts";
import { asRow, asRows, flag, integer, optionalText, text, type Row } from "./values.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toWorkingGroup(row: Row): WorkingGroupItem {
  return Object.freeze({
    id: text(row, "id"),
    name: text(row, "name"),
    description: text(row, "description"),
    schoolYearId: text(row, "school_year_id"),
    schoolYearName: text(row, "school_year_name"),
  });
}

/**
 * One member row. A phone or an e-mail address the database withheld is simply not copied: the view model has no
 * key for it, so a screen cannot show it (BR42.2). The version is present for a super admin only.
 */
function toMember(row: Row): WorkingGroupMember {
  const email = optionalText(row, "email");
  const phone = optionalText(row, "phone");
  return Object.freeze({
    membershipId: text(row, "membership_id"),
    parentId: text(row, "parent_id"),
    fullName: text(row, "full_name"),
    isCoordinator: flag(row, "is_coordinator"),
    isSelf: flag(row, "is_self"),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(typeof row.version === "number" ? { version: integer(row, "version") } : {}),
  });
}

function toDetail(envelope: Envelope): WorkingGroupDetailModel {
  const own = envelope.own_membership;
  const ownRow = own === null || own === undefined ? null : asRow(own);
  return Object.freeze({
    group: toWorkingGroup(asRow(envelope.group)),
    hasCoordinator: flag(envelope, "has_coordinator"),
    callerIsParent: flag(envelope, "caller_is_parent"),
    ownMembership: ownRow
      ? Object.freeze({ id: text(ownRow, "id"), version: integer(ownRow, "version") })
      : null,
    members: Object.freeze(asRows(envelope.members).map(toMember)),
  });
}

function toChange(envelope: Envelope): WorkingGroupChangeModel {
  return Object.freeze({
    membershipId: envelope.reference,
    version:
      typeof envelope.version === "number" && Number.isInteger(envelope.version)
        ? envelope.version
        : null,
    alreadyMember: envelope.code === "ALREADY_MEMBER",
  });
}

/**
 * The database's working-group list, group page and membership commands. A refusal stays a refusal, never an empty
 * list (BR2.3); every command is one named function with the idempotency key and, where a row is changed, the
 * version the screen saw.
 */
export function createWorkingGroupPort(database: DatabaseClient): WorkingGroupApplicationPort {
  const gateway = new DataGateway(database);
  const command = async (
    name: string,
    args: Readonly<Record<string, unknown>>,
    key: string,
  ): Promise<DomainOutcome<WorkingGroupChangeModel>> =>
    toOutcome(await gateway.call(name, args, key), toChange);
  return {
    async list() {
      const envelope = await gateway.call("working_group_list", {});
      return toItemsOutcome(envelope, (rows) => ({
        items: Object.freeze(rows.map(toWorkingGroup)),
      }));
    },
    async detail(groupId) {
      // An address that is not an identifier names no group: it reads like a missing one, and the database is not asked.
      if (!UUID_PATTERN.test(groupId)) return { state: "denied" };
      return toOutcome(
        await gateway.call("working_group_detail", { p_group_id: groupId }),
        toDetail,
      );
    },
    join: ({ idempotencyKey, groupId }) =>
      command(
        "working_group_join",
        { p_idempotency_key: idempotencyKey, p_group_id: groupId },
        idempotencyKey,
      ),
    leave: ({ idempotencyKey, membershipId, expectedVersion }) =>
      command(
        "working_group_leave",
        {
          p_idempotency_key: idempotencyKey,
          p_membership_id: membershipId,
          p_expected_version: expectedVersion,
        },
        idempotencyKey,
      ),
    appoint: ({ idempotencyKey, membershipId, expectedVersion }) =>
      command(
        "coordinator_appoint",
        {
          p_idempotency_key: idempotencyKey,
          p_membership_id: membershipId,
          p_expected_version: expectedVersion,
        },
        idempotencyKey,
      ),
    revoke: ({ idempotencyKey, membershipId, expectedVersion }) =>
      command(
        "coordinator_revoke",
        {
          p_idempotency_key: idempotencyKey,
          p_membership_id: membershipId,
          p_expected_version: expectedVersion,
        },
        idempotencyKey,
      ),
  };
}

/** Active families by id and name only, where a task needs them (BR3.10). */
export async function listFamilyNames(
  gateway: DataGateway,
): Promise<DomainOutcome<FamilyNameListModel>> {
  const envelope = await gateway.call("family_name_list", {});
  return toItemsOutcome(envelope, (rows) => ({
    items: Object.freeze(
      rows.map((row) =>
        Object.freeze({ id: text(row, "id"), displayName: text(row, "display_name") }),
      ),
    ),
  }));
}
