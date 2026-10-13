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
