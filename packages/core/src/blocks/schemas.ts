/**
 * Zod schemas for every Chiltepin block type.
 *
 * These schemas are the single source of truth for each block's shape. TS types
 * are derived via `z.infer` in {@link BlockDataMap}, so validation and types
 * cannot drift apart.
 *
 * Shapes match `resources/doc-studio.jsx` (v1 grammar). Where doc-studio
 * differed from the earlier `resources/chiltepin-renderer.html` reference, the
 * doc-studio shape wins.
 *
 * Note: every schema is `.strict()` so unknown fields surface as diagnostics.
 * Top-level `id` is handled separately by the parser and is intentionally NOT
 * a field of any per-type schema.
 */

import { z } from 'zod';
import type { BlockType } from '../types.js';

/* ── numeric field builders ─────────────────────────────────────────────────
 * Every number a block body carries goes through one of these. Zod's bare
 * `z.number()` rejects `NaN` but ACCEPTS `Infinity`, and YAML `.inf` parses to
 * exactly that — so `packet: {width: .inf}` validated clean and then made a
 * renderer append to a string until V8 ran out of memory. No schema in this
 * file uses `z.number()`; `schema-hardening.test.ts` fails if one comes back.
 *
 * No block field wants a non-finite value. Every number here becomes a grid
 * coordinate, a size, a count, a share, or a printed label, and all five need
 * a real magnitude.
 */

/**
 * Message for a non-finite number, shown verbatim by `validate.ts` — which
 * also uses it to drop the follow-on issues (`Infinity` is not an integer and
 * exceeds every ceiling, so an unfiltered `.inf` reports three times).
 */
export const NOT_FINITE_MESSAGE =
  'must be a finite number — `.inf` and `.nan` are not values a renderer can draw';

/** A finite number. The base of every numeric field in this file. */
const num = z.number().finite(NOT_FINITE_MESSAGE);

/**
 * Highest grid coordinate or cell span a diagram places legibly. Far past
 * every density budget (20–30 nodes), so it only catches a typo or a
 * generated absurdity, never a real drawing.
 */
const GRID_MAX = 100;

/**
 * A 1-based grid coordinate (`col` / `row`). The first cell is 1: `col: 0`
 * used to paint the node at a negative x, entirely outside the `viewBox`,
 * with nothing on the page to say a node was lost.
 */
const gridCoord = num
  .int('a grid coordinate is a whole number of cells')
  .min(1, 'grid coordinates are 1-based — the first column is `col: 1`, the first row is `row: 1`')
  .max(GRID_MAX, `grid coordinates stop at ${GRID_MAX} — split the diagram instead`);

/** A cell span (`cols` / `rows` / `w`) — at least one cell wide. */
const gridSpan = num
  .int('a cell span is a whole number of cells')
  .min(1, 'a cell span covers at least 1 cell')
  .max(GRID_MAX, `a cell span stops at ${GRID_MAX} cells — split the diagram instead`);

/** A 0-based index into a declared list (`lane` into `lanes`, `layer` into `layers`). */
const laneIndex = num
  .int('a lane index is a whole number')
  .min(0, 'lane indexes are 0-based — the first lane is 0');

/**
 * A count the renderer turns into a loop: `n` becomes `n` drawn things, so an
 * unbounded value multiplies the output. `max` is what the renderer can still
 * draw; a value that is merely unwise gets a `W_DENSE_BLOCK` warning instead
 * (see `density.ts`).
 */
const drawCount = (min: number, max: number) =>
  num
    .int('a count is a whole number')
    .min(min, `must be at least ${min}`)
    .max(max, `must be at most ${max} — past that the picture stops being readable`);

/**
 * The declared ids/names a bad in-block reference could have meant, for the
 * "use one of" tail of a diagnostic. Long id spaces are truncated so the
 * message stays one readable line.
 */
function nameList(names: Iterable<string>): string {
  const all = [...names];
  return all.length > 8 ? `${all.slice(0, 8).join(', ')}, … (${all.length} in all)` : all.join(', ');
}

// ─── meta ───────────────────────────────────────────────────────────────────
export const metaSchema = z
  .object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    tag: z.string().optional(),
    // Optional brand logo shown in the document/slide cover. A URL or path
    // (use an absolute https URL so it resolves wherever the doc is rendered).
    logo: z.string().optional(),
  })
  .strict();

// ─── callout ────────────────────────────────────────────────────────────────
// doc-studio: `tone` instead of `kind`. Optional title + body.
export const calloutSchema = z
  .object({
    tone: z.enum(['note', 'tip', 'warn', 'danger', 'success']).optional(),
    title: z.string().optional(),
    body: z.string().optional(),
  })
  .strict();

// ─── table ──────────────────────────────────────────────────────────────────
// doc-studio: columns can be strings OR `{ label, align?, highlight? }`.
// Cells can be `string | number | { v, tone }`.
const tableColumnSchema = z.union([
  z.string(),
  z
    .object({
      label: z.string(),
      align: z.enum(['l', 'c', 'r']).optional(),
      highlight: z.boolean().optional(),
    })
    .strict(),
]);
const tableCellSchema = z.union([
  z.string(),
  num,
  z
    .object({
      v: z.union([z.string(), num]),
      tone: z.enum(['pos', 'neg', 'warn', 'muted']).optional(),
      lead: z.boolean().optional(),
      highlight: z.boolean().optional(),
    })
    .strict(),
]);
export const tableSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    columns: z.array(tableColumnSchema).optional(),
    rows: z.array(z.array(tableCellSchema)).optional(),
    note: z.string().optional(),
  })
  .strict();

// ─── sequence ───────────────────────────────────────────────────────────────
// doc-studio actors are objects (id, name, sub?, external?). Messages have
// `kind: sync | response | async | error | note`. `note` is a numbered
// inline annotation on the from-actor's lane, with no arrow.
//
// Sample-orders-api extras: per-message `summary` (longer description for the
// step list), `code` (snippet inside the step list item), `note` (italic gray
// caption below the step), plus a top-level `lede` (intro paragraph above the
// diagram), `endpoint` (method + path for the tag pill and title), and `foot`
// (key/value metadata pills below the diagram).
const sequenceActorSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    sub: z.string().optional(),
    external: z.boolean().optional(),
  })
  .strict();
//
// Combined fragments (UML frames) live in the same `messages` list as
// markers: `{ frame: alt, label }` opens a frame, `{ else: label }` starts
// the next branch (alt) or lane (par), `{ end: true }` closes it. Activation
// bars are explicit per message: `activate` opens a bar on `to`, `deactivate`
// closes the most recent open bar on `from` (Mermaid's `+`/`-` convention).
export const SEQUENCE_FRAME_KINDS = ['alt', 'opt', 'loop', 'par', 'break', 'critical'] as const;
const sequenceMessageSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
    kind: z.enum(['sync', 'response', 'async', 'error', 'note']).optional(),
    summary: z.string().optional(),
    code: z.string().optional(),
    note: z.string().optional(),
    activate: z.boolean().optional(),
    deactivate: z.boolean().optional(),
  })
  .strict();
const sequenceFrameOpenSchema = z
  .object({
    frame: z.enum(SEQUENCE_FRAME_KINDS),
    label: z.string().optional(),
  })
  .strict();
const sequenceFrameElseSchema = z.object({ else: z.string() }).strict();
const sequenceFrameEndSchema = z.object({ end: z.literal(true) }).strict();
const sequenceItemSchema = z.union([
  sequenceMessageSchema,
  sequenceFrameOpenSchema,
  sequenceFrameElseSchema,
  sequenceFrameEndSchema,
]);
const sequenceEndpointSchema = z
  .object({
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
    path: z.string(),
    status: z.string().optional(),
  })
  .strict();
const sequenceFootSchema = z
  .object({
    label: z.string(),
    value: z.string(),
  })
  .strict();
export const sequenceSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    endpoint: sequenceEndpointSchema.optional(),
    actors: z.array(sequenceActorSchema).optional(),
    messages: z.array(sequenceItemSchema).optional(),
    foot: z.array(sequenceFootSchema).optional(),
  })
  .strict();

// ─── erd ────────────────────────────────────────────────────────────────────
// Entities `{name, kind?, schema?, note?, columns?, indexes?}`; a column
// carries the key markers (`pk` `fk` `unique` `nullable` `index`), a
// `default`, an inline `enum` value list, a `ref` (`table.column`, the FK
// target) and a `note`. Relations `{from, to, label?, card?, identifying?,
// fromCol?, toCol?}`; `card` reads from → to (`1:N`: one `from`, many `to`;
// `0..1` / `0..N`: one `from`, an optional `to`). `groups` draw schema panels,
// `enums` draw small value cards, `dir` picks columns (`LR`) or rows (`TB`).
// Every field past `name` / `from` / `to` is optional, so the pre-overhaul
// shape (`{name, type?, pk?, fk?}` + `{from, to, label?, card?}`) still passes.
export const ERD_ENTITY_KINDS = ['table', 'view', 'enum', 'external'] as const;
export const ERD_CARDS = ['1:1', '1:N', 'N:1', 'N:M', '0..1', '0..N'] as const;
const erdColumnSchema = z
  .object({
    name: z.string(),
    type: z.string().optional(),
    pk: z.boolean().optional(),
    fk: z.boolean().optional(),
    unique: z.boolean().optional(),
    nullable: z.boolean().optional(),
    default: z.string().optional(),
    index: z.boolean().optional(),
    enum: z.array(z.string()).optional(),
    ref: z.string().optional(),
    note: z.string().optional(),
  })
  .strict();
const erdIndexSchema = z
  .object({
    columns: z.array(z.string()),
    unique: z.boolean().optional(),
    name: z.string().optional(),
  })
  .strict();
const erdEntitySchema = z
  .object({
    name: z.string(),
    kind: z.enum(ERD_ENTITY_KINDS).optional(),
    schema: z.string().optional(),
    note: z.string().optional(),
    columns: z.array(erdColumnSchema).optional(),
    indexes: z.array(erdIndexSchema).optional(),
  })
  .strict();
const erdRelationSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
    card: z.enum(ERD_CARDS).optional(),
    identifying: z.boolean().optional(),
    fromCol: z.string().optional(),
    toCol: z.string().optional(),
  })
  .strict();
const erdGroupSchema = z
  .object({
    name: z.string(),
    entities: z.array(z.string()).optional(),
  })
  .strict();
const erdEnumSchema = z
  .object({
    name: z.string(),
    values: z.array(z.string()),
  })
  .strict();
export const erdSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    dir: z.enum(['LR', 'TB']).optional(),
    entities: z.array(erdEntitySchema).optional(),
    relations: z.array(erdRelationSchema).optional(),
    groups: z.array(erdGroupSchema).optional(),
    enums: z.array(erdEnumSchema).optional(),
  })
  .strict()
  // In-block references, checked the way `spans` and `saga` check theirs: the
  // renderer looks each relation end up in a name map and DROPS the relation
  // when it misses, so a typo silently deletes a line from the diagram.
  .superRefine((val, ctx) => {
    const entities = val.entities ?? [];
    const names = new Set<string>();
    entities.forEach((e, i) => {
      // The renderer keys entities by bare name AND by `schema.name`.
      const qualified = e.schema !== undefined ? `${e.schema}.${e.name}` : undefined;
      if (names.has(e.name) || (qualified !== undefined && names.has(qualified))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['entities', i, 'name'],
          message: `duplicate entity "${qualified ?? e.name}" — every entity needs its own name`,
        });
      }
      names.add(e.name);
      if (qualified !== undefined) names.add(qualified);
    });
    if (names.size === 0) return; // nothing declared — relations name nothing to check
    (val.relations ?? []).forEach((r, i) => {
      for (const end of ['from', 'to'] as const) {
        const target = r[end];
        if (names.has(target)) continue;
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['relations', i, end],
          message: `relation ${end} "${target}" is not an entity name — use one of: ${nameList(names)}`,
        });
      }
    });
  });

// ─── userstory ──────────────────────────────────────────────────────────────
// Unchanged from the previous shape (doc-studio uses the same userstory).
const criterionSchema = z
  .object({
    given: z.string().optional(),
    when: z.string().optional(),
    then: z.string().optional(),
  })
  .strict();
const linkSchema = z
  .object({
    ref: z.string().optional(),
    mode: z.string().optional(),
    label: z.string().optional(),
  })
  .strict();
export const userstorySchema = z
  .object({
    title: z.string().optional(),
    role: z.string().optional(),
    want: z.string().optional(),
    soThat: z.string().optional(),
    priority: z.string().optional(),
    points: num.optional(),
    tags: z.array(z.string()).optional(),
    criteria: z.array(criterionSchema).optional(),
    links: z.array(linkSchema).optional(),
  })
  .strict();

// ─── timeline ───────────────────────────────────────────────────────────────
// doc-studio: items `{label, date?, desc?, status?: 'done'|'current'|'next'|'future'}`.
const timelineItemSchema = z
  .object({
    label: z.string(),
    date: z.string().optional(),
    desc: z.string().optional(),
    status: z.enum(['done', 'current', 'next', 'future']).optional(),
  })
  .strict();
export const timelineSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    items: z.array(timelineItemSchema).optional(),
  })
  .strict();

