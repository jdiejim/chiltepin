/**
 * Block schema introspection — turns a block's zod schema into a plain
 * {@link FieldNode} tree that editors and form UIs can walk without depending
 * on zod. Unions describe as a `union` node whose arms are described
 * recursively (table cells: `string | number | { v, tone, … }`); only
 * constructs without ANY faithful structural description (records, unknown
 * types, passthrough objects holding arbitrary keys) collapse to `opaque`,
 * signalling "edit this as raw YAML".
 *
 * Note: like `schema-walk.ts` and `validate.ts`, this couples to zod v3
 * internals (`instanceof` checks + `._def.innerType` / `._def.schema`).
 */

import { z } from 'zod';
import { blockSchemas } from './schemas.js';
import { unwrap } from './schema-walk.js';
import type { BlockType } from '../types.js';

/**
 * A structural description of a schema node.
 *
 * - `string` / `number` / `boolean` — the scalar primitives.
 * - `enum` — a closed set of string options. A string literal is described as
 *   a one-option enum (it renders the same way: a fixed choice).
 * - `array` / `object` — containers, described recursively.
 * - `union` — a `z.union`, each arm described recursively (a table cell is
 *   `string | number | { v, tone, … }`). Editors decide how to present the
 *   alternatives (a type-preserving input, a simple/detailed toggle, …).
 * - `opaque` — anything without a faithful structural description (records,
 *   passthrough objects that admit arbitrary keys, unknown constructs).
 *   Editors should fall back to raw YAML for these. `superRefine`d schemas
 *   unwrap to their inner object (see `unwrap`).
 */
export type FieldNode = FieldShape & {
  /**
   * The schema's own note for this field (`.describe('…')`), when it carries
   * one: the vocabulary of a free-string field whose words the renderer owns.
   * `chiltepin block <type>` prints it under "Field notes".
   */
  readonly description?: string;
};

/** The structural part of a {@link FieldNode}. */
export type FieldShape =
  | { readonly kind: 'string' | 'boolean'; readonly optional: boolean }
  | {
      readonly kind: 'number';
      readonly optional: boolean;
      /**
       * Declared `.min(n)`, when the schema sets one. A form has to seed at
       * least this — zero is not a legal grid coordinate or draw count, and a
       * form that offers it writes a value the schema rejects on save.
       */
      readonly min?: number;
      /** Declared `.max(n)`, when the schema sets one. */
      readonly max?: number;
    }
  | { readonly kind: 'enum'; readonly optional: boolean; readonly options: readonly string[] }
  | {
      readonly kind: 'array';
      readonly optional: boolean;
      readonly element: FieldNode;
      /** Declared `.min(n)`, when the schema sets one — a form has to seed that many. */
      readonly min?: number;
    }
  | {
      readonly kind: 'object';
      readonly optional: boolean;
      readonly fields: ReadonlyArray<{ readonly name: string; readonly node: FieldNode }>;
    }
  | { readonly kind: 'union'; readonly optional: boolean; readonly arms: readonly FieldNode[] }
  | { readonly kind: 'opaque'; readonly optional: boolean };

/**
 * Describes one schema node and keeps the author-facing note a schema carries
 * (`.describe('…')`, on the field or on any wrapper around it) as
 * `description`. Only a few free-string fields carry one — the ones whose
 * vocabulary the renderer owns (a node `kind`, a group `color`).
 */
function describe(schema: z.ZodTypeAny): FieldNode {
  let note: string | undefined = schema.description;
  for (let cur: z.ZodTypeAny = schema; note === undefined; ) {
    if (cur instanceof z.ZodOptional || cur instanceof z.ZodNullable) cur = cur.unwrap() as z.ZodTypeAny;
    else if (cur instanceof z.ZodDefault) cur = cur._def.innerType as z.ZodTypeAny;
    else break;
    note = cur.description;
  }
  const node = describeShape(schema);
  return note !== undefined ? { ...node, description: note } : node;
}

