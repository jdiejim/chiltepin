import { describe, expect, it } from 'vitest';
import { BLOCK_TYPES } from '../types.js';
import { describeBlockSchema, type FieldNode } from '../blocks/introspect.js';

/** Convenience: the named field of an object node (fails the test if absent). */
function field(node: FieldNode, name: string): FieldNode {
  expect(node.kind).toBe('object');
  if (node.kind !== 'object') throw new Error('not an object node');
  const f = node.fields.find((x) => x.name === name);
  expect(f, `expected field '${name}'`).toBeDefined();
  return (f as { node: FieldNode }).node;
}

describe('describeBlockSchema', () => {
  it('describes every block type without throwing; root is object or opaque', () => {
    for (const type of BLOCK_TYPES) {
      const node = describeBlockSchema(type);
      expect(['object', 'opaque'], `root of ${type}`).toContain(node.kind);
      expect(node.optional).toBe(false);
    }
  });

  it('is memoized — repeated calls return the same node', () => {
    expect(describeBlockSchema('callout')).toBe(describeBlockSchema('callout'));
  });

  it('callout.tone is an optional enum with the documented options', () => {
    const tone = field(describeBlockSchema('callout'), 'tone');
    expect(tone).toEqual({
      kind: 'enum',
      optional: true,
      options: ['note', 'tip', 'warn', 'danger', 'success'],
    });
  });

  it('sequence.messages is an array of a union: message | frame open | else | end', () => {
    const messages = field(describeBlockSchema('sequence'), 'messages');
    expect(messages.kind).toBe('array');
    if (messages.kind !== 'array') return;
    expect(messages.optional).toBe(true);
    const element = messages.element;
    expect(element.kind).toBe('union');
    if (element.kind !== 'union') return;
    expect(element.arms.map((a) => a.kind)).toEqual(['object', 'object', 'object', 'object']);
    const message = element.arms[0];
    if (message?.kind !== 'object') throw new Error('message arm');
    const from = message.fields.find((f) => f.name === 'from');
    expect(from?.node).toEqual({ kind: 'string', optional: false });
    const kind = message.fields.find((f) => f.name === 'kind');
    expect(kind?.node).toMatchObject({ kind: 'enum', optional: true });
    expect(message.fields.find((f) => f.name === 'activate')?.node).toEqual({ kind: 'boolean', optional: true });
    const frame = element.arms[1];
    if (frame?.kind !== 'object') throw new Error('frame arm');
    expect(frame.fields.find((f) => f.name === 'frame')?.node).toMatchObject({
      kind: 'enum',
      options: ['alt', 'opt', 'loop', 'par', 'break', 'critical'],
    });
    // `end: true` is a boolean literal — a boolean control, never opaque.
    const end = element.arms[3];
    if (end?.kind !== 'object') throw new Error('end arm');
    expect(end.fields[0]?.node).toEqual({ kind: 'boolean', optional: false });
  });

  it('union fields describe as union nodes with typed arms (table cells, dfd num)', () => {
    // table.rows: array of array of (string | number | boolean | { v, tone, … }).
    // ONE object arm: Studio's Simple ⇄ Detailed cell toggle needs exactly one.
    const rows = field(describeBlockSchema('table'), 'rows');
    expect(rows.kind).toBe('array');
    if (rows.kind !== 'array') return;
    expect(rows.element.kind).toBe('array');
    if (rows.element.kind !== 'array') return;
    const cell = rows.element.element;
    expect(cell.kind).toBe('union');
    if (cell.kind !== 'union') return;
    expect(cell.optional).toBe(false);
    expect(cell.arms.map((a) => a.kind)).toEqual(['string', 'number', 'boolean', 'object']);
    const detailed = cell.arms[3];
    if (detailed?.kind !== 'object') throw new Error('cell object arm expected');
    expect(detailed.fields.map((f) => f.name)).toEqual(['v', 'tone', 'lead', 'highlight', 'group']);
    // The `v` field is itself a string|number union.
    expect(detailed.fields[0]?.node.kind).toBe('union');

    // table.columns: string | { label, align?, highlight? }.
    const columns = field(describeBlockSchema('table'), 'columns');
    if (columns.kind !== 'array') throw new Error('table.columns should be an array');
    expect(columns.element.kind).toBe('union');

    // dfd node `num` is string | number.
    const nodes = field(describeBlockSchema('dfd'), 'nodes');
    if (nodes.kind !== 'array' || nodes.element.kind !== 'object') {
      throw new Error('dfd.nodes should be an array of objects');
    }
    const num = nodes.element.fields.find((f) => f.name === 'num');
    expect(num?.node).toEqual({
      kind: 'union',
      optional: true,
      arms: [
        { kind: 'string', optional: false },
        { kind: 'number', optional: false },
      ],
    });

    // stats value: string | number, required.
    const stats = field(describeBlockSchema('stats'), 'stats');
    if (stats.kind !== 'array' || stats.element.kind !== 'object') {
      throw new Error('stats.stats should be an array of objects');
    }
    const value = stats.element.fields.find((f) => f.name === 'value');
    expect(value?.node).toMatchObject({ kind: 'union', optional: false });
  });

  it('passthrough objects stay opaque (gallery nested block data)', () => {
    // gallery items[].block admits ARBITRARY keys (the nested block's whole
    // body) — a form over `{ type }` would misrepresent it, so raw YAML wins.
    const items = field(describeBlockSchema('gallery'), 'items');
    if (items.kind !== 'array' || items.element.kind !== 'object') {
      throw new Error('gallery.items should be an array of objects');
    }
    const block = items.element.fields.find((f) => f.name === 'block');
    expect(block?.node).toEqual({ kind: 'opaque', optional: true });
  });

  it('accent fields expose the shared presentation palette', () => {
    const accent = field(describeBlockSchema('list'), 'accent');
    expect(accent.kind).toBe('enum');
    if (accent.kind !== 'enum') return;
    expect(accent.options).toEqual([
      'navy',
      'blue',
      'teal',
      'green',
      'amber',
      'purple',
      'red',
      'gray',
    ]);
  });

  it('superRefine-wrapped schemas (ZodEffects) unwrap to their inner object', () => {
    // The refinement adds checks, not structure — editors still get the fields.
    const gallery = describeBlockSchema('gallery');
    expect(gallery.kind).toBe('object');
    expect(field(gallery, 'items').kind).toBe('array');

    const bintree = describeBlockSchema('bintree');
    expect(bintree.kind).toBe('object');
    expect(field(bintree, 'nodes').kind).toBe('array');

    // statustable: the statuses vocabulary keeps its accent-enum color field.
    const statuses = field(describeBlockSchema('statustable'), 'statuses');
    if (statuses.kind !== 'array' || statuses.element.kind !== 'object') {
      throw new Error('statustable.statuses should be an array of objects');
    }
    const color = statuses.element.fields.find((f) => f.name === 'color');
    expect(color?.node).toMatchObject({ kind: 'enum', optional: false });
  });

  it('walks the alias-extended schemas (chart kind, block preset, code kind, variants)', () => {
    const kind = field(describeBlockSchema('chart'), 'kind');
    expect(kind).toEqual({
      kind: 'enum',
      optional: true,
      options: [
        'bar',
        'stacked',
        'line',
        'area',
        'scatter',
        'donut',
        'pie',
        'gauge',
        'radar',
        'waterfall',
        'funnel',
        'histogram',
        'bell',
        'boxplot',
        'pareto',
        'bullet',
        'dumbbell',
      ],
    });
    const preset = field(describeBlockSchema('block'), 'preset');
    expect(preset).toEqual({
      kind: 'enum',
      optional: true,
      options: ['infra', 'event', 'ddd', 'network', 'k8s'],
    });
    const codeKind = field(describeBlockSchema('code'), 'kind');
    expect(codeKind).toEqual({ kind: 'enum', optional: true, options: ['compare', 'diff', 'terminal'] });
    expect(field(describeBlockSchema('code'), 'session')).toEqual({
      kind: 'string',
      optional: true,
    });
    expect(field(describeBlockSchema('felogic'), 'variant')).toEqual({
      kind: 'enum',
      optional: true,
      options: ['be'],
    });
    expect(field(describeBlockSchema('flow'), 'variant')).toEqual({
      kind: 'enum',
      optional: true,
      options: ['dag'],
    });
    expect(field(describeBlockSchema('tree'), 'variant')).toEqual({
      kind: 'enum',
      optional: true,
      options: ['issue', 'org'],
    });
    // statustable: variant + the legacy tracker items[] beside rows.
    const st = describeBlockSchema('statustable');
    expect(field(st, 'variant')).toEqual({ kind: 'enum', optional: true, options: ['tracker'] });
    const items = field(st, 'items');
    if (items.kind !== 'array' || items.element.kind !== 'object') {
      throw new Error('statustable.items should be an array of objects');
    }
    expect(items.element.fields.map((f) => f.name)).toEqual([
      'task',
      'status',
      'priority',
      'owner',
      'due',
    ]);
  });

  it('boolean and number fields describe as their primitives', () => {
    const erd = describeBlockSchema('erd');
    const entities = field(erd, 'entities');
    if (entities.kind !== 'array' || entities.element.kind !== 'object') {
      throw new Error('erd.entities should be an array of objects');
    }
    const columns = entities.element.fields.find((f) => f.name === 'columns');
    if (columns?.node.kind !== 'array' || columns.node.element.kind !== 'object') {
      throw new Error('erd entity columns should be an array of objects');
    }
    const pk = columns.node.element.fields.find((f) => f.name === 'pk');
    expect(pk?.node).toEqual({ kind: 'boolean', optional: true });

    const quadrant = describeBlockSchema('quadrant');
    const items = field(quadrant, 'items');
    if (items.kind !== 'array' || items.element.kind !== 'object') {
      throw new Error('quadrant.items should be an array of objects');
    }
    const x = items.element.fields.find((f) => f.name === 'x');
    expect(x?.node).toEqual({ kind: 'number', optional: false });
  });
});
