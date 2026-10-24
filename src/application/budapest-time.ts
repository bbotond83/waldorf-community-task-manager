/**
 * Times on the admin forms are written and read in the school's own time, Budapest, while the database
 * keeps instants. These two functions convert between a form value (`YYYY-MM-DDTHH:mm`, what a
 * datetime-local field holds) and an ISO instant with the offset of that day, summer time included.
 */
const ZONE = "Europe/Budapest";

const FORM_VALUE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function localParts(instantMs: number): [number, number, number, number, number] {
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(instantMs)).map((part) => [part.type, part.value]),
  );
  return [
    Number(parts.year),
    Number(parts.month),
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
  ];
}

/** How many minutes Budapest is ahead of UTC at the given instant (60 in winter, 120 in summer). */
function offsetMinutes(instantMs: number): number {
  const [year, month, day, hour, minute] = localParts(instantMs);
  return (Date.UTC(year, month - 1, day, hour, minute) - instantMs) / 60_000;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * The instant (ISO, UTC) of a Budapest wall-clock value, or undefined when the text is not a date and time
 * or names a time that does not exist (the hour skipped when the clocks go forward).
 */
export function budapestLocalToIso(value: string): string | undefined {
  const match = FORM_VALUE.exec(value.trim());
  if (!match) return undefined;
  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  if (Number.isNaN(naive)) return undefined;
  // The offset depends on the instant itself, so it is found in two steps around the change of clocks.
  const first = naive - offsetMinutes(naive) * 60_000;
  const instant = naive - offsetMinutes(first) * 60_000;
  const [y, mo, d, h, mi] = localParts(instant);
  const roundTrips = y === year && mo === month && d === day && h === hour && mi === minute;
  return roundTrips ? new Date(instant).toISOString() : undefined;
}

/** The form value (`YYYY-MM-DDTHH:mm`, Budapest) of a stored instant; empty text when it is not a date. */
export function isoToBudapestLocal(iso: string | undefined): string {
  if (iso === undefined) return "";
  const instant = Date.parse(iso);
  if (Number.isNaN(instant)) return "";
  const [year, month, day, hour, minute] = localParts(instant);
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}
