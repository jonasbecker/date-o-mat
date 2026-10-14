import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Every hostname "resolves" to 127.0.0.1 – like a hostile DNS server would answer.
vi.mock("node:dns", () => ({
  lookup: (_host: string, _options: unknown, callback: (e: null, a: Array<{ address: string; family: number }>) => void) =>
    callback(null, [{ address: "127.0.0.1", family: 4 }]),
}));
const settings = { allowPrivateEventUrls: false };
vi.mock("@/server/env", () => ({ env: () => settings }));

const { fetchPage } = await import("./fetch-page");

let server: Server;
let port = 0;
beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === "/big") {
      res.setHeader("content-type", "text/html");
      res.end("x".repeat(5 * 1024 * 1024));
    } else if (req.url === "/json") {
      res.setHeader("content-type", "application/json");
      res.end("{}");
    } else if (req.url === "/loop") {
      res.statusCode = 302;
      res.setHeader("location", "/loop");
      res.end();
    } else {
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.end("<h1>Köln</h1>");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as { port: number }).port;
});
afterAll(() => server.close());

describe("fetchPage", () => {
  it("refuses a public-looking name that resolves to an internal address", async () => {
    settings.allowPrivateEventUrls = false;
    await expect(fetchPage("https://events.example.com/")).rejects.toMatchObject({ reason: "Adresse nicht erlaubt" });
  });

  it("reads a page (test mode allows localhost)", async () => {
    settings.allowPrivateEventUrls = true;
    expect(await fetchPage(`http://localhost:${port}/`)).toEqual({ html: "<h1>Köln</h1>", url: `http://localhost:${port}/` });
  });

  it("caps huge pages at 3 MB", async () => {
    settings.allowPrivateEventUrls = true;
    const { html } = await fetchPage(`http://localhost:${port}/big`);
    expect(html.length).toBeLessThanOrEqual(3 * 1024 * 1024);
  });

  it("rejects non-HTML and redirect loops", async () => {
    settings.allowPrivateEventUrls = true;
    await expect(fetchPage(`http://localhost:${port}/json`)).rejects.toMatchObject({ reason: "Keine Webseite" });
    await expect(fetchPage(`http://localhost:${port}/loop`)).rejects.toMatchObject({ reason: "Zu viele Weiterleitungen" });
  });
});
