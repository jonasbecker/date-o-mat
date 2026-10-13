const HEART =
  "M12 20.5C5 15.5 2.5 12.2 2.5 8.6 2.5 5.8 4.7 3.5 7.4 3.5c1.9 0 3.6 1.1 4.6 2.8 1-1.7 2.7-2.8 4.6-2.8 2.7 0 4.9 2.3 4.9 5.1 0 3.6-2.5 6.9-9.5 11.9z";

const HEARTS: Array<[x: number, y: number, color: string]> = [
  [28, 56, "#ff4f8b"],
  [44, 59, "#ffd93d"],
  [60, 57, "#a98bff"],
  [75, 52, "#3ddc97"],
  [35, 41, "#ff9f43"],
  [52, 42, "#4cc3f5"],
  [68, 37, "#ff4f8b"],
];

/** The gumball machine full of hearts. `clipId` must be unique per page. */
export function LogoMark({ size = 40, clipId = "logo-globe", title }: { size?: number; clipId?: string; title?: string }) {
  const stroke = size < 64 ? 6 : 5;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="60" cy="47" r="31" />
        </clipPath>
      </defs>
      <path
        d="M30 82 H90 L96 108 Q97 113 92 113 H28 Q23 113 24 108 Z"
        fill="#ff4f8b"
        stroke="#2a1b3d"
        strokeWidth={stroke}
        strokeLinejoin="round"
      />
      <rect x="40" y="74" width="40" height="11" rx="3" fill="#ff4f8b" stroke="#2a1b3d" strokeWidth={stroke} />
      <circle cx="60" cy="47" r="33" fill="#ffffff" stroke="#2a1b3d" strokeWidth={stroke} />
      <g clipPath={`url(#${clipId})`} stroke="#2a1b3d" strokeWidth="2.2" strokeLinejoin="round">
        {HEARTS.map(([x, y, color]) => (
          <path key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(0.8)`} fill={color} d={HEART} />
        ))}
      </g>
      <path d="M40 31 A24 24 0 0 1 53 21" fill="none" stroke="#ffffff" strokeWidth={stroke} strokeLinecap="round" />
      <rect x="50" y="8" width="20" height="9" rx="3" fill="#ff4f8b" stroke="#2a1b3d" strokeWidth={stroke - 1} />
      <circle cx="56" cy="97" r="7" fill="#ffd93d" stroke="#2a1b3d" strokeWidth={stroke - 1} />
      <rect x="74" y="100" width="12" height="7" rx="2" fill="#2a1b3d" />
    </svg>
  );
}

/** Logo mark + "Date-O-Mat" word for headers. */
export function LogoLockup({ clipId }: { clipId?: string }) {
  return (
    <span className="flex items-center gap-2">
      <LogoMark size={38} clipId={clipId} />
      <span className="font-display text-[22px] font-bold">Date-O-Mat</span>
    </span>
  );
}
