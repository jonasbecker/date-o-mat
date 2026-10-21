"use client";

// Errors in the app on a phone (a crash only Safari has, a broken button) would go unnoticed: they are sent to
// the status (Einstellungen → Status, "Fehler im Handy"). Network trouble is not an error of the app – skipped.
import { useEffect } from "react";
import { reportClientErrorAction } from "@/app/client-error-action";

const MAX_PER_PAGE_LOAD = 5;
const SENT_KEY = "dom-errors-sent";
let sentThisLoad = 0;

/** Noise: no network, a browser extension, the browser's own harmless warnings. */
function ignored(message: string): boolean {
  return (
    /Failed to fetch|Load failed|NetworkError|network error|ChunkLoadError|Loading chunk|Failed to load|connection (lost|refused|reset)|offline/i.test(message) ||
    /ResizeObserver loop|^Script error\.?$|AbortError|The operation was aborted/i.test(message)
  );
}

/** Sends one error (at most five per page load, each message once per session). */
export function reportClientError(error: unknown) {
  const message = (error instanceof Error ? `${error.name === "Error" ? "" : `${error.name}: `}${error.message}` : String(error ?? "")).trim().slice(0, 500);
  if (!message || ignored(message) || sentThisLoad >= MAX_PER_PAGE_LOAD) return;
  try {
    const sent = new Set<string>(JSON.parse(sessionStorage.getItem(SENT_KEY) ?? "[]"));
    if (sent.has(message)) return;
    sessionStorage.setItem(SENT_KEY, JSON.stringify([...sent, message].slice(-20)));
  } catch {
    // storage blocked: still send it
  }
  sentThisLoad++;
  void reportClientErrorAction({ message, path: location.pathname }).catch(() => {});
}

export function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      // Scripts from elsewhere (extensions) say nothing about the app.
      if (e.filename && !e.filename.startsWith(location.origin)) return;
      reportClientError(e.error ?? e.message);
    };
    const onRejection = (e: PromiseRejectionEvent) => reportClientError(e.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
