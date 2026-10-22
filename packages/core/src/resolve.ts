/**
 * Resolves cross-document references across a set of {@link Document}s.
 *
 * - Ids are repo-global unique slugs. Duplicate ids produce `E_DUP_ID`.
 * - References are `doc#id` (absolute) or `#id` (within the current document).
 *   Targets that don't exist produce `E_DANGLING_REF`.
 * - Prose links to another document (`[text](other-doc#anchor)`,
 *   `[text](./other.md#anchor)`) must name a document in the set and, when
 *   they carry an anchor, one of its block ids or heading ids. A miss is
 *   `E_DANGLING_LINK`. Same-document links (`#anchor`) are checked per
 *   document by `lintLocalLinks`.
 * - The {@link RefGraph} maps id → block and lists edges from referencing to
 *   referenced blocks.
 */

import type { Diagnostic } from './diagnostics.js';
import type { Document, Segment, TypedSegment } from './types.js';
import { blockRegistry } from './blocks/registry.js';
import type { BlockDataMap } from './blocks/schemas.js';
import type { BlockType } from './types.js';
import { danglingLink, docAnchors, hasAnchor, proseLinks, resolveLinkTarget } from './links.js';

/** A graph of resolved blocks and the edges between them. */
export interface RefGraph {
  /** Map from id to the block it identifies (and the doc slug it lives in). */
  readonly nodes: ReadonlyMap<string, { readonly doc: string; readonly block: Segment }>;
  /** Directed edges; `from`/`to` are `doc#id` strings (or `doc@line` if the source has no id). */
  readonly edges: ReadonlyArray<{ readonly from: string; readonly to: string }>;
}

/** A document paired with its source file path (used for diagnostic locations). */
export interface InputDocument {
  readonly doc: Document;
  readonly file: string;
}

// A reference is `doc#id` or a bare `#id` (current document).
//   doc — a slug: path segments under the docs root, so word chars plus `/`,
//         `.`, and `-` (e.g. `api/v2.0`, `architecture/overview`).
//   id  — a block id slug: word chars, `-`, and `.`.
const REF_RE = /^(?:([\w/.-]+))?#([\w.-]+)$/;

function callExtractRefs<K extends BlockType>(kind: K, data: BlockDataMap[K]): readonly string[] {
  const def = blockRegistry[kind];
  return def.extractRefs ? def.extractRefs(data) : [];
}

/**
 * Resolves references across multiple documents.
 *
 * @param inputs - The documents (and their file paths) to resolve as a set.
 * @returns The reference graph plus any duplicate-id or dangling-ref diagnostics.
 *
 * @example
 * ```ts
 * const { graph, diagnostics } = resolveRefs([{ doc, file: 'docs/orders.md' }]);
 * ```
 */
export function resolveRefs(inputs: readonly InputDocument[]): {
  graph: RefGraph;
  diagnostics: Diagnostic[];
} {
  const diagnostics: Diagnostic[] = [];
  const nodes = new Map<string, { doc: string; block: Segment; file: string; line: number }>();

  for (const { doc, file } of inputs) {
    for (const seg of doc.segments) {
      if (seg.kind === 'markdown' || seg.id === undefined) continue;
      const existing = nodes.get(seg.id);
      if (existing) {
        diagnostics.push({
          file,
          line: seg.line,
          level: 'error',
          code: 'E_DUP_ID',
          message: `Duplicate id "${seg.id}" (first defined in ${existing.file}:${existing.line})`,
          value: seg.id,
        });
        continue;
      }
      nodes.set(seg.id, { doc: doc.slug, block: seg, file, line: seg.line });
    }
  }

  const edges: Array<{ from: string; to: string }> = [];

  for (const { doc, file } of inputs) {
    for (const seg of doc.segments) {
      if (seg.kind === 'markdown' || seg.parseError !== undefined || seg.data === undefined) continue;
      const typedSeg = seg as TypedSegment;
      // Safe: we've narrowed away prose; `data` is the parsed YAML and may not
      // strictly match the schema (validation is a separate concern). The
      // extractor is defensive — it only reads `links[].ref` and tolerates
      // missing/oddly-typed values.
      const refs = callExtractRefs(typedSeg.kind, typedSeg.data as BlockDataMap[typeof typedSeg.kind]);
      for (const ref of refs) {
        const match = REF_RE.exec(ref);
        if (!match) {
          diagnostics.push({
            file,
            line: seg.line,
            level: 'error',
            code: 'E_BAD_REF_FORMAT',
            message: `Invalid reference format: "${ref}" (expected doc#id or #id)`,
            value: ref,
          });
          continue;
        }
        const targetDoc = match[1] ?? doc.slug;
        const targetId = match[2];
        if (targetId === undefined) continue;
        const node = nodes.get(targetId);
        if (!node || node.doc !== targetDoc) {
          diagnostics.push({
            file,
            line: seg.line,
            level: 'error',
            code: 'E_DANGLING_REF',
            message: `Dangling reference: "${ref}" (target not found)`,
            value: ref,
          });
          continue;
        }
        const from = seg.id !== undefined ? `${doc.slug}#${seg.id}` : `${doc.slug}@${seg.line}`;
        edges.push({ from, to: `${targetDoc}#${targetId}` });
      }
    }
  }

  // Prose links to other documents. Anchors are computed once per target.
  const bySlug = new Map(inputs.map((i) => [i.doc.slug, i.doc] as const));
  const anchorCache = new Map<string, Set<string>>();
  const anchorsOf = (slug: string): Set<string> => {
    let a = anchorCache.get(slug);
    if (a === undefined) {
      const target = bySlug.get(slug);
      a = target !== undefined ? docAnchors(target) : new Set();
      anchorCache.set(slug, a);
    }
    return a;
  };
  for (const { doc, file } of inputs) {
    for (const link of proseLinks(doc)) {
      const target = resolveLinkTarget(link.href, doc.slug);
      if (target === undefined || target.local) continue;
      if (!bySlug.has(target.doc)) {
        diagnostics.push(danglingLink(file, link, target, 'doc', [...bySlug.keys()]));
        continue;
      }
      if (target.anchor === undefined) continue;
      const anchors = anchorsOf(target.doc);
      if (!hasAnchor(anchors, target.anchor)) {
        diagnostics.push(danglingLink(file, link, target, 'anchor', [...anchors]));
      }
    }
  }

  const publicNodes = new Map<string, { doc: string; block: Segment }>();
  for (const [id, { doc, block }] of nodes) publicNodes.set(id, { doc, block });

  return { graph: { nodes: publicNodes, edges }, diagnostics };
}
