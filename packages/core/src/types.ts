/**
 * Core domain types: block types, segments, documents.
 *
 * These types describe a Chiltepin document as an in-memory model — a slug, an
 * optional meta header, and an ordered list of segments (prose or typed blocks).
 */

/**
 * The canonical, ordered list of supported block types.
 *
 * Merged former types live on as permanent aliases (see `blocks/aliases.ts`):
 * `infra` / `event` / `ddd` / `network` → `block`, `belogic` → `felogic`,
 * `dag` → `flow`, `waterfall` / `funnel` → `chart`, `diff` / `terminal` →
 * `code`, `mece` → `tree`, `tracker` → `statustable`. Alias fences parse to
 * their canonical kind with `sourceType` set to the tag as written.
 */
export const BLOCK_TYPES = [
  'meta',
  'callout',
  'table',
  'sequence',
  'erd',
  'userstory',
  'timeline',
  'kanban',
  // Phase 2 — easy HTML-only blocks (plus pyramid which is simple SVG)
  'prose',
  'glossary',
  'proscons',
  'cvt',
  'stats',
  'code',
  'agenda',
  'tree',
  'pyramid',
  // Phase 3 — medium SVG blocks
  'flow',
  'state',
  'dfd',
  'journey',
  'gantt',
  'graph',
  'quadrant',
  'swimlane',
  // Phase 4 — complex SVG blocks
  'c4',
  'uml',
  'frontend',
  'cluster',
  // Phase 5 — layout engines (block) + felogic
  'block',
  'felogic',
  // Phase 6 — UI mockups
  'wireframe',
  // Phase 7 — API reference + prose/structure
  'endpoint',
  'pullquote',
  'layers',
  // Phase 8 — access control / RBAC
  'matrix',
  'anatomy',
  'composition',
  // Phase 9 — presentation cards
  'drivers',
  'options',
  'spec',
  // Phase 10 — fancy list, story backlog, design pattern
  'list',
  'stories',
  'pattern',
  // Phase 11 — a grid gallery of code / note cards
  'gallery',
  // Phase 12 — data charts, figures, steppers, FAQs
  'chart',
  'figure',
  'steps',
  'faq',
  // Phase 13 — envelope math, SLOs & error budgets
  'envelope',
  'slo',
  // Phase 14 — business & strategy cards, release history, people
  'swot',
  'okr',
  'persona',
  'changelog',
  'team',
  // Phase 15 — heatmaps, decision matrices, risk registers
  'heatmap',
  'scorecard',
  'risk',
  // Phase 16 — design system: palettes, type specimens, do/don't cards, inventories
  'palette',
  'typescale',
  'dodont',
  'inventory',
  // Phase 17 — algorithms & data structures: arrays, linked lists, binary trees, hash maps
  'array',
  'linkedlist',
  'bintree',
  'hashmap',
  // Phase 18 — AI & agents: agent loops, execution traces, prompt anatomy, context budgets
  'agentloop',
  'trace',
  'prompt',
  'context',
  // Phase 19 — enterprise architecture: target-architecture capability maps
  'archmap',
  // Phase 20 — presentation text: section dividers, hero metrics, takeaways
  'divider',
  'bignumber',
  'takeaways',
  // Phase 21 — status tables: task rows with a user-defined colored status vocabulary
  'statustable',
  // Phase 22 — cycles: a closed loop of stages arranged in a circle
  'cycle',
  // Phase 23 — benchmark scoreboards: measured results per subject, best derived
  'benchmark',
  // Phase 24 — flow volumes: how much moves between stages, not just whether
  'sankey',
  // Phase 25 — the shapes a technical doc still had to draw by hand:
  // branching models, proportional composition, wire formats, set overlap,
  // and strategy position.
  'gitgraph',
  'treemap',
  'packet',
  'venn',
  'wardley',
  // Phase 26 — the two moves a consulting deck opens and closes with:
  // a rated comparison, and the argument in Minto order.
  'harvey',
  'scqa',
  // Phase 27 — how a plan is defended: the same drivers, moved three ways.
  'scenarios',
  // Phase 28 — cause & effect: an Ishikawa fishbone behind one outcome.
  'fishbone',
  // Phase 29 — two planning/overview shapes prose kept faking: a user-story
  // map (backbone + release slices) and a ranked before/after slopegraph.
  'storymap',
  // Phase 30 (G) — async contracts: the event an endpoint card cannot
  // describe, and the saga that says what runs backwards when a step fails.
  'eventcontract',
  'saga',
  'slopegraph',
  // Phase 30 (E) — cloud & microservices: a distributed-trace waterfall and
  // a progressive-delivery rollout strip.
  'spans',
  'rollout',
  // Phase 31 — coverage sweep: ML (a layered network, a model card), a
  // radial mind map, quality & audits (findings, checklist, performance
  // budgets, latency percentiles), the UML shapes still missing (use case,
  // package, timing), a STRIDE threat model, and two deck shapes (process
  // chevrons, a themes × periods roadmap).
  'neuralnet',
  'modelcard',
  'mindmap',
  'audit',
  'checklist',
  'perfbudget',
  'percentiles',
  'usecase',
  'pkg',
  'timing',
  'threatmodel',
  'chevrons',
  'roadmap',
] as const;

