/**
 * Graph lints — what a diagram's data says that its drawing hides.
 *
 * Pure analysis, no I/O: takes a {@link Document}, returns {@link Diagnostic}s
 * (always level `warn`). Each check reads the block data the renderer reads,
 * and each one errs toward silence — a false positive is a bug:
 *
 * - `W_ORPHAN_NODE` — a node that no edge touches, in a block that has edges.
 *   In a placement view (`block`, `c4`, `felogic`, `threatmodel`) a node
 *   inside a group panel is placed on purpose (a NAT gateway in its subnet)
 *   and is not reported.
 * - `W_EMPTY_GROUP` — a group panel whose cells hold no node. Checked only
 *   when every node carries `col` and `row`, so the cells are known.
 * - `W_DUP_EDGE` — the same `from`, `to`, and label written twice.
 * - `W_DECISION_LABEL` — a decision with two or more branches, one of them
 *   unlabelled: the reader cannot tell which answer takes which branch.
 * - `W_ERROR_INTO_SUCCESS` — a `flow` whose success and failure ends are
 *   mixed up: an end that reads as success is reached only by error edges, an
 *   end that reads as a failure is reached by no error edge (so it draws as
 *   the happy path), or an error edge joins the success end while another end
 *   exists.
 * - `W_IDLE_ACTOR` — a `sequence` actor that sends and receives nothing.
 *
 * Every finding names the item and its data path, and the hint says the fix
 * in the block's own data.
 */

import type { Diagnostic, DiagnosticCode } from './diagnostics.js';
import { isDialectSource } from './dialects.js';
import type { BlockType, Document, TypedSegment } from './types.js';
import { locateYamlPath } from './yaml.js';

/** How one diagram type stores its graph. */
interface GraphShape {
  /** List field of the nodes (`nodes`, `states`, `steps`, …). */
  readonly nodes: string;
  /** Field that names a node on the drawing. */
  readonly name: string;
  /** List field of the edges (`edges`, `transitions`, `links`, …). */
  readonly edges: string;
  /** Field that labels an edge. */
  readonly edgeLabel: string;
  /** Nouns for the messages. */
  readonly node: string;
  readonly edge: string;
  /** List field of the cell-anchored group panels, when the type has them. */
  readonly groups?: string;
  /** Report nodes no edge touches. */
  readonly orphans: boolean;
  /** A placement view: a node inside a group panel is placed, never orphaned. */
  readonly placement?: boolean;
  /** Node kind that marks a decision (its branches must be labelled). */
  readonly decision?: string;
}

/** The diagram types these lints read. */
const GRAPHS: Readonly<Partial<Record<BlockType, GraphShape>>> = {
  flow: {
    nodes: 'nodes', name: 'label', edges: 'edges', edgeLabel: 'label', node: 'node', edge: 'edge',
    groups: 'groups', orphans: true, decision: 'decision',
  },
  state: {
    nodes: 'states', name: 'name', edges: 'transitions', edgeLabel: 'event', node: 'state', edge: 'transition',
    groups: 'groups', orphans: true,
  },
  dfd: {
    nodes: 'nodes', name: 'name', edges: 'edges', edgeLabel: 'label', node: 'node', edge: 'flow',
    groups: 'groups', orphans: true,
  },
  swimlane: {
    nodes: 'steps', name: 'label', edges: 'links', edgeLabel: 'label', node: 'step', edge: 'link',
    orphans: true, decision: 'decision',
  },
  block: {
    nodes: 'nodes', name: 'name', edges: 'edges', edgeLabel: 'label', node: 'node', edge: 'edge',
    groups: 'groups', orphans: true, placement: true,
  },
  c4: {
    nodes: 'nodes', name: 'name', edges: 'edges', edgeLabel: 'label', node: 'node', edge: 'relationship',
    groups: 'groups', orphans: true, placement: true,
  },
  felogic: {
    nodes: 'nodes', name: 'name', edges: 'edges', edgeLabel: 'label', node: 'node', edge: 'edge',
    groups: 'groups', orphans: true, placement: true,
  },
  threatmodel: {
    nodes: 'nodes', name: 'name', edges: 'edges', edgeLabel: 'label', node: 'node', edge: 'flow',
    groups: 'boundaries', orphans: true, placement: true,
  },
  // Every service sits in a cluster (placement), and an algorithm graph or a
  // package map may show a node alone on purpose: duplicates only.
  cluster: {
    nodes: 'services', name: 'label', edges: 'edges', edgeLabel: 'label', node: 'service', edge: 'edge',
    orphans: false,
  },
  graph: {
    nodes: 'nodes', name: 'label', edges: 'edges', edgeLabel: 'label', node: 'node', edge: 'edge',
    orphans: false,
  },
  pkg: {
    nodes: 'packages', name: 'name', edges: 'deps', edgeLabel: 'label', node: 'package', edge: 'dependency',
    orphans: false,
  },
};

