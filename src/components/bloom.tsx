// The flower (docs/design/main-b/MAIN-B-UND-BLUME.md §3): drawn as SVG in the 300×420 box of
// components/Bloom.html – every div there is a shape here with the same coordinates, so it scales.
// The geometry is core/bloom.ts. The pot has no face; the face sits in the flower.
import { bloomGeometry, BLOOM_BOX, POT_COLORS, STIMMUNG_LABEL, type FlowerPot, type Stimmung } from "@/core/bloom";
import { cn } from "@/lib/cn";

const C = {
  stem: "#3E8E52",
  leafA: "#4FA25E",
  leafB: "#6DBA74",
  petalA: "#F2A7BB",
  petalB: "#F7C1CF",
  petalSadA: "#B48A95",
  petalSadB: "#C79AA6",
  face: "#F5D76E",
  faceSad: "#E6CF7A",
  ink: "#2B1D12",
  cheek: "#F2A7BB",
  tear: "#7FB6E8",
  tongue: "#E8708A",
  sparkle: "#F5EFC6",
  zzz: "#9FB09C",
};

export function Bloom({
  stimmung,
  blaetter,
  welk = -1,
  grund,
  topf = "terrakotta",
  className,
}: {
  stimmung: Stimmung;
  /** Leaves on the stem (0–5): your dates. */
  blaetter: number;
  /** Which of them is wilted (a missed round), −1 = none. */
  welk?: number;
  /** Background of the box (mini flowers on a light banner); none = transparent. */
  grund?: string;
  /** The pot chosen in Setup. */
  topf?: FlowerPot;
  className?: string;
}) {
  const g = bloomGeometry(stimmung, blaetter, welk);
  const { x: hx, y: hy, rotate } = g.head;
  return (
    <svg
      viewBox={`0 0 ${BLOOM_BOX.width} ${BLOOM_BOX.height}`}
      preserveAspectRatio="xMidYMax meet"
      role="img"
      aria-label={STIMMUNG_LABEL[stimmung]}
      data-bloom={stimmung}
      data-leaves={g.leaves.length}
      className={cn("block", className)}
    >
      {grund && <rect width={BLOOM_BOX.width} height={BLOOM_BOX.height} fill={grund} />}
      <path d={g.stem} fill="none" stroke={C.stem} strokeWidth={6} strokeLinecap="round" />

      {g.leaves.map((l, i) => (
        <ellipse
          key={i}
          data-leaf={l.dead ? "wilted" : "leaf"}
          cx={l.x + l.w / 2}
          cy={l.y + l.h / 2}
          // The mockup's border sits inside the box (border-box).
          rx={l.dead ? l.w / 2 - 1 : l.w / 2}
          ry={l.dead ? l.h / 2 - 1 : l.h / 2}
          transform={`rotate(${l.rotate} ${l.originX} ${l.originY})`}
          fill={l.dead ? "none" : l.light ? C.leafB : C.leafA}
          stroke={l.dead ? C.leafB : undefined}
          strokeWidth={l.dead ? 2 : undefined}
          strokeDasharray={l.dead ? "6 4" : undefined}
        />
      ))}

      <g transform={`translate(${hx} ${hy}) rotate(${rotate})`}>
        {g.petals.map((p, i) => (
          <circle key={i} cx={p.x + p.d / 2} cy={p.y + p.d / 2} r={p.d / 2} fill={g.face.sad ? (p.light ? C.petalSadB : C.petalSadA) : p.light ? C.petalB : C.petalA} />
        ))}
        {g.bud && (
          // The closed bud: two pink tips over a green bulb.
          <>
            <ellipse cx={0} cy={-37} rx={12} ry={17} transform="rotate(-14 0 -37)" fill={C.petalA} />
            <ellipse cx={9} cy={-36} rx={11} ry={16} transform="rotate(16 9 -36)" fill={C.petalB} />
            <path d="M-34 0 C-34 -22 -18.8 -40 0 -40 C18.8 -40 34 -22 34 0 C34 22.1 18.8 40 0 40 C-18.8 40 -34 22.1 -34 0 Z" fill={C.leafA} />
          </>
        )}
        {g.face.visible && <circle cx={0} cy={0} r={g.face.d / 2} fill={g.face.sad ? C.faceSad : C.face} />}

        {g.eyes === "dot" && (
          <>
            <ellipse cx={g.eyeL + 4} cy={-4} rx={4} ry={5} fill={C.ink} />
            <ellipse cx={g.eyeR + 4} cy={-4} rx={4} ry={5} fill={C.ink} />
          </>
        )}
        {g.eyes === "happy" && (
          <g fill="none" stroke={C.ink} strokeWidth={3} strokeLinecap="round">
            <path d="M-15.5 -2 A4.5 5.5 0 0 1 -6.5 -2" />
            <path d="M6.5 -2 A4.5 5.5 0 0 1 15.5 -2" />
          </g>
        )}
        {g.eyes === "closed" && (
          <g fill="none" stroke={C.ink} strokeWidth={3} strokeLinecap="round">
            <path d="M-13.5 -6.5 A4 3.5 0 0 0 -5.5 -6.5" />
            <path d="M5.5 -6.5 A4 3.5 0 0 0 13.5 -6.5" />
          </g>
        )}
        {g.brows && (
          <>
            <rect x={-19} y={-17} width={11} height={3} rx={1.5} fill={C.ink} transform="rotate(-20 -13.5 -15.5)" />
            <rect x={8} y={-17} width={11} height={3} rx={1.5} fill={C.ink} transform="rotate(20 13.5 -15.5)" />
          </>
        )}
        {g.tear && <path d="M12 2 C14.5 5.5 15 7.5 15 8 A3 3.4 0 0 1 9 8 C9 7.5 9.5 5.5 12 2 Z" fill={C.tear} className="animate-drip [animation-duration:2.4s]" style={{ transformBox: "fill-box" }} />}
        {g.blush && (
          <>
            <ellipse cx={-21} cy={3} rx={5} ry={3} fill={C.cheek} />
            <ellipse cx={21} cy={3} rx={5} ry={3} fill={C.cheek} />
          </>
        )}

        {g.mouth === "smile" && <path d="M-7.5 2.5 A7.5 7 0 0 0 7.5 2.5" fill="none" stroke={C.ink} strokeWidth={3} strokeLinecap="round" />}
        {g.mouth === "big" && (
          <>
            <clipPath id="bloom-mouth">
              <path d="M-11 3 H11 A11 12 0 0 1 -11 3 Z" />
            </clipPath>
            <path d="M-11 3 H11 A11 12 0 0 1 -11 3 Z" fill={C.ink} />
            <ellipse cx={0} cy={13} rx={6} ry={4} fill={C.tongue} clipPath="url(#bloom-mouth)" />
          </>
        )}
        {g.mouth === "frown" && <path d="M-7.5 13 A7.5 6 0 0 1 7.5 13" fill="none" stroke={C.ink} strokeWidth={3} strokeLinecap="round" />}
        {g.mouth === "o" && <circle cx={0} cy={8} r={3} fill="none" stroke={C.ink} strokeWidth={2} />}
      </g>

      {g.sparkles.map((s, i) => (
        <rect key={i} x={s.x} y={s.y} width={s.d} height={s.d} rx={2} fill={C.sparkle} transform={`rotate(45 ${s.x + s.d / 2} ${s.y + s.d / 2})`} className="animate-bud-breathe" style={{ transformOrigin: `${s.x + s.d / 2}px ${s.y + s.d / 2}px`, animationDelay: `${i * 0.4}s` }} />
      ))}
      {g.zzz && (
        <text x={196} y={54} fontFamily="var(--font-dm-mono), monospace" fill={C.zzz} fontSize={16}>
          z
          <tspan x={208} dy={14} fontSize={12}>
            z
          </tspan>
        </text>
      )}
      {g.fallen && <ellipse cx={251} cy={406} rx={13} ry={8} transform="rotate(-20 251 406)" fill={C.petalSadB} />}

      <rect x={62} y={330} width={176} height={20} rx={10} fill={POT_COLORS[topf].rim} data-pot={topf} />
      <polygon points="72,348 228,348 209.28,420 90.72,420" fill={POT_COLORS[topf].body} />
    </svg>
  );
}
