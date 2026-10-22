/**
 * Renders a data-flow diagram — process bubbles, external rectangles, and
 * three-sided data-store boxes, with orthogonal edges.
 *
 * Skin (`DESIGN.md`): a process is a paper bubble with an ink outline; an
 * external entity is a dashed rectangle with an `EXT` chip; a data store is
 * the three-sided box on the inactive fill (`paper-2`, hairline) with a `DB`
 * chip. Flows are `muted` arrows with `.t-arrow` labels on a paper mask.
 *
 * Accent rule: when the diagram has exactly one external entity, it takes the
 * accent — the one actor the system talks to. Two or more externals, or none,
 * means no accent.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { layoutEdges } from '../svg/edgeLayout.js';
import { gapsForLabels, geometryOf, hasBackEdge, LOOP_PAD, type GeometryReport } from '../svg/geometry.js';
import { cutTitle, fitText, FONT, reportCut, type Wrapped } from '../svg/wrapText.js';
import { GROUP_PADS, gridGroupsSvg, groupExtent, groupLabelBoxes, groupPanelRects, nestingPads } from '../svg/gridGroups.js';
import { gridMetaAttrs, nodeCellAttrs } from '../svg/gridMeta.js';
import { dfdChip, dfdKindOf, dfdName, dfdPaint, dfdShape, type DfdKind, type DfdRect } from '../svg/dfdShapes.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { countPhrase, svgName } from '../svg/svgTitle.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';
import { autoDir, ensureGrid } from './autoLayout.js';

type Kind = DfdKind;
const kindOf = dfdKindOf;

/** The data-flow cell: 148 wide; the name's line room inside the shape. */
const DFD_CELL_W = 148;
const DFD_NAME_W = DFD_CELL_W - 18;
/** The most lines a node name takes; the cell grows 14px per line past one. */
const DFD_NAME_LINES = 4;

/**
 * Node names fitted to the data-flow cell (shared with `threatmodel`): word-
 * aware, a long identifier (`payment_intents_postgresql_table`) breaking at
 * its joints, up to four lines; the cell grows 14px per line past one. A
 * name still longer ends with "…" — see {@link dfdNameSvg}.
 */
export function dfdNameLines(names: readonly string[]): { lines: Wrapped[]; cellH: number } {
  const lines = names.map((n) => fitText(n, { width: DFD_NAME_W, font: FONT.name, maxLines: DFD_NAME_LINES }));
  const maxLines = Math.max(1, ...lines.map((w) => w.lines.length));
  return { lines, cellH: 66 + (maxLines - 1) * 14 };
}

/**
 * The node name as `dfdName` draws it, plus — for a cut name — the full
 * text in a `<title>` and a `label-truncated` report.
 */
export function dfdNameSvg(w: Wrapped, name: string, r: DfdRect, accent: boolean, path: string): string {
  const svg = dfdName(w.lines, name, r, accent, path);
  if (!w.truncated) return svg;
  reportCut({ path, field: 'name', full: w.full, hint: 'Shorten the node `name`.' });
  return svg.replace(/^<(g|text)([^>]*)>/, (m) => m + cutTitle(w));
}

export function renderDfd(data: BlockDataMap['dfd']): string {
  return fitDfd(data).html;
}

/** Lays out a `dfd` block in the author's direction, or the one that fits the page (see `autoDir`). */
function fitDfd(data: BlockDataMap['dfd']): { html: string; geometry: GeometryReport } {
  return autoDir(data, data.nodes ?? [], layoutDfd, (r) => r.html);
}

/** Geometry report for a `dfd` block (see `geometryReport`). */
export function dfdGeometry(data: BlockDataMap['dfd']): GeometryReport {
  return fitDfd(data).geometry;
}

