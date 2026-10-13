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
import { logoutAction } from "./actions";
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
    await connection(); // live Google data – only for real requests, not prefetches
    calendars = await listCalendars(user.id).catch((error) => {
      console.warn("[settings] calendar list unavailable", error);
      return null;
    });
  }

  return (
    <>
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
