/**
 * Renders a UML class diagram — class boxes with stereotype, name, attributes,
 * and methods compartments; orthogonal-routed relationships with kind-specific
 * markers (inheritance triangle, composition diamond, etc.).
 *
 * Skin (`DESIGN.md`): a class is a paper card with an ink outline, the
 * stereotype as an eyebrow over the name, hairline compartment rules and
 * mono member rows. Relations are `muted`; `implements` and `dependency`
 * are the dashed return stroke; the UML heads stay (hollow triangle, filled
 * and hollow diamonds, open arrow) since they carry the relation's meaning.
 *
 * Accent rule: the single class stereotyped `interface` takes the accent —
 * the contract the rest of the model implements. Two or more, or none,
 * means no accent.
 */

import dagre from '@dagrejs/dagre';
import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { edgeLabelLayer, type EdgeLabelPoint } from '../svg/edgeSteps.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { roundedPath } from '../svg/shapes.js';
import { cutTitle, fitText, FONT, reportCut, textWidth, type Wrapped } from '../svg/wrapText.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';
import { DECORATIVE } from '../svg/decorative.js';

type UmlClass = NonNullable<BlockDataMap['uml']['classes']>[number];

type RelKind = 'inheritance' | 'implementation' | 'composition' | 'aggregation' | 'dependency' | 'association';

interface UmlRelStyle {
  readonly kind: RelKind;
  readonly dash: string;
  readonly start?: string;
  readonly end?: string;
}

function umlRel(kind: string | undefined): UmlRelStyle {
  switch ((kind ?? 'association').toLowerCase()) {
    case 'inheritance':
    case 'extends':
      return { kind: 'inheritance', dash: '', end: 'umlTri' };
    case 'implementation':
    case 'implements':
      return { kind: 'implementation', dash: '5 4', end: 'umlTri' };
    case 'composition':
      return { kind: 'composition', dash: '', start: 'umlDiaF' };
    case 'aggregation':
      return { kind: 'aggregation', dash: '', start: 'umlDiaH' };
    case 'dependency':
      return { kind: 'dependency', dash: '5 4', end: 'umlOpen' };
    default:
      return { kind: 'association', dash: '', end: 'umlOpen' };
  }
}

const isInterface = (c: UmlClass): boolean =>
  (c.stereotype ?? '').replace(/[«»]/g, '').trim().toLowerCase() === 'interface';

/** A class box never grows wider than this; longer names and members wrap. */
const MAX_CLASS_W = 320;
const MIN_CLASS_W = 150;
/** Text inset from the class box's left and right edges. */
const INSET = 12;
/** Baseline-to-baseline distance of member rows and of wrapped name lines. */
const ROW_H = 15;
const NAME_LH = 16;
/** The most lines one member, or the class name, takes; past it the text is cut with "…". */
const MEMBER_MAX_LINES = 4;
const NAME_MAX_LINES = 3;
/** Member rows set in `.t-sub`: 10px mono. */
const MEMBER_FONT = FONT.sub;

/**
 * A member split for a hanging indent: the visibility marker (`+ `, `- `,
 * `# `, `~ `) stays on the first line, and every line of the body sets at
 * the indent after it — so a wrapped signature reads as one member. A
 * member with no marker indents its continuation lines by two characters.
 */
interface MemberLines {
  /** The visibility marker with its space (`'- '`), or `''`. */
  readonly marker: string;
  /** The body, wrapped at the indent. */
  readonly body: Wrapped;
  /** x offset of the body lines from the text inset. */
  readonly indent: number;
  /** True when the member fits on one line as authored (drawn unchanged). */
  readonly single: boolean;
}

/** How wide a member, a name, or a stereotype wants its class box. */
function classWidth(c: UmlClass): number {
  const name = textWidth(c.name, FONT.name) + INSET * 2 + 6;
  const stereo = c.stereotype !== undefined ? textWidth(`«${c.stereotype}»`, FONT.eyebrow) + INSET * 2 : 0;
  const members = [...(c.attrs ?? []), ...(c.methods ?? [])].map((m) => textWidth(m, MEMBER_FONT) + INSET * 2);
  return Math.ceil(Math.min(MAX_CLASS_W, Math.max(MIN_CLASS_W, name, stereo, ...members)));
}

