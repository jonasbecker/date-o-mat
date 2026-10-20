import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppHeader, PageSkeleton } from "@/components/app-header";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import type { CalendarListEntry } from "@/core/calendars";
import { requireCouple } from "@/server/auth/dal";
import { calendarStates } from "@/server/availability";
import { listCalendars } from "@/server/google/calendar-api";
import { getConnection } from "@/server/google/connection";
import { extraOn, getCoupleSettings } from "@/server/settings";
import { formatDateTime, formatLongDate } from "@/lib/format";
import { coupleNow } from "@/server/clock";
import { env } from "@/server/env";
import { devClockAction, logoutAction } from "./actions";
import { PushSettings } from "@/components/push-settings";
import { getPrefs, pushPublicKey } from "@/server/push";
import { CalendarSection } from "./calendar-section";
import { SlotSettingsForm } from "./slot-settings-form";
import { EventSources, type SourcePageView, type SourceView } from "./event-sources";
import { listSourcePages, listSources } from "@/server/events";
import type { EventSource, EventSourcePage } from "@/server/db/schema";
import { agoLabel } from "@/lib/format";
import { systemStatus } from "@/server/system-status";
import { SystemStatusCard } from "./system-status-card";
import { EventMixPicker } from "./event-mix-picker";
import { BudgetForm } from "./budget-form";
import { ShareShortcut, StartLocationForm } from "./on-the-go";
import { SpecialDays, type SpecialDayView } from "./special-days";
import { ExtrasForm } from "./extras-form";
import { PageTitle } from "@/components/page-title";
import { MoreList, Topic, type TopicTile } from "./fold";
import { CycleQuick, EveningFrom, PushToggle } from "./setup-main";
import { AlertIcon } from "@/components/icons";
import { overallLevel } from "@/core/system-status";
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

const rowClass = "flex min-h-11 items-center justify-between gap-3";

