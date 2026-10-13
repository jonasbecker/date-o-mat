"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "./button";
import { useCelebrate } from "./celebration";

/**
 * Button for a joyful server action ("Passt!", "Übernehmen"): runs the action
 * (which refreshes the page itself), celebrates, optionally navigates.
 */
export function ConfettiActionButton({
  action,
  children,
  variant = "success",
  size = "lg",
  className,
  goTo,
}: {
  action: () => Promise<{ ok: boolean; message?: string }>;
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  goTo?: string;
}) {
  const router = useRouter();
  const celebrate = useCelebrate();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            const result = await action();
            if (!result.ok) {
              setMessage(result.message ?? "Das hat nicht geklappt. Bitte nochmal versuchen.");
              return;
            }
            celebrate();
            if (goTo) router.push(goTo);
          })
        }
      >
        {children}
      </Button>
      {message && (
        <p role="alert" className="text-sm font-bold">
          {message}
        </p>
      )}
    </>
  );
}
