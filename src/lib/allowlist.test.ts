import { describe, expect, it } from "vitest";
import { isEmailAllowed, isPushEndpointAllowed, parseAllowlist } from "./allowlist";

describe("allowlist", () => {
  const list = parseAllowlist(" Jonas@Gmail.com, partnerin@gmail.com ,, ");

  it("normalizes case and whitespace", () => {
    expect([...list]).toEqual(["jonas@gmail.com", "partnerin@gmail.com"]);
  });

  it("allows listed addresses regardless of case", () => {
    expect(isEmailAllowed("JONAS@gmail.com", list)).toBe(true);
    expect(isEmailAllowed("partnerin@gmail.com", list)).toBe(true);
  });

  it("rejects everybody else", () => {
    expect(isEmailAllowed("stranger@gmail.com", list)).toBe(false);
    expect(isEmailAllowed("", list)).toBe(false);
  });
});

describe("isPushEndpointAllowed", () => {
  it("accepts the browsers' push services", () => {
    for (const endpoint of [
      "https://fcm.googleapis.com/fcm/send/abc:def",
      "https://web.push.apple.com/QGuQyavXutnMH",
      "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
    ]) {
      expect(isPushEndpointAllowed(endpoint), endpoint).toBe(true);
    }
  });

  it("rejects everything else", () => {
    for (const endpoint of [
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://fcm.googleapis.com:8443/x",
      "https://169.254.169.254/latest",
      "https://localhost/push",
      "https://10.0.0.5/admin",
      "https://evil.com/fcm.googleapis.com",
      "https://fcm.googleapis.com.evil.com/x",
      "https://user:pw@fcm.googleapis.com/x",
      "file:///etc/passwd",
      "not a url",
    ]) {
      expect(isPushEndpointAllowed(endpoint), endpoint).toBe(false);
    }
  });
});
