/**
 * Renders a `mindmap` block — a radial idea map: the `center` as a pill in
 * the middle, depth-1 branches fanning out right and left in turn, deeper
 * nodes hanging off their branch toward the outside.
 *
 * Layout is a tidy tree per side: every subtree takes as many rows as it
 * has leaves, so branches never overlap; a parent sits at the middle of its
 * first and last child. Columns are sized per depth from the longest label
 * in that column, so a long branch name never runs into its children.
 *
 * Skin (`DESIGN.md`): the centre is a paper pill with an ink outline; branch
 * lines are `muted` curves and a node's label sits on a hairline in the
 * branch's tone. A branch `accent` is the author's colour-coding: `red` is
 * `negative`; one flagged branch takes the accent; two or more take the
 * category hues (a branch is a category) — the hue the author named when it
 * is one (`purple` is violet, `navy` is blue), else the next free hue, so two
 * branches never share a colour. `gray` stays muted. Every hue clears 4.5:1
 * as text on paper in both themes.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { HUES, type Hue } from '../svg/hues.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { countPhrase, svgName } from '../svg/svgTitle.js';
import { FONT, cutTitle, ellipsize, fitText, textWidth } from '../svg/wrapText.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';

type Node = BlockDataMap['mindmap']['nodes'][number];

const CHARS_PER_LINE = 24;
/** The most lines a node label grows to. */
const MAX_LINES = 4;
const CHAR_W = 7;
/** The widest a note line gets (10px mono), px. */
const NOTE_W = 170;
const LINE_H = 15;
const NOTE_H = 14;
const ROW_GAP = 10;
const BRANCH_GAP = 12;
const COL_GAP = 40;
const CENTER_H = 36;
const PAD = 24;

interface Laid {
  readonly node: Node;
  readonly index: number;
  readonly depth: number;
  readonly side: 1 | -1;
  readonly branch: number;
  readonly lines: string[];
  /** The label (or its note) was cut: the node carries a `<title>` with the whole text. */
  readonly tip: string;
  readonly w: number;
  y: number;
}

/** The hue an accent name asks for, when it names one. */
const NAMED_HUE: Readonly<Record<string, Hue>> = {
  blue: 'blue',
  navy: 'blue',
  teal: 'teal',
  green: 'green',
  amber: 'amber',
  purple: 'violet',
  violet: 'violet',
  rose: 'rose',
};

/**
 * The tone of every branch, by branch number (the order the roots appear).
 * `red` → negative; `gray` and no accent → muted; one flagged branch → the
 * accent; several → hues, the named one first unless an earlier branch holds
 * it, else the next free hue in rotation.
 */
export function branchTones(accents: readonly (string | undefined)[]): string[] {
  const isFlag = (a: string | undefined): boolean => a !== undefined && a !== 'red' && a !== 'gray';
  const flagged = accents.filter(isFlag).length;
  const taken = new Set<Hue>();
  let cursor = 0;
  return accents.map((a) => {
    if (a === 'red') return 'var(--negative)';
    if (!isFlag(a)) return 'var(--muted)';
    if (flagged === 1) return 'var(--accent)';
    let hue = a !== undefined ? NAMED_HUE[a] : undefined;
    if (hue === undefined || taken.has(hue)) {
      hue = undefined;
      for (let k = 0; k < HUES.length; k++) {
        const h = HUES[(cursor + k) % HUES.length] as Hue;
        if (!taken.has(h)) {
          hue = h;
          cursor = (cursor + k + 1) % HUES.length;
          break;
        }
      }
    }
    // Past six flagged branches every hue is spent: the rotation repeats.
    if (hue === undefined) {
      hue = HUES[cursor % HUES.length] as Hue;
      cursor += 1;
    }
    taken.add(hue);
    return `var(--hue-${hue})`;
  });
}

