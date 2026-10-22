import { describe, expect, it } from 'vitest';
import { describeBlockSchema, type FieldNode } from 'chiltepin-core';
import { coerceValue } from '../direct/paths.js';
import { resolveControl } from './fieldKind.js';
import {
  coerceUnionInput,
  toDetailedValue,
  toSimpleValue,
  unionObjectArm,
  unionPrimaryField,
  unionPrimitiveArms,
  unionSimpleControl,
} from './union.js';

type UnionNode = Extract<FieldNode, { kind: 'union' }>;

const str: FieldNode = { kind: 'string', optional: false };
const num: FieldNode = { kind: 'number', optional: false };
const bool: FieldNode = { kind: 'boolean', optional: false };
const union = (...arms: FieldNode[]): UnionNode => ({ kind: 'union', optional: false, arms });
const obj = (fields: Array<[string, FieldNode]>): FieldNode => ({
  kind: 'object',
  optional: false,
  fields: fields.map(([name, node]) => ({ name, node })),
});

/** The real table cell union straight from the schema. */
function tableCellNode(): UnionNode {
  const root = describeBlockSchema('table');
  if (root.kind !== 'object') throw new Error('table root');
  const rows = root.fields.find((f) => f.name === 'rows')?.node;
  if (rows?.kind !== 'array' || rows.element.kind !== 'array') throw new Error('table rows');
  const cell = rows.element.element;
  if (cell.kind !== 'union') throw new Error('table cell should be a union');
  return cell;
}

function tableColumnNode(): UnionNode {
  const root = describeBlockSchema('table');
  if (root.kind !== 'object') throw new Error('table root');
  const cols = root.fields.find((f) => f.name === 'columns')?.node;
  if (cols?.kind !== 'array' || cols.element.kind !== 'union') throw new Error('table columns');
  return cols.element;
}

describe('union arm classification', () => {
  it('splits primitive arms from the object arm', () => {
    const cell = tableCellNode();
    // `true` / `false` are cells too (a `check` column draws them as ✓ ✗).
    expect(unionPrimitiveArms(cell).map((a) => a.kind)).toEqual(['string', 'number', 'boolean']);
    expect(unionObjectArm(cell)?.kind).toBe('object');
  });

  it('yields no object arm for primitive-only unions and ambiguous multi-object unions', () => {
    expect(unionObjectArm(union(str, num))).toBeNull();
    expect(unionObjectArm(union(obj([['a', str]]), obj([['b', str]])))).toBeNull();
  });
});

describe('unionSimpleControl — the resolution matrix', () => {
  it('string|number mix → one type-preserving text input', () => {
    expect(unionSimpleControl(union(str, num))).toEqual({ kind: 'text', multiline: false });
    expect(unionSimpleControl(tableCellNode())).toEqual({ kind: 'text', multiline: false });
  });

  it('number-only → stepper; boolean-only → toggle', () => {
    expect(unionSimpleControl(union(num, num))).toEqual({ kind: 'number' });
    expect(unionSimpleControl(union(bool))).toEqual({ kind: 'boolean' });
  });

  it('enum-only arms merge their option vocabularies', () => {
    const e1: FieldNode = { kind: 'enum', optional: false, options: ['a', 'b'] };
    const e2: FieldNode = { kind: 'enum', optional: false, options: ['b', 'c'] };
    expect(unionSimpleControl(union(e1, e2))).toEqual({ kind: 'enum', options: ['a', 'b', 'c'] });
  });

  it('no primitive arms → opaque', () => {
    expect(unionSimpleControl(union(obj([['a', str]])))).toEqual({ kind: 'opaque' });
  });
});

