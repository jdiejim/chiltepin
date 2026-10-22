/**
 * Text fitting for the SVG renderers.
 *
 * Three parts, one rule — **no renderer drops text without showing it**:
 *
 * - **Metrics.** One estimate of how wide a string sets in each type role
 *   (`FONT.name` is `.t-name`, 13px Inter 600; `FONT.sub` is `.t-sub`, 10px
 *   mono; …), so every renderer measures the same text the same way.
 * - **Wrapping.** Word-aware, and identifier-aware: a word wider than the line
 *   breaks at its own joints (`fetch_` · `policy_document`, `com.example.` ·
 *   `checkout`, `Payment` · `Method`) before it breaks anywhere else.
 * - **Cuts.** When a wrap must drop text, the last kept line ends with "…",
 *   the result says `truncated: true` and carries the `full` text. The
 *   renderer puts `full` in an SVG `<title>` ({@link cutTitle}) and reports
 *   the cut ({@link reportCut}); the geometry report turns every cut into a
 *   `label-truncated` issue, which `check` shows as `W_GEOMETRY`.
 *
 * A renderer that can grow its box grows it first; a cut is the last resort.
 */

import { escapeHtml } from '../escape.js';

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

/** A type role as the width estimate sees it. */
export interface Font {
  /** Font size in px (viewBox units). */
  readonly size: number;
  /** A monospace face (`--font-mono`): every glyph has the same advance. */
  readonly mono?: boolean;
  /** CSS font weight (400 when absent). */
  readonly weight?: number;
  /** Letter spacing in em (`letter-spacing:.14em` → 0.14). */
  readonly tracking?: number;
}

/**
 * The type roles of `DESIGN.md`, plus the few body sizes the card renderers
 * use. Measure with these rather than a per-file `CHAR_W`.
 */
export const FONT = {
  /** `.t-name` — node and entity names: 13px Inter 600. */
  name: { size: 13, weight: 600 },
  /** `.t-sub` — sublabels (tech, port, path): 10px mono. */
  sub: { size: 10, mono: true },
  /** `.t-eyebrow` — kind chips, frame tabs: 8.5px mono 500, `.14em`, uppercase. */
  eyebrow: { size: 8.5, mono: true, weight: 500, tracking: 0.14 },
  /** `.t-arrow` — arrow and relation labels: 9.5px mono, `.04em`. */
  arrow: { size: 9.5, mono: true, tracking: 0.04 },
  /** `.t-badge` — step numbers: 9px mono 600. */
  badge: { size: 9, mono: true, weight: 600 },
  /** 11px mono — code-ish values in cells and pills (array, hash map, packet). */
  code: { size: 11, mono: true },
  /** 12px Inter 400 — body copy inside cards (descriptions, notes). */
  body: { size: 12 },
  /** 11px Inter 400 — small body copy inside cards. */
  small: { size: 11 },
} as const satisfies Record<string, Font>;

/** Advance of one monospace glyph, in em (SF Mono, Menlo and Consolas all set near 0.6). */
const MONO_EM = 0.605;

/**
 * Advance widths of the proportional face, in em at weight 400 (Inter's
 * proportions, rounded up a little so the estimate errs wide). Characters not
 * listed take the class default in {@link sansEm}.
 */
const SANS_EM: ReadonlyMap<string, number> = (() => {
  const m = new Map<string, number>();
  const set = (chars: string, em: number): void => {
    for (const c of chars) m.set(c, em);
  };
  set('abcdeghknopqsuvxyz', 0.57);
  set('m', 0.86);
  set('w', 0.79);
  set('frt', 0.38);
  set('ilj', 0.26);
  set('ABCDEFGHKLNOPQRSTUVXYZ', 0.7);
  set('MW', 0.9);
  set('I', 0.28);
  set('J', 0.52);
  set('0123456789', 0.6);
  set(' ', 0.27);
  set('.,:;\'|!', 0.27);
  set('"`', 0.4);
  set('()[]{}/\\', 0.38);
  set('-', 0.42);
  set('_', 0.52);
  set('·•', 0.3);
  set('+=<>~^*', 0.6);
  set('#$&?', 0.65);
  set('%@', 0.9);
  set('…', 0.8);
  set('–', 0.6);
  set('—→←↔⇒', 1);
  return m;
})();