// ─── kanban ─────────────────────────────────────────────────────────────────
// doc-studio: `columns: [{label, cards: [{title, tag?}]}]`.
const kanbanCardSchema = z
  .object({
    title: z.string(),
    tag: z.string().optional(),
  })
  .strict();
const kanbanColumnSchema = z
  .object({
    label: z.string(),
    cards: z.array(kanbanCardSchema).optional(),
  })
  .strict();
export const kanbanSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    columns: z.array(kanbanColumnSchema).optional(),
  })
  .strict();

// ─── prose ──────────────────────────────────────────────────────────────────
// Structured prose: a list of typed sub-blocks (heading / paragraph / list /
// quote). Use this when you want a section's body to be more structured than
// raw markdown allows.
const proseBlockSchema = z
  .object({
    type: z.enum(['h', 'p', 'ul', 'ol', 'quote']).optional(),
    text: z.string().optional(),
    items: z.array(z.string()).optional(),
  })
  .strict();
export const proseSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    blocks: z.array(proseBlockSchema).optional(),
  })
  .strict();

// ─── glossary ───────────────────────────────────────────────────────────────
// `avoid` lists the words the doc must NOT use for this term — the glossary
// is the approved-term list, and the prose linter's terminology-drift check
// (W_PROSE_TERM_DRIFT) flags any avoided word found in the doc's prose.
const glossaryTermSchema = z
  .object({ term: z.string(), def: z.string(), avoid: z.array(z.string()).optional() })
  .strict();
export const glossarySchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    terms: z.array(glossaryTermSchema).optional(),
  })
  .strict();

// ─── proscons ───────────────────────────────────────────────────────────────
export const prosconsSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    prosLabel: z.string().optional(),
    consLabel: z.string().optional(),
    pros: z.array(z.string()).optional(),
    cons: z.array(z.string()).optional(),
  })
  .strict();

// ─── cvt (current vs target) ────────────────────────────────────────────────
const cvtPanelSchema = z
  .object({
    label: z.string().optional(),
    items: z.array(z.string()).optional(),
  })
  .strict();
export const cvtSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    current: cvtPanelSchema.optional(),
    target: cvtPanelSchema.optional(),
    note: z.string().optional(),
  })
  .strict();

// ─── stats (KPI cards) ──────────────────────────────────────────────────────
const statSchema = z
  .object({
    value: z.union([z.string(), num]),
    label: z.string(),
    delta: z.string().optional(),
    trend: z.enum(['up', 'down', 'flat']).optional(),
    accent: z.string().optional(),
  })
  .strict();
export const statsSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    stats: z.array(statSchema).optional(),
  })
  .strict();

// ─── code (one or more code blocks / a diff / a terminal session) ───────────
// `kind` picks the surface: plain snippets (default), `compare` (two
// `blocks[]` entries side by side under BEFORE / AFTER eyebrows), `diff`
// (unified-diff text: `+` additions, `-` removals, `@@` hunks), or `terminal`
// (a shell session: `$ ` commands, `# ` comments, output lines). Top-level
// `code` / `lang` / `session` are the single-snippet shorthand — no `blocks`
// list needed for one snippet. `highlight` names 1-based line ranges
// (`"3-5, 8"`); a range past the end is ignored. `lines` prints line numbers
// from `start`; `cols` lays `blocks[]` out as a grid; `wrap` soft-wraps long
// lines. The former `diff` and `terminal` block types are permanent aliases
// for `code` with the matching `kind`.
const codeEntrySchema = z
  .object({
    title: z.string().optional(),
    lang: z.string().optional(),
    code: z.string(),
    highlight: z.string().optional(),
    caption: z.string().optional(),
  })
  .strict();
export const codeSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    kind: z.enum(['compare', 'diff', 'terminal']).optional(),
    code: z.string().optional(),
    lang: z.string().optional(),
    session: z.string().optional(),
    highlight: z.string().optional(),
    caption: z.string().optional(),
    lines: z.boolean().optional(),
    start: num.int().optional(),
    cols: num.int().min(1).max(3).optional(),
    wrap: z.boolean().optional(),
    blocks: z.array(codeEntrySchema).optional(),
  })
  .strict();

// ─── agenda ─────────────────────────────────────────────────────────────────
const agendaItemSchema = z
  .object({
    time: z.string().optional(),
    duration: z.string().optional(),
    title: z.string(),
    owner: z.string().optional(),
    desc: z.string().optional(),
  })
  .strict();
export const agendaSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    items: z.array(agendaItemSchema).optional(),
  })
  .strict();

// ─── tree (indented hierarchy / issue tree / org chart) ─────────────────────
// `variant: issue` renders the MECE issue-tree presentation (one problem split
// into exclusive branches); the former `mece` type is a permanent alias for it.
// `variant: org` renders a top-down org chart (tidy layout, node `role` under
// the label).
const treeNodeSchema = z
  .object({
    id: z.string(),
    parent: z.string().optional(),
    label: z.string(),
    note: z.string().optional(),
    /** The node's role or title — rendered muted under the label (`variant: org`). */
    role: z.string().optional(),
    /**
     * The node's measured value. Give the nodes values and the hierarchy
     * becomes a DRIVER TREE — p95 = queue + compute + network, revenue =
     * price × volume — with each child's share of its parent computed.
     */
    value: num.optional(),
  })
  .strict();
export const treeSchema = z
  .object({
    /** Display suffix for node values — `ms`, `%`, `$`. */
    unit: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    variant: z.enum(['issue', 'org']).optional(),
    nodes: z.array(treeNodeSchema).optional(),
  })
  .strict();

// ─── pyramid ────────────────────────────────────────────────────────────────
const pyramidLevelSchema = z
  .object({ label: z.string(), desc: z.string().optional() })
  .strict();
export const pyramidSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    levels: z.array(pyramidLevelSchema).optional(),
  })
  .strict();


// ─── shared: dashed group wrapper on the coordinate-grid diagrams ───────────
// One shape across every grid diagram (flow / dfd / state / c4 / block /
// felogic): a dashed outline spanning a cell range, with a corner label.
// Groups anchor by explicit grid coordinates, so `col`/`row` are required.
// `parent` nests one group inside another by `id` (region → zone → subnet);
// the child's cells must lie inside the parent's range (`W_GROUP_NESTING`).
const gridGroupSchema = z
  .object({
    id: z.string().optional(),
    parent: z.string().optional(),
    col: gridCoord,
    row: gridCoord,
    cols: gridSpan.optional(),
    rows: gridSpan.optional(),
    label: z.string(),
    color: z.string().optional(),
  })
  .strict();

// ─── shared: auto-layout direction on the coordinate-grid diagrams ──────────
// Only consulted in *quick mode* (no node carries `col`/`row`): `LR` ranks the
// graph left-to-right, `TB` top-to-bottom. Default is `LR` everywhere — a
// stack of ranks running down the page grows taller than the page can show,
// where the same graph laid out sideways fits a slide.
const gridDirSchema = z.enum(['LR', 'TB']).optional();

// ─── flow (flowchart / pipeline DAG) ────────────────────────────────────────
// `variant: dag` renders the pipeline/DAG visual frame; the former `dag` type
// is a permanent alias for it.
const flowNodeSchema = z
  .object({
    id: z.string(),
    col: gridCoord.optional(),
    row: gridCoord.optional(),
    w: gridSpan.optional(),
    label: z.string(),
    kind: z.enum(['start', 'end', 'decision', 'process', 'agent', 'llm', 'tool', 'human', 'memory']).optional(),
  })
  .strict();
const flowEdgeSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
    // `dashed` is the terse `-->` form (an optional / fallback path); `error` is `-x->`.
    kind: z.enum(['error', 'dashed']).optional(),
  })
  .strict();
export const flowSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    variant: z.enum(['dag']).optional(),
    dir: gridDirSchema,
    groups: z.array(gridGroupSchema).optional(),
    nodes: z.array(flowNodeSchema).optional(),
    edges: z.array(flowEdgeSchema).optional(),
  })
  .strict();

// ─── state machine ──────────────────────────────────────────────────────────
const stateNodeSchema = z
  .object({
    id: z.string(),
    col: gridCoord.optional(),
    row: gridCoord.optional(),
    name: z.string().optional(),
    kind: z.enum(['start', 'terminal', 'active', 'wait']).optional(),
  })
  .strict();
const stateTransitionSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    event: z.string(),
    guard: z.string().optional(),
  })
  .strict();
export const stateSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    dir: gridDirSchema,
    groups: z.array(gridGroupSchema).optional(),
    states: z.array(stateNodeSchema).optional(),
    transitions: z.array(stateTransitionSchema).optional(),
  })
  .strict();

// ─── dfd (data-flow diagram) ────────────────────────────────────────────────
const dfdNodeSchema = z
  .object({
    id: z.string(),
    col: gridCoord.optional(),
    row: gridCoord.optional(),
    name: z.string(),
    kind: z.enum(['process', 'external', 'store', 'datastore']).optional(),
    num: z.union([z.string(), num]).optional(),
  })
  .strict();
const dfdEdgeSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
  })
  .strict();
export const dfdSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    dir: gridDirSchema,
    groups: z.array(gridGroupSchema).optional(),
    nodes: z.array(dfdNodeSchema).optional(),
    edges: z.array(dfdEdgeSchema).optional(),
  })
  .strict();

// ─── journey map ────────────────────────────────────────────────────────────
const journeyStageSchema = z.object({ label: z.string() }).strict();
const journeyRowSchema = z
  .object({
    label: z.string(),
    cells: z.array(z.string()).optional(),
  })
  .strict();
export const journeySchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    stages: z.array(journeyStageSchema).optional(),
    rows: z.array(journeyRowSchema).optional(),
    emotion: z.array(num).optional(),
  })
  .strict();

// ─── gantt ──────────────────────────────────────────────────────────────────
const ganttTaskSchema = z
  .object({
    label: z.string(),
    start: num.optional(),
    span: num.optional(),
    kind: z.enum(['done', 'active', 'current', 'milestone']).optional(),
  })
  .strict();
export const ganttSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    periods: z.array(z.string()).optional(),
    tasks: z.array(ganttTaskSchema).optional(),
  })
  .strict();

// ─── graph (node-link) ──────────────────────────────────────────────────────
// `state` colours a node for algorithm walkthroughs (BFS/DFS/Dijkstra visit
// order): visited · current · frontier · target. `weight` renders on the edge
// pill (combined with `label` as "label · w" when both are set).
const graphNodeSchema = z
  .object({
    id: z.string(),
    col: gridCoord.optional(),
    row: gridCoord.optional(),
    label: z.string(),
    group: num.optional(),
    state: z.enum(['visited', 'current', 'frontier', 'target']).optional(),
  })
  .strict();
const graphEdgeSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
    dir: z.enum(['directed', 'undirected']).optional(),
    weight: num.optional(),
  })
  .strict();
export const graphSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    // No `dir` here: `graph` already spends that key on its edges
    // (`dir: directed | undirected`). Its auto-layout is left-to-right.
    nodes: z.array(graphNodeSchema).optional(),
    edges: z.array(graphEdgeSchema).optional(),
  })
  .strict();

// ─── quadrant (2x2 matrix) ──────────────────────────────────────────────────
const quadrantAxisSchema = z
  .object({
    label: z.string().optional(),
    low: z.string().optional(),
    high: z.string().optional(),
  })
  .strict();
const quadrantItemSchema = z
  .object({
    x: num,
    y: num,
    label: z.string(),
  })
  .strict();
export const quadrantSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    xAxis: quadrantAxisSchema.optional(),
    yAxis: quadrantAxisSchema.optional(),
    items: z.array(quadrantItemSchema).optional(),
  })
  .strict();

// ─── swimlane (cross-functional process) ────────────────────────────────────
const swimlaneLaneSchema = z.object({ id: z.string().optional(), label: z.string() }).strict();
/**
 * A lane by its label or `id` (`lane: Sales`, case-insensitive, trimmed) or
 * by its 0-based index. `validate.ts` checks a name resolves
 * (`E_SWIMLANE_LANE`); `swimlaneLayout.ts` resolves it for the renderers.
 */
const swimlaneLaneRef = z.union([laneIndex, z.string().min(1, 'a lane name cannot be empty')]);
const swimlaneStepSchema = z
  .object({
    id: z.string(),
    col: gridCoord.optional(),
    lane: swimlaneLaneRef,
    label: z.string(),
    kind: z.enum(['action', 'decision', 'start', 'end', 'wait']).optional(),
    note: z.string().optional(),
    accent: z.boolean().optional(),
  })
  .strict();
const swimlaneLinkSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
    kind: z.enum(['dashed', 'error']).optional(),
  })
  .strict();
/** A column band over the lanes (a BPMN milestone): columns `from`..`to`, 1-based; no `to` runs to the last column. */
const swimlanePhaseSchema = z
  .object({
    label: z.string(),
    from: gridCoord,
    to: gridCoord.optional(),
  })
  .strict();
export const swimlaneSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    lanes: z.array(swimlaneLaneSchema).optional(),
    phases: z.array(swimlanePhaseSchema).optional(),
    steps: z.array(swimlaneStepSchema).optional(),
    links: z.array(swimlaneLinkSchema).optional(),
  })
  .strict();

