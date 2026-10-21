import type { Instrumentation } from "next";

// Server errors land under Einstellungen → Status (and, for whoever switched it on, in one push a day).
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const digest = typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : "";
  // redirect() / notFound() travel as errors too – they are not failures.
  if (/^NEXT_(REDIRECT|NOT_FOUND|HTTP_ERROR)/.test(digest)) return;
  const message = error instanceof Error ? error.message : String(error);
  const { recordServerError } = await import("@/server/server-errors");
  await recordServerError({ message, path: context.routePath ?? request.path ?? null });
};