export function renderMindmap(data: BlockDataMap['mindmap']): string {
  const nodes = data.nodes;
  const byId = new Map<string, number>();
  nodes.forEach((n, i) => byId.set(n.id, i));
  const children = new Map<number, number[]>();
  const roots: number[] = [];
  nodes.forEach((n, i) => {
    const p = n.parent !== undefined ? byId.get(n.parent) : undefined;
    if (p === undefined || p === i) roots.push(i);
    else children.set(p, [...(children.get(p) ?? []), i]);
  });

  // Tones: the author's per-branch colour-coding, resolved once per branch
  // and keyed by branch number — the key every lookup below uses.
  const tones = branchTones(roots.map((r) => nodes[r]?.accent));
  const toneOf = new Map<number, string>();
  tones.forEach((t, bi) => toneOf.set(bi, t));

  const laid: Laid[] = [];
  const seen = new Set<number>();
  const rowH = (l: Laid): number => l.lines.length * LINE_H + (l.node.note !== undefined ? NOTE_H : 0) + ROW_GAP;
  /** Lays a subtree out from row `y0` (px); returns the rows it consumed. */
  const layout = (i: number, depth: number, side: 1 | -1, branch: number, y0: number): number => {
    if (seen.has(i)) return 0;
    seen.add(i);
    const node = nodes[i];
    if (node === undefined) return 0;
    // A label grows to four lines rather than lose words; past that it is cut
    // and the node's tooltip keeps the whole label.
    const fitted = fitText(node.label, {
      width: CHARS_PER_LINE * CHAR_W,
      font: FONT.name,
      maxLines: MAX_LINES,
      report: { field: 'label', path: `nodes.${i}.label`, hint: 'shorten the label, or move detail into `note`' },
    });
    const lines = fitted.lines;
    const note = node.note !== undefined ? ellipsize(node.note, NOTE_W, FONT.sub, { field: 'note', path: `nodes.${i}.note` }) : undefined;
    const w = Math.max(24, ...lines.map((ln) => textWidth(ln, FONT.name)), note !== undefined ? textWidth(note.lines[0] ?? '', FONT.sub) : 0);
    const me: Laid = { node, index: i, depth, side, branch, lines, tip: cutTitle(fitted), w, y: y0 };
    laid.push(me);
    const kids = children.get(i) ?? [];
    if (kids.length === 0) return rowH(me);
    let used = 0;
    const kidLaid: Laid[] = [];
    for (const k of kids) {
      const at = laid.length;
      used += layout(k, depth + 1, side, branch, y0 + used);
      const kl = laid[at];
      if (kl !== undefined && kl.index === k) kidLaid.push(kl);
    }
    const own = rowH(me);
    if (used < own) used = own;
    const first = kidLaid[0];
    const last = kidLaid[kidLaid.length - 1];
    me.y = first !== undefined && last !== undefined ? (first.y + last.y) / 2 : y0;
    return used;
  };

  // Branches alternate right / left; each side stacks its subtrees.
  let hRight = 0;
  let hLeft = 0;
  roots.forEach((r, bi) => {
    const side: 1 | -1 = bi % 2 === 0 ? 1 : -1;
    const start = side === 1 ? hRight : hLeft;
    const used = layout(r, 1, side, bi, start + (start > 0 ? BRANCH_GAP : 0));
    if (side === 1) hRight += used + (start > 0 ? BRANCH_GAP : 0);
    else hLeft += used + (start > 0 ? BRANCH_GAP : 0);
  });

  // Column widths per depth and side, from the longest label in the column.
  const colW = (side: 1 | -1, depth: number): number =>
    Math.max(0, ...laid.filter((l) => l.side === side && l.depth === depth).map((l) => l.w));
  const maxDepth = Math.max(1, ...laid.map((l) => l.depth));
  const extent = (side: 1 | -1): number => {
    let x = 0;
    for (let d = 1; d <= maxDepth; d++) {
      const w = colW(side, d);
      if (w > 0) x += COL_GAP + w;
    }
    return x;
  };
  const centerFit = fitText(data.center, { width: CHARS_PER_LINE * CHAR_W, font: FONT.name, maxLines: 2, report: { field: 'center', path: 'center' } });
  const centerLines = centerFit.lines;
  const centerW = Math.max(60, ...centerLines.map((ln) => textWidth(ln, FONT.name))) + 28;
  const centerH = centerLines.length > 1 ? CENTER_H + LINE_H : CENTER_H;
  const leftW = extent(-1);
  const rightW = extent(1);
  const bodyH = Math.max(hRight, hLeft, centerH);
  const width = PAD * 2 + leftW + centerW + rightW;
  const height = PAD * 2 + bodyH;
  const cx = PAD + leftW + centerW / 2;
  const cy = PAD + bodyH / 2;
  // Each side's stack is centred on the centre pill.
  const yOff = (side: 1 | -1): number => cy - (side === 1 ? hRight : hLeft) / 2;

  /** The x where a node's label starts (right side) or ends (left side). */
  const anchorX = (l: Laid): number => {
    let x = centerW / 2;
    for (let d = 1; d < l.depth; d++) {
      const w = colW(l.side, d);
      if (w > 0) x += COL_GAP + w;
    }
    x += COL_GAP;
    return cx + l.side * x;
  };
  const rowMid = (l: Laid): number => yOff(l.side) + l.y + (l.lines.length * LINE_H) / 2;
  const r = (v: number): number => Math.round(v * 10) / 10;

  const a11y = svgName('Mind map', data.center, [countPhrase(roots.length, 'branch'), countPhrase(nodes.length, 'node')]);
  let s = `<svg viewBox="0 0 ${r(width)} ${r(height)}"${a11y.attrs}>${a11y.title}`;

  // Connectors, beneath the labels.
  s += `<g fill="none" stroke-width="1.5" data-decorative="1">`;
  for (const l of laid) {
    const tone = toneOf.get(l.branch) ?? 'var(--muted)';
    const x1 = anchorX(l) - l.side * 6;
    const y1 = rowMid(l) + (l.lines.length * LINE_H) / 2 + 2;
    let x0: number;
    let y0: number;
    if (l.depth === 1) {
      x0 = cx + l.side * (centerW / 2);
      y0 = cy;
    } else {
      const p = laid.find((q) => q.index === byId.get(l.node.parent ?? ''));
      if (p === undefined) continue;
      x0 = anchorX(p) + l.side * (p.w + 6);
      y0 = rowMid(p) + (p.lines.length * LINE_H) / 2 + 2;
    }
    const qx = x0 + (x1 - x0) * 0.5;
    s += `<path d="M${r(x0)} ${r(y0)} Q${r(qx)} ${r(y1)} ${r(x1)} ${r(y1)}" stroke="${tone}"/>`;
    // The label sits on a hairline in the branch tone.
    s += `<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x1 + l.side * (l.w + 12))}" y2="${r(y1)}" stroke="${tone}" stroke-width="${l.depth === 1 ? 1.5 : 1}"/>`;
  }
  s += `</g>`;

  // The centre pill.
  s += `<g${bp('center')}>${cutTitle(centerFit)}<rect x="${r(cx - centerW / 2)}" y="${r(cy - centerH / 2)}" width="${r(centerW)}" height="${centerH}" rx="${centerH / 2}" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.5"/>`;
  centerLines.forEach((ln, li) => {
    s += `<text x="${r(cx)}" y="${r(cy + 4.5 - ((centerLines.length - 1) * LINE_H) / 2 + li * LINE_H)}" class="t-name" text-anchor="middle">${escapeHtml(ln)}</text>`;
  });
  s += `</g>`;

  // Labels.
  s += `<g${bl('nodes')}>`;
  for (const l of laid) {
    const tone = toneOf.get(l.branch) ?? 'var(--muted)';
    const x = anchorX(l);
    const top = yOff(l.side) + l.y;
    const anchor = l.side === 1 ? 'start' : 'end';
    const fill = tone !== 'var(--muted)' ? ` style="fill:${tone}"` : '';
    let g = `<g${bp(`nodes.${l.index}`)}>`;
    g += l.tip;
    l.lines.forEach((ln, li) => {
      g += `<text x="${r(x)}" y="${r(top + 11 + li * LINE_H)}" class="t-name" text-anchor="${anchor}"${fill}>${escapeHtml(ln)}</text>`;
    });
    if (l.node.note !== undefined) {
      const fitted = ellipsize(l.node.note, NOTE_W, FONT.sub);
      const note = fitted.lines[0] ?? '';
      const title = cutTitle(fitted);
      g += `<text x="${r(x)}" y="${r(top + l.lines.length * LINE_H + 13)}" class="t-sub c-soft" text-anchor="${anchor}"${bp(`nodes.${l.index}.note`)}>${title}${escapeHtml(note)}</text>`;
    }
    g += `</g>`;
    s += g;
  }
  s += `</g></svg>`;

  // A legend only when the branches are colour-coded: one entry per tone.
  const items: LegendItem[] = [];
  const shown = new Set<string>();
  roots.forEach((rt, bi) => {
    const tone = toneOf.get(bi) ?? 'var(--muted)';
    if (tone === 'var(--muted)' || shown.has(tone)) return;
    shown.add(tone);
    items.push({ swatch: 'line', stroke: tone, label: nodes[rt]?.label ?? '', path: `nodes.${rt}` });
  });
  const legend = renderLegend(items);

  return diagramFrame(
    {
      tag: 'MIND MAP',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legend.length > 0 ? { legendHtml: legend } : {}),
    },
    s,
  );
}
