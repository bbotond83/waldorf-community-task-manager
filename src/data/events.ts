import { FOOD_CATEGORIES } from "../application/contracts.ts";
import type {
  EventApplicationPort,
  EventChangeModel,
  EventDetailModel,
  EventListModel,
  EventRoleModel,
  EventSignupModel,
  FoodCategory,
  FoodOfferModel,
  TypedRoleListModel,
} from "../application/index.ts";
import type { DomainOutcome } from "../application/index.ts";
import type { DatabaseClient } from "../runtime/database/client.ts";
import { DataGateway, type Envelope } from "./gateway.ts";
import { toOutcome } from "./results.ts";
import { asRow, asRows, flag, integer, isUuid, optionalText, text, type Row } from "./values.ts";

const STATUSES = ["planned", "cancelled"] as const;
const ROLE_KINDS = ["parent", "typed", "former"] as const;

const status = (row: Row): "planned" | "cancelled" =>
  row.status === "cancelled" ? "cancelled" : "planned";

function toListItem(row: Row): EventListModel["items"][number] {
  const location = optionalText(row, "location");
  const groupId = optionalText(row, "group_id");
  const groupName = optionalText(row, "group_name");
  return Object.freeze({
    id: text(row, "id"),
    title: text(row, "title"),
    startsAt: text(row, "starts_at"),
    endsAt: text(row, "ends_at"),
    status: status(row),
    isFinished: flag(row, "is_finished"),
    signupCount: integer(row, "signup_count"),
    isSignedUp: flag(row, "is_signed_up"),
    ...(location ? { location } : {}),
    ...(groupId ? { groupId } : {}),
    ...(groupName ? { groupName } : {}),
  });
}

function toList(envelope: Envelope): EventListModel {
  const caller = asRow(envelope.caller ?? {});
  const managed = Array.isArray(caller.managed_group_ids)
    ? caller.managed_group_ids.filter((id): id is string => typeof id === "string")
    : [];
  return Object.freeze({
    items: Object.freeze(asRows(envelope.items).map(toListItem)),
    canManageCommunity: caller.can_manage_community === true,
    managedGroupIds: Object.freeze(managed),
    ...(typeof caller.can_manage === "boolean" ? { canManage: caller.can_manage } : {}),
  });
}

function toRole(row: Row): EventRoleModel {
  const kind = (ROLE_KINDS as readonly string[]).includes(String(row.kind))
    ? (row.kind as EventRoleModel["kind"])
    : "former";
  const parentId = optionalText(row, "parent_id");
  return Object.freeze({
    id: text(row, "id"),
    name: text(row, "name"),
    kind,
    displayName: text(row, "display_name"),
    isOrganiser: flag(row, "is_organiser"),
    version: integer(row, "version"),
    ...(parentId ? { parentId } : {}),
  });
}

function toSignup(row: Row): EventSignupModel {
  const note = optionalText(row, "note");
  const chosenAt = optionalText(row, "chosen_at");
  return Object.freeze({
    id: text(row, "id"),
    parentDisplayName: text(row, "parent_display_name"),
    familyDisplayName: text(row, "family_display_name"),
    version: integer(row, "version"),
    isOwn: flag(row, "is_own"),
    ...(note ? { note } : {}),
    ...(chosenAt ? { chosenAt } : {}),
  });
}

function toOffer(row: Row): FoodOfferModel {
  return Object.freeze({
    id: text(row, "id"),
    parentDisplayName: text(row, "parent_display_name"),
    text: text(row, "text"),
    hasMilk: flag(row, "has_milk"),
    hasEgg: flag(row, "has_egg"),
    hasGarlic: flag(row, "has_garlic"),
    version: integer(row, "version"),
    isOwn: flag(row, "is_own"),
  });
}

