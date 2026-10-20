/** The top row of the planning flow: back on the left, the dots in the middle (where the Beet has them), meta on the right. */
export function TopRow({ back, center, meta }: { back: React.ReactNode; center?: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <div className="relative flex h-11 items-center justify-between">
      {back}
      {center && <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">{center}</span>}
      <span className="w-11 text-right font-mono text-[11px]">{meta ?? ""}</span>
    </div>
  );
}
