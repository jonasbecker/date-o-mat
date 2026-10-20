import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-header";
import { BudgetBar } from "@/components/budget-bar";
import { buttonClass } from "@/components/button";
import { Card } from "@/components/card";
import { Tabs } from "@/components/tabs";
import { dateCost } from "@/core/budget";
import { formatShortDate } from "@/lib/format";
import { requireCouple } from "@/server/auth/dal";
import { budgetHistory, budgetState, monthDates } from "@/server/budget";
import { dateForViewer } from "@/server/dates";
import { coupleNow } from "@/server/clock";
import { getCoupleSettings } from "@/server/settings";

export default function BudgetPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Link href="/" className="self-start text-sm font-extrabold text-muted underline">
          ← Zurück
        </Link>
        <h1 className="headline lowercase text-[clamp(34px,10vw,46px)] after:content-['.']">Budget & Spartopf</h1>
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <Budget />
      </Suspense>
    </div>
  );
}

async function Budget() {
  const ctx = await requireCouple();
  await connection();
  const now = coupleNow(await getCoupleSettings(ctx.coupleId));
  const budget = await budgetState(ctx.coupleId, now);
  if (!budget) {
    return (
      <Card className="flex flex-col items-start gap-3">
        <p className="font-bold">Ihr habt noch kein Monatsbudget. Mit Budget seht ihr, was eure Dates kosten, und was übrig bleibt, wandert in den 🎁 Spartopf.</p>
        <Link href="/settings?t=budget" className={buttonClass("primary", "md")}>
          Budget festlegen
        </Link>
      </Card>
    );
  }
  const [dates, history] = await Promise.all([monthDates(ctx.coupleId, budget.month), budgetHistory(ctx.coupleId, now)]);
  return (
    <>
      <BudgetBar {...budget} href={null} />
      <Card tone="zitrone" size="sm" className="flex items-center gap-3">
        <span className="text-3xl" aria-hidden="true">
          🎁
        </span>
        <p>
          <strong className="block font-display text-lg">Spartopf: {budget.pot} €</strong>
          <span className="text-xs font-bold">Übriges Budget sammelt sich hier – beim Planen „aus dem Spartopf“ bezahlen.</span>
        </p>
      </Card>

      {/* This month and the months before as tabs – one screen each. */}
      <Tabs
        label="Monate"
        tabs={[
          {
            key: "month",
            label: budget.label,
            content: (
      <section className="flex flex-col gap-2" aria-labelledby="month-heading">
        <h2 id="month-heading" className="text-[19px] font-semibold">
          {budget.label}
        </h2>
        {dates.length === 0 && <p className="font-semibold text-muted">Noch keine Dates in diesem Monat.</p>}
        <ul className="flex flex-col gap-2">
          {dates.map((full) => {
            // A surprise for me: no title, no amount (the sum above still counts it).
            const d = dateForViewer(full, ctx.user.id, [ctx.user, ctx.partner], now);
            const secret = d !== full;
            const past = d.startsAt <= now || d.status === "done";
            return (
              <li key={d.id} className="flex items-center justify-between gap-3 rounded-[18px] border-2 border-line bg-surface px-4 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate font-extrabold">{d.title}</span>
                  <span className="text-sm font-bold text-muted">
                    {formatShortDate(d.startsAt)}
                    {d.fromPot && " · 🎁 aus dem Spartopf"}
                    {!past && " · geplant"}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-display text-lg font-semibold">{secret ? "🤫" : `${dateCost(d)} €`}</span>
                  {past && !secret && d.actualCostEur === null && (
                    <Link href={`/dates/${d.id}`} className="text-xs font-extrabold underline">
                      {d.estimatedCostEur === null ? "Betrag eintragen" : "geschätzt · echt eintragen"}
                    </Link>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
            ),
          },
          {
            key: "history",
            label: "Frühere Monate",
            content: (
        <section className="flex flex-col gap-2" aria-labelledby="history-heading">
          <h2 id="history-heading" className="text-[19px] font-semibold">
            Frühere Monate
          </h2>
          {history.length === 0 && <p className="font-semibold text-muted">Noch kein Monat abgeschlossen.</p>}
          <ul className="flex flex-col gap-1.5">
            {history.map((m) => (
              <li key={m.month} className="flex items-center justify-between gap-3 text-sm font-bold">
                <span>
                  {m.label} · {m.dates} {m.dates === 1 ? "Date" : "Dates"}
                </span>
                <span>
                  {m.spent + m.fromPot} € {m.spent <= m.budget ? "💚" : "⚠️"} · Topf danach {m.potAfter} €
                </span>
              </li>
            ))}
          </ul>
        </section>
            ),
          },
        ]}
      />
      <Link href="/settings?t=budget" className="self-center text-sm font-extrabold text-muted underline">
        Budget ändern
      </Link>
    </>
  );
}
