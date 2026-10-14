import { describe, expect, it } from "vitest";
import { describeOAuthError } from "./safe-error";

describe("describeOAuthError", () => {
  it("keeps only the OAuth error code and status", () => {
    const error = Object.assign(new Error("invalid_client"), {
      config: { body: "refresh_token=SECRET123&client_id=x" },
      response: { status: 401, data: { error: "invalid_client" } },
    });
    const text = describeOAuthError(error);
    expect(text).toBe("invalid_client, HTTP 401");
    expect(text).not.toContain("SECRET123");
  });

  it("falls back to the error name for network errors", () => {
    expect(describeOAuthError(new TypeError("fetch failed: refresh_token=SECRET"))).toBe("TypeError");
    expect(describeOAuthError("weird")).toBe("unknown error");
  });
});
