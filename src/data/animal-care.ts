import type {
  AnimalCalendarModel,
  AnimalCareApplicationPort,
  AnimalChangeModel,
  AnimalFairShareModel,
  AnimalFairShareRow,
  AnimalSlotItem,
  AnimalSlotsModel,
  DomainOutcome,
  InfoLink,
} from "../application/index.ts";
import type { DatabaseClient } from "../runtime/database/client.ts";
import { DataGateway, type Envelope } from "./gateway.ts";
import { toOutcome } from "./results.ts";
import {
  asRow,
  asRows,
  flag,
  integer,
  isUuid,
  oneOf,
  optionalText,
  text,
  type Row,
} from "./values.ts";

const PARTS = ["morning", "afternoon"] as const;

const links = (value: unknown): readonly InfoLink[] =>
  Object.freeze(
    asRows(value).map((row) => Object.freeze({ key: text(row, "key"), title: text(row, "title") })),
  );

function toSlot(row: Row): AnimalSlotItem {
  const placeId = optionalText(row, "place_id");
  const family = optionalText(row, "family_name");
  const reason = optionalText(row, "hold_reason");
  return Object.freeze({
    slotDate: text(row, "slot_date"),
    part: oneOf(row, "part", PARTS),
    startTime: text(row, "start_time"),
    dutyId: text(row, "duty_id"),
    dutyVersion: integer(row, "duty_version"),
    mine: flag(row, "mine"),
    inSwap: flag(row, "in_swap"),
    started: flag(row, "started"),
    cancelled: flag(row, "cancelled"),
    canGiveUp: flag(row, "can_give_up"),
    mayHold: flag(row, "may_hold"),
    ...(placeId ? { placeId, placeVersion: integer(row, "place_version") } : {}),
    ...(family ? { familyName: family } : {}),
    ...(reason ? { holdReason: reason } : {}),
  });
}

function toSlots(envelope: Envelope): AnimalSlotsModel {
  return Object.freeze({
    schoolYearId: text(envelope as Row, "school_year_id"),
    fromDate: text(envelope as Row, "from_date"),
    toDate: text(envelope as Row, "to_date"),
    slots: Object.freeze(asRows(envelope.slots).map(toSlot)),
    infoLinksMorning: links(envelope.info_links_morning),
    infoLinksAfternoon: links(envelope.info_links_afternoon),
  });
}

const toShareRow = (row: Row): AnimalFairShareRow =>
  Object.freeze({
    familyName: text(row, "family_name"),
    count: integer(row, "count"),
    share: Number(row.share),
    activeWeeks: integer(row, "active_weeks"),
    mine: flag(row, "mine"),
  });

function toFairShare(envelope: Envelope): AnimalFairShareModel {
  const mine =
    envelope.mine && typeof envelope.mine === "object"
      ? toShareRow(asRow(envelope.mine))
      : undefined;
  return Object.freeze({
    average: Number(envelope.average),
    families: Object.freeze(asRows(envelope.families).map(toShareRow)),
    ...(mine ? { mine } : {}),
  });
}

function toCalendar(envelope: Envelope): AnimalCalendarModel {
  const row = envelope as Row;
  const group = optionalText(row, "care_group_id");
  const generated = optionalText(row, "generated_at");
  return Object.freeze({
    schoolYearId: text(row, "school_year_id"),
    exists: flag(row, "exists"),
    morningStart: text(row, "morning_start"),
    afternoonStart: text(row, "afternoon_start"),
    slotCount: integer(row, "slot_count"),
    version: integer(row, "version"),
    groups: Object.freeze(
      asRows(envelope.groups).map((g) =>
        Object.freeze({ id: text(g, "id"), name: text(g, "name") }),
      ),
    ),
    ...(group ? { careGroupId: group } : {}),
    ...(generated ? { generatedAt: generated } : {}),
  });
}

function toChange(envelope: Envelope): AnimalChangeModel {
  return Object.freeze({
    id: typeof envelope.reference === "string" ? envelope.reference : null,
    version:
      typeof envelope.version === "number" && Number.isInteger(envelope.version)
        ? envelope.version
        : null,
    ...(typeof envelope.added === "number" && Number.isInteger(envelope.added)
      ? { added: envelope.added }
      : {}),
  });
}

/**
 * The database's animal-care reads and commands (U8). Every command is one named function with the idempotency key and,
 * where a row is changed, the version the screen saw. A refusal stays a refusal; an address that is not an identifier
 * names nothing and reads as denied without asking the database. Each page is one function call (NFR9.5).
 */
export function createAnimalCarePort(database: DatabaseClient): AnimalCareApplicationPort {
  const gateway = new DataGateway(database);
  const DENIED: DomainOutcome<never> = { state: "denied" };
  const read = async <T>(
    name: string,
    args: Readonly<Record<string, unknown>>,
    build: (envelope: Envelope) => T,
  ): Promise<DomainOutcome<T>> => toOutcome(await gateway.call(name, args), build);
  const change = async (
    name: string,
    args: Readonly<Record<string, unknown>>,
    key: string,
  ): Promise<DomainOutcome<AnimalChangeModel>> =>
    toOutcome(await gateway.call(name, args, key), toChange);
  return {
    async slots({ schoolYearId, fromDate, weeks }) {
      if (!isUuid(schoolYearId)) return DENIED;
      return read(
        "animal_slots_list",
        { p_school_year_id: schoolYearId, p_from_date: fromDate ?? null, p_weeks: weeks ?? null },
        toSlots,
      );
    },
    async fairShare(schoolYearId) {
      return isUuid(schoolYearId)
        ? read("animal_fair_share", { p_school_year_id: schoolYearId }, toFairShare)
        : DENIED;
    },
    async calendar(schoolYearId) {
      return isUuid(schoolYearId)
        ? read("animal_calendar_get", { p_school_year_id: schoolYearId }, toCalendar)
        : DENIED;
    },
    async saveCalendar(input) {
      if (!isUuid(input.schoolYearId)) return DENIED;
      return change(
        "animal_calendar_save",
        {
          p_idempotency_key: input.idempotencyKey,
          p_school_year_id: input.schoolYearId,
          p_morning_start: input.morningStart,
          p_afternoon_start: input.afternoonStart,
          p_care_group_id: input.careGroupId ?? null,
          p_expected_version: input.expectedVersion,
        },
        input.idempotencyKey,
      );
    },
    async createSlots({ idempotencyKey, schoolYearId }) {
      if (!isUuid(schoolYearId)) return DENIED;
      return change(
        "animal_slots_create",
        { p_idempotency_key: idempotencyKey, p_school_year_id: schoolYearId },
        idempotencyKey,
      );
    },
    async giveUp({ idempotencyKey, placeId, expectedVersion }) {
      if (!isUuid(placeId)) return DENIED;
      return change(
        "slot_give_up",
        {
          p_idempotency_key: idempotencyKey,
          p_place_id: placeId,
          p_expected_version: expectedVersion,
        },
        idempotencyKey,
      );
    },
  };
}
