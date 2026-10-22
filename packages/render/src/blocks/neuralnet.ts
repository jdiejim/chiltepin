/**
 * Renders a `neuralnet` block — a layered neural network, one column of
 * units per layer, left to right, dense-connected to the next column.
 *
 * A layer with more units than `maxUnits` (default 6) draws `maxUnits`
 * circles with a vertical ellipsis between the last two, and prints the real
 * `units` under its label, so a 784-unit input still reads as one column.
 * The mesh between two layers is every drawn unit to every drawn unit as a
 * hairline, so it reads as a texture rather than as edges; `connect: none`
 * on a layer skips the mesh into it.
 *
 * Skin (`DESIGN.md`): unit glyphs are told apart by shape and fill, never by
 * hue — input and output units hollow (paper, ink outline), hidden units
 * filled `muted`, a `conv` unit a square, `pool` a rounded square on the
 * inactive fill, `attention` a diamond, `norm` the inactive fill,
 * `dropout` a dashed outline. Zero accent: the network is one shape.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { countPhrase, svgName } from '../svg/svgTitle.js';
import { cutTitle, ellipsize, fitText, FONT, type Wrapped } from '../svg/wrapText.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';

type Layer = BlockDataMap['neuralnet']['layers'][number];
type Kind = NonNullable<Layer['kind']>;

const DEFAULT_MAX_UNITS = 6;
/** Units drawn for a layer that names no `units` and has no predecessor. */
const DEFAULT_DRAWN = 4;
const R = 8;
const STEP = 24;
/** Extra vertical room the ellipsis takes between the last two units. */
const ELLIPSIS_GAP = 18;
const COL_W = 124;
/** The widest a column grows so its label and note fit without a cut. */
const COL_W_MAX = 172;
/** The most lines a layer label, and its note, take before they cut. */
const LABEL_LINES = 3;
const NOTE_LINES = 2;
const PAD_X = 30;
const PAD_TOP = 22;
const LABEL_GAP = 26;
const LINE_H = 14;
const SUB_H = 13;

/**
 * One unit glyph per kind: the shape and the fill/stroke it takes, at radius
 * `r`. The legend draws its swatches with this same function at a smaller
 * radius, so a swatch is always a small copy of the unit it names.
 */
export function unitGlyph(kind: Kind, cx: number, cy: number, r: number = R): string {
  const hollow = 'fill="var(--paper)" stroke="var(--ink)" stroke-width="1.5"';
  const filled = 'fill="var(--muted)" stroke="var(--muted)" stroke-width="1"';
  const inactive = 'fill="var(--paper-2)" stroke="var(--rule-solid)" stroke-width="1"';
  const n = (v: number): string => String(Math.round(v * 100) / 100);
  switch (kind) {
    case 'input':
    case 'output':
      return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" ${hollow}/>`;
    case 'conv':
      return `<rect x="${n(cx - r + 1)}" y="${n(cy - r + 1)}" width="${n(2 * r - 2)}" height="${n(2 * r - 2)}" ${filled}/>`;
    case 'pool':
      return `<rect x="${n(cx - r + 1)}" y="${n(cy - r + 1)}" width="${n(2 * r - 2)}" height="${n(2 * r - 2)}" rx="${n(r / 2)}" ${inactive}/>`;
    case 'attention':
      return `<path d="M${n(cx)} ${n(cy - r - 1)} L${n(cx + r + 1)} ${n(cy)} L${n(cx)} ${n(cy + r + 1)} L${n(cx - r - 1)} ${n(cy)} z" ${filled}/>`;
    case 'norm':
      return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" ${inactive}/>`;
    case 'dropout':
      return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="var(--paper)" stroke="var(--rule-solid)" stroke-width="1" stroke-dasharray="3 2"/>`;
    case 'recurrent':
      return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" ${filled}/><circle cx="${n(cx)}" cy="${n(cy)}" r="${n((r * 3) / 8)}" fill="var(--paper)"/>`;
    case 'embedding':
    case 'dense':
      return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" ${filled}/>`;
  }
}

/** The legend swatch box (the shared `.lg-sw` size) and the unit radius drawn in it. */
const SW_W = 30;
const SW_H = 14;
const SW_R = 5.5;

/**
 * The legend strip, one item per kind present, each swatch drawn by
 * {@link unitGlyph} — the shared strip's markup, with the network's own
 * glyphs (a diamond for attention, a square for conv, a ring for recurrent).
 */
