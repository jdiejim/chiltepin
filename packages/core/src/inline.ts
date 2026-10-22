/**
 * Inline styling: three small forms on top of GFM Markdown, for prose and for
 * the block fields that render as inline Markdown (table cells, callout
 * bodies, `prose` texts).
 *
 * - `==text==` is a highlight (`<mark>`), the Obsidian / markdown-it-mark form.
 * - `[text]{.class}` is a styled span, the Pandoc / markdown-it-attrs form.
 *   The class list is closed: one hue (`.blue` … `.rose`), `.kbd`, or `.pill`
 *   with at most one status word (`.todo`, `.done`, `.current`, `.blocked`).
 * - `:name:` is an inline icon from {@link ICON_NAMES}.
 *
 * Core owns the grammar, so the renderer (`chiltepin-render`, `markdown.ts`)
 * and the lint (`inlineLint.ts`) read a text the same way. The renderer maps
 * an allowed class to its own CSS class; an author's class text never reaches
 * the output. Pure: no I/O, no DOM.
 */

import { iconText, isIconName, type IconName } from './icons.js';
import type { BlockType } from './types.js';

/** The category hues a span may take (the skin's `--hue-<name>` tokens). */
export const SPAN_HUES = ['blue', 'green', 'amber', 'violet', 'teal', 'rose'] as const;
export type SpanHue = (typeof SPAN_HUES)[number];

/**
 * The status words a chip may take, in the skin's one chip encoding:
 * `todo` dashed · `done` filled · `current` accent · `blocked` negative.
 * A bare `.pill` is the plain ink outline. A chip never takes a hue.
 */
export const CHIP_STATUSES = ['todo', 'done', 'current', 'blocked'] as const;
export type ChipStatus = (typeof CHIP_STATUSES)[number];

/** Every class a span may name. */
export const SPAN_CLASSES: readonly string[] = [...SPAN_HUES, 'kbd', 'pill', ...CHIP_STATUSES];

/** What an allowed class list draws. */
export type SpanStyle =
  | { readonly kind: 'hue'; readonly hue: SpanHue }
  | { readonly kind: 'kbd' }
  | { readonly kind: 'chip'; readonly status?: ChipStatus };

/** Why a class list draws nothing: the span renders as its plain text. */
export type SpanProblem =
  /** A class outside {@link SPAN_CLASSES}. */
  | 'unknown'
  /** A status word with no `.pill`. */
  | 'status-needs-pill'
  /** A hue on a chip: the status word carries the meaning, never a colour. */
  | 'chip-hue'
  /** Two styles at once: two hues, a hue and `.kbd`, or two status words. */
  | 'mixed';

export type SpanClassResult =
  | { readonly ok: true; readonly style: SpanStyle }
  | { readonly ok: false; readonly problem: SpanProblem; readonly bad: string };

const HUE_SET: ReadonlySet<string> = new Set(SPAN_HUES);
const STATUS_SET: ReadonlySet<string> = new Set(CHIP_STATUSES);
const CLASS_SET: ReadonlySet<string> = new Set(SPAN_CLASSES);

/** Reads a span's class list (names without the dot) against the allowlist. */
export function readSpanClasses(classes: readonly string[]): SpanClassResult {
  const names = [...new Set(classes)];
  const unknown = names.find((c) => !CLASS_SET.has(c));
  if (unknown !== undefined) return { ok: false, problem: 'unknown', bad: unknown };
  const hues = names.filter((c) => HUE_SET.has(c));
  const statuses = names.filter((c) => STATUS_SET.has(c));
  if (names.includes('pill')) {
    if (hues.length > 0) return { ok: false, problem: 'chip-hue', bad: hues[0] as string };
    if (names.includes('kbd')) return { ok: false, problem: 'mixed', bad: 'kbd' };
    if (statuses.length > 1) return { ok: false, problem: 'mixed', bad: statuses[1] as string };
    const status = statuses[0] as ChipStatus | undefined;
    return { ok: true, style: status !== undefined ? { kind: 'chip', status } : { kind: 'chip' } };
  }
  if (statuses.length > 0)
    return { ok: false, problem: 'status-needs-pill', bad: statuses[0] as string };
  if (names.length !== 1) return { ok: false, problem: 'mixed', bad: names[1] as string };
  const only = names[0] as string;
  if (only === 'kbd') return { ok: true, style: { kind: 'kbd' } };
  return { ok: true, style: { kind: 'hue', hue: only as SpanHue } };
}

