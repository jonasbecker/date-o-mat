"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { Button, buttonClass } from "@/components/button";
import { Oops } from "@/components/oops";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  // No network is the usual cause on a phone: say so, and try again by itself once it is back.
  const offline = useSyncExternalStore(subscribeOnline, () => !navigator.onLine, () => false);
  useEffect(() => {
    console.error(error);
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [error, retry]);

  return (
    <Oops
      emoji={offline ? "📡" : "🙈"}
      title={offline ? "Kein Netz" : "Hoppla!"}
      actions={
        <>
          <Button className="w-full" onClick={() => retry()}>
            Nochmal versuchen
          </Button>
          <Link href="/" className={buttonClass("secondary", "md", "w-full")}>
            Zur Startseite
          </Link>
        </>
      }
    >
      {offline ? (
        "Du bist gerade offline. Sobald das Handy wieder Netz hat, geht's hier von selbst weiter."
      ) : (
        <>
          Da ist etwas schiefgelaufen. Meistens hilft es, es gleich nochmal zu versuchen.
          {error.digest && <p className="mt-2 text-xs">Fehlercode: {error.digest}</p>}
        </>
      )}
    </Oops>
  );
}

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}
