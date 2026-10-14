import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-header";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import type { CalendarListEntry } from "@/core/calendars";
import { requireCouple } from "@/server/auth/dal";
import { calendarStates } from "@/server/availability";
import { listCalendars } from "@/server/google/calendar-api";
import { getConnection } from "@/server/google/connection";
import { getCoupleSettings } from "@/server/settings";
import { formatDateTime } from "@/lib/format";
import { coupleNow } from "@/server/clock";
import { env } from "@/server/env";
import { devClockAction, logoutAction } from "./actions";
import { CycleSettingsForm } from "./cycle-settings-form";
import { PushSettings } from "@/components/push-settings";
import { getPrefs, pushPublicKey } from "@/server/push";
import { CalendarSection } from "./calendar-section";
import { SlotSettingsForm } from "./slot-settings-form";
import { EventSources, type SourceView } from "./event-sources";
import { listSources } from "@/server/events";
import type { EventSource } from "@/server/db/schema";
import { agoLabel } from "@/lib/format";
import { buttonClass } from "@/components/button";
import { Info } from "@/components/info";
import { systemStatus } from "@/server/system-status";
import { SystemStatusCard } from "./system-status-card";
import { EventMixPicker } from "./event-mix-picker";

// "Jetzt lesen" fetches a page and asks Claude (runs after the response).
export const maxDuration = 120;

function sourceView(source: EventSource, now: Date): SourceView {
  const base = { id: source.id, label: source.label, url: source.url, kind: source.kind };
  if (source.fetchStartedAt) {
    return now.getTime() - source.fetchStartedAt.getTime() < 5 * 60_000
      ? { ...base, status: "Wird gerade gelesen …", tone: "busy" }
      : { ...base, status: "⚠️ Lesen wurde abgebrochen (Seite zu groß oder zu langsam?)", tone: "warn" };
  }
  if (!source.lastFetchedAt) return { ...base, status: "Wird gleich gelesen …", tone: "new" };
  const ago = agoLabel(now, source.lastFetchedAt);
  if (source.lastStatus === "error") return { ...base, status: `⚠️ ${source.lastError ?? "Fehler"} · ${ago}`, tone: "warn" };
  if (source.lastStatus === "empty") return { ...base, status: `Nichts gefunden · ${ago}`, tone: "warn" };
  const count = source.lastCount ?? 0;
  return { ...base, status: `✓ ${count} ${count === 1 ? "Eintrag" : "Einträge"} · ${ago}`, tone: "ok" };
}

