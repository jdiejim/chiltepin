/**
 * Renders a `palette` block — colour-token swatches on a responsive card grid
 * (`--pl-cols`, default 4, clamped 2-6; collapses to 2 then 1 column on narrow
 * screens). Each card: a 64px swatch filled with the token's colour, the hex
 * shown in mono inside the swatch bottom-left (in `on`, or an auto-contrast
 * colour computed from the hex's relative luminance), then the token name and
 * an optional usage line. Invalid / unsafe colour values fall back to a
 * neutral gray swatch with dark label text.
 *
 * The swatches are the author's DATA and keep their colours; the label on a
 * swatch must contrast with that fixed colour in either theme, so it is a
 * fixed colour too (`SWATCH_TEXT` in `svg/dsTone.ts`), and it sits on a
 * translucent chip of the opposite tone so a mid-tone swatch still clears
 * 4.5:1. An author-supplied `on` colour is used as given, without the chip.
 * Only the chrome around the swatches is the skin's.
 *
 * Three honesty marks: every swatch has a hairline ring, so a swatch the
 * colour of the page still shows its edge; a colour with alpha sits on a
 * checkerboard, so the reader sees it is see-through; and a value the page
 * cannot draw (a `var(--token)` reference, or not a colour at all) shows a
 * hatched swatch that says so, never a stand-in grey.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { safeColor } from '../sanitize.js';
import { SWATCH_TEXT } from '../svg/dsTone.js';

type PaletteData = BlockDataMap['palette'];
type PaletteColor = PaletteData['colors'][number];

/** Neutral gray swatch used when a colour value is missing or unsafe. */
const FALLBACK_SWATCH = SWATCH_TEXT.fallback;
/** Label colours for light / dark swatches. */
const DARK_TEXT = SWATCH_TEXT.dark;
const LIGHT_TEXT = SWATCH_TEXT.light;

/** Parses `#rgb` / `#rrggbb` / `#rrggbbaa` into [r, g, b] (0-255), or null. */
function parseHex(value: string): readonly [number, number, number] | null {
  const hex = value.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    const chars = hex.split('');
    return [
      parseInt(`${chars[0]}${chars[0]}`, 16),
      parseInt(`${chars[1]}${chars[1]}`, 16),
      parseInt(`${chars[2]}${chars[2]}`, 16),
    ];
  }
  if (/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(hex)) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }
  return null;
}

/** WCAG relative luminance (0 black .. 1 white) of an [r, g, b] triple. */
function relativeLuminance(rgb: readonly [number, number, number]): number {
  const channel = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

/** Auto-contrast label colour for a swatch: dark text on light, white on dark. */
function contrastFor(swatch: string): string {
  const rgb = parseHex(swatch);
  if (rgb === null) return DARK_TEXT;
  return relativeLuminance(rgb) > 0.6 ? DARK_TEXT : LIGHT_TEXT;
}

/** The chip behind an auto-contrast label: the opposite tone, translucent so the swatch shows through. */
const CHIP_UNDER_DARK = 'rgba(255,255,255,.86)';
const CHIP_UNDER_LIGHT = 'rgba(0,0,0,.58)';

/** True for a colour with an alpha channel below 1 (`#rgba`, `#rrggbbaa`, `rgba()`, `hsla()`, `transparent`). */
export function hasAlpha(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (v === 'transparent') return true;
  const hex = /^#([0-9a-f]{4}|[0-9a-f]{8})$/.exec(v);
  if (hex !== null) {
    const a = hex[1] ?? '';
    return a.length === 4 ? a.slice(3) !== 'f' : a.slice(6) !== 'ff';
  }
  const fn = /^(?:rgba?|hsla?)\(([^)]*)\)$/.exec(v);
  if (fn === null) return false;
  const parts = (fn[1] ?? '').split(/[\s,/]+/).filter((x) => x !== '');
  if (parts.length < 4) return false;
  const a = parts[3] ?? '1';
  const n = a.endsWith('%') ? Number(a.slice(0, -1)) / 100 : Number(a);
  return Number.isFinite(n) && n < 1;
}

/** A hatched swatch for a value the page cannot draw, labelled with why. */
function unresolvedCard(color: PaletteColor, i: number, usage: string): string {
  const why = /^\s*var\(/i.test(color.value) ? 'token — not resolved here' : 'not a colour';
  return (
    `<div class="pl-card"${bp(`colors.${i}`)}>` +
    `<div class="pl-swatch pl-unresolved" title="${escapeHtml(why)}">` +
    `<span class="pl-hex pl-hex-raw"${bp(`colors.${i}.value`)}>${escapeHtml(color.value)}</span>` +
    `</div>` +
    `<div class="pl-meta">` +
    `<div class="pl-name t-name"${bp(`colors.${i}.name`)}>${escapeHtml(color.name)}</div>` +
    `<div class="pl-why">${escapeHtml(why)}</div>` +
    usage +
    `</div>` +
    `</div>`
  );
}

function renderCard(color: PaletteColor, i: number): string {
  const usageHtml =
    color.usage !== undefined
      ? `<div class="pl-usage"${bp(`colors.${i}.usage`)}>${escapeHtml(color.usage)}</div>`
      : '';
  if (safeColor(color.value, '') === '') return unresolvedCard(color, i, usageHtml);
  const swatch = safeColor(color.value, FALLBACK_SWATCH);
  const auto = contrastFor(swatch);
  const label = safeColor(color.on, auto);
  const chip = color.on === undefined ? `;background:${label === DARK_TEXT ? CHIP_UNDER_DARK : CHIP_UNDER_LIGHT}` : '';
  const usage = usageHtml;
  // An alpha colour layers over a checkerboard so its see-through part shows.
  const alpha = hasAlpha(swatch);
  const ground = alpha
    ? `background:linear-gradient(${swatch},${swatch}),repeating-conic-gradient(var(--paper-2) 0 25%,var(--paper) 0 50%) 0 0/14px 14px`
    : `background:${swatch}`;
  return (
    `<div class="pl-card"${bp(`colors.${i}`)}>` +
    `<div class="pl-swatch${alpha ? ' pl-alpha' : ''}" style="${ground}">` +
    `<span class="pl-hex" style="color:${label}${chip}"${bp(`colors.${i}.value`)}>${escapeHtml(color.value)}</span>` +
    `</div>` +
    `<div class="pl-meta">` +
    `<div class="pl-name t-name"${bp(`colors.${i}.name`)}>${escapeHtml(color.name)}</div>` +
    usage +
    `</div>` +
    `</div>`
  );
}

export function renderPalette(data: PaletteData): string {
  const head =
    data.title !== undefined ? `<div class="pl-head">${escapeHtml(data.title)}</div>` : '';
  const desc =
    data.description !== undefined
      ? `<p class="pl-desc">${escapeHtml(data.description)}</p>`
      : '';
  const cols = Math.min(6, Math.max(2, Math.floor(data.cols ?? 4)));
  const cards = data.colors.map((color, i) => renderCard(color, i)).join('');
  return (
    `<div class="palette">${head}${desc}` +
    `<div class="pl-grid" style="--pl-cols:${cols}"${bl('colors')}>${cards}</div>` +
    `</div>`
  );
}
