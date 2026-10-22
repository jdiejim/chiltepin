/**
 * Renders a `drivers` block — a grid of factor/driver cards, each with an
 * optional line-icon, a coloured top accent, a title, body, and a small tag.
 * Good for "the N forces/requirements that shaped this" overviews.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { iconSvg } from '../svg/icons.js';

type DriverItem = NonNullable<BlockDataMap['drivers']['items']>[number];

function renderDriver(item: DriverItem, i: number): string {
  const accent = item.accent !== undefined ? ` dv-${item.accent}` : '';
  const icon = item.icon !== undefined ? iconSvg(item.icon, 'dv-icon') : '';
  const body =
    item.body !== undefined
      ? `<div class="dv-sub"${bp(`items.${i}.body`)}>${escapeHtml(item.body)}</div>`
      : '';
  const tag =
    item.tag !== undefined
      ? `<div class="dv-tag"${bp(`items.${i}.tag`)}>${escapeHtml(item.tag)}</div>`
      : '';
  return `<div class="dv-card${accent}"${bp(`items.${i}`)}>${icon}<div class="dv-title"${bp(`items.${i}.title`)}>${escapeHtml(item.title)}</div>${body}${tag}</div>`;
}

export function renderDrivers(data: BlockDataMap['drivers']): string {
  const items = data.items ?? [];
  const caption = data.title !== undefined ? `<div class="dv-head">${escapeHtml(data.title)}</div>` : '';
  const desc = data.description !== undefined ? `<p class="dv-desc">${escapeHtml(data.description)}</p>` : '';
  return `<div class="drivers">${caption}${desc}<div class="dv-grid"${bl('items')}>${items.map((item, i) => renderDriver(item, i)).join('')}</div></div>`;
}
