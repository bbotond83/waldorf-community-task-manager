/** The words and dates of the library pages (U13). Dates arrive as `YYYY-MM-DD`; nothing here reads a clock but `budapestToday`. */

/** The date as the community writes it: `2026. 12. 01.`. Anything that is not a plain date is returned as it came. */
export function formatLibraryDate(value: string | undefined): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[1]}. ${match[2]}. ${match[3]}.` : value;
}

/** Today's date in Budapest, as `YYYY-MM-DD` (the date a return date is compared with). */
export function budapestToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Budapest" }).format(now);
}

/** Whether a return date has passed: a book is late the day after its date, never on the day itself. */
export function isOverdue(until: string | undefined, today: string): boolean {
  return until !== undefined && /^\d{4}-\d{2}-\d{2}/.test(until) && until.slice(0, 10) < today;
}

/** The latest return date the form offers: one year from today, the same limit the database applies (VAL-TOO-FAR). */
export function latestReturnDate(today: string): string {
  const year = Number(today.slice(0, 4)) + 1;
  const rest = today.slice(4) === "-02-29" ? "-02-28" : today.slice(4);
  return `${year}${rest}`;
}