/** One character's advance in em, at weight 400. */
function sansEm(c: string): number {
  const known = SANS_EM.get(c);
  if (known !== undefined) return known;
  const code = c.codePointAt(0) ?? 0;
  // CJK, Hangul, emoji and the like set square.
  if (code >= 0x2e80) return 1;
  return 0.62;
}

/**
 * How much wider a heavier weight sets than 400 — and a small size, which
 * system faces set with looser optical spacing.
 */
function weightGain(weight: number | undefined, size = 13): number {
  if (weight === undefined || weight < 500) return size <= 11 ? 1.03 : 1;
  if (weight < 600) return 1.03;
  if (weight < 700) return 1.06;
  return 1.08;
}

/**
 * The estimated width (px) of `text` set in `font`. Deterministic, and wide
 * rather than narrow: a box sized by it holds the text in Inter, SF Pro and
 * Helvetica alike.
 */
export function textWidth(text: string, font: Font = FONT.name): number {
  const tracking = (font.tracking ?? 0) * font.size;
  let em = 0;
  let n = 0;
  for (const c of text) {
    em += font.mono === true ? MONO_EM : sansEm(c);
    n++;
  }
  return em * font.size * (font.mono === true ? 1 : weightGain(font.weight, font.size)) + n * tracking;
}

/**
 * The average advance (px) of one character in `font` — for a renderer that
 * still budgets lines in characters (`wrapText(text, Math.floor(w / charWidth(f)), n)`).
 */
export function charWidth(font: Font = FONT.name): number {
  const tracking = (font.tracking ?? 0) * font.size;
  return font.mono === true ? MONO_EM * font.size + tracking : 0.55 * font.size * weightGain(font.weight, font.size) + tracking;
}

// ---------------------------------------------------------------------------
// Wrapping
// ---------------------------------------------------------------------------

/** The result of fitting text to lines. */
export interface Wrapped {
  /** The lines to draw. When `truncated`, the last one ends with "…". */
  readonly lines: string[];
  /** True when words or lines were dropped (or a single line was shortened). */
  readonly truncated: boolean;
  /** The whole text, whitespace collapsed — what the `<title>` shows. */
  readonly full: string;
}

/** The ellipsis that marks a cut. */
export const ELLIPSIS = '…';

/**
 * Splits one identifier at its natural joints, keeping each delimiter at the
 * end of the piece before the break: `fetch_policy_document` →
 * `fetch_`, `policy_`, `document`; `com.example.checkout` → `com.`,
 * `example.`, `checkout`; `PaymentMethodSelection` → `Payment`, `Method`,
 * `Selection`; `HTTPServer` → `HTTP`, `Server`; `/checkout/payment` →
 * `/checkout/`, `payment`. A word with no joint comes back whole.
 */
export function splitIdentifier(word: string): string[] {
  const pieces: string[] = [];
  let cur = '';
  const chars = [...word];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i] as string;
    const prev = chars[i - 1];
    const next = chars[i + 1];
    // A lower→Upper step, or the last capital of an acronym before a lower
    // (`HTTPServer` → `HTTP` · `Server`), starts a new piece.
    const camel =
      cur !== '' &&
      prev !== undefined &&
      isUpper(c) &&
      (isLowerOrDigit(prev) || (isUpper(prev) && next !== undefined && isLower(next)));
    if (camel) {
      pieces.push(cur);
      cur = '';
    }
    cur += c;
    // A delimiter ends its piece, unless it leads the word or doubles up.
    if (JOINTS.has(c) && i > 0 && i < chars.length - 1 && !JOINTS.has(next ?? '')) {
      pieces.push(cur);
      cur = '';
    }
  }
  if (cur !== '') pieces.push(cur);
  return pieces;
}

/** The characters an identifier breaks after. */
const JOINTS: ReadonlySet<string> = new Set(['_', '.', '/', '-', ':', '·', ',']);

function isUpper(c: string): boolean {
  return c !== c.toLowerCase() && c === c.toUpperCase();
}

