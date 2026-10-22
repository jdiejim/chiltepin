/**
 * Renders a `venn` block — two or three overlapping sets.
 *
 * The shape for scope, ownership and responsibility questions, where the
 * interesting part is what two groups share. Positions are fixed (the standard
 * two-circle pair, or three on an equilateral triangle) because a Venn's job
 * is naming regions, not measuring them — `shared` labels a region by the sets
 * it belongs to, so the overlap says what it is instead of leaving the reader
 * to guess.
 *
 * Skin (`DESIGN.md`): every set is an ink outline with a faint ink wash, so
 * overlaps read darker by tone alone. A set the author marked with an accent
 * takes the accent outline and tint (`accent: red` is `negative`).
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { marksOf, type Mark } from '../svg/dsTone.js';
import { cutTitle, fitText, FONT, lineCount } from '../svg/wrapText.js';
import { diagramFrame } from './frame.js';

type VennData = BlockDataMap['venn'];

type Tone = 'plain' | 'accent' | 'negative';

function toneOf(mark: Mark): Tone {
  if (mark === 'negative') return 'negative';
  if (mark === 'focal') return 'accent';
  return 'plain';
}

const CIRCLE_ATTRS: Record<Tone, string> = {
  plain: 'fill="var(--ink)" fill-opacity="0.06" stroke="var(--ink)" stroke-width="1.5"',
  accent: 'fill="var(--accent-tint)" stroke="var(--accent)" stroke-width="1.5"',
  negative: 'fill="var(--negative-tint)" stroke="var(--negative)" stroke-width="1.5"',
};
const NAME_CLS: Record<Tone, string> = {
  plain: 't-name',
  accent: 't-name c-accent',
  negative: 't-name c-negative',
};

const W = 620;

/** Circle centres and the label anchors for each region, per set count. */
function geometry(n: number): {
  height: number;
  radius: number;
  circles: ReadonlyArray<{ cx: number; cy: number }>;
  own: ReadonlyArray<{ x: number; y: number }>;
  pairs: ReadonlyArray<{ of: readonly number[]; x: number; y: number }>;
  centre: { x: number; y: number };
  /** Text width of a set's own region, of a two-set lens, and of the centre. */
  ownW: number;
  lensW: number;
  centreW: number;
} {
  if (n <= 2) {
    const r = 132;
    const cy = 176;
    return {
      height: 340,
      radius: r,
      circles: [
        { cx: 240, cy },
        { cx: 380, cy },
      ],
      own: [
        { x: 178, y: cy },
        { x: 442, y: cy },
      ],
      pairs: [{ of: [0, 1], x: 310, y: cy }],
      centre: { x: 310, y: cy },
      ownW: 122,
      lensW: 116,
      centreW: 116,
    };
  }
  const r = 118;
  return {
    height: 396,
    radius: r,
    circles: [
      { cx: 250, cy: 158 },
      { cx: 370, cy: 158 },
      { cx: 310, cy: 258 },
    ],
    own: [
      { x: 196, y: 126 },
      { x: 424, y: 126 },
      { x: 310, y: 316 },
    ],
    pairs: [
      { of: [0, 1], x: 310, y: 132 },
      // The side lenses sit between two centres and away from the third —
      // measured toward the middle, not at the naive midpoint, or the label
      // drifts onto the circle's edge.
      { of: [0, 2], x: 264, y: 226 },
      { of: [1, 2], x: 356, y: 226 },
    ],
    centre: { x: 310, y: 202 },
    ownW: 108,
    lensW: 80,
    centreW: 84,
  };
}

/** The geometry of {@link geometry}, every length times `k` (text keeps its size). */
function scaled(n: number, k: number): ReturnType<typeof geometry> & { width: number } {
  const g = geometry(n);
  const pt = (p: { x: number; y: number }): { x: number; y: number } => ({ x: Math.round(p.x * k), y: Math.round(p.y * k) });
  return {
    width: Math.round(W * k),
    height: Math.round(g.height * k),
    radius: Math.round(g.radius * k),
    circles: g.circles.map((c) => ({ cx: Math.round(c.cx * k), cy: Math.round(c.cy * k) })),
    own: g.own.map(pt),
    pairs: g.pairs.map((p) => ({ of: p.of, ...pt(p) })),
    centre: pt(g.centre),
    ownW: Math.round(g.ownW * k),
    lensW: Math.round(g.lensW * k),
    centreW: Math.round(g.centreW * k),
  };
}

/** The most the circles grow (× their base size) to hold long names before a name is cut. */
const MAX_SCALE = 1.6;

