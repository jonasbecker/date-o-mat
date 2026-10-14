"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonClass } from "@/components/button";
import { Oops } from "@/components/oops";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Oops
      emoji="🙈"
      title="Hoppla!"
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
      Da ist etwas schiefgelaufen. Meistens hilft es, es gleich nochmal zu versuchen.
      {error.digest && <p className="mt-2 text-xs">Fehlercode: {error.digest}</p>}
    </Oops>
  );
}
