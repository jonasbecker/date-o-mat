// Fetches an event source page – carefully, because the URL was typed in by a person.
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

type RawResponse = { status: number; headers: IncomingHttpHeaders; body: Buffer };

function get(url: URL, allowPrivate: boolean): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const send = url.protocol === "https:" ? httpsRequest : httpRequest;
    const request = send(
      url,
      {
        method: "GET",
        lookup: guardedLookup(allowPrivate),
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml", "accept-language": "de-DE,de;q=0.9" },
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            response.destroy(); // the start of a huge page is enough
            return;
          }
          chunks.push(chunk);
        });
        const done = () => resolve({ status: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks) });
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

/** Returns the HTML and the final URL (after redirects). */
export async function fetchPage(input: string): Promise<{ html: string; url: string }> {
  const allowPrivate = env().allowPrivateEventUrls;
  const first = parseSourceUrl(input, allowPrivate);
  if (!first) throw new FetchPageError("Ungültige Adresse");
  let url: URL = first;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await get(url, allowPrivate);
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.location;
      const next: URL | null = location ? parseSourceUrl(new URL(location, url).toString(), allowPrivate) : null;
      if (!next) throw new FetchPageError("Weiterleitung nicht erlaubt");
      url = next;
      continue;
    }
    if (response.status < 200 || response.status >= 300) throw new FetchPageError(`HTTP ${response.status}`);
    if (!/html|xml|text\/plain/i.test(response.headers["content-type"] ?? "")) throw new FetchPageError("Keine Webseite");
    return { html: new TextDecoder("utf-8", { fatal: false }).decode(response.body), url: url.toString() };
  }
  throw new FetchPageError("Zu viele Weiterleitungen");
}