type Rec = Record<string, unknown>;

function isRecord(v: unknown): v is Rec {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/** A single-line, trimmed display form of a label (`\n` line breaks become spaces). */
function shown(v: string): string {
  return v.replace(/\\n|\n/g, ' ').replace(/\s+/g, ' ').trim();
}

/** The records of a list field (anything else is skipped, never thrown on). */
function items(data: Rec, field: string): { item: Rec; index: number }[] {
  const list = data[field];
  if (!Array.isArray(list)) return [];
  const out: { item: Rec; index: number }[] = [];
  list.forEach((item, index) => {
    if (isRecord(item)) out.push({ item, index });
  });
  return out;
}

/** An edge as these lints read it. */
interface Edge {
  readonly from: string;
  readonly to: string;
  readonly label: string;
  readonly kind: string | undefined;
  readonly index: number;
}

function edgesOf(data: Rec, shape: GraphShape): Edge[] {
  const out: Edge[] = [];
  for (const { item, index } of items(data, shape.edges)) {
    const from = str(item['from']);
    const to = str(item['to']);
    if (from === undefined || to === undefined) continue;
    out.push({ from, to, label: shown(str(item[shape.edgeLabel]) ?? ''), kind: str(item['kind']), index });
  }
  return out;
}

/** `from -> to: label` in the terse form, with the arrow of its kind (`-x->` error, `-->` dashed). */
function edgeText(e: Edge): string {
  const arrow = e.kind === 'error' ? '-x->' : e.kind === 'dashed' ? '-->' : '->';
  return `${e.from} ${arrow} ${e.to}${e.label === '' ? '' : `: ${e.label}`}`;
}

/** A cell rectangle (inclusive), 1-based like the schema. */
interface Cells {
  readonly c0: number;
  readonly c1: number;
  readonly r0: number;
  readonly r1: number;
}

function groupCells(g: Rec): Cells | undefined {
  const col = num(g['col']);
  const row = num(g['row']);
  if (col === undefined || row === undefined) return undefined;
  return { c0: col, c1: col + (num(g['cols']) ?? 1) - 1, r0: row, r1: row + (num(g['rows']) ?? 1) - 1 };
}

function nodeCells(n: Rec): Cells | undefined {
  const col = num(n['col']);
  const row = num(n['row']);
  if (col === undefined || row === undefined) return undefined;
  return { c0: col, c1: col + (num(n['w']) ?? 1) - 1, r0: row, r1: row + (num(n['h']) ?? 1) - 1 };
}

function overlaps(a: Cells, b: Cells): boolean {
  return a.c0 <= b.c1 && b.c0 <= a.c1 && a.r0 <= b.r1 && b.r0 <= a.r1;
}

/** Collects the findings of one block, with their item paths. */
class Findings {
  readonly out: Diagnostic[] = [];
  constructor(
    private readonly seg: TypedSegment,
    private readonly file: string,
  ) {}

  push(code: DiagnosticCode, path: ReadonlyArray<string | number>, message: string, hint: string, value: string): void {
    // A dialect body (mermaid) has no YAML positions; its findings sit on the fence.
    const loc = isDialectSource(this.seg.sourceType) ? undefined : locateYamlPath(this.seg.raw, path);
    this.out.push({
      file: this.file,
      ...(loc !== undefined ? { line: this.seg.line + loc.line, column: loc.column } : { line: this.seg.line }),
      level: 'warn',
      code,
      message: `${this.seg.sourceType ?? this.seg.kind}: ${message}`,
      hint,
      value,
    });
  }
}

/** Whole-label patterns for the ends of a flow (word-bounded, case-insensitive). */
const SUCCESS_WORDS =
  /\b(?:done|success|successful|succeeded|complete|completed|confirmed|approved|accepted|ok|sent|delivered|paid|shipped|merged|stored|created|released|resolved|finished|saved|fulfilled|answered|2\d\d)\b/i;
const FAILURE_WORDS =
  /\b(?:not|no|never|fail|fails|failed|failure|reject|rejected|refuse|refused|denied|deny|error|errors|cancel|cancelled|canceled|abort|aborted|timeout|timed out|dlq|dead[- ]letter|blocked|invalid|declined|expired|[45]\d\d)\b/i;
/** The renderer's own reading of a failure branch or exit (`flow.ts`). */
const RENDER_ERR_LABEL = /^(?:no|fail|failed|error|reject|rejected)\b/i;

function lintOrphans(f: Findings, data: Rec, shape: GraphShape, edges: readonly Edge[]): void {
  if (!shape.orphans || edges.length === 0) return;
  const touched = new Set<string>();
  for (const e of edges) {
    touched.add(e.from);
    touched.add(e.to);
  }
  const groups = shape.groups !== undefined ? items(data, shape.groups) : [];
  const panels = groups.map((g) => groupCells(g.item)).filter((c): c is Cells => c !== undefined);
  const groupIds = new Set(groups.map((g) => str(g.item['id'])).filter((s): s is string => s !== undefined));
  // A c4 boundary lists its members by id: membership is placement too.
  const members = new Set<string>();
  for (const { item } of items(data, 'boundaries')) {
    const list = item['nodes'];
    if (Array.isArray(list)) for (const m of list) if (typeof m === 'string') members.add(m);
  }
  for (const { item, index } of items(data, shape.nodes)) {
    const id = str(item['id']);
    const name = str(item[shape.name]);
    if (id === undefined) continue;
    if (touched.has(id) || (name !== undefined && touched.has(name)) || groupIds.has(id)) continue;
    if (shape.placement === true) {
      if (members.has(id)) continue;
      const cells = nodeCells(item);
      if (cells !== undefined && panels.some((p) => overlaps(p, cells))) continue;
    }
    const what = name !== undefined && shown(name) !== id ? `"${shown(name)}" (${id})` : `"${id}"`;
    f.push(
      'W_ORPHAN_NODE',
      [shape.nodes, index],
      `the ${shape.node} ${what} has no ${shape.edge}; every other ${shape.node} connects`,
      `Add the ${shape.edge} that reaches it (for example \`${id} -> …\` in \`${shape.edges}\`), or delete the ${shape.node}.`,
      id,
    );
  }
}

function lintEmptyGroups(f: Findings, data: Rec, shape: GraphShape): void {
  if (shape.groups === undefined) return;
  const groups = items(data, shape.groups);
  if (groups.length === 0) return;
  const nodes = items(data, shape.nodes);
  if (nodes.length === 0) return;
  const cells: Cells[] = [];
  for (const { item } of nodes) {
    const c = nodeCells(item);
    // Auto-layout places a node with no cell: the group's content is unknown.
    if (c === undefined) return;
    cells.push(c);
  }
  for (const { item, index } of groups) {
    const panel = groupCells(item);
    if (panel === undefined || cells.some((c) => overlaps(panel, c))) continue;
    const label = shown(str(item['label']) ?? str(item['id']) ?? `#${String(index + 1)}`);
    const span =
      panel.c0 === panel.c1 && panel.r0 === panel.r1
        ? `cell col ${String(panel.c0)}, row ${String(panel.r0)}`
        : `cols ${String(panel.c0)}–${String(panel.c1)}, rows ${String(panel.r0)}–${String(panel.r1)}`;
    f.push(
      'W_EMPTY_GROUP',
      [shape.groups, index],
      `the group "${label}" (${span}) holds no node`,
      'Move a node into its cells, widen it with `cols`/`rows`, or delete the group.',
      label,
    );
  }
}

function lintDuplicateEdges(f: Findings, shape: GraphShape, edges: readonly Edge[]): void {
  const seen = new Set<string>();
  for (const e of edges) {
    const key = `${e.from}\u0000${e.to}\u0000${e.label.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      continue;
    }
    f.push(
      'W_DUP_EDGE',
      [shape.edges, e.index],
      `the ${shape.edge} \`${edgeText(e)}\` is written twice`,
      `Delete the copy at \`${shape.edges}.${String(e.index)}\`. To show two different flows between the same ${shape.node}s, give each one its own label.`,
      edgeText(e),
    );
  }
}

