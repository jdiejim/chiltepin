/**
 * Renders a distributed-trace waterfall as inline SVG: one lane per service
 * (first-appearance order), a nice-number time axis across the top, and one
 * bar per span placed by `start` and sized by `duration` on that shared
 * scale. Geometry is never nudged — a bar starts where the span started.
 *
 * Skin (`DESIGN.md`): bars lighten with nesting depth (`ink` → `muted` →
 * `paper-2`; paper text on the dark fills, ink text on the light one), a
 * thin `rule-solid` elbow joins a parent bar to each child: one spine drops
 * from the parent's start and a short stub runs right into each child's
 * start, so siblings share one line and no connector strikes through the
 * duration and name printed after another bar. The critical path — from the root, follow the longest child
 * until a leaf — takes the one accent, and `error: true` draws a `negative`
 * outline plus an `ERR` chip. The duration sits at the bar end in `.t-arrow`
 * on the paper halo; a name that does not fit inside its bar follows the
 * duration instead of being cut. `attrs` and `note` list under the drawing.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { wrapAll } from './wrapAll.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { revealAttr } from '../svg/reveal.js';
import { countPhrase, svgName } from '../svg/svgTitle.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';
import { DECORATIVE } from '../svg/decorative.js';

type Span = BlockDataMap['spans']['spans'][number];
type SpanKind = NonNullable<Span['kind']>;

/** The chip word per span kind — the lane head carries its dominant kind. */
const KIND_CHIP: Record<SpanKind, string> = {
  server: 'SVC',
  client: 'CLIENT',
  db: 'DB',
  queue: 'QUEUE',
  cache: 'CACHE',
  internal: 'INT',
};

/* ── geometry ──────────────────────────────────────────────────────────── */

const PAD_L = 14;
const LABEL_W = 136;
const PLOT_W = 520;
const PAD_R = 24;
/** The axis baseline; tick labels sit above it, lanes start under it. */
const AXIS_Y = 30;
const LANE_TOP = AXIS_Y + 8;
const ROW_H = 24;
const BAR_H = 14;
const LANE_PAD = 7;
/** A lane is at least this tall so its head (name + chip) fits. */
const LANE_MIN = 50;
const LANE_MIN_WRAPPED = 64;
/** Approximate glyph advances — for extents, never layout. */
const CH_SUB = 6;
const CH_ARROW = 5.7;
const CH_EYEBROW = 6.4;
const CHIP_H = 13;
/** Min bar width so a zero-length span still shows. */
const BAR_MIN = 2;
/** Nesting stops counting past this depth (a cycle in `parent` would loop). */
const DEPTH_CAP = 32;
/** The connector spine sits this far inside the parent bar's start. */
const SPINE_IN = 4;
/** A child closer than this to the spine meets it at its top edge (no stub). */
const STUB_MIN = 3;

const rd = (n: number): number => Math.round(n * 10) / 10;

interface Row {
  readonly idx: number;
  readonly span: Span;
  readonly depth: number;
  readonly laneI: number;
  /** Bar rectangle. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly crit: boolean;
  readonly err: boolean;
  readonly nameInside: boolean;
  /** Right edge of the last glyph drawn for this row (for growing the canvas). */
  readonly right: number;
}

interface Lane {
  readonly service: string;
  readonly lines: readonly string[];
  readonly chip: string | undefined;
  readonly y: number;
  readonly h: number;
}

/** Trims float noise: `120` → `120`, `12.5` → `12.5`, `0.1 + 0.2` → `0.3`. */
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

/** A 1 / 2 / 2.5 / 5 × 10ⁿ tick step that yields about `target` ticks. */
function niceStep(total: number, target: number): number {
  const raw = total / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * mag >= raw) return m * mag;
  }
  return 10 * mag;
}

/** Depth of every span (root = 0); an unknown or cyclic parent chain caps out. */
function depths(spans: readonly Span[]): number[] {
  const byId = new Map<string, Span>();
  for (const s of spans) if (!byId.has(s.id)) byId.set(s.id, s);
  return spans.map((s) => {
    let d = 0;
    let cur: Span | undefined = s;
    while (cur !== undefined && cur.parent !== undefined && d < DEPTH_CAP) {
      const p = byId.get(cur.parent);
      if (p === undefined || p === cur) break;
      d += 1;
      cur = p;
    }
    return d;
  });
}

