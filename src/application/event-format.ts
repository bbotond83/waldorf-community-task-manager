import type { Scope } from "../access/index.ts";
import { isoToBudapestLocal } from "./budapest-time.ts";
import type { FoodCategory, SessionContext } from "./contracts.ts";
import { formatLongDay, weekdayName } from "./rota-format.ts";

/** "2026. december 5., szombat" for a stored instant (Budapest time); the text itself when it is not a date. */
export function formatEventDay(iso: string): string {
  const local = isoToBudapestLocal(iso);
  if (local === "") return iso;
  const day = local.slice(0, 10);
  return `${formatLongDay(day)}, ${weekdayName(day)}`;
}

/** "10:00" for a stored instant (Budapest time); empty text when it is not a date. */
export function formatEventTime(iso: string): string {
  const local = isoToBudapestLocal(iso);
  return local === "" ? "" : local.slice(11, 16);
}

/**
 * The day and hours of an event on one line: "2026. december 5., szombat • 10:00–16:00", or both ends in full when it
 * runs past midnight.
 */
export function formatEventRange(startsAt: string, endsAt: string): string {
  const startDay = isoToBudapestLocal(startsAt).slice(0, 10);
  const endDay = isoToBudapestLocal(endsAt).slice(0, 10);
  if (startDay === endDay) {
    return `${formatEventDay(startsAt)} • ${formatEventTime(startsAt)}–${formatEventTime(endsAt)}`;
  }
  return `${formatEventDay(startsAt)} ${formatEventTime(startsAt)} – ${formatEventDay(endsAt)} ${formatEventTime(endsAt)}`;
}

/** A sign-up deadline (a calendar day, YYYY-MM-DD) as "2026. december 1.". */
export function formatDeadline(day: string): string {
  return formatLongDay(day);
}

export const FOOD_CATEGORY_LABELS: Readonly<Record<FoodCategory, string>> = Object.freeze({
  spreads: "Kenyérre való kenhető",
  bread: "Kenyér és pékáru",
  free_from: "Mentes ételek",
  savoury: "Sós finomságok",
  sweet: "Édes sütemények",
  drinks: "Italok",
  vegetables_fruit: "Zöldség és gyümölcs",
  other: "Egyéb",
});

/** The three ingredient ticks of a food offer, in the order the form and the list show them. */
export const FOOD_INGREDIENTS = Object.freeze([
  { field: "hasMilk", label: "Tej" },
  { field: "hasEgg", label: "Tojás" },
  { field: "hasGarlic", label: "Fokhagyma" },
] as const);

/** The ingredient words of an offer ("Tej, tojás"), or empty text when it ticks none. */
export function ingredientWords(offer: {
  hasMilk: boolean;
  hasEgg: boolean;
  hasGarlic: boolean;
}): string {
  const words = FOOD_INGREDIENTS.filter((item) => offer[item.field]).map((item) =>
    item.label.toLowerCase(),
  );
  const joined = words.join(", ");
  return joined === "" ? "" : `${joined.charAt(0).toUpperCase()}${joined.slice(1)}`;
}

/** The role name a role holder is shown under: a removed person's role reads "korábbi tag" (BR105.1). */
export const FORMER_HOLDER_TEXT = "korábbi tag";

/**
 * The scope a manager's command is sent with: a super admin's own scope for any event, a group administrator's
 * grant for the event's own group. With no fitting grant the caller's own scope is returned and the database
 * refuses the command (the screens do not offer it).
 */
export function manageScopeFor(
  session: SessionContext,
  fallback: Scope,
  groupId: string | undefined,
): Scope {
  const live = session.grants.filter((grant) => grant.revokedAt === undefined);
  const superGrant = live.find((grant) => grant.role === "super_admin");
  if (superGrant) return superGrant.scope;
  if (groupId !== undefined) {
    const groupGrant = live.find(
      (grant) => grant.role === "group_admin" && grant.scope.id === groupId,
    );
    if (groupGrant) return groupGrant.scope;
  }
  return fallback;
}

/** The text of an event notices field as lines (blank lines dropped, each trimmed). */
export function noticeLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
}
