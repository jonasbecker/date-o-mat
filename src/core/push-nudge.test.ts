import { describe, expect, it } from "vitest";
import { deniedHelp, PARTNER_ROW_SNOOZE_MS, pushRow } from "./push-nudge";

const NOW = 1_800_000_000_000;
const base = { configured: true, myDevices: 1, partnerDevices: 1, partnerSnoozedAt: null, now: NOW };

describe("pushRow", () => {
  it("asks me until a device of mine is registered", () => {
    expect(pushRow({ ...base, myDevices: 0 })).toBe("mine");
    expect(pushRow({ ...base, myDevices: 0, partnerDevices: 0 })).toBe("mine");
  });

  it("shows nothing when everyone is set up", () => {
    expect(pushRow(base)).toBeNull();
  });

  it("tells me when the other person has no device", () => {
    expect(pushRow({ ...base, partnerDevices: 0 })).toBe("partner");
  });

  it("lets the partner row be snoozed for a week, then it comes back", () => {
    expect(pushRow({ ...base, partnerDevices: 0, partnerSnoozedAt: NOW - 86_400_000 })).toBeNull();
    expect(pushRow({ ...base, partnerDevices: 0, partnerSnoozedAt: NOW - PARTNER_ROW_SNOOZE_MS })).toBe("partner");
  });

  it("never snoozes my own row", () => {
    expect(pushRow({ ...base, myDevices: 0, partnerSnoozedAt: NOW })).toBe("mine");
  });

  it("stays quiet when the server has no push keys", () => {
    expect(pushRow({ ...base, configured: false, myDevices: 0 })).toBeNull();
  });
});

describe("deniedHelp", () => {
  it("knows iPhones, also iPadOS posing as a Mac", () => {
    expect(deniedHelp("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)").where).toBe("ios");
    expect(deniedHelp("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5).where).toBe("ios");
  });

  it("knows Android and falls back to the desktop browser", () => {
    expect(deniedHelp("Mozilla/5.0 (Linux; Android 14; Pixel 8)").where).toBe("android");
    expect(deniedHelp("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0).where).toBe("desktop");
  });

  it("always gives steps to follow", () => {
    for (const ua of ["iPhone", "Android", "Windows"]) expect(deniedHelp(ua).steps.length).toBeGreaterThanOrEqual(3);
  });
});