function lintDecisions(f: Findings, data: Rec, shape: GraphShape, edges: readonly Edge[]): void {
  if (shape.decision === undefined) return;
  for (const { item, index } of items(data, shape.nodes)) {
    if (item['kind'] !== shape.decision) continue;
    const id = str(item['id']);
    if (id === undefined) continue;
    const out = edges.filter((e) => e.from === id);
    const bare = out.filter((e) => e.label === '');
    if (out.length < 2 || bare.length === 0) continue;
    const name = shown(str(item[shape.name]) ?? id);
    const first = bare[0] as Edge;
    f.push(
      'W_DECISION_LABEL',
      [shape.nodes, index],
      `the decision "${name}" has ${String(out.length)} branches and ${String(bare.length)} without a label (${bare.map(edgeText).join(', ')})`,
      `Label each branch with the answer that takes it: \`${first.from} -> ${first.to}: <answer>\`.`,
      name,
    );
  }
}

function lintFlowEnds(f: Findings, data: Rec, shape: GraphShape, edges: readonly Edge[]): void {
  const nodes = items(data, shape.nodes);
  const ends = nodes.filter(({ item }) => item['kind'] === 'end' && str(item['id']) !== undefined);
  if (ends.length < 2) return;
  // The renderer's reading: an error edge is `kind: error` (`-x->`) or a
  // label like "no" / "fail".
  const isErr = (e: Edge): boolean => e.kind === 'error' || RENDER_ERR_LABEL.test(e.label);
  for (const { item, index } of ends) {
    const id = str(item['id']) as string;
    const label = shown(str(item[shape.name]) ?? id);
    const into = edges.filter((e) => e.to === id);
    if (into.length === 0) continue;
    const err = into.filter(isErr);
    const success = SUCCESS_WORDS.test(label) && !FAILURE_WORDS.test(label);
    const failure = FAILURE_WORDS.test(label) && !RENDER_ERR_LABEL.test(label);
    if (err.length === into.length && success) {
      f.push(
        'W_ERROR_INTO_SUCCESS',
        [shape.nodes, index],
        `the end "${label}" reads as success, but only error edges reach it (${err.map(edgeText).join(', ')})`,
        'Change the edge into it to a plain `->`, or point the error edge at the failure end.',
        label,
      );
    } else if (err.length === 0 && failure) {
      f.push(
        'W_ERROR_INTO_SUCCESS',
        [shape.nodes, index],
        `the end "${label}" reads as a failure, but no error edge reaches it, so it draws as the happy path`,
        `Write the edge into it as an error edge (\`${(into[0] as Edge).from} -x-> ${id}\`).`,
        label,
      );
    } else if (err.length > 0 && err.length < into.length) {
      f.push(
        'W_ERROR_INTO_SUCCESS',
        [shape.nodes, index],
        `the error edge \`${edgeText(err[0] as Edge)}\` joins the end "${label}", which the other paths reach as success`,
        'Point the error edge at its own failure end (`kind: end`), so the reader sees where the failure stops.',
        label,
      );
    }
  }
}