/** A member fitted to a class box `w` wide (see {@link MemberLines}). */
function memberLines(m: string, w: number): MemberLines {
  const room = w - INSET * 2;
  if (textWidth(m, MEMBER_FONT) <= room) return { marker: '', body: { lines: [m], truncated: false, full: m }, indent: 0, single: true };
  const hit = /^([+\-#~])\s+/.exec(m);
  const marker = hit !== null ? `${hit[1] ?? ''} ` : '';
  const indent = textWidth(marker !== '' ? marker : '  ', MEMBER_FONT);
  const rest = hit !== null ? m.slice(hit[0].length) : m;
  return { marker, body: fitText(rest, { width: room - indent, font: MEMBER_FONT, maxLines: MEMBER_MAX_LINES }), indent, single: false };
}

/** The rows a member takes. */
function memberRows(ml: MemberLines): number {
  return Math.max(1, ml.body.lines.length);
}

export function renderUml(data: BlockDataMap['uml']): string {
  const classes = data.classes ?? [];
  const rels = data.rels ?? [];
  const rowH = ROW_H;
  // Each class box sizes to its widest line (name, stereotype, member) up to
  // a cap; past it, the name wraps at its word joints and a long member
  // wraps with a hanging indent — the box grows taller, never narrower than
  // its text, so a signature never runs into the next class.
  const sizes = new Map(
    classes.map((c) => {
      const w = classWidth(c);
      const name = fitText(c.name, { width: w - INSET * 2, font: FONT.name, maxLines: NAME_MAX_LINES });
      const attrs = (c.attrs ?? []).map((m) => memberLines(m, w));
      const methods = (c.methods ?? []).map((m) => memberLines(m, w));
      return [c.id, { w, name, attrs, methods }] as const;
    }),
  );
  const sizeOf = (c: UmlClass): { w: number; name: Wrapped; attrs: MemberLines[]; methods: MemberLines[] } =>
    sizes.get(c.id) ?? { w: MIN_CLASS_W, name: { lines: [c.name], truncated: false, full: c.name }, attrs: [], methods: [] };
  const wOf = (c: UmlClass): number => sizeOf(c).w;
  const headH = (c: UmlClass): number =>
    (c.stereotype !== undefined ? 38 : 26) + (Math.max(1, sizeOf(c).name.lines.length) - 1) * NAME_LH;
  const compH = (list: readonly MemberLines[]): number =>
    (list.length > 0 ? list.reduce((a, ml) => a + memberRows(ml), 0) * rowH : 6) + 10;
  const clsH = (c: UmlClass): number => headH(c) + compH(sizeOf(c).attrs) + compH(sizeOf(c).methods);

  const byId = new Map(classes.map((c) => [c.id, c]));
  // Keep each relation's original index so data paths address `rels.N` in the
  // authored YAML even when invalid relations are filtered out.
  const validRels = rels
    .map((rl, ri) => ({ rl, ri }))
    .filter(({ rl }) => byId.has(rl.from) && byId.has(rl.to));

  // The accent (see the header comment).
  const interfaces = classes.filter(isInterface);
  const accentId = interfaces.length === 1 ? interfaces[0]?.id : undefined;

  // Lay the classes out with dagre using their real sizes, then route edges
  // through dagre's points (smooth, non-overlapping) — same approach as the ERD.
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: 'TB', nodesep: 46, ranksep: 58, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const c of classes) g.setNode(c.id, { width: wOf(c), height: clsH(c) });
  validRels.forEach(({ rl }, i) => g.setEdge(rl.from, rl.to, {}, `e${i}`));
  dagre.layout(g);

  const graph = g.graph();
  const width = Math.ceil(graph.width ?? 0);
  const height = Math.ceil(graph.height ?? 0);
  const at = new Map<string, { x: number; y: number }>();
  for (const c of classes) {
    const n = g.node(c.id) as { x: number; y: number } | undefined;
    if (n !== undefined) at.set(c.id, { x: n.x - wOf(c) / 2, y: n.y - clsH(c) / 2 });
  }

  let s =
    `<svg viewBox="0 0 ${width} ${height}" role="img"><title>UML class diagram</title>` +
    `<defs>` +
    `<marker id="umlTri" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="13" markerHeight="13" markerUnits="userSpaceOnUse" orient="auto-start-reverse">` +
    `<path d="M1,1 L13,7 L1,13 z" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.2"/></marker>` +
    // The diamonds sit 6px outside the box edge (refX past the tip), 10px
    // long, so they never land on a rounded corner.
    `<marker id="umlDiaF" viewBox="0 0 20 12" refX="30" refY="6" markerWidth="11" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto-start-reverse">` +
    `<path d="M1,6 L10,1 L19,6 L10,11 z" fill="var(--muted)"/></marker>` +
    `<marker id="umlDiaH" viewBox="0 0 20 12" refX="30" refY="6" markerWidth="11" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto-start-reverse">` +
    `<path d="M1,6 L10,1 L19,6 L10,11 z" fill="var(--paper)" stroke="var(--muted)" stroke-width="1.2"/></marker>` +
    `<marker id="umlOpen" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto-start-reverse">` +
    `<path d="M1,1 L11,6 L1,11" fill="none" stroke="var(--muted)" stroke-width="1.3"/></marker>` +
    `</defs>`;

  const pending: EdgeLabelPoint[] = [];
  // A composition / aggregation diamond sits on the line just outside its
  // class: labels keep clear of it, so the ◆ always reads.
  const diamonds: Array<{ x: number; y: number; w: number; h: number }> = [];
  const lines: Array<Array<{ x: number; y: number }>> = [];
  const relKinds = new Set<RelKind>();
  s += `<g${bl('rels')}>`;
  validRels.forEach(({ rl, ri }, i) => {
    const e = g.edge(rl.from, rl.to, `e${i}`) as { points?: Array<{ x: number; y: number }> } | undefined;
    const pts = e?.points;
    if (pts === undefined || pts.length < 2) return;
    const st = umlRel(rl.kind);
    relKinds.add(st.kind);
    const start = st.start !== undefined ? ` marker-start="url(#${st.start})"` : '';
    const end = st.end !== undefined ? ` marker-end="url(#${st.end})"` : '';
    const dash = st.dash.length > 0 ? ` stroke-dasharray="${st.dash}"` : '';
    s += `<path d="${roundedPath(pts, 9)}" fill="none" stroke="var(--muted)" stroke-width="1.5"${dash}${start}${end}${bp(`rels.${ri}`)}/>`;
    // The label rides its own relation line (dagre's points), clear of the
    // classes and of the other lines.
    const line = pts.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
    lines.push(line);
    if (st.start !== undefined) {
      const a = pts[0];
      const b = pts[1];
      if (a !== undefined && b !== undefined) {
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        // The diamond runs 6–17px out from the box along the first segment.
        const cx = a.x + ((b.x - a.x) / len) * 12;
        const cy = a.y + ((b.y - a.y) / len) * 12;
        diamonds.push({ x: cx - 11, y: cy - 11, w: 22, h: 22 });
      }
    }
    if (rl.label !== undefined && rl.label !== '') {
      const mid = pts[Math.floor(pts.length / 2)];
      if (mid !== undefined)
        pending.push({ lx: mid.x, ly: mid.y, points: line, label: rl.label, path: `rels.${ri}` });
    }
  });
  s += `</g>`; // close the rels list container

  s += `<g${bl('classes')}>`;
  const nodeRects: { x: number; y: number; w: number; h: number }[] = [];
  classes.forEach((c, ci) => {
    const p = at.get(c.id);
    if (p === undefined) return;
    const r = { x: p.x, y: p.y, w: wOf(c), h: clsH(c) };
    nodeRects.push(r);
    const size = sizeOf(c);
    const hh = headH(c);
    const aH = compH(size.attrs);
    const accent = c.id === accentId;
    const nameY = r.y + (c.stereotype !== undefined ? 30 : 18);
    const stereo =
      c.stereotype !== undefined
        ? `<text x="${r.x + r.w / 2}" y="${r.y + 14}" class="t-eyebrow${accent ? ' c-accent' : ''}" text-anchor="middle">«${escapeHtml(c.stereotype)}»</text>`
        : '';
    // One member: unchanged markup when it fits; else the marker, then the
    // body lines at the hanging indent, one `<text>` (the member's path).
    const member = (ml: MemberLines, y: number, path: string, field: string): string => {
      if (ml.single) return `<text x="${r.x + INSET}" y="${y}" class="t-sub c-ink"${bp(path)}>${escapeHtml(ml.body.full)}</text>`;
      if (ml.body.truncated) {
        reportCut({ path, owner: c.name, field, full: `${ml.marker}${ml.body.full}`, hint: `Shorten the ${field === 'attrs' ? 'attribute' : 'method'}, or move the detail to the prose.` });
      }
      const bx = r.x + INSET + (ml.marker !== '' ? ml.indent : 0);
      const tail = ml.body.lines
        .map((ln, k) => {
          const x = k === 0 ? bx : r.x + INSET + ml.indent;
          return `<tspan x="${x.toFixed(1)}"${k > 0 ? ` dy="${rowH}"` : ''}>${escapeHtml(ln)}</tspan>`;
        })
        .join('');
      const title = ml.body.truncated ? `<title>${escapeHtml(`${ml.marker}${ml.body.full}`)}</title>` : '';
      return `<text x="${r.x + INSET}" y="${y}" class="t-sub c-ink"${bp(path)}>${title}${escapeHtml(ml.marker)}${tail}</text>`;
    };
    const stack = (list: readonly MemberLines[], y0: number, field: 'attrs' | 'methods'): string => {
      let row = 0;
      return list
        .map((ml, j) => {
          const t = member(ml, y0 + 15 + row * rowH, `classes.${ci}.${field}.${j}`, field);
          row += memberRows(ml);
          return t;
        })
        .join('');
    };
    const attrs = `<g${bl(`classes.${ci}.attrs`)}>` + stack(size.attrs, r.y + hh, 'attrs') + `</g>`;
    const methods = `<g${bl(`classes.${ci}.methods`)}>` + stack(size.methods, r.y + hh + aH, 'methods') + `</g>`;
    if (size.name.truncated) {
      reportCut({ path: `classes.${ci}.name`, field: 'name', full: size.name.full, hint: 'Shorten the class `name`.' });
    }
    const nameText =
      size.name.lines.length <= 1 && !size.name.truncated
        ? escapeHtml(c.name)
        : cutTitle(size.name) +
          size.name.lines
            .map((ln, k) => `<tspan x="${r.x + r.w / 2}"${k > 0 ? ` dy="${NAME_LH}"` : ''}>${escapeHtml(ln)}</tspan>`)
            .join('');
    const stroke = accent ? 'var(--accent)' : 'var(--ink)';
    const fill = accent ? 'var(--accent-tint)' : 'var(--paper)';
    s +=
      `<g${bp(`classes.${ci}`)}>` +
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>` +
      stereo +
      `<text x="${r.x + r.w / 2}" y="${nameY}" class="t-name${accent ? ' c-accent' : ''}" text-anchor="middle"${bp(`classes.${ci}.name`)}>${nameText}</text>` +
      `<line x1="${r.x}" y1="${r.y + hh}" x2="${r.x + r.w}" y2="${r.y + hh}" class="uml-sep"${DECORATIVE}/>` +
      attrs +
      `<line x1="${r.x}" y1="${r.y + hh + aH}" x2="${r.x + r.w}" y2="${r.y + hh + aH}" class="uml-sep"${DECORATIVE}/>` +
      methods +
      `</g>`;
  });
  s += `</g>`; // close the classes list container

  const { overlay, legend: steps } = edgeLabelLayer(pending, [...nodeRects, ...diamonds], {
    skin: true,
    bounds: { x: 0, y: 0, w: width, h: height },
    routes: lines,
  });
  s += overlay; // labels on top, never crossed by a line
  s += `</svg>`;

  const items: LegendItem[] = [];
  if (relKinds.has('association')) items.push({ swatch: 'edge', label: 'association' });
  if (relKinds.has('inheritance')) items.push({ swatch: 'chip', chip: '△', label: 'inherits' });
  if (relKinds.has('implementation')) items.push({ swatch: 'edge-dashed', label: 'implements' });
  if (relKinds.has('composition')) items.push({ swatch: 'chip', chip: '◆', label: 'composed of' });
  if (relKinds.has('aggregation')) items.push({ swatch: 'chip', chip: '◇', label: 'aggregates' });
  if (relKinds.has('dependency')) items.push({ swatch: 'edge-dashed', label: 'depends on' });
  if (accentId !== undefined) items.push({ swatch: 'node-accent', label: 'interface' });
  const legend = renderLegend(items);

  return diagramFrame(
    {
      tag: 'UML',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legend.length > 0 ? { legendHtml: legend } : {}),
    },
    s + steps,
  );
}
