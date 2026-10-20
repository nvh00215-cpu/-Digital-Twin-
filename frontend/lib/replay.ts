/** Decision times the API accepts in `at`. 5-minute series from 2026-01-05, scored every 30 minutes. */

const FIRST_INDEX = 72;
const LAST_INDEX = 4002;
const STEP = 6;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function stampAtIndex(index: number) {
  const totalMinutes = index * 5;
  const dayOffset = Math.floor(totalMinutes / 1440);
  const minuteOfDay = totalMinutes % 1440;
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  return `2026-01-${pad(5 + dayOffset)}T${pad(hour)}:${pad(minute)}:00`;
}

export const DECISION_STAMPS: string[] = Array.from(
  { length: (LAST_INDEX - FIRST_INDEX) / STEP + 1 },
  (_, position) => stampAtIndex(FIRST_INDEX + position * STEP),
);

export function decisionIndex(stamp: string | null) {
  if (!stamp) return DECISION_STAMPS.length - 1;
  const found = DECISION_STAMPS.indexOf(stamp);
  return found >= 0 ? found : DECISION_STAMPS.length - 1;
}
