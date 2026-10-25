/**
 * The calendar day `offset` days from today as `YYYY-MM-DD`. The seed places its tasks a number of days from the start
 * of the database's day (UTC): the cleaning task of the first group on day 7, the two tasks of its event on day 10, all
 * between 10:00 and 18:00 UTC, so the same date shows in Budapest. The specs name days relative to today and hold on
 * any date.
 */
export function seedDay(offset: number, now: Date = new Date()): string {
  return new Date(now.getTime() + offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** The day of the seeded cleaning task of the first group and the day of its event's tasks. */
export const CLEANING_DAY = 7;
export const EVENT_DAY = 10;
