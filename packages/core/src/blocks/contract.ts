/**
 * The block contract as text — what an agent reads instead of a hand-written
 * reference file. Everything here is derived from the zod schema through
 * {@link describeBlockSchema}, so it cannot drift from what `validateDocument`
 * enforces. The terse spellings are the one hand-written table: they describe
 * the input sugar in `normalize.ts`, which the schema never sees.
 *
 * Pure: strings in, strings out. The CLI prints it (`chiltepin block <type>`), the
 * MCP server can serve it, tests pin it against the grammar table.
 */

import { BLOCK_ALIASES } from './aliases.js';
import { BLOCK_DESCRIPTIONS, BLOCK_FAMILY, templateBody } from './catalog.js';
import { describeBlockSchema, type FieldNode } from './introspect.js';
import { hasTerseGrammar, textBodyData } from './normalize.js';
import type { BlockType } from '../types.js';

/** Fields every block may carry; listed once, not per field. */
const COMMON_FIELDS: readonly string[] = ['id', 'title', 'description', 'lede'];

/**
 * The terse one-line spellings, keyed `field` or `parent.child` exactly as the
 * grammar table in `normalize.ts` keys them. A test asserts the two tables
 * name the same list fields, so a new grammar cannot ship without its hint.
 */
export const TERSE_HINTS: Partial<Record<BlockType, Readonly<Record<string, string>>>> = {
  sequence: {
    messages:
      "`from -> to: label` — `->` sync · `-->` response · `-x->` error · `-> +to` opens an activation bar on `to`, `--> -to` closes the sender's · frames: `alt: guard` · `opt` · `loop` · `par` · `break` · `critical` open one, `else: guard` branches it, a bare `end` closes it",
  },
  erd: {
    relations:
      "`users ||--o{ orders: places` — crow's-foot `||--||` 1:1 · `||--o{` 1:N · `}o--||` N:1 · `}o--o{` N:M · `||--o|` 0..1; `..` body = non-identifying; plain `a -> b: label` = no cardinality",
    'entities.columns':
      '`name type [pk] [fk -> table.col] [unique] [!null] [index] [default=x] [enum(a,b)]` — e.g. `id uuid pk`, `email text unique !null`',
  },
  flow: {
    edges: '`from -> to: label` — `->` solid · `-->` dashed · `-x->` error',
    nodes: '`id: Label` — or a bare `Label` (id and label alike)',
  },
  graph: {
    edges: '`from -> to: label` — `->` solid · `-->` dashed · `-x->` error',
    nodes: '`id: Label` — or a bare `Label`',
  },
  block: {
    edges: '`from -> to: label` — `->` solid · `-->` dashed · `-x->` error · a leading `3. ` sets `step`',
    nodes: '`id: Name` — or a bare `Name`',
  },
  state: {
    transitions: '`from -> to: event` — the label is the event',
    states: '`id: Name` — or a bare `Name`',
  },
  dfd: {
    edges: '`from -> to: label`',
    nodes: '`id: Name` — or a bare `Name`',
  },
  swimlane: {
    links: '`from -> to: label` — `->` solid · `-->` dashed · `-x->` error',
    lanes: 'a bare `Label` per lane',
    steps: '`id: Label · Lane` — or `id: Label · Lane · kind`; the lane is its label',
  },
  c4: { edges: '`from -> to: label` — `->` solid · `-->` dashed · `-x->` error' },
  cluster: { edges: '`from -> to: label` — `->` solid · `-->` dashed · `-x->` error' },
  stats: { stats: '`label · value · delta?` — trend is inferred from the delta sign' },
  team: { members: '`name · role? · focus?`' },
  agenda: {
    items: '`[time ·] [duration ·] title [— desc]` — e.g. `09:00 · 20m · Standup — round robin`',
  },
  okr: { 'items.krs': '`[status] kr · progress` — the `[status]` bracket is optional' },
  timeline: {
    items:
      '`[status] date · label · desc` — `[status]` optional; 1 part = label, 2 = date · label, 3 = date · label · desc',
  },
  eventcontract: {
    schema: '`name type [required] — desc`',
    headers: '`name type [required] — desc`',
    errors: '`name — when`',
  },
  saga: {
    steps:
      '`id: Name · service · compensate` — four parts give name · service · action · compensate',
  },
  spans: {
    spans:
      "`service/id: name · start · duration [· parent]` — start and duration in the block's unit",
  },
  rollout: {
    stages: '`[status] traffic% · name · duration — gate` — every part but the name is optional',
  },
  glossary: { terms: '`Term — definition` or `Term: definition`' },
  faq: { items: '`Question? — Answer`' },
  takeaways: { items: '`Lead — detail?`' },
  list: { items: '`Lead — detail?`' },
  steps: { items: '`Title — body?`' },
  kanban: { 'columns.cards': '`Title` or `Title · tag`' },
  checklist: {
    items: '`[pass|fail|partial|na|pending] item — evidence?`',
    'groups.items': '`[pass|fail|partial|na|pending] item — evidence?`',
  },
  mindmap: { nodes: '`id: label` (add `parent` and `accent` in the object form)' },
  usecase: { links: '`actor -> case` (relations between cases use the object form with `kind`)' },
  pkg: { deps: '`from -> to: label?` (add `kind` in the object form)' },
  threatmodel: {
    edges: '`from -> to: label?` (add `channel: plain` in the object form for an unencrypted hop)',
    nodes: '`id: name` (add `kind: external | store` in the object form)',
  },
};

