import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-header";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { requireCouple } from "@/server/auth/dal";
import { logoutAction } from "./actions";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-[30px] font-bold">Einstellungen</h1>
      <Suspense fallback={<PageSkeleton />}>
        <Settings />
      </Suspense>
    </div>
  );
}

async function Settings() {
  const { user, partner } = await requireCouple();

  return (
    <>
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
