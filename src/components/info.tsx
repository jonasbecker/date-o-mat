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
          "inline-flex size-[22px] shrink-0 items-center justify-center rounded-full border-2 border-current align-middle font-serif text-[13px] font-bold italic leading-none opacity-70 hover:opacity-100",
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
        className="m-auto w-[min(340px,calc(100vw-32px))] font-sans text-base font-normal normal-case tracking-normal not-italic leading-normal rounded-[22px] border-[2.5px] border-line bg-surface p-4 text-left text-ink shadow-[5px_5px_0_var(--line)] backdrop:bg-tinte/30"
      >
        <span className="block font-display text-lg font-semibold">{title}</span>
        <span className="mt-1 block text-base font-semibold not-italic">{text}</span>
        <button type="button" popoverTarget={id} popoverTargetAction="hide" className="mt-3 text-sm font-extrabold underline">
          Verstanden
        </button>
      </span>
    </>
  );
}