function kindLegend(kinds: readonly Kind[]): string {
  if (kinds.length < 2) return '';
  const items = kinds
    .map(
      (k) =>
        `<span class="lg-item"><svg class="lg-sw" viewBox="0 0 ${SW_W} ${SW_H}" width="${SW_W}" height="${SW_H}" aria-hidden="true">${unitGlyph(k, SW_W / 2, SW_H / 2, SW_R)}</svg><span class="lg-label">${escapeHtml(k)}</span></span>`,
    )
    .join('');
  return `<div class="diagram-legend"><span class="lg-title t-eyebrow">Legend</span>${items}</div>`;
}

/** Infers the kind of a layer that names none: first is input, last is output, the rest dense. */
function kindOf(l: Layer, i: number, n: number): Kind {
  if (l.kind !== undefined) return l.kind;
  if (i === 0) return 'input';
  if (i === n - 1) return 'output';
  return 'dense';
}

export function renderNeuralnet(data: BlockDataMap['neuralnet']): string {
  const layers = data.layers;
  const n = layers.length;
  const maxUnits = Math.max(1, Math.min(12, Math.round(data.maxUnits ?? DEFAULT_MAX_UNITS)));

  // Drawn units per layer: min(units, maxUnits); a layer without `units`
  // keeps the width of the layer before it (norm, dropout) or the default.
  const drawn: number[] = [];
  const truncated: boolean[] = [];
  layers.forEach((l, i) => {
    const prev = drawn[i - 1] ?? DEFAULT_DRAWN;
    const real = l.units !== undefined ? Math.max(1, Math.round(l.units)) : undefined;
    const d = real !== undefined ? Math.min(real, maxUnits) : Math.min(prev, maxUnits);
    drawn.push(d);
    truncated.push(real !== undefined && real > d);
  });

  const colH = (i: number): number => ((drawn[i] ?? 1) - 1) * STEP + (truncated[i] === true ? ELLIPSIS_GAP : 0) + 2 * R;
  const tallest = Math.max(...layers.map((_, i) => colH(i)));
  const midY = PAD_TOP + tallest / 2;
  const kinds = layers.map((l, i) => kindOf(l, i, n));
  // Columns widen (in 8px steps, up to COL_W_MAX) until every label fits in
  // LABEL_LINES lines and every note in NOTE_LINES; past that, text cuts.
  const fitsAt = (w: number): boolean =>
    layers.every(
      (l) =>
        !fitText(l.label, { width: w - 10, font: FONT.name, maxLines: LABEL_LINES }).truncated &&
        !fitText(l.note, { width: w - 8, font: FONT.sub, maxLines: NOTE_LINES }).truncated &&
        !ellipsize(l.activation, w - 8, FONT.sub).truncated,
    );
  let colW = COL_W;
  while (colW < COL_W_MAX && !fitsAt(colW)) colW += 8;
  const labelLines: Wrapped[] = layers.map((l, i) =>
    fitText(l.label, {
      width: colW - 10,
      font: FONT.name,
      maxLines: LABEL_LINES,
      report: { path: `layers.${i}.label`, field: 'label', hint: 'Shorten the layer `label`; put the detail in `note`.' },
    }),
  );
  const noteLines: Wrapped[] = layers.map((l, i) =>
    fitText(l.note, {
      width: colW - 8,
      font: FONT.sub,
      maxLines: NOTE_LINES,
      report: { path: `layers.${i}.note`, owner: l.label, field: 'note', hint: 'Shorten the layer `note`.' },
    }),
  );
  const maxLabel = Math.max(1, ...labelLines.map((w) => w.lines.length));

  /** Centre y of unit `k` (0-based, top to bottom) in layer `i`. */
  const unitY = (i: number, k: number): number => {
    const d = drawn[i] ?? 1;
    const top = midY - colH(i) / 2 + R;
    const extra = truncated[i] === true && k === d - 1 ? ELLIPSIS_GAP : 0;
    return top + k * STEP + extra;
  };
  const colX = (i: number): number => PAD_X + colW / 2 + i * colW;

  const textTop = PAD_TOP + tallest + LABEL_GAP;
  const subRows = (l: Layer, i: number): number =>
    (l.units !== undefined ? 1 : 0) + (l.activation !== undefined ? 1 : 0) + (noteLines[i]?.lines.length ?? 0);
  const maxSub = Math.max(0, ...layers.map(subRows));
  const width = PAD_X * 2 + n * colW;
  const height = textTop + maxLabel * LINE_H + maxSub * SUB_H + 14;

  const a11y = svgName('Neural network', data.title, [countPhrase(n, 'layer')]);
  let s = `<svg viewBox="0 0 ${width} ${height}"${a11y.attrs}>${a11y.title}`;

  // The mesh, beneath the units: every drawn unit of layer i-1 to every drawn
  // unit of layer i, unless layer i opts out.
  s += `<g fill="none" stroke="var(--rule-solid)" stroke-width=".6" data-decorative="1">`;
  for (let i = 1; i < n; i++) {
    if (layers[i]?.connect === 'none') continue;
    const x0 = colX(i - 1) + R;
    const x1 = colX(i) - R;
    for (let a = 0; a < (drawn[i - 1] ?? 0); a++) {
      const y0 = unitY(i - 1, a);
      for (let b = 0; b < (drawn[i] ?? 0); b++) {
        s += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${unitY(i, b)}"/>`;
      }
    }
  }
  s += `</g>`;

  const kindsUsed = new Set<Kind>();
  s += `<g${bl('layers')}>`;
  layers.forEach((l, i) => {
    const kind = kinds[i] ?? 'dense';
    kindsUsed.add(kind);
    const cx = colX(i);
    const d = drawn[i] ?? 1;
    let g = `<g${bp(`layers.${i}`)}>`;
    for (let k = 0; k < d; k++) g += unitGlyph(kind, cx, unitY(i, k));
    if (truncated[i] === true && d >= 2) {
      // The vertical ellipsis sits in the widened gap before the last unit.
      const yA = unitY(i, d - 2) + R;
      const yB = unitY(i, d - 1) - R;
      const mid = (yA + yB) / 2;
      g += `<g fill="var(--muted)" data-decorative="1"><circle cx="${cx}" cy="${mid - 5}" r="1.2"/><circle cx="${cx}" cy="${mid}" r="1.2"/><circle cx="${cx}" cy="${mid + 5}" r="1.2"/></g>`;
    }
    const label = labelLines[i];
    let ty = textTop;
    g += `<g${bp(`layers.${i}.label`)}>`;
    (label?.lines ?? []).forEach((ln, li) => {
      g += `<text x="${cx}" y="${ty + li * LINE_H}" class="t-name" text-anchor="middle">${li === 0 && label !== undefined ? cutTitle(label) : ''}${escapeHtml(ln)}</text>`;
    });
    g += `</g>`;
    ty += maxLabel * LINE_H;
    if (l.units !== undefined) {
      g += `<text x="${cx}" y="${ty}" class="t-sub c-ink" text-anchor="middle"${bp(`layers.${i}.units`)}>${escapeHtml(String(l.units))}</text>`;
      ty += SUB_H;
    }
    if (l.activation !== undefined) {
      const act = ellipsize(l.activation, colW - 8, FONT.sub, {
        path: `layers.${i}.activation`,
        owner: l.label,
        field: 'activation',
        hint: 'Shorten `activation` to the function name.',
      });
      g += `<text x="${cx}" y="${ty}" class="t-sub" text-anchor="middle"${bp(`layers.${i}.activation`)}>${cutTitle(act)}${escapeHtml(act.lines[0] ?? '')}</text>`;
      ty += SUB_H;
    }
    const note = noteLines[i];
    if (note !== undefined && note.lines.length > 0) {
      const texts = note.lines.map(
        (ln, li) =>
          `<text x="${cx}" y="${ty + li * SUB_H}" class="t-sub c-soft" text-anchor="middle"${note.lines.length === 1 ? bp(`layers.${i}.note`) : ''}>${li === 0 ? cutTitle(note) : ''}${escapeHtml(ln)}</text>`,
      );
      g += note.lines.length === 1 ? texts.join('') : `<g${bp(`layers.${i}.note`)}>${texts.join('')}</g>`;
    }
    g += `</g>`;
    s += g;
  });
  s += `</g></svg>`;

  const legend = kindLegend([...kindsUsed]);
  const desc =
    data.description !== undefined && data.lede !== undefined
      ? `${data.description} ${data.lede}`
      : (data.description ?? data.lede);
  const footer =
    data.params !== undefined
      ? `<div class="diagram-foot"><span${bp('params')}><strong>Params</strong> ${escapeHtml(data.params)}</span></div>`
      : '';

  return diagramFrame(
    {
      tag: 'NEURAL NET',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(desc !== undefined ? { desc } : {}),
      ...(legend.length > 0 ? { legendHtml: legend } : {}),
      ...(footer.length > 0 ? { footerHtml: footer } : {}),
    },
    s,
  );
}