function isLower(c: string): boolean {
  return c !== c.toUpperCase() && c === c.toLowerCase();
}

function isLowerOrDigit(c: string): boolean {
  return isLower(c) || (c >= '0' && c <= '9');
}

/** One unit of a line: a word, or a piece of a long word (`glue`: no space before it). */
interface Token {
  readonly text: string;
  readonly glue: boolean;
}

/** How a wrap measures a candidate line, and how much room a line has. */
interface Measure {
  readonly of: (s: string) => number;
  readonly limit: number;
}

/** Hard-splits a piece that is wider than the line, one character at a time. */
function hardSplit(piece: string, m: Measure): string[] {
  const out: string[] = [];
  let cur = '';
  for (const c of piece) {
    if (cur !== '' && m.of(cur + c) > m.limit) {
      out.push(cur);
      cur = c;
    } else {
      cur += c;
    }
  }
  if (cur !== '') out.push(cur);
  return out;
}

/** A number, and a short unit that must not wrap away from it (`2 s`, `16 GB`, `500 EUR`). */
const NUMBER = /^[-+]?\d[\d.,:]*$/;
const UNIT = /^[A-Za-zµ°%$€£]{1,3}[.,;:)]?$/;

/** The words of `full`, a number kept with its unit. */
function words(full: string): string[] {
  const out: string[] = [];
  for (const w of full.split(' ')) {
    const prev = out[out.length - 1];
    if (prev !== undefined && NUMBER.test(prev) && UNIT.test(w)) out[out.length - 1] = `${prev} ${w}`;
    else out.push(w);
  }
  return out;
}

/** The words of `full`, with every word wider than a line broken at its joints. */
function tokenize(full: string, m: Measure): Token[] {
  const tokens: Token[] = [];
  for (const word of words(full)) {
    if (word === '') continue;
    if (m.of(word) <= m.limit) {
      tokens.push({ text: word, glue: false });
      continue;
    }
    const pieces = splitIdentifier(word).flatMap((p) => (m.of(p) > m.limit ? hardSplit(p, m) : [p]));
    pieces.forEach((p, i) => tokens.push({ text: p, glue: i > 0 }));
  }
  return tokens;
}

/** Joins tokens into one string, honouring `glue`. */
function joinTokens(tokens: readonly Token[]): string {
  let s = '';
  for (const t of tokens) s += s === '' || t.glue ? t.text : ` ${t.text}`;
  return s;
}

/** Characters a cut line never ends on before the "…" (a dangling separator). */
const TRAILING = /[\s·•,;:–—\-_/.]+$/u;

/**
 * Shortens `text` to fit one line with a trailing "…". Cuts at a word or
 * identifier joint when that keeps most of the line, else mid-word.
 */
function ellipsizeTo(text: string, m: Measure): string {
  if (m.of(ELLIPSIS) > m.limit) return ELLIPSIS;
  const chars = [...text];
  let lo = 0;
  // The longest prefix that fits with the ellipsis (prefix width is monotonic).
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const cand = chars.slice(0, mid).join('').replace(TRAILING, '') + ELLIPSIS;
    if (m.of(cand) <= m.limit) lo = mid;
    else hi = mid - 1;
  }
  const hard = chars.slice(0, lo).join('');
  // Prefer the last joint (space or identifier delimiter) when it keeps ≥ 60%.
  const joint = Math.max(hard.lastIndexOf(' '), ...[...JOINTS].map((j) => hard.lastIndexOf(j) + 1));
  const soft = joint > 0 && m.of(hard.slice(0, joint)) >= m.limit * 0.6 ? hard.slice(0, joint) : hard;
  const kept = soft.replace(TRAILING, '');
  return (kept === '' ? hard : kept) + ELLIPSIS;
}

