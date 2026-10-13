// Form handling for the slot finder settings. Pure, so it is unit-tested.

export const SLOT_OPTIONS = {
  smallDurationMinutes: [60, 90, 120, 150, 180],
  largeMinDurationMinutes: [180, 240, 300, 360, 420],
  minLeadHours: [2, 4, 8, 12, 24, 48],
  bufferMinutes: [0, 15, 30, 45, 60],
  horizonDays: [7, 14, 21, 28],
} as const;

export type SlotSettingsValues = {
  smallDurationMinutes: number;
  smallStartFromMinute: number;
  smallStartUntilMinute: number;
  largeMinDurationMinutes: number;
  largeStartFromMinute: number;
  largeStartUntilMinute: number;
  latestEndMinute: number;
  minLeadHours: number;
  bufferMinutes: number;
  horizonDays: number;
};

export type SlotSettingsErrors = Partial<Record<keyof SlotSettingsValues | "form", string>>;

/** 600 → "10:00" */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "10:00" → 600, invalid → null */
export function timeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [h, m] = [Number(match[1]), Number(match[2])];
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/** "90" → "1,5 Std.", "60" → "1 Std." */
export function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toLocaleString("de-DE")} Std.`;
}

function pick(raw: Record<string, unknown>, key: keyof typeof SLOT_OPTIONS): number | null {
  const value = Number(raw[key]);
  return (SLOT_OPTIONS[key] as readonly number[]).includes(value) ? value : null;
}

export function parseSlotSettings(
  raw: Record<string, unknown>,
): { ok: true; data: SlotSettingsValues } | { ok: false; errors: SlotSettingsErrors } {
  const errors: SlotSettingsErrors = {};
  const time = (key: keyof SlotSettingsValues) => {
    const minutes = timeToMinutes(String(raw[key] ?? ""));
    if (minutes === null) errors[key] = "Bitte eine Uhrzeit wählen.";
    return minutes ?? 0;
  };
  const option = (key: keyof typeof SLOT_OPTIONS) => {
    const value = pick(raw, key);
    if (value === null) errors[key] = "Bitte einen Wert aus der Liste wählen.";
    return value ?? 0;
  };

  const data: SlotSettingsValues = {
    smallDurationMinutes: option("smallDurationMinutes"),
    smallStartFromMinute: time("smallStartFromMinute"),
    smallStartUntilMinute: time("smallStartUntilMinute"),
    largeMinDurationMinutes: option("largeMinDurationMinutes"),
    largeStartFromMinute: time("largeStartFromMinute"),
    largeStartUntilMinute: time("largeStartUntilMinute"),
    latestEndMinute: time("latestEndMinute"),
    minLeadHours: option("minLeadHours"),
    bufferMinutes: option("bufferMinutes"),
    horizonDays: option("horizonDays"),
  };
  if (Object.keys(errors).length) return { ok: false, errors };

  if (data.smallStartFromMinute >= data.smallStartUntilMinute) {
    errors.smallStartUntilMinute = "„Spätestens“ muss nach „frühestens“ liegen.";
  }
  if (data.largeStartFromMinute >= data.largeStartUntilMinute) {
    errors.largeStartUntilMinute = "„Spätestens“ muss nach „frühestens“ liegen.";
  }
  // The latest end may be after midnight (e.g. 01:00) – then it is before every start.
  const afterMidnight = data.latestEndMinute <= Math.min(data.smallStartFromMinute, data.largeStartFromMinute);
  if (!afterMidnight && data.latestEndMinute < data.smallStartUntilMinute + data.smallDurationMinutes) {
    errors.latestEndMinute = "So spät endet kein kleines Date mehr – bitte später wählen.";
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };
}
