/**
 * W_GENERIC_LABEL: a diagram node, actor, or step named with a placeholder
 * (`Service A`, `Database`, `Step 1`, `TODO`) warns once per distinct label,
 * names the label, and asks for the real component's name. Real names that
 * contain a generic word (`Orders API`, `API Gateway`) never warn.
 */

import { describe, expect, it } from 'vitest';
import { parseDocument } from '../parser.js';
import { validateDocument } from '../validate.js';
import { isGenericLabel, lintGenericLabels } from '../genericLabels.js';
import { ordersApi } from './fixtures.js';

const lint = (md: string) => lintGenericLabels(parseDocument(md, 't'), 't.md');
const fence = (type: string, body: string) => '```' + type + '\n' + body + '\n```\n';

describe('isGenericLabel', () => {
  it.each([
    'Service A',
    'Service 1',
    'service b',
    'Step 1',
    'Step 12',
    'Component',
    'Component B',
    'Node',
    'Database',
    'DB',
    'db',
    'Backend',
    'Frontend',
    'front end',
    'Server',
    'Server 2',
    'API',
    'api',
    'Foo',
    'Bar',
    'Lorem',
    'Lorem ipsum dolor',
    'TODO',
    'TBD',
    'tbd',
    'TBD: pick a queue',
    'FIXME (owner)',
    'X',
    'A',
    '...',
    '…',
    '???',
    '  API  ',
    'New node',
    'New database',
    'new service',
    'New group 3',
  ])('flags %j', (label) => {
    expect(isGenericLabel(label)).toBe(true);
  });

  it.each([
    'API Gateway',
    'Orders API',
    'REST API',
    'ledger-db',
    'Postgres',
    'orders-db',
    'Todo API',
    'Todo',
    'Step 1: validate the card',
    'Service mesh',
    'Payments service',
    'Client',
    'User',
    'Database migrator',
    'Backend for frontend',
    'Fraud model',
    'X-Ray',
    'S3',
    'Node.js worker',
    'server-1',
    'New Zendesk ticket',
    'New Relic',
    'New York office',
    'New order',
    'New business shortfall',
    '',
  ])('passes %j', (label) => {
    expect(isGenericLabel(label)).toBe(false);
  });
});

describe('W_GENERIC_LABEL', () => {
  it('warns on a placeholder flow node, names the label, and points at its line', () => {
    const md = fence(
      'flow',
      'nodes:\n  - { id: a, kind: start, label: Request }\n  - { id: b, kind: process, label: Service A }\nedges:\n  - a -> b: sends',
    );
    const w = lint(md);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({
      level: 'warn',
      code: 'W_GENERIC_LABEL',
      value: 'Service A',
      line: 4,
    });
    expect(w[0]?.message).toContain('"Service A"');
    expect(w[0]?.hint).toContain('real component');
  });

  it('reads sequence actors, block / c4 / dfd nodes, cluster services, and swimlane steps', () => {
    const md =
      fence(
        'sequence',
        'actors:\n  - { id: c, name: Client }\n  - { id: s, name: Server }\nmessages:\n  - c -> s: GET /health',
      ) +
      fence('block', 'nodes:\n  - Database\n  - { id: gw, name: API Gateway }') +
      fence('c4', 'nodes:\n  - { id: b, kind: container, name: Backend }') +
      fence('dfd', 'nodes:\n  - { id: p, name: Process 1, kind: process }') +
      fence(
        'cluster',
        'clusters:\n  - { id: k, label: prod }\nservices:\n  - { id: s1, cluster: k, label: Component }',
      ) +
      fence(
        'swimlane',
        'lanes:\n  - { label: Ops }\nsteps:\n  - { id: s1, lane: Ops, label: Step 1 }',
      );
    const values = lint(md).map((d) => d.value);
    expect(values).toEqual(['Server', 'Database', 'Backend', 'Process 1', 'Component', 'Step 1']);
  });

  it('warns once per distinct label in one block', () => {
    const md = fence(
      'flow',
      'nodes:\n  - { id: a, label: TODO }\n  - { id: b, label: TODO }\n  - { id: c, label: Step 1 }\n  - { id: d, label: Step 2 }',
    );
    expect(lint(md).map((d) => d.value)).toEqual(['TODO', 'Step 1', 'Step 2']);
  });

  it('stays quiet on real names, and on algorithm graphs that name nodes by letter', () => {
    const md =
      fence(
        'block',
        'nodes:\n  - { id: gw, name: API Gateway }\n  - { id: api, name: Orders API }\n  - { id: pg, name: ledger-db, kind: store }',
      ) +
      fence(
        'graph',
        'nodes:\n  - { id: A, label: A }\n  - { id: B, label: B }\nedges:\n  - A -> B',
      );
    expect(lint(md)).toEqual([]);
    expect(lint(ordersApi())).toEqual([]);
  });

  it('flags editor placeholders on nodes and group panels, but not fair panel names', () => {
    const md = fence(
      'block',
      'groups:\n  - { col: 1, row: 1, label: New group }\n  - { col: 2, row: 1, label: Backend }\n  - { col: 3, row: 1, label: New group 3 }\nnodes:\n  - { id: n9, col: 1, row: 1, name: New database }\n  - { id: api, col: 2, row: 1, name: Orders API }',
    );
    const w = lint(md);
    expect(w.map((d) => `${d.message}`)).toEqual([
      'block: the node "New database" has a placeholder name',
      'block: the group "New group" has a placeholder name',
      'block: the group "New group 3" has a placeholder name',
    ]);
    expect(w[0]?.hint).toContain('The editor wrote this default name');
    expect(w[1]?.hint).toContain('Name the boundary');
  });

  it('reads a mermaid flowchart and reports on the fence line', () => {
    const md = 'Intro.\n\n```mermaid\nflowchart LR\n  A[Checkout] --> B[Backend]\n```\n';
    const w = lint(md);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ value: 'Backend', line: 3 });
  });

  it('runs beside validateDocument, so the grammar examples stay validate-clean', () => {
    const md = fence('flow', 'nodes:\n  - { id: a, label: Service A }');
    expect(
      validateDocument(parseDocument(md, 't'), 't.md').filter((d) => d.code === 'W_GENERIC_LABEL'),
    ).toEqual([]);
    expect(lint(md)).toHaveLength(1);
  });
});
