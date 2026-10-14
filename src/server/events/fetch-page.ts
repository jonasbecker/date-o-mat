// Fetches an event source page – carefully, because the URL was typed in by a person.
import "server-only";
import { lookup } from "node:dns/promises";
import { isPrivateAddress, parseSourceUrl } from "@/lib/url-safety";
import { env } from "@/server/env";

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 15_000;
const USER_AGENT = "Mozilla/5.0 (compatible; Date-O-Mat/1.0; private date planner for two people)";

export class FetchPageError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
  }
}

/** Rejects hosts that resolve to the internal network (checked again on every redirect). */
async function assertPublic(url: URL): Promise<void> {
  if (env().allowPrivateEventUrls) return;
  const addresses = await lookup(url.hostname, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new FetchPageError("Adresse nicht gefunden");
  if (addresses.some((a) => isPrivateAddress(a.address))) throw new FetchPageError("Adresse nicht erlaubt");
}

async function readLimited(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      break; // the start of a huge page is enough
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
}

/** Returns the HTML and the final URL (after redirects). */
export async function fetchPage(input: string): Promise<{ html: string; url: string }> {
  const allowPrivate = env().allowPrivateEventUrls;
  const first = parseSourceUrl(input, allowPrivate);
  if (!first) throw new FetchPageError("Ungültige Adresse");
  let url: URL = first;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(url);
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml", "accept-language": "de-DE,de;q=0.9" },
      });
    } catch (error) {
      throw new FetchPageError(error instanceof Error && error.name === "TimeoutError" ? "Zeitüberschreitung" : "Seite nicht erreichbar");
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      const next: URL | null = location ? parseSourceUrl(new URL(location, url).toString(), allowPrivate) : null;
      if (!next) throw new FetchPageError("Weiterleitung nicht erlaubt");
      url = next;
      continue;
    }
    if (!response.ok) throw new FetchPageError(`HTTP ${response.status}`);
    const type = response.headers.get("content-type") ?? "";
    if (!/html|xml|text\/plain/i.test(type)) throw new FetchPageError("Keine Webseite");
    return { html: await readLimited(response), url: url.toString() };
  }
  throw new FetchPageError("Zu viele Weiterleitungen");
}
