// The picture strip of a swipe card (SWIPE-KARTE.md §2/§4): simple drawings from soft shapes, 2–4 colors,
// no outlines – like the crêpes and the microphone in SwipeC.html. Each one fits a 100 × 80 box with its
// ground at about y = 72; a card shows one or two side by side on its pastel. All of them: /dev/illustrationen.
import type { Illustration } from "@/core/card-art";

const ART: Record<Illustration, React.ReactNode> = {
  crepes: (
    <>
      <ellipse cx="50" cy="73" rx="40" ry="5" fill="#E2B9A7" />
      <ellipse cx="50" cy="66" rx="30" ry="7" fill="#E9C38A" />
      <ellipse cx="50" cy="58" rx="28" ry="7" fill="#F0D29E" />
      <ellipse cx="50" cy="50" rx="26" ry="7" fill="#E9C38A" />
      <rect x="40" y="41" width="16" height="7" rx="2.5" fill="#FFF6D8" />
    </>
  ),
  teller: (
    <>
      <ellipse cx="50" cy="66" rx="36" ry="10" fill="#FFFFFF" />
      <ellipse cx="50" cy="64" rx="24" ry="6" fill="#F3EDE2" />
      <circle cx="44" cy="58" r="8" fill="#E58FA6" />
      <circle cx="56" cy="58" r="7" fill="#8FB46A" />
      <circle cx="51" cy="52" r="6" fill="#F0B95A" />
      <rect x="88" y="40" width="3.5" height="32" rx="1.75" fill="#B9A58C" />
      <rect x="9" y="40" width="3.5" height="32" rx="1.75" fill="#B9A58C" />
    </>
  ),
  glaeser: (
    <>
      <ellipse cx="50" cy="73" rx="34" ry="4" fill="#E2B9A7" opacity="0.7" />
      <g transform="rotate(-10 36 50)">
        <path d="M24 26h24c0 14-5 22-12 22s-12-8-12-22z" fill="#F3F7F1" />
        <path d="M26 34h20c-1 8-5 12-10 12s-9-4-10-12z" fill="#B54A6A" />
        <rect x="34.5" y="47" width="3" height="20" fill="#F3F7F1" />
        <rect x="28" y="66" width="16" height="4" rx="2" fill="#F3F7F1" />
      </g>
      <g transform="rotate(10 64 50)">
        <path d="M52 26h24c0 14-5 22-12 22s-12-8-12-22z" fill="#F3F7F1" />
        <path d="M54 34h20c-1 8-5 12-10 12s-9-4-10-12z" fill="#E6B54A" />
        <rect x="62.5" y="47" width="3" height="20" fill="#F3F7F1" />
        <rect x="56" y="66" width="16" height="4" rx="2" fill="#F3F7F1" />
      </g>
    </>
  ),
  mikro: (
    <>
      <ellipse cx="50" cy="73" rx="16" ry="3.5" fill="#C9B3BE" />
      <rect x="48.5" y="34" width="3" height="38" rx="1.5" fill="#E58FA6" />
      <rect x="44" y="34" width="12" height="14" rx="4" fill="#D97C95" />
      <circle cx="50" cy="24" r="13" fill="#E58FA6" />
      <circle cx="45" cy="20" r="3.5" fill="#F4B9C8" />
    </>
  ),
  gitarre: (
    <>
      <rect x="47" y="6" width="6" height="40" rx="2" fill="#8A6440" />
      <rect x="45" y="3" width="10" height="8" rx="2" fill="#6B4A33" />
      <circle cx="50" cy="48" r="13" fill="#E6A15A" />
      <circle cx="50" cy="62" r="16" fill="#E6A15A" />
      <circle cx="50" cy="54" r="5" fill="#6B4A33" />
      <rect x="43" y="66" width="14" height="3.5" rx="1.75" fill="#6B4A33" />
    </>
  ),
  baum: (
    <>
      <ellipse cx="50" cy="73" rx="34" ry="4" fill="#A9C79A" />
      <rect x="46" y="42" width="8" height="31" rx="3" fill="#8A6440" />
      <circle cx="50" cy="30" r="20" fill="#8FB46A" />
      <circle cx="36" cy="38" r="12" fill="#7AA25A" />
      <circle cx="64" cy="38" r="12" fill="#7AA25A" />
      <circle cx="44" cy="24" r="5" fill="#A9CB86" />
    </>
  ),
  sonne: (
    <>
      <circle cx="58" cy="30" r="15" fill="#F5C84B" />
      <circle cx="58" cy="30" r="21" fill="#F5C84B" opacity="0.3" />
      <ellipse cx="34" cy="78" rx="42" ry="22" fill="#8FB46A" />
      <ellipse cx="78" cy="80" rx="34" ry="16" fill="#7AA25A" />
    </>
  ),
  welle: (
    <>
      <circle cx="72" cy="22" r="10" fill="#F5C84B" />
      <path d="M0 52c10-8 20-8 30 0s20 8 30 0 20-8 30 0 10 8 10 8v28H0z" fill="#8DB6E0" />
      <path d="M0 62c10-7 20-7 30 0s20 7 30 0 20-7 30 0 10 7 10 7v19H0z" fill="#6E9BCB" />
    </>
  ),
  boot: (
    <>
      <ellipse cx="50" cy="72" rx="44" ry="6" fill="#8DB6E0" />
      <path d="M20 58h60l-9 13H29z" fill="#E58FA6" />
      <rect x="48.5" y="16" width="3" height="42" fill="#8A6440" />
      <path d="M52 18l24 34H52z" fill="#FFFFFF" />
      <path d="M48 26L30 52h18z" fill="#F7EBC4" />
    </>
  ),
  rahmen: (
    <>
      <rect x="22" y="12" width="56" height="52" rx="4" fill="#B9875A" />
      <rect x="28" y="18" width="44" height="40" rx="2" fill="#FFF6D8" />
      <path d="M28 58l14-20 10 12 8-8 12 16z" fill="#8FB46A" />
      <circle cx="60" cy="29" r="5" fill="#E58FA6" />
      <rect x="47" y="64" width="6" height="9" fill="#8A6440" />
    </>
  ),
  maske: (
    <>
      <g transform="rotate(-12 38 40)">
        <circle cx="38" cy="40" r="20" fill="#F7EBC4" />
        <ellipse cx="31" cy="35" rx="4" ry="3" fill="#2A1E44" />
        <ellipse cx="45" cy="35" rx="4" ry="3" fill="#2A1E44" />
        <path d="M28 46c4 8 16 8 20 0z" fill="#B54A6A" />
      </g>
      <g transform="rotate(12 64 46)">
        <circle cx="64" cy="46" r="18" fill="#B9A5D9" />
        <ellipse cx="58" cy="42" rx="3.5" ry="2.5" fill="#2A1E44" />
        <ellipse cx="70" cy="42" rx="3.5" ry="2.5" fill="#2A1E44" />
        <path d="M56 56c4-6 12-6 16 0z" fill="#2A1E44" />
      </g>
    </>
  ),
  pinsel: (
    <>
      <circle cx="30" cy="62" r="9" fill="#E58FA6" />
      <circle cx="46" cy="68" r="7" fill="#8DB6E0" />
      <circle cx="62" cy="64" r="8" fill="#F5C84B" />
      <g transform="rotate(35 58 34)">
        <rect x="55" y="4" width="7" height="40" rx="3" fill="#B9875A" />
        <rect x="54" y="42" width="9" height="6" fill="#C9C2A0" />
        <path d="M54 48h9c0 8-2 14-4.5 16-2.5-2-4.5-8-4.5-16z" fill="#E58FA6" />
      </g>
    </>
  ),
  ton: (
    <>
      <ellipse cx="50" cy="72" rx="34" ry="5" fill="#B9A58C" />
      <path d="M38 20h24c-2 6-1 10 4 18 6 10 3 26-16 26S28 48 34 38c5-8 6-12 4-18z" fill="#D68456" />
      <ellipse cx="50" cy="20" rx="12" ry="3.5" fill="#B96C42" />
      <rect x="36" y="42" width="28" height="4" rx="2" fill="#E9A47E" />
    </>
  ),
  ball: (
    <>
      <ellipse cx="50" cy="73" rx="22" ry="4" fill="#B9C7D9" />
      <circle cx="50" cy="44" r="26" fill="#F3F7F1" />
      <path d="M50 44L50 18a26 26 0 0 1 22.5 13z" fill="#E58FA6" />
      <path d="M50 44l22.5 13a26 26 0 0 1-22.5 13z" fill="#8DB6E0" />
      <path d="M50 44v26a26 26 0 0 1-22.5-13z" fill="#F5C84B" />
      <path d="M50 44L27.5 31A26 26 0 0 1 50 18z" fill="#8FB46A" />
      <circle cx="50" cy="44" r="4" fill="#F3F7F1" />
    </>
  ),
  berg: (
    <>
      <path d="M4 74L36 22l32 52z" fill="#7F96B8" />
      <path d="M36 74L66 30l30 44z" fill="#9AB0CF" />
      <path d="M36 22l9 15-5-3-4 4-4-4-5 3z" fill="#FFFFFF" />
      <path d="M66 30l8 12-4-2-4 3-4-3-4 2z" fill="#FFFFFF" />
    </>
  ),
  mond: (
    <>
      <path d="M58 12a26 26 0 1 0 22 40A22 22 0 1 1 58 12z" fill="#8E9BD6" />
      <circle cx="22" cy="20" r="2.5" fill="#F5C84B" />
      <circle cx="84" cy="16" r="2" fill="#F5C84B" />
      <circle cx="16" cy="54" r="2" fill="#F5C84B" />
      <circle cx="88" cy="62" r="2.5" fill="#F5C84B" />
    </>
  ),
  kerze: (
    <>
      <circle cx="50" cy="26" r="20" fill="#F5C84B" opacity="0.28" />
      <ellipse cx="50" cy="72" rx="22" ry="4" fill="#C9B3BE" />
      <rect x="40" y="36" width="20" height="36" rx="3" fill="#F3F7F1" />
      <rect x="49" y="29" width="2" height="8" fill="#6B4A33" />
      <path d="M50 12c5 6 6 11 6 14a6 6 0 0 1-12 0c0-3 1-8 6-14z" fill="#F0A33C" />
      <path d="M50 19c2.5 3 3 5 3 7a3 3 0 0 1-6 0c0-2 .5-4 3-7z" fill="#F7E07A" />
    </>
  ),
  tasse: (
    <>
      <ellipse cx="46" cy="72" rx="30" ry="5" fill="#E2B9A7" />
      <path d="M60 40h6a10 10 0 0 1 0 20h-6v-6h6a4 4 0 0 0 0-8h-6z" fill="#E58FA6" />
      <path d="M26 36h36v20a14 14 0 0 1-14 14h-8a14 14 0 0 1-14-14z" fill="#E58FA6" />
      <ellipse cx="44" cy="36" rx="18" ry="4" fill="#B96C42" />
      <rect x="34" y="12" width="5" height="16" rx="2.5" fill="#FFFFFF" opacity="0.8" />
      <rect x="46" y="8" width="5" height="20" rx="2.5" fill="#FFFFFF" opacity="0.8" />
    </>
  ),
  dampf: (
    <>
      <rect x="26" y="10" width="7" height="30" rx="3.5" fill="#FFFFFF" opacity="0.85" />
      <rect x="44" y="4" width="7" height="36" rx="3.5" fill="#FFFFFF" opacity="0.85" />
      <rect x="62" y="12" width="7" height="28" rx="3.5" fill="#FFFFFF" opacity="0.85" />
      <path d="M22 48h56l-6 24H28z" fill="#B9875A" />
      <rect x="20" y="44" width="60" height="7" rx="3" fill="#8A6440" />
      <ellipse cx="74" cy="66" rx="9" ry="6" fill="#8DB6E0" />
    </>
  ),
  blume: (
    <>
      <ellipse cx="50" cy="73" rx="24" ry="4" fill="#A9C79A" />
      <rect x="48.5" y="34" width="3" height="39" fill="#4FA25E" />
      <ellipse cx="60" cy="56" rx="9" ry="4.5" fill="#6DBA74" transform="rotate(-25 60 56)" />
      <circle cx="50" cy="16" r="8" fill="#E58FA6" />
      <circle cx="61" cy="25" r="8" fill="#E58FA6" />
      <circle cx="57" cy="38" r="8" fill="#E58FA6" />
      <circle cx="43" cy="38" r="8" fill="#E58FA6" />
      <circle cx="39" cy="25" r="8" fill="#E58FA6" />
      <circle cx="50" cy="28" r="7" fill="#F5C84B" />
    </>
  ),
  zug: (
    <>
      <rect x="4" y="71" width="92" height="3" rx="1.5" fill="#8A6440" />
      <rect x="14" y="26" width="72" height="38" rx="10" fill="#E58FA6" />
      <rect x="22" y="34" width="14" height="12" rx="3" fill="#F3F7F1" />
      <rect x="43" y="34" width="14" height="12" rx="3" fill="#F3F7F1" />
      <rect x="64" y="34" width="14" height="12" rx="3" fill="#F3F7F1" />
      <rect x="14" y="52" width="72" height="5" fill="#D97C95" />
      <circle cx="30" cy="67" r="5" fill="#4A5547" />
      <circle cx="70" cy="67" r="5" fill="#4A5547" />
    </>
  ),
};

/** One drawing, 100 × 80. */
export function IllustrationArt({ name, className }: { name: Illustration; className?: string }) {
  return (
    <svg viewBox="0 0 100 80" className={className} aria-hidden="true" data-illustration={name}>
      {ART[name]}
    </svg>
  );
}

/** The card's picture strip: the pastel and one or two drawings, side by side. */
export function IllustrationStrip({ names, hex, className }: { names: Illustration[]; hex: string; className?: string }) {
  return (
    <div aria-hidden="true" className={className} style={{ background: hex }} data-illustrations={names.join(" ")}>
      <div className="flex h-full items-end justify-center gap-1 pt-2.5">
        {names.slice(0, 2).map((name) => (
          <IllustrationArt key={name} name={name} className="h-full max-h-[96px] w-auto" />
        ))}
      </div>
    </div>
  );
}