// ─── c4 (context / container / component) ───────────────────────────────────
const c4NodeSchema = z
  .object({
    id: z.string(),
    col: gridCoord.optional(),
    row: gridCoord.optional(),
    w: gridSpan.optional(),
    kind: z.enum(['person', 'system', 'external', 'store', 'container', 'component']),
    family: z.string().optional(),
    name: z.string(),
    tech: z.string().optional(),
    desc: z.string().optional(),
  })
  .strict();
const c4EdgeSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
    tech: z.string().optional(),
    kind: z.enum(['solid', 'dashed', 'forbidden', 'error']).optional(),
  })
  .strict();
const c4BoundarySchema = z.object({ label: z.string() }).strict();
// A named boundary box drawn around an explicit set of node ids — lets one
// diagram show several systems/zones, unlike the single auto-fit `boundary`.
const c4NamedBoundarySchema = z
  .object({
    label: z.string(),
    nodes: z.array(z.string()),
    color: z.string().optional(),
  })
  .strict();
export const c4Schema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    level: z.enum(['context', 'container', 'component']).optional(),
    boundary: c4BoundarySchema.optional(),
    boundaries: z.array(c4NamedBoundarySchema).optional(),
    dir: gridDirSchema,
    groups: z.array(gridGroupSchema).optional(),
    nodes: z.array(c4NodeSchema).optional(),
    edges: z.array(c4EdgeSchema).optional(),
  })
  .strict();

// ─── uml class diagram ──────────────────────────────────────────────────────
const umlClassSchema = z
  .object({
    id: z.string(),
    col: gridCoord.optional(),
    row: gridCoord.optional(),
    name: z.string(),
    stereotype: z.string().optional(),
    attrs: z.array(z.string()).optional(),
    methods: z.array(z.string()).optional(),
  })
  .strict();
const umlRelSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
    kind: z
      .enum([
        'inheritance',
        'extends',
        'implementation',
        'implements',
        'composition',
        'aggregation',
        'dependency',
        'association',
      ])
      .optional(),
  })
  .strict();
export const umlSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    classes: z.array(umlClassSchema).optional(),
    rels: z.array(umlRelSchema).optional(),
  })
  .strict();

// ─── frontend (component tree) ──────────────────────────────────────────────
const ftNodeSchema = z
  .object({
    id: z.string(),
    parent: z.string().optional(),
    name: z.string(),
    kind: z
      .enum([
        'root',
        'layout',
        'page',
        'component',
        'leaf',
        'provider',
        'context',
        'hook',
        'store',
        'state',
      ])
      .optional(),
    note: z.string().optional(),
  })
  .strict();
export const frontendSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    nodes: z.array(ftNodeSchema).optional(),
  })
  .strict();

// ─── cluster (Kubernetes-style) ─────────────────────────────────────────────
const clusterClusterSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    kind: z.string().optional(),
  })
  .strict();
const clusterServiceSchema = z
  .object({
    id: z.string(),
    cluster: z.string(),
    label: z.string(),
    kind: z.string().optional(),
    tech: z.string().optional(),
    /** Instance count. The renderer draws at most 5 marks and prints `×N`. */
    replicas: num.int('a replica count is a whole number').min(1).optional(),
  })
  .strict();
const clusterEdgeSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
    kind: z.enum(['solid', 'dashed', 'forbidden', 'error']).optional(),
  })
  .strict();
export const clusterSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    clusters: z.array(clusterClusterSchema).optional(),
    services: z.array(clusterServiceSchema).optional(),
    edges: z.array(clusterEdgeSchema).optional(),
  })
  .strict();

// ─── block-graph (block; presets: infra / event / ddd / network) ────────────
// Two layout modes share one schema: if `layers` is present, nodes use `layer`
// to indicate which horizontal band they belong to; otherwise the grid layout
// uses `col` + `row` (+ optional `w` span). `preset` picks the domain tag
// styling (cloud infra, pub/sub, DDD context map, network zones) — the former
// `infra` / `event` / `ddd` / `network` types are permanent aliases that set it.
// Groups use the shared `gridGroupSchema` (same shape on flow/dfd/state/c4).
const blockGraphLayerSchema = z
  .object({ label: z.string(), color: z.string().optional() })
  .strict();
const blockGraphNodeSchema = z
  .object({
    id: z.string(),
    col: gridCoord.optional(),
    row: gridCoord.optional(),
    layer: laneIndex.optional(),
    w: gridSpan.optional(),
    // Row span. A gateway or load balancer drawn as a vertical bar spans the
    // rows of the services it fronts; omitted, the renderer spans the fan-out.
    h: gridSpan.optional(),
    kind: z.string().optional(),
    name: z.string(),
    tech: z.string().optional(),
    // Instance count. From 2 up the node draws as a stacked card with a `×N` chip.
    replicas: num.int().min(1).optional(),
  })
  .strict();
const blockGraphEdgeSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
    kind: z.enum(['solid', 'dashed', 'forbidden', 'error']).optional(),
  })
  .strict();
export const blockGraphSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    // `k8s`: namespaces are groups; kinds ingress / service / deployment /
    // pod / configmap / secret / job / cronjob / node get chips + glyphs.
    preset: z.enum(['infra', 'event', 'ddd', 'network', 'k8s']).optional(),
    systemLabel: z.string().optional(),
    dir: gridDirSchema,
    layers: z.array(blockGraphLayerSchema).optional(),
    groups: z.array(gridGroupSchema).optional(),
    nodes: z.array(blockGraphNodeSchema).optional(),
    edges: z.array(blockGraphEdgeSchema).optional(),
  })
  .strict()
  // In-block references, checked the way `spans` and `saga` check theirs. The
  // renderer looks both edge ends up in a node map and DROPS the edge when
  // either misses, and a second node with the same id shadows the first — both
  // silently, so the drawing loses a line with nothing to say so.
  // (`groups[].parent` is checked at validate time — see `lintGroupNesting`.)
  .superRefine((val, ctx) => {
    const ids = new Set<string>();
    (val.nodes ?? []).forEach((n, i) => {
      if (ids.has(n.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['nodes', i, 'id'],
          message: `duplicate node id "${n.id}" — every node needs its own id`,
        });
      }
      ids.add(n.id);
    });
    const groupIds = new Set<string>();
    (val.groups ?? []).forEach((g, i) => {
      if (g.id === undefined) return;
      if (groupIds.has(g.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['groups', i, 'id'],
          message: `duplicate group id "${g.id}" — every group needs its own id`,
        });
      }
      groupIds.add(g.id);
    });
    if (ids.size === 0) return; // no nodes declared — edges name nothing to check
    (val.edges ?? []).forEach((e, i) => {
      for (const end of ['from', 'to'] as const) {
        const target = e[end];
        if (ids.has(target)) continue;
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['edges', i, end],
          message: `edge ${end} "${target}" is not a node id — use one of: ${nameList(ids)}`,
        });
      }
    });
  });

// ─── felogic (frontend/backend module graph) ────────────────────────────────
// `variant: be` renders the backend presentation (controller / service /
// repository); the former `belogic` type is a permanent alias that sets it.
const feLogicNodeSchema = z
  .object({
    id: z.string(),
    col: gridCoord.optional(),
    row: gridCoord.optional(),
    w: gridSpan.optional(),
    kind: z.string().optional(),
    name: z.string(),
    note: z.string().optional(),
  })
  .strict();
const feLogicEdgeSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
    kind: z
      .enum(['uses', 'implements', 'reads', 'egress', 'https', 'api', 'dashed', 'async'])
      .optional(),
  })
  .strict();
export const felogicSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    variant: z.enum(['be']).optional(),
    dir: gridDirSchema,
    groups: z.array(gridGroupSchema).optional(),
    nodes: z.array(feLogicNodeSchema).optional(),
    edges: z.array(feLogicEdgeSchema).optional(),
  })
  .strict();

// ─── wireframe (UI mockups: desktop / browser / phone) ──────────────────────
// A vertical stack of low-fidelity UI elements inside a device frame. Each
// screen picks a `device` frame; `elements` are laid out top-to-bottom.
const wireframeElementSchema = z
  .object({
    type: z
      .enum([
        'header',
        'subheader',
        'text',
        'button',
        'input',
        'search',
        'image',
        'avatar',
        'card',
        'list',
        'nav',
        'tabs',
        'divider',
        'badge',
        'toggle',
        'spacer',
      ])
      .optional(),
    label: z.string().optional(),
    /** Repeat count for the stacked elements (list, card, text). One row is drawn per unit, so the value multiplies the output. */
    rows: drawCount(1, 40).optional(),
    align: z.enum(['l', 'c', 'r']).optional(),
    tone: z.enum(['accent', 'muted', 'danger']).optional(),
  })
  .strict();
const wireframeScreenSchema = z
  .object({
    device: z.enum(['desktop', 'browser', 'phone']).optional(),
    title: z.string().optional(),
    url: z.string().optional(),
    label: z.string().optional(),
    elements: z.array(wireframeElementSchema).optional(),
  })
  .strict();
export const wireframeSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    screens: z.array(wireframeScreenSchema).optional(),
  })
  .strict();

// ─── endpoint (Swagger-style API endpoint card) ─────────────────────────────
// One HTTP operation: method + path, parameters, request body, responses, and
// optional request/response examples.
const endpointParamSchema = z
  .object({
    name: z.string(),
    in: z.enum(['path', 'query', 'header', 'cookie']).optional(),
    type: z.string().optional(),
    required: z.boolean().optional(),
    desc: z.string().optional(),
  })
  .strict();
const endpointFieldSchema = z
  .object({
    name: z.string(),
    type: z.string().optional(),
    required: z.boolean().optional(),
    desc: z.string().optional(),
  })
  .strict();
const endpointResponseSchema = z
  .object({
    status: z.union([z.string(), num]),
    desc: z.string().optional(),
    example: z.string().optional(),
  })
  .strict();
export const endpointSchema = z
  .object({
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
    path: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    auth: z.string().optional(),
    params: z.array(endpointParamSchema).optional(),
    body: z.array(endpointFieldSchema).optional(),
    responses: z.array(endpointResponseSchema).optional(),
    request: z.string().optional(),
    response: z.string().optional(),
  })
  .strict();

// ─── pullquote ──────────────────────────────────────────────────────────────
// A standout pull-quote with optional attribution.
export const pullquoteSchema = z
  .object({
    text: z.string(),
    attribution: z.string().optional(),
  })
  .strict();

// ─── layers (a layered explanation: N numbered layers) ──────────────────────
const layerItemSchema = z
  .object({
    title: z.string(),
    kicker: z.string().optional(),
    source: z.string().optional(),
    question: z.string().optional(),
    body: z.string().optional(),
  })
  .strict();
export const layersSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    items: z.array(layerItemSchema).optional(),
  })
  .strict();

// ─── matrix (role × resource capability grid) ───────────────────────────────
// A grid of rows (e.g. roles) × columns (e.g. apps/resources), each cell a
// capability value ("Full", "Read", "—", "✓"). Cells are coloured by value.
const matrixRowSchema = z
  .object({
    label: z.string(),
    cells: z.array(z.string()),
  })
  .strict();
export const matrixSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    corner: z.string().optional(),
    cols: z.array(z.string()).min(1),
    rows: z.array(matrixRowSchema).min(1),
  })
  .strict();

// ─── anatomy (the parts of a structured string, e.g. a permission) ──────────
// Breaks a delimited string (e.g. `app:feature:action`) into labelled, coloured
// segments — like a Swagger-style anatomy of one identifier.
const anatomyPartSchema = z
  .object({
    label: z.string(),
    value: z.string(),
    note: z.string().optional(),
  })
  .strict();
export const anatomySchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    separator: z.string().optional(),
    parts: z.array(anatomyPartSchema).min(1),
  })
  .strict();

// ─── composition (layered gates intersected into an effective result) ───────
// Effective access = gate₁ ∩ gate₂ ∩ … — a row of gate cards joined by ∩,
// resolving to a single result.
const compositionGateSchema = z
  .object({
    label: z.string(),
    desc: z.string().optional(),
    kicker: z.string().optional(),
    source: z.string().optional(),
  })
  .strict();
export const compositionSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    result: z.string().optional(),
    gates: z.array(compositionGateSchema).min(1),
  })
  .strict();

// Shared accent palette for presentation cards.
const accentEnum = z.enum(['navy', 'blue', 'teal', 'green', 'amber', 'purple', 'red', 'gray']);

// ─── drivers (a grid of factor/driver cards with an icon + accent) ──────────
const driverItemSchema = z
  .object({
    title: z.string(),
    body: z.string().optional(),
    tag: z.string().optional(),
    icon: z.string().optional(),
    accent: accentEnum.optional(),
  })
  .strict();
export const driversSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    items: z.array(driverItemSchema).min(1),
  })
  .strict();

// ─── options (approaches/options explored: pros, cons, verdict per card) ────
const optionItemSchema = z
  .object({
    title: z.string(),
    kicker: z.string().optional(),
    how: z.string().optional(),
    pros: z.array(z.string()).optional(),
    cons: z.array(z.string()).optional(),
    verdict: z.string().optional(),
    tone: z.enum(['rejected', 'viable', 'chosen', 'warn', 'neutral']).optional(),
  })
  .strict();
export const optionsSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    items: z.array(optionItemSchema).min(1),
  })
  .strict();

// ─── spec (a labelled spec sheet; each row is a label → value or step flow) ─
const specRowSchema = z
  .object({
    label: z.string(),
    value: z.string().optional(),
    steps: z.array(z.string()).optional(),
  })
  .strict();
