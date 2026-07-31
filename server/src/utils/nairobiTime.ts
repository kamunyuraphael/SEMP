// nairobiTime.ts
// Kenya (Africa/Nairobi, EAT) is a fixed UTC+3 with no DST — so unlike
// most timezones, its offset never changes and doesn't need a full
// timezone library to compute correctly.
//
// This matters because Render (and most Node hosts) run containers in
// UTC by default. Naively doing `new Date(); d.setHours(0,0,0,0)` computes
// "midnight" in the SERVER's timezone, not the user's — so "today" on the
// server can silently mean a ~3-hour-shifted window from what a Nairobi
// user actually means by "today," occasionally landing on the wrong side
// of a data gap and returning an empty result even though data exists.

const NAIROBI_OFFSET_MINUTES = 180; // UTC+3

/** Nairobi calendar date (YYYY-MM-DD) for "right now", regardless of the server's own timezone. */
export function nairobiTodayLabel(): string {
  const shifted = new Date(Date.now() + NAIROBI_OFFSET_MINUTES * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Resolve the [start, end) UTC instants for a Nairobi calendar day.
 * Accepts a "YYYY-MM-DD" date (interpreted as a Nairobi calendar date,
 * not UTC) or defaults to Nairobi's current day if omitted.
 */
export function nairobiDayRange(dateLabel?: string): { dayStart: Date; dayEnd: Date; dateLabel: string } {
  const label = dateLabel && /^\d{4}-\d{2}-\d{2}$/.test(dateLabel) ? dateLabel : nairobiTodayLabel();
  const dayStart = new Date(`${label}T00:00:00+03:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  return { dayStart, dayEnd, dateLabel: label };
}
