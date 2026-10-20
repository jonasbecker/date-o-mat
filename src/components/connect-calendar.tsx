import type { PersonCalendar } from "@/server/availability";
import { buttonClass } from "./button";
import { CalendarIcon } from "./icons";

type ReturnPath = "/" | "/plan" | "/settings";

export function connectCalendarHref(next: ReturnPath): string {
  return `/api/auth/google?flow=calendar&next=${encodeURIComponent(next)}`;
}

/** Explains who still has to connect a calendar, with a button for the current user. */
export function ConnectCalendarCard({ people, next }: { people: PersonCalendar[]; next: ReturnPath }) {
  const me = people.find((p) => p.isMe);
  const partner = people.find((p) => !p.isMe);
  const meMissing = me && me.state !== "connected";

  return (
    <div className="sticker flex flex-col gap-3 rounded-[24px] bg-zitrone-soft p-5 text-tinte">
      <span className="flex size-12 items-center justify-center rounded-[22px] bg-soft text-ink">
        <CalendarIcon width={26} height={26} />
      </span>
      {meMissing ? (
        <>
          <h2 className="text-[21px] font-bold">
            {me.state === "reauth" ? "Bitte verbinde deinen Kalender neu" : "Verbinde deinen Google Kalender"}
          </h2>
          <p className="font-semibold">
            {me.state === "reauth"
              ? "Google hat die Verbindung beendet (z. B. nach einer Passwortänderung). Ein Tipp, und es läuft wieder."
              : "Der Date-O-Mat sieht nur, wann du belegt bist – keine Termintitel, keine Details."}
          </p>
          {/* Plain <a>: the route handler redirects to Google. */}
          <a href={connectCalendarHref(next)} className={buttonClass("primary", "md", "w-full")}>
            <CalendarIcon />
            Kalender verbinden
          </a>
        </>
      ) : (
        <h2 className="text-[21px] font-bold">Fast geschafft!</h2>
      )}
      {partner && partner.state !== "connected" && (
        <p className="font-bold">
          {partner.name} muss {partner.state === "reauth" ? "den Kalender neu verbinden" : "den Kalender noch verbinden"} –
          erst dann findet der Date-O-Mat eure gemeinsamen Lücken.
        </p>
      )}
    </div>
  );
}
