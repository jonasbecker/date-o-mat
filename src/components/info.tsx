import { useId } from "react";
import { cn } from "@/lib/cn";
import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";

/**
 * ⓘ button with a short explanation. Uses the browser's popover: opens on tap,
 * closes on tap outside or Escape – no JavaScript of our own.
 */
export function Info({ term, className }: { term: GlossaryKey; className?: string }) {
  const id = useId();
  const { title, text } = GLOSSARY[term];
  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        aria-label={`Was heißt „${title}“?`}
        className={cn(
          "inline-flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-current align-middle font-serif text-[11px] font-bold italic leading-none opacity-60 hover:opacity-100",
          className,
        )}
      >
        i
      </button>
      {/* <span>s only: the button often sits inside a <p> or a heading. */}
      <span
        id={id}
        popover="auto"
        role="note"
        className="m-auto w-[min(340px,calc(100vw-32px))] font-sans text-base font-normal normal-case tracking-normal not-italic leading-normal rounded-[22px] bg-surface p-4 text-left text-ink shadow-[0_18px_40px_rgba(22,58,34,0.18)] backdrop:bg-tinte/30"
      >
        <span className="block text-lg font-bold">{title}</span>
        <span className="mt-1 block text-base text-muted not-italic">{text}</span>
        <button type="button" popoverTarget={id} popoverTargetAction="hide" className="mt-3 text-sm font-bold underline">
          Verstanden
        </button>
      </span>
    </>
  );
}