export default function SettingsPage({ searchParams }: PageProps<"/settings">) {
  return (
    <div className="flex flex-col gap-4">
      <AppHeader />
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
  const { calendar: message, t } = await searchParams;
  // Back from Google (?calendar=…) the calendar screen shows its message.
  const topic = typeof t === "string" ? t : typeof message === "string" ? "kalender" : "";

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

  const statusOk = overallLevel(status) === "ok";
  const problems = status.filter((row) => row.level === "warn").length;
  const statusTile: TopicTile = { id: "status", icon: statusOk ? "status" : "warn", title: "Läuft alles?", hint: statusOk ? "Alles läuft" : `${problems === 1 ? "Eine Sache braucht" : `${problems} Dinge brauchen`} euch` };
  // "Mehr": everything that is not on the main page (MSetup shows only the essentials).
  const moreGroups = [
    {
      title: "Für euch beide",
      tiles: [
        { id: "zeiten", icon: "clock", title: "Freie Zeiten finden", hint: "Zeitfenster, Puffer" },
        { id: "events", icon: "ticket", title: "Event-Quellen", hint: sources.length ? `${sources.length} ${sources.length === 1 ? "Seite" : "Seiten"}` : "Für „Was läuft“" },
        { id: "entdecken", icon: "heart", title: "Swipen", hint: "Events im Stapel" },
        { id: "budget", icon: "wallet", title: "Budget & Spartopf", hint: settings.monthlyBudgetEur ? `${settings.monthlyBudgetEur} € im Monat` : "Aus" },
        { id: "besondere-tage", icon: "gift", title: "Besondere Tage", hint: specialDayViews.length ? `${specialDayViews.length} eingetragen` : "Geburtstage, Jahrestag" },
        { id: "extras", icon: "sparkle", title: "Extras", hint: "An- und ausschalten" },
        ...(extraOn(settings, "story") ? [{ id: "story", icon: "story", title: "Date-Story", hint: "Euer Jahr zum Durchtippen", href: "/story" } as TopicTile] : []),
        ...(extraOn(settings, "cards") ? [{ id: "cards", icon: "cards", title: "Gesprächskarten", hint: "Fragen für unterwegs", href: "/fragen" } as TopicTile] : []),
      ] satisfies TopicTile[],
    },
    {
      title: "Nur für dich",
      tiles: [
        { id: "push", icon: "bell", title: "Erinnerungen im Detail", hint: "Was aufs Handy kommt" },
        { id: "unterwegs", icon: "compass", title: "Unterwegs & Teilen", hint: "Startort, iPhone-Kurzbefehl" },
        { id: "konto", icon: "user", title: "Ihr zwei & Konto", hint: "Abmelden" },
        { id: "welcome", icon: "intro", title: "Einführung", href: "/welcome" },
      ] satisfies TopicTile[],
    },
  ];

  const topics: Record<string, React.ReactNode> = {
    status: (
      <Topic id="status" title="Läuft alles?">
        <SystemStatusCard rows={status} />
      </Topic>
    ),
    kalender: (
      <Topic id="kalender">
        <CalendarSection
          me={me}
          partner={other}
          email={user.email}
          calendars={calendars}
          busyCalendarIds={googleConnection?.busyCalendarIds ?? []}
          message={typeof message === "string" ? message : undefined}
        />
      </Topic>
    ),
    push: (
      <Topic id="push" title="Erinnerungen" hint="Stellt jede:r für sich ein.">
        <Card>
          <PushSettings publicKey={pushPublicKey()} prefs={prefs} partnerName={partner.name} />
        </Card>
      </Topic>
    ),
    zeiten: (
      <Topic id="zeiten" title="Freie Zeiten finden" hint="Zeitfenster, Puffer und Vorlauf – für euch beide">
        <Card>
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
        </Card>
      </Topic>
    ),
    events: (
      <Topic id="events" title="Event-Quellen" hint="Seiten für „Was läuft“">
        <Card><EventSources sources={sources.map((s) => sourceView(s, now, sourcePages))} aiReady={env().ai} /></Card>
      </Topic>
    ),
    entdecken: (
      <Topic id="entdecken" title="Swipen" hint="Wie viele Events in den Stapel kommen">
        <Card><EventMixPicker value={settings.deckEventMix} /></Card>
      </Topic>
    ),
    budget: (
      <Topic id="budget" title="Budget & Spartopf">
        <Card><BudgetForm budget={settings.monthlyBudgetEur} /></Card>
      </Topic>
    ),
    "besondere-tage": (
      <Topic id="besondere-tage" title="Besondere Tage" hint="Geburtstage, Jahrestag – mit Erinnerung">
        <Card><SpecialDays days={specialDayViews} people={[user, partner].map((p) => ({ id: p.id, name: p.name }))} /></Card>
      </Topic>
    ),
    unterwegs: (
      <Topic id="unterwegs" title="Unterwegs & Teilen">
        <Card className="flex flex-col gap-4">
          <StartLocationForm value={user.startLocation} />
          <ShareShortcut hasKey={Boolean(user.shareTokenHash)} endpoint={`${env().appUrl}/api/share`} />
        </Card>
      </Topic>
    ),
    extras: (
      <Topic id="extras" title="Extras" hint="An- und ausschalten, was ihr nicht braucht">
        <Card><ExtrasForm hidden={settings.hiddenExtras} /></Card>
      </Topic>
    ),
    konto: (
      <Topic id="konto" title="Ihr zwei & Konto">
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
        <form action={logoutAction}>
          <Button type="submit" variant="secondary" className="w-full">
            Abmelden
          </Button>
        </form>
        {env().devTools && (
          <Card className="flex flex-col gap-3">
            <h3 className="font-display text-lg font-semibold">Dev-Uhr 🧪</h3>
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
        )}
      </Topic>
    ),
  };

  if (topic === "mehr") {
    return (
      <>
        <PageTitle title="mehr." back="/settings" backLabel="Alle Einstellungen" />
        <MoreList groups={moreGroups} status={{ ok: statusOk, tile: statusTile }} />
      </>
    );
  }
  if (topic && topics[topic]) {
    const home = topic === "kalender";
    const { title, hint } = (topics[topic] as React.ReactElement<{ title?: string; hint?: string }>).props;
    return (
      <>
        <PageTitle title={`${(title ?? "Kalender").toLowerCase()}.`} back={home ? "/settings" : "/settings?t=mehr"} backLabel={home ? "Alle Einstellungen" : "Mehr"}>
          {hint}
        </PageTitle>
        {topics[topic]}
      </>
    );
  }
  // The main page, as in MSetup.
  return (
    <div className="flex flex-col gap-2.5">
      <PageTitle title="setup." />
      {!statusOk && (
        <Link href="/settings?t=status" className="tap flex items-center gap-2 rounded-[20px] bg-zitrone-soft px-4 py-3 text-tinte">
          <AlertIcon width={18} height={18} />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Läuft alles?</span>
            <span className="block text-xs">{statusTile.hint}</span>
          </span>
          <span aria-hidden="true">›</span>
        </Link>
      )}
      <Card size="md">
        <CycleQuick values={{ rhythm: settings.rhythm, mode: settings.mode, deadlineDaysBeforeEnd: settings.deadlineDaysBeforeEnd }} />
      </Card>
      <Card size="md">
        <PushToggle publicKey={pushPublicKey()} partnerName={partner.name} />
      </Card>
      <Card size="md" className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <p className="text-[13px] text-muted">Kalender für freie Abende</p>
          <Link href="/settings?t=kalender" className="text-[13px] font-semibold text-muted underline">
            verwalten
          </Link>
        </div>
        {people.map((person) => {
          const who = person.isMe ? user : partner;
          return (
            <div key={person.userId} className={rowClass}>
              <span className="flex items-center gap-2.5">
                <Avatar person={who} size={30} />
                <span className="text-base font-semibold">Google Kalender</span>
              </span>
              {person.state === "connected" ? (
                <span className="text-sm font-semibold text-leaf">✓ verbunden</span>
              ) : person.isMe ? (
                <Link href="/settings?t=kalender" className="text-sm font-semibold underline">
                  {person.state === "reauth" ? "neu verbinden" : "verbinden"}
                </Link>
              ) : (
                <span className="text-sm text-muted">{person.name} fehlt noch</span>
              )}
            </div>
          );
        })}
        <EveningFrom
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
      </Card>
      <Link href="/settings?t=mehr" className="tap flex min-h-12 items-center justify-between rounded-[22px] bg-surface px-5 text-base font-semibold">
        Mehr
        <span aria-hidden="true" className="text-muted">›</span>
      </Link>
    </div>
  );
}
