/**
 * Renders a `list` block — a "fancy" bullet list with four marker styles:
 * `accent` (a coloured left bar, the default), `check` (status ticks),
 * `icon` (a line-icon chip per row), and `number` (numbered badges). Each item
 * has a bold lead and an optional supporting line.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { iconSvg } from '../svg/icons.js';

type ListData = BlockDataMap['list'];
type ListItem = ListData['items'][number];
type Style = NonNullable<ListData['style']>;

/** Builds the per-item marker for a given style. */
function marker(item: ListItem, style: Style, index: number): string {
  if (style === 'check') {
    const off = item.done === false;
    return `<span class="ls-mark ls-check${off ? ' ls-off' : ''}" aria-hidden="true">${off ? '○' : '✓'}</span>`;
  }
  if (style === 'number') {
    return `<span class="ls-mark ls-num" aria-hidden="true">${index + 1}</span>`;
  }
  if (style === 'icon') {
    return `<span class="ls-mark ls-icon" aria-hidden="true">${iconSvg(item.icon ?? 'check')}</span>`;
  }
  return `<span class="ls-mark ls-bar" aria-hidden="true"></span>`; // accent
}

function renderItem(item: ListItem, style: Style, index: number, fallbackAccent?: string): string {
  const accent = item.accent ?? fallbackAccent;
  const accentCls = accent !== undefined ? ` ls-${accent}` : '';
  const text =
    item.text !== undefined
      ? `<span class="ls-text"${bp(`items.${index}.text`)}>${escapeHtml(item.text)}</span>`
      : '';
  return (
    `<li class="ls-item${accentCls}"${bp(`items.${index}`)}>` +
    marker(item, style, index) +
    `<span class="ls-body"><span class="ls-lead"${bp(`items.${index}.lead`)}>${escapeHtml(item.lead)}</span>${text}</span>` +
    `</li>`
  );
}

export function renderList(data: ListData): string {
  const style: Style = data.style ?? 'accent';
  const head = data.title !== undefined ? `<div class="ls-head">${escapeHtml(data.title)}</div>` : '';
  const desc = data.description !== undefined ? `<p class="ls-desc">${escapeHtml(data.description)}</p>` : '';
  const items = data.items
    .map((it, i) => renderItem(it, style, i, data.accent))
    .join('');
  return `<div class="list-block ls-style-${style}">${head}${desc}<ul class="ls-list"${bl('items')}>${items}</ul></div>`;
}
