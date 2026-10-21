import { Plant } from "./plant";

/** The mark: a small plant in its pot (DESIGN.md – the Beet). `clipId` is kept for old call sites. */
export function LogoMark({ size = 40, title }: { size?: number; clipId?: string; title?: string }) {
  return (
    <span style={{ width: size, height: size }} className="inline-flex items-end justify-center" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <Plant leaves={["leaf", "leaf", "leaf"]} bud="filled" fit="tight" className="h-full w-auto" />
    </span>
  );
}

/** Logo mark + name for headers. */
export function LogoLockup() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark size={34} />
      <span className="font-display text-[22px] font-extrabold tracking-[-0.03em]">zweisamen</span>
    </span>
  );
}
