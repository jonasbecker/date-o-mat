// The flower's quips on a card: which one shows, without the card art library (the swipe deck imports this on the phone).

/** The n-th quip of a list, starting at a fixed place per card (no flicker on reload). */
export function pickQuip(list: string[], seed: string, n = 0): string {
  if (list.length === 0) return "";
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[(h + n) % list.length];
}