export const specSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    accent: accentEnum.optional(),
    rows: z.array(specRowSchema).min(1),
  })
  .strict();

// ─── list (a fancy bullet list: accent / check / icon / number styles) ──────
const listItemSchema = z
  .object({
    lead: z.string(),
    text: z.string().optional(),
    icon: z.string().optional(),
    accent: accentEnum.optional(),
    done: z.boolean().optional(),
  })
  .strict();
export const listSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    style: z.enum(['accent', 'check', 'icon', 'number']).optional(),
    accent: accentEnum.optional(),
    items: z.array(listItemSchema).min(1),
  })
  .strict();

// ─── stories (a collapsible backlog of user stories, one section) ────────────
const storyItemSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    role: z.string().optional(),
    want: z.string().optional(),
    soThat: z.string().optional(),
    priority: z.string().optional(),
    points: num.optional(),
    tags: z.array(z.string()).optional(),
    criteria: z.array(criterionSchema).optional(),
    links: z.array(linkSchema).optional(),
    open: z.boolean().optional(),
  })
  .strict();
export const storiesSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    items: z.array(storyItemSchema).min(1),
  })
  .strict();

// ─── pattern (a design-pattern card: intent · forces · participants · …) ────
const patternParticipantSchema = z
  .object({
    name: z.string(),
    role: z.string().optional(),
  })
  .strict();
export const patternSchema = z
  .object({
    name: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    intent: z.string().optional(),
    forces: z.array(z.string()).optional(),
    solution: z.string().optional(),
    structure: z.string().optional(),
    participants: z.array(patternParticipantSchema).optional(),
    consequences: z
      .object({
        pros: z.array(z.string()).optional(),
        cons: z.array(z.string()).optional(),
      })
      .strict()
      .optional(),
    note: z.string().optional(),
  })
  .strict();

// ─── gallery (a grid of cells: code, a note, or a nested diagram) ───────────
const galleryItemSchema = z
  .object({
    title: z.string().optional(),
    code: z.string().optional(),
    lang: z.string().optional(),
    caption: z.string().optional(),
    accent: accentEnum.optional(),
    // A nested block, e.g. `{ type: c4, ...c4 data }` — lets a cell hold a whole
    // diagram so you can compare architectures in a grid. Validated below.
    block: z.object({ type: z.string() }).passthrough().optional(),
  })
  .strict();
export const gallerySchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    /** Columns in the CSS grid. */
    cols: drawCount(1, 24).optional(),
    items: z.array(galleryItemSchema).min(1),
  })
  .strict()
  // Validate each nested `block` against its real block schema, so a diagram in a
  // cell is checked exactly like a top-level one.
  .superRefine((val, ctx) => {
    val.items.forEach((it, i) => {
      const b = it.block;
      if (b === undefined) return;
      const sub = (blockSchemas as Record<string, z.ZodTypeAny>)[b.type];
      if (sub === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items', i, 'block', 'type'],
          message: `Unknown block type "${b.type}"`,
        });
        return;
      }
      const data: Record<string, unknown> = { ...b };
      delete data.type;
      const res = sub.safeParse(data);
      if (!res.success) {
        for (const issue of res.error.issues) {
          ctx.addIssue({ ...issue, path: ['items', i, 'block', ...issue.path] });
        }
      }
    });
  });

// ─── chart (declarative data chart) ─────────────────────────────────────────
// `labels` + `series` drive bar / stacked / line / area / scatter; `items`
// drives donut, radar,
// gauge (radial progress against `max` — one big dial, or several as
// concentric rings), waterfall (a budget cascade — `budget` draws the dashed
// cap line), and funnel (stacked conversion bands). Values are plain numbers;
// `unit` is an optional display suffix (ms, %, $) and `max` caps the y-axis
// instead of auto-scaling to the data (for `gauge` it is the full sweep,
// default 100). The former `waterfall` and `funnel` types are
// permanent aliases for `chart` with the matching `kind`; `stages` is the
// funnel-era legacy synonym for `items`.
const chartSeriesSchema = z
  .object({
    label: z.string(),
    accent: accentEnum.optional(),
    values: z.array(num),
  })
  .strict();
const chartItemSchema = z
  .object({
    label: z.string(),
    value: num,
    accent: accentEnum.optional(),
    desc: z.string().optional(),
  })
  .strict();
// A scatter point that owns its own x/y (numeric axes). `size` scales the
// bubble area; `label` is drawn beside the bubble.
const chartPointSchema = z
  .object({
    x: num,
    y: num,
    size: num.optional(),
    label: z.string().optional(),
    accent: accentEnum.optional(),
  })
  .strict();
// Reference lines for `kind: scatter` with `points`. `x` / `y` draw dashed
// guides at those values; `quadrants` labels the four corners the guides cut
// the plot into, in TL, TR, BL, BR order.
const chartGuidesSchema = z
  .object({
    x: num.optional(),
    y: num.optional(),
    quadrants: z.array(z.string()).length(4).optional(),
  })
  .strict();
// A labelled point on a bell curve (`kind: bell`): `at` is the x value.
const chartMarkerSchema = z
  .object({
    at: num,
    label: z.string(),
    accent: accentEnum.optional(),
  })
  .strict();
// A five-number summary for `kind: boxplot`; `outliers` are drawn as dots.
const chartBoxSchema = z
  .object({
    label: z.string(),
    min: num,
    q1: num,
    median: num,
    q3: num,
    max: num,
    outliers: z.array(num).optional(),
    accent: accentEnum.optional(),
  })
  .strict();
// One bullet-graph row (`kind: bullet`): the measure against a target inside
// qualitative `ranges` (poor → good, ascending; 2–3 values).
const chartBulletSchema = z
  .object({
    label: z.string(),
    value: num,
    target: num.optional(),
    ranges: z.array(num).optional(),
    accent: accentEnum.optional(),
  })
  .strict();
export const chartSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    kind: z
      .enum(['bar', 'stacked', 'line', 'area', 'scatter', 'donut', 'pie', 'gauge', 'radar', 'waterfall', 'funnel', 'histogram', 'bell', 'boxplot', 'pareto', 'bullet'])
      .optional(),
    labels: z.array(z.string()).optional(),
    series: z.array(chartSeriesSchema).optional(),
    items: z.array(chartItemSchema).optional(),
    // Legacy synonym for `items`, kept for funnel-era bodies.
    stages: z.array(chartItemSchema).optional(),
    // Numeric-axis scatter: used only by `kind: scatter`. When present, both
    // axes become numeric with computed domains (the `labels`+`series` scatter
    // path stays as the ordinal fallback).
    points: z.array(chartPointSchema).optional(),
    guides: chartGuidesSchema.optional(),
    /** Axis titles (numeric scatter). */
    xLabel: z.string().optional(),
    yLabel: z.string().optional(),
    unit: z.string().optional(),
    budget: num.optional(),
    max: num.optional(),
    // `kind: histogram` and `kind: bell` take raw `values`; the renderer bins
    // them (`bins`, default Sturges) or fits mean / sd. `bell` may instead be
    // given `mean` + `sd` directly; `markers` label points on the curve.
    values: z.array(num).optional(),
    bins: num.optional(),
    mean: num.optional(),
    sd: num.optional(),
    markers: z.array(chartMarkerSchema).optional(),
    // `kind: boxplot` takes one five-number summary per box.
    boxes: z.array(chartBoxSchema).optional(),
    // `kind: bullet` takes one bar per row: value vs target inside ranges.
    bullets: z.array(chartBulletSchema).optional(),
  })
  .strict();

// ─── figure (an image with a caption) ───────────────────────────────────────
export const figureSchema = z
  .object({
    src: z.string(),
    alt: z.string().optional(),
    caption: z.string().optional(),
    width: num.optional(),
  })
  .strict();

// ─── steps (a numbered how-to / runbook stepper) ────────────────────────────
const stepItemSchema = z
  .object({
    title: z.string(),
    body: z.string().optional(),
    code: z.string().optional(),
    lang: z.string().optional(),
    note: z.string().optional(),
  })
  .strict();
export const stepsSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    items: z.array(stepItemSchema).min(1),
  })
  .strict();

// ─── faq (Q&A accordions, native <details>) ─────────────────────────────────
const faqItemSchema = z
  .object({
    q: z.string(),
    a: z.string(),
    open: z.boolean().optional(),
  })
  .strict();
export const faqSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    items: z.array(faqItemSchema).min(1),
  })
  .strict();

// ─── envelope (back-of-envelope capacity math) ──────────────────────────────
// `assumptions` are the givens (label over value), `steps` the derivation rows
// (label · calc · result), and `result` the highlighted bottom line.
const envelopeAssumptionSchema = z
  .object({
    label: z.string(),
    value: z.string(),
  })
  .strict();
const envelopeStepSchema = z
  .object({
    label: z.string(),
    calc: z.string(),
    result: z.string(),
  })
  .strict();
const envelopeResultSchema = z
  .object({
    label: z.string(),
    value: z.string(),
  })
  .strict();
export const envelopeSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    assumptions: z.array(envelopeAssumptionSchema).min(1),
    steps: z.array(envelopeStepSchema).min(1),
    result: envelopeResultSchema.optional(),
  })
  .strict();

// ─── slo (service-level objectives with error budgets) ─────────────────────
// `budget` is the fraction of the error budget CONSUMED (0..1; values above 1
// render as exhausted). Omit it to skip the burn bar.
const sloItemSchema = z
  .object({
    name: z.string(),
    sli: z.string(),
    target: z.string(),
    current: z.string().optional(),
    window: z.string().optional(),
    budget: num.min(0).optional(),
  })
  .strict();
export const sloSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    items: z.array(sloItemSchema).min(1),
  })
  .strict();

// ─── swot (classic strengths / weaknesses / opportunities / threats 2×2) ────
// Four plain string lists — one per quadrant. Omit a quadrant you have no
// content for; the grid always draws all four so the shape reads as a SWOT.
export const swotSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    strengths: z.array(z.string()).optional(),
    weaknesses: z.array(z.string()).optional(),
    opportunities: z.array(z.string()).optional(),
    threats: z.array(z.string()).optional(),
  })
  .strict();

// ─── okr (objectives + key results) ─────────────────────────────────────────
// One card per objective; each key result carries a 0..1 `progress` and an
// optional status that colours its progress bar.
const okrKrSchema = z
  .object({
    kr: z.string(),
    progress: num,
    status: z.enum(['on-track', 'at-risk', 'off-track', 'done']).optional(),
  })
  .strict();
const okrItemSchema = z
  .object({
    objective: z.string(),
    owner: z.string().optional(),
    krs: z.array(okrKrSchema).min(1),
  })
  .strict();
export const okrSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    items: z.array(okrItemSchema).min(1),
  })
  .strict();

// ─── persona (user persona cards) ───────────────────────────────────────────
const personaItemSchema = z
  .object({
    name: z.string(),
    role: z.string().optional(),
    quote: z.string().optional(),
    goals: z.array(z.string()).optional(),
    frustrations: z.array(z.string()).optional(),
    tools: z.array(z.string()).optional(),
    accent: accentEnum.optional(),
  })
  .strict();
export const personaSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    personas: z.array(personaItemSchema).min(1),
  })
  .strict();

// ─── changelog (release history) ────────────────────────────────────────────
// A vertical rail of releases; each item can carry a keep-a-changelog-style
// type chip (added / changed / fixed / removed / security).
const changelogItemSchema = z
  .object({
    type: z.enum(['added', 'changed', 'fixed', 'removed', 'security']).optional(),
    text: z.string(),
  })
  .strict();
const changelogReleaseSchema = z
  .object({
    version: z.string(),
    date: z.string().optional(),
    tag: z.enum(['major', 'minor', 'patch', 'breaking']).optional(),
    items: z.array(changelogItemSchema),
  })
  .strict();
export const changelogSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    releases: z.array(changelogReleaseSchema).min(1),
  })
  .strict();

// ─── team (people cards) ────────────────────────────────────────────────────
const teamMemberSchema = z
  .object({
    name: z.string(),
    role: z.string().optional(),
    focus: z.string().optional(),
    initials: z.string().optional(),
    accent: accentEnum.optional(),
  })
  .strict();
export const teamSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    members: z.array(teamMemberSchema).min(1),
  })
  .strict();

// ─── heatmap (numeric grid with an intensity ramp) ──────────────────────────
// `xLabels` name the columns; each row carries one value per column. Tiles
// tint on a single-hue ramp between the data min and max (or the explicit
// `min`/`max` bounds). Short rows pad missing cells as blank tiles.
const heatmapRowSchema = z
  .object({
    label: z.string(),
    values: z.array(num),
  })
  .strict();
export const heatmapSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    xLabels: z.array(z.string()).min(1),
    rows: z.array(heatmapRowSchema).min(1),
    unit: z.string().optional(),
    min: num.optional(),
    max: num.optional(),
  })
  .strict();

// ─── scorecard (weighted decision matrix) ───────────────────────────────────
// Criteria as rows (each with an optional weight, default 1), one column per
// option; each option carries one score per criterion (0-5 scale expected).
// The footer shows the weighted total per option; the winner is highlighted.
const scorecardCriterionSchema = z
  .object({
    label: z.string(),
    weight: num.optional(),
  })
  .strict();
