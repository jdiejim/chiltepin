/**
 * `lintInline` — checks the inline styling (`inline.ts`) in a document.
 *
 * - `W_INLINE_UNKNOWN`: an icon-shaped `:name:` that names no icon, a span
 *   class outside the allowlist, a class list that mixes two styles, or an
 *   unknown name in a `list` / `drivers` `icon` field. The text still renders
 *   (as plain text, or as an empty ring for a field icon), so it is a warning.
 * - `W_HIGHLIGHT_OVERUSE`: more than {@link HIGHLIGHT_LIMIT} highlights in one
 *   section. A highlight marks the one fact a skimming reader must not miss;
 *   many highlights mark nothing.
 *
 * Reads the prose (headings and table rows too, never fenced code) and every
 * block field in {@link INLINE_MD_FIELDS}. Pure: no I/O.
 */

import type { Diagnostic } from './diagnostics.js';
import { ICON_NAMES, ICON_SYNONYMS, isIconName } from './icons.js';
import {
  CHIP_STATUSES,
  ICON_FIELDS,
  inlineMdStrings,
  scanInline,
  SPAN_CLASSES,
  SPAN_HUES,
  stringsAt,
  type InlineFinding,
} from './inline.js';
import { closest } from './suggest.js';
import type { Document, Segment, TypedSegment } from './types.js';
import { locateYamlPath } from './yaml.js';

/** More highlights than this in one section draws a warning. */
export const HIGHLIGHT_LIMIT = 2;

const FENCE_RE = /^(`{3,}|~{3,})/;
const SECTION_RE = /^#{1,2}\s/;

interface Where {
  readonly line?: number;
  readonly column?: number;
}

const HUE_LIST = SPAN_HUES.map((h) => `.${h}`).join(' ');
const STATUS_LIST = CHIP_STATUSES.map((s) => `.${s}`).join(', ');

/** Icon names near `name`, a synonym first. A short name allows one edit, so `:nope:` suggests nothing. */
function iconSuggestions(name: string): string[] {
  const synonym = ICON_SYNONYMS[name];
  const near = closest(name, ICON_NAMES, name.length <= 4 ? 1 : 2);
  return [...new Set([...(synonym !== undefined ? [synonym] : []), ...near])];
}

/** The message, hint, and suggestions for one unknown or mixed form, or nothing when it is fine. */
function problemOf(
  f: InlineFinding,
): { message: string; hint: string; suggestions?: string[] } | undefined {
  if (f.kind === 'icon') {
    if (f.known) return undefined;
    const suggestions = iconSuggestions(f.name).map((n) => `:${n}:`);
    return {
      message: `Unknown icon \`${f.raw}\`. It shows as plain text.`,
      hint:
        suggestions.length > 0
          ? `Write ${suggestions.map((s) => `\`${s}\``).join(' or ')}. \`chiltepin block list\` lists every icon.`
          : 'Use an icon that `chiltepin block list` lists, or remove the colons.',
      ...(suggestions.length > 0 ? { suggestions } : {}),
    };
  }
  if (f.kind !== 'span' || f.result.ok) return undefined;
  const { problem, bad } = f.result;
  const allowed = `Use one hue (${HUE_LIST}), \`.kbd\`, or \`.pill\` with one of ${STATUS_LIST}.`;
  if (problem === 'unknown') {
    const near = closest(bad, SPAN_CLASSES).map((c) => `.${c}`);
    return {
      message: `Unknown span class \`.${bad}\` in \`${f.raw}\`. The text shows without a style.`,
      hint: allowed,
      ...(near.length > 0 ? { suggestions: near } : {}),
    };
  }
  if (problem === 'status-needs-pill') {
    return {
      message: `\`.${bad}\` is a chip status. It needs \`.pill\`.`,
      hint: `Write \`{.pill .${bad}}\`.`,
      suggestions: [`{.pill .${bad}}`],
    };
  }
  if (problem === 'chip-hue') {
    return {
      message: `A chip does not take a hue (\`.${bad}\` in \`${f.raw}\`). The status word carries the meaning.`,
      hint: `Use \`.pill\` alone, or add one of ${STATUS_LIST}.`,
    };
  }
  return {
    message: `\`${f.raw}\` names two styles. A span takes one.`,
    hint: allowed,
  };
}

/** Line and column (1-based) of `offset` in a text that starts at `line`, column 1. */
function position(text: string, offset: number, line: number): Where {
  let l = line;
  let lineStart = 0;
  for (let i = 0; i < offset && i < text.length; i += 1) {
    if (text[i] === '\n') {
      l += 1;
      lineStart = i + 1;
    }
  }
  return { line: l, column: offset - lineStart + 1 };
}