export function renderVenn(data: VennData): string {
  const sets = data.sets.slice(0, 3);
  // Long names grow the circles (text keeps its size) until every name,
  // desc and shared label fits its region, up to MAX_SCALE. A shared label
  // that would need more than that is cut instead of blowing the circles up.
  // The top lens of three sets grows its label upward, so it holds three lines.
  const linesFor = (r: { sets: readonly string[] }): number => (sets.length > 2 && r.sets.length === 2 ? 2 : 3);
  const namesFit = (k: number): boolean => {
    const t = scaled(sets.length, k);
    return sets.every(
      (set) => lineCount(set.label, t.ownW) <= 3 && (set.desc === undefined || lineCount(set.desc, t.ownW, FONT.sub) <= 3),
    );
  };
  const sharedFit = (k: number): boolean => {
    const t = scaled(sets.length, k);
    return (data.shared ?? []).every(
      (r) => lineCount(r.label, r.sets.length >= 3 ? t.centreW : t.lensW) <= (isTopLens(r) ? 3 : linesFor(r)),
    );
  };
  const isTopLens = (r: { sets: readonly string[] }): boolean => {
    const names = sets.map((set) => set.label.toLowerCase());
    const at = r.sets.map((n) => names.indexOf(n.toLowerCase())).sort((a, b) => a - b);
    return sets.length > 2 && at.length === 2 && at[0] === 0 && at[1] === 1;
  };
  const kFor = (ok: (k: number) => boolean): number | undefined => {
    for (let k = 1; k <= MAX_SCALE + 1e-9; k = Math.round((k + 0.1) * 10) / 10) if (ok(k)) return k;
    return undefined;
  };
  const k = Math.max(kFor(namesFit) ?? MAX_SCALE, kFor(sharedFit) ?? 1);
  const g = scaled(sets.length, k);
  const marks = marksOf(sets.map((set) => set.accent));
  const toneAt = (i: number): Tone => toneOf(marks[i]);

  let s = `<svg viewBox="0 0 ${g.width} ${g.height}" role="img"><title>${escapeHtml(data.title ?? 'Venn')}</title>`;

  s += `<g${bl('sets')}>`;
  sets.forEach((set, i) => {
    const c = g.circles[i];
    if (c === undefined) return;
    s += `<g${bp(`sets.${i}`)}>`;
    s += `<circle cx="${c.cx}" cy="${c.cy}" r="${g.radius}" ${CIRCLE_ATTRS[toneAt(i)]}/>`;
    s += `</g>`;
  });
  s += `</g>`;

  // Set names sit in the part of each circle no other circle covers, wrapped
  // to its width; a name or desc too long for three lines ends in "…".
  sets.forEach((set, i) => {
    const at = g.own[i];
    if (at === undefined) return;
    const name = fitText(set.label, {
      width: g.ownW,
      font: FONT.name,
      maxLines: 3,
      report: { path: `sets.${i}.label`, field: 'label', hint: 'Shorten the set `label`, or move the detail to `desc`.' },
    });
    const lines = name.lines;
    lines.forEach((line, li) => {
      s += `<text x="${at.x}" y="${at.y - (lines.length - 1) * 8 + li * 16}" class="${NAME_CLS[toneAt(i)]}" text-anchor="middle">${li === 0 ? cutTitle(name) : ''}${escapeHtml(line)}</text>`;
    });
    if (set.desc !== undefined) {
      const y = at.y - (lines.length - 1) * 8 + lines.length * 16 + 2;
      const desc = fitText(set.desc, {
        width: g.ownW,
        font: FONT.sub,
        maxLines: 3,
        report: { path: `sets.${i}.desc`, owner: set.label, field: 'desc', hint: 'Shorten the set `desc`.' },
      });
      desc.lines.forEach((line, li) => {
        s += `<text x="${at.x}" y="${y + li * 13}" class="t-sub c-muted" text-anchor="middle">${li === 0 ? cutTitle(desc) : ''}${escapeHtml(line)}</text>`;
      });
    }
  });

  // Shared regions: match by set label, so the author names the overlap the
  // same way they named the sets.
  const indexOf = new Map(sets.map((set, i) => [set.label.toLowerCase(), i]));
  let hasShared = false;
  s += `<g${bl('shared')}>`;
  (data.shared ?? []).forEach((region, ri) => {
    const idx = region.sets
      .map((name) => indexOf.get(name.toLowerCase()))
      .filter((i): i is number => i !== undefined)
      .sort((a, b) => a - b);
    if (idx.length < 2) return;
    const at =
      idx.length >= 3
        ? g.centre
        : g.pairs.find((p) => p.of.length === idx.length && p.of.every((v, k) => v === idx[k]));
    if (at === undefined) return;
    hasShared = true;
    // The top lens of three sets narrows upward and ends at the third circle:
    // its label grows up from its anchor. Every other region centres it.
    const topLens = sets.length > 2 && idx.length === 2 && idx[0] === 0 && idx[1] === 1;
    const label = fitText(region.label, {
      width: idx.length >= 3 ? g.centreW : g.lensW,
      font: FONT.name,
      maxLines: topLens ? 3 : linesFor(region),
      report: { path: `shared.${ri}.label`, field: 'label', hint: 'Shorten the shared `label`; the overlap is small.' },
    });
    const lines = label.lines;
    const y0 = topLens ? at.y - (lines.length - 1) * 14 : at.y - (lines.length - 1) * 7;
    lines.forEach((line, li) => {
      s += `<text x="${at.x}" y="${y0 + li * 14}" class="t-name" text-anchor="middle"${li === 0 ? bp(`shared.${ri}`) : ''}>${li === 0 ? cutTitle(label) : ''}${escapeHtml(line)}</text>`;
    });
  });
  s += `</g></svg>`;

  const items: LegendItem[] = [];
  if (sets.some((_set, i) => toneAt(i) === 'plain')) items.push({ swatch: 'node', label: 'set' });
  if (sets.some((_set, i) => toneAt(i) === 'accent')) items.push({ swatch: 'node-accent', label: 'focal set' });
  if (sets.some((_set, i) => toneAt(i) === 'negative')) items.push({ swatch: 'fill', fill: 'var(--negative-tint)', label: 'negative set' });
  if (hasShared) items.push({ swatch: 'node-fill2', label: 'overlap (darker = shared)' });
  const legendHtml = renderLegend(items);

  return diagramFrame(
    {
      tag: 'VENN',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legendHtml.length > 0 ? { legendHtml } : {}),
    },
    s,
  );
}
