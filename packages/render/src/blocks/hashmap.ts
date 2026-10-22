/**
 * Renders a `hashmap` block — bucket slots with chained entries, in pure SVG
 * inside the diagram frame (tag HASH).
 *
 * A vertical column of bucket slots (mono index in a 34px `paper-2` cell);
 * each bucket's entries chain rightward as rounded `key` / `key: value`
 * pills joined by small arrows, so collision chains read left → right. Empty
 * buckets show a dim "—". Entries whose `bucket` falls outside 0..N-1 are
 * named in a note; rendering caps at 12 buckets with a "+N more" note that
 * counts the entries it does not draw. A pill grows to its `key: value` (up
 * to a cap past which it is cut with "…" and a title). Entry tones
 * follow `svg/dsTone.ts`; the legend names the tones in play.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { DS_TONE_LEGEND, dsTone, dsToneAttrs, type DsTone } from '../svg/dsTone.js';
import { cutTitle, ellipsize, FONT, reportCut, textWidth, type Wrapped } from '../svg/wrapText.js';
import { diagramFrame } from './frame.js';

type HashmapData = BlockDataMap['hashmap'];
type Entry = NonNullable<HashmapData['entries']>[number];

const IDX_W = 34;
const ROW_H = 30;
const GAP_Y = 10;
const PILL_H = 24;
const LINK_W = 16; // arrow run between chained pills
const PAD_X = 6;
const MAX_BUCKETS = 12;
const MIN_WIDTH = 320;

/** `.hsh-key` sets in 11px mono. */
const PILL_FONT = FONT.code;
/** Room a pill's text keeps from its sides. */
const PILL_PAD = 18;
/** The widest a pill grows; a longer `key: value` is cut with "…". */
const MAX_PILL = 300;

/** The pill's text, whole when it fits the widest pill, else cut with "…". */
function fit(e: Entry): Wrapped {
  return ellipsize(pillText(e), MAX_PILL - PILL_PAD, PILL_FONT);
}

function pillText(e: Entry): string {
  return e.value !== undefined && e.value.length > 0 ? `${e.key}: ${e.value}` : e.key;
}

