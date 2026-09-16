/**
 * Tiny multi-language syntax highlighter — emits HTML spans (`.kw`, `.str`,
 * `.num`, `.fn`, `.ty`, `.com`) wrapped around recognized tokens.
 *
 * Ported from `resources/doc-studio.jsx` `highlightCode`. Designed for the
 * `code` block and the SQL snippets in `seq-steps`. Not a full lexer — just
 * enough to make a snippet readable.
 */

import { escapeHtml } from './escape.js';

const KW = new Set(
  (
    'const let var function return if else for while do switch case break continue ' +
    'class extends new await async import from export default try catch finally throw ' +
    'typeof instanceof void delete yield static public private protected readonly ' +
    'abstract implements interface type enum namespace def elif lambda pass with raise ' +
    'except none true false and or not is in self nil func struct map range defer chan ' +
    'select fallthrough echo fi done local require module package this super ' +
    'create table alter add drop select insert update delete into values where join ' +
    'group order by limit primary key foreign references not null default unique index ' +
    'on check constraint cascade returning begin commit rollback'
  ).split(/\s+/),
);

const TY = new Set(
  (
    'string number boolean int integer float double bool char byte long short void ' +
    'object any unknown never bigint promise array list set optional uuid text varchar ' +
    'timestamptz timestamp date numeric decimal jsonb json serial bigserial smallint'
  ).split(/\s+/),
);

const TOKEN_RE =
  /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b\d[\w.]*)|([A-Za-z_$][\w$]*)/g;

/** `lang` labels that switch the highlighter into Markdown mode. */
const MD_LANGS = new Set(['md', 'markdown', 'mdx']);

/**
 * `lang` labels that mean "this is not code": prompts, transcripts, plain
 * notes. They get no token pass at all — the generic keyword set would paint
 * ordinary English ("for", "or", "not", "with", "delete") as syntax.
 */
const PLAIN_LANGS = new Set(['text', 'txt', 'plain', 'plaintext', 'prompt', 'none']);

/**
 * Highlights a code snippet, returning HTML-safe string.
 *
 * @param code - Source code (any language). HTML-escaped before token wrapping.
 * @param lang - Optional language label from the block (`lang:`). Most values
 *   only affect the chip, but `md`/`markdown`/`mdx` switch to a
 *   Markdown-aware pass (headings, emphasis, links, list markers, quotes).
 */
export function highlightCode(code: string, lang?: string): string {
  if (code.length === 0) return '';
  const label = lang?.trim().toLowerCase();
  if (label !== undefined && MD_LANGS.has(label)) {
    return highlightMarkdown(String(code));
  }
  if (label !== undefined && PLAIN_LANGS.has(label)) {
    return escapeHtml(String(code));
  }
  const src = String(code);
  let out = '';
  let last = 0;
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(src)) !== null) {
    if (m.index > last) out += escapeHtml(src.slice(last, m.index));
    const t = m[0];
    if (m[1] !== undefined) {
      out += `<span class="com">${escapeHtml(t)}</span>`;
    } else if (m[2] !== undefined) {
      out += `<span class="str">${escapeHtml(t)}</span>`;
    } else if (m[3] !== undefined) {
      out += `<span class="num">${escapeHtml(t)}</span>`;
    } else {
      const lt = t.toLowerCase();
      if (KW.has(lt)) out += `<span class="kw">${escapeHtml(t)}</span>`;
      else if (TY.has(lt)) out += `<span class="ty">${escapeHtml(t)}</span>`;
      else if (src[TOKEN_RE.lastIndex] === '(')
        out += `<span class="fn">${escapeHtml(t)}</span>`;
      else out += escapeHtml(t);
    }
    last = TOKEN_RE.lastIndex;
  }
  if (last < src.length) out += escapeHtml(src.slice(last));
  return out;
}

/** Inline Markdown spans: `` `code` ``, `**bold**`, `*em*`/`_em_`, `[t](url)`. */
const MD_INLINE_RE =
  /(`[^`\n]+`)|(\*\*[^*\n]+\*\*|__[^_\n]+__)|(\*[^*\n]+\*|_[^_\n]+_)|(\[[^\]\n]+\]\([^)\n]+\))/g;

function mdInline(s: string): string {
  let out = '';
  let last = 0;
  MD_INLINE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MD_INLINE_RE.exec(s)) !== null) {
    if (m.index > last) out += escapeHtml(s.slice(last, m.index));
    const t = m[0];
    if (m[1] !== undefined) out += `<span class="str">${escapeHtml(t)}</span>`;
    else if (m[2] !== undefined) out += `<span class="fn">${escapeHtml(t)}</span>`;
    else if (m[3] !== undefined) out += `<span class="ty">${escapeHtml(t)}</span>`;
    else {
      // [text](url) — text reads as a link, the target stays muted.
      const link = /^(\[[^\]]+\])(\([^)]+\))$/.exec(t);
      if (link !== null)
        out += `<span class="fn">${escapeHtml(link[1] ?? '')}</span><span class="com">${escapeHtml(link[2] ?? '')}</span>`;
      else out += escapeHtml(t);
    }
    last = MD_INLINE_RE.lastIndex;
  }
  if (last < s.length) out += escapeHtml(s.slice(last));
  return out;
}

/**
 * Markdown-aware highlighting, line by line: headings pop as keywords, list
 * markers as numbers, blockquotes and fences as comments — and the *contents*
 * of a fenced region run through the generic tokenizer, so a Markdown sample
 * that embeds a code block still shows highlighted code.
 */
function highlightMarkdown(src: string): string {
  const out: string[] = [];
  let inFence = false;
  for (const line of src.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      out.push(`<span class="com">${escapeHtml(line)}</span>`);
    } else if (inFence) {
      out.push(highlightCode(line));
    } else if (/^#{1,6}\s/.test(line)) {
      out.push(`<span class="kw">${escapeHtml(line)}</span>`);
    } else if (/^\s*>/.test(line)) {
      out.push(`<span class="com">${escapeHtml(line)}</span>`);
    } else if (/^\s*(-{3,}|={3,}|\*{3,})\s*$/.test(line)) {
      out.push(`<span class="com">${escapeHtml(line)}</span>`);
    } else {
      const marker = /^(\s*)([-*+]|\d+\.)(\s+)(.*)$/.exec(line);
      if (marker !== null) {
        out.push(
          `${escapeHtml(marker[1] ?? '')}<span class="num">${escapeHtml(marker[2] ?? '')}</span>${marker[3] ?? ''}${mdInline(marker[4] ?? '')}`,
        );
      } else {
        out.push(mdInline(line));
      }
    }
  }
  return out.join('\n');
}