const scorecardOptionSchema = z
  .object({
    label: z.string(),
    scores: z.array(num),
    note: z.string().optional(),
  })
  .strict();
export const scorecardSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    criteria: z.array(scorecardCriterionSchema).min(1),
    options: z.array(scorecardOptionSchema).min(1),
  })
  .strict();

// ─── risk (risk register) ───────────────────────────────────────────────────
// One row-card per risk. Severity derives from likelihood × impact — both
// high → critical, one high → high, both low → low, everything else medium.
const riskItemSchema = z
  .object({
    risk: z.string(),
    likelihood: z.enum(['low', 'med', 'high']),
    impact: z.enum(['low', 'med', 'high']),
    mitigation: z.string().optional(),
    owner: z.string().optional(),
    status: z.enum(['open', 'mitigating', 'accepted', 'closed']).optional(),
  })
  .strict();
export const riskSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    items: z.array(riskItemSchema).min(1),
  })
  .strict();

// ─── palette (colour-token swatches) ────────────────────────────────────────
// A responsive card grid of colour swatches. `value` is a hex string (quote it
// in YAML — `#` starts a comment); `on` optionally overrides the label colour
// shown inside the swatch (otherwise it auto-contrasts from the hex).
const paletteColorSchema = z
  .object({
    name: z.string(),
    value: z.string(),
    on: z.string().optional(),
    usage: z.string().optional(),
  })
  .strict();
export const paletteSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    /** Columns in the CSS grid. */
    cols: drawCount(1, 24).optional(),
    colors: z.array(paletteColorSchema).min(1),
  })
  .strict();

// ─── typescale (live type specimen) ─────────────────────────────────────────
// One row per style: a meta column (name, size / weight, note) and the sample
// text rendered live at the row's size, weight, line-height, and font family.
const typescaleItemSchema = z
  .object({
    name: z.string(),
    size: num,
    weight: num.optional(),
    lineHeight: num.optional(),
    font: z.enum(['display', 'body', 'mono']).optional(),
    note: z.string().optional(),
  })
  .strict();
export const typescaleSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    sample: z.string().optional(),
    items: z.array(typescaleItemSchema).min(1),
  })
  .strict();

// ─── dodont (do / don't guideline cards) ────────────────────────────────────
// Two cards side by side: DO (green) and DON'T (red). Each item is a guideline
// with an optional mono `example` chip rendered beneath it.
const dodontItemSchema = z
  .object({
    text: z.string(),
    example: z.string().optional(),
  })
  .strict();
export const dodontSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    dos: z.array(dodontItemSchema).min(1),
    donts: z.array(dodontItemSchema).min(1),
  })
  .strict();

// ─── inventory (component / feature status board) ───────────────────────────
// Compact hairline-separated rows: name (+ optional mono tag chip), a note,
// and a right-aligned colour-coded status chip.
const inventoryItemSchema = z
  .object({
    name: z.string(),
    status: z.enum(['stable', 'beta', 'experimental', 'deprecated', 'planned']),
    tag: z.string().optional(),
    note: z.string().optional(),
  })
  .strict();
export const inventorySchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    items: z.array(inventoryItemSchema).min(1),
  })
  .strict();

// Shared tone enum for the algorithms & data-structures family. Tints one
// cell / node / entry so a walkthrough step reads at a glance: `active` is the
// element being examined, `visited` has been processed, `target` is the goal,
// `muted` is out of play.
const dsToneEnum = z.enum(['active', 'visited', 'target', 'muted']);

// ─── array (array cells for algorithm walkthroughs) ─────────────────────────
// `items[].value` is a string — quote numbers. `label` renders a pointer
// marker BELOW the cell (e.g. "i", "mid"); `window` highlights a 0-based
// inclusive index range (out-of-bounds values clamp).
const arrayItemSchema = z
  .object({
    value: z.string(),
    tone: dsToneEnum.optional(),
    label: z.string().optional(),
  })
  .strict();
const arrayWindowSchema = z
  .object({
    from: num,
    to: num,
    label: z.string().optional(),
  })
  .strict();
export const arraySchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    items: z.array(arrayItemSchema).optional(),
    window: arrayWindowSchema.optional(),
    showIndex: z.boolean().optional(),
  })
  .strict();

// ─── linkedlist (pointer-chain diagram) ─────────────────────────────────────
// `label` renders a marker ABOVE the node (e.g. "head", "curr"). `kind:
// doubly` adds back-arrows; `nullEnd` (default true) draws the ∅ terminator.
const linkedlistNodeSchema = z
  .object({
    value: z.string(),
    tone: dsToneEnum.optional(),
    label: z.string().optional(),
  })
  .strict();
export const linkedlistSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    kind: z.enum(['singly', 'doubly']).optional(),
    nodes: z.array(linkedlistNodeSchema).optional(),
    nullEnd: z.boolean().optional(),
  })
  .strict();

// ─── bintree (binary tree) ──────────────────────────────────────────────────
// Nodes reference their `parent` by id and MUST say which `side` (left/right)
// they occupy — validated below. Nodes without a parent are roots (multiple
// roots lay out side by side).
const bintreeNodeSchema = z
  .object({
    id: z.string(),
    value: z.string(),
    parent: z.string().optional(),
    side: z.enum(['left', 'right']).optional(),
    tone: dsToneEnum.optional(),
  })
  .strict();
export const bintreeSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    nodes: z.array(bintreeNodeSchema).optional(),
  })
  .strict()
  // A child must say which slot it fills, and a parent can hold at most one
  // child per side — both are authoring errors worth catching early.
  .superRefine((val, ctx) => {
    const seen = new Set<string>();
    (val.nodes ?? []).forEach((n, i) => {
      if (n.parent !== undefined && n.side === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['nodes', i, 'side'],
          message: `Node "${n.id}" has a parent but no side — set side: left or side: right`,
        });
        return;
      }
      if (n.parent === undefined) return;
      const slot = `${n.parent}::${n.side ?? ''}`;
      if (seen.has(slot)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['nodes', i, 'side'],
          message: `Parent "${n.parent}" already has a ${n.side ?? ''} child`,
        });
        return;
      }
      seen.add(slot);
    });
  });

// ─── hashmap (buckets + chained entries) ────────────────────────────────────
// `buckets` is the bucket count (slots render 0..N-1, capped at 12 with a
// "+N more" note). Entries whose `bucket` falls outside 0..N-1 are skipped.
const hashmapEntrySchema = z
  .object({
    key: z.string(),
    value: z.string().optional(),
    /** Which bucket holds the entry, 0-based. Outside `0..buckets-1` it is skipped. */
    bucket: num.int('a bucket index is a whole number').min(0, 'bucket indexes are 0-based'),
    tone: dsToneEnum.optional(),
  })
  .strict();
export const hashmapSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    /** Bucket count. The renderer draws the first 12 and notes "+N more", so a large table stays legible. */
    buckets: num.int('a bucket count is a whole number').min(0),
    entries: z.array(hashmapEntrySchema).optional(),
  })
  .strict();

// ─── agentloop (the canonical agent-loop diagram) ───────────────────────────
// One agent card in the middle, the environment (user) on the left, a column
// of tools on the right, and a memory cylinder beneath — joined by the
// numbered loop: ① prompt → ② tool call → ③ result → ④ response. `stop` is
// the loop's termination condition, rendered as a foot pill.
const agentloopAgentSchema = z
  .object({
    name: z.string(),
    model: z.string().optional(),
    note: z.string().optional(),
  })
  .strict();
const agentloopToolSchema = z
  .object({
    name: z.string(),
    desc: z.string().optional(),
  })
  .strict();
export const agentloopSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    agent: agentloopAgentSchema,
    tools: z.array(agentloopToolSchema).optional(),
    memory: z.array(z.string()).optional(),
    env: z.string().optional(),
    stop: z.string().optional(),
  })
  .strict();

// ─── trace (agent / session execution transcript) ───────────────────────────
// A vertical transcript, one entry per turn. `thinking` renders before `text`
// on assistant turns; tool turns carry `tool` (the tool name) plus `args` and
// `result` as mono lines. Multi-line strings preserve their line breaks.
const traceTurnSchema = z
  .object({
    role: z.enum(['user', 'assistant', 'tool', 'system']),
    text: z.string().optional(),
    thinking: z.string().optional(),
    tool: z.string().optional(),
    args: z.string().optional(),
    result: z.string().optional(),
  })
  .strict();
export const traceSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    turns: z.array(traceTurnSchema).min(1),
  })
  .strict();

// ─── prompt (prompt anatomy with variable highlighting) ─────────────────────
// Stacked cards, one per segment (system / user / assistant / tool). Any
// `{{variable}}` token inside `text` renders as a highlighted chip; `vars`
// documents those variables in a legend beneath. Quote text containing
// `{{ }}` in YAML — flow-style braces otherwise parse as a map.
const promptSegmentSchema = z
  .object({
    kind: z.enum(['system', 'user', 'assistant', 'tool']),
    label: z.string().optional(),
    text: z.string(),
  })
  .strict();
const promptVarSchema = z
  .object({
    name: z.string(),
    desc: z.string().optional(),
  })
  .strict();
export const promptSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    segments: z.array(promptSegmentSchema).min(1),
    vars: z.array(promptVarSchema).optional(),
  })
  .strict();

// ─── context (context-window token budget) ──────────────────────────────────
// One horizontal stacked bar sized against `window` (the total budget).
// Remaining space renders as a dim "free" segment; when the segments sum past
// the window, the overflow tints negative past a marked boundary. Zero-token
// segments are skipped.
const contextSegmentSchema = z
  .object({
    label: z.string(),
    tokens: num,
    accent: accentEnum.optional(),
    desc: z.string().optional(),
  })
  .strict();
export const contextSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    window: num,
    unit: z.string().optional(),
    segments: z.array(contextSegmentSchema),
  })
  .strict();

// ─── archmap (target-architecture capability map) ───────────────────────────
// The classic enterprise-architecture one-pager: a square mosaic of tinted
// domain areas, each packed with small capability/system tiles. A plain-string
// item is a current/steady capability; an object item can carry a status —
// target (to be built), new (just added), gap (missing), deprecated (retiring).
// `cols` sets areas per row (default 3, clamped 2-4 at render time).
const archmapTileSchema = z
  .object({
    name: z.string(),
    status: z.enum(['target', 'new', 'gap', 'deprecated']).optional(),
  })
  .strict();
const archmapAreaSchema = z
  .object({
    label: z.string(),
    accent: accentEnum.optional(),
    desc: z.string().optional(),
    items: z.array(z.union([z.string(), archmapTileSchema])).optional(),
  })
  .strict();
export const archmapSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    /** Columns in the CSS grid. */
    cols: drawCount(1, 24).optional(),
    areas: z.array(archmapAreaSchema).min(1),
  })
  .strict();

// ─── divider (a full-width section-break band) ──────────────────────────────
// The interstitial slide of a deck ("PART 2 — The fix") or a visual chapter
// break in a long document: an optional mono kicker, a display title, and an
// optional subtitle, centered on a subtle accent-washed band.
export const dividerSchema = z
  .object({
    kicker: z.string().optional(),
    title: z.string(),
    subtitle: z.string().optional(),
    accent: accentEnum.optional(),
  })
  .strict();

// ─── bignumber (one hero metric at presentation scale) ──────────────────────
// A single number big enough to carry a slide: the value, a one-line claim
// (`label`), an optional smaller `context` line, and an optional delta with an
// up/down/flat trend arrow (arrow is neutral gray — "down" is often good).
export const bignumberSchema = z
  .object({
    value: z.string(),
    label: z.string(),
    context: z.string().optional(),
    delta: z.string().optional(),
    trend: z.enum(['up', 'down', 'flat']).optional(),
    accent: accentEnum.optional(),
  })
  .strict();

// ─── takeaways (the 2-6 things to remember) ─────────────────────────────────
// The closing slide of a good deck: numbered rows at presentation scale, each
// a bold one-liner with an optional smaller detail line beneath.
const takeawayItemSchema = z
  .object({
    text: z.string(),
    detail: z.string().optional(),
  })
  .strict();
export const takeawaysSchema = z
  .object({
    title: z.string().optional(),
    items: z.array(takeawayItemSchema).min(2).max(6),
    accent: accentEnum.optional(),
  })
  .strict();

// ─── statustable (task table with an update column + colored status pills) ──
// Free cells render under `columns` headers (default: Task · Update at render
// time); a final Status column renders each row's `status` as a colored pill.
// `statuses` is the user-defined label → color vocabulary; rows may also use
// the built-in defaults below (matched case-insensitively).
/**
 * Semantic status-color aliases → the accent each normalizes to. Authors may
 * write either the palette accent (`green`) or the intent (`success`).
 */
export const STATUS_COLOR_ALIASES = {
  success: 'green',
  error: 'red',
  warn: 'amber',
  neutral: 'gray',
  info: 'blue',
} as const;
/** A status color: one of the 8 accents, or a semantic alias for one. */
const statusColorEnum = z.enum([
  ...accentEnum.options,
  'success',
  'error',
  'warn',
  'neutral',
  'info',
]);
export type StatusColor = z.infer<typeof statusColorEnum>;
/** Resolves a status color to its palette accent (semantic aliases map over). */
export function normalizeStatusColor(color: StatusColor): z.infer<typeof accentEnum> {
  const alias = (STATUS_COLOR_ALIASES as Readonly<Record<string, z.infer<typeof accentEnum>>>)[
    color
  ];
  return alias ?? (color as z.infer<typeof accentEnum>);
}
const statustableStatusSchema = z
  .object({
    label: z.string(),
    color: statusColorEnum,
  })
  .strict();
