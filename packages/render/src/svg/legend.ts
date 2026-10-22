/**
 * The legend strip under a figure — one item per encoding the diagram
 * actually used (node kinds present, arrow styles present, the accent's
 * meaning). Renderers build the list from their data; the strip is omitted
 * when fewer than two encodings are in play, because a legend with one entry
 * explains nothing.
 *
 * Every swatch is a tiny inline SVG drawn from the skin tokens (see
 * `DESIGN.md`), so a legend item always matches the stroke it stands for.
 */

import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { hueClass, type Hue } from './hues.js';

/** The swatch vocabulary — the encodings the skin can tell apart. */
export type LegendSwatch =
  | 'node'
  | 'node-accent'
  | 'node-dashed'
  | 'node-fill2'
  | 'edge'
  | 'edge-dashed'
  | 'edge-async'
  | 'edge-error'
  | 'edge-accent'
  | 'edge-link'
  /** The accent spent on a dashed response: accent, dashed, open head. */
  | 'edge-accent-dashed'
  /** A compensating / rollback flow: negative, dashed, filled head. */
  | 'edge-negative-dashed'
  /** UML realisation: dashed with a hollow triangle head. */
  | 'edge-implements'
  /** A plain line with a dot — a branch lane (gitgraph), no arrowhead. */
  | 'line-dot'
  | 'line-dot-accent'
  /** The three-sided data store (open right edge). */
  | 'node-store'
  /** A full stadium (start / end). */
  | 'node-stadium'
  | 'node-stadium-fill2'
  /** A `negative` outline on the negative tint — an error exit. */
  | 'node-negative'
  | 'chip'
  /** Paper fill, accent outline — the "current" element of a walkthrough. */
  | 'node-accent-outline'
  /** A solid swatch in the token named by `fill` — chart series, ramp steps. */
  | 'fill'
  /** A dot node (wardley / quadrant): `fill` / `stroke` / `dash` override paper / ink / solid. */
  | 'node-dot'
  /** A plain line with no head — a dependency, a baseline. */
  | 'line'
  /** A dashed line with no head — a non-identifying relation. */
  | 'line-dashed';

/** One legend entry: a swatch (or a text chip) and the label beside it. */
export interface LegendItem {
  readonly swatch: LegendSwatch;
  readonly label: string;
  /** The chip text, when `swatch` is `chip` (e.g. `EXT`, `#`, `1 / N`). */
  readonly chip?: string;
  /** The fill token (`var(--series-1, …)`), when `swatch` is `fill` or `node-dot`. */
  readonly fill?: string;
  /** The stroke token, when `swatch` is `node-dot` (default `ink`). */
  readonly stroke?: string;
  /** The dash pattern, when `swatch` is `node-dot` (default solid). */
  readonly dash?: string;
  /** Data path of the series / item this entry stands for (editors click it). */
  readonly path?: string;
  /**
   * The family hue a `chip` entry stands for: the chip takes the hue's text,
   * outline and tint, so it reads as a small copy of the node chip.
   */
  readonly hue?: Hue;
  /** A `chip` entry for a dashed kind (external, human gate): the chip's outline is dashed too. */
  readonly dashed?: boolean;
}

const SW_W = 30;
const SW_H = 14;

/** A small filled arrowhead ending at (x, y), pointing right. */
function head(x: number, y: number, stroke: string, filled: boolean): string {
  return filled
    ? `<path d="M${x - 6},${y - 3} L${x},${y} L${x - 6},${y + 3} z" fill="${stroke}"/>`
    : `<path d="M${x - 6},${y - 3} L${x},${y} L${x - 6},${y + 3}" fill="none" stroke="${stroke}" stroke-width="1.2"/>`;
}

function edgeSwatch(stroke: string, sw: number, dash: string, filled: boolean): string {
  const y = SW_H / 2;
  const dashAttr = dash.length > 0 ? ` stroke-dasharray="${dash}"` : '';
  return (
    `<line x1="1" y1="${y}" x2="${SW_W - 7}" y2="${y}" stroke="${stroke}" stroke-width="${sw}"${dashAttr}/>` +
    head(SW_W - 1, y, stroke, filled)
  );
}

function nodeSwatch(stroke: string, sw: number, fill: string, dash: string): string {
  const dashAttr = dash.length > 0 ? ` stroke-dasharray="${dash}"` : '';
  return `<rect x="1" y="1" width="${SW_W - 2}" height="${SW_H - 2}" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dashAttr}/>`;
}

