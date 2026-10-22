/**
 * Does a drawing fit the page? One set of thresholds for `check` (from the
 * deterministic SVG viewBox, no browser), `shots`, and `review` (from the
 * browser's measurements), so the three never disagree.
 *
 * The page column at the reader's default width (a 1280 px window) shows a
 * drawing up to {@link PAGE_COLUMN} px wide at full size. Past that it
 * shrinks to fit; past the {@link STAGE_MAX} stage it keeps its natural size
 * and the stage scrolls sideways (see `blocks/frame.ts` in the renderer).
 * A drawing that shrinks below {@link SMALL_SCALE} of its size has labels
 * too small to read.
 */

import type { Diagnostic, Document } from 'chiltepin-core';
import { htmlRenderers } from 'chiltepin-render';

/** Drawings wider than this (viewBox units) scroll instead of shrinking. */
export const STAGE_MAX = 1600;
/** The diagram column at the default page width (a 1280 px window), in px. */
export const PAGE_COLUMN = 1020;
/** Below this share of its natural size, a drawing's labels read too small. */
export const SMALL_SCALE = 0.65;

/** How a drawing of `width` viewBox units sits in the column. */
export interface Fit {
  readonly width: number;
  /** True when the stage scrolls sideways. */
  readonly scrolls: boolean;
  /** Rendered size ÷ natural size (1 = full size), to two decimals. */
  readonly scale: number;
  /** True when the drawing shrinks below {@link SMALL_SCALE}. */
  readonly small: boolean;
}

/** The fit of a drawing `width` units wide, as the page lays it out. */
export function fitOf(width: number, column: number = PAGE_COLUMN): Fit {
  const scrolls = width > STAGE_MAX;
  const raw = scrolls || width <= column ? 1 : column / width;
  return { width: Math.round(width), scrolls, scale: Math.round(raw * 100) / 100, small: raw < SMALL_SCALE };
}

/** True when the drawing scrolls or shrinks below the readable share. */
export function misfits(f: Fit): boolean {
  return f.scrolls || f.small;
}

/** The fix for a drawing that does not fit, in the terms of its block's data. */
export function fitHint(type: string): string {
  switch (type) {
    case 'flow':
      return 'Set `dir: TB`, remove `col`/`row` so auto-layout can fit the page, or split the flow at a decision.';
    case 'sequence':
      return 'Split it at an `alt` frame (one sequence per branch), or remove actors that take part in one message.';
    case 'swimlane':
      return 'Split it at a handoff: one swimlane per phase, so each has fewer columns.';
    case 'erd':
      return 'Split it by aggregate: one `erd` per aggregate root, and name the shared key in a `note`.';
    case 'state':
      return 'Set `dir: TB`, remove `col`/`row`, or split the machine at a wait state.';
    case 'block':
    case 'c4':
    case 'dfd':
    case 'felogic':
    case 'cluster':
    case 'pkg':
    case 'threatmodel':
      return 'Set `dir: TB`, remove `col`/`row` so auto-layout packs the grid, or split the diagram by group.';
    case 'gantt':
    case 'timeline':
    case 'roadmap':
      return 'Split the plan into two periods, or shorten the item labels.';
    default:
      return 'Split it into two blocks, or shorten its labels.';
  }
}

/** One line that says how the drawing misfits. */
export function fitMessage(f: Fit): string {
  return f.scrolls
    ? `the drawing is ${String(f.width)} px wide and scrolls sideways (the stage shows ${String(STAGE_MAX)})`
    : `the drawing is ${String(f.width)} px wide and shrinks to ${String(Math.round(f.scale * 100))}% in the page column, so its labels read small`;
}

const STAGE_SVG_RE = /class="diagram-stage[^"]*"><svg\b[^>]*\bviewBox="-?[\d.]+ -?[\d.]+ ([\d.]+) [\d.]+"/;

/** The viewBox width of a block's staged drawing, or `undefined` when it has none. */
export function stageWidth(html: string): number | undefined {
  const m = STAGE_SVG_RE.exec(html);
  return m?.[1] !== undefined ? Number(m[1]) : undefined;
}

/**
 * `W_FIT` warnings: each block is drawn as the page draws it, and a drawing
 * that scrolls sideways or shrinks below a readable size is reported on its
 * fence line with the data fix for its type. A block with errors is skipped
 * (its errors come first), and a renderer failure is not this check's to
 * report.
 */
export function lintFit(doc: Document, file: string, validation: readonly Diagnostic[]): Diagnostic[] {
  const out: Diagnostic[] = [];
  const errorLines = validation.filter((d) => d.level === 'error').map((d) => d.line ?? 0);
  for (const seg of doc.segments) {
    if (seg.kind === 'markdown' || seg.kind === 'meta') continue;
    if (seg.parseError !== undefined || seg.data === undefined || seg.data === null) continue;
    const last = seg.line + seg.raw.split('\n').length + 1;
    if (errorLines.some((l) => l >= seg.line && l <= last)) continue;
    let html: string;
    try {
      html = (htmlRenderers[seg.kind] as (d: unknown) => string)(seg.data);
    } catch {
      continue;
    }
    const width = stageWidth(html);
    if (width === undefined) continue;
    const f = fitOf(width);
    if (!misfits(f)) continue;
    out.push({
      file,
      line: seg.line,
      level: 'warn',
      code: 'W_FIT',
      message: `${seg.sourceType ?? seg.kind}: ${fitMessage(f)}`,
      value: String(f.width),
      hint: fitHint(seg.kind),
    });
  }
  return out;
}
