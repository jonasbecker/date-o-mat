// "iPhone · Safari": which phone and browser an error came from (from the User-Agent) – short, for the status.

export function deviceLabel(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  const ua = userAgent;
  const device = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Macintosh/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : null;
  // Order matters: Chrome's UA also says Safari, Edge's also says Chrome; on iOS every browser is Safari underneath.
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /CriOS|Chrome\//.test(ua)
      ? "Chrome"
      : /FxiOS|Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua) || /AppleWebKit/.test(ua)
          ? "Safari"
          : null;
  return [device, browser].filter(Boolean).join(" · ") || null;
}
