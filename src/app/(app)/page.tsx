import { Suspense } from "react";
import { AppHeader, PageSkeleton } from "@/components/app-header";
import { Avatar } from "@/components/avatar";
import { Card } from "@/components/card";
import { requireCouple } from "@/server/auth/dal";

export default function HomePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const { user, partner } = await requireCouple();

  return (
    <div className="flex flex-col gap-5">
      <AppHeader user={user} partner={partner} />
      <p className="text-[17px] font-bold text-muted">Hey {user.name}!</p>

      <Card tone="minze" size="lg" className="animate-pop-in flex flex-col items-center gap-4 text-center">
        <div className="flex items-center gap-3">
          <Avatar person={user} size={64} className="animate-wiggle" />
          <span className="text-3xl" aria-hidden="true">
            💞
          </span>
          <Avatar person={partner} size={64} />
        </div>
        <h1 className="text-[32px] font-bold leading-tight">
          {user.name} &amp; {partner.name}
        </h1>
        <p className="font-bold">Ihr seid gekoppelt. Der Date-O-Mat gehört jetzt euch zwei.</p>
      </Card>
    </div>
  );
}