/** True when a node is a scalar (prints inline). */
function isScalar(node: FieldNode): boolean {
  return (
    node.kind === 'string' ||
    node.kind === 'number' ||
    node.kind === 'boolean' ||
    node.kind === 'enum'
  );
}

/** One scalar field, inline: `name*`, `n(n)`, `flag(bool)`, `kind: a|b`. */
function scalar(name: string, node: FieldNode): string {
  const star = node.optional ? '' : '*';
  switch (node.kind) {
    case 'number': {
      const range =
        node.min !== undefined && node.max !== undefined
          ? `${node.min}..${node.max}`
          : node.min !== undefined
            ? `≥${node.min}`
            : node.max !== undefined
              ? `≤${node.max}`
              : '';
      return `${name}${star}(n${range === '' ? '' : ' ' + range})`;
    }
    case 'boolean':
      return `${name}${star}(bool)`;
    case 'enum':
      return `${name}${star}: ${node.options.join('|')}`;
    default:
      return `${name}${star}`;
  }
}

/** An anonymous node (an array element or a union arm), inline. */
function inlineNode(node: FieldNode): string {
  switch (node.kind) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'bool';
    case 'enum':
      return node.options.join('|');
    case 'array':
      return `[${inlineNode(node.element)}]`;
    case 'object':
      return `{ ${node.fields.map((f) => inlineField(f.name, f.node)).join(', ')} }`;
    case 'union':
      return node.arms.map(inlineNode).join(' | ');
    case 'opaque':
      return 'any';
  }
}

/** A named field, inline — used inside `{ … }` object literals. */
function inlineField(name: string, node: FieldNode): string {
  if (isScalar(node)) return scalar(name, node);
  const star = node.optional ? '' : '*';
  if (node.kind === 'array') return `${name}${star}[]: ${inlineNode(node.element)}`;
  return `${name}${star}: ${inlineNode(node)}`;
}

/** True when an object is small enough to print on one line. */
function fitsInline(node: FieldNode): boolean {
  if (node.kind !== 'object') return node.kind !== 'union' || node.arms.every(fitsInline);
  return node.fields.length <= 7 && node.fields.every((f) => isScalar(f.node));
}

/** Renders one field as lines at `indent`. */
function fieldLines(name: string, node: FieldNode, indent: string): string[] {
  const star = node.optional ? '' : '*';
  if (isScalar(node)) return [`${indent}${scalar(name, node)}`];
  if (node.kind === 'opaque') return [`${indent}${name}${star}: any YAML`];
  if (node.kind === 'array') {
    const el = node.element;
    const min = node.min !== undefined ? ` (≥${node.min})` : '';
    if (isScalar(el) || el.kind === 'opaque') {
      return [`${indent}${name}${star}[]${min}: ${inlineNode(el)}`];
    }
    if (el.kind === 'array')
      return [`${indent}${name}${star}[][]${min}: ${inlineNode(el.element)}`];
    if (fitsInline(el)) return [`${indent}${name}${star}[]${min}: ${inlineNode(el)}`];
    return [`${indent}${name}${star}[]${min}:`, ...bodyLines(el, indent + '  ')];
  }
  if (node.kind === 'object') {
    if (fitsInline(node)) return [`${indent}${name}${star}: ${inlineNode(node)}`];
    return [`${indent}${name}${star}:`, ...bodyLines(node, indent + '  ')];
  }
  // union
  if (fitsInline(node)) return [`${indent}${name}${star}: ${inlineNode(node)}`];
  return [`${indent}${name}${star}:`, ...bodyLines(node, indent + '  ')];
}