/* ── matchers ──────────────────────────────────────────────────────────────
 * Each matcher reads `src` from its first character, the way a Markdown
 * inline tokenizer does. `prev` is the character just before `src` (`''` at
 * the start of a text). Code spans and backslash escapes inside a form are
 * skipped when the matcher looks for the closing mark.
 */

/** A matched form: its source text and the text inside its marks. */
export interface InlineMatch {
  readonly raw: string;
  readonly text: string;
}

/** A matched span: also its class names, without the dots. */
export interface SpanMatch extends InlineMatch {
  readonly classes: readonly string[];
}

/** A matched icon: its source text and its name. */
export interface IconMatch {
  readonly raw: string;
  readonly name: string;
}

/** An ASCII letter or digit: the word characters a highlight must not touch. */
const ASCII_WORD = /[A-Za-z0-9]/;
/** A letter, a digit, or a colon: an icon must not touch these. */
const ICON_EDGE = /[\p{L}\p{N}:]/u;
/** An icon-shaped name: lowercase, words joined by `-` (or `_`, the emoji habit). */
const ICON_RE = /^:([a-z][a-z0-9]*(?:[-_][a-z0-9]+)*):/;
/** A span's attribute list: one or more `.class` names and nothing else. */
const ATTRS_RE = /^[ \t]*(\.[A-Za-z][\w-]*(?:[ \t]+\.[A-Za-z][\w-]*)*)[ \t]*$/;

/** Length of the backtick run at `i`. */
function runAt(src: string, i: number): number {
  let n = 0;
  while (src[i + n] === '`') n += 1;
  return n;
}

/**
 * The index just past the code span that opens at `i`, or the index just
 * past the backtick run when no run of the same length closes it (CommonMark:
 * then the backticks are literal).
 */
function pastCode(src: string, i: number): number {
  const n = runAt(src, i);
  for (let j = i + n; j < src.length; ) {
    if (src[j] === '`') {
      const m = runAt(src, j);
      if (m === n) return j + m;
      j += m;
    } else {
      j += 1;
    }
  }
  return i + n;
}

/**
 * `==text==`: no space inside either mark, no `=` or ASCII word character
 * outside it. The closing mark pairs with the nearest opening one, so an
 * unclosed `==` never swallows the next highlight.
 */
export function matchMark(src: string, prev = ''): InlineMatch | undefined {
  if (!src.startsWith('==') || prev === '=' || ASCII_WORD.test(prev)) return undefined;
  const first = src[2];
  if (first === undefined || first === '=' || /\s/.test(first)) return undefined;
  // Start on the first character inside: it may open a code span.
  let i = 2;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      i += 2;
    } else if (ch === '`') {
      i = pastCode(src, i);
    } else if (ch === '=' && src[i + 1] === '=' && i > 2) {
      const before = src[i - 1] ?? '';
      const after = src[i + 2] ?? '';
      if (!/\s/.test(before) && before !== '=' && after !== '=' && !ASCII_WORD.test(after)) {
        return { raw: src.slice(0, i + 2), text: src.slice(2, i) };
      }
      // A later `==` that can only open a highlight starts its own: this one
      // has no closing mark (the closer pairs with the nearest opener).
      if (
        after !== '' &&
        after !== '=' &&
        !/\s/.test(after) &&
        !ASCII_WORD.test(before) &&
        before !== '='
      )
        return undefined;
      while (src[i] === '=') i += 1;
    } else {
      i += 1;
    }
  }
  return undefined;
}

/** `[text]{.class …}`: balanced brackets, then a brace list of `.class` names only. */
export function matchSpan(src: string): SpanMatch | undefined {
  if (src[0] !== '[') return undefined;
  let depth = 0;
  let close = -1;
  let i = 0;
  while (i < src.length && close < 0) {
    const ch = src[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '`') {
      i = pastCode(src, i);
      continue;
    }
    if (ch === '[') depth += 1;
    else if (ch === ']') {
      depth -= 1;
      if (depth === 0) close = i;
    }
    i += 1;
  }
  if (close < 0 || src[close + 1] !== '{') return undefined;
  const end = src.indexOf('}', close + 2);
  if (end < 0) return undefined;
  const attrs = ATTRS_RE.exec(src.slice(close + 2, end));
  const text = src.slice(1, close);
  if (attrs === null || text.trim() === '') return undefined;
  const classes = (attrs[1] as string).split(/[ \t]+/).map((c) => c.slice(1));
  return { raw: src.slice(0, end + 1), text, classes };
}

