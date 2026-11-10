import type {
  DomainOutcome,
  RotaApplicationPort,
  RotaChangeModel,
  RotaDutyCardModel,
  RotaFamilyCount,
  RotaOverviewItem,
  RotaOverviewModel,
  RotaPlanModel,
  RotaPlanWeek,
  RotaSchoolYear,
  SchoolCalendarModel,
  SchoolWeekItem,
} from "../application/index.ts";
import type { DatabaseClient } from "../runtime/database/client.ts";
import { malformedResponse } from "./errors.ts";
import { DataGateway, type Envelope } from "./gateway.ts";
import { toOutcome } from "./results.ts";
import { asRow, asRows, flag, integer, oneOf, optionalText, type Row, text } from "./values.ts";

/**
 * The database's school calendar and rota (U2: BR20 to BR27). Every command carries its idempotency key and the
 * version the screen saw; a refusal keeps its code, so the screen can say why in Hungarian. A draft is read by a
 * super admin only: for any other caller the plan and calendar reads come back denied, never empty (BR22.5).
 */

function optionalRow(row: Row, key: string): Row | undefined {
  const value = row[key];
  if (value === null || value === undefined) return undefined;
  return asRow(value);
}

function optionalInteger(row: Row, key: string): number | undefined {
  return row[key] === null || row[key] === undefined ? undefined : integer(row, key);
}

function toSchoolYear(row: Row): RotaSchoolYear {
  const startsOn = optionalText(row, "starts_on");
  const endsOn = optionalText(row, "ends_on");
  const changeoverDate = optionalText(row, "changeover_date");
  const version = optionalInteger(row, "version");
  return Object.freeze({
    id: text(row, "id"),
    name: text(row, "name"),
    ...(startsOn ? { startsOn } : {}),
    ...(endsOn ? { endsOn } : {}),
    ...(changeoverDate ? { changeoverDate } : {}),
    ...(version === undefined ? {} : { version }),
  });
}

function toWeek(row: Row): SchoolWeekItem {
  const breakWeekId = optionalText(row, "break_week_id");
  const label = optionalText(row, "label");
  const version = optionalInteger(row, "version");
  return Object.freeze({
    weekStart: text(row, "week_start"),
    isBreak: flag(row, "is_break"),
    ...(breakWeekId ? { breakWeekId } : {}),
    ...(label ? { label } : {}),
    ...(version === undefined ? {} : { version }),
  });
}

function toCalendar(envelope: Envelope): SchoolCalendarModel {
  const year = optionalRow(envelope, "school_year");
  return Object.freeze({
    ...(year ? { schoolYear: toSchoolYear(year) } : {}),
    schoolYears: Object.freeze(
      asRows(envelope.school_years).map((row) =>
        Object.freeze({ id: text(row, "id"), name: text(row, "name") }),
      ),
    ),
    weeks: Object.freeze(asRows(envelope.items).map(toWeek)),
    warnings: Object.freeze(
      asRows(envelope.warnings).map((row) =>
        Object.freeze({
          weekStart: text(row, "week_start"),
          familyDisplayName: text(row, "family_display_name"),
        }),
      ),
    ),
    hasPlan: flag(envelope, "has_plan"),
  });
}

const EMPTY_REASONS = ["no_family", "cleared"] as const;

function toPlanWeek(row: Row): RotaPlanWeek {
  const familyId = optionalText(row, "family_id");
  const familyDisplayName = optionalText(row, "family_display_name");
  const emptyReason =
    row.empty_reason == null ? undefined : oneOf(row, "empty_reason", EMPTY_REASONS);
  return Object.freeze({
    id: text(row, "id"),
    weekStart: text(row, "week_start"),
    isBreak: flag(row, "is_break"),
    ...(familyId ? { familyId } : {}),
    ...(familyDisplayName ? { familyDisplayName } : {}),
    ...(emptyReason ? { emptyReason } : {}),
    changedByAdmin: flag(row, "changed_by_admin"),
    version: integer(row, "version"),
  });
}

function toFamilyCount(row: Row): RotaFamilyCount {
  return Object.freeze({
    familyId: text(row, "family_id"),
    displayName: text(row, "display_name"),
    weeks: integer(row, "weeks"),
    aboveLowest: flag(row, "above_lowest"),
  });
}

function weekStarts(value: unknown): readonly string[] {
  return Object.freeze(asRows(value).map((row) => text(row, "week_start")));
}

function toPlan(envelope: Envelope): RotaPlanModel {
  const year = optionalRow(envelope, "school_year");
  const plan = optionalRow(envelope, "plan");
  const weekCount = optionalInteger(envelope, "week_count");
  const blockers = optionalRow(envelope, "blockers");
  const publishedAt = plan ? optionalText(plan, "published_at") : undefined;
  return Object.freeze({
    ...(year ? { schoolYear: toSchoolYear(year) } : {}),
    ...(plan
      ? {
          plan: Object.freeze({
            id: text(plan, "id"),
            status: oneOf(plan, "status", ["draft", "published"] as const),
            version: integer(plan, "version"),
            ...(publishedAt ? { publishedAt } : {}),
          }),
        }
      : {}),
    ...(weekCount === undefined ? {} : { weekCount }),
    weeks: Object.freeze(
      envelope.items === undefined ? [] : asRows(envelope.items).map(toPlanWeek),
    ),
    families: Object.freeze(
      envelope.families === undefined ? [] : asRows(envelope.families).map(toFamilyCount),
    ),
    changedWeeks: optionalInteger(envelope, "changed_weeks") ?? 0,
    blockers: Object.freeze({
      emptyWeeks: blockers ? weekStarts(blockers.empty_weeks) : Object.freeze([]),
      breakWeeks: blockers ? weekStarts(blockers.break_weeks) : Object.freeze([]),
      ineligibleWeeks: blockers ? weekStarts(blockers.ineligible_weeks) : Object.freeze([]),
    }),
    canPublish: envelope.can_publish === true,
  });
}

