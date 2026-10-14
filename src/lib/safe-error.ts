/**
 * A loggable one-liner for errors from google-auth-library/gaxios. Those errors
 * carry the original token request – including refresh tokens, auth codes and
 * PKCE verifiers – so they must never be logged or re-thrown as they are.
 */
export function describeOAuthError(error: unknown): string {
  const status = (error as { response?: { status?: number } })?.response?.status;
  const code = (error as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
  const parts = [typeof code === "string" ? code : error instanceof Error ? error.name : "unknown error"];
  if (status) parts.push(`HTTP ${status}`);
  return parts.join(", ");
}