/** Where a block field sits in the document (its YAML value, else the fence). */
function fieldWhere(seg: TypedSegment, path: ReadonlyArray<string | number>): Where {
  const loc =
    locateYamlPath(seg.raw, path) ??
    (path.length > 0 ? locateYamlPath(seg.raw, path.slice(0, -1)) : undefined);
  return loc !== undefined ? { line: seg.line + loc.line, column: loc.column } : { line: seg.line };
}

/** One stretch of prose, or one block field, with its section and position. */
interface Run {
  readonly text: string;
  readonly section: number;
  readonly where: (offset: number) => Where;
}

/** The prose runs of a document and the inline-Markdown fields of its blocks, in order. */
function collectRuns(doc: Document): Run[] {
  const runs: Run[] = [];
  let section = 0;
  let fence: { char: string; len: number } | undefined;
  for (const seg of doc.segments as readonly Segment[]) {
    if (seg.kind === 'markdown') {
      const lines = seg.text.split('\n');
      let chunk: { text: string[]; line: number } | undefined;
      const flush = (): void => {
        if (chunk === undefined) return;
        const text = chunk.text.join('\n');
        const line = chunk.line;
        runs.push({ text, section, where: (o) => position(text, o, line) });
        chunk = undefined;
      };
      lines.forEach((raw, i) => {
        const line = seg.line + i;
        const trimmed = raw.trim();
        const marker = FENCE_RE.exec(trimmed)?.[1];
        if (marker !== undefined) {
          flush();
          if (fence === undefined) fence = { char: marker[0] as string, len: marker.length };
          else if (marker[0] === fence.char && marker.length >= fence.len && trimmed === marker)
            fence = undefined;
          return;
        }
        if (fence !== undefined) return;
        if (trimmed === '') {
          flush();
          return;
        }
        if (SECTION_RE.test(trimmed)) {
          flush();
          section += 1;
          runs.push({ text: raw, section, where: (o) => position(raw, o, line) });
          return;
        }
        if (chunk === undefined) chunk = { text: [], line };
        chunk.text.push(raw);
      });
      flush();
      continue;
    }
    // A typed block inside an open Markdown fence is example content.
    if (fence !== undefined || seg.parseError !== undefined || seg.kind === 'meta') continue;
    for (const field of inlineMdStrings(seg.kind, seg.data)) {
      runs.push({ text: field.text, section, where: () => fieldWhere(seg, field.path) });
    }
  }
  return runs;
}

/** Unknown names in the `icon` fields of `list` and `drivers`. */
function iconFieldDiagnostics(doc: Document, file: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const seg of doc.segments) {
    if (seg.kind === 'markdown' || seg.parseError !== undefined) continue;
    for (const spec of ICON_FIELDS[seg.kind] ?? []) {
      for (const { path, text } of stringsAt(seg.data, spec)) {
        if (isIconName(text)) continue;
        const suggestions = iconSuggestions(text);
        out.push({
          file,
          ...fieldWhere(seg, path),
          level: 'warn',
          code: 'W_INLINE_UNKNOWN',
          message: `Unknown icon \`${text}\`. The ${seg.kind} draws an empty ring in its place.`,
          hint:
            suggestions.length > 0
              ? `Write \`icon: ${suggestions[0] as string}\`. \`chiltepin block ${seg.kind}\` lists every icon.`
              : `Use an icon that \`chiltepin block ${seg.kind}\` lists.`,
          value: text,
          ...(suggestions.length > 0 ? { suggestions } : {}),
        });
      }
    }
  }
  return out;
}

/**
 * Lints a document's inline styling. Every finding is a warning.
 *
 * @param doc - The parsed document.
 * @param file - The file path to use in diagnostics.
 */
export function lintInline(doc: Document, file: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  const marks = new Map<number, { count: number; third?: Where; raw?: string }>();
  for (const run of collectRuns(doc)) {
    for (const f of scanInline(run.text)) {
      if (f.kind === 'mark') {
        const s = marks.get(run.section) ?? { count: 0 };
        s.count += 1;
        if (s.count === HIGHLIGHT_LIMIT + 1) {
          s.third = run.where(f.start);
          s.raw = f.raw;
        }
        marks.set(run.section, s);
        continue;
      }
      const problem = problemOf(f);
      if (problem === undefined) continue;
      out.push({
        file,
        ...run.where(f.start),
        level: 'warn',
        code: 'W_INLINE_UNKNOWN',
        ...problem,
        value: f.raw,
      });
    }
  }
  for (const s of marks.values()) {
    if (s.count <= HIGHLIGHT_LIMIT || s.third === undefined) continue;
    out.push({
      file,
      ...s.third,
      level: 'warn',
      code: 'W_HIGHLIGHT_OVERUSE',
      message: `${s.count} highlights in one section. A highlight marks the one fact the reader must not miss.`,
      hint: 'Keep one highlight in the section. Remove the others, or use **bold** for a key term.',
      ...(s.raw !== undefined ? { value: s.raw } : {}),
    });
  }
  return [...out, ...iconFieldDiagnostics(doc, file)];
}
