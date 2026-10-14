// Fetches pages, oEmbed JSON and preview images from addresses a person typed in
// or shared – carefully: public addresses only, small, quick.
import "server-only";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { request as httpRequest, type IncomingHttpHeaders } from "node:http";
import { request as httpsRequest } from "node:https";
import type { LookupFunction } from "node:net";
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

/**
 * DNS lookup for the connection itself: checks the addresses and hands exactly
 * those to the socket. Checking first and connecting later would let a hostile
 * DNS server answer differently the second time (DNS rebinding).
 */
function guardedLookup(allowPrivate: boolean): LookupFunction {
  return (hostname, options, callback) => {
    dnsLookup(hostname, { all: true }, (error, addresses: LookupAddress[]) => {
      if (error) return callback(error, "", 0);
      if (!allowPrivate && (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address)))) {
        return callback(Object.assign(new Error("blocked address"), { code: "EBLOCKED" }), "", 0);
      }
      if (options.all) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, addresses);
      callback(null, addresses[0].address, addresses[0].family);
    });
  };
}

type RawResponse = { status: number; headers: IncomingHttpHeaders; body: Buffer; truncated: boolean };

function get(url: URL, allowPrivate: boolean, accept: string, maxBytes: number): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const send = url.protocol === "https:" ? httpsRequest : httpRequest;
    const request = send(
      url,
      {
        method: "GET",
        lookup: guardedLookup(allowPrivate),
        headers: { "user-agent": USER_AGENT, accept, "accept-language": "de-DE,de;q=0.9" },
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        let truncated = false;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            truncated = true;
            response.destroy(); // the start of a huge page is enough
            return;
          }
          chunks.push(chunk);
        });
        const done = () => resolve({ status: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks), truncated });
        response.on("end", done);
        response.on("close", done);
        response.on("error", done);
      },
    );
    // One deadline for connecting and reading.
    const timer = setTimeout(() => request.destroy(Object.assign(new Error("timeout"), { code: "ETIMEOUT" })), TIMEOUT_MS);
    request.on("close", () => clearTimeout(timer));
    request.on("error", (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(
        new FetchPageError(
          error.code === "EBLOCKED" ? "Adresse nicht erlaubt" : error.code === "ETIMEOUT" ? "Zeitüberschreitung" : error.code === "ENOTFOUND" ? "Adresse nicht gefunden" : "Seite nicht erreichbar",
        ),
      );
    });
    request.end();
  });
}

export type PublicResponse = { body: Buffer; url: string; contentType: string };

/**
 * GET with redirects (each hop checked again). `types` must match the
 * content type; `whole` rejects responses larger than `maxBytes` instead of
 * cutting them (an image cut in half is useless).
 */
export async function fetchPublic(
  input: string,
  options: { accept: string; types: RegExp; maxBytes?: number; whole?: boolean },
): Promise<PublicResponse> {
  const allowPrivate = env().allowPrivateEventUrls;
  const first = parseSourceUrl(input, allowPrivate);
  if (!first) throw new FetchPageError("Ungültige Adresse");
  let url: URL = first;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await get(url, allowPrivate, options.accept, options.maxBytes ?? MAX_BYTES);
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.location;
      const next: URL | null = location ? parseSourceUrl(new URL(location, url).toString(), allowPrivate) : null;
      if (!next) throw new FetchPageError("Weiterleitung nicht erlaubt");
      url = next;
      continue;
    }
    if (response.status < 200 || response.status >= 300) throw new FetchPageError(`HTTP ${response.status}`);
    const contentType = response.headers["content-type"] ?? "";
    if (!options.types.test(contentType)) throw new FetchPageError("Unerwarteter Inhalt");
    if (options.whole && response.truncated) throw new FetchPageError("Zu groß");
    return { body: response.body, url: url.toString(), contentType };
  }
  throw new FetchPageError("Zu viele Weiterleitungen");
}

/** Returns the HTML and the final URL (after redirects). */
export async function fetchPage(input: string): Promise<{ html: string; url: string }> {
  try {
    const page = await fetchPublic(input, { accept: "text/html,application/xhtml+xml", types: /html|xml|text\/plain/i });
    return { html: new TextDecoder("utf-8", { fatal: false }).decode(page.body), url: page.url };
  } catch (error) {
    if (error instanceof FetchPageError && error.reason === "Unerwarteter Inhalt") throw new FetchPageError("Keine Webseite");
    throw error;
  }
}
