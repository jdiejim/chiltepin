/**
 * Renders a `typescale` block — a live type specimen. One hairline-separated
 * row per item: a fixed meta column (name, `NNpx / weight NNN` in mono, an
 * optional note) and the sample text rendered LIVE at the item's size, weight,
 * line-height, and font family.
 *
 * A specimen draws at its true size: the sample wraps rather than clipping,
 * and on a phone the meta column stacks above it. Past {@link MAX_SPECIMEN}
 * the sample draws at that size and the spec line says so ("shown at 96px"),
 * so the page never shows a size it does not name.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';

type TypescaleData = BlockDataMap['typescale'];
type TypescaleItem = TypescaleData['items'][number];

/** Default specimen text when the block gives none. */
const DEFAULT_SAMPLE = 'The quick brown fox jumps over the lazy dog';

/** Font-family class per `font` value (default body). */
const FONT_CLASS: Record<'display' | 'body' | 'mono', string> = {
  display: 'ts-f-display',
  body: 'ts-f-body',
  mono: 'ts-f-mono',
};

/** The largest size a specimen draws at; a larger style says it is scaled. */
export const MAX_SPECIMEN = 96;

/** Formats a number for CSS / labels, trimming float noise. */
function fmt(v: number): string {
  return String(Math.round(v * 100) / 100);
}

function renderRow(item: TypescaleItem, sample: string, i: number): string {
  const weight = item.weight ?? 400;
  const lineHeight = item.lineHeight ?? 1.3;
  const rendered = Math.min(MAX_SPECIMEN, Math.max(1, item.size));
  const scaled = rendered !== item.size ? ` · shown at ${fmt(rendered)}px` : '';
  const fontClass =
    (FONT_CLASS as Partial<Record<string, string>>)[item.font ?? 'body'] ?? FONT_CLASS.body;
  const note =
    item.note !== undefined
      ? `<div class="ts-note"${bp(`items.${i}.note`)}>${escapeHtml(item.note)}</div>`
      : '';
  const style = `font-size:${fmt(rendered)}px;font-weight:${fmt(weight)};line-height:${fmt(lineHeight)}`;
  return (
    `<div class="ts-row"${bp(`items.${i}`)}>` +
    `<div class="ts-meta">` +
    `<div class="ts-name"${bp(`items.${i}.name`)}>${escapeHtml(item.name)}</div>` +
    `<div class="ts-spec">${escapeHtml(`${fmt(item.size)}px / weight ${fmt(weight)}${scaled}`)}</div>` +
    note +
    `</div>` +
    `<div class="ts-sample ${fontClass}" style="${style}"${bp('sample')}>${escapeHtml(sample)}</div>` +
    `</div>`
  );
}

export function renderTypescale(data: TypescaleData): string {
  const head =
    data.title !== undefined ? `<div class="ts-head">${escapeHtml(data.title)}</div>` : '';
  const desc =
    data.description !== undefined
      ? `<p class="ts-desc">${escapeHtml(data.description)}</p>`
      : '';
  const sample = data.sample ?? DEFAULT_SAMPLE;
  const rows = data.items.map((item, i) => renderRow(item, sample, i)).join('');
  return `<div class="typescale">${head}${desc}<div class="ts-rows"${bl('items')}>${rows}</div></div>`;
}