function toDetail(envelope: Envelope): EventDetailModel {
  const event = asRow(envelope.event);
  const caller = asRow(envelope.caller);
  const food = asRow(envelope.food);
  const location = optionalText(event, "location");
  const groupId = optionalText(event, "group_id");
  const groupName = optionalText(event, "group_name");
  const deadline = optionalText(event, "signup_deadline");
  const tale = optionalText(event, "tale");
  const categories = asRows(food.categories)
    .filter((row) => (FOOD_CATEGORIES as readonly string[]).includes(String(row.category)))
    .map((row) =>
      Object.freeze({
        category: row.category as FoodCategory,
        offers: Object.freeze(asRows(row.offers).map(toOffer)),
      }),
    );
  return Object.freeze({
    event: Object.freeze({
      id: text(event, "id"),
      title: text(event, "title"),
      startsAt: text(event, "starts_at"),
      endsAt: text(event, "ends_at"),
      status: (STATUSES as readonly string[]).includes(String(event.status))
        ? status(event)
        : "cancelled",
      isFinished: flag(event, "is_finished"),
      isOpen: flag(event, "is_open"),
      isSummer: flag(event, "is_summer"),
      foodSignupOn: flag(event, "food_signup_on"),
      version: integer(event, "version"),
      ...(location ? { location } : {}),
      ...(groupId ? { groupId } : {}),
      ...(groupName ? { groupName } : {}),
      ...(deadline ? { signupDeadline: deadline } : {}),
      ...(typeof event.notice_lead_days === "number"
        ? { noticeLeadDays: event.notice_lead_days }
        : {}),
      ...(tale ? { tale } : {}),
    }),
    notices: Object.freeze(asRows(envelope.notices).map((row) => text(row, "text"))),
    roles: Object.freeze(asRows(envelope.roles).map(toRole)),
    signups: Object.freeze(asRows(envelope.signups).map(toSignup)),
    food: Object.freeze({ on: flag(food, "on"), categories: Object.freeze(categories) }),
    caller: Object.freeze({
      canManage: flag(caller, "can_manage"),
      canSignUp: flag(caller, "can_sign_up"),
    }),
  });
}

function toChange(envelope: Envelope): EventChangeModel {
  return Object.freeze({
    id: typeof envelope.reference === "string" ? envelope.reference : null,
    version:
      typeof envelope.version === "number" && Number.isInteger(envelope.version)
        ? envelope.version
        : null,
  });
}

function toTypedRoles(envelope: Envelope): TypedRoleListModel {
  return Object.freeze({
    items: Object.freeze(
      asRows(envelope.items).map((row) =>
        Object.freeze({
          roleId: text(row, "role_id"),
          roleName: text(row, "role_name"),
          personName: text(row, "person_name"),
          version: integer(row, "version"),
          eventId: text(row, "event_id"),
          eventTitle: text(row, "event_title"),
          startsAt: text(row, "starts_at"),
        }),
      ),
    ),
  });
}

/**
 * The database's event reads and commands (U10). Every command is one named function with the idempotency key and,
 * where a row is changed, the version the screen saw. A refusal stays a refusal, never an empty list; an address that
 * is not an identifier names nothing and reads as denied without asking the database.
 */
