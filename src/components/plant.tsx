// The plant (DESIGN.md §4): stem, leaves as ellipses, a bud on top, a pot – SVG, no image file.
// The watering can belongs to whoever is on (their color); it tilts and drips when it's yours.
import { cn } from "@/lib/cn";
import { plantLayout, PLANT_BOX, POT, type BudState, type LeafKind } from "@/core/plant";

const LEAF = "#2E7D46";
const LEAF_LIGHT = "#5BAE6A";
const BUD = "#F2A7BB";

export type CanProps = { color: string; pouring: boolean };
/** The pot's face: happy (a date stands), neutral (nothing missed yet), sad with tears (missed last time, nothing planned yet). */
export type PlantMood = "happy" | "neutral" | "sad";

export function Plant({
  leaves,
  bud = "waiting",
  can,
  mood,
  fit = "box",
  label,
  className,
}: {
  leaves: readonly LeafKind[];
  bud?: BudState;
  can?: CanProps;
  mood?: PlantMood;
  /** "box": the full 390×420 box (the pot stays put); "tight": cropped to the plant (small marks). */
  fit?: "box" | "tight";
  /** Read out instead of hiding the plant, e.g. "11 Blätter". */
  label?: string;
  className?: string;
}) {
  const { leaves: shapes, stemTop, budY } = plantLayout(leaves);
  const top = Math.max(0, budY - 26);
  // A young plant is shown closer (up to 1.5×), so the screen does not look empty; from 12 leaves on it is 1:1.
  const zoom = 1 + Math.max(0, 12 - leaves.length) * 0.04;
  const w = PLANT_BOX.width / zoom;
  const h = PLANT_BOX.height / zoom;
  const viewBox = fit === "tight" ? `100 ${top} 190 ${PLANT_BOX.height - top}` : `${195 - w / 2} ${PLANT_BOX.height - h} ${w} ${h}`;
  // Pouring: beside the middle of the plant; waiting: upright, up by the bud.
  const canY = can && (can.pouring ? clamp((budY + 318) / 2 - 40, PLANT_BOX.height - h + 8, 250) : clamp(budY - 8, PLANT_BOX.height - h + 8, 230));
  const canX = Math.min(can?.pouring ? 262 : 272, 195 + w / 2 - 104);
  return (
    <svg viewBox={viewBox} preserveAspectRatio="xMidYMax meet" className={cn("block", className)} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} data-plant={leaves.length}>
      <rect x={193} y={stemTop} width={4} height={POT.rimY - stemTop + 2} rx={2} fill={LEAF} />
      {shapes.map((l, i) => {
        const transform = `rotate(${l.rotate} ${l.ox} ${l.oy})`;
        if (l.kind === "wilted") {
          return <ellipse key={i} data-leaf="wilted" cx={l.cx} cy={l.cy} rx={l.rx - 1} ry={l.ry - 1} transform={transform} fill="none" stroke={LEAF} strokeWidth={2} strokeDasharray="5 4" />;
        }
        if (l.kind === "fresh") {
          return (
            <g key={i} data-leaf="fresh" transform={transform}>
              <ellipse cx={l.cx} cy={l.cy} rx={l.rx + 6} ry={l.ry + 6} fill={BUD} opacity={0.35} className="animate-leaf-glow" />
              <ellipse cx={l.cx} cy={l.cy} rx={l.rx} ry={l.ry} fill={BUD} className="animate-leaf-grow" style={{ transformOrigin: `${l.ox}px ${l.oy}px` }} />
            </g>
          );
        }
        return <ellipse key={i} data-leaf="leaf" cx={l.cx} cy={l.cy} rx={l.rx} ry={l.ry} transform={transform} fill={l.light ? LEAF_LIGHT : LEAF} />;
      })}
      {bud !== "none" && (
        <circle
          data-bud={bud}
          cx={195}
          cy={budY}
          r={17}
          fill={bud === "filled" ? BUD : "none"}
          stroke={LEAF}
          strokeWidth={2}
          strokeDasharray={bud === "waiting" ? "5 4" : undefined}
          className={bud === "waiting" ? "animate-bud-breathe" : undefined}
          style={{ transformOrigin: `195px ${budY}px` }}
        />
      )}
      <rect x={POT.rimX} y={POT.rimY} width={POT.rimWidth} height={POT.rimHeight} rx={7} fill="#C9693F" />
      <polygon
        points={`${POT.bodyX},${POT.bodyTop} ${POT.bodyX + POT.bodyWidth},${POT.bodyTop} ${POT.bodyX + POT.bodyWidth - 16},${POT.bottom} ${POT.bodyX + 16},${POT.bottom}`}
        fill="#D97B52"
      />
      {mood && <Face mood={mood} />}
      {can && canY !== undefined && <WateringCan x={canX} y={canY} color={can.color} pouring={can.pouring} />}
    </svg>
  );
}

