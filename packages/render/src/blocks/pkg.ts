/**
 * Renders a `pkg` block — a UML package diagram: packages as tabbed folders
 * on a grid, members printed inside, dependencies as dashed arrows with an
 * optional «import» / «use» / «access» / «merge» stereotype.
 *
 * Layout: leaf packages take their `col` / `row`, or a dagre grid when any
 * is missing (`ensureGrid`). A package named as another's `parent` is drawn
 * as a larger folder around its children's cells — a group panel with a
 * tab — and nests to any depth; its bounds come from its children, never
 * from the author.
 *
 * Skin (`DESIGN.md`): a leaf folder is paper with an ink outline; a parent
 * folder is the inactive panel (`paper-2`, hairline) so the leaves read as
 * objects inside it. Members are `.t-sub` mono lines under a hairline, at
 * most twelve and then `+n more` (the rest in its title). Dependencies are
 * the dashed `muted` arrow with the stereotype and label on a paper mask.
 * Zero accent.
 *
 * Text: every leaf folder takes one width — wide enough for its longest
 * member and name part, up to a cap — and one height. A long name wraps at
 * its dots (`com.example.` · `checkout.`), a long member at its joints, with
 * the continuation indented; nothing is cut unless it passes the caps.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import type { Box } from '../svg/ortho.js';
import { layoutEdges } from '../svg/edgeLayout.js';
import { gapsForLabels, geometryOf, type GeometryReport } from '../svg/geometry.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { countPhrase, svgName } from '../svg/svgTitle.js';
import { cutTitle, ellipsize, fitText, FONT, reportCut, splitIdentifier, textWidth, type Wrapped } from '../svg/wrapText.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';
import { ensureGrid } from './autoLayout.js';

type Pkg = BlockDataMap['pkg']['packages'][number];

const CELL_W = 168;
/** The widest a leaf folder grows to fit its members and name. */
const MAX_CELL_W = 264;
const GAP_X = 128;
const GAP_Y = 56;
const TAB_W = 54;
const TAB_H = 12;
const HEAD_H = 26;
/** Baseline step of a wrapped package name. */
const NAME_LH = 15;
const MEMBER_H = 13;
const MAX_MEMBERS = 12;
/** The most lines a name, and one member, take; past it the text ends with "…". */
const NAME_MAX_LINES = 4;
const MEMBER_MAX_LINES = 3;
/** Indent of a member's continuation lines. */
const MEMBER_INDENT = 12;
const NEST = { padX: 18, padTop: 42, padBot: 14 } as const;

/** The member lines a folder prints: up to twelve, then `+n more`. */
function memberLines(contains: readonly string[] | undefined): string[] {
  const all = contains ?? [];
  if (all.length <= MAX_MEMBERS) return [...all];
  return [...all.slice(0, MAX_MEMBERS), `+${all.length - MAX_MEMBERS} more`];
}

/** The width a leaf folder wants: its members whole, and its name's longest part. */
function wantW(p: Pkg): number {
  const members = (p.contains ?? []).map((m) => textWidth(m, FONT.sub) + 20);
  const parts = p.name.split(/\s+/).flatMap((w) => splitIdentifier(w)).map((w) => textWidth(w, FONT.name));
  const stereo = p.stereotype !== undefined ? textWidth(`«${p.stereotype}»`, FONT.eyebrow) + 8 : 0;
  return Math.max(CELL_W, ...members, Math.max(0, ...parts) + 20 + stereo);
}

/** The name's room on a folder `w` wide: its width minus the stereotype on the right. */
function nameRoom(p: Pkg, w: number): number {
  return w - 20 - (p.stereotype !== undefined ? textWidth(`«${p.stereotype}»`, FONT.eyebrow) + 8 : 0);
}

export function renderPkg(data: BlockDataMap['pkg']): string {
  return layoutPkg(data).html;
}

/** Geometry report for a `pkg` block (see `geometryReport`). */
export function pkgGeometry(data: BlockDataMap['pkg']): GeometryReport {
  return layoutPkg(data).geometry;
}

/** A dependency's label: its «kind», then its text. */
const depLabel = (d: BlockDataMap['pkg']['deps'] extends ReadonlyArray<infer D> | undefined ? D : never): string =>
  [d.kind !== undefined ? `«${d.kind}»` : undefined, d.label].filter((t) => t !== undefined).join(' ');