/** Any icon-shaped `:name:` with no letter, digit, or colon on either side. */
export function matchIconLike(src: string, prev = ''): IconMatch | undefined {
  if (src[0] !== ':' || ICON_EDGE.test(prev)) return undefined;
  const m = ICON_RE.exec(src);
  if (m === null) return undefined;
  const after = src[m[0].length] ?? '';
  if (ICON_EDGE.test(after)) return undefined;
  return { raw: m[0], name: m[1] as string };
}

/** A `:name:` that names a known icon. */
export function matchIcon(
  src: string,
  prev = '',
): (IconMatch & { readonly name: IconName }) | undefined {
  const m = matchIconLike(src, prev);
  return m !== undefined && isIconName(m.name) ? { raw: m.raw, name: m.name } : undefined;
}

/**
 * The first index in `src` where a highlight or a known icon could start, or
 * -1. A Markdown tokenizer stops its plain-text run there. Only real
 * candidates count: a stop inside `https://` would break the URL autolink.
 */
export function inlineStart(src: string): number {
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '=' && src[i + 1] === '=') return i;
    if (ch === ':' && matchIcon(src.slice(i), src[i - 1] ?? '') !== undefined) return i;
  }
  return -1;
}

/* ── scanning a whole text ────────────────────────────────────────────── */

/** One form found in a text, at its offset. */
export type InlineFinding =
  | { readonly kind: 'mark'; readonly start: number; readonly raw: string }
  | {
      readonly kind: 'span';
      readonly start: number;
      readonly raw: string;
      readonly classes: readonly string[];
      readonly result: SpanClassResult;
    }
  | {
      readonly kind: 'icon';
      readonly start: number;
      readonly raw: string;
      readonly name: string;
      readonly known: boolean;
    };

const AUTOLINK_RE = /^<[A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s<>]*>/;
const BARE_URL_RE = /^(?:https?:\/\/|www\.)\S*/;

/** The index just past the `(…)` link destination that opens at `i` (balanced parens). */
function pastDestination(src: string, i: number): number {
  let depth = 0;
  for (let j = i; j < src.length; j += 1) {
    const ch = src[j];
    if (ch === '\\') j += 1;
    else if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return j + 1;
    } else if (ch === '\n') return j;
  }
  return src.length;
}

/**
 * The index just past a stretch where no inline form renders, when one
 * starts at `i`: a backslash escape, a code span, a link destination, an
 * autolink, or a bare URL. Otherwise -1.
 */
function pastLiteral(src: string, i: number): number {
  const ch = src[i];
  if (ch === '\\') return i + 2;
  if (ch === '`') return pastCode(src, i);
  if (ch === ']' && src[i + 1] === '(') return pastDestination(src, i + 1);
  if (ch === '<') {
    const auto = AUTOLINK_RE.exec(src.slice(i));
    if (auto !== null) return i + auto[0].length;
  }
  if ((ch === 'h' || ch === 'w') && !ASCII_WORD.test(src[i - 1] ?? '')) {
    const url = BARE_URL_RE.exec(src.slice(i));
    if (url !== null) return i + url[0].length;
  }
  return -1;
}

/**
 * Every highlight, span, and icon-shaped name in `text`, in order, with the
 * forms nested inside a highlight or a span. Code spans, escapes, link
 * destinations, and URLs are skipped: nothing renders there.
 */
export function scanInline(text: string, base = 0): InlineFinding[] {
  const out: InlineFinding[] = [];
  let i = 0;
  while (i < text.length) {
    const skip = pastLiteral(text, i);
    if (skip > i) {
      i = skip;
      continue;
    }
    const ch = text[i];
    const prev = text[i - 1] ?? '';
    const rest = text.slice(i);
    if (ch === '=') {
      const m = matchMark(rest, prev);
      if (m !== undefined) {
        out.push({ kind: 'mark', start: base + i, raw: m.raw });
        out.push(...scanInline(m.text, base + i + 2));
        i += m.raw.length;
        continue;
      }
    } else if (ch === '[') {
      const m = matchSpan(rest);
      if (m !== undefined) {
        out.push({
          kind: 'span',
          start: base + i,
          raw: m.raw,
          classes: m.classes,
          result: readSpanClasses(m.classes),
        });
        out.push(...scanInline(m.text, base + i + 1));
        i += m.raw.length;
        continue;
      }
    } else if (ch === ':') {
      const m = matchIconLike(rest, prev);
      if (m !== undefined) {
        out.push({
          kind: 'icon',
          start: base + i,
          raw: m.raw,
          name: m.name,
          known: isIconName(m.name),
        });
        i += m.raw.length;
        continue;
      }
    }
    i += 1;
  }
  return out;
}