function lintIdleActors(f: Findings, data: Rec): void {
  const messages = items(data, 'messages');
  const used = new Set<string>();
  for (const { item } of messages) {
    const from = str(item['from']);
    const to = str(item['to']);
    if (from !== undefined) used.add(from);
    if (to !== undefined) used.add(to);
  }
  if (used.size === 0) return;
  for (const { item, index } of items(data, 'actors')) {
    const id = str(item['id']);
    const name = str(item['name']);
    if (id === undefined) continue;
    if (used.has(id) || (name !== undefined && used.has(name))) continue;
    const what = name !== undefined && name !== id ? `"${shown(name)}" (${id})` : `"${id}"`;
    f.push(
      'W_IDLE_ACTOR',
      ['actors', index],
      `the actor ${what} sends and receives no message`,
      `Add the message it takes part in (\`${id} -> …\`), or delete the actor.`,
      id,
    );
  }
}

/**
 * Runs every graph lint over the document's diagrams. Returns warnings only;
 * never throws on odd data (a block that failed to parse is skipped — its
 * error comes from `validateDocument`).
 *
 * @param doc - The parsed document.
 * @param file - The file path to use in diagnostics.
 */
export function lintGraphs(doc: Document, file: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const seg of doc.segments) {
    if (seg.kind === 'markdown' || seg.parseError !== undefined || !isRecord(seg.data)) continue;
    const f = new Findings(seg, file);
    const data = seg.data;
    if (seg.kind === 'sequence') {
      lintIdleActors(f, data);
    } else {
      const shape = GRAPHS[seg.kind];
      if (shape === undefined) continue;
      const edges = edgesOf(data, shape);
      lintOrphans(f, data, shape, edges);
      lintEmptyGroups(f, data, shape);
      lintDuplicateEdges(f, shape, edges);
      lintDecisions(f, data, shape, edges);
      if (seg.kind === 'flow') lintFlowEnds(f, data, shape, edges);
    }
    out.push(...f.out);
  }
  return out;
}
