const DAY_MS = 24 * 60 * 60 * 1000;

const shortDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

export function formatSprintDateRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  const from = start ? shortDate.format(new Date(start)) : '—';
  const to = end ? shortDate.format(new Date(end)) : '—';
  return `${from} – ${to}`;
}

/** Whole days until the end date (negative when overdue), or null without an end date. */
export function daysRemaining(end: string | null, now = new Date()): number | null {
  if (!end) return null;
  return Math.ceil((new Date(end).getTime() - now.getTime()) / DAY_MS);
}

/** ISO timestamp → value for <input type="date"> in local time. */
export function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * <input type="date"> value → ISO timestamp at 12:00 UTC, or undefined when empty.
 * Midday UTC keeps the same calendar day for every timezone between UTC−11 and UTC+11, so the
 * server (which formats in UTC) and every browser agree on the date that was picked.
 */
export function fromDateInputValue(value: string): string | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toISOString();
}

export function addDaysToInputValue(value: string, days: number): string {
  const iso = fromDateInputValue(value);
  if (!iso) return '';
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return toDateInputValue(d.toISOString());
}

export type CapacityState = 'empty' | 'healthy' | 'full' | 'over';

export function capacityState(points: number, capacity: number | null): CapacityState {
  if (!capacity) return points > 0 ? 'healthy' : 'empty';
  const ratio = points / capacity;
  if (ratio > 1) return 'over';
  if (ratio >= 0.9) return 'full';
  return points > 0 ? 'healthy' : 'empty';
}
