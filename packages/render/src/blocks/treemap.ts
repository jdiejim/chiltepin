/**
 * Renders a `treemap` block — proportional composition as nested tiles.
 *
 * A donut is honest up to about six slices; past that the arcs are too thin to
 * label and the eye can't compare them. A treemap keeps working: area is the
 * value, the big tiles are the answer, and the small ones still have somewhere
 * to sit. Cloud spend by service, a bundle by module, test time by suite.
 *
 * Laid out by the standard **squarified** algorithm: take items biggest-first,
 * keep adding to the current row while doing so improves the worst
 * aspect-ratio in that row, then lay the row along the short edge of what's
 * left and recurse into the rest. That is what keeps tiles near-square, which
 * is what makes areas comparable by eye.
 *
 * Skin (`DESIGN.md`): every tile is paper with an ink outline — rank is
 * what the value label and the area say, not a fill. The accent
 * goes to the item the author marked with an accent — or, when none is, to
 * the largest tile, which is the answer the chart exists to give. `accent:
 * red` is `negative`.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { marksOf } from '../svg/dsTone.js';
import { ellipsize, fitText, FONT, reportCut, splitIdentifier, textWidth, type Wrapped } from '../svg/wrapText.js';
import { diagramFrame } from './frame.js';

type TreemapData = BlockDataMap['treemap'];
type Item = TreemapData['items'][number];

const W = 880;
const H = 400;
const PAD = 3; // gutter between tiles
/** A tile's text sits this far in from its left edge. */
const INSET = 9;
const NAME_LH = 15;
const DESC_LH = 13;
/** Text keeps this far off a tile's bottom edge. */
const BOTTOM = 6;
/** The key under the drawing: one row per numbered tile. */
const KEY_TOP = 16;
const KEY_ROW_H = 18;

interface Tile {
  readonly item: Item;
  readonly index: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Worst aspect ratio in a row of areas laid along `side`. */
function worst(areas: readonly number[], side: number): number {
  if (areas.length === 0 || side <= 0) return Infinity;
  const sum = areas.reduce((a, v) => a + v, 0);
  if (sum <= 0) return Infinity;
  const max = Math.max(...areas);
  const min = Math.min(...areas);
  return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
}

/** Places one settled row along the short edge and returns what's left. */
function layRow(row: readonly { area: number; tile: Tile }[], rect: Rect): Rect {
  const sum = row.reduce((a, r) => a + r.area, 0);
  const horizontal = rect.w >= rect.h;
  const thickness = sum / (horizontal ? rect.h : rect.w);
  let along = horizontal ? rect.y : rect.x;
  for (const { area, tile } of row) {
    const length = area / thickness;
    if (horizontal) {
      tile.x = rect.x;
      tile.y = along;
      tile.w = thickness;
      tile.h = length;
    } else {
      tile.x = along;
      tile.y = rect.y;
      tile.w = length;
      tile.h = thickness;
    }
    along += length;
  }
  return horizontal
    ? { x: rect.x + thickness, y: rect.y, w: rect.w - thickness, h: rect.h }
    : { x: rect.x, y: rect.y + thickness, w: rect.w, h: rect.h - thickness };
}

/** Squarified treemap: fills `rect` with tiles whose areas are `areas`. */
function squarify(tiles: readonly Tile[], areas: readonly number[], start: Rect): void {
  let rect = start;
  let row: { area: number; tile: Tile }[] = [];
  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    const area = areas[i];
    if (tile === undefined || area === undefined) continue;
    const side = Math.min(rect.w, rect.h);
    const current = row.map((r) => r.area);
    if (row.length === 0 || worst([...current, area], side) <= worst(current, side)) {
      row.push({ area, tile });
    } else {
      rect = layRow(row, rect);
      row = [{ area, tile }];
    }
  }
  if (row.length > 0) layRow(row, rect);
}