const statustableSubtaskSchema = z
  .object({
    cells: z.array(z.union([z.string(), num])).min(1),
    status: z.string(),
  })
  .strict();
const statustableRowSchema = z
  .object({
    cells: z.array(z.union([z.string(), num])).min(1),
    status: z.string(),
    // One level of nesting: subtask rows render indented under their parent.
    // The parent's status stays explicit — no roll-up; the author decides.
    subtasks: z.array(statustableSubtaskSchema).optional(),
  })
  .strict();
// Legacy tracker-era item rows (`variant: tracker`): a task with a closed
// status/priority vocabulary. The former `tracker` type is a permanent alias
// for `statustable` with `variant: tracker` + these `items`.
const statustableItemSchema = z
  .object({
    task: z.string(),
    status: z.enum(['todo', 'doing', 'done', 'blocked']).optional(),
    priority: z.enum(['high', 'med', 'low']).optional(),
    owner: z.string().optional(),
    due: z.string().optional(),
  })
  .strict();
/**
 * The built-in status vocabulary a `statustable` row may use when the block
 * defines no `statuses` (or alongside them). Labels match case-insensitively.
 */
export const STATUSTABLE_DEFAULT_STATUSES: ReadonlyArray<{
  readonly label: string;
  readonly color: z.infer<typeof accentEnum>;
}> = [
  { label: 'in progress', color: 'amber' },
  { label: 'blocked', color: 'red' },
  { label: 'completed', color: 'green' },
  { label: 'todo', color: 'gray' },
  { label: 'done', color: 'green' },
];
export const statustableSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    variant: z.enum(['tracker']).optional(),
    columns: z.array(z.string()).optional(),
    statuses: z.array(statustableStatusSchema).optional(),
    rows: z.array(statustableRowSchema).min(1).optional(),
    // Legacy tracker-era rows; used instead of `rows` (see statustableItemSchema).
    items: z.array(statustableItemSchema).optional(),
  })
  .strict()
  // Validate each row's (and subtask's) `status` against the vocabulary
  // (user-defined labels + built-in defaults, case-insensitive), so a typo'd
  // status surfaces as a diagnostic instead of a silently gray pill.
  .superRefine((val, ctx) => {
    if (val.rows === undefined && val.items === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rows'],
        message: 'statustable needs rows (or legacy tracker items)',
      });
      return;
    }
    const vocab = [...(val.statuses ?? []), ...STATUSTABLE_DEFAULT_STATUSES];
    const known = new Set(vocab.map((s) => s.label.toLowerCase()));
    const listed: string[] = [];
    for (const s of vocab) {
      if (!listed.some((l) => l.toLowerCase() === s.label.toLowerCase())) listed.push(s.label);
    }
    const check = (status: string, path: Array<string | number>): void => {
      if (!known.has(status.toLowerCase())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path,
          message: `unknown status "${status}" — available: ${listed.join(', ')}`,
        });
      }
    };
    (val.rows ?? []).forEach((row, i) => {
      check(row.status, ['rows', i, 'status']);
      (row.subtasks ?? []).forEach((sub, j) => {
        check(sub.status, ['rows', i, 'subtasks', j, 'status']);
      });
    });
  });

// ─── cycle (a closed loop of stages arranged in a circle) ───────────────────
// A flowchart whose last step feeds the first — build/measure/learn, PDCA,
// an incident loop. Steps render clockwise from 12 o'clock; a step may be a
// bare string (the label) or `{ label, desc }` — descriptions move to the
// numbered legend under the diagram, matching the edge-steps house pattern.
const cycleStepSchema = z.union([
  z.string(),
  z
    .object({
      label: z.string(),
      desc: z.string().optional(),
    })
    .strict(),
]);
export const cycleSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    // A circle needs at least 2 stations; past 8 the ring gets unreadable.
    steps: z.array(cycleStepSchema).min(2).max(8),
    /** Optional hub label rendered in the middle of the ring. */
    center: z.string().optional(),
  })
  .strict();

// ─── sankey (flow volumes between stages) ───────────────────────────────────
// The one shape the diagram blocks could not draw: how much of something moves
// from where to where. `flow` and `dfd` show that a path exists; a sankey
// shows how heavy it is — spend by service, traffic by route, a funnel with
// its drop-off, energy or data volumes. Nodes are inferred from the links, so
// the minimum body is a list of `from -> to: value`; declare `nodes` only to
// give one a nicer label, an accent, or a fixed column.
const sankeyNodeSchema = z
  .object({
    id: z.string(),
    label: z.string().optional(),
    accent: accentEnum.optional(),
    /** 1-indexed column, when the derived depth reads wrong. */
    col: gridCoord.optional(),
  })
  .strict();
const sankeyLinkSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    value: num,
    label: z.string().optional(),
  })
  .strict();
export const sankeySchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    /** Display suffix for every volume — `$`, `GB`, ` req/s`. */
    unit: z.string().optional(),
    nodes: z.array(sankeyNodeSchema).optional(),
    links: z.array(sankeyLinkSchema).min(1),
  })
  .strict();

// ─── benchmark (measured results: subject columns × metric rows) ────────────
// A scoreboard, not a decision matrix: `scorecard` asks you to score options
// against weighted criteria, `benchmark` reports numbers you measured. One
// column per subject (model, vendor, build), one row per metric, and the best
// result in each row is derived and highlighted — nobody bolds it by hand.
// A cell is the terse value, or an object when it needs a note, or an array
// when the row measures the same metric under several conditions.
const benchmarkSubjectSchema = z
  .object({
    label: z.string(),
    /** Small sub-label under the column head (e.g. a version or "ours"). */
    sub: z.string().optional(),
    /** Draws the outline around this whole column — the subject in focus. */
    featured: z.boolean().optional(),
    /** Tint used when this subject wins a row. Default `accent`. */
    tone: z.enum(['accent', 'muted']).optional(),
  })
  .strict();
const benchmarkValueSchema = z.union([
  z.string(),
  num,
  z
    .object({
      value: z.union([z.string(), num]).optional(),
      /** Forces the win highlight (ties, or a winner that isn't a number). */
      best: z.boolean().optional(),
      /** Tiny label above the value (e.g. the variant of the subject used). */
      note: z.string().optional(),
    })
    .strict(),
]);
/** One subject's result(s) for a row: a value, or one value per variant. */
const benchmarkCellSchema = z.union([benchmarkValueSchema, z.array(benchmarkValueSchema)]);
const benchmarkRowSchema = z
  .object({
    label: z.string(),
    /** The benchmark's own name, under the metric label. */
    sub: z.string().optional(),
    /** Conditions measured, in order — captions the stacked values in a cell. */
    variants: z.array(z.string()).optional(),
    /** Which way is better; `none` highlights nothing. Default `high`. */
    better: z.enum(['high', 'low', 'none']).optional(),
    /** One entry per subject, in column order. Short arrays render as `—`. */
    cells: z.array(benchmarkCellSchema).optional(),
  })
  .strict();
export const benchmarkSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    /** Head of the metric column. Default `Benchmark`. */
    metricLabel: z.string().optional(),
    /** Footnote under the table (measurement conditions, dates, sources). */
    note: z.string().optional(),
    subjects: z.array(benchmarkSubjectSchema).min(1),
    rows: z.array(benchmarkRowSchema).min(1),
  })
  .strict();

// ─── gitgraph (branching and release model) ─────────────────────────────────
// The picture every branching policy doc draws by hand: lanes for branches,
// dots for commits, curves where a branch starts and where it merges back.
// Commits are a sequence — the first mention of a branch opens its lane off
// whatever the parent branch's head is at that moment, and `merge` closes one
// back into the branch the commit is on.
const gitBranchSchema = z
  .object({
    name: z.string(),
    accent: accentEnum.optional(),
  })
  .strict();
const gitCommitSchema = z
  .object({
    /** Lane this commit lands on. Defaults to the first branch. */
    branch: z.string().optional(),
    label: z.string().optional(),
    /** Release marker drawn above the dot. */
    tag: z.string().optional(),
    /** Branch merged INTO this commit's branch here. */
    merge: z.string().optional(),
    /** Branch this one forks from, when it isn't the previous lane. */
    from: z.string().optional(),
    kind: z.enum(['normal', 'release', 'hotfix', 'revert']).optional(),
  })
  .strict();
export const gitgraphSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    branches: z.array(gitBranchSchema).optional(),
    commits: z.array(gitCommitSchema).min(1),
  })
  .strict();

// ─── treemap (proportional composition) ─────────────────────────────────────
// Where a donut gives up. Six slices is a donut; thirty services by spend, or
// a bundle by module, is a treemap — area is the value, so the big tiles are
// the answer and the small ones still have a place to sit.
const treemapItemSchema = z
  .object({
    label: z.string(),
    value: num,
    accent: accentEnum.optional(),
    /** Second line inside the tile, when it fits. */
    desc: z.string().optional(),
  })
  .strict();
export const treemapSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    unit: z.string().optional(),
    items: z.array(treemapItemSchema).min(1),
  })
  .strict();

// ─── packet (wire format / bit layout) ──────────────────────────────────────
// A header laid out bit by bit, the way an RFC draws it. `width` is the bits
// per row (32 by default); each field takes `bits` and wraps across rows when
// it has to, so the picture is arithmetic rather than ASCII art.
const packetFieldSchema = z
  .object({
    label: z.string(),
    /** How many bits the field takes. It wraps across `width`-bit rows, so the value multiplies the output. */
    bits: drawCount(1, 4096),
    accent: accentEnum.optional(),
    /** Fixed value or note, shown under the name when the cell is wide. */
    value: z.string().optional(),
  })
  .strict();
export const packetSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    /**
     * Bits per row. Default 32. Each row draws one tick per bit and the cell
     * width is the frame width divided by this, so the value multiplies the
     * output; past 128 the cells are thinner than their own hairlines.
     * 32 and 64 are the readable widths — `density.ts` warns above 64.
     */
    width: drawCount(1, 128).optional(),
    fields: z.array(packetFieldSchema).min(1),
  })
  .strict();

// ─── venn (two or three overlapping sets) ───────────────────────────────────
// Scope, ownership, responsibility: the cases where the interesting part is
// what two groups share. Two or three sets; `shared` names a region by the
// sets it belongs to, so the overlap carries a label instead of a guess.
const vennSetSchema = z
  .object({
    label: z.string(),
    accent: accentEnum.optional(),
    /** Line under the set name, inside its own region. */
    desc: z.string().optional(),
  })
  .strict();
const vennSharedSchema = z
  .object({
    /** Set labels this region belongs to — two, or all three. */
    sets: z.array(z.string()).min(2),
    label: z.string(),
  })
  .strict();
export const vennSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    sets: z.array(vennSetSchema).min(2).max(3),
    shared: z.array(vennSharedSchema).optional(),
  })
  .strict();

// ─── wardley (value chain × evolution) ──────────────────────────────────────
// Strategy on two axes: how visible a component is to the user (up) and how
// evolved it is (right, genesis → custom → product → commodity). Both are
// 0..1 so the map is the author's judgement, plainly stated, and `links` draw
// the value chain between components.
const wardleyComponentSchema = z
  .object({
    id: z.string().optional(),
    label: z.string(),
    /** Evolution, 0 (genesis) → 1 (commodity). */
    x: num,
    /** Visibility to the user, 0 (invisible) → 1 (visible). */
    y: num,
    kind: z.enum(['user', 'component', 'commodity', 'build', 'buy']).optional(),
    /** Where this component is heading, as an evolution delta. */
    movement: num.optional(),
  })
  .strict();
const wardleyLinkSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
  })
  .strict();
export const wardleySchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    components: z.array(wardleyComponentSchema).min(1),
    links: z.array(wardleyLinkSchema).optional(),
  })
  .strict();

// ─── harvey (rated comparison — the consulting Harvey-ball grid) ────────────
// Options across the top, criteria down the side, and a filled circle for how
// well each option meets each one: 0 empty, 4 full. It is the shape a steering
// committee reads fastest, because a column of nearly-full circles argues for
// itself. Use `benchmark` when the cells are measured numbers and `harvey`
// when they are judgements.
const harveyRowSchema = z
  .object({
    label: z.string(),
    /** 0–4 per column, in column order. Short rows read as "not assessed". */
    ratings: z.array(num),
    /** What the row is actually measuring. */
    note: z.string().optional(),
    /** Relative importance, shown as a ×N chip. */
    weight: num.optional(),
  })
  .strict();
export const harveySchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    columns: z.array(z.string()).min(1),
    rows: z.array(harveyRowSchema).min(1),
    /** Column to mark as the recommendation — matched by label. */
    recommend: z.string().optional(),
    /**
     * Legend for what 0 and 4 mean, e.g. `[poor, excellent]`. An array of two
     * rather than a tuple: schema introspection can describe an array, so the
     * Studio form gets real fields for it instead of falling back to raw YAML.
     */
    scale: z.array(z.string()).min(2).max(2).optional(),
  })
  .strict();

