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
import { formatDateTime, formatLongDate } from "@/lib/format";
import { coupleNow } from "@/server/clock";
import { env } from "@/server/env";
import { devClockAction, logoutAction } from "./actions";
import { CycleSettingsForm } from "./cycle-settings-form";
import { PushSettings } from "@/components/push-settings";
import { getPrefs, pushPublicKey } from "@/server/push";
import { CalendarSection } from "./calendar-section";
import { SlotSettingsForm } from "./slot-settings-form";
import { EventSources, type SourcePageView, type SourceView } from "./event-sources";
import { listSourcePages, listSources } from "@/server/events";
import type { EventSource, EventSourcePage } from "@/server/db/schema";
import { agoLabel } from "@/lib/format";
import { buttonClass } from "@/components/button";
import { Info } from "@/components/info";
import { systemStatus } from "@/server/system-status";
import { SystemStatusCard } from "./system-status-card";
import { EventMixPicker } from "./event-mix-picker";
import { BudgetForm } from "./budget-form";
import { ShareShortcut, StartLocationForm } from "./on-the-go";
import { SpecialDays, type SpecialDayView } from "./special-days";
import { ExtrasForm } from "./extras-form";
import { Fold, OpenFromHash } from "./fold";
import { upcomingDaysFor } from "@/server/special-days";
import { inDaysLabel } from "@/core/special-days";

// "Jetzt lesen" fetches a page and asks Claude (runs after the response).
export const maxDuration = 120;

function pageView(page: EventSourcePage): SourcePageView {
  const base = { id: page.id, label: page.label, url: page.url, addedBy: page.addedBy };
  if (!page.lastStatus) return { ...base, status: "Wird beim nächsten Lesen dabei sein", tone: "new" };
  if (page.lastStatus === "error") return { ...base, status: `⚠️ ${page.lastError ?? "Fehler"}`, tone: "warn" };
  const count = page.lastCount ?? 0;
  return count ? { ...base, status: `✓ ${count} ${count === 1 ? "Eintrag" : "Einträge"}`, tone: "ok" } : { ...base, status: "Nichts gefunden", tone: "warn" };
}

function sourceView(source: EventSource, now: Date, pages: EventSourcePage[]): SourceView {
  const base = { id: source.id, label: source.label, url: source.url, kind: source.kind, pages: pages.filter((p) => p.sourceId === source.id).map(pageView), picking: !source.pagesPickedAt };
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
  const [status, sourcePages] = await Promise.all([systemStatus(ctx, now), listSourcePages(sources.map((s) => s.id))]);
  const specialDayViews: SpecialDayView[] = (await upcomingDaysFor(coupleId, now, 366)).map((d) => ({
    id: d.id,
    emoji: d.emoji,
    label: d.label,
    dateLabel: formatLongDate(d.date),
    inDays: inDaysLabel(d.days),
  }));
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
      <OpenFromHash />

      <div className="-mb-3 mt-2 flex flex-col">
        <p className="text-[13px] font-extrabold uppercase tracking-wide text-muted">Das Wichtigste</p>
      </div>

      <CalendarSection
        me={me}
        partner={other}
        email={user.email}
        calendars={calendars}
        busyCalendarIds={googleConnection?.busyCalendarIds ?? []}
        message={typeof message === "string" ? message : undefined}
      />

      <section className="flex flex-col gap-3" aria-labelledby="rhythm-heading">
        <h2 id="rhythm-heading" className="text-[21px] font-semibold">
          Rhythmus &amp; Modus <Info term="runde" />
        </h2>
        <p className="-mt-2 px-1 text-sm font-semibold text-muted">Gilt für euch beide.</p>
        <Card>
          <CycleSettingsForm
            values={{ rhythm: settings.rhythm, mode: settings.mode, deadlineDaysBeforeEnd: settings.deadlineDaysBeforeEnd }}
          />
        </Card>
      </section>

      <section id="push" className="flex scroll-mt-6 flex-col gap-3" aria-labelledby="push-heading">
        <h2 id="push-heading" className="text-[21px] font-semibold">
          Erinnerungen
        </h2>
        <p className="-mt-2 px-1 text-sm font-semibold text-muted">Stellt jede:r für sich ein.</p>
        <Card>
          <PushSettings publicKey={pushPublicKey()} prefs={prefs} partnerName={partner.name} />
        </Card>
      </section>

      <div className="-mb-3 mt-2 flex flex-col">
        <p className="text-[13px] font-extrabold uppercase tracking-wide text-muted">Mehr einstellen</p>
        <p className="text-sm font-semibold text-muted">Braucht ihr am Anfang nicht – schaut rein, wenn ihr mögt.</p>
      </div>

      <div className="flex flex-col gap-3">
        <Fold id="zeiten" title="⏰ Freie Zeiten finden" hint="Zeitfenster, Puffer und Vorlauf – für euch beide">
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
        </Fold>

        <Fold id="events" title="🎟️ Event-Quellen" hint={sources.length ? `${sources.length} ${sources.length === 1 ? "Seite" : "Seiten"} für „Was läuft“` : "Seiten für „Was läuft“"}>
          <EventSources sources={sources.map((s) => sourceView(s, now, sourcePages))} aiReady={env().ai} />
        </Fold>

        <Fold id="entdecken" title="💞 Swipen" hint="Wie viele Events in den Stapel kommen">
          <EventMixPicker value={settings.deckEventMix} />
        </Fold>

        <Fold id="budget" title="💶 Budget &amp; Spartopf" hint={settings.monthlyBudgetEur ? `${settings.monthlyBudgetEur} € im Monat` : "Aus – ohne Budget gibt es keine Beträge"}>
          <BudgetForm budget={settings.monthlyBudgetEur} />
        </Fold>

        <Fold id="besondere-tage" title="🎂 Besondere Tage" hint={specialDayViews.length ? `${specialDayViews.length} eingetragen` : "Geburtstage, Jahrestag – mit Erinnerung"}>
          <SpecialDays days={specialDayViews} people={[user, partner].map((p) => ({ id: p.id, name: p.name }))} />
        </Fold>

        <Fold id="unterwegs" title="🧭 Unterwegs &amp; Teilen" hint="Startort für die Anfahrt, Links vom iPhone teilen">
          <div className="flex flex-col gap-5">
            <StartLocationForm value={user.startLocation} />
            <ShareShortcut hasKey={Boolean(user.shareTokenHash)} endpoint={`${env().appUrl}/api/share`} />
          </div>
        </Fold>

        <Fold id="extras" title="✨ Extras" hint="An- und ausschalten, was ihr nicht braucht">
          <ExtrasForm hidden={settings.hiddenExtras} />
        </Fold>
      </div>

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