function fmt(v: number, unit: string | undefined): string {
  const rounded = Math.round(v * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return unit !== undefined ? `${text}${unit}` : text;
}

type Tone = 'plain' | 'accent' | 'negative';

const TONE_ATTRS: Record<Tone, string> = {
  plain: 'fill="var(--paper)" stroke="var(--ink)" stroke-width="1"',
  accent: 'fill="var(--accent-tint)" stroke="var(--accent)" stroke-width="1.5"',
  negative: 'fill="var(--negative-tint)" stroke="var(--negative)" stroke-width="1.5"',
};

export function renderTreemap(data: TreemapData): string {
  // Biggest first — squarified layout depends on descending order, and the
  // authored index rides along so click-to-edit still points at the right item.
  const ordered = data.items
    .map((item, index) => ({ item, index }))
    .filter((e) => e.item.value > 0)
    .sort((a, b) => b.item.value - a.item.value);

  const total = ordered.reduce((a, e) => a + e.item.value, 0);
  const open = (height: number): string =>
    `<svg viewBox="0 0 ${W} ${height}" role="img"><title>${escapeHtml(data.title ?? 'Treemap')}</title>`;

  if (ordered.length === 0 || total <= 0) {
    const s = open(H) + `<rect x="0" y="0" width="${W}" height="${H}" rx="8" fill="var(--paper)" stroke="var(--rule-solid)"/></svg>`;
    return frame(data, s, '');
  }

  const tiles: Tile[] = ordered.map((e) => ({ item: e.item, index: e.index, x: 0, y: 0, w: 0, h: 0 }));
  const scale = (W * H) / total;
  squarify(
    tiles,
    ordered.map((e) => e.item.value * scale),
    { x: 0, y: 0, w: W, h: H },
  );

  // The accent: the author's one flagged item; failing that, the largest tile.
  const marks = marksOf(ordered.map((e) => e.item.accent));
  const flagged = marks.includes('focal');
  const toneOf = (t: Tile, rank: number): Tone => {
    const mark = marks[rank];
    if (mark === 'negative') return 'negative';
    if (mark === 'focal') return 'accent';
    if (!flagged && rank === 0) return 'accent';
    return 'plain';
  };
  const used = new Set<Tone>();

  // Plan each tile's text first: the tiles that cannot show their name and
  // value take a number, and the key under the drawing lists them in full.
  const plans = tiles.map((t) => planTile(t));
  const numbered = new Map<number, number>();
  plans.forEach((p, i) => {
    if (p.keyed) numbered.set(i, numbered.size + 1);
  });
  const zero = data.items.map((item, index) => ({ item, index })).filter((e) => !(e.item.value > 0));
  const key = keyLayout([
    ...[...numbered.entries()].map(([i, n]) => ({ badge: String(n), text: keyText(tiles[i]?.item, data.unit, total), index: tiles[i]?.index ?? 0 })),
    ...zero.map((e) => ({ badge: '–', text: `${e.item.label} · ${fmt(e.item.value, data.unit)} · not drawn (no area)`, index: e.index })),
  ]);
  let s = open(H + (key.rows > 0 ? KEY_TOP + key.rows * KEY_ROW_H - 2 : 0));

  s += `<g${bl('items')}>`;
  tiles.forEach((t, i) => {
    const x = t.x + PAD / 2;
    const y = t.y + PAD / 2;
    const w = Math.max(0, t.w - PAD);
    const h = Math.max(0, t.h - PAD);
    if (w < 2 || h < 2) return;
    const plan = plans[i] as TilePlan;
    const tone = toneOf(t, i);
    used.add(tone);
    const share = shareText(t.item.value, total);
    const nameCls = tone === 'accent' ? 't-name c-accent' : tone === 'negative' ? 't-name c-negative' : 't-name';
    s += `<g${bp(`items.${t.index}`)}>`;
    // A tint is translucent: paint paper under it so the dot grid stays out.
    if (tone !== 'plain') {
      s += `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" rx="3" fill="var(--paper)"/>`;
    }
    s += `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" rx="3" ${TONE_ATTRS[tone]}/>`;
    plan.name.lines.forEach((line, li) => {
      s += `<text x="${r(x + INSET)}" y="${r(y + 20 + li * NAME_LH)}" class="${nameCls}">${escapeHtml(line)}</text>`;
    });
    const below = y + 20 + plan.name.lines.length * NAME_LH;
    if (plan.value) {
      s += `<text x="${r(x + INSET)}" y="${r(below + 1)}" class="t-sub c-muted">${escapeHtml(fmt(t.item.value, data.unit))} · ${escapeHtml(share)}</text>`;
    }
    plan.desc.lines.forEach((line, li) => {
      s += `<text x="${r(x + INSET)}" y="${r(below + 16 + li * DESC_LH)}" class="t-sub c-soft">${escapeHtml(line)}</text>`;
    });
    // A numbered tile: the number in its top corner (when the tile can hold one).
    const n = numbered.get(i);
    if (n !== undefined && w >= 14 && h >= 14) {
      const bx = plan.name.lines.length > 0 ? x + w - 8 : x + Math.min(INSET, w / 2);
      const anchor = plan.name.lines.length > 0 ? ' text-anchor="end"' : w < 2 * INSET + 6 ? ' text-anchor="middle"' : '';
      s += `<text x="${r(plan.name.lines.length > 0 || w >= 2 * INSET + 6 ? bx : x + w / 2)}" y="${r(y + Math.min(17, h / 2 + 4))}" class="t-badge c-ink"${anchor}>${n}</text>`;
    }
    const descPart = t.item.desc !== undefined && t.item.desc !== '' ? ` — ${t.item.desc}` : '';
    s += `<title>${escapeHtml(`${t.item.label}: ${fmt(t.item.value, data.unit)} (${share})${descPart}`)}</title>`;
    s += `</g>`;
    for (const [field, w2] of [['label', plan.name], ['desc', plan.desc]] as const) {
      if (!w2.truncated || plan.keyed) continue;
      reportCut({
        path: `items.${t.index}.${field}`,
        ...(field === 'desc' ? { owner: t.item.label } : {}),
        field,
        full: w2.full,
        hint: field === 'label' ? 'Shorten the item `label`.' : 'Shorten the item `desc`.',
      });
    }
  });
  s += `</g>`;
  s += keySvg(key, H + KEY_TOP);
  s += `</svg>`;

  const items: LegendItem[] = [];
  if (used.has('plain')) items.push({ swatch: 'node', label: 'item (area = value)' });
  if (used.has('accent')) items.push({ swatch: 'node-accent', label: flagged ? 'focal item' : 'largest item' });
  if (used.has('negative')) items.push({ swatch: 'fill', fill: 'var(--negative-tint)', label: 'negative' });
  return frame(data, s, renderLegend(items));
}

function r(v: number): number {
  return Math.round(v * 10) / 10;
}

function frame(data: TreemapData, inner: string, legendHtml: string): string {
  return diagramFrame(
    {
      tag: 'TREEMAP',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legendHtml.length > 0 ? { legendHtml } : {}),
    },
    inner,
  );
}

