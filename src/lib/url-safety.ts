// Guards for fetching user-entered URLs on the server (event sources), so the
// server cannot be pointed at itself or the internal network (SSRF).

import { isIP } from "node:net";

/** Loopback, private, link-local, CGNAT, multicast, reserved – anything not on the public internet. */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (version === 6) {
    const lower = address.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return isPrivateAddress(mapped[1]);
    return (
      lower === "::" || lower === "::1" ||
      /^f[cd]/.test(lower) || // unique local
      /^fe[89ab]/.test(lower) || // link-local
      /^ff/.test(lower) || // multicast
      lower.startsWith("64:ff9b:") || lower.startsWith("2001:db8:")
    );
  }
  return true; // not an IP at all → treat as unsafe
}

/** Normalizes a source URL typed by a person; only public https URLs on the default port. */
export function parseSourceUrl(input: string, allowPrivate = false): URL | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 500) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  url.hash = "";
  if (allowPrivate) return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  if (url.protocol !== "https:" || url.port || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (!host.includes(".") || host.endsWith(".local") || host.endsWith(".internal") || host === "localhost") return null;
  if (isIP(host.replace(/^\[|\]$/g, ""))) return null; // no raw IPs
  return url;
}
