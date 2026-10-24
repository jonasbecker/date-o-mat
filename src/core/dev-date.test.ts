import { describe, expect, it } from "vitest";
import { devDateStart } from "./dev-date";

const berlin = (iso: string) => new Date(`${iso}+02:00`);

describe("devDateStart", () => {
  const farEnd = berlin("2026-10-31T00:00:00");

  it("takes this evening at 19:00 when it is two hours away", () => {
    expect(devDateStart(berlin("2026-10-20T10:00:00"), farEnd)).toEqual(berlin("2026-10-20T19:00:00"));
    expect(devDateStart(berlin("2026-10-20T17:00:00"), farEnd)).toEqual(berlin("2026-10-20T19:00:00"));
  });

  it("else tomorrow evening", () => {
    expect(devDateStart(berlin("2026-10-20T17:30:00"), farEnd)).toEqual(berlin("2026-10-21T19:00:00"));
  });

  it("stays inside the round: in two hours, on the hour", () => {
    expect(devDateStart(berlin("2026-10-20T20:15:00"), berlin("2026-10-21T06:00:00"))).toEqual(berlin("2026-10-20T23:00:00"));
  });
});
