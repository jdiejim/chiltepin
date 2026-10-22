/**
 * Manhattan / orthogonal edge routing between two rectangular nodes.
 *
 * Returns the SVG path `d` attribute and a midpoint for label placement.
 * The route turns at the midpoint along the dominant axis, so edges read
 * cleanly even when the source and target overlap on one axis.
 *
 * Kept as a public helper for a single edge between two boxes. It knows
 * nothing about other nodes: the grid diagram renderers route through the
 * obstacle-aware router in `router.ts` instead.
 *
 * Ported from `resources/doc-studio.jsx` `ortho`.
 */

/** A rectangular node bounding box (top-left + size). */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Routed edge: SVG `d` plus a midpoint for the edge label. */
export interface Route {
  readonly d: string;
  readonly lx: number;
  readonly ly: number;
}

/**
 * Routes an orthogonal edge from box A to box B.
 *
 * @param A - Source box.
 * @param B - Target box.
 * @param lane - Perpendicular offset lane (±1) so an A→B / B→A pair renders
 *   as two parallel arrows instead of one line drawn twice. 0 = centered.
 * @param entry - Entry-port offset along B's entry side (px), so several
 *   edges into one side do not stack their arrowheads. 0 = the side's
 *   center (the historical geometry, byte-identical).
 * @returns SVG path data and label midpoint.
 */
export function ortho(A: Box, B: Box, lane = 0, entry = 0): Route {
  const off = lane * 10;
  const a = { x: A.x + A.w / 2, y: A.y + A.h / 2 };
  const b = { x: B.x + B.w / 2, y: B.y + B.h / 2 };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const sx = dx >= 0 ? A.x + A.w : A.x;
    const ex = dx >= 0 ? B.x : B.x + B.w;
    const sy = a.y + off;
    const ey = b.y + off + entry;
    const mx = (sx + ex) / 2;
    return { d: `M ${sx} ${sy} H ${mx} V ${ey} H ${ex}`, lx: mx, ly: (sy + ey) / 2 };
  }
  const sy = dy >= 0 ? A.y + A.h : A.y;
  const ey = dy >= 0 ? B.y : B.y + B.h;
  const sx = a.x + off;
  const ex = b.x + off + entry;
  const my = (sy + ey) / 2;
  return { d: `M ${sx} ${sy} V ${my} H ${ex} V ${ey}`, lx: (sx + ex) / 2, ly: my };
}

