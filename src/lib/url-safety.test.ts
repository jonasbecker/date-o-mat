import { describe, expect, it } from "vitest";
import { isPrivateAddress, parseSourceUrl } from "./url-safety";

describe("isPrivateAddress", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "nonsense"])(
    "%s is private",
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );
  it.each(["8.8.8.8", "172.32.0.1", "2a00:1450:4001::200e", "::ffff:8.8.8.8"])("%s is public", (ip) => expect(isPrivateAddress(ip)).toBe(false));
});

describe("parseSourceUrl", () => {
  it("adds https and drops the #fragment", () => {
    expect(parseSourceUrl("rausgegangen.de/cologne/#top")?.toString()).toBe("https://rausgegangen.de/cologne/");
  });
  it.each(["http://example.com", "https://localhost/x", "https://127.0.0.1/", "https://example.com:8443/", "https://user:pw@example.com/", "ftp://example.com", "https://intranet/", "https://printer.local/"])(
    "rejects %s",
    (url) => expect(parseSourceUrl(url)).toBeNull(),
  );
  it("test mode allows localhost over http", () => {
    expect(parseSourceUrl("http://localhost:4040/events", true)?.toString()).toBe("http://localhost:4040/events");
  });
});