/** Describes one schema node's structure, tracking optionality from its wrappers. */
function describeShape(schema: z.ZodTypeAny): FieldNode {
  // Optional / nullable mark the node optional; default just unwraps (the
  // field can be omitted syntactically, but a value always materialises).
  let optional = false;
  let cur = schema;
  for (;;) {
    if (cur instanceof z.ZodOptional || cur instanceof z.ZodNullable) {
      optional = true;
      cur = cur.unwrap();
    } else if (cur instanceof z.ZodDefault) {
      cur = cur._def.innerType as z.ZodTypeAny;
    } else {
      break;
    }
  }
  cur = unwrap(cur);

  if (cur instanceof z.ZodString) return { kind: 'string', optional };
  if (cur instanceof z.ZodNumber) {
    // `.min(n)` / `.max(n)` are part of the contract, the way an array's
    // `.min(n)` is: a grid coordinate starts at 1, not at 0.
    const checks = (cur._def as { checks?: ReadonlyArray<{ kind: string; value: number }> }).checks ?? [];
    const min = checks.find((c) => c.kind === 'min')?.value;
    const max = checks.find((c) => c.kind === 'max')?.value;
    return {
      kind: 'number',
      optional,
      ...(typeof min === 'number' ? { min } : {}),
      ...(typeof max === 'number' ? { max } : {}),
    };
  }
  if (cur instanceof z.ZodBoolean) return { kind: 'boolean', optional };
  if (cur instanceof z.ZodEnum) {
    return { kind: 'enum', optional, options: (cur.options as string[]).slice() };
  }
  if (cur instanceof z.ZodLiteral && typeof cur.value === 'string') {
    return { kind: 'enum', optional, options: [cur.value] };
  }
  // A boolean literal (`end: true` on a sequence frame end) is a toggle whose
  // only valid state is on — a boolean control still represents it.
  if (cur instanceof z.ZodLiteral && typeof cur.value === 'boolean') {
    return { kind: 'boolean', optional };
  }
  if (cur instanceof z.ZodArray) {
    // `.min(n)` is part of the contract: a form that seeds fewer items than
    // the schema demands produces a value that cannot validate.
    const min = (cur._def as { minLength?: { value?: number } | null }).minLength?.value;
    return {
      kind: 'array',
      optional,
      element: describe(cur.element as z.ZodTypeAny),
      ...(typeof min === 'number' && min > 0 ? { min } : {}),
    };
  }
  if (cur instanceof z.ZodObject) {
    // A passthrough object admits arbitrary extra keys (gallery's nested
    // `block`) — the declared shape is NOT the real structure, so a form over
    // it would misrepresent the value. Keep it opaque (raw-YAML editing).
    if ((cur._def as { unknownKeys?: unknown }).unknownKeys === 'passthrough') {
      return { kind: 'opaque', optional };
    }
    const shape = cur.shape as Record<string, z.ZodTypeAny>;
    return {
      kind: 'object',
      optional,
      fields: Object.keys(shape).map((name) => ({
        name,
        node: describe(shape[name] as z.ZodTypeAny),
      })),
    };
  }
  if (cur instanceof z.ZodUnion) {
    const arms = (cur.options as z.ZodTypeAny[]).map((arm) => describe(arm));
    return { kind: 'union', optional, arms };
  }
  // Records and anything unrecognised: no faithful structural description.
  return { kind: 'opaque', optional };
}

const cache = new Map<BlockType, FieldNode>();

/**
 * Describes the schema of a block type as a {@link FieldNode} tree. Memoized —
 * the description is derived once per type and shared (treat it as immutable).
 *
 * @param type - The block type to describe.
 * @returns The root node — an `object` for `z.object` schemas (refinement
 *   wrappers like `gallery`'s / `statustable`'s `superRefine` are unwrapped).
 */
export function describeBlockSchema(type: BlockType): FieldNode {
  const hit = cache.get(type);
  if (hit !== undefined) return hit;
  const node = describe(blockSchemas[type]);
  cache.set(type, node);
  return node;
}