/**
 * Removes the inline styling from a text and keeps its words: a highlight or
 * a span becomes its text, a known icon becomes its plain-text stand-in (a
 * check is `✓`, an arrow is `→`) or nothing. Other Markdown stays as written.
 * For the plain-text outputs: heading anchors, the contents list, the search
 * index, and the page description.
 */
export function stripInlineStyling(text: string): string {
  if (!scanInline(text).some((f) => f.kind !== 'icon' || f.known)) return text;
  let dropped = false;
  const strip = (s: string): string => {
    let out = '';
    let i = 0;
    while (i < s.length) {
      const skip = pastLiteral(s, i);
      if (skip > i) {
        out += s.slice(i, skip);
        i = skip;
        continue;
      }
      const ch = s[i] as string;
      const prev = s[i - 1] ?? '';
      const rest = s.slice(i);
      const mark = ch === '=' ? matchMark(rest, prev) : undefined;
      const span = ch === '[' ? matchSpan(rest) : undefined;
      const icon = ch === ':' ? matchIcon(rest, prev) : undefined;
      if (mark !== undefined || span !== undefined) {
        const m = (mark ?? span) as InlineMatch;
        out += strip(m.text);
        i += m.raw.length;
      } else if (icon !== undefined) {
        const stand = iconText(icon.name);
        if (stand === '') dropped = true;
        out += stand;
        i += icon.raw.length;
      } else {
        out += ch;
        i += 1;
      }
    }
    return out;
  };
  const out = strip(text);
  return dropped ? out.replace(/[ \t]{2,}/g, ' ').trim() : out;
}

/* ── where inline Markdown renders inside blocks ──────────────────────── */

/**
 * The block fields the renderer draws through its inline Markdown pipeline,
 * as paths: `[]` is any item of a list. The lint reads exactly these, so a
 * span or an icon in a field that renders it is checked, and the same text in
 * a plain label is left alone. A test in `chiltepin-render` keeps this list
 * and the renderers in step.
 */
export const INLINE_MD_FIELDS: Readonly<Partial<Record<BlockType, readonly string[]>>> = {
  callout: ['body'],
  pullquote: ['text'],
  prose: ['blocks[].text', 'blocks[].items[]'],
  scqa: ['situation', 'complication', 'question', 'answer', 'because[]'],
  table: ['columns[]', 'columns[].label', 'rows[][]', 'rows[][].v', 'foot[]', 'foot[].v', 'note'],
};

/** The block fields that name one icon (`icon: rocket`). */
export const ICON_FIELDS: Readonly<Partial<Record<BlockType, readonly string[]>>> = {
  list: ['items[].icon'],
  drivers: ['items[].icon'],
};

/** One string a field path reaches, with its concrete path. */
export interface FieldString {
  readonly path: ReadonlyArray<string | number>;
  readonly text: string;
}

/** The strings `data` holds at a path spec (`blocks[].items[]`, `rows[][].v`). */
export function stringsAt(data: unknown, spec: string): FieldString[] {
  const steps = spec.match(/[^.[\]]+|\[\]/g) ?? [];
  const out: FieldString[] = [];
  const walk = (value: unknown, at: number, path: Array<string | number>): void => {
    if (at === steps.length) {
      if (typeof value === 'string') out.push({ path, text: value });
      return;
    }
    const step = steps[at] as string;
    if (step === '[]') {
      if (Array.isArray(value)) value.forEach((v, i) => walk(v, at + 1, [...path, i]));
      return;
    }
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      walk((value as Record<string, unknown>)[step], at + 1, [...path, step]);
    }
  };
  walk(data, 0, []);
  return out;
}

/** Every string of a block that renders as inline Markdown, in field order. */
export function inlineMdStrings(kind: BlockType, data: unknown): FieldString[] {
  return (INLINE_MD_FIELDS[kind] ?? []).flatMap((spec) => stringsAt(data, spec));
}
