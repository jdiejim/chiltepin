/**
 * Document parser — turns a Markdown string into a {@link Document}.
 *
 * Errors (YAML parse failures, schema problems) are deferred to
 * {@link validateDocument}. The parser's job is to produce a model; validation's
 * job is to report problems with that model.
 */

import { splitMarkdown, detectSuspectFences } from './splitter.js';
import { parseBlockBody, type YamlParseResult } from './yaml.js';
import { BLOCK_ALIASES } from './blocks/aliases.js';
import { normalizeBlockData, textBodyData } from './blocks/normalize.js';
import { rescueInlineCommas } from './blocks/rescue.js';
import { convertDialect, isDialectSource } from './dialects.js';
import type { BlockType, Document, MetaData, Segment, TypedSegment } from './types.js';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Merges an alias `patch` into a parsed body, for keys ABSENT in the body
 * only — the body always wins on conflict (e.g. an aliased `waterfall` fence
 * whose body says `kind: funnel` keeps `funnel`).
 */
function applyAliasPatch(data: unknown, patch: Readonly<Record<string, unknown>>): unknown {
  if (!isPlainObject(data)) return data;
  const missing = Object.entries(patch).filter(([k]) => !(k in data));
  return missing.length > 0 ? { ...Object.fromEntries(missing), ...data } : data;
}

/**
 * Parses a block body into data. Three body kinds share one result shape:
 * a dialect body (`sourceType` `mermaid` / `dbml` / `prisma`) converts
 * through `convertDialect`; a text-first block (callout, pullquote) takes
 * its bare text; everything else parses as YAML.
 */
function parseBody(kind: BlockType, sourceType: string | undefined, raw: string): YamlParseResult {
  if (isDialectSource(sourceType)) return convertDialect(sourceType, kind, raw);
  const textData = textBodyData(kind, raw);
  return textData !== undefined ? { ok: true, data: textData } : parseBlockBody(rescueInlineCommas(raw));
}

function extractId(data: unknown): string | undefined {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return undefined;
  const id = (data as { id?: unknown }).id;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

function extractMeta(data: unknown): MetaData | undefined {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return undefined;
  const d = data as {
    title?: unknown;
    subtitle?: unknown;
    tag?: unknown;
    logo?: unknown;
    status?: unknown;
    owners?: unknown;
    reviewers?: unknown;
    updated?: unknown;
    version?: unknown;
  };
  const meta: { -readonly [K in keyof MetaData]: MetaData[K] } = {};
  if (typeof d.title === 'string') meta.title = d.title;
  if (typeof d.subtitle === 'string') meta.subtitle = d.subtitle;
  if (typeof d.tag === 'string') meta.tag = d.tag;
  if (typeof d.logo === 'string') meta.logo = d.logo;
  if (typeof d.status === 'string') meta.status = d.status;
  const names = (v: unknown): string[] | undefined =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : undefined;
  const owners = names(d.owners);
  if (owners !== undefined && owners.length > 0) meta.owners = owners;
  const reviewers = names(d.reviewers);
  if (reviewers !== undefined && reviewers.length > 0) meta.reviewers = reviewers;
  if (typeof d.updated === 'string') meta.updated = d.updated;
  if (typeof d.version === 'string' || (typeof d.version === 'number' && Number.isFinite(d.version))) {
    meta.version = String(d.version);
  }
  return Object.keys(meta).length > 0 ? meta : undefined;
}

/**
 * Parses a Chiltepin Markdown document.
 *
 * @param markdown - The document source.
 * @param slug - The document slug (typically the path under the docs root,
 *   stripped of `.md`).
 * @returns A {@link Document} ready to validate, resolve, and render.
 *
 * @example
 * ```ts
 * const doc = parseDocument(await readFile('docs/orders.md', 'utf8'), 'orders');
 * ```
 */
export function parseDocument(markdown: string, slug: string): Document {
  const raws = splitMarkdown(markdown);
  const segments: Segment[] = [];
  let meta: MetaData | undefined;
  // Tracks how many typed (non-prose) blocks we've seen, so meta-detection
  // ("is this the document's first block?") is O(1) per block, not O(n).
  let typedBlockCount = 0;

  for (const r of raws) {
    if (r.kind === 'markdown') {
      segments.push({ kind: 'markdown', text: r.text, line: r.line });
      continue;
    }
    typedBlockCount += 1;

    // Text-first blocks (callout, pullquote) take a bare-text body: the whole
    // body becomes the block's text field, skipping YAML entirely — colons and
    // quotes in prose never need escaping. A field-led body parses as YAML.
    // A Mermaid body converts to block data first; a line the dialect cannot
    // read is a parse error exactly like malformed YAML.
    const parsed = parseBody(r.kind, r.sourceType, r.raw);
    const id = parsed.ok ? extractId(parsed.data) : undefined;

    // Alias fences: inject the alias patch for keys the body doesn't set
    // (body wins), then normalize (sugar + coercion) into canonical shape.
    const alias = r.sourceType !== undefined ? BLOCK_ALIASES[r.sourceType] : undefined;
    const patched =
      parsed.ok && alias?.patch !== undefined
        ? applyAliasPatch(parsed.data, alias.patch)
        : parsed.ok
          ? parsed.data
          : undefined;
    const data = parsed.ok ? normalizeBlockData(r.kind, patched) : undefined;

    const seg = {
      kind: r.kind,
      ...(r.sourceType !== undefined ? { sourceType: r.sourceType } : {}),
      raw: r.raw,
      line: r.line,
      data,
      ...(id !== undefined ? { id } : {}),
      ...(parsed.ok
        ? {}
        : {
            parseError: parsed.message,
            ...(parsed.line !== undefined ? { parseErrorLine: parsed.line } : {}),
            ...(parsed.column !== undefined ? { parseErrorColumn: parsed.column } : {}),
          }),
    } as TypedSegment;
    segments.push(seg);

    // `meta` is only meaningful as the document's very first typed block.
    if (r.kind === 'meta' && meta === undefined && typedBlockCount === 1 && parsed.ok) {
      meta = extractMeta(parsed.data);
    }
  }

  const suspectFences = detectSuspectFences(markdown);

  return {
    slug,
    segments,
    ...(meta !== undefined ? { meta } : {}),
    ...(suspectFences.length > 0 ? { suspectFences } : {}),
  };
}
