// "Überrasch uns": a random idea – from your wishlist or the Köln list –
// without repeating the last few picks.

import type { IdeaSize } from "@/lib/domain";

export type SurpriseCandidate = {
  key: string;
  title: string;
  size: IdeaSize;
  /** Wishlist ideas are what you chose yourselves – they come up twice as often. */
  fromWishlist: boolean;
  costEur?: number | null;
};

/**
 * Weighted random pick. `recent` are keys of the last picks (not repeated while
 * there is anything else); `random` returns a number in [0, 1) – injectable for tests.
 */
export function pickSurprise<T extends SurpriseCandidate>(
  candidates: T[],
  options: { recent?: string[]; size?: IdeaSize; random?: () => number; /** Budget left: pricier ideas only if nothing else fits. */ maxCost?: number | null } = {},
): T | null {
  const { recent = [], size, random = Math.random, maxCost = null } = options;
  const sized = size ? candidates.filter((c) => c.size === size) : candidates;
  const affordable = maxCost === null ? sized : sized.filter((c) => (c.costEur ?? 0) <= Math.max(0, maxCost));
  const bySize = affordable.length ? affordable : sized;
  const fresh = bySize.filter((c) => !recent.includes(c.key));
  const pool = fresh.length ? fresh : bySize;
  if (pool.length === 0) return null;
  const weights = pool.map((c) => (c.fromWishlist ? 2 : 1));
  let roll = random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll < 0) return pool[i];
  }
  return pool[pool.length - 1];
}
