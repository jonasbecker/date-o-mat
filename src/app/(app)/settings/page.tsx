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
import { CalendarSection } from "./calendar-section";
import { SlotSettingsForm } from "./slot-settings-form";

export default function SettingsPage({ searchParams }: PageProps<"/settings">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[30px] font-bold">Einstellungen</h1>
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

  const [people, googleConnection, settings] = await Promise.all([
    calendarStates(ctx),
    getConnection(user.id),
    getCoupleSettings(coupleId),
  ]);
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
      <section className="flex flex-col gap-3" aria-labelledby="rhythm-heading">
        <h2 id="rhythm-heading" className="text-[21px] font-semibold">
          Rhythmus &amp; Modus
        </h2>
        <Card>
          <CycleSettingsForm
            values={{ rhythm: settings.rhythm, mode: settings.mode, deadlineDaysBeforeEnd: settings.deadlineDaysBeforeEnd }}
          />
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

      <section className="flex flex-col gap-3" aria-labelledby="slots-heading">
        <h2 id="slots-heading" className="text-[21px] font-semibold">
          Freie Zeiten finden
        </h2>
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
        <p className="px-1 text-sm font-semibold text-muted">Gilt für euch beide.</p>
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
