/**
 * Word wrap that never drops text, for the renderers that grow a box to fit
 * its label instead of capping its lines (state, sequence, swimlane, saga,
 * usecase, spans, erd).
 *
 * Words join with a space. A word longer than a line — an identifier such
 * as `PAST_DUE_AWAITING_RETRY` or `confirmCheckoutSession` — breaks at its
 * joints (after `_` / `-` / `.` / `/`, at a case change); its pieces join
 * without a space, and a piece that is still too long is cut into
 * line-sized chunks. The lines are balanced (the longest
 * line as short as it can be, earlier lines fuller on a tie), so a name never
 * ends on a lone `END` or `v14`.
 *
 * The identifier joints are the shared ones (`splitIdentifier` in
 * `svg/wrapText.ts`); a renderer that must cap its lines uses `fitText`
 * there instead, which marks and reports the cut.
 */

import { splitIdentifier } from '../svg/wrapText.js';

interface Piece {
  readonly text: string;
  /** True when a space separates this piece from the one before (a new word). */
  readonly space: boolean;
}

/**
 * Pieces of one identifier longer than a line: the shared `splitIdentifier`
 * joints (separators stay at the end of their piece), and a piece still
 * longer than a line cut into line-sized chunks.
 */
export function identPieces(word: string, max: number): string[] {
  const out: string[] = [];
  const size = Math.max(1, max);
  for (const part of splitIdentifier(word)) {
    for (let i = 0; i < part.length; i += size) out.push(part.slice(i, i + size));
  }
  return out;
}

const lineOf = (ps: readonly Piece[]): string =>
  ps.map((p, i) => (i > 0 && p.space ? ` ${p.text}` : p.text)).join('');

/**
 * Wraps `text` to about `max` characters a line, as many lines as it takes.
 * Returns `[]` for empty text.
 */
export function wrapAll(text: unknown, max: number): string[] {
  if (text === undefined || text === null) return [];
  const words = String(text).split(/\s+/).filter((w) => w.length > 0);
  const pieces: Piece[] = [];
  for (const w of words) {
    if (w.length > max) {
      identPieces(w, max).forEach((t, k) => pieces.push({ text: t, space: k === 0 }));
    } else pieces.push({ text: w, space: true });
  }
  // Greedy fill.
  const lines: Piece[][] = [];
  let cur: Piece[] = [];
  for (const p of pieces) {
    if (cur.length > 0 && lineOf([...cur, p]).length > max) {
      lines.push(cur);
      cur = [p];
    } else cur.push(p);
  }
  if (cur.length > 0) lines.push(cur);
  if (lines.length < 2) return lines.map(lineOf);
  return balance(pieces, lines.length, max).map(lineOf);
}

/**
 * Splits `pieces` into `k` lines (in order) so the longest line is as short
 * as possible and no line exceeds `max` when the greedy fill managed that;
 * ties keep the earlier lines fuller.
 */
function balance(pieces: readonly Piece[], k: number, max: number): Piece[][] {
  const n = pieces.length;
  const len = (i: number, j: number): number => lineOf(pieces.slice(i, j)).length;
  // best[i][m]: the smallest possible longest line for pieces[i..] in m lines.
  const best: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(k + 1).fill(Infinity));
  const cut: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(k + 1).fill(n));
  (best[n] as number[])[0] = 0;
  for (let i = n - 1; i >= 0; i--) {
    for (let m = 1; m <= k; m++) {
      for (let j = n; j > i; j--) {
        const l = len(i, j);
        if (l > max && j > i + 1) continue;
        const v = Math.max(l, best[j]?.[m - 1] ?? Infinity);
        if (v < (best[i]?.[m] ?? Infinity)) {
          (best[i] as number[])[m] = v;
          (cut[i] as number[])[m] = j;
        }
      }
    }
  }
  if (!Number.isFinite(best[0]?.[k] ?? Infinity)) return [pieces.slice()];
  const out: Piece[][] = [];
  let i = 0;
  for (let m = k; m > 0 && i < n; m--) {
    const j = cut[i]?.[m] ?? n;
    out.push(pieces.slice(i, j));
    i = j;
  }
  return out;
}
