/**
 * Graph lints (`graphLints.ts`): each finds the known-bad pattern, names the
 * item and its data path, and stays silent on the repo's own docs — a false
 * positive is a bug.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDocument } from '../parser.js';
import { lintGraphs } from '../graphLints.js';
import { lintDocument } from '../lintDocument.js';

const lint = (md: string) => lintGraphs(parseDocument(md, 't'), 't.md');
const fence = (type: string, body: string) => '```' + type + '\n' + body + '\n```\n';
const codes = (md: string, code: string) => lint(md).filter((d) => d.code === code);

describe('W_ORPHAN_NODE', () => {
  it('flags a flow node no edge touches, on its own line', () => {
    const md = fence(
      'flow',
      'nodes:\n  - { id: s, kind: start, label: Receive order }\n  - { id: pay, label: Charge card }\n  - { id: lonely, label: Notify warehouse }\nedges:\n  - s -> pay',
    );
    const [d] = codes(md, 'W_ORPHAN_NODE');
    expect(d?.message).toBe('flow: the node "Notify warehouse" (lonely) has no edge; every other node connects');
    expect(d?.line).toBe(5);
    expect(d?.value).toBe('lonely');
    expect(d?.level).toBe('warn');
  });

  it('is silent when the block has no edges, or the node is placed in a group panel', () => {
    expect(codes(fence('flow', 'nodes:\n  - a: A\n  - b: B'), 'W_ORPHAN_NODE')).toEqual([]);
    const placed = fence(
      'block',
      'groups:\n  - { col: 2, row: 1, label: Public subnet }\nnodes:\n  - { id: gw, col: 1, row: 1, name: Gateway }\n  - { id: api, col: 1, row: 2, name: orders-api }\n  - { id: nat, col: 2, row: 1, name: NAT }\nedges:\n  - gw -> api',
    );
    expect(codes(placed, 'W_ORPHAN_NODE')).toEqual([]);
    // The same node outside any panel is an orphan.
    const loose = placed.replace('col: 2, row: 1, name: NAT', 'col: 3, row: 2, name: NAT');
    expect(codes(loose, 'W_ORPHAN_NODE').map((d) => d.value)).toEqual(['nat']);
  });

  it('reads states and transitions, steps and links', () => {
    const state = fence('state', 'states:\n  - a: Idle\n  - b: Busy\n  - c: Stuck\ntransitions:\n  - a -> b: start');
    expect(codes(state, 'W_ORPHAN_NODE')[0]?.message).toContain('the state "Stuck" (c) has no transition');
    const lanes = fence('swimlane', 'lanes: [Ops]\nsteps:\n  - a: One · Ops\n  - b: Two · Ops\n  - c: Three · Ops\nlinks:\n  - a -> b');
    expect(codes(lanes, 'W_ORPHAN_NODE')[0]?.message).toContain('the step "Three" (c) has no link');
  });
});

describe('W_EMPTY_GROUP', () => {
  it('flags a group whose cells hold no node', () => {
    const md = fence(
      'block',
      'groups:\n  - { col: 1, row: 1, label: Edge }\n  - { col: 3, row: 1, label: Data }\nnodes:\n  - { id: gw, col: 1, row: 1, name: Gateway }\n  - { id: api, col: 2, row: 1, name: orders-api }\nedges:\n  - gw -> api',
    );
    const [d] = codes(md, 'W_EMPTY_GROUP');
    expect(d?.message).toBe('block: the group "Data" (cell col 3, row 1) holds no node');
    expect(d?.line).toBe(4);
    expect(codes(md, 'W_EMPTY_GROUP')).toHaveLength(1);
  });

  it('counts a wide node, and skips blocks laid out automatically', () => {
    const wide = fence(
      'block',
      'groups:\n  - { col: 2, row: 1, label: Right half }\nnodes:\n  - { id: bus, col: 1, row: 1, w: 2, name: event-bus }',
    );
    expect(codes(wide, 'W_EMPTY_GROUP')).toEqual([]);
    const auto = fence('flow', 'groups:\n  - { col: 5, row: 5, label: Far }\nnodes:\n  - a: A\n  - b: B\nedges:\n  - a -> b');
    expect(codes(auto, 'W_EMPTY_GROUP')).toEqual([]);
  });
});

describe('W_DUP_EDGE', () => {
  it('flags the second copy of the same from, to, and label', () => {
    const md = fence('block', 'nodes:\n  - api: Orders API\n  - db: orders-db\nedges:\n  - api -> db\n  - api -> db: reads\n  - api -> db');
    const d = codes(md, 'W_DUP_EDGE');
    expect(d).toHaveLength(1);
    expect(d[0]?.message).toBe('block: the edge `api -> db` is written twice');
    expect(d[0]?.line).toBe(8);
    expect(d[0]?.hint).toContain('edges.2');
  });

  it('is silent for the same pair with different labels', () => {
    const md = fence('dfd', 'nodes:\n  - a: Client\n  - b: Orders\nedges:\n  - a -> b: order\n  - a -> b: refund');
    expect(codes(md, 'W_DUP_EDGE')).toEqual([]);
  });
});

describe('W_DECISION_LABEL', () => {
  it('flags a decision with an unlabelled branch', () => {
    const md = fence(
      'flow',
      'nodes:\n  - { id: d, kind: decision, label: Stock available? }\n  - { id: pay, label: Charge card }\n  - { id: no, kind: end, label: Order rejected }\nedges:\n  - d -> pay: "yes"\n  - d -> no',
    );
    const [d] = codes(md, 'W_DECISION_LABEL');
    expect(d?.message).toBe('flow: the decision "Stock available?" has 2 branches and 1 without a label (d -> no)');
    expect(d?.hint).toContain('`d -> no: <answer>`');
  });

  it('is silent when every branch is labelled, or the decision has one way out', () => {
    const labelled = fence(
      'flow',
      'nodes:\n  - { id: d, kind: decision, label: Valid? }\n  - a: Go\n  - b: Stop\nedges:\n  - d -> a: "yes"\n  - d -x-> b: "no"',
    );
    expect(codes(labelled, 'W_DECISION_LABEL')).toEqual([]);
    const single = fence('flow', 'nodes:\n  - { id: d, kind: decision, label: Valid? }\n  - a: Go\nedges:\n  - d -> a');
    expect(codes(single, 'W_DECISION_LABEL')).toEqual([]);
  });
});

describe('W_ERROR_INTO_SUCCESS', () => {
  const ends = (edges: string) =>
    fence(
      'flow',
      'nodes:\n  - { id: s, kind: start, label: Receive order }\n  - { id: pay, label: Charge card }\n  - { id: ok, kind: end, label: Order confirmed }\n  - { id: bad, kind: end, label: Order rejected }\nedges:\n' +
        edges,
    );

  it('flags a success end that only error edges reach', () => {
    const d = codes(ends('  - s -> pay\n  - pay -x-> ok\n  - s -x-> bad'), 'W_ERROR_INTO_SUCCESS');
    expect(d.map((x) => x.message)).toEqual([
      'flow: the end "Order confirmed" reads as success, but only error edges reach it (pay -x-> ok)',
    ]);
  });

  it('flags a failure end that draws as the happy path', () => {
    const d = codes(ends('  - s -> pay\n  - pay -> ok\n  - s -> bad'), 'W_ERROR_INTO_SUCCESS');
    expect(d.map((x) => x.message)).toEqual([
      'flow: the end "Order rejected" reads as a failure, but no error edge reaches it, so it draws as the happy path',
    ]);
    expect(d[0]?.hint).toContain('`s -x-> bad`');
  });

  it('flags an error edge that joins the success end while a failure end exists', () => {
    const d = codes(ends('  - s -> pay\n  - pay -> ok\n  - s -x-> ok\n  - pay -x-> bad'), 'W_ERROR_INTO_SUCCESS');
    expect(d[0]?.message).toContain('the error edge `s -x-> ok` joins the end "Order confirmed"');
  });

  it('is silent for a correct flow and for a flow with one end', () => {
    expect(codes(ends('  - s -> pay\n  - pay -> ok\n  - pay -x-> bad'), 'W_ERROR_INTO_SUCCESS')).toEqual([]);
    // A labelled "no" branch is an error edge in the renderer's reading.
    expect(codes(ends('  - s -> pay\n  - pay -> ok\n  - pay -> bad: "no"'), 'W_ERROR_INTO_SUCCESS')).toEqual([]);
    const one = fence('flow', 'nodes:\n  - a: Start\n  - { id: e, kind: end, label: Done }\nedges:\n  - a -> e\n  - a -x-> e');
    expect(codes(one, 'W_ERROR_INTO_SUCCESS')).toEqual([]);
  });
});

describe('W_IDLE_ACTOR', () => {
  it('flags a sequence actor in no message', () => {
    const md = fence(
      'sequence',
      'actors:\n  - { id: c, name: Client }\n  - { id: a, name: Orders API }\n  - { id: z, name: Audit log }\nmessages:\n  - c -> a: POST /orders\n  - a --> c: 201',
    );
    const [d] = codes(md, 'W_IDLE_ACTOR');
    expect(d?.message).toBe('sequence: the actor "Audit log" (z) sends and receives no message');
    expect(d?.line).toBe(5);
  });

  it('is silent when every actor takes part (frames and notes included)', () => {
    const md = fence(
      'sequence',
      'actors:\n  - { id: c, name: Client }\n  - { id: a, name: API }\nmessages:\n  - alt: cache hit\n  - c -> a: GET\n  - else: miss\n  - a --> c: 200\n  - end',
    );
    expect(codes(md, 'W_IDLE_ACTOR')).toEqual([]);
  });
});

describe('lintDocument', () => {
  it('runs validation and every core lint in one call', () => {
    const md =
      '```meta\ntitle: T\n```\n\n' +
      fence('flow', 'nodes:\n  - a: Start\n  - b: New node\n  - c: Done\nedges:\n  - a -> c') +
      '\nSee [the flow](#missing).\n';
    const got = new Set(lintDocument(parseDocument(md, 't'), 't.md').map((d) => d.code));
    expect(got).toContain('W_ORPHAN_NODE');
    expect(got).toContain('W_GENERIC_LABEL');
    expect(got).toContain('E_DANGLING_LINK');
  });
});

/** The repo's own docs: none of the graph lints may fire on them. */
describe('graph lints on docs/', () => {
  const root = resolve(import.meta.dirname, '../../../../docs');
  const walk = (d: string): string[] =>
    readdirSync(d).flatMap((f) => {
      const p = join(d, f);
      return statSync(p).isDirectory() ? walk(p) : p.endsWith('.md') ? [p] : [];
    });

  it('report no false positives', () => {
    const found = walk(root).flatMap((f) =>
      lintGraphs(parseDocument(readFileSync(f, 'utf8'), relative(root, f)), relative(root, f)).map(
        (d) => `${d.file}:${String(d.line)} ${d.code} ${d.message}`,
      ),
    );
    expect(found).toEqual([]);
  });
});
