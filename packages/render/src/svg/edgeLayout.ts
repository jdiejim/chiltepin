/**
 * The edge layer of a grid diagram in one call: route every edge around the
 * nodes ({@link routeEdges}), set every label on its own edge
 * ({@link edgeLabelLayer}), then move other routes off the placed labels
 * ({@link moveOffLabels}) so no label hides a line it does not belong to.
 *
 * The renderer draws `routes[i].d` for each edge, draws its nodes, and puts
 * `labels.overlay` on top. Everything is derived from the data; the result is
 * deterministic.
 */

import type { Box } from './ortho.js';
import {
  edgeLabelLayer,
  type EdgeLabelPoint,
  type LabelLayer,
  type LabelLayerOptions,
} from './edgeSteps.js';
import { routeMidpoint } from './geometry.js';
import type { Hue } from './hues.js';
import {
  moveOffLabels,
  routeEdges,
  type Pt,
  type RouteEdge,
  type RoutedEdge,
  type RouteNode,
  type RouterOptions,
} from './router.js';

/** What a label needs to know about its edge. */
export interface EdgeMeta {
  readonly label?: string | undefined;
  readonly err?: boolean;
  /** The edge carries the diagram's accent. */
  readonly accent?: boolean;
  /** Data path of the edge in the block's YAML, e.g. `edges.3`. */
  readonly path: string;
  /** Deck build step (`data-reveal`), when the renderer orders its edges. */
  readonly reveal?: number;
  /** The request step the edge carries; its numeral is set with the label. */
  readonly step?: number;
  /** The hue of the step numeral (the edge's named path). */
  readonly hue?: Hue;
}

/** Options for {@link layoutEdges}. */
export interface EdgeLayoutOptions extends RouterOptions {
  /** Boxes a label keeps clear of; defaults to every node's obstacle box. */
  readonly avoid?: readonly Box[];
}

/** The routed, labelled edges of one diagram. */
export interface EdgeLayout {
  /** One route per edge (aligned by index; `undefined` for an unknown end). */
  readonly routes: ReadonlyArray<RoutedEdge | undefined>;
  /** The label overlay; `fallbackIndex` and `placed[].index` are EDGE indices. */
  readonly labels: LabelLayer;
}

/** Inputs to {@link settleLabels}. */
export interface SettleInput {
  /** The routes as the router left them. */
  readonly routes: ReadonlyArray<RoutedEdge | undefined>;
  /** Label metadata per edge (aligned with `routes`). */
  readonly meta: ReadonlyArray<EdgeMeta | undefined>;
  /** Boxes a label keeps clear of (nodes, captions). */
  readonly avoid: readonly Box[];
  /** Boxes a moved route keeps clear of (nodes, group tabs). */
  readonly obstacles: readonly Box[];
  readonly bounds: Box;
  /**
   * The points a label rides for an edge with no route (a renderer's own
   * self-loop arc); return `undefined` to leave the edge unlabelled.
   */
  readonly pointsOf?: (edge: number) => readonly Pt[] | undefined;
  /** Passed to the label layer (fallback numbering, legend). */
  readonly labelOptions?: Pick<LabelLayerOptions, 'stepNumber' | 'noLegend'>;
  /** Panel borders a label should not sit on (soft, like another edge's line). */
  readonly rails?: readonly Box[];
}

/** A box's outline as a closed polyline. */
export function outline(b: Box): Pt[] {
  return [
    { x: b.x, y: b.y },
    { x: b.x + b.w, y: b.y },
    { x: b.x + b.w, y: b.y + b.h },
    { x: b.x, y: b.y + b.h },
    { x: b.x, y: b.y },
  ];
}

/** Rounds of "place labels, move lines off them" before the labels settle. */
const SETTLE_ROUNDS = 2;

/**
 * Places the labels on their routes, then moves any route that runs under
 * another edge's label and places the labels again on the moved routes — a
 * couple of rounds, until nothing moves. Returns the final routes and labels
 * (indices in the result are EDGE indices).
 */
export function settleLabels(input: SettleInput): EdgeLayout {
  const place = (
    routes: ReadonlyArray<RoutedEdge | undefined>,
  ): { layer: LabelLayer; edgeOf: number[] } => {
    const pending: EdgeLabelPoint[] = [];
    const edgeOf: number[] = [];
    input.meta.forEach((m, i) => {
      const pts = routes[i]?.points ?? input.pointsOf?.(i);
      if (m === undefined || pts === undefined) return;
      pending.push({ ...routeMidpoint(pts), points: pts, ...m });
      edgeOf.push(i);
    });
    const layer = edgeLabelLayer(pending, input.avoid, {
      skin: true,
      bounds: input.bounds,
      routes: [...routes.map((r) => r?.points), ...(input.rails ?? []).map(outline)],
      ...(input.labelOptions?.stepNumber !== undefined
        ? {
            stepNumber: (k: number) =>
              (input.labelOptions?.stepNumber as (i: number) => number)(edgeOf[k] ?? k),
          }
        : {}),
      ...(input.labelOptions?.noLegend === true ? { noLegend: true } : {}),
    });
    return { layer, edgeOf };
  };
  let routes = input.routes;
  let placed = place(routes);
  for (let round = 0; round < SETTLE_ROUNDS; round++) {
    const boxes = placed.layer.placed.map((p) => ({
      box: p.box,
      edge: placed.edgeOf[p.index] ?? -1,
    }));
    const moved = moveOffLabels(routes, boxes, input.obstacles, input.bounds, undefined, false);
    if (moved.every((r, i) => r === routes[i])) break;
    routes = moved;
    placed = place(routes);
  }
  const { layer, edgeOf } = placed;
  return {
    routes,
    labels: {
      ...layer,
      fallbackIndex: layer.fallbackIndex.map((k) => edgeOf[k] ?? k),
      placed: layer.placed.map((p) => ({ index: edgeOf[p.index] ?? p.index, box: p.box })),
    },
  };
}

/** Routes and labels every edge of a grid diagram (see the module comment). */
export function layoutEdges(
  nodes: readonly RouteNode[],
  edges: readonly RouteEdge[],
  meta: readonly EdgeMeta[],
  opts: EdgeLayoutOptions,
): EdgeLayout {
  const solid = nodes.filter((n) => n.passable !== true).map((n) => n.obstacle ?? n.box);
  const obstacles = [...solid, ...(opts.obstacles ?? [])];
  return settleLabels({
    routes: routeEdges(nodes, edges, opts),
    meta,
    avoid: opts.avoid ?? solid,
    obstacles,
    bounds: opts.bounds,
    ...(opts.rails !== undefined ? { rails: opts.rails } : {}),
  });
}