export function renderHashmap(data: HashmapData): string {
  const total = Math.max(0, Math.floor(data.buckets));
  const shown = Math.min(total, MAX_BUCKETS);
  const overflow = total - shown;
  const entries = data.entries ?? [];

  // Group in-range entries by bucket, preserving source order per chain (and
  // each entry's source index, for the data-path attributes).
  const chains = new Map<number, Array<{ e: Entry; idx: number }>>();
  entries.forEach((e, idx) => {
    const b = Math.floor(e.bucket);
    if (b < 0 || b >= total) return; // out-of-range entries are skipped
    const chain = chains.get(b) ?? [];
    chain.push({ e, idx });
    chains.set(b, chain);
  });

  // Entries the drawing cannot place are named in a note, never dropped silently.
  const hidden = entries.filter((e) => Math.floor(e.bucket) >= shown && Math.floor(e.bucket) < total).length;
  const stray = entries.filter((e) => Math.floor(e.bucket) < 0 || Math.floor(e.bucket) >= total).length;
  const notes: string[] = [];
  if (overflow > 0) {
    notes.push(
      `+${overflow} more bucket${overflow === 1 ? '' : 's'}` +
        (hidden > 0 ? ` (${hidden} entr${hidden === 1 ? 'y' : 'ies'} not drawn)` : ''),
    );
  }
  if (stray > 0) notes.push(`${stray} entr${stray === 1 ? 'y' : 'ies'} outside buckets 0–${Math.max(0, total - 1)} not drawn`);
  const noteH = notes.length * 20;
  const height = Math.max(shown, 1) * (ROW_H + GAP_Y) - (shown > 0 ? GAP_Y : 0) + 12 + noteH;

  // Pre-measure each chain to size the viewBox.
  const pillW = (e: Entry): number => Math.max(34, Math.ceil(textWidth(fit(e).lines[0] ?? '', PILL_FONT)) + PILL_PAD);
  let width = Math.max(MIN_WIDTH, ...notes.map((n) => Math.ceil(textWidth(n, FONT.sub)) + PAD_X * 2));
  for (let b = 0; b < shown; b += 1) {
    let x = PAD_X + IDX_W + LINK_W;
    for (const { e } of chains.get(b) ?? []) x += pillW(e) + LINK_W;
    width = Math.max(width, x + PAD_X);
  }

  let s = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img"><title>Hash map</title>`;

  if (shown === 0) {
    s += `<text x="${PAD_X}" y="${ROW_H / 2 + 9}" class="t-sub c-soft">(empty)</text></svg>`;
    return frame(data, s, '');
  }

  const tones = new Set<DsTone>();
  let plain = false;
  let chained = false;
  s += `<g${bl('entries')}>`;
  for (let b = 0; b < shown; b += 1) {
    const y = 4 + b * (ROW_H + GAP_Y);
    const cy = y + ROW_H / 2;
    // Bucket index cell.
    s += `<rect x="${PAD_X}" y="${y}" width="${IDX_W}" height="${ROW_H}" rx="2" fill="var(--paper-2)" stroke="var(--rule-solid)" stroke-width="1"/>`;
    s += `<text x="${PAD_X + IDX_W / 2}" y="${cy + 4}" class="t-sub c-muted" text-anchor="middle">${b}</text>`;

    const chain = chains.get(b) ?? [];
    if (chain.length === 0) {
      s += `<text x="${PAD_X + IDX_W + 12}" y="${cy + 4}" class="t-sub c-soft">—</text>`;
      continue;
    }
    if (chain.length > 1) chained = true;
    let x = PAD_X + IDX_W;
    chain.forEach(({ e, idx }) => {
      const w = pillW(e);
      s += `<path d="M${x + 1},${cy} L${x + LINK_W - 2},${cy}" fill="none" stroke="var(--muted)" stroke-width="1.25" marker-end="url(#skArrow)"/>`;
      x += LINK_W;
      const t = dsTone(e.tone);
      if (e.tone !== undefined) tones.add(e.tone);
      else plain = true;
      s += `<g${bp(`entries.${idx}`)}>`;
      s += `<rect x="${x}" y="${cy - PILL_H / 2}" width="${w}" height="${PILL_H}" rx="4"${dsToneAttrs(t)}/>`;
      const text = fit(e);
      if (text.truncated) {
        const keyCut = textWidth(`${e.key}: `, PILL_FONT) > MAX_PILL - PILL_PAD;
        reportCut({
          path: `entries.${idx}.${keyCut ? 'key' : 'value'}`,
          ...(keyCut ? {} : { owner: e.key }),
          field: keyCut ? 'key' : 'value',
          full: keyCut ? e.key : (e.value ?? ''),
          hint: keyCut ? 'Shorten the entry `key`.' : 'Shorten the entry `value`; put the full value in the prose.',
        });
      }
      s += `<text x="${x + w / 2}" y="${cy + 4}" class="hsh-key" fill="${t.text}">${cutTitle(text)}${escapeHtml(text.lines[0] ?? '')}</text>`;
      s += `</g>`;
      x += w;
    });
  }
  s += `</g>`; // close the entries list container

  notes.forEach((note, i) => {
    const y = 4 + shown * (ROW_H + GAP_Y) + 10 + i * 20;
    s += `<text x="${PAD_X}" y="${y}" class="t-sub c-soft">${escapeHtml(note)}</text>`;
  });

  s += `</svg>`;

  const items: LegendItem[] = [{ swatch: 'node-fill2', label: 'bucket' }];
  if (plain) items.push({ swatch: 'node', label: 'entry' });
  for (const tone of ['active', 'target', 'visited', 'muted'] as const) {
    if (tones.has(tone)) items.push(DS_TONE_LEGEND[tone]);
  }
  if (chained) items.push({ swatch: 'edge', label: 'collision chain' });
  return frame(data, s, renderLegend(items));
}

function frame(data: HashmapData, inner: string, legendHtml: string): string {
  return diagramFrame(
    {
      tag: 'HASH',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legendHtml.length > 0 ? { legendHtml } : {}),
    },
    inner,
  );
}