/**
 * The critical path: from the first root (a span with no known parent),
 * follow the child with the longest duration (ties → first in data order)
 * until a leaf. Returns the indices on the chain.
 */
function criticalPath(spans: readonly Span[]): Set<number> {
  const ids = new Set(spans.map((s) => s.id));
  const rootI = spans.findIndex((s) => s.parent === undefined || !ids.has(s.parent));
  const chain = new Set<number>();
  if (rootI < 0) return chain;
  let cur = rootI;
  chain.add(cur);
  for (let guard = 0; guard < spans.length; guard++) {
    const curId = spans[cur]?.id;
    let best = -1;
    spans.forEach((s, i) => {
      if (s.parent !== curId || chain.has(i)) return;
      if (best < 0 || s.duration > (spans[best]?.duration ?? 0)) best = i;
    });
    if (best < 0) break;
    chain.add(best);
    cur = best;
  }
  return chain;
}

/** The most frequent kind among a lane's spans (ties → first seen), if any. */
function dominantKind(spans: readonly Span[]): string | undefined {
  const count = new Map<string, number>();
  for (const s of spans) {
    if (s.kind === undefined || !(s.kind in KIND_CHIP)) continue;
    count.set(s.kind, (count.get(s.kind) ?? 0) + 1);
  }
  let best: string | undefined;
  for (const [k, n] of count) if (best === undefined || n > (count.get(best) ?? 0)) best = k;
  return best === undefined ? undefined : KIND_CHIP[best as SpanKind];
}

/* ── details list ───────────────────────────────────────────────────────── */

function renderDetails(spans: readonly Span[], reveal: ReadonlyMap<number, number>): string {
  const rows = spans
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => (s.attrs !== undefined && Object.keys(s.attrs).length > 0) || s.note !== undefined);
  if (rows.length === 0) return '';
  const lis = rows
    .map(({ s, i }) => {
      const attrs =
        s.attrs !== undefined && Object.keys(s.attrs).length > 0
          ? `<span class="sp-d-attrs"${bp(`spans.${i}.attrs`)}>` +
            Object.entries(s.attrs)
              .map(([k, v]) => `<span class="sp-d-attr">${escapeHtml(k)}=${escapeHtml(String(v))}</span>`)
              .join('') +
            `</span>`
          : '';
      const note =
        s.note !== undefined ? `<span class="sp-d-note"${bp(`spans.${i}.note`)}>${escapeHtml(s.note)}</span>` : '';
      return (
        `<li${bp(`spans.${i}`)}${revealAttr(reveal.get(i) ?? 0)}>` +
        `<span class="sp-d-span"><span class="sp-d-service">${escapeHtml(s.service)}</span> ${escapeHtml(s.name)}</span>` +
        attrs +
        note +
        `</li>`
      );
    })
    .join('');
  return `<div class="sp-details"><div class="sp-details-title t-eyebrow">Attributes</div><ul>${lis}</ul></div>`;
}

/* ── main ──────────────────────────────────────────────────────────────── */

