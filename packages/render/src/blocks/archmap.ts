/**
 * Renders an `archmap` block — a target-architecture capability map: the
 * classic enterprise-architecture one-pager. A square mosaic of domain areas
 * (uppercase kicker label + optional desc), each packed with small
 * capability/system tiles. An area's `accent` names its category hue: the
 * panel takes the `--hue-*-tint` wash and the label the hue, as grid group
 * panels do (`gray`, or no accent, keeps the neutral panel). Tiles are
 * status-coded by stroke and word: a plain string is a current capability,
 * `target` is to-be-built (dashed), `new` is just added (heavier outline),
 * `gap` is missing (dashed + `GAP` chip), `deprecated` is retiring (struck
 * through on the inactive fill + `RETIRING` chip), so target and deprecated
 * never read alike. A compact legend below the mosaic shows only the
 * statuses actually used. Empty areas render as just the panel with its
 * label.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import type { Hue } from '../svg/hues.js';

type ArchmapData = BlockDataMap['archmap'];
type ArchmapArea = ArchmapData['areas'][number];
type ArchmapItem = NonNullable<ArchmapArea['items']>[number];

/** A tile's effective status — plain strings and status-less objects are `current`. */
type TileStatus = 'current' | 'target' | 'new' | 'gap' | 'deprecated';

const STATUS_ORDER: readonly TileStatus[] = ['current', 'target', 'new', 'gap', 'deprecated'];

const STATUS_LABEL: Record<TileStatus, string> = {
  current: 'Current',
  target: 'Target',
  new: 'New',
  gap: 'Gap',
  deprecated: 'Deprecated',
};

function statusOf(item: ArchmapItem): TileStatus {
  if (typeof item === 'string') return 'current';
  const s = item.status;
  // Unknown statuses (invalid per schema, but render is lenient) degrade to `current`.
  return s !== undefined && s in STATUS_LABEL ? s : 'current';
}

function nameOf(item: ArchmapItem): string {
  return typeof item === 'string' ? item : item.name;
}

/**
 * The category hue an area's legacy `accent` name maps to. `gray` (and no
 * accent) keeps the neutral panel; `red` is a category here, never an error,
 * so it takes `rose`.
 */
const AREA_HUE: Readonly<Record<NonNullable<ArchmapArea['accent']>, Hue | undefined>> = {
  navy: 'blue',
  blue: 'blue',
  teal: 'teal',
  green: 'green',
  amber: 'amber',
  purple: 'violet',
  red: 'rose',
  gray: undefined,
};

/** The hue of an area, or `undefined` for the neutral panel. */
export function areaHue(accent: ArchmapArea['accent']): Hue | undefined {
  return accent !== undefined ? AREA_HUE[accent] : undefined;
}

/** The word chip a status carries on its tile (and in the legend). */
const STATUS_CHIP: Partial<Record<TileStatus, string>> = { gap: 'Gap', deprecated: 'Retiring' };

function renderTile(item: ArchmapItem, path: string): string {
  const status = statusOf(item);
  const statusClass = status === 'current' ? '' : ` am-t-${status}`;
  // A gap is a missing capability, not an error: dashed outline plus a word
  // chip. A retiring tile is struck through and says so in its chip.
  const word = STATUS_CHIP[status];
  const chip = word !== undefined ? `<span class="t-eyebrow am-chip">${word}</span>` : '';
  return `<div class="am-tile${statusClass}"${bp(path)}><span class="am-name">${escapeHtml(nameOf(item))}</span>${chip}</div>`;
}

function renderArea(area: ArchmapArea, ai: number): string {
  const hue = areaHue(area.accent);
  const accent = hue !== undefined ? ` am-hue-${hue}` : '';
  const desc =
    area.desc !== undefined
      ? `<div class="am-area-desc"${bp(`areas.${ai}.desc`)}>${escapeHtml(area.desc)}</div>`
      : '';
  const items = area.items ?? [];
  const tiles =
    items.length > 0
      ? `<div class="am-tiles"${bl(`areas.${ai}.items`)}>${items
          .map((item, j) => renderTile(item, `areas.${ai}.items.${j}`))
          .join('')}</div>`
      : '';
  return (
    `<div class="am-area${accent}"${bp(`areas.${ai}`)}>` +
    `<div class="am-area-label"${bp(`areas.${ai}.label`)}>${escapeHtml(area.label)}</div>` +
    desc +
    tiles +
    `</div>`
  );
}

/**
 * The legend strip (shared `.diagram-legend` style) — one swatch per tile
 * status actually used; omitted when only one status is in play. The gap
 * entry shows its word chip, the same chip the tile carries.
 */
function renderLegend(areas: ArchmapData['areas']): string {
  const used = new Set<TileStatus>();
  for (const area of areas) {
    for (const item of area.items ?? []) used.add(statusOf(item));
  }
  const present = STATUS_ORDER.filter((s) => used.has(s));
  if (present.length < 2) return '';
  const items = present
    .map((s) => {
      const word = STATUS_CHIP[s];
      const sw =
        word !== undefined
          ? `<span class="lg-chip t-eyebrow">${word}</span>`
          : `<span class="lg-sw am-sw am-sw-${s}"></span>`;
      return `<span class="lg-item">${sw}<span class="lg-label">${STATUS_LABEL[s]}</span></span>`;
    })
    .join('');
  return `<div class="diagram-legend"><span class="lg-title t-eyebrow">Legend</span>${items}</div>`;
}

export function renderArchmap(data: ArchmapData): string {
  const head =
    data.title !== undefined
      ? `<div class="am-head"${bp('title')}>${escapeHtml(data.title)}</div>`
      : '';
  const desc =
    data.description !== undefined
      ? `<p class="am-desc"${bp('description')}>${escapeHtml(data.description)}</p>`
      : '';
  const cols = data.cols !== undefined ? Math.min(4, Math.max(2, Math.floor(data.cols))) : 3;
  const areas = data.areas.map((area, ai) => renderArea(area, ai)).join('');
  return (
    `<div class="archmap">${head}${desc}` +
    `<div class="am-grid" style="--am-cols:${cols}"${bl('areas')}>${areas}</div>` +
    renderLegend(data.areas) +
    `</div>`
  );
}