/** A block type literal. Adding a new type here is a one-place change. */
export type BlockType = (typeof BLOCK_TYPES)[number];

/** Runtime set for fast membership checks during parsing. */
export const BLOCK_TYPE_SET: ReadonlySet<string> = new Set(BLOCK_TYPES);

/**
 * A run of plain Markdown prose between typed blocks.
 *
 * Note: the discriminator is `'markdown'` (not `'prose'`) because `prose` is
 * also a typed block type. Keeping them distinct lets TypeScript narrow the
 * {@link Segment} union cleanly.
 */
export interface ProseSegment {
  readonly kind: 'markdown';
  /** Raw Markdown text (joined newlines, no trailing newline normalization). */
  readonly text: string;
  /** 1-based line number of the first line of this prose run. */
  readonly line: number;
}

/**
 * A typed fenced block. `data` is the parsed YAML/JSON body (or `undefined` if
 * the body failed to parse — `parseError` carries the message in that case).
 *
 * The union is keyed by `kind` so consumers can narrow on it.
 */
export type TypedSegment = {
  [K in BlockType]: {
    readonly kind: K;
    /**
     * The fence tag as written, when it was an alias (e.g. `waterfall` for a
     * `chart` block) or the `mermaid` dialect (the body is Mermaid text, not
     * YAML). Unset for canonical fences — `kind` is always canonical.
     */
    readonly sourceType?: string;
    /** Raw block body text (between the fences, no trailing newline). */
    readonly raw: string;
    /** Parsed YAML/JSON data, or `undefined` if `parseError` is set. */
    readonly data: unknown;
    /** 1-based line number of the opening fence. */
    readonly line: number;
    /** Optional human-readable id slug, extracted from the body's `id` field. */
    readonly id?: string;
    /** YAML parse error message, if the body failed to parse. */
    readonly parseError?: string;
    /** 1-based parse-error line within the block body, if known. */
    readonly parseErrorLine?: number;
    /** 1-based parse-error column within the block body, if known. */
    readonly parseErrorColumn?: number;
  };
}[BlockType];

/** A segment is either a prose run or a typed block. */
export type Segment = ProseSegment | TypedSegment;

/** Document-level meta extracted from a leading `meta` block. */
export interface MetaData {
  readonly title?: string;
  readonly subtitle?: string;
  readonly tag?: string;
  /** Optional brand logo (URL or path) shown in the document/slide cover. */
  readonly logo?: string;
  /** Where the document stands: `draft`, `proposal`, `review`, `accepted`, `superseded`, `deprecated`, or `example`. */
  readonly status?: string;
  /** The people or teams who own the document. */
  readonly owners?: readonly string[];
  /** The people who review the document. */
  readonly reviewers?: readonly string[];
  /** When the document last changed (a date, as written). */
  readonly updated?: string;
  /** The document version, as text. */
  readonly version?: string;
}

/** A fence whose tag looks like a typo of a real block type. */
export interface SuspectFence {
  /** 1-based line of the opening fence. */
  readonly line: number;
  /** The tag the author wrote (not a known block type or alias). */
  readonly tag: string;
  /** The closest valid fence tag (canonical type or alias) — a likely intended value. */
  readonly suggestion: string;
}

/** A parsed Chiltepin document. */
export interface Document {
  /** Document slug, typically the path under the docs root without `.md`. */
  readonly slug: string;
  /** Document-level meta from a leading `meta` block, if present. */
  readonly meta?: MetaData;
  /** Ordered segments — prose and typed blocks, in source order. */
  readonly segments: readonly Segment[];
  /**
   * Fence tags that look like typos of real block types (e.g. ` ```sequnce `).
   * Surfaced as `W_SUSPECT_BLOCK` warnings by {@link validateDocument}.
   */
  readonly suspectFences?: readonly SuspectFence[];
}
