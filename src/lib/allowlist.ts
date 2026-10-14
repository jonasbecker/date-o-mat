/** Parses the comma-separated ALLOWED_EMAILS value into a normalized set. */
export function parseAllowlist(value: string): Set<string> {
  return new Set(
    value
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isEmailAllowed(email: string, allowlist: Set<string>): boolean {
  return allowlist.has(email.trim().toLowerCase());
}

// The push services of the browsers we support. Anything else would let a
// stored "subscription" make the server POST to arbitrary hosts.
const PUSH_HOSTS = ["fcm.googleapis.com", "android.googleapis.com", "web.push.apple.com"];
const PUSH_HOST_SUFFIXES = [".push.services.mozilla.com", ".notify.windows.com", ".push.apple.com"];

export function isPushEndpointAllowed(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port !== "" || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOSTS.includes(host) || PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}
