import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-header";
import { AutoRefresh } from "@/components/auto-refresh";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { LogoMark } from "@/components/logo";
import { formatDateTime } from "@/lib/format";
import { formatInviteCode } from "@/lib/invite-code";
import { requireUser } from "@/server/auth/dal";
import { countMembers, getCouple } from "@/server/couples";
import { env } from "@/server/env";
import { createCoupleAction, renewInviteAction } from "./actions";
import { InviteShare } from "./invite-share";
import { JoinForm } from "./join-form";

export default function PairPage({ searchParams }: PageProps<"/pair">) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 py-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <LogoMark size={88} />
        <h1 className="headline text-[46px]">
          euer beet
          <br />
          anlegen.
        </h1>
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <Pairing searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Pairing({ searchParams }: { searchParams: PageProps<"/pair">["searchParams"] }) {
  const user = await requireUser();
  const { code } = await searchParams;
  const prefill = typeof code === "string" ? code : "";

  if (!user.coupleId) {
    return (
      <>
        <p className="text-center text-[15px] text-muted">
          Hey {user.name}! Einer von euch legt das Beet an, der oder die andere tritt mit dem Code bei.
        </p>
        <Card className="flex flex-col gap-3">
          <h2 className="text-[17px] font-bold">Neues Paar starten</h2>
          <p className="text-muted">Du bekommst einen Code, den du deinem Schatz schickst.</p>
          <form action={createCoupleAction}>
            <Button type="submit" className="w-full">
              Paar starten
            </Button>
          </form>
        </Card>
        <Card className="flex flex-col gap-3">
          <h2 className="text-[17px] font-bold">Ich habe einen Code</h2>
          <JoinForm defaultCode={prefill} />
        </Card>
      </>
    );
  }

  if ((await countMembers(user.coupleId)) >= 2) redirect(user.onboardedAt ? "/" : "/welcome");

  const couple = await getCouple(user.coupleId);
  const expired = !couple?.inviteCode || !couple.inviteExpiresAt || couple.inviteExpiresAt < new Date();

  return (
    <>
      {/* Re-checks every few seconds whether the partner joined; the page then redirects home. */}
      <AutoRefresh intervalMs={4000} />
      <Card size="lg" className="flex flex-col items-center gap-4 text-center">
        {expired ? (
          <>
            <h2 className="text-[23px] font-bold">Der Code ist abgelaufen</h2>
            <form action={renewInviteAction} className="w-full">
              <Button type="submit" variant="secondary" className="w-full">
                Neuen Code erzeugen
              </Button>
            </form>
          </>
        ) : (
          <>
            <p className="text-[17px] font-bold">Euer Einladungscode</p>
            <p className="rounded-2xl bg-soft px-6 py-3 font-mono text-[32px] tracking-[0.12em] text-ink">
              {formatInviteCode(couple.inviteCode!)}
            </p>
            <p className="text-sm text-muted">Gültig bis {formatDateTime(couple.inviteExpiresAt!)}</p>
            <InviteShare
              code={formatInviteCode(couple.inviteCode!)}
              joinUrl={`${env().appUrl}/pair?code=${couple.inviteCode}`}
            />
          </>
        )}
      </Card>
      <p className="text-center text-muted">
        Sobald dein Schatz beigetreten ist, geht&apos;s hier automatisch weiter.
      </p>
      <details className="rounded-[20px] border-[1.5px] border-dashed border-line px-4 py-3">
        <summary className="cursor-pointer font-semibold">Ich habe doch einen Code bekommen</summary>
        <div className="pt-3">
          <JoinForm defaultCode={prefill} />
        </div>
      </details>
    </>
  );
}