/** Packs consecutive scalar fields onto lines of at most `width` columns. */
function packScalars(
  fields: ReadonlyArray<{ name: string; node: FieldNode }>,
  indent: string,
): string[] {
  const width = 88;
  const out: string[] = [];
  let line = '';
  const flush = (): void => {
    if (line !== '') out.push(indent + line);
    line = '';
  };
  for (const f of fields) {
    if (!isScalar(f.node)) {
      flush();
      out.push(...fieldLines(f.name, f.node, indent));
      continue;
    }
    const piece = scalar(f.name, f.node);
    if (line !== '' && indent.length + line.length + 2 + piece.length > width) flush();
    line = line === '' ? piece : `${line}  ${piece}`;
  }
  flush();
  return out;
}

/** The lines inside an object or union, at `indent`. */
function bodyLines(node: FieldNode, indent: string): string[] {
  if (node.kind === 'object') return packScalars(node.fields, indent);
  if (node.kind === 'union') {
    return node.arms.flatMap((arm, i) => {
      const head = i === 0 ? 'one of:' : 'or:';
      if (fitsInline(arm)) return [`${indent}${head} ${inlineNode(arm)}`];
      return [`${indent}${head}`, ...bodyLines(arm, indent + '  ')];
    });
  }
  return [`${indent}${inlineNode(node)}`];
}

/**
 * The note on every `accent` field that takes the legacy colour names. The
 * skin reads the name as a flag, not a colour (`DESIGN.md` › Two channels):
 * one flagged item is the focus, `red` is the negative, and a flag on every
 * item marks nothing. Authors who read the names as a palette paint every
 * item, so the contract says it where they look.
 */
export const ACCENT_FIELD_NOTE =
  'Not a colour. On exactly one item it marks the focus; `red` marks the bad item.';

/** The note on a `statustable` status `color`: the names map onto pill styles, not hues. */
export const STATUS_COLOR_NOTE =
  'Not a hue: `green` (`success`) reads done, `amber` (`warn`) in progress, `red` (`error`) blocked, `gray` (`neutral`) to do; any other name draws an ink outline.';

/** The legacy accent names; an enum holding all of them is an accent or status colour. */
const ACCENT_NAMES: readonly string[] = ['navy', 'blue', 'teal', 'green', 'amber', 'purple', 'red', 'gray'];

/** The derived note for an enum field whose options are the accent names, if any. */
function accentNote(node: FieldNode, path: string): string | undefined {
  if (node.kind !== 'enum' || !ACCENT_NAMES.every((n) => node.options.includes(n))) return undefined;
  const field = path.slice(path.lastIndexOf('.') + 1);
  if (field === 'accent') return ACCENT_FIELD_NOTE;
  if (field === 'color' && node.options.includes('success')) return STATUS_COLOR_NOTE;
  return undefined;
}

/**
 * The schema's own field notes (`.describe('…')`), as `path → note`, with
 * paths spelled the way an author writes them (`nodes[].kind`), plus the
 * derived note on every accent-name enum ({@link ACCENT_FIELD_NOTE}). Fields
 * that share one note are joined (`groups[].color, layers[].color`).
 */
function fieldNotes(root: FieldNode): Array<{ readonly fields: string; readonly note: string }> {
  const found: Array<{ path: string; note: string }> = [];
  const walk = (node: FieldNode, path: string): void => {
    if (node.description !== undefined && path !== '') found.push({ path, note: node.description });
    else if (path !== '') {
      const derived = accentNote(node, path);
      if (derived !== undefined) found.push({ path, note: derived });
    }
    if (node.kind === 'object') for (const f of node.fields) walk(f.node, path === '' ? f.name : `${path}.${f.name}`);
    else if (node.kind === 'array') walk(node.element, `${path}[]`);
    else if (node.kind === 'union') for (const arm of node.arms) walk(arm, path);
  };
  walk(root, '');
  const byNote = new Map<string, string[]>();
  for (const f of found) {
    const paths = byNote.get(f.note) ?? [];
    if (!paths.includes(f.path)) paths.push(f.path);
    byNote.set(f.note, paths);
  }
  return [...byNote].map(([note, paths]) => ({ fields: paths.join(', '), note }));
}