export function renderSpans(data: BlockDataMap['spans']): string {
  const spans = data.spans ?? [];
  const unit = data.unit ?? 'ms';
  const plotX0 = PAD_L + LABEL_W;
  const total = Math.max(1e-9, ...spans.map((s) => s.start + s.duration));
  const x = (t: number): number => plotX0 + (t / total) * PLOT_W;

  // Lanes: services in first-appearance order; rows inside a lane by start.
  const services: string[] = [];
  for (const s of spans) if (!services.includes(s.service)) services.push(s.service);
  const depth = depths(spans);
  const crit = criticalPath(spans);

  const lanes: Lane[] = [];
  const rows: Row[] = [];
  let cursor = LANE_TOP;
  let right = plotX0 + PLOT_W;
  services.forEach((service, laneI) => {
    const mine = spans
      .map((s, idx) => ({ s, idx }))
      .filter(({ s }) => s.service === service)
      .sort((a, b) => a.s.start - b.s.start || a.idx - b.idx);
    // A long service name wraps whole (identifiers break at their joints);
    // the lane grows a line for each extra line.
    const lines = wrapAll(service, 18);
    const chip = dominantKind(mine.map((m) => m.s));
    const minH = lines.length > 1 ? LANE_MIN_WRAPPED + (lines.length - 2) * 15 : LANE_MIN;
    const h = Math.max(minH, mine.length * ROW_H + LANE_PAD * 2);
    const y = cursor;
    lanes.push({ service, lines, chip, y, h });
    mine.forEach(({ s, idx }, r) => {
      const bx = x(s.start);
      const w = Math.max(BAR_MIN, x(s.start + s.duration) - bx);
      const by = y + LANE_PAD + r * ROW_H + (ROW_H - BAR_H) / 2;
      const nameInside = s.name.length * CH_SUB + 10 <= w;
      const err = s.error === true;
      // Trailing text: duration, then ERR, then the name when it did not fit.
      let tail = bx + w + 5 + `${fmt(s.duration)} ${unit}`.length * CH_ARROW;
      if (err) tail += 8 + 3 * CH_EYEBROW + 8;
      if (!nameInside) tail += 8 + s.name.length * CH_SUB;
      right = Math.max(right, tail);
      rows.push({ idx, span: s, depth: depth[idx] ?? 0, laneI, x: bx, y: by, w, crit: crit.has(idx), err, nameInside, right: tail });
    });
    cursor += h;
  });
  const bottom = cursor;
  const width = Math.ceil(right + PAD_R);
  const height = bottom + 8;

  // Deck build order (`data-reveal`): bars by `start` across every lane
  // (ties in data order), so the trace plays out in time; a connector
  // arrives with the child it joins.
  const reveal = new Map<number, number>();
  [...rows]
    .sort((a, b) => a.span.start - b.span.start || a.idx - b.idx)
    .forEach((r, n) => reveal.set(r.idx, n));
  const rv = (idx: number): string => revealAttr(reveal.get(idx) ?? 0);

  const a11y = svgName('Trace waterfall', data.title, [countPhrase(spans.length, 'span')]);
  let s = `<svg viewBox="0 0 ${width} ${height}"${a11y.attrs}>${a11y.title}`;

  // Time axis: nice ticks in `unit`, gridlines down through the lanes.
  const step = niceStep(total, 6);
  s += `<g class="sp-axis-g">`;
  for (let t = 0; t <= total + 1e-9; t += step) {
    const tx = x(t);
    s +=
      `<line x1="${tx}" y1="${AXIS_Y}" x2="${tx}" y2="${bottom}" class="sp-grid"${DECORATIVE}/>` +
      `<text x="${tx}" y="${AXIS_Y - 7}" class="t-arrow c-soft" text-anchor="middle">${fmt(t)} ${escapeHtml(unit)}</text>`;
  }
  s += `<line x1="${plotX0}" y1="${AXIS_Y}" x2="${plotX0 + PLOT_W}" y2="${AXIS_Y}" class="sp-axis"/>`;
  s += `</g>`;

  // Lane heads and separators.
  lanes.forEach((ln, i) => {
    if (i > 0) s += `<line x1="0" y1="${ln.y}" x2="${width}" y2="${ln.y}" class="sp-lane-rule"${DECORATIVE}/>`;
    const nameY = ln.y + 21;
    s += `<g class="sp-lane">`;
    ln.lines.forEach((line, j) => {
      s += `<text x="${PAD_L}" y="${nameY + j * 15}" class="t-name">${escapeHtml(line)}</text>`;
    });
    if (ln.chip !== undefined) {
      const cy = nameY + (ln.lines.length - 1) * 15 + 8;
      const cw = Math.round(ln.chip.length * CH_EYEBROW + 10);
      s +=
        `<rect x="${PAD_L}" y="${cy}" width="${cw}" height="${CHIP_H}" rx="2" class="sp-chip"/>` +
        `<text x="${PAD_L + 5}" y="${cy + 9.5}" class="t-eyebrow sp-chip-text">${escapeHtml(ln.chip)}</text>`;
    }
    s += `</g>`;
  });

  // Parent → child elbows, under the bars: every child of a parent hangs off
  // one spine just inside the parent's start (siblings' elbows overlap on it),
  // then a stub runs right to the child's start at its middle. A child that
  // starts at the spine meets it at its top edge instead.
  const rowById = new Map<string, Row>();
  for (const r of rows) if (!rowById.has(r.span.id)) rowById.set(r.span.id, r);
  s += `<g class="sp-links">`;
  for (const r of rows) {
    if (r.span.parent === undefined) continue;
    const p = rowById.get(r.span.parent);
    if (p === undefined || p === r) continue;
    const down = r.y > p.y;
    const spine = rd(p.x + Math.min(SPINE_IN, p.w / 2));
    const y1 = down ? p.y + BAR_H : p.y;
    const d =
      r.x - spine < STUB_MIN
        ? `M${rd(r.x)} ${y1} V${down ? r.y : r.y + BAR_H}`
        : `M${spine} ${y1} V${rd(r.y + BAR_H / 2)} H${rd(r.x)}`;
    s += `<path d="${d}" class="sp-link"${revealAttr(Math.max(reveal.get(r.idx) ?? 0, reveal.get(p.idx) ?? 0))}/>`;
  }
  s += `</g>`;

  // Bars.
  s += `<g${bl('spans')}>`;
  for (const r of rows) {
    const dCls = r.depth === 0 ? 'd0' : r.depth === 1 ? 'd1' : 'd2';
    const cls = `sp-bar ${dCls}${r.crit ? ' crit' : ''}${r.err ? ' err' : ''}`;
    const onDark = !r.crit && !r.err && r.depth < 2;
    const textCls = onDark ? 't-sub sp-on-dark' : 't-sub c-ink';
    const midY = r.y + BAR_H / 2 + 3.5;
    let g = `<g${bp(`spans.${r.idx}`)}${rv(r.idx)}>`;
    g += `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${BAR_H}" rx="2" class="${cls}"/>`;
    if (r.nameInside) {
      g += `<text x="${r.x + 5}" y="${midY}" class="${textCls}"${bp(`spans.${r.idx}.name`)}>${escapeHtml(r.span.name)}</text>`;
    }
    let tx = r.x + r.w + 5;
    const dur = `${fmt(r.span.duration)} ${unit}`;
    g += `<text x="${tx}" y="${midY}" class="t-arrow sp-dur"${bp(`spans.${r.idx}.duration`)}>${escapeHtml(dur)}</text>`;
    tx += dur.length * CH_ARROW + 8;
    if (r.err) {
      const cw = Math.round(3 * CH_EYEBROW + 8);
      g +=
        `<rect x="${tx}" y="${r.y + (BAR_H - CHIP_H) / 2}" width="${cw}" height="${CHIP_H}" rx="2" class="sp-chip err"/>` +
        `<text x="${tx + 4}" y="${r.y + BAR_H / 2 + 3}" class="t-eyebrow sp-chip-text err">ERR</text>`;
      tx += cw + 8;
    }
    if (!r.nameInside) {
      g += `<text x="${tx}" y="${midY}" class="t-sub c-ink"${bp(`spans.${r.idx}.name`)}>${escapeHtml(r.span.name)}</text>`;
    }
    g += `</g>`;
    s += g;
  }
  s += `</g>`;
  s += `</svg>`;

  // Legend: one item per encoding actually drawn — a bar on the critical
  // path or in error shows that outline, not its depth fill.
  const plain = rows.filter((r) => !r.crit && !r.err);
  const items: LegendItem[] = [];
  if (plain.some((r) => r.depth === 0)) items.push({ swatch: 'fill', fill: 'var(--ink)', label: 'span' });
  if (plain.some((r) => r.depth === 1)) items.push({ swatch: 'fill', fill: 'var(--muted)', label: 'nested span' });
  if (plain.some((r) => r.depth >= 2)) items.push({ swatch: 'node-fill2', label: 'nested twice or more' });
  if (crit.size > 0) items.push({ swatch: 'node-accent', label: 'critical path' });
  if (rows.some((r) => r.err)) items.push({ swatch: 'node-negative', label: 'error' });
  const kindsSeen: string[] = [];
  for (const sp of spans) {
    if (sp.kind === undefined || !(sp.kind in KIND_CHIP) || kindsSeen.includes(sp.kind)) continue;
    kindsSeen.push(sp.kind);
    items.push({ swatch: 'chip', chip: KIND_CHIP[sp.kind], label: sp.kind });
  }
  const legend = renderLegend(items);

  return diagramFrame(
    {
      tag: 'SPANS',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legend.length > 0 ? { legendHtml: legend } : {}),
    },
    s + renderDetails(spans, reveal),
  );
}