/** How one tile shows its text. */
interface TilePlan {
  readonly name: Wrapped;
  /** The `value · share` line shows. */
  readonly value: boolean;
  readonly desc: Wrapped;
  /** The tile takes a number and a key entry (its text does not all fit). */
  readonly keyed: boolean;
}

const NONE: Wrapped = { lines: [], truncated: false, full: '' };

/** True when every word of `text` fits `width` whole (or at its identifier joints). */
function wordsFit(text: string, width: number): boolean {
  return text
    .split(/\s+/)
    .filter((wd) => wd !== '')
    .every((wd) => textWidth(wd, FONT.name) <= width || splitIdentifier(wd).every((p) => p.length > 1 && textWidth(p, FONT.name) <= width));
}

/**
 * Plans a tile's text: the name (wrapped, up to five lines), the value line,
 * then the description in the rest. A tile too small for its name and value
 * shows a number instead, and the key lists it; a description with no line
 * left also sends the tile to the key. A name or description that fits only
 * in part ends with "…" (reported as a cut).
 */
function planTile(t: Tile): TilePlan {
  const w = Math.max(0, t.w - PAD);
  const h = Math.max(0, t.h - PAD);
  const room = w - INSET * 2;
  const bottom = h - BOTTOM;
  // Name line k sits at 20 + 15k; the value line one line under the last.
  const nameRoom = Math.min(5, Math.floor((bottom - 21) / NAME_LH));
  if (room < 40 || nameRoom < 1) return { name: NONE, value: false, desc: NONE, keyed: true };
  const label = t.item.label;
  let name = fitText(label, { width: room, font: FONT.name, maxLines: nameRoom });
  if (!name.truncated && !wordsFit(label, room)) name = ellipsize(label, room, FONT.name);
  const below = 20 + name.lines.length * NAME_LH;
  const descText = t.item.desc ?? '';
  if (descText.trim() === '') return { name, value: true, desc: NONE, keyed: false };
  const descRoom = Math.floor((bottom - (below + 16)) / DESC_LH) + 1;
  if (descRoom < 1) return { name, value: true, desc: NONE, keyed: true };
  const desc = fitText(descText, { width: room, font: FONT.sub, maxLines: Math.min(3, descRoom) });
  return { name, value: true, desc, keyed: false };
}

