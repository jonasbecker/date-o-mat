"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/button";
import { ShareIcon } from "@/components/icons";

/** Share button for the invite code: native share sheet, clipboard as fallback. */
export function InviteShare({ code, joinUrl }: { code: string; joinUrl: string }) {
  const [copied, setCopied] = useState(false);
  const text = `Komm in unseren Date-O-Mat! 💞 Melde dich an und gib diesen Code ein: ${code}`;

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Date-O-Mat", text, url: joinUrl });
        return;
      } catch {
        // Share sheet dismissed – fall through to copying.
      }
    }
    await navigator.clipboard.writeText(`${text}\n${joinUrl}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button onClick={share} className="w-full">
      <ShareIcon />
      {copied ? "Kopiert!" : "Code teilen"}
    </Button>
  );
}

/** Re-checks every few seconds whether the partner joined; the page then redirects home. */
export function PartnerWatcher() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 4000);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