export default function SettingsPage({ searchParams }: PageProps<"/settings">) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/" className="self-start text-sm font-extrabold text-muted underline">
          ← Start
        </Link>
        <h1 className="text-[30px] font-bold">Einstellungen</h1>
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <Settings searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Settings({ searchParams }: { searchParams: PageProps<"/settings">["searchParams"] }) {
  const ctx = await requireCouple();
  // Live data (clock, Google calendar list) – only for real requests, not prefetches.
  await connection();
  const { user, partner, coupleId } = ctx;
  const { calendar: message } = await searchParams;

  const [people, googleConnection, settings, prefs, sources] = await Promise.all([
    calendarStates(ctx),
    getConnection(user.id),
    getCoupleSettings(coupleId),
    getPrefs(user.id),
    listSources(coupleId),
  ]);
  const now = coupleNow(settings);
  const status = await systemStatus(ctx, now);
  const me = people.find((p) => p.isMe)!;
  const other = people.find((p) => !p.isMe)!;

  let calendars: CalendarListEntry[] | null = null;
  if (me.state === "connected") {
    calendars = await listCalendars(user.id).catch((error) => {
      console.warn("[settings] calendar list unavailable", error);
      return null;
    });
  }

  return (
    <>
      <SystemStatusCard rows={status} />

      <div className="-mb-3 mt-2 flex flex-col">
        <p className="text-[13px] font-extrabold uppercase tracking-wide text-muted">Für euch beide</p>
        <p className="text-sm font-semibold text-muted">Was du hier änderst, gilt auch für {partner.name}.</p>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="rhythm-heading">
        <h2 id="rhythm-heading" className="text-[21px] font-semibold">
          Rhythmus &amp; Modus <Info term="runde" />
        </h2>
        <Card>
          <CycleSettingsForm
            values={{ rhythm: settings.rhythm, mode: settings.mode, deadlineDaysBeforeEnd: settings.deadlineDaysBeforeEnd }}
          />
        </Card>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="slots-heading">
        <h2 id="slots-heading" className="text-[21px] font-semibold">
          Freie Zeiten finden
        </h2>
        <p className="-mt-1 px-1 font-semibold text-muted">Wann ein Date frühestens beginnt, wie lange es dauert und wie viel Luft um eure Termine bleibt.</p>
        <details className="group rounded-[24px] border-[2.5px] border-line bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-display text-lg font-semibold">
            Zeitfenster, Puffer &amp; Vorlauf anpassen
            <span aria-hidden="true" className="transition-transform group-open:rotate-180">
              ⌄
            </span>
          </summary>
          <div className="border-t-2 border-track px-5 py-4">
          <SlotSettingsForm
            values={{
              smallDurationMinutes: settings.smallDurationMinutes,
              smallStartFromMinute: settings.smallStartFromMinute,
              smallStartUntilMinute: settings.smallStartUntilMinute,
              largeMinDurationMinutes: settings.largeMinDurationMinutes,
              largeStartFromMinute: settings.largeStartFromMinute,
              largeStartUntilMinute: settings.largeStartUntilMinute,
              latestEndMinute: settings.latestEndMinute,
              minLeadHours: settings.minLeadHours,
              bufferMinutes: settings.bufferMinutes,
              horizonDays: settings.horizonDays,
            }}
          />
          </div>
        </details>
      </section>

      <section id="events" className="flex scroll-mt-6 flex-col gap-3" aria-labelledby="events-heading">
        <h2 id="events-heading" className="text-[21px] font-semibold">
          Event-Quellen
        </h2>
        <Card>
          <EventSources sources={sources.map((s) => sourceView(s, now))} aiReady={env().ai} />
        </Card>
      </section>

      <section id="entdecken" className="flex scroll-mt-6 flex-col gap-3" aria-labelledby="deck-heading">
        <h2 id="deck-heading" className="text-[21px] font-semibold">
          Entdecken
        </h2>
        <Card>
          <EventMixPicker value={settings.deckEventMix} />
        </Card>
      </section>

      <div className="-mb-3 mt-2 flex flex-col">
        <p className="text-[13px] font-extrabold uppercase tracking-wide text-muted">Nur für dich</p>
        <p className="text-sm font-semibold text-muted">Erinnerungen und dein Kalender – das stellt jede:r selbst ein.</p>
      </div>

      <section id="push" className="flex scroll-mt-6 flex-col gap-3" aria-labelledby="push-heading">
        <h2 id="push-heading" className="text-[21px] font-semibold">
          Erinnerungen
        </h2>
        <Card>
          <PushSettings publicKey={pushPublicKey()} prefs={prefs} partnerName={partner.name} />
        </Card>
      </section>

      <CalendarSection
        me={me}
        partner={other}
        email={user.email}
        calendars={calendars}
        busyCalendarIds={googleConnection?.busyCalendarIds ?? []}
        message={typeof message === "string" ? message : undefined}
      />

      <section className="flex flex-col gap-3" aria-labelledby="help-heading">
        <h2 id="help-heading" className="text-[21px] font-semibold">
          Hilfe
        </h2>
        <Link href="/welcome" className={buttonClass("secondary", "md", "w-full")}>
          👋 Einführung nochmal ansehen
        </Link>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="couple-heading">
        <h2 id="couple-heading" className="text-[21px] font-semibold">
          Ihr zwei
        </h2>
        <Card className="flex flex-col gap-4">
          {[user, partner].map((person) => (
            <div key={person.id} className="flex items-center gap-3">
              <Avatar person={person} size={44} />
              <div className="min-w-0">
                <p className="font-display text-lg font-semibold">
                  {person.name}
                  {person.id === user.id && <span className="font-sans text-sm font-bold text-muted"> (du)</span>}
                </p>
                <p className="truncate text-sm font-semibold text-muted">{person.email}</p>
              </div>
            </div>
          ))}
        </Card>
      </section>

      {env().devTools && (
        <section className="flex flex-col gap-3" aria-labelledby="dev-heading">
          <h2 id="dev-heading" className="text-[21px] font-semibold">
            Dev-Uhr 🧪
          </h2>
          <Card className="flex flex-col gap-3">
            <p className="font-bold">
              App-Zeit: {formatDateTime(coupleNow(settings))}
              {settings.devClockOffsetMinutes !== 0 && (
                <span className="text-sm text-muted"> (verstellt um {Math.round(settings.devClockOffsetMinutes / 60)} Std.)</span>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                ["+1 Tag", 24 * 60],
                ["+3 Tage", 3 * 24 * 60],
                ["+1 Woche", 7 * 24 * 60],
              ].map(([label, minutes]) => (
                <form key={label} action={devClockAction}>
                  <input type="hidden" name="minutes" value={minutes} />
                  <Button type="submit" size="sm" variant="secondary">
                    {label}
                  </Button>
                </form>
              ))}
              <form action={devClockAction}>
                <input type="hidden" name="reset" value="1" />
                <Button type="submit" size="sm" variant="secondary">
                  Alles zurücksetzen
                </Button>
              </form>
            </div>
            <p className="text-sm font-semibold text-muted">Nur sichtbar mit ENABLE_DEV_TOOLS=1. Jeder Klick führt auch den Tick aus. „Alles zurücksetzen“ stellt die echte Zeit ein und löscht alle Runden.</p>
          </Card>
        </section>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="account-heading">
        <h2 id="account-heading" className="text-[21px] font-semibold">
          Konto
        </h2>
        <form action={logoutAction}>
          <Button type="submit" variant="secondary" className="w-full">
            Abmelden
          </Button>
        </form>
      </section>

    </>
  );
}
