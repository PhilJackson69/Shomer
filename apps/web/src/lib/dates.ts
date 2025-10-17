/**
 * Date utility functions for CSV export
 */

/**
 * Parse a date-only string (YYYY-MM-DD) to UTC day start/end range
 */
export function parseDateOnlyToUtcRange(dateOnly: string): { start: Date; end: Date } {
  const date = new Date(dateOnly + 'T00:00:00.000Z');
  const start = new Date(date);
  const end = new Date(date);
  end.setUTCDate(end.getUTCDate() + 1);
  end.setUTCMilliseconds(end.getUTCMilliseconds() - 1);
  
  return { start, end };
}

/**
 * Get default 14-day window around today (UTC)
 * from = today-7d 00:00Z, to = today+7d 23:59:59Z
 */
export function defaultWindowUtc(): { from: Date; to: Date } {
  const today = new Date();
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - 7);
  from.setUTCHours(0, 0, 0, 0);
  
  const to = new Date(today);
  to.setUTCDate(to.getUTCDate() + 7);
  to.setUTCHours(23, 59, 59, 999);
  
  return { from, to };
}

/**
 * Parse date parameter - accepts either YYYY-MM-DD or ISO string
 */
export function parseDateParam(dateParam: string | null): Date | null {
  if (!dateParam) return null;
  
  // If it's just YYYY-MM-DD, treat as UTC
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return new Date(dateParam + 'T00:00:00.000Z');
  }
  
  // Otherwise parse as ISO string
  const date = new Date(dateParam);
  return isNaN(date.getTime()) ? null : date;
}