export function createEventPort(database: DatabaseClient): EventApplicationPort {
  const gateway = new DataGateway(database);
  const change = async (
    name: string,
    args: Readonly<Record<string, unknown>>,
    key: string,
  ): Promise<DomainOutcome<EventChangeModel>> =>
    toOutcome(await gateway.call(name, args, key), toChange);
  const unknown = (...ids: readonly (string | undefined)[]): boolean =>
    ids.some((id) => id !== undefined && !isUuid(id));
  const DENIED: DomainOutcome<never> = { state: "denied" };
  return {
    async list({ past }) {
      return toOutcome(await gateway.call("event_list", { p_past: past }), toList);
    },
    async listForGroup({ groupId, past }) {
      if (unknown(groupId)) return DENIED;
      return toOutcome(
        await gateway.call("event_list_for_group", { p_group_id: groupId, p_past: past }),
        toList,
      );
    },
    async detail(eventId) {
      if (unknown(eventId)) return DENIED;
      return toOutcome(await gateway.call("event_get", { p_event_id: eventId }), toDetail);
    },
    saveNotices: ({ idempotencyKey, eventId, expectedVersion, notices }) =>
      change(
        "event_notices_save",
        {
          p_idempotency_key: idempotencyKey,
          p_event_id: eventId,
          p_expected_version: expectedVersion,
          p_notices: notices,
        },
        idempotencyKey,
      ),
    saveTale: ({ idempotencyKey, eventId, expectedVersion, tale }) =>
      change(
        "event_tale_save",
        {
          p_idempotency_key: idempotencyKey,
          p_event_id: eventId,
          p_expected_version: expectedVersion,
          p_tale: tale,
        },
        idempotencyKey,
      ),
    saveRole: ({
      idempotencyKey,
      eventId,
      roleId,
      expectedVersion,
      name,
      parentId,
      personName,
      isOrganiser,
    }) =>
      change(
        "event_role_save",
        {
          p_idempotency_key: idempotencyKey,
          p_event_id: eventId,
          p_role_id: roleId ?? null,
          p_expected_version: expectedVersion ?? null,
          p_name: name,
          p_parent_id: parentId ?? null,
          p_person_name: personName ?? null,
          p_is_organiser: isOrganiser,
        },
        idempotencyKey,
      ),
    removeRole: ({ idempotencyKey, roleId, expectedVersion }) =>
      change(
        "event_role_remove",
        {
          p_idempotency_key: idempotencyKey,
          p_role_id: roleId,
          p_expected_version: expectedVersion,
        },
        idempotencyKey,
      ),
    clearRoleName: ({ idempotencyKey, roleId, expectedVersion }) =>
      change(
        "event_role_clear_name",
        {
          p_idempotency_key: idempotencyKey,
          p_role_id: roleId,
          p_expected_version: expectedVersion,
        },
        idempotencyKey,
      ),
    async typedRoles({ subjectKind, subjectId }) {
      if (unknown(subjectId)) return DENIED;
      return toOutcome(
        await gateway.call("event_typed_roles_list", {
          p_subject_kind: subjectKind,
          p_subject_id: subjectId,
        }),
        toTypedRoles,
      );
    },
    addSignup: ({ idempotencyKey, eventId, note, chosenAt }) =>
      change(
        "event_signup_add",
        {
          p_idempotency_key: idempotencyKey,
          p_event_id: eventId,
          p_note: note ?? null,
          p_chosen_at: chosenAt ?? null,
        },
        idempotencyKey,
      ),
    changeSignup: ({ idempotencyKey, signupId, expectedVersion, note, chosenAt }) =>
      change(
        "event_signup_change",
        {
          p_idempotency_key: idempotencyKey,
          p_signup_id: signupId,
          p_expected_version: expectedVersion,
          p_note: note ?? null,
          p_chosen_at: chosenAt ?? null,
        },
        idempotencyKey,
      ),
    withdrawSignup: ({ idempotencyKey, signupId, expectedVersion }) =>
      change(
        "event_signup_withdraw",
        {
          p_idempotency_key: idempotencyKey,
          p_signup_id: signupId,
          p_expected_version: expectedVersion,
        },
        idempotencyKey,
      ),
    addOffer: ({ idempotencyKey, eventId, category, text: dish, hasMilk, hasEgg, hasGarlic }) =>
      change(
        "food_offer_add",
        {
          p_idempotency_key: idempotencyKey,
          p_event_id: eventId,
          p_category: category,
          p_text: dish,
          p_has_milk: hasMilk,
          p_has_egg: hasEgg,
          p_has_garlic: hasGarlic,
        },
        idempotencyKey,
      ),
    changeOffer: ({
      idempotencyKey,
      offerId,
      expectedVersion,
      category,
      text: dish,
      hasMilk,
      hasEgg,
      hasGarlic,
    }) =>
      change(
        "food_offer_change",
        {
          p_idempotency_key: idempotencyKey,
          p_offer_id: offerId,
          p_expected_version: expectedVersion,
          p_category: category,
          p_text: dish,
          p_has_milk: hasMilk,
          p_has_egg: hasEgg,
          p_has_garlic: hasGarlic,
        },
        idempotencyKey,
      ),
    withdrawOffer: ({ idempotencyKey, offerId, expectedVersion }) =>
      change(
        "food_offer_withdraw",
        {
          p_idempotency_key: idempotencyKey,
          p_offer_id: offerId,
          p_expected_version: expectedVersion,
        },
        idempotencyKey,
      ),
  };
}
