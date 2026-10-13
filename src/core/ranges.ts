// Time ranges as epoch milliseconds, end exclusive: [start, end).

export type TimeRange = { start: number; end: number };

/** Sorts and merges overlapping or touching ranges. */
export function mergeRanges(ranges: TimeRange[]): TimeRange[] {
  const sorted = ranges.filter((r) => r.end > r.start).sort((a, b) => a.start - b.start);
  const merged: TimeRange[] = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

/** Grows every range by `padding` ms on both sides (the buffer around appointments). */
export function padRanges(ranges: TimeRange[], padding: number): TimeRange[] {
  return ranges.map((r) => ({ start: r.start - padding, end: r.end + padding }));
}

/** The parts of `window` not covered by `blocked` (which must be merged and sorted). */
export function subtractRanges(window: TimeRange, blocked: TimeRange[]): TimeRange[] {
  const free: TimeRange[] = [];
  let cursor = window.start;
  for (const busy of blocked) {
    if (busy.end <= cursor) continue;
    if (busy.start >= window.end) break;
    if (busy.start > cursor) free.push({ start: cursor, end: Math.min(busy.start, window.end) });
    cursor = Math.max(cursor, busy.end);
    if (cursor >= window.end) break;
  }
  if (cursor < window.end) free.push({ start: cursor, end: window.end });
  return free;
}
