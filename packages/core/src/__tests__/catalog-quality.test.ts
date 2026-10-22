/**
 * The catalog examples are what an agent sees first (`chiltepin block <type>`),
 * and agents copy their habits. Each example must model the habits the skill
 * teaches:
 *
 * - specific nouns — no example trips `W_GENERIC_LABEL`;
 * - one focus — no list marks more than one item with a non-red `accent`
 *   (or `accent: true`), because the skin reads a second flag as no focus;
 * - no colour picking on single-item blocks, and no colour on groups.
 *
 * The contract side: every accent-name enum carries the field note that says
 * it is not a colour.
 */

import { describe, expect, it } from 'vitest';
import { BLOCK_TYPES, type BlockType } from '../types.js';
import { BLOCK_TEMPLATES } from '../blocks/catalog.js';
import { ACCENT_FIELD_NOTE, STATUS_COLOR_NOTE, blockContract } from '../blocks/contract.js';
import { describeBlockSchema, type FieldNode } from '../blocks/introspect.js';
import { lintGenericLabels } from '../genericLabels.js';
import { parseDocument } from '../parser.js';

/** The parsed data of a catalog example. */
function exampleData(type: BlockType): unknown {
  const seg = parseDocument(BLOCK_TEMPLATES[type], type).segments[0];
  if (seg === undefined || seg.kind === 'markdown') throw new Error(`${type}: no block`);
  return seg.data;
}

/** Every array of objects in `value`, with its path. */
function objectLists(value: unknown, path = ''): Array<{ path: string; items: Record<string, unknown>[] }> {
  const out: Array<{ path: string; items: Record<string, unknown>[] }> = [];
  if (Array.isArray(value)) {
    const items = value.filter(
      (v): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v),
    );
    if (items.length > 0) out.push({ path, items });
    value.forEach((v, i) => out.push(...objectLists(v, `${path}[${String(i)}]`)));
  } else if (typeof value === 'object' && value !== null) {
    for (const [k, v] of Object.entries(value)) out.push(...objectLists(v, path === '' ? k : `${path}.${k}`));
  }
  return out;
}

/** Paths of enum fields named `accent` whose options are the legacy colour names. */
function accentEnumPaths(node: FieldNode, path = ''): string[] {
  const names = ['navy', 'blue', 'teal', 'green', 'amber', 'purple', 'red', 'gray'];
  const here =
    node.kind === 'enum' && path.endsWith('accent') && names.every((n) => node.options.includes(n))
      ? [path]
      : [];
  if (node.kind === 'object')
    return [...here, ...node.fields.flatMap((f) => accentEnumPaths(f.node, path === '' ? f.name : `${path}.${f.name}`))];
  if (node.kind === 'array') return [...here, ...accentEnumPaths(node.element, `${path}[]`)];
  if (node.kind === 'union') return [...here, ...node.arms.flatMap((a) => accentEnumPaths(a, path))];
  return here;
}

describe('catalog examples model the skill', () => {
  it('no example uses a placeholder name (W_GENERIC_LABEL)', () => {
    for (const type of BLOCK_TYPES) {
      const found = lintGenericLabels(parseDocument(BLOCK_TEMPLATES[type], type), `${type}.md`);
      expect(
        found.map((d) => d.value),
        `${type} example`,
      ).toEqual([]);
    }
  });

  it('no list marks more than one focus item', () => {
    for (const type of BLOCK_TYPES) {
      for (const { path, items } of objectLists(exampleData(type))) {
        const flagged = items.filter(
          (it) => it.accent === true || (typeof it.accent === 'string' && it.accent !== 'red'),
        );
        expect(flagged.length, `${type} ${path}: ${String(flagged.length)} focus items`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('single-item blocks pick no accent, and groups pick no colour', () => {
    for (const type of ['bignumber', 'divider', 'spec', 'takeaways'] as const) {
      const data = exampleData(type) as Record<string, unknown>;
      expect(data.accent, `${type} accent`).toBeUndefined();
    }
    for (const type of BLOCK_TYPES) {
      const data = exampleData(type) as Record<string, unknown>;
      const groups = Array.isArray(data.groups) ? (data.groups as Record<string, unknown>[]) : [];
      for (const g of groups) expect(g.color, `${type} group colour`).toBeUndefined();
    }
  });
});

describe('accent field notes', () => {
  it('every accent-name enum says it is not a colour', () => {
    const withAccent = BLOCK_TYPES.filter((t) => accentEnumPaths(describeBlockSchema(t)).length > 0);
    expect(withAccent.length).toBeGreaterThanOrEqual(22);
    for (const type of withAccent) {
      const notes = blockContract(type).notes;
      const note = notes.find((n) => n.note === ACCENT_FIELD_NOTE);
      expect(note, `${type} accent note`).toBeDefined();
      for (const p of accentEnumPaths(describeBlockSchema(type))) {
        expect(note?.fields.split(', '), `${type} ${p}`).toContain(p);
      }
    }
  });

  it('the statustable status colour explains the pill styles', () => {
    const notes = blockContract('statustable').notes;
    expect(notes).toContainEqual({ fields: 'statuses[].color', note: STATUS_COLOR_NOTE });
  });

  it('a schema note wins over the derived note', () => {
    // Fields that carry their own `.describe()` keep it; no field gets two notes.
    for (const type of BLOCK_TYPES) {
      const fields = blockContract(type).notes.flatMap((n) => n.fields.split(', '));
      expect(new Set(fields).size, `${type} notes`).toBe(fields.length);
    }
  });
});