/** The shared wrap: greedy fill, then cut the overflow into the last line with "…". */
function wrapWith(text: unknown, m: Measure, maxLines: number): Wrapped {
  if (text === undefined || text === null) return { lines: [], truncated: false, full: '' };
  const full = String(text).replace(/\s+/g, ' ').trim();
  if (full === '' || maxLines <= 0) return { lines: [], truncated: full !== '', full };
  const tokens = tokenize(full, m);
  const lines: Token[][] = [];
  let cur: Token[] = [];
  for (const t of tokens) {
    if (cur.length === 0) {
      cur = [t];
      continue;
    }
    if (m.of(joinTokens([...cur, t])) <= m.limit) cur.push(t);
    else {
      lines.push(cur);
      cur = [t];
    }
  }
  if (cur.length > 0) lines.push(cur);
  if (lines.length <= maxLines) return { lines: lines.map(joinTokens), truncated: false, full };
  // Too many lines: keep maxLines − 1 whole, and fill the last with the rest, cut.
  const kept = lines.slice(0, maxLines - 1).map(joinTokens);
  const rest = joinTokens(lines.slice(maxLines - 1).flat());
  return { lines: [...kept, ellipsizeTo(rest, m)], truncated: true, full };
}

/**
 * Wraps text to lines of about `max` characters, at most `maxLines` of them.
 * Word-aware; a word longer than `max` breaks at its identifier joints (see
 * {@link splitIdentifier}). When text is dropped, the last line ends with "…".
 *
 * Kept for the renderers that budget in characters. Use {@link wrapLines}
 * (same budget) to learn whether the text was cut, or {@link fitText} to
 * budget in pixels for a type role.
 *
 * @param text - Source text (any value is coerced via `String(...)`).
 * @param max - Approximate maximum characters per line.
 * @param maxLines - Maximum number of lines to return.
 * @returns The wrapped lines; empty for empty input.
 */
export function wrapText(text: unknown, max: number, maxLines: number): string[] {
  return wrapLines(text, max, maxLines).lines;
}

/**
 * {@link wrapText} with the cut made explicit: `{ lines, truncated, full }`.
 * The budget is in characters.
 */
export function wrapLines(text: unknown, max: number, maxLines: number): Wrapped {
  return wrapWith(text, { of: (s) => [...s].length, limit: Math.max(1, max) }, maxLines);
}

/** Where a cut belongs, so the report can name it (see {@link LabelCut}). */
export type CutSite = Omit<LabelCut, 'full'>;

/** Options for {@link fitText}. */
export interface FitOptions {
  /** The room for one line, px. */
  readonly width: number;
  /** The type role the text sets in (default {@link FONT.name}). */
  readonly font?: Font;
  /** The most lines the text may take (default 1). */
  readonly maxLines?: number;
  /** When given and the text is cut, the cut is reported ({@link reportCut}). */
  readonly report?: CutSite;
}

/**
 * Wraps text to lines that fit `width` px in `font`, at most `maxLines` of
 * them. When text is dropped, the last line ends with "…" and — with a
 * `report` site — the cut goes to the geometry report.
 */
export function fitText(text: unknown, opts: FitOptions): Wrapped {
  const font = opts.font ?? FONT.name;
  const w = wrapWith(text, { of: (s) => textWidth(s, font), limit: Math.max(1, opts.width) }, opts.maxLines ?? 1);
  if (w.truncated && opts.report !== undefined) reportCut({ ...opts.report, full: w.full });
  return w;
}

/** One part of a label stack (a node's name, or the sublabel under it). */
export interface StackPart {
  readonly text: unknown;
  readonly font: Font;
  /** Baseline-to-baseline distance, px. */
  readonly lineH: number;
  /** The most lines this part ever takes. */
  readonly maxLines: number;
}

/** A label stack fitted to its box (see {@link fitStack}). */
export interface FittedStack {
  readonly head: Wrapped;
  readonly tail: Wrapped;
  /** Height of the stack as drawn, px. */
  readonly height: number;
  /** Height the whole text wants (up to each part's `maxLines`), px — grow the box to this. */
  readonly need: number;
}

/**
 * Fits a two-part label — a name (`head`) over a sublabel (`tail`), `gap`
 * px apart — to a box `width` px wide and `room` px tall. The whole text
 * when it fits; else the tail gives up lines first (down to one), then the
 * head, and what still does not fit ends with "…". `need` tells a renderer
 * how tall the box must be for nothing to be cut.
 */