function swatchSvg(kind: LegendSwatch, fill?: string, stroke?: string, dash?: string): string {
  let inner: string;
  switch (kind) {
    case 'node-dot': {
      const dashAttr = dash !== undefined && dash.length > 0 ? ` stroke-dasharray="${dash}"` : '';
      inner = `<circle cx="${SW_W / 2}" cy="${SW_H / 2}" r="5.5" fill="${fill ?? 'var(--paper)'}" stroke="${stroke ?? 'var(--ink)'}" stroke-width="1.5"${dashAttr}/>`;
      break;
    }
    case 'line':
      inner = `<line x1="1" y1="${SW_H / 2}" x2="${SW_W - 1}" y2="${SW_H / 2}" stroke="${stroke ?? 'var(--muted)'}" stroke-width="1.25"/>`;
      break;
    case 'line-dashed':
      inner = `<line x1="1" y1="${SW_H / 2}" x2="${SW_W - 1}" y2="${SW_H / 2}" stroke="${stroke ?? 'var(--muted)'}" stroke-width="1.25" stroke-dasharray="5 4"/>`;
      break;
    case 'node-accent-outline':
      inner = nodeSwatch('var(--accent)', 1.5, 'var(--paper)', '');
      break;
    case 'fill':
      inner = nodeSwatch('var(--rule-solid)', 1, fill ?? 'var(--ink)', '');
      break;
    case 'node':
      inner = nodeSwatch('var(--ink)', 1.5, 'var(--paper)', '');
      break;
    case 'node-accent':
      inner = nodeSwatch('var(--accent)', 1.5, 'var(--accent-tint)', '');
      break;
    case 'node-dashed':
      inner = nodeSwatch('var(--ink)', 1.25, 'var(--paper)', '4 3');
      break;
    case 'node-fill2':
      inner = nodeSwatch('var(--rule-solid)', 1, 'var(--paper-2)', '');
      break;
    case 'edge':
      inner = edgeSwatch('var(--muted)', 1.5, '', true);
      break;
    case 'edge-dashed':
      inner = edgeSwatch('var(--muted)', 1.5, '5 4', false);
      break;
    case 'edge-async':
      inner = edgeSwatch('var(--muted)', 1.25, '2 3', false);
      break;
    case 'edge-error':
      inner = edgeSwatch('var(--negative)', 1.5, '', true);
      break;
    case 'edge-accent':
      inner = edgeSwatch('var(--accent)', 1.75, '', true);
      break;
    case 'edge-link':
      inner = edgeSwatch('var(--link)', 1.5, '', true);
      break;
    case 'edge-accent-dashed':
      inner = edgeSwatch('var(--accent)', 1.75, '5 4', false);
      break;
    case 'edge-negative-dashed':
      inner = edgeSwatch('var(--negative)', 1.5, '5 4', true);
      break;
    case 'edge-implements': {
      const y = SW_H / 2;
      inner =
        `<line x1="1" y1="${y}" x2="${SW_W - 8}" y2="${y}" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="5 4"/>` +
        `<path d="M${SW_W - 8},${y - 4} L${SW_W - 1},${y} L${SW_W - 8},${y + 4} z" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.2"/>`;
      break;
    }
    case 'line-dot':
    case 'line-dot-accent': {
      const y = SW_H / 2;
      const c = kind === 'line-dot' ? 'var(--muted)' : 'var(--accent)';
      inner =
        `<line x1="1" y1="${y}" x2="${SW_W - 1}" y2="${y}" stroke="${c}" stroke-width="${kind === 'line-dot' ? 1.5 : 1.75}"/>` +
        `<circle cx="${SW_W / 2}" cy="${y}" r="3.5" fill="${c}"/>`;
      break;
    }
    case 'node-store':
      inner =
        `<rect x="1" y="1" width="${SW_W - 2}" height="${SW_H - 2}" fill="var(--paper-2)"/>` +
        `<path d="M${SW_W - 1},1 H1 V${SW_H - 1} H${SW_W - 1}" fill="none" stroke="var(--rule-solid)" stroke-width="1"/>`;
      break;
    case 'node-stadium':
      inner = `<rect x="1" y="1" width="${SW_W - 2}" height="${SW_H - 2}" rx="${(SW_H - 2) / 2}" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.5"/>`;
      break;
    case 'node-stadium-fill2':
      inner = `<rect x="1" y="1" width="${SW_W - 2}" height="${SW_H - 2}" rx="${(SW_H - 2) / 2}" fill="var(--paper-2)" stroke="var(--rule-solid)" stroke-width="1"/>`;
      break;
    case 'node-negative':
      inner = nodeSwatch('var(--negative)', 1.5, 'var(--negative-tint)', '');
      break;
    case 'chip':
      return '';
  }
  return `<svg class="lg-sw" viewBox="0 0 ${SW_W} ${SW_H}" width="${SW_W}" height="${SW_H}" aria-hidden="true">${inner}</svg>`;
}

/**
 * Renders the legend strip. Returns `''` when `items` has fewer than two
 * entries — a single encoding needs no key. `listPath` tags the strip as the
 * list container of the series / items its entries stand for.
 */
export function renderLegend(items: readonly LegendItem[], listPath?: string): string {
  if (items.length < 2) return '';
  const parts = items
    .map((it) => {
      const sw =
        it.swatch === 'chip'
          ? `<span class="lg-chip t-eyebrow${hueClass(it.hue)}${it.dashed === true ? ' lg-dashed' : ''}">${escapeHtml(it.chip ?? '')}</span>`
          : swatchSvg(it.swatch, it.fill, it.stroke, it.dash);
      const path = it.path !== undefined ? bp(it.path) : '';
      return `<span class="lg-item"${path}>${sw}<span class="lg-label">${escapeHtml(it.label)}</span></span>`;
    })
    .join('');
  const list = listPath !== undefined ? bl(listPath) : '';
  return `<div class="diagram-legend"${list}><span class="lg-title t-eyebrow">Legend</span>${parts}</div>`;
}
