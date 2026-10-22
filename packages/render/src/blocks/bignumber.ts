/**
 * Renders a `bignumber` block — one hero metric at presentation scale: the
 * value in display type (accent-colored), an optional delta with a neutral
 * trend arrow beside it, a bold one-line claim, and an optional context line.
 *
 * The trend arrow is deliberately gray: for a bignumber "down" is often good
 * (latency, cost), so the arrow only shows direction — the delta text takes
 * the accent color instead.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bp } from '../paths.js';

const TREND_GLYPH = { up: '▲', down: '▼', flat: '—' } as const;

/**
 * The size step for a value: a long figure (`$1,250,000,000`) steps down so
 * it fits the column on a phone instead of clipping. Counted in characters,
 * since the display face is close to fixed width for digits.
 */
export function bignumberSize(value: string): '' | ' bn-len-m' | ' bn-len-l' | ' bn-len-xl' {
  const n = [...value.trim()].length;
  if (n <= 6) return '';
  if (n <= 10) return ' bn-len-m';
  if (n <= 15) return ' bn-len-l';
  return ' bn-len-xl';
}

export function renderBignumber(data: BlockDataMap['bignumber']): string {
  const accentCls = data.accent !== undefined ? ` bn-${data.accent}` : '';
  const arrow =
    data.trend !== undefined
      ? `<span class="bn-arrow" aria-hidden="true">${(TREND_GLYPH as Partial<Record<string, string>>)[data.trend] ?? ''}</span>`
      : '';
  const delta =
    data.delta !== undefined
      ? `<span class="bn-delta"${bp('delta')}>${arrow}${escapeHtml(data.delta)}</span>`
      : '';
  const context =
    data.context !== undefined
      ? `<p class="bn-context"${bp('context')}>${escapeHtml(data.context)}</p>`
      : '';
  return (
    `<div class="bn${accentCls}${bignumberSize(String(data.value))}">` +
    `<div class="bn-value-row"><span class="bn-value"${bp('value')}>${escapeHtml(data.value)}</span>${delta}</div>` +
    `<div class="bn-label"${bp('label')}>${escapeHtml(data.label)}</div>` +
    context +
    `</div>`
  );
}