/** The only fields of an overview week (NFR1.2): a family id and name, nothing else about the family. */
function toOverviewItem(row: Row): RotaOverviewItem {
  const familyId = optionalText(row, "family_id");
  const familyDisplayName = optionalText(row, "family_display_name");
  const dutyId = optionalText(row, "duty_id");
  return Object.freeze({
    job: oneOf(row, "job", ["indoor_cleaning"] as const),
    weekStart: text(row, "week_start"),
    isBreak: flag(row, "is_break"),
    ...(familyId ? { familyId } : {}),
    ...(familyDisplayName ? { familyDisplayName } : {}),
    // A week with no rota row has no family to compare, so the database's own flag is null there.
    isOwn: row.is_own === null || row.is_own === undefined ? false : flag(row, "is_own"),
    ...(dutyId ? { dutyId } : {}),
  });
}

function toOverview(envelope: Envelope): RotaOverviewModel {
  const year = optionalRow(envelope, "school_year");
  return Object.freeze({
    overviewState: oneOf(envelope, "overview_state", ["nothing_published", "published"] as const),
    ...(year
      ? { schoolYear: Object.freeze({ id: text(year, "id"), name: text(year, "name") }) }
      : {}),
    items: Object.freeze(asRows(envelope.items).map(toOverviewItem)),
  });
}

function toDutyCard(envelope: Envelope): RotaDutyCardModel {
  const item = asRow(envelope.item);
  if (item.no_fixed_day !== true) throw malformedResponse();
  return Object.freeze({
    dutyId: text(item, "duty_id"),
    job: oneOf(item, "job", ["indoor_cleaning"] as const),
    title: text(item, "title"),
    familyDisplayName: text(item, "family_display_name"),
    weekStart: text(item, "week_start"),
    weekEnd: text(item, "week_end"),
    noFixedDay: true,
    isBreakWeek: flag(item, "is_break_week"),
  });
}

function changeOf(envelope: Envelope): RotaChangeModel {
  const version = optionalInteger(envelope, "version");
  return Object.freeze({
    id: envelope.reference ?? "",
    ...(version === undefined ? {} : { version }),
  });
}

export function createRotaPort(database: DatabaseClient): RotaApplicationPort {
  const gateway = new DataGateway(database);
  const command = async (
    name: string,
    args: Readonly<Record<string, unknown>>,
    key: string,
  ): Promise<DomainOutcome<RotaChangeModel>> =>
    toOutcome(await gateway.call(name, args, key), changeOf);
  return {
    async calendar({ schoolYearId }) {
      const envelope = await gateway.call("school_calendar_get", {
        p_school_year_id: schoolYearId ?? null,
      });
      return toOutcome(envelope, toCalendar);
    },
    addBreakWeek: ({ idempotencyKey, schoolYearId, weekStart, label }) =>
      command(
        "break_week_add",
        {
          p_idempotency_key: idempotencyKey,
          p_school_year_id: schoolYearId,
          p_week_start: weekStart,
          p_label: label ?? null,
        },
        idempotencyKey,
      ),
    removeBreakWeek: ({ idempotencyKey, breakWeekId, expectedVersion }) =>
      command(
        "break_week_remove",
        {
          p_idempotency_key: idempotencyKey,
          p_break_week_id: breakWeekId,
          p_expected_version: expectedVersion,
        },
        idempotencyKey,
      ),
    async plan({ schoolYearId }) {
      const envelope = await gateway.call("rota_plan_get", {
        p_school_year_id: schoolYearId ?? null,
      });
      return toOutcome(envelope, toPlan);
    },
    makeDraft: ({ idempotencyKey, schoolYearId }) =>
      command(
        "rota_plan_make",
        { p_idempotency_key: idempotencyKey, p_school_year_id: schoolYearId },
        idempotencyKey,
      ),
    setWeek: ({ idempotencyKey, weekId, familyId, expectedVersion }) =>
      command(
        "rota_week_set",
        {
          p_idempotency_key: idempotencyKey,
          p_week_id: weekId,
          p_family_id: familyId,
          p_expected_version: expectedVersion,
        },
        idempotencyKey,
      ),
    discard: ({ idempotencyKey, planId, expectedVersion, changedWeeks }) =>
      command(
        "rota_plan_discard",
        {
          p_idempotency_key: idempotencyKey,
          p_plan_id: planId,
          p_expected_version: expectedVersion,
          p_changed_weeks: changedWeeks,
        },
        idempotencyKey,
      ),
    publish: ({ idempotencyKey, planId, expectedVersion }) =>
      command(
        "rota_plan_publish",
        {
          p_idempotency_key: idempotencyKey,
          p_plan_id: planId,
          p_expected_version: expectedVersion,
        },
        idempotencyKey,
      ),
    async overview() {
      return toOutcome(await gateway.call("rota_overview", {}), toOverview);
    },
    async dutyCard({ dutyId }) {
      return toOutcome(await gateway.call("rota_duty_card", { p_duty_id: dutyId }), toDutyCard);
    },
  };
}
