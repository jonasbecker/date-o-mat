// A banner scene as it travels to the phone (core/banners.ts holds the whole library – only the server and the motif
// picker load that): its key, its pastel and its shapes on the 350 × 110 stage. No data here, so it costs nothing.

export type BannerShape = { l: number; t: number; w: number; h: number; c: string; r: string; rot: number; op: number; clip: string };
/** One scene, ready to draw: what `<Banner scene>` takes. */
export type SceneView = { key: string; bg: string; shapes: BannerShape[] };

export const STAGE = { width: 350, height: 110 } as const;

/** Fills the box: scaled until both width and height are covered, anchored bottom center (the sides are cut). */
export function bannerScale(width: number, height: number): number {
  return Math.max(height / STAGE.height, width / STAGE.width);
}