/** Lays out and draws a `pkg` block: the framed HTML plus its geometry report. */
function layoutPkg(data: BlockDataMap['pkg']): { html: string; geometry: GeometryReport } {
  const packages = data.packages;
  const deps = data.deps ?? [];
  const ids = new Set(packages.map((p) => p.id));
  const parents = new Set(packages.map((p) => p.parent).filter((p): p is string => p !== undefined && ids.has(p)));
  const leaves = packages.filter((p) => !parents.has(p.id));
  const leafIds = new Set(leaves.map((p) => p.id));
  const dir = data.dir ?? 'LR';
  const placed = ensureGrid(
    leaves,
    deps.filter((d) => leafIds.has(d.from) && leafIds.has(d.to)),
    dir,
  );
  const cellOf = new Map(placed.map((p) => [p.id, p]));

  // Nesting depth of a package (0 = top level); the deepest sets the outer pads.
  const byId = new Map(packages.map((p) => [p.id, p]));
  const depthOf = (p: Pkg, hops = 0): number => {
    const parent = p.parent !== undefined ? byId.get(p.parent) : undefined;
    return parent === undefined || hops > packages.length ? 0 : 1 + depthOf(parent, hops + 1);
  };
  const maxDepth = Math.max(0, ...packages.map((p) => depthOf(p)));

  // One folder width for every leaf: wide enough for the longest member and
  // name part, up to a cap. Then each name and member wraps to that width.
  const cellW = Math.ceil(Math.min(MAX_CELL_W, Math.max(CELL_W, ...leaves.map(wantW))) / 2) * 2;
  const names = new Map(
    leaves.map((p) => [p.id, fitText(p.name, { width: nameRoom(p, cellW), font: FONT.name, maxLines: NAME_MAX_LINES })]),
  );
  const members = new Map(
    leaves.map((p) => [
      p.id,
      memberLines(p.contains).map((m, mi) =>
        mi >= MAX_MEMBERS
          ? { lines: [m], truncated: false, full: m }
          : (() => {
              const one = fitText(m, { width: cellW - 20, font: FONT.sub, maxLines: 1 });
              return one.truncated ? fitText(m, { width: cellW - 20 - MEMBER_INDENT, font: FONT.sub, maxLines: MEMBER_MAX_LINES }) : one;
            })(),
      ),
    ]),
  );
  const nameLinesMax = Math.max(1, ...[...names.values()].map((w) => w.lines.length));
  const headH = HEAD_H + (nameLinesMax - 1) * NAME_LH;
  const rowsOf = (id: string): number => (members.get(id) ?? []).reduce((a, w) => a + Math.max(1, w.lines.length), 0);
  const maxLines = Math.max(0, ...leaves.map((p) => rowsOf(p.id)));
  const cellH = TAB_H + headH + (maxLines > 0 ? 6 + maxLines * MEMBER_H + 8 : 8);
  const padX = 26 + maxDepth * NEST.padX;
  const padTop = 26 + maxDepth * NEST.padTop;
  const padBot = 20 + maxDepth * NEST.padBot;
  const cols = Math.max(1, ...placed.map((p) => p.col));
  const rows = Math.max(1, ...placed.map((p) => p.row));
  // One column gap and one row gap, wide enough for every dependency label
  // between neighbouring folders.
  const { gapX, gapY } = gapsForLabels(
    deps.map((d) => ({ from: d.from, to: d.to, label: depLabel(d) })),
    (id) => cellOf.get(id),
    dir,
    { gapX: GAP_X, gapY: GAP_Y },
  );
  const xOf = (c: number): number => padX + (c - 1) * (cellW + gapX);
  const yOf = (r: number): number => padTop + (r - 1) * (cellH + gapY);
  const width = padX * 2 + cols * cellW + (cols - 1) * gapX;
  const height = padTop + rows * cellH + (rows - 1) * gapY + padBot;

  // A parent's box is the union of its children's boxes, padded per level.
  const boxCache = new Map<string, Box>();
  const boxOf = (id: string, hops = 0): Box | undefined => {
    const hit = boxCache.get(id);
    if (hit !== undefined) return hit;
    const leaf = cellOf.get(id);
    if (leaf !== undefined) {
      const b = { x: xOf(leaf.col), y: yOf(leaf.row), w: cellW, h: cellH };
      boxCache.set(id, b);
      return b;
    }
    if (hops > packages.length) return undefined;
    const kids = packages.filter((p) => p.parent === id).map((p) => boxOf(p.id, hops + 1));
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const k of kids) {
      if (k === undefined) continue;
      x0 = Math.min(x0, k.x);
      y0 = Math.min(y0, k.y);
      x1 = Math.max(x1, k.x + k.w);
      y1 = Math.max(y1, k.y + k.h);
    }
    if (!Number.isFinite(x0)) return undefined;
    const b = { x: x0 - NEST.padX, y: y0 - NEST.padTop, w: x1 - x0 + 2 * NEST.padX, h: y1 - y0 + NEST.padTop + NEST.padBot };
    boxCache.set(id, b);
    return b;
  };

  const a11y = svgName('Package diagram', data.title, [
    countPhrase(packages.length, 'package'),
    countPhrase(deps.length, 'dependency', 'dependencies'),
  ]);
  let s = `<svg viewBox="0 0 ${width} ${height}"${a11y.attrs}>${a11y.title}`;

  const folder = (b: Box, primary: boolean): string => {
    const stroke = primary ? 'var(--ink)' : 'var(--rule-solid)';
    const sw = primary ? 1.5 : 1;
    const fill = primary ? 'var(--paper)' : 'var(--paper-2)';
    const tabW = Math.min(TAB_W, b.w / 2);
    return (
      `<path d="M${b.x} ${b.y + TAB_H} V${b.y + 2} Q${b.x} ${b.y} ${b.x + 2} ${b.y} H${b.x + tabW - 2} Q${b.x + tabW} ${b.y} ${b.x + tabW} ${b.y + 2} V${b.y + TAB_H}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>` +
      `<rect x="${b.x}" y="${b.y + TAB_H}" width="${b.w}" height="${b.h - TAB_H}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`
    );
  };

  // Parent folders first (shallowest outermost), beneath everything.
  const parentList = packages
    .map((p, pi) => ({ p, pi, depth: depthOf(p) }))
    .filter(({ p }) => parents.has(p.id))
    .sort((a, b) => a.depth - b.depth || a.pi - b.pi);
  let anyParent = false;
  s += `<g${bl('packages')}>`;
  for (const { p, pi } of parentList) {
    const b = boxOf(p.id);
    if (b === undefined) continue;
    anyParent = true;
    const stereo =
      p.stereotype !== undefined
        ? `<text x="${b.x + b.w - 10}" y="${b.y + TAB_H + 16}" class="t-eyebrow" text-anchor="end"${bp(`packages.${pi}.stereotype`)}>«${escapeHtml(p.stereotype)}»</text>`
        : '';
    // A parent's name has one line in its header band: cut with "…" past it.
    const pname = ellipsize(p.name, nameRoom(p, b.w), FONT.name, {
      path: `packages.${pi}.name`,
      field: 'name',
      hint: 'Shorten the package `name`.',
    });
    s +=
      `<g${bp(`packages.${pi}`)}>` +
      folder(b, false) +
      `<text x="${b.x + 10}" y="${b.y + TAB_H + 17}" class="t-name c-muted"${bp(`packages.${pi}.name`)}>${cutTitle(pname)}${escapeHtml(pname.lines[0] ?? '')}</text>` +
      stereo +
      `</g>`;
  }

  // Dependencies: dashed orthogonal arrows between boxes (leaf or parent),
  // routed around every leaf folder; a parent folder is a container a route
  // may cross. Each label sits on its own arrow.
  const kindsUsed = new Set<string>();
  const bounds = { x: 0, y: 0, w: width, h: height };
  const routeNodes = packages
    .map((p) => {
      const b = boxOf(p.id);
      return b === undefined ? undefined : { id: p.id, box: b, passable: parents.has(p.id) };
    })
    .filter((n): n is NonNullable<typeof n> => n !== undefined);
  const parentBoxes = routeNodes.filter((n) => n.passable).map((n) => n.box);
  const { routes, labels } = layoutEdges(
    routeNodes,
    deps.map((d) => (d.from === d.to ? { from: d.from, to: '\u0000' } : d)),
    deps.map((d, di) => ({ label: depLabel(d), path: `deps.${di}` })),
    {
      dir,
      bounds,
      rails: parentBoxes,
      // A parent's name and stereotype sit in its header band.
      obstacles: parentBoxes.map((b) => ({ x: b.x, y: b.y, w: b.w, h: TAB_H + HEAD_H })),
    },
  );
  let edges = `<g${bl('deps')}>`;
  deps.forEach((d, di) => {
    const p = routes[di];
    if (p === undefined) return;
    if (d.kind !== undefined) kindsUsed.add(d.kind);
    edges += `<path d="${p.d}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#skArrow)"${bp(`deps.${di}`)}/>`;
  });
  edges += `</g>`;

  // Leaf folders, on top of the edges.
  let leafSvg = '';
  packages.forEach((p, pi) => {
    const cell = cellOf.get(p.id);
    if (cell === undefined) return;
    const b = boxOf(p.id);
    if (b === undefined) return;
    const ls = members.get(p.id) ?? [];
    const name: Wrapped = names.get(p.id) ?? { lines: [p.name], truncated: false, full: p.name };
    if (name.truncated) reportCut({ path: `packages.${pi}.name`, field: 'name', full: name.full, hint: 'Shorten the package `name`.' });
    const nameTspans =
      name.lines.length <= 1
        ? escapeHtml(name.lines[0] ?? '')
        : name.lines.map((ln, k) => `<tspan x="${b.x + 10}"${k > 0 ? ` dy="${NAME_LH}"` : ''}>${escapeHtml(ln)}</tspan>`).join('');
    let g = `<g${bp(`packages.${pi}`)}>${folder(b, true)}`;
    g += `<text x="${b.x + 10}" y="${b.y + TAB_H + 17}" class="t-name"${bp(`packages.${pi}.name`)}>${cutTitle(name)}${nameTspans}</text>`;
    if (p.stereotype !== undefined) {
      g += `<text x="${b.x + b.w - 10}" y="${b.y + TAB_H + 16}" class="t-eyebrow" text-anchor="end"${bp(`packages.${pi}.stereotype`)}>«${escapeHtml(p.stereotype)}»</text>`;
    }
    if (ls.length > 0) {
      const ruleY = b.y + TAB_H + headH;
      const all = p.contains ?? [];
      const hidden = all.slice(MAX_MEMBERS);
      g += `<line x1="${b.x}" y1="${ruleY}" x2="${b.x + b.w}" y2="${ruleY}" stroke="var(--rule-solid)" stroke-width="1"/>`;
      g += `<g${bl(`packages.${pi}.contains`)}>`;
      let row = 0;
      ls.forEach((m, mi) => {
        const more = mi >= MAX_MEMBERS;
        const path = more ? '' : bp(`packages.${pi}.contains.${mi}`);
        const y = ruleY + 6 + (row + 1) * MEMBER_H - 2;
        row += Math.max(1, m.lines.length);
        if (more) {
          // The members past the cap: named in the title, and reported.
          for (const [hi, h] of hidden.entries()) {
            reportCut({ path: `packages.${pi}.contains.${MAX_MEMBERS + hi}`, owner: p.name, field: 'contains', full: h, hint: 'Split the package, or list fewer members.' });
          }
          g += `<text x="${b.x + 10}" y="${y}" class="t-sub c-soft"><title>${escapeHtml(hidden.join(', '))}</title>${escapeHtml(m.full)}</text>`;
          return;
        }
        if (m.truncated) {
          reportCut({ path: `packages.${pi}.contains.${mi}`, owner: p.name, field: 'contains', full: m.full, hint: 'Shorten the member name.' });
        }
        const body =
          m.lines.length <= 1
            ? escapeHtml(m.lines[0] ?? '')
            : m.lines
                .map((ln, k) => `<tspan x="${b.x + 10 + (k > 0 ? MEMBER_INDENT : 0)}"${k > 0 ? ` dy="${MEMBER_H}"` : ''}>${escapeHtml(ln)}</tspan>`)
                .join('');
        g += `<text x="${b.x + 10}" y="${y}" class="t-sub c-ink"${path}>${cutTitle(m)}${body}</text>`;
      });
      g += `</g>`;
    }
    g += `</g>`;
    leafSvg += g;
  });
  s += leafSvg + `</g>` + edges;

  s += labels.overlay + `</svg>`;
  const steps = labels.legend;
  const geometry = geometryOf({
    nodeWord: 'package',
    edgeWord: 'dependency',
    nodes: packages.map((p, pi) => {
      const cell = cellOf.get(p.id);
      return { id: p.id, name: p.name, path: `packages.${pi}`, ...(cell !== undefined ? { col: cell.col, row: cell.row } : {}) };
    }),
    edges: deps.map((d, di) => ({ from: d.from, to: d.to, label: depLabel(d), path: `deps.${di}` })),
    routes,
    fallbacks: labels.fallbackIndex,
    labelBoxes: labels.boxes,
    nodeBoxes: routeNodes.filter((n) => !n.passable).map((n) => n.box),
    quick: leaves.some((p) => p.col === undefined || p.row === undefined),
    dir,
  });

  const items: LegendItem[] = [{ swatch: 'node', label: 'package' }];
  if (anyParent) items.push({ swatch: 'node-fill2', label: 'parent package' });
  if (deps.length > 0) items.push({ swatch: 'edge-dashed', label: 'dependency' });
  for (const k of ['import', 'use', 'access', 'merge'] as const) {
    if (kindsUsed.has(k)) items.push({ swatch: 'chip', chip: `«${k}»`, label: k });
  }
  const legend = renderLegend(items);

  const html = diagramFrame(
    {
      tag: 'PACKAGES',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legend.length > 0 ? { legendHtml: legend } : {}),
    },
    s + steps,
  );
  return { html, geometry };
}