// ─── scqa (executive summary, Minto's structure) ────────────────────────────
// Situation, complication, question, answer: the four moves that make an
// opening slide argue instead of describe. The answer is the recommendation,
// so it carries the emphasis — everything above it exists to make it land.
export const scqaSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    /** What everyone already agrees on. */
    situation: z.string().optional(),
    /** What changed, or what is now at stake. */
    complication: z.string().optional(),
    /** The one question the work has to settle. */
    question: z.string().optional(),
    /** The recommendation — the line the deck exists to deliver. */
    answer: z.string().optional(),
    /** Optional supporting points under the answer. */
    because: z.array(z.string()).optional(),
  })
  .strict();

// ─── scenarios (base / upside / downside against the drivers) ───────────────
// The table a plan is defended with: the same handful of drivers, moved three
// ways, and what each set of assumptions produces. Keeping the cases in
// columns makes the comparison the point; `outcome` is the number the room
// actually argues about, so it gets its own emphasised row.
const scenarioCaseSchema = z
  .object({
    label: z.string(),
    /** One assumption per driver, in `drivers` order. */
    values: z.array(z.string()),
    /** What this set of assumptions produces. */
    outcome: z.string().optional(),
    tone: z.enum(['pos', 'neg', 'base']).optional(),
    note: z.string().optional(),
  })
  .strict();
export const scenariosSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    drivers: z.array(z.string()).min(1),
    cases: z.array(scenarioCaseSchema).min(2),
    /** Label for the outcome row. Default `Outcome`. */
    outcomeLabel: z.string().optional(),
  })
  .strict();

// ─── fishbone (cause & effect — Ishikawa) ────────────────────────────────────
// The analysis shape for "what causes this?": one effect at the head, the
// candidate cause categories as bones off the spine, and the specific causes
// as items along each bone. A `flow` shows a path; a `tree` shows containment;
// a fishbone groups suspected causes behind one outcome.
const fishboneCauseSchema = z
  .object({
    label: z.string(),
    /** Specific causes along this bone. */
    items: z.array(z.string()).max(8).optional(),
  })
  .strict();
export const fishboneSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    /** The head — the problem or outcome the causes feed. */
    effect: z.string(),
    /** The main bones. Past 8 the diagram stops being an analysis. */
    causes: z.array(fishboneCauseSchema).min(1).max(8),
  })
  .strict();

// ─── storymap (user story mapping — backbone + slices) ──────────────────────
// The story-mapping shape: the ordered activities of the journey across the
// top (the backbone), and horizontal release slices under it, each holding
// the cards that ship in that slice. A `journey` tracks experience over
// stages and a `kanban` tracks work in flight — a storymap shows what gets
// built under each activity, slice by slice.
const storymapCardSchema = z.union([
  z.string(),
  z
    .object({
      title: z.string(),
      tag: z.string().optional(),
    })
    .strict(),
]);
const storymapStepSchema = z
  .object({
    label: z.string(),
    /** A muted one-liner under the step label. */
    note: z.string().optional(),
  })
  .strict();
const storymapSliceSchema = z
  .object({
    label: z.string(),
    /**
     * One cell per backbone step, in backbone order. A cell is the list of
     * cards under that step in this slice — `[]` for none.
     */
    cells: z.array(z.array(storymapCardSchema).max(6)),
  })
  .strict();
export const storymapSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    /** The ordered activities across the top. Past 10 the map stops reading. */
    backbone: z.array(storymapStepSchema).min(1).max(10),
    /** The horizontal release slices, top (first) to bottom. */
    slices: z.array(storymapSliceSchema).min(1).max(6),
  })
  .strict()
  // Each slice must give one cell per backbone step, so a card can never sit
  // under the wrong activity silently.
  .superRefine((val, ctx) => {
    val.slices.forEach((slice, i) => {
      if (slice.cells.length !== val.backbone.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['slices', i, 'cells'],
          message: `slice "${slice.label}" has ${slice.cells.length} cells but the backbone has ${val.backbone.length} steps — give one cell per step (use [] for an empty cell)`,
        });
      }
    });
  });

// ─── slopegraph (ranked before / after comparison) ──────────────────────────
// Two labeled columns (usually years), one line per item between them. The
// slope of each line is the message: what rose, what fell, what held. A
// `chart` plots series against an axis; a slopegraph names every item at
// both ends and lets the lines cross.
const slopegraphItemSchema = z
  .object({
    label: z.string(),
    /** Value in the left column. */
    from: num,
    /** Value in the right column. */
    to: num,
    accent: accentEnum.optional(),
  })
  .strict();
export const slopegraphSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    /** Left column header (e.g. "2023"). */
    left: z.string(),
    /** Right column header (e.g. "2025"). */
    right: z.string(),
    /** Unit appended to every value (e.g. "%", "ms"). */
    unit: z.string().optional(),
    items: z.array(slopegraphItemSchema).min(2).max(20),
  })
  .strict();

// ─── spans (distributed trace waterfall) ────────────────────────────────────
// One request, many services: every span is a bar in its service's lane,
// placed by `start` and sized by `duration` on a shared time axis. `parent`
// nests a span under its caller; the renderer derives the critical path.
const spanKindEnum = z.enum(['server', 'client', 'db', 'queue', 'cache', 'internal']);
const spanSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    /** The service that executed the span — one lane per service. */
    service: z.string(),
    /** Offset from the trace start, in `unit`. */
    start: num.min(0),
    /** Length of the span, in `unit`. */
    duration: num.min(0),
    /** The calling span's `id`. */
    parent: z.string().optional(),
    kind: spanKindEnum.optional(),
    error: z.boolean().optional(),
    attrs: z.record(z.union([z.string(), num])).optional(),
    note: z.string().optional(),
  })
  .strict();
export const spansSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    /** Time unit of `start` / `duration` (default `ms`). */
    unit: z.enum(['ms', 's', 'us']).optional(),
    spans: z.array(spanSchema).min(1),
  })
  .strict()
  .superRefine((val, ctx) => {
    const ids = new Set<string>();
    val.spans.forEach((s, i) => {
      if (ids.has(s.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['spans', i, 'id'],
          message: `duplicate span id "${s.id}" — every span needs its own id`,
        });
      }
      ids.add(s.id);
    });
    val.spans.forEach((s, i) => {
      if (s.parent === undefined) return;
      if (s.parent === s.id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['spans', i, 'parent'],
          message: `span "${s.id}" names itself as parent`,
        });
      } else if (!ids.has(s.parent)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['spans', i, 'parent'],
          message: `span "${s.id}" has parent "${s.parent}", which is not a span id`,
        });
      }
    });
  });

// ─── rollout (progressive delivery stages) ──────────────────────────────────
// How a change ships and what stops it: an ordered strip of stages, each with
// the traffic share it takes, how long it holds, and the gate that must pass
// before the next stage starts. `rollback` names the way back.
const rolloutStageSchema = z
  .object({
    name: z.string(),
    /** Share of traffic on the new version at this stage, 0–100. */
    traffic: num.min(0).max(100).optional(),
    /** How long the stage holds before the gate is judged (e.g. `30m`). */
    duration: z.string().optional(),
    /** The condition that must pass to advance (e.g. `error rate < 0.5%`). */
    gate: z.string().optional(),
    status: z.enum(['done', 'current', 'next', 'blocked']).optional(),
    note: z.string().optional(),
  })
  .strict();
export const rolloutSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    strategy: z.enum(['canary', 'blue-green', 'rolling', 'feature-flag']).optional(),
    stages: z.array(rolloutStageSchema).min(1),
    /** The rollback move, shown as the footer line. */
    rollback: z.string().optional(),
  })
  .strict();

// ─── eventcontract (async event contract — the twin of endpoint) ────────────
// One card per event, the way `endpoint` is one card per operation: who
// produces it, who consumes it, the delivery guarantee, and the payload
// fields. `key` names the partition key — the field the renderer marks `#`.
const eventFieldSchema = z
  .object({
    name: z.string(),
    type: z.string(),
    required: z.boolean().optional(),
    desc: z.string().optional(),
    /** A sample value, shown after the description. */
    example: z.string().optional(),
  })
  .strict();
const eventErrorSchema = z
  .object({
    name: z.string(),
    /** When the consumer sees this error. */
    when: z.string().optional(),
  })
  .strict();
export const eventcontractSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    /** The event name (e.g. `order.placed`). */
    name: z.string(),
    /** Contract version, shown in the eyebrow (`EVENT · v2`). */
    version: z.string().optional(),
    /** The topic or queue the event travels on. */
    channel: z.string().optional(),
    summary: z.string().optional(),
    producers: z.array(z.string()).optional(),
    consumers: z.array(z.string()).optional(),
    delivery: z.enum(['at-least-once', 'at-most-once', 'exactly-once']).optional(),
    ordering: z.enum(['none', 'per-key', 'global']).optional(),
    /** The partition key — the payload field ordering is kept for. */
    key: z.string().optional(),
    /** How long the channel keeps the event (e.g. `7d`). */
    retention: z.string().optional(),
    /** Payload fields. Terse: `name type [required] — desc`. */
    schema: z.array(eventFieldSchema).optional(),
    /** Envelope headers, same shape as `schema`. */
    headers: z.array(eventFieldSchema).optional(),
    /** An example payload, verbatim (JSON is highlighted). */
    example: z.string().optional(),
    /** Failure modes a consumer must handle. Terse: `Name — when`. */
    errors: z.array(eventErrorSchema).optional(),
    note: z.string().optional(),
  })
  .strict();

// ─── saga (distributed transaction — steps and their compensations) ─────────
// The reader's question is "what happens when step 3 fails?": forward steps
// left to right, each with the compensation that undoes it, and `failAt`
// marking the step that fails so the renderer draws the compensating flow
// back to step 1. Statuses derive from `failAt` when not given explicitly.
const sagaStepSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    /** The service that owns the step — shown as its chip. */
    service: z.string(),
    /** What the step does, as a mono sublabel. */
    action: z.string().optional(),
    /** The compensating action that undoes this step. */
    compensate: z.string().optional(),
    status: z.enum(['ok', 'failed', 'skipped', 'compensated']).optional(),
  })
  .strict();
export const sagaSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    mode: z.enum(['orchestration', 'choreography']).optional(),
    /** The orchestrator's name (`mode: orchestration` only). */
    coordinator: z.string().optional(),
    /** Terse: `id: Name · service · compensate` (or `· service · action · compensate`). */
    steps: z.array(sagaStepSchema).min(1),
    /** The `id` of the step that fails. */
    failAt: z.string().optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    const ids = new Set<string>();
    val.steps.forEach((s, i) => {
      if (ids.has(s.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['steps', i, 'id'],
          message: `duplicate step id "${s.id}" — every step needs its own id`,
        });
      }
      ids.add(s.id);
    });
    if (val.failAt !== undefined && !ids.has(val.failAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['failAt'],
        message: `failAt "${val.failAt}" is not a step id — use one of: ${[...ids].join(', ')}`,
      });
    }
  });

// ─── registry source-of-truth ───────────────────────────────────────────────

// ═══ Phase 31 — coverage sweep (2026-09-13): ML, audits & performance, UML,
// threat modelling, and the presentation shapes decks still faked. ═══════════

// ─── neuralnet (layered neural network) ─────────────────────────────────────
// One column per layer, left to right. `units` is the real width of the layer;
// the renderer draws at most `maxUnits` circles per layer and marks the rest
// with an ellipsis, so a 784-unit input still reads as one column. Every
// consecutive pair of layers is dense-connected unless the layer says
// `connect: none` (residual and attention blocks name their own wiring in
// prose). `kind` picks the glyph/tint; `activation` prints under the label.
const neuralLayerSchema = z
  .object({
    label: z.string(),
    units: num.optional(),
    kind: z.enum(['input', 'dense', 'conv', 'pool', 'recurrent', 'embedding', 'attention', 'norm', 'dropout', 'output']).optional(),
    activation: z.string().optional(),
    note: z.string().optional(),
    connect: z.enum(['dense', 'none']).optional(),
  })
  .strict();
export const neuralnetSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    layers: z.array(neuralLayerSchema).min(2),
    /** Circles drawn per layer before the ellipsis (default 6). */
    maxUnits: num.optional(),
    /** Total parameter count, printed in the footer when given. */
    params: z.string().optional(),
  })
  .strict();

// ─── modelcard (ML model card) ──────────────────────────────────────────────
// The Mitchell et al. model-card sections as a card: identity, intended use,
// training data, metrics per split, limitations, license.
const modelMetricSchema = z
  .object({
    name: z.string(),
    value: z.union([z.string(), num]),
    split: z.string().optional(),
    note: z.string().optional(),
  })
  .strict();
export const modelcardSchema = z
  .object({
    name: z.string(),
    version: z.string().optional(),
    task: z.string().optional(),
    architecture: z.string().optional(),
    params: z.string().optional(),
    owner: z.string().optional(),
    license: z.string().optional(),
    description: z.string().optional(),
    intendedUse: z.array(z.string()).optional(),
    outOfScope: z.array(z.string()).optional(),
    trainingData: z.array(z.string()).optional(),
    metrics: z.array(modelMetricSchema).optional(),
    limitations: z.array(z.string()).optional(),
    ethics: z.array(z.string()).optional(),
  })
  .strict();