export function fitStack(head: StackPart, tail: StackPart | undefined, width: number, room: number, gap: number): FittedStack {
  const empty: Wrapped = { lines: [], truncated: false, full: '' };
  const fit = (p: StackPart | undefined, lines: number): Wrapped =>
    p === undefined ? empty : fitText(p.text, { width, font: p.font, maxLines: lines });
  const h = (a: number, b: number): number => a * head.lineH + (b > 0 ? gap + b * (tail?.lineH ?? 0) : 0);
  const fullHead = fit(head, head.maxLines);
  const fullTail = fit(tail, tail?.maxLines ?? 0);
  const n = fullHead.lines.length;
  const t = fullTail.lines.length;
  const need = h(n, t);
  if (need <= room + 0.5) return { head: fullHead, tail: fullTail, height: need, need };
  const plans: ReadonlyArray<readonly [number, number]> = [
    [n, Math.min(t, 2)],
    [n, Math.min(t, 1)],
    [Math.min(n, 3), Math.min(t, 1)],
    [Math.min(n, 2), Math.min(t, 1)],
    [1, Math.min(t, 1)],
  ];
  const [pn, pt] = plans.find(([a, b]) => h(a, b) <= room + 0.5) ?? [1, Math.min(t, 1)];
  const outHead = pn < n ? fit(head, pn) : fullHead;
  const outTail = pt < t ? fit(tail, pt) : fullTail;
  return { head: outHead, tail: outTail, height: h(outHead.lines.length, outTail.lines.length), need };
}

/** How many lines `text` takes at `width` px in `font` with no cap (0 for empty text). */
export function lineCount(text: unknown, width: number, font: Font = FONT.name): number {
  return wrapWith(text, { of: (s) => textWidth(s, font), limit: Math.max(1, width) }, Number.MAX_SAFE_INTEGER).lines.length;
}

/**
 * `text` on one line of at most `width` px: whole when it fits, else cut
 * with "…" (and reported, with a `report` site).
 */
export function ellipsize(text: unknown, width: number, font: Font = FONT.name, report?: CutSite): Wrapped {
  const full = text === undefined || text === null ? '' : String(text).replace(/\s+/g, ' ').trim();
  const m: Measure = { of: (s) => textWidth(s, font), limit: Math.max(1, width) };
  if (m.of(full) <= m.limit) return { lines: full === '' ? [] : [full], truncated: false, full };
  const w: Wrapped = { lines: [ellipsizeTo(full, m)], truncated: true, full };
  if (report !== undefined) reportCut({ ...report, full });
  return w;
}

/**
 * `<title>full text</title>` for a cut text, else `''` — put it as the first
 * child of the `<text>` (or its group) so a pointer reveals what was cut.
 */
export function cutTitle(w: Pick<Wrapped, 'truncated' | 'full'>): string {
  return w.truncated ? `<title>${escapeHtml(w.full)}</title>` : '';
}

// ---------------------------------------------------------------------------
// Cut reports
// ---------------------------------------------------------------------------

/** One text a renderer had to cut. */
export interface LabelCut {
  /** Data path of the field that was cut (`nodes.3.tech`), when known. */
  readonly path?: string | undefined;
  /** What the text belongs to, as a reader names it (the node's name). */
  readonly owner?: string | undefined;
  /** The field that was cut (`name`, `tech`, `note`, `label`). */
  readonly field: string;
  /** The whole text the author wrote. */
  readonly full: string;
  /** The fix in the block's own data; a default names the field. */
  readonly hint?: string | undefined;
}

/** The open collectors, innermost last. A render is synchronous, so a stack is enough. */
const sinks: LabelCut[][] = [];

/**
 * Records a cut for the innermost {@link collectCuts} in progress. Outside
 * one (a normal page render) it does nothing.
 */
export function reportCut(cut: LabelCut): void {
  sinks[sinks.length - 1]?.push(cut);
}

/**
 * Runs `render` and returns its value with every cut it reported. The
 * geometry report renders a block through this to learn what was cut.
 */
export function collectCuts<T>(render: () => T): { value: T; cuts: LabelCut[] } {
  const mine: LabelCut[] = [];
  sinks.push(mine);
  try {
    return { value: render(), cuts: mine };
  } finally {
    sinks.pop();
  }
}