/** A share of the total as a whole percent; a sliver above zero reads `<1%`, never `0%`. */
function shareText(value: number, total: number): string {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return pct > 0 && pct < 0.5 ? '<1%' : `${Math.round(pct)}%`;
}

/** A key entry's text: the item's name, value, share and description. */
function keyText(item: Item | undefined, unit: string | undefined, total: number): string {
  if (item === undefined) return '';
  const desc = item.desc !== undefined && item.desc !== '' ? ` — ${item.desc}` : '';
  return `${item.label} · ${fmt(item.value, unit)} · ${shareText(item.value, total)}${desc}`;
}

interface KeyEntry {
  readonly badge: string;
  readonly text: string;
  readonly index: number;
}

/** Key entries flow left to right and wrap at the drawing's width. */
function keyLayout(entries: readonly KeyEntry[]): { rows: number; at: Array<KeyEntry & { x: number; row: number }> } {
  const at: Array<KeyEntry & { x: number; row: number }> = [];
  let x = 0;
  let row = 0;
  for (const e of entries) {
    const w = 24 + textWidth(e.text, FONT.sub);
    if (x > 0 && x + w > W) {
      x = 0;
      row += 1;
    }
    at.push({ ...e, x, row });
    x += w + 24;
  }
  return { rows: at.length === 0 ? 0 : row + 1, at };
}

/** The key under the drawing: each numbered tile (and each item with no area) in full. */
function keySvg(key: ReturnType<typeof keyLayout>, top: number): string {
  if (key.at.length === 0) return '';
  let s = `<g class="tm-key">`;
  for (const e of key.at) {
    const y = top + e.row * KEY_ROW_H;
    s +=
      `<g${bp(`items.${e.index}.label`)}>` +
      `<rect x="${r(e.x + 0.5)}" y="${r(y)}" width="17" height="14" rx="2" fill="var(--paper)" stroke="var(--ink)" stroke-width="1"/>` +
      `<text x="${r(e.x + 9)}" y="${r(y + 10.5)}" class="t-badge c-ink" text-anchor="middle">${escapeHtml(e.badge)}</text>` +
      `<text x="${r(e.x + 24)}" y="${r(y + 10.5)}" class="t-sub">${escapeHtml(e.text)}</text>` +
      `</g>`;
  }
  return s + `</g>`;
}