/** Lays out and draws a `dfd` block: the framed HTML plus its geometry report. */
function layoutDfd(data: BlockDataMap['dfd']): { html: string; geometry: GeometryReport } {
  const edges = data.edges ?? [];
  const rawNodes = data.nodes ?? [];
  const dir = data.dir ?? 'LR';
  const quick = !(rawNodes.length > 0 && rawNodes.every((n) => n.col !== undefined && n.row !== undefined));
  const nodes = ensureGrid(rawNodes, edges, dir);
  const cellW = DFD_CELL_W;
  // Long names wrap (word- and identifier-aware, ≤4 lines) inside the shape;
  // the cell grows uniformly per extra line so wrapped labels never spill.
  const { lines: nameLines, cellH } = dfdNameLines(nodes.map((n) => n.name));
  // One column gap and one row gap, wide enough for every flow label.
  const cellOf = (id: string): (typeof nodes)[number] | undefined => nodes.find((n) => n.id === id);
  const { gapX, gapY } = gapsForLabels(edges, cellOf, dir, { gapX: 104, gapY: 54 });
  const groups = data.groups ?? [];
  // Group outlines overshoot their cells (label headroom): grow the padding
  // to fit them ONLY when groups exist, so group-less docs stay byte-identical.
  // Declared group nesting (`parent`) grows the outermost panels outward; the
  // pads grow with them so a nested group never clips at the viewBox edge.
  const nestPad = nestingPads(groups);
  // A back edge loops around its row (column in TB): room for the loop.
  const loop = hasBackEdge(edges, cellOf, dir) ? LOOP_PAD : 0;
  const padX = (groups.length > 0 ? GROUP_PADS.padX : 26) + nestPad.padX + (dir === 'TB' ? loop : 0);
  const padTop = (groups.length > 0 ? GROUP_PADS.padTop : 26) + nestPad.padTop + (dir === 'LR' ? loop : 0);
  const padBot = (groups.length > 0 ? GROUP_PADS.padBot : 20) + nestPad.padBot + (dir === 'LR' ? loop : 0);
  const gx = groupExtent(groups);
  const cols = Math.max(1, ...nodes.map((n) => n.col), gx.cols);
  const rows = Math.max(1, ...nodes.map((n) => n.row), gx.rows);
  const xOf = (c: number): number => padX + (c - 1) * (cellW + gapX);
  const yOf = (r: number): number => padTop + (r - 1) * (cellH + gapY);
  const rectFor = (n: { col: number; row: number }): {
    x: number;
    y: number;
    w: number;
    h: number;
  } => ({ x: xOf(n.col), y: yOf(n.row), w: cellW, h: cellH });
  const width = padX * 2 + cols * cellW + (cols - 1) * gapX;
  const height = padTop + rows * cellH + (rows - 1) * gapY + padBot;

  // The accent: the single external entity (see the header comment).
  const externals = nodes.filter((n) => kindOf(n.kind) === 'external');
  const accentId = externals.length === 1 ? externals[0]?.id : undefined;

  // Grid metadata for editors (Chiltepin Studio drag-to-connect): inert attrs
  // mirroring the layout constants plus each node's effective cell below.
  const gridMeta = gridMetaAttrs({ quick, cols, rows, cellW, cellH, gapX, gapY, padX, padTop });
  const a11y = svgName('Data-flow diagram', data.title, [
    countPhrase(nodes.length, 'node'),
    countPhrase(edges.length, 'flow'),
  ]);
  let s = `<svg viewBox="0 0 ${width} ${height}"${a11y.attrs}${gridMeta}>${a11y.title}`;

  // Group panels — beneath edges and nodes. Only emitted when present.
  if (groups.length > 0) s += gridGroupsSvg(groups, { xOf, yOf, cellW, cellH, gapX, gapY, skin: true });

  // Every flow is routed around the nodes, never through one, and its label
  // sits on it.
  const bounds = { x: 0, y: 0, w: width, h: height };
  const geo = { xOf, yOf, cellW, cellH, gapX, gapY };
  const { routes, labels } = layoutEdges(
    nodes.map((n) => ({ id: n.id, box: rectFor(n), radius: kindOf(n.kind) === 'process' ? 16 : 0 })),
    edges,
    edges.map((e, ei) => ({ label: e.label, path: `edges.${ei}` })),
    { dir, bounds, obstacles: groupLabelBoxes(groups, geo), rails: groupPanelRects(groups, geo) },
  );
  s += `<g${bl('edges')}>`;
  edges.forEach((_e, ei) => {
    const p = routes[ei];
    if (p === undefined) return;
    s += `<path d="${p.d}" fill="none" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#skArrow)"${bp(`edges.${ei}`)}/>`;
  });
  s += `</g>`; // close the edges list container (editors add via its chip)

  const kindsUsed = new Set<Kind>();
  s += `<g${bl('nodes')}>`;
  nodes.forEach((n, ni) => {
    const r = rectFor(n);
    const k = kindOf(n.kind);
    kindsUsed.add(k);
    const accent = n.id === accentId;
    const paint = dfdPaint(k, accent);
    const shape = dfdShape(k, r, paint);
    const chip = dfdChip(r, paint);
    const num =
      n.num !== undefined && k === 'process'
        ? `<text x="${r.x + 12}" y="${r.y + 16}" class="t-badge"${bp(`nodes.${ni}.num`)}>${escapeHtml(n.num)}</text>`
        : '';
    const name = dfdNameSvg(nameLines[ni] ?? { lines: [], truncated: false, full: '' }, n.name, r, accent, `nodes.${ni}.name`);
    s += `<g${bp(`nodes.${ni}`)}${nodeCellAttrs(n.col, n.row)}>${shape}${chip}${num}${name}</g>`;
  });
  s += `</g>`; // close the nodes list container

  s += labels.overlay; // labels on top, never crossed by a line
  s += `</svg>`;
  const steps = labels.legend;
  const geometry = geometryOf({
    nodeWord: 'node',
    edgeWord: 'flow',
    nodes: nodes.map((n, ni) => ({ id: n.id, name: n.name, path: `nodes.${ni}`, col: n.col, row: n.row })),
    edges: edges.map((e, ei) => ({ from: e.from, to: e.to, label: e.label, path: `edges.${ei}` })),
    routes,
    fallbacks: labels.fallbackIndex,
    labelBoxes: labels.boxes,
    nodeBoxes: nodes.map((n) => rectFor(n)),
    quick,
    dir,
  });

  const items: LegendItem[] = [];
  if (kindsUsed.has('process')) items.push({ swatch: 'node', label: 'process' });
  if (kindsUsed.has('external') && accentId === undefined) items.push({ swatch: 'node-dashed', label: 'external entity' });
  if (kindsUsed.has('store')) items.push({ swatch: 'node-store', label: 'data store' });
  if (edges.length > 0) items.push({ swatch: 'edge', label: 'data flow' });
  if (accentId !== undefined) items.push({ swatch: 'node-accent', label: 'external entity' });
  const legend = renderLegend(items);

  const html = diagramFrame(
    {
      tag: 'DFD',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legend.length > 0 ? { legendHtml: legend } : {}),
    },
    s + steps,
  );
  return { html, geometry };
}
