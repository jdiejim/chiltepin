/**
 * `lintTemplateEcho` — a doc template that shipped without its example
 * content replaced.
 *
 * `chiltepin new adr` writes a complete, believable example (an ADR about
 * idempotency keys on a payments API), so the author sees what a good ADR
 * looks like. The example is a starting point. When most of it reaches a
 * published doc, the doc states facts about a system that is not the
 * author's, and every other check passes.
 *
 * Pure, no I/O. The fingerprints are built once from `DOC_TEMPLATES`: every
 * prose sentence of six or more words and every block string of four or more
 * words (titles, labels, bodies, notes), normalized for case, emphasis,
 * punctuation, and spacing. A doc's passages are normalized the same way and
 * matched exactly, so a sentence the author rewrote never matches and short
 * generic labels (`Mobile client`) are below the floor.
 *
 * One `W_TEMPLATE_ECHO` warning per doc, and only when the doc keeps a real
 * share of one template: at least {@link MIN_HITS} of its passages, and at
 * least {@link MIN_SHARE} of all its passages. A doc that borrows one
 * example sentence (a showcase that reuses a snippet) stays quiet, and so
 * does a doc whose `meta.status` is `example`.
 */

import { DOC_TEMPLATES } from './blocks/docTemplates.js';
import type { Diagnostic } from './diagnostics.js';
import { parseDocument } from './parser.js';
import { collectProseUnits } from './prose/surfaces.js';
import { splitSentences } from './prose/text.js';
import type { Document } from './types.js';

/** Minimum words for a prose sentence to count as a passage. */
const SENTENCE_WORDS = 6;
/** Minimum words for a block string (label, title, body) to count. */
const STRING_WORDS = 4;
/** A doc echoes a template when it keeps at least this many of its passages… */
const MIN_HITS = 3;
/** …and they are at least this share of the doc's own passages. */
const MIN_SHARE = 0.2;
/** Block fields that hold code or ids, never prose. */
const SKIP_KEYS: ReadonlySet<string> = new Set(['id', 'code', 'lang', 'ref', 'href', 'src', 'from', 'to', 'kind']);

/** The comparison form: lower case, no emphasis or punctuation, single spaces. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\\n/g, ' ')
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{L}\p{N}$%+./-]+/gu, ' ')
    .replace(/[.]+(?=\s|$)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function words(s: string): number {
  return s.split(' ').filter((w) => w.length > 0).length;
}

/** Every string in a block's data, skipping code and ids. */
function blockStrings(data: unknown, key?: string, out: string[] = []): string[] {
  if (typeof data === 'string') {
    if (key === undefined || !SKIP_KEYS.has(key)) out.push(data);
  } else if (Array.isArray(data)) {
    for (const v of data) blockStrings(v, key, out);
  } else if (typeof data === 'object' && data !== null) {
    for (const [k, v] of Object.entries(data)) blockStrings(v, k, out);
  }
  return out;
}

/** One passage of a document: its text, normalized form, and line. */
interface Passage {
  readonly text: string;
  readonly norm: string;
  readonly line: number | undefined;
}

/** The distinct passages of a document, in document order. */
function passages(doc: Document): Passage[] {
  const out: Passage[] = [];
  const seen = new Set<string>();
  const add = (text: string, min: number, line: number | undefined): void => {
    const norm = normalize(text);
    if (words(norm) < min || seen.has(norm)) return;
    seen.add(norm);
    out.push({ text, norm, line });
  };
  for (const unit of collectProseUnits(doc)) {
    for (const s of splitSentences(unit.text)) add(s.text, SENTENCE_WORDS, unit.locate(s.start).line);
  }
  for (const seg of doc.segments) {
    if (seg.kind === 'markdown' || seg.parseError !== undefined) continue;
    for (const s of blockStrings(seg.data)) add(s, STRING_WORDS, seg.line);
  }
  return out;
}

/** Fingerprint → the templates that hold it. Built on first use. */
let fingerprints: Map<string, string[]> | undefined;

function templateFingerprints(): Map<string, string[]> {
  if (fingerprints !== undefined) return fingerprints;
  const map = new Map<string, string[]>();
  for (const [name, source] of Object.entries(DOC_TEMPLATES)) {
    for (const p of passages(parseDocument(source, name))) {
      const list = map.get(p.norm);
      if (list === undefined) map.set(p.norm, [name]);
      else if (!list.includes(name)) list.push(name);
    }
  }
  fingerprints = map;
  return map;
}

/** A short quote of a matched passage for the message. */
function quote(s: string): string {
  const one = s.replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
  return one.length > 60 ? `${one.slice(0, 57).trimEnd()}…` : one;
}

/**
 * Finds a doc template that shipped with its example content in place.
 * Returns at most one warning.
 *
 * @param doc - The parsed document.
 * @param file - The file path to use in diagnostics.
 */
export function lintTemplateEcho(doc: Document, file: string): Diagnostic[] {
  // A doc marked `status: example` says it shows a shape, not a real system.
  if (doc.meta?.status === 'example') return [];
  const prints = templateFingerprints();
  const all = passages(doc);
  if (all.length === 0) return [];
  const hits = new Map<string, Passage[]>();
  for (const p of all) {
    for (const name of prints.get(p.norm) ?? []) {
      const list = hits.get(name);
      if (list === undefined) hits.set(name, [p]);
      else list.push(p);
    }
  }
  let best: { name: string; list: Passage[] } | undefined;
  for (const [name, list] of hits) {
    if (best === undefined || list.length > best.list.length) best = { name, list };
  }
  if (best === undefined || best.list.length < MIN_HITS || best.list.length / all.length < MIN_SHARE) return [];
  const first = best.list[0] as Passage;
  return [
    {
      file,
      ...(first.line !== undefined ? { line: first.line } : {}),
      level: 'warn',
      code: 'W_TEMPLATE_ECHO',
      message:
        `${String(best.list.length)} of ${String(all.length)} passages are example text from the ` +
        `\`${best.name}\` template, for example "${quote(first.text)}"`,
      hint:
        'Replace the example with the facts of your system: its names, numbers, and decisions. ' +
        '`chiltepin new` writes an example to show the shape; it is not content.',
      value: best.name,
    },
  ];
}