describe('resolveControl over union nodes', () => {
  it('scalar-valued table cell → text input; object-valued → opaque (hosts render the arm)', () => {
    const cell = tableCellNode();
    const base = { blockKind: 'table', name: '', data: {}, path: ['rows', 0, 0] as const };
    expect(resolveControl({ ...base, node: cell, value: 'hi' })).toEqual({
      kind: 'text',
      multiline: false,
    });
    expect(resolveControl({ ...base, node: cell, value: 42 })).toEqual({
      kind: 'text',
      multiline: false,
    });
    expect(resolveControl({ ...base, node: cell, value: { v: 'hi', tone: 'pos' } })).toEqual({
      kind: 'opaque',
    });
  });

  it('string-bearing unions keep the smart relational upgrades (a status vocabulary)', () => {
    const data = {
      statuses: [{ label: 'Done', color: 'green' }, { label: 'Blocked', color: 'red' }],
      rows: [{ cells: ['t'], status: 'Done' }],
    };
    const resolved = resolveControl({
      blockKind: 'statustable',
      name: 'status',
      node: union(str, num),
      value: 'Done',
      data,
      path: ['rows', 0, 'status'],
    });
    expect(resolved).toEqual({
      kind: 'options',
      options: [{ value: 'Done' }, { value: 'Blocked' }],
    });
  });
});

describe('Simple ⇄ Detailed conversion', () => {
  const cellArm = unionObjectArm(tableCellNode());
  const colArm = unionObjectArm(tableColumnNode());
  if (cellArm === null || colArm === null) throw new Error('arms expected');

  it('primary field: `v` for cells, `label` for columns', () => {
    expect(unionPrimaryField(cellArm)).toBe('v');
    expect(unionPrimaryField(colArm)).toBe('label');
  });

  it('simple → detailed puts the scalar in the primary field (numbers preserved)', () => {
    expect(toDetailedValue('42 ms', cellArm)).toEqual({ v: '42 ms' });
    expect(toDetailedValue(42, cellArm)).toEqual({ v: 42 });
    expect(toDetailedValue(undefined, cellArm)).toEqual({ v: '' });
    expect(toDetailedValue('Region', colArm)).toEqual({ label: 'Region' });
  });

  it('detailed → simple reads the primary back (detail fields drop, warn-free)', () => {
    expect(toSimpleValue({ v: 'p99', tone: 'warn', lead: true }, cellArm)).toBe('p99');
    expect(toSimpleValue({ v: 3, tone: 'pos' }, cellArm)).toBe(3);
    expect(toSimpleValue({ label: 'Region', align: 'r' }, colArm)).toBe('Region');
    expect(toSimpleValue({}, cellArm)).toBe('');
  });

  it('round-trips an already-converted value unchanged', () => {
    const detailed = { v: 'x', tone: 'neg' };
    expect(toDetailedValue(detailed, cellArm)).toBe(detailed);
    expect(toSimpleValue('x', cellArm)).toBe('x');
  });
});

describe('coerceUnionInput / coerceValue over unions', () => {
  const cell = tableCellNode();

  it('numeric-looking input stays a number when a number arm allows it', () => {
    expect(coerceUnionInput('42', cell)).toEqual({ ok: true, value: 42 });
    expect(coerceUnionInput('-3.5', cell)).toEqual({ ok: true, value: -3.5 });
    expect(coerceUnionInput('42 ms', cell)).toEqual({ ok: true, value: '42 ms' });
    expect(coerceUnionInput('', cell)).toEqual({ ok: true, value: '' });
  });

  it('string-only unions keep numeric-looking text as text', () => {
    const col = tableColumnNode(); // string | object — no number arm
    expect(coerceUnionInput('42', col)).toEqual({ ok: true, value: '42' });
  });

  it('rejects input no arm accepts', () => {
    expect(coerceUnionInput('abc', union(num, bool))).toEqual({ ok: false });
    expect(coerceUnionInput('true', union(num, bool))).toEqual({ ok: true, value: true });
  });

  it('coerceValue routes union nodes through the union rules', () => {
    expect(coerceValue('7', 'old', cell)).toEqual({ ok: true, value: 7 });
    expect(coerceValue('p99 latency', 7, cell)).toEqual({ ok: true, value: 'p99 latency' });
  });
});