// ─── mindmap (radial idea map) ──────────────────────────────────────────────
// One `center`, branches by `parent`. Depth-1 branches fan out around the
// centre alternating right/left; deeper nodes hang off their branch. Accent
// per branch is inherited by its subtree.
const mindmapNodeSchema = z
  .object({
    id: z.string(),
    parent: z.string().optional(),
    label: z.string(),
    note: z.string().optional(),
    accent: accentEnum.optional(),
  })
  .strict();
export const mindmapSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    center: z.string(),
    nodes: z.array(mindmapNodeSchema).min(1),
  })
  .strict();

// ─── audit (findings register) ──────────────────────────────────────────────
// One row per finding, severity-ranked; the header strip counts findings per
// severity. `evidence` is what was observed (a path, a query, a screenshot
// reference), `fix` the recommended change. The twin of `risk` for what IS
// wrong rather than what MIGHT go wrong.
const auditFindingSchema = z
  .object({
    id: z.string().optional(),
    title: z.string(),
    severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
    area: z.string().optional(),
    evidence: z.string().optional(),
    fix: z.string().optional(),
    owner: z.string().optional(),
    status: z.enum(['open', 'fixing', 'fixed', 'accepted', 'wontfix']).optional(),
    ref: z.string().optional(),
  })
  .strict();
export const auditSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    scope: z.string().optional(),
    date: z.string().optional(),
    auditor: z.string().optional(),
    findings: z.array(auditFindingSchema).min(1),
  })
  .strict();

// ─── checklist (pass / fail with evidence) ──────────────────────────────────
// Items grouped under optional headings; each carries a verdict and the
// evidence behind it. The footer derives pass / fail / n/a counts and the
// pass rate over the items that apply. `[pass] item — evidence` is the terse
// form.
const checklistItemSchema = z
  .object({
    item: z.string(),
    status: z.enum(['pass', 'fail', 'partial', 'na', 'pending']),
    evidence: z.string().optional(),
    note: z.string().optional(),
    ref: z.string().optional(),
  })
  .strict();
const checklistGroupSchema = z
  .object({
    label: z.string(),
    items: z.array(checklistItemSchema).min(1),
  })
  .strict();
export const checklistSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    standard: z.string().optional(),
    items: z.array(checklistItemSchema).optional(),
    groups: z.array(checklistGroupSchema).optional(),
  })
  .strict();

// ─── perfbudget (performance budgets vs measured) ───────────────────────────
// One row per metric: the budget, the measured value, and a bar of measured
// against budget. `lowerIsBetter` defaults to true (latency, bytes, CLS);
// set it false for scores and throughput. Status derives: over budget →
// fail, within 90% → warn, else pass.
const perfMetricSchema = z
  .object({
    metric: z.string(),
    budget: num,
    measured: num,
    unit: z.string().optional(),
    lowerIsBetter: z.boolean().optional(),
    note: z.string().optional(),
  })
  .strict();
export const perfbudgetSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    context: z.string().optional(),
    metrics: z.array(perfMetricSchema).min(1),
  })
  .strict();

// ─── percentiles (latency distribution per row) ─────────────────────────────
// One row per endpoint/series with its p50 · p90 · p95 · p99 (and optional
// p999 and max) on a shared axis; the SLO line is drawn when `slo` is set on
// the block or the row. Reads as a dot-and-whisker plot: the eye sees the
// tail, not just the median.
const percentileRowSchema = z
  .object({
    label: z.string(),
    p50: num,
    p90: num.optional(),
    p95: num.optional(),
    p99: num,
    p999: num.optional(),
    max: num.optional(),
    slo: num.optional(),
    accent: accentEnum.optional(),
  })
  .strict();
export const percentilesSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    unit: z.string().optional(),
    slo: num.optional(),
    /** `log` spreads a long tail; default linear. */
    scale: z.enum(['linear', 'log']).optional(),
    rows: z.array(percentileRowSchema).min(1),
  })
  .strict();

// ─── usecase (UML use-case diagram) ─────────────────────────────────────────
// Actors outside the system boundary, use cases (ovals) inside it. `links`
// join actors to cases; `relations` join cases to cases with `include`,
// `extend`, or `generalize`. Terse: `actor -> case` and `a ..> b: include`.
const usecaseActorSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    kind: z.enum(['person', 'system', 'time']).optional(),
    side: z.enum(['left', 'right']).optional(),
  })
  .strict();
const usecaseCaseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    note: z.string().optional(),
  })
  .strict();
const usecaseLinkSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
  })
  .strict();
const usecaseRelSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    kind: z.enum(['include', 'extend', 'generalize']),
    label: z.string().optional(),
  })
  .strict();
export const usecaseSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    system: z.string().optional(),
    actors: z.array(usecaseActorSchema).min(1),
    cases: z.array(usecaseCaseSchema).min(1),
    links: z.array(usecaseLinkSchema).optional(),
    relations: z.array(usecaseRelSchema).optional(),
  })
  .strict();

// ─── pkg (UML package diagram) ──────────────────────────────────────────────
// Packages as tabbed folders on a grid, optionally nested by `parent`;
// `contains` lists the members printed inside. `deps` are dashed
// dependency arrows (`import`, `use`, `access`, `merge`).
const pkgNodeSchema = z
  .object({
    id: z.string(),
    col: gridCoord.optional(),
    row: gridCoord.optional(),
    name: z.string(),
    parent: z.string().optional(),
    contains: z.array(z.string()).optional(),
    stereotype: z.string().optional(),
  })
  .strict();
const pkgDepSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    kind: z.enum(['import', 'use', 'access', 'merge']).optional(),
    label: z.string().optional(),
  })
  .strict();
export const pkgSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    dir: gridDirSchema,
    packages: z.array(pkgNodeSchema).min(1),
    deps: z.array(pkgDepSchema).optional(),
  })
  .strict();

// ─── timing (UML timing diagram) ────────────────────────────────────────────
// One lane per lifeline; each lane is a step line of `states` over a shared
// time axis (`from` … `to` in `unit`). `events` mark instants with a label;
// `constraints` draw a duration bracket between two times.
const timingStateSchema = z
  .object({
    state: z.string(),
    from: num,
    to: num,
    accent: accentEnum.optional(),
  })
  .strict();
const timingLaneSchema = z
  .object({
    label: z.string(),
    states: z.array(timingStateSchema).min(1),
  })
  .strict();
const timingEventSchema = z
  .object({
    at: num,
    label: z.string(),
    lane: z.string().optional(),
  })
  .strict();
const timingConstraintSchema = z
  .object({
    from: num,
    to: num,
    label: z.string(),
  })
  .strict();
export const timingSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    unit: z.string().optional(),
    lanes: z.array(timingLaneSchema).min(1),
    events: z.array(timingEventSchema).optional(),
    constraints: z.array(timingConstraintSchema).optional(),
  })
  .strict();

// ─── threatmodel (data flow with trust boundaries + STRIDE table) ───────────
// The dfd shapes (process / external / store) plus `boundaries` drawn as
// dashed trust boundaries, and a `threats` table under the drawing keyed to
// nodes or edges by `target`. `category` is the STRIDE letter.
const threatNodeSchema = z
  .object({
    id: z.string(),
    col: gridCoord.optional(),
    row: gridCoord.optional(),
    name: z.string(),
    kind: z.enum(['process', 'external', 'store']).optional(),
  })
  .strict();
const threatEdgeSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
    /** `plain` draws the edge red-dashed as an unencrypted hop. */
    channel: z.enum(['tls', 'plain', 'internal']).optional(),
  })
  .strict();
const threatSchema = z
  .object({
    id: z.string().optional(),
    target: z.string(),
    category: z.enum(['S', 'T', 'R', 'I', 'D', 'E']),
    threat: z.string(),
    mitigation: z.string().optional(),
    severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    status: z.enum(['open', 'mitigated', 'accepted']).optional(),
  })
  .strict();
export const threatmodelSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    dir: gridDirSchema,
    boundaries: z.array(gridGroupSchema).optional(),
    nodes: z.array(threatNodeSchema).min(1),
    edges: z.array(threatEdgeSchema).optional(),
    threats: z.array(threatSchema).optional(),
  })
  .strict();

// ─── chevrons (process chevron strip) ───────────────────────────────────────
// The consulting process strip: N chevrons left to right, one `current`
// highlighted, an optional line of detail under each. Up to 8 read in one
// row; more wrap.
const chevronStepSchema = z
  .object({
    label: z.string(),
    desc: z.string().optional(),
    accent: accentEnum.optional(),
  })
  .strict();
export const chevronsSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    steps: z.array(chevronStepSchema).min(2),
    /** 1-based index of the highlighted step. */
    current: num.optional(),
  })
  .strict();

// ─── roadmap (themes × periods) ─────────────────────────────────────────────
// Coarser than gantt: one row per theme (a team, a product area), one column
// per period (quarter, month), items as chips in the cell that spans
// `from` … `to` periods. Status tints the chip.
const roadmapItemSchema = z
  .object({
    label: z.string(),
    theme: z.string(),
    from: z.string(),
    to: z.string().optional(),
    status: z.enum(['done', 'current', 'next', 'later', 'risk']).optional(),
    note: z.string().optional(),
  })
  .strict();
export const roadmapSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    periods: z.array(z.string()).min(2),
    themes: z.array(z.string()).optional(),
    items: z.array(roadmapItemSchema).min(1),
    /** The period the reader is in; drawn as a vertical rule. */
    now: z.string().optional(),
  })
  .strict();

/**
 * The schema map. `as const satisfies Record<BlockType, ...>` enforces that
 * every {@link BlockType} has an entry — omitting one is a compile error.
 */
export const blockSchemas = {
  meta: metaSchema,
  callout: calloutSchema,
  table: tableSchema,
  sequence: sequenceSchema,
  erd: erdSchema,
  userstory: userstorySchema,
  timeline: timelineSchema,
  kanban: kanbanSchema,
  prose: proseSchema,
  glossary: glossarySchema,
  proscons: prosconsSchema,
  cvt: cvtSchema,
  stats: statsSchema,
  code: codeSchema,
  agenda: agendaSchema,
  tree: treeSchema,
  pyramid: pyramidSchema,
  flow: flowSchema,
  state: stateSchema,
  dfd: dfdSchema,
  journey: journeySchema,
  gantt: ganttSchema,
  graph: graphSchema,
  quadrant: quadrantSchema,
  swimlane: swimlaneSchema,
  c4: c4Schema,
  uml: umlSchema,
  frontend: frontendSchema,
  cluster: clusterSchema,
  block: blockGraphSchema,
  felogic: felogicSchema,
  wireframe: wireframeSchema,
  endpoint: endpointSchema,
  pullquote: pullquoteSchema,
  layers: layersSchema,
  matrix: matrixSchema,
  anatomy: anatomySchema,
  composition: compositionSchema,
  drivers: driversSchema,
  options: optionsSchema,
  spec: specSchema,
  list: listSchema,
  stories: storiesSchema,
  pattern: patternSchema,
  gallery: gallerySchema,
  chart: chartSchema,
  figure: figureSchema,
  steps: stepsSchema,
  faq: faqSchema,
  envelope: envelopeSchema,
  slo: sloSchema,
  swot: swotSchema,
  okr: okrSchema,
  persona: personaSchema,
  changelog: changelogSchema,
  team: teamSchema,
  heatmap: heatmapSchema,
  scorecard: scorecardSchema,
  risk: riskSchema,
  palette: paletteSchema,
  typescale: typescaleSchema,
  dodont: dodontSchema,
  inventory: inventorySchema,
  array: arraySchema,
  linkedlist: linkedlistSchema,
  bintree: bintreeSchema,
  hashmap: hashmapSchema,
  agentloop: agentloopSchema,
  trace: traceSchema,
  prompt: promptSchema,
  context: contextSchema,
  archmap: archmapSchema,
  divider: dividerSchema,
  bignumber: bignumberSchema,
  takeaways: takeawaysSchema,
  statustable: statustableSchema,
  cycle: cycleSchema,
  benchmark: benchmarkSchema,
  sankey: sankeySchema,
  gitgraph: gitgraphSchema,
  treemap: treemapSchema,
  packet: packetSchema,
  venn: vennSchema,
  wardley: wardleySchema,
  harvey: harveySchema,
  scqa: scqaSchema,
  scenarios: scenariosSchema,
  fishbone: fishboneSchema,
  storymap: storymapSchema,
  eventcontract: eventcontractSchema,
  saga: sagaSchema,
  slopegraph: slopegraphSchema,
  spans: spansSchema,
  rollout: rolloutSchema,
  neuralnet: neuralnetSchema,
  modelcard: modelcardSchema,
  mindmap: mindmapSchema,
  audit: auditSchema,
  checklist: checklistSchema,
  perfbudget: perfbudgetSchema,
  percentiles: percentilesSchema,
  usecase: usecaseSchema,
  pkg: pkgSchema,
  timing: timingSchema,
  threatmodel: threatmodelSchema,
  chevrons: chevronsSchema,
  roadmap: roadmapSchema,
} as const satisfies Record<BlockType, z.ZodTypeAny>;

/** Per-block data types, derived from the schemas above. */
export type BlockDataMap = {
  [K in BlockType]: z.infer<(typeof blockSchemas)[K]>;
};
