import type { SaveDateResult } from "@/server/dates";

type SaveDateError = Extract<SaveDateResult, { ok: false }>["error"];

/** German messages for why a date could not be saved. */
export const DATE_ERROR_MESSAGES: Record<SaveDateError, string> = {
  taken: "Dieser Zeitraum ist inzwischen belegt – such dir einen anderen aus.",
  not_connected: "Ein Kalender ist nicht (mehr) verbunden. Schau kurz in die Einstellungen.",
  google: "Google Kalender antwortet gerade nicht. Versuch es gleich nochmal.",
  round_has_date: "Für diese Runde ist schon ein Date geplant.",
  invalid: "Da passt etwas nicht – bitte Zeit und Idee nochmal wählen.",
  no_round: "Gerade läuft keine Runde.",
};