/** The structured contract for one block type. */
export interface BlockContract {
  readonly type: BlockType;
  readonly family: string;
  readonly description: string;
  /** Field lines, indented with two spaces per level; common fields removed. */
  readonly fields: readonly string[];
  /** Which of the common optional fields (`id`, `title`, …) this block accepts. */
  readonly common: readonly string[];
  /** The schema's notes on free-string fields whose vocabulary the renderer owns. */
  readonly notes: ReadonlyArray<{ readonly fields: string; readonly note: string }>;
  /** Terse spellings for list fields that have one: `field → grammar`. */
  readonly terse: ReadonlyArray<{ readonly field: string; readonly grammar: string }>;
  /** Old spellings that map to this block, with the patch they inject. */
  readonly aliases: ReadonlyArray<{ readonly name: string; readonly patch: string }>;
  /** The field a bare-text body fills, when the block accepts plain text. */
  readonly textBody?: string;
  /** A minimal, validating example body (from the block templates). */
  readonly example: string;
}

/** Builds the contract for `type`. */
export function blockContract(type: BlockType): BlockContract {
  const root = describeBlockSchema(type);
  const fields: string[] = [];
  const common: string[] = [];
  if (root.kind === 'object') {
    for (const f of root.fields) {
      if (COMMON_FIELDS.includes(f.name) && f.node.kind === 'string' && f.node.optional) {
        common.push(f.name);
        continue;
      }
      fields.push(...fieldLines(f.name, f.node, '  '));
    }
  } else {
    fields.push(...bodyLines(root, '  '));
  }
  const hints = TERSE_HINTS[type] ?? {};
  const terse = Object.entries(hints).map(([field, grammar]) => ({ field, grammar }));
  const aliases = Object.entries(BLOCK_ALIASES)
    .filter(([, def]) => def.type === type)
    .map(([name, def]) => ({
      name,
      patch: Object.entries(def.patch ?? {})
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join(', '),
    }));
  const text = textBodyData(type, 'probe');
  const textBody = text === undefined ? undefined : Object.keys(text)[0];
  return {
    type,
    family: BLOCK_FAMILY[type],
    description: BLOCK_DESCRIPTIONS[type],
    fields,
    common,
    notes: fieldNotes(root),
    terse,
    aliases,
    ...(textBody !== undefined ? { textBody } : {}),
    example: templateBody(type),
  };
}

/**
 * The contract as the text `chiltepin block <type>` prints: what the block is, its
 * fields, the terse forms, and one validating example — about forty lines.
 */
export function formatBlockContract(type: BlockType): string {
  const c = blockContract(type);
  const out: string[] = [];
  out.push(`${c.type} — ${c.description}`);
  out.push(`family: ${c.family}`);
  out.push('');
  out.push('Fields  (* required · (n) number · (bool) boolean · a|b closed enum · [] list)');
  out.push(...(c.fields.length > 0 ? c.fields : ['  (no fields)']));
  if (c.common.length > 0) out.push(`  also optional: ${c.common.join(', ')}`);
  if (c.textBody !== undefined) {
    out.push(
      `  bare text: a body with no \`field:\` lines is taken whole as \`${c.textBody}\` — no YAML quoting needed`,
    );
  }
  if (c.notes.length > 0) {
    out.push('');
    out.push('Field notes');
    for (const n of c.notes) out.push(`  ${n.fields}: ${n.note}`);
  }
  if (c.terse.length > 0) {
    out.push('');
    out.push('Terse item forms (strings in these lists expand to the object form; mix freely)');
    for (const t of c.terse) out.push(`  ${t.field}: ${t.grammar}`);
  }
  if (c.aliases.length > 0) {
    out.push('');
    out.push(
      `Also spelled: ${c.aliases.map((a) => `\`${a.name}\`${a.patch === '' ? '' : ` (${a.patch})`}`).join(', ')} — old names, still valid`,
    );
  }
  out.push('');
  out.push('Example');
  out.push('```' + c.type);
  out.push(c.example.trimEnd());
  out.push('```');
  return out.join('\n') + '\n';
}

/** The `field` / `parent.child` keys that have a terse grammar for `type`. */
export function terseFieldsOf(type: BlockType): readonly string[] {
  return Object.keys(TERSE_HINTS[type] ?? {}).filter((key) =>
    hasTerseGrammar(type, key.split('.')),
  );
}