function WateringCan({ x, y, color, pouring }: { x: number; y: number; color: string; pouring: boolean }) {
  return (
    <g data-can={pouring ? "pouring" : "waiting"}>
      <g transform={`rotate(${pouring ? -28 : 0} ${x + 50} ${y + 33})`} className={pouring ? "animate-can-pour" : "animate-can-sway"} style={{ transformOrigin: `${x + 50}px ${y + 33}px` }}>
        <rect x={x + 32} y={y + 18} width={62} height={46} rx={18} fill={color} />
        <path d={`M${x + 48.5} ${y + 24} V${y + 16.5} a14.5 14.5 0 0 1 29 0 V${y + 24}`} fill="none" stroke={color} strokeWidth={5} />
        <rect x={x - 4} y={y + 32} width={42} height={7} rx={3.5} fill={color} transform={`rotate(-26 ${x + 38} ${y + 35.5})`} />
      </g>
      {pouring &&
        [
          [-22, 44, 0],
          [-34, 62, 0.45],
          [-16, 70, 0.9],
        ].map(([dx, dy, delay]) => (
          <path
            key={dx}
            className="animate-drip"
            style={{ animationDelay: `${delay}s` }}
            d={`M${x + dx + 3.5} ${y + dy} c2.2 3 3.5 5.2 3.5 7 a3.5 3.5 0 0 1 -7 0 c0-1.8 1.3-4 3.5-7z`}
            fill={color}
          />
        ))}
    </g>
  );
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/** Eyes and mouth on the pot – it laughs, waits or cries. */
function Face({ mood }: { mood: PlantMood }) {
  const ink = "#5A2A17";
  const eyeY = 366;
  return (
    <g data-mood={mood} aria-hidden="true">
      {mood === "happy" ? (
        // Laughing eyes: little arches
        <>
          <path d={`M170 ${eyeY + 2} q7 -8 14 0`} fill="none" stroke={ink} strokeWidth={3.5} strokeLinecap="round" />
          <path d={`M206 ${eyeY + 2} q7 -8 14 0`} fill="none" stroke={ink} strokeWidth={3.5} strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx={177} cy={eyeY} r={4.2} fill={ink} />
          <circle cx={213} cy={eyeY} r={4.2} fill={ink} />
        </>
      )}
      {mood === "happy" && (
        <>
          <ellipse cx={162} cy={378} rx={7} ry={4} fill="#F2A7BB" opacity={0.8} />
          <ellipse cx={228} cy={378} rx={7} ry={4} fill="#F2A7BB" opacity={0.8} />
          <path d="M181 378 q14 16 28 0 z" fill={ink} />
        </>
      )}
      {mood === "neutral" && <path d="M185 382 h20" stroke={ink} strokeWidth={3.5} strokeLinecap="round" />}
      {mood === "sad" && (
        <>
          <path d="M183 388 q12 -11 24 0" fill="none" stroke={ink} strokeWidth={3.5} strokeLinecap="round" />
          {/* Sad brows and tears that keep running */}
          <path d="M169 356 l12 -4" stroke={ink} strokeWidth={3} strokeLinecap="round" />
          <path d="M221 356 l-12 -4" stroke={ink} strokeWidth={3} strokeLinecap="round" />
          <path d="M175 373 q3 6 0 9 q-3 -3 0 -9 z" fill="#8EC5F0" className="animate-drip" style={{ transformBox: "fill-box" }} />
          <path d="M215 373 q3 6 0 9 q-3 -3 0 -9 z" fill="#8EC5F0" className="animate-drip [animation-delay:0.7s]" style={{ transformBox: "fill-box" }} />
        </>
      )}
    </g>
  );
}
