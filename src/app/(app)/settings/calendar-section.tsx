import { buttonClass, Button } from "@/components/button";
import { Card } from "@/components/card";
import { ConfirmButton } from "@/components/confirm-button";
import { CalendarIcon, CheckIcon } from "@/components/icons";
import { connectCalendarHref } from "@/components/connect-calendar";
import { isInformationalCalendar, type CalendarListEntry } from "@/core/calendars";
import type { PersonCalendar } from "@/server/availability";
import { disconnectCalendarAction, saveBusyCalendarsAction } from "./actions";

const MESSAGES: Record<string, string> = {
  connected: "Kalender verbunden. 🎉",
  saved: "Auswahl gespeichert.",
  disconnected: "Kalender getrennt. Zweisamen hat keinen Zugriff mehr.",
  cancelled: "Verbinden abgebrochen.",
  missing_scopes: "Bitte setze bei Google alle Häkchen – sonst kann Zweisamen keine freien Zeiten finden.",
  wrong_account: "Bitte verbinde den Kalender des Google-Kontos, mit dem du angemeldet bist.",
  state: "Das hat zu lange gedauert. Bitte nochmal versuchen.",
  oauth: "Bei Google ist etwas schiefgelaufen. Bitte nochmal versuchen.",
};

export function CalendarSection({
  me,
  partner,
  email,
  calendars,
  busyCalendarIds,
  message,
}: {
  me: PersonCalendar;
  partner: PersonCalendar;
  email: string;
  /** null = could not be loaded right now */
  calendars: CalendarListEntry[] | null;
  busyCalendarIds: string[];
  message?: string;
}) {
  const text = message ? MESSAGES[message] : undefined;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="calendar-heading">
      <h2 id="calendar-heading" className="sr-only">
        Kalender
      </h2>
      {text && (
        <p role="status" className="rounded-[18px] bg-minze-soft px-4 py-2.5 font-bold text-tinte">
          {text}
        </p>
      )}

      <Card className="flex flex-col gap-4">
        {me.state === "connected" ? (
          <>
            <p className="flex items-center gap-2 font-bold">
              <span className="flex size-7 items-center justify-center rounded-full bg-minze text-tinte">
                <CheckIcon width={14} height={14} />
              </span>
              Verbunden mit {email}
            </p>
            {calendars ? (
              <form action={saveBusyCalendarsAction} className="flex flex-col gap-3">
                <p className="text-sm font-extrabold text-muted">Diese Kalender zählen als „belegt“:</p>
                <ul className="flex flex-col gap-2">
                  {calendars.map((calendar) => {
                    const checked = calendar.primary || busyCalendarIds.includes(calendar.id);
                    return (
                      <li key={calendar.id}>
                        <label className="flex items-center gap-3 font-semibold">
                          <input
                            type="checkbox"
                            name="calendarId"
                            value={calendar.id}
                            defaultChecked={checked}
                            disabled={calendar.primary}
                            className="size-5 accent-ink"
                          />
                          <span className="min-w-0 break-words">
                            {calendar.summary}
                            {calendar.primary && <span className="text-sm text-muted"> (Hauptkalender)</span>}
                            {isInformationalCalendar(calendar.id) && <span className="text-sm text-muted"> (nur Info)</span>}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <Button type="submit" variant="secondary" size="sm" className="self-start">
                  Auswahl speichern
                </Button>
              </form>
            ) : (
              <p className="font-semibold text-muted">Deine Kalenderliste ist gerade nicht abrufbar.</p>
            )}
            <div className="flex flex-wrap gap-x-5 gap-y-2 border-t-[1.5px] border-dashed border-track pt-3 text-sm font-extrabold">
              <a href={connectCalendarHref("/settings")} className="underline">
                Neu verbinden
              </a>
              <ConfirmButton label="Verbindung trennen" question="Ohne Kalender findet Zweisamen keine freien Zeiten mehr." yes="Ja, trennen" action={disconnectCalendarAction} />
            </div>
          </>
        ) : (
          <>
            <p className="font-semibold">
              {me.state === "reauth"
                ? "Google hat die Verbindung beendet. Bitte verbinde deinen Kalender neu."
                : "Zweisamen sieht nur, wann du belegt bist – keine Termintitel, keine Details."}
            </p>
            <a href={connectCalendarHref("/settings")} className={buttonClass("primary", "md", "w-full")}>
              <CalendarIcon />
              {me.state === "reauth" ? "Neu verbinden" : "Google Kalender verbinden"}
            </a>
          </>
        )}

        <p className="text-sm font-bold text-muted">
          {partner.name}:{" "}
          {partner.state === "connected" ? "verbunden ✓" : partner.state === "reauth" ? "muss neu verbinden" : "noch nicht verbunden"}
        </p>
      </Card>

      <p className="px-1 text-sm font-semibold text-muted">
        Gut zu wissen: Ganztägige Termine zählen nur, wenn sie in Google auf „Beschäftigt“ stehen. Google legt sie
        standardmäßig als „Verfügbar“ an.
      </p>
    </section>
  );
}
