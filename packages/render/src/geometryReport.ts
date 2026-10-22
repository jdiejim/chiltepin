/**
 * The geometry report: what a grid diagram's layout could not avoid.
 *
 * {@link geometryReport} lays a block out exactly as its renderer does — same
 * auto-layout, router and label placement — and returns the problems: two
 * nodes in one cell, an edge forced through a node, a label that fell back to
 * a numeral, many crossings. Each issue carries a message that names the
 * nodes and edges and a hint that says the fix in the block's own data (move
 * a node, drop `col`/`row`, try `dir: TB`, shorten a label, split the
 * diagram) — never pixels. Pure: no I/O, no throw for expected input. The CLI
 * turns the issues into `W_GEOMETRY` warnings.
 *
 * Every block type also reports the text its renderer had to cut
 * (`label-truncated`): the block is rendered once, and each field the
 * renderer shortened with "…" becomes one issue that names the field and its
 * owner (see `svg/wrapText.ts`).
 */

import type { BlockDataMap, BlockType } from 'chiltepin-core';
import { blockGeometry } from './blocks/blockGraph.js';
import { c4Geometry } from './blocks/c4.js';
import { clusterGeometry } from './blocks/cluster.js';
import { dfdGeometry } from './blocks/dfd.js';
import { felogicGeometry } from './blocks/felogic.js';
import { flowGeometry } from './blocks/flow.js';
import { graphGeometry } from './blocks/graph.js';
import { pkgGeometry } from './blocks/pkg.js';
import { stateGeometry } from './blocks/state.js';
import { swimlaneGeometry } from './blocks/swimlane.js';
import { threatmodelGeometry } from './blocks/threatmodel.js';
import { cutIssues, NO_GEOMETRY, type GeometryReport } from './svg/geometry.js';
import { collectCuts } from './svg/wrapText.js';
import { htmlRenderers } from './registry.js';

export type { GeometryIssue, GeometryIssueKind, GeometryReport } from './svg/geometry.js';

/** The block types whose edges go through the shared router. */
const GEOMETRY: { readonly [K in BlockType]?: (data: BlockDataMap[K]) => GeometryReport } = {
  flow: flowGeometry,
  block: blockGeometry,
  c4: c4Geometry,
  dfd: dfdGeometry,
  state: stateGeometry,
  felogic: felogicGeometry,
  graph: graphGeometry,
  cluster: clusterGeometry,
  pkg: pkgGeometry,
  swimlane: swimlaneGeometry,
  threatmodel: threatmodelGeometry,
};

/**
 * The block types {@link geometryReport} checks: every type, because any
 * renderer may have to cut a label. The grid types also report their layout.
 */
export const GEOMETRY_TYPES: readonly BlockType[] = Object.keys(htmlRenderers) as BlockType[];

/**
 * Lays out one block and reports the geometry problems its layout could not
 * avoid, then the labels its renderer had to cut. A block type without grid
 * geometry reports only the cuts.
 *
 * @param type - The block type (canonical; aliases are resolved by the parser).
 * @param data - The block's parsed data, as the renderer receives it.
 */
export function geometryReport<K extends BlockType>(
  type: K,
  data: BlockDataMap[K],
): GeometryReport {
  const fn = GEOMETRY[type] as ((d: BlockDataMap[K]) => GeometryReport) | undefined;
  const grid = fn === undefined ? NO_GEOMETRY : fn(data);
  const render = htmlRenderers[type] as (d: BlockDataMap[K]) => string;
  const { cuts } = collectCuts(() => render(data));
  if (cuts.length === 0) return grid;
  return { ...grid, issues: [...grid.issues, ...cutIssues(cuts)] };
}
