/**
 * Series and tone palette — the one place a chart may spend colour, and the
 * tone vocabulary of the algorithms & data-structures family.
 *
 * Charts use the skin's two channels (`DESIGN.md`): a series is a category,
 * so it takes a category hue (`--hue-*`, `svg/hues.ts`), and the accent stays
 * the one focal mark. Every hue clears 4.5:1 on paper in both themes, so a
 * series colour also works as text.
 *
 * Three vocabularies:
 *
 * - {@link seriesStyle} / {@link seriesColor}: `ink` for one series; the six
 *   hues in rotation for several; past six, the hues repeat with a dash and a
 *   marker shape, so no two series look the same. `negative` for a series the
 *   author marked `accent: red`.
 * - {@link marksOf}: what an item's legacy `accent` name means (focal,
 *   negative, or nothing).
 * - {@link dsTone}: the `array` / `linkedlist` / `bintree` / `hashmap` states.
 */

import { HUES } from './hues.js';

/** How many distinct hues a series rotation has before it adds a dash. */
export const SERIES_HUES = HUES.length;

/** A marker shape for a line series; the shape changes with each rotation past six. */
export type SeriesMarker = 'circle' | 'square' | 'diamond';

/** How one series draws: its colour, a tint for a hollow fill, and the variation past six series. */
export interface SeriesStyle {
  /** Stroke and fill token. */
  readonly color: string;
  /** The opaque tint of the same hue — the fill of a hollow (second-rotation) bar. */
  readonly tint: string;
  /** 0 for the first six series, 1 for series 7–12, and so on. */
  readonly round: number;
  /** `stroke-dasharray` for a line, `''` when solid. */
  readonly dash: string;
  /** The vertex marker for a line. */
  readonly marker: SeriesMarker;
}

const DASHES: readonly string[] = ['', '6 3', '2 3'];
const MARKERS: readonly SeriesMarker[] = ['circle', 'square', 'diamond'];

/**
 * The style of series `i` (0-based) in a chart of `count` series.
 *
 * - One series: `ink` — nothing to tell apart, so nothing is coloured.
 * - Several: the category hues in {@link HUES} order. Past six, the hues
 *   repeat, but each rotation adds a dash pattern and a marker shape (and a
 *   bar draws hollow), so a colour never repeats silently.
 * - `accent: red` on a series is the author saying "this one is the bad one":
 *   it takes `negative`. Every other legacy accent name is ignored — the skin
 *   (not the author) picks hues.
 */
export function seriesStyle(i: number, count: number, accent?: string | undefined): SeriesStyle {
  const k = ((i % SERIES_HUES) + SERIES_HUES) % SERIES_HUES;
  const round = Math.max(0, Math.floor(i / SERIES_HUES));
  const dash = DASHES[round % DASHES.length] ?? '';
  const marker = MARKERS[round % MARKERS.length] ?? 'circle';
  if (accent === 'red') return { color: 'var(--negative)', tint: 'var(--negative-tint)', round, dash, marker };
  if (count <= 1) return { color: 'var(--ink)', tint: 'var(--paper-2)', round: 0, dash: '', marker: 'circle' };
  const hue = HUES[k] ?? 'blue';
  return { color: `var(--hue-${hue})`, tint: `var(--hue-${hue}-tint)`, round, dash, marker };
}

/** The colour of series `i` (0-based) in a chart of `count` series — see {@link seriesStyle}. */
export function seriesColor(i: number, count: number, accent?: string | undefined): string {
  return seriesStyle(i, count, accent).color;
}

/**
 * Label colours for a swatch whose fill is author DATA (the `palette` block):
 * the label must contrast with that fixed colour in both themes, so it cannot
 * be a theme token. The fallback swatch stands in for an unsafe colour value.
 */
export const SWATCH_TEXT = { dark: '#1f2937', light: '#ffffff', fallback: '#d1d5db' } as const;

/** What an item's legacy `accent` name means under the skin — see {@link marksOf}. */
export type Mark = 'focal' | 'negative' | undefined;

/**
 * Resolves the `accent` names on a list of items to the one meaning the skin
 * keeps: `red` is `negative`; any other name is a flag, and the flag means
 * "focal" only when exactly ONE item carries it — an author who coloured every
 * slice from the old palette marked nothing, so the ramp applies to all.
 */
export function marksOf(accents: ReadonlyArray<string | undefined>): Mark[] {
  const flagged = accents.filter((a) => a !== undefined && a !== 'red').length;
  return accents.map((a) => (a === 'red' ? 'negative' : a !== undefined && flagged === 1 ? 'focal' : undefined));
}

/** The tone names shared by the data-structure blocks. */
export type DsTone = 'active' | 'visited' | 'target' | 'muted';

/** Fill / stroke / text for one tone, plus the dash and weight the skin gives it. */
export interface DsToneStyle {
  readonly fill: string;
  readonly stroke: string;
  readonly text: string;
  readonly sw: number;
  /** `stroke-dasharray`, or `''` for a solid outline. */
  readonly dash: string;
}

/**
 * Algorithm states, told apart by stroke, fill and dash — never by hue alone
 * (`DESIGN.md`): `active` (the element under examination) is the accent
 * outline; `target` (the goal) is the accent outline on an accent tint;
 * `visited` is the inactive `paper-2` fill; `muted` (out of play) is a dashed
 * ghost. No tone is the plain paper cell with an ink outline.
 */
const TONES: Record<DsTone, DsToneStyle> = {
  active: { fill: 'var(--paper)', stroke: 'var(--accent)', text: 'var(--accent)', sw: 1.75, dash: '' },
  // Ink text: `accent` on the accent tint sits just under 4.5:1 at 13px.
  target: { fill: 'var(--accent-tint)', stroke: 'var(--accent)', text: 'var(--ink)', sw: 1.75, dash: '' },
  visited: { fill: 'var(--paper-2)', stroke: 'var(--rule-solid)', text: 'var(--muted)', sw: 1, dash: '' },
  muted: { fill: 'var(--paper)', stroke: 'var(--rule-solid)', text: 'var(--soft)', sw: 1, dash: '4 3' },
};

const NEUTRAL: DsToneStyle = { fill: 'var(--paper)', stroke: 'var(--ink)', text: 'var(--ink)', sw: 1.5, dash: '' };

/**
 * Resolves a tone (or none) to its style. Unknown tones (invalid per schema,
 * but render is lenient) fall back to the neutral cell.
 */
export function dsTone(tone: DsTone | undefined): DsToneStyle {
  if (tone === undefined) return NEUTRAL;
  return (TONES as Partial<Record<string, DsToneStyle>>)[tone] ?? NEUTRAL;
}

/** The SVG attributes for a tone's outline (fill, stroke, width, dash). */
export function dsToneAttrs(t: DsToneStyle): string {
  const dash = t.dash.length > 0 ? ` stroke-dasharray="${t.dash}"` : '';
  return ` fill="${t.fill}" stroke="${t.stroke}" stroke-width="${t.sw}"${dash}`;
}

/** The legend swatch and label for each tone the data-structure blocks share. */
export const DS_TONE_LEGEND: Readonly<Record<DsTone, { swatch: 'node-accent-outline' | 'node-accent' | 'node-fill2' | 'node-dashed'; label: string }>> = {
  active: { swatch: 'node-accent-outline', label: 'current' },
  target: { swatch: 'node-accent', label: 'target' },
  visited: { swatch: 'node-fill2', label: 'visited' },
  muted: { swatch: 'node-dashed', label: 'out of play' },
};
