import type {
  DomainOutcome,
  FamilyStandingItem,
  FlaggedDutyItem,
  RotaApplicationPort,
  RotaChangeModel,
  RotaClashWeek,
  RotaDutyCardModel,
  RotaFamilyCount,
  RotaFlaggedWeek,
  RotaJob,
  RotaOverviewItem,
  RotaOverviewModel,
  RotaPlanModel,
  RotaPlanWeek,
  RotaSchoolYear,
  RotaWeekRef,
  SchoolCalendarModel,
  SchoolWeekItem,
  UnpickedItem,
  UnpickedListModel,
  WeekendFreeSlot,
  WeekendOverviewItem,
  WeekendOwnPickModel,
  WeekendSlot,
  WeekendStateModel,
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

const JOBS = ["indoor_cleaning", "front_garden", "water_carrying", "weekend_animal_care"] as const;
const PICKING_JOBS = ["indoor_cleaning", "front_garden"] as const;
const SLOTS = [
  "saturday_opening",
  "saturday_closing",
  "sunday_opening",
  "sunday_closing",
  "shelter_cleaning",
] as const;
const STANDINGS = ["staying", "leaving", "new"] as const;
const HOLD_REASONS = ["leaving_after_changeover", "new_before_changeover"] as const;
const PICK_STATES = ["not_needed", "picked", "missed", "open"] as const;

function optionalJob(row: Row, key: string): RotaJob | undefined {
  return row[key] == null ? undefined : oneOf(row, key, JOBS);
}

function optionalSlot(row: Row, key: string): WeekendSlot | undefined {
  return row[key] == null ? undefined : oneOf(row, key, SLOTS);
}

function toStanding(row: Row): FamilyStandingItem {
  return Object.freeze({
    familyId: text(row, "family_id"),
    displayName: text(row, "display_name"),
    standing: oneOf(row, "standing", STANDINGS),
    version: integer(row, "version"),
  });
}

function toFlaggedDuty(row: Row): FlaggedDutyItem {
  const job = optionalJob(row, "job");
  const dutyId = optionalText(row, "duty_id");
  return Object.freeze({
    source: text(row, "source"),
    familyId: text(row, "family_id"),
    familyDisplayName: text(row, "family_display_name"),
    title: text(row, "title"),
    ...(job ? { job } : {}),
    onDate: text(row, "on_date"),
    reason: oneOf(row, "reason", HOLD_REASONS),
    ...(dutyId ? { dutyId } : {}),
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
    standings: Object.freeze(asRows(envelope.standings).map(toStanding)),
    flaggedDuties: Object.freeze(asRows(envelope.flagged_duties).map(toFlaggedDuty)),
  });
}

const EMPTY_REASONS = ["no_family", "cleared", "cancelled"] as const;

function toPlanWeek(row: Row): RotaPlanWeek {
  const familyId = optionalText(row, "family_id");
  const familyDisplayName = optionalText(row, "family_display_name");
  const emptyReason =
    row.empty_reason == null ? undefined : oneOf(row, "empty_reason", EMPTY_REASONS);
  return Object.freeze({
    id: text(row, "id"),
    job: oneOf(row, "job", JOBS),
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
  const countRow = asRow(row.counts);
  const counts = Object.freeze({
    indoor_cleaning: integer(countRow, "indoor_cleaning"),
    front_garden: integer(countRow, "front_garden"),
    water_carrying: integer(countRow, "water_carrying"),
    weekend_animal_care: integer(countRow, "weekend_animal_care"),
  });
  if (!Array.isArray(row.above_lowest)) throw malformedResponse();
  const aboveLowestJobs = Object.freeze(row.above_lowest.map((job) => oneOf({ job }, "job", JOBS)));
  return Object.freeze({
    familyId: text(row, "family_id"),
    displayName: text(row, "display_name"),
    fullYear: flag(row, "full_year"),
    counts,
    aboveLowestJobs,
    // The indoor-cleaning figures the planning screen showed before there were four rotas.
    weeks: counts.indoor_cleaning,
    aboveLowest: aboveLowestJobs.includes("indoor_cleaning"),
  });
}

function weekRefs(value: unknown): readonly RotaWeekRef[] {
  return Object.freeze(
    asRows(value).map((row) => {
      const reason = optionalText(row, "reason");
      return Object.freeze({
        weekStart: text(row, "week_start"),
        job: oneOf(row, "job", JOBS),
        ...(reason ? { reason } : {}),
      });
    }),
  );
}

/** Each Monday once, in the order the rows came. */
function distinctWeekStarts(refs: readonly RotaWeekRef[]): readonly string[] {
  return Object.freeze([...new Set(refs.map((ref) => ref.weekStart))]);
}

function toFlaggedWeek(row: Row): RotaFlaggedWeek {
  return Object.freeze({
    weekStart: text(row, "week_start"),
    job: oneOf(row, "job", JOBS),
    familyId: text(row, "family_id"),
    familyDisplayName: text(row, "family_display_name"),
    reason: oneOf(row, "reason", HOLD_REASONS),
  });
}

function toClashWeek(row: Row): RotaClashWeek {
  const jobs = row.jobs === undefined ? undefined : asJobs(row.jobs);
  return Object.freeze({
    weekStart: text(row, "week_start"),
    familyId: text(row, "family_id"),
    familyDisplayName: text(row, "family_display_name"),
    ...(jobs ? { jobs } : {}),
  });
}

function asJobs(value: unknown): readonly RotaJob[] {
  if (!Array.isArray(value)) throw malformedResponse();
  return Object.freeze(value.map((job) => oneOf({ job }, "job", JOBS)));
}

function toPlan(envelope: Envelope): RotaPlanModel {
  const year = optionalRow(envelope, "school_year");
  const plan = optionalRow(envelope, "plan");
  const weekCount = optionalInteger(envelope, "week_count");
  const blockers = optionalRow(envelope, "blockers");
  const warnings = optionalRow(envelope, "warnings");
  const emptyRows = blockers ? weekRefs(blockers.empty_weeks) : Object.freeze([]);
  const breakRows = blockers ? weekRefs(blockers.break_weeks) : Object.freeze([]);
  const ineligibleRows = blockers ? weekRefs(blockers.ineligible_weeks) : Object.freeze([]);
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
      emptyWeeks: distinctWeekStarts(emptyRows),
      breakWeeks: distinctWeekStarts(breakRows),
      ineligibleWeeks: distinctWeekStarts(ineligibleRows),
      emptyRows,
      breakRows,
      ineligibleRows,
      flaggedWeeks: Object.freeze(
        blockers?.flagged_weeks === undefined
          ? []
          : asRows(blockers.flagged_weeks).map(toFlaggedWeek),
      ),
      clashWeeks: Object.freeze(
        blockers?.clash_weeks === undefined ? [] : asRows(blockers.clash_weeks).map(toClashWeek),
      ),
    }),
    warnings: Object.freeze({
      twoJobs: Object.freeze(
        warnings?.two_jobs === undefined ? [] : asRows(warnings.two_jobs).map(toClashWeek),
      ),
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
    job: oneOf(row, "job", JOBS),
    weekStart: text(row, "week_start"),
    isBreak: flag(row, "is_break"),
    ...(familyId ? { familyId } : {}),
    ...(familyDisplayName ? { familyDisplayName } : {}),
    // A week with no rota row has no family to compare, so the database's own flag is null there.
    isOwn: row.is_own === null || row.is_own === undefined ? false : flag(row, "is_own"),
    ...(dutyId ? { dutyId } : {}),
  });
}

function toWeekendItem(row: Row): WeekendOverviewItem {
  const familyId = optionalText(row, "family_id");
  const familyDisplayName = optionalText(row, "family_display_name");
  const dutyId = optionalText(row, "duty_id");
  return Object.freeze({
    weekStart: text(row, "week_start"),
    slot: oneOf(row, "slot", SLOTS),
    ...(familyId ? { familyId } : {}),
    ...(familyDisplayName ? { familyDisplayName } : {}),
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
    weekendItems: Object.freeze(asRows(envelope.weekend_items).map(toWeekendItem)),
  });
}

function toFreeSlot(row: Row): WeekendFreeSlot {
  return Object.freeze({
    slot: oneOf(row, "slot", SLOTS),
    dutyId: text(row, "duty_id"),
    placeVersion: integer(row, "place_version"),
  });
}

function toWeekendState(row: Row): WeekendStateModel {
  const weekendFamily = optionalText(row, "weekend_family_display_name");
  return Object.freeze({
    weekStart: text(row, "week_start"),
    picksCloseAt: text(row, "picks_close_at"),
    changeUntil: text(row, "change_until"),
    ...(weekendFamily ? { weekendFamilyDisplayName: weekendFamily } : {}),
    slots: Object.freeze(
      asRows(row.slots).map((slot) => {
        const holder = optionalText(slot, "holder_family_display_name");
        return Object.freeze({
          slot: oneOf(slot, "slot", SLOTS),
          dutyId: text(slot, "duty_id"),
          placeVersion: integer(slot, "place_version"),
          ...(holder ? { holderFamilyDisplayName: holder } : {}),
          heldByWeekendFamily: flag(slot, "held_by_weekend_family"),
          picked: flag(slot, "picked"),
        });
      }),
    ),
    pickers: Object.freeze(
      asRows(row.pickers).map((picker) => {
        const family = optionalText(picker, "family_display_name");
        const slot = optionalSlot(picker, "slot");
        return Object.freeze({
          job: oneOf(picker, "job", PICKING_JOBS),
          ...(family ? { familyDisplayName: family } : {}),
          state: oneOf(picker, "state", PICK_STATES),
          ...(slot ? { slot } : {}),
        });
      }),
    ),
  });
}

function toOwnPick(row: Row): WeekendOwnPickModel {
  const slot = optionalSlot(row, "slot");
  return Object.freeze({
    rotaWeekId: text(row, "rota_week_id"),
    state: oneOf(row, "state", PICK_STATES),
    ...(slot ? { slot } : {}),
    canPick: flag(row, "can_pick"),
    freeSlots: Object.freeze(asRows(row.free_slots).map(toFreeSlot)),
    picksCloseAt: text(row, "picks_close_at"),
    changeUntil: text(row, "change_until"),
  });
}

function toDutyCard(envelope: Envelope): RotaDutyCardModel {
  const item = asRow(envelope.item);
  const slot = optionalSlot(item, "slot");
  const day =
    item.day == null ? undefined : oneOf(item, "day", ["saturday", "sunday", "weekend"] as const);
  const partOfDay =
    item.part_of_day == null
      ? undefined
      : oneOf(item, "part_of_day", ["morning", "evening", "all_day"] as const);
  const weekend = item.weekend == null ? undefined : toWeekendState(asRow(item.weekend));
  const ownPick = item.own_pick == null ? undefined : toOwnPick(asRow(item.own_pick));
  return Object.freeze({
    dutyId: text(item, "duty_id"),
    job: oneOf(item, "job", JOBS),
    ...(slot ? { slot } : {}),
    title: text(item, "title"),
    familyDisplayName: text(item, "family_display_name"),
    weekStart: text(item, "week_start"),
    weekEnd: text(item, "week_end"),
    noFixedDay: flag(item, "no_fixed_day"),
    isBreakWeek: flag(item, "is_break_week"),
    includesWatering: flag(item, "includes_watering"),
    bottlesAtWeekEnd: flag(item, "bottles_at_week_end"),
    infoLinks: Object.freeze(
      asRows(item.info_links ?? []).map((row) =>
        Object.freeze({ key: text(row, "key"), title: text(row, "title") }),
      ),
    ),
    ...(day ? { day } : {}),
    ...(partOfDay ? { partOfDay } : {}),
    ...(weekend ? { weekend } : {}),
    ...(ownPick ? { ownPick } : {}),
  });
}

function toUnpickedItem(row: Row): UnpickedItem {
  const closes = optionalText(row, "picks_close_at");
  const change = optionalText(row, "change_until");
  return Object.freeze({
    rotaWeekId: text(row, "rota_week_id"),
    job: oneOf(row, "job", PICKING_JOBS),
    weekStart: text(row, "week_start"),
    familyDisplayName: text(row, "family_display_name"),
    weekendFamilyDisplayName: text(row, "weekend_family_display_name"),
    ...(closes ? { picksCloseAt: closes } : {}),
    ...(change ? { changeUntil: change } : {}),
    freeSlots: Object.freeze(
      row.free_slots === undefined ? [] : asRows(row.free_slots).map(toFreeSlot),
    ),
  });
}

function toUnpickedList(envelope: Envelope): UnpickedListModel {
  return Object.freeze({
    items: Object.freeze(asRows(envelope.items).map(toUnpickedItem)),
    missed: Object.freeze(asRows(envelope.missed).map(toUnpickedItem)),
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
      const outcome = toOutcome(envelope, toPlan);
      if (outcome.state !== "success" || outcome.data.plan?.status !== "published") return outcome;
      // A published plan: add the duty and place version behind each week, so the page can hand a week over.
      const duties = await gateway.call("rota_week_duties", {
        p_school_year_id: schoolYearId ?? null,
      });
      if (duties.state !== "success") return outcome;
      const byWeek = new Map(
        asRows(duties.items).map((row) => [text(row, "week_id"), row] as const),
      );
      return {
        ...outcome,
        data: Object.freeze({
          ...outcome.data,
          weeks: Object.freeze(
            outcome.data.weeks.map((week) => {
              const row = byWeek.get(week.id);
              return row
                ? Object.freeze({
                    ...week,
                    dutyId: text(row, "duty_id"),
                    placeVersion: integer(row, "place_version"),
                  })
                : week;
            }),
          ),
        }),
      };
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
    setStanding: ({ idempotencyKey, familyId, schoolYearId, standing, expectedVersion }) =>
      command(
        "family_standing_set",
        {
          p_idempotency_key: idempotencyKey,
          p_family_id: familyId,
          p_school_year_id: schoolYearId,
          p_standing: standing,
          p_expected_version: expectedVersion,
        },
        idempotencyKey,
      ),
    pickSlot: ({ idempotencyKey, rotaWeekId, slot, expectedVersion }) =>
      command(
        "weekend_pick_set",
        {
          p_idempotency_key: idempotencyKey,
          p_rota_week_id: rotaWeekId,
          p_slot: slot,
          p_expected_version: expectedVersion,
        },
        idempotencyKey,
      ),
    assignSlot: ({ idempotencyKey, rotaWeekId, slot, expectedVersion }) =>
      command(
        "weekend_pick_assign",
        {
          p_idempotency_key: idempotencyKey,
          p_rota_week_id: rotaWeekId,
          p_slot: slot,
          p_expected_version: expectedVersion,
        },
        idempotencyKey,
      ),
    async unpickedList() {
      return toOutcome(await gateway.call("weekend_unpicked_list", {}), toUnpickedList);
    },
  };
}
