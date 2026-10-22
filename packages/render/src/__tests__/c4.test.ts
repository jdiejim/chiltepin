/**
 * The C4 notation the `c4` renderer must draw: the bracketed type line of
 * every element, the shapes (person, cylinder, pipe, browser, phone), the
 * neutral outside style, the boundary that names its type, the relationship
 * technology on its own line, the key that lists exactly what is used, the
 * eyebrow that names the diagram and its scope, the people-on-top layout,
 * the numbered steps of a dynamic view — and no text cut without a report.
 * Markup and geometry only, never pixels.
 */

import { describe, expect, it } from 'vitest';
import { parse, type HTMLElement } from 'node-html-parser';
import { parseDocument, type BlockDataMap } from 'chiltepin-core';
import { c4Level, renderC4 } from '../blocks/c4.js';
import { c4Grid, fitRow } from '../blocks/c4Layout.js';
import { c4Look, relForms, separateBends, typeLine } from '../blocks/c4Parts.js';
import { collectCuts } from '../svg/wrapText.js';
import { geometryReport } from '../geometryReport.js';

/** The parsed data of a `c4` block (terse forms expanded). */
function c4(yaml: string): BlockDataMap['c4'] {
  const doc = parseDocument('```c4\n' + yaml.trim() + '\n```\n', 't');
  const seg = doc.segments.find((s) => s.kind === 'c4') as { data?: unknown } | undefined;
  if (seg?.data === undefined || seg.data === null) throw new Error('no c4 block');
  return seg.data as BlockDataMap['c4'];
}

const node = (root: HTMLElement, i: number): HTMLElement => {
  const g = root.querySelector(`g[data-bp="nodes.${i}"]`);
  if (g === null) throw new Error(`no node ${i}`);
  return g;
};
const texts = (g: HTMLElement, cls: string): string[] => g.querySelectorAll(`text.${cls}`).map((t) => t.text);
const keyLabels = (root: HTMLElement): string[] => root.querySelectorAll('.diagram-legend .lg-label').map((l) => l.text);
const eyebrow = (root: HTMLElement): string => root.querySelector('.diagram-tag')?.text ?? '';

const BANKING = c4(`
title: Internet banking containers
level: container
boundary: { label: Internet banking }
nodes:
  - { id: cust, kind: person, name: Customer, desc: Holds personal accounts. }
  - { id: spa, kind: container, family: spa, name: Single-page app, tech: "JavaScript, Angular", desc: Banking in the browser. }
  - { id: mob, kind: container, family: mobile, name: Mobile app, tech: Kotlin, desc: Banking on a phone. }
  - { id: api, kind: container, name: API application, tech: "Go, gRPC", desc: Serves the banking API. }
  - { id: q, kind: container, family: queue, name: Payment queue, tech: RabbitMQ, desc: Holds payments. }
  - { id: db, kind: store, name: Accounts DB, tech: Postgres 16, desc: Accounts and payments. }
  - { id: mf, kind: external, name: Mainframe, desc: Core banking records. }
edges:
  - { from: cust, to: spa, label: Pays bills using }
  - { from: cust, to: mob, label: Pays bills using }
  - { from: spa, to: api, label: Makes API calls to, tech: JSON/HTTPS }
  - { from: mob, to: api, label: Makes API calls to, tech: JSON/HTTPS }
  - { from: api, to: db, label: Reads from and writes to, tech: SQL }
  - { from: api, to: q, label: Enqueues payments on, tech: AMQP, kind: dashed }
  - { from: api, to: mf, label: Reads balances from, tech: XML/HTTPS }
`);

describe('c4: every element shows its name, its bracketed type line, its description', () => {
  it('the type line names the C4 type, with the technology after a colon', () => {
    const at = (kind: string, tech?: string, family?: string): string =>
      typeLine(c4Look({ kind, name: 'X', ...(family !== undefined ? { family } : {}) }), tech);
    expect(at('person')).toBe('[Person]');
    expect(at('system')).toBe('[Software System]');
    expect(at('external')).toBe('[Software System]');
    expect(at('container', 'Go, gRPC')).toBe('[Container: Go, gRPC]');
    expect(at('component', 'Spring Bean')).toBe('[Component: Spring Bean]');
    expect(at('store', 'Postgres 16')).toBe('[Container: Postgres 16]');
    expect(at('container', undefined, 'external')).toBe('[Container]');
  });

  it('draws the name, then the type line, then the description, top to bottom', () => {
    const root = parse(renderC4(BANKING));
    const api = node(root, 3);
    expect(texts(api, 't-name')).toEqual(['API application']);
    expect(texts(api, 't-sub')).toEqual(['[Container: Go, gRPC]']);
    expect(texts(api, 'c4-desc')).toEqual(['Serves the banking API.']);
    const y = (cls: string): number => Number(api.querySelector(`text.${cls}`)?.getAttribute('y'));
    expect(y('t-name')).toBeLessThan(y('t-sub'));
    expect(y('t-sub')).toBeLessThan(y('c4-desc'));
    // The type line is the element's chip: it takes the category hue.
    expect(api.querySelector('text.t-sub')?.getAttribute('class')).toContain('c-blue');
  });
});

describe('c4: shapes', () => {
  const root = parse(renderC4(BANKING));
  const shape = (i: number): string | undefined => node(root, i).getAttribute('data-c4');

  it('a person is a head over shoulders; a store a cylinder; a queue a pipe; web and mobile their devices', () => {
    expect(shape(0)).toBe('person');
    expect(node(root, 0).querySelector('circle')).not.toBeNull();
    expect(shape(1)).toBe('browser');
    expect(shape(2)).toBe('phone');
    expect(shape(3)).toBe('box');
    expect(shape(4)).toBe('pipe');
    expect(shape(5)).toBe('cylinder');
    // The cylinder: a body with elliptic arcs and the front of its top rim.
    const arcs = node(root, 5).querySelectorAll('path').map((p) => p.getAttribute('d') ?? '');
    expect(arcs).toHaveLength(2);
    for (const d of arcs) expect(d).toMatch(/ A /);
  });

  it('a `client` front end is a phone when its name or tech says mobile, else a browser', () => {
    expect(c4Look({ kind: 'container', family: 'client', name: 'iOS app', tech: 'Swift' }).shape).toBe('phone');
    expect(c4Look({ kind: 'container', family: 'client', name: 'Storefront', tech: 'Next.js' }).shape).toBe('browser');
    expect(c4Look({ kind: 'container', family: 'db', name: 'Ledger' }).shape).toBe('cylinder');
    expect(c4Look({ kind: 'container', family: 'kafka', name: 'Events' }).shape).toBe('pipe');
  });

  it('anything outside the scope is neutral and dashed; in scope takes its category hue', () => {
    const ext = node(root, 6);
    const outline = ext.querySelector('rect');
    expect(outline?.getAttribute('fill')).toBe('var(--paper-2)');
    expect(outline?.getAttribute('stroke-dasharray')).toBe('4 3');
    expect(ext.toString()).not.toContain('--hue-');
    expect(node(root, 0).querySelector('rect')?.getAttribute('fill')).toBe('var(--hue-rose-tint)');
    expect(node(root, 3).querySelector('rect')?.getAttribute('fill')).toBe('var(--hue-blue-tint)');
    // A person outside the scope keeps the person shape, in the neutral style.
    const look = c4Look({ kind: 'person', family: 'external', name: 'Auditor' });
    expect(look).toMatchObject({ shape: 'person', external: true });
    expect(look.hue).toBeUndefined();
  });
});

describe('c4: relationships', () => {
  it('the label states the intent and the technology sits on its own line, in brackets', () => {
    const root = parse(renderC4(BANKING));
    const label = root.querySelectorAll('g[data-bp="edges.2"]').find((g) => g.querySelector('text') !== null);
    const lines = (label?.querySelectorAll('text') ?? []).map((t) => t.text);
    expect(lines[lines.length - 1]).toBe('[JSON/HTTPS]');
    expect(lines.slice(0, -1).join(' ')).toBe('Makes API calls to');
    expect(label?.querySelectorAll('text').pop()?.getAttribute('class')).toContain('c-soft');
  });

  it('a long intent may take three lines, never losing a word', () => {
    const forms = relForms({ label: 'Gets account information from and makes payments using', tech: 'XML/HTTPS', err: false, path: 'edges.0' });
    expect(forms.some((f) => f.intent.length === 3)).toBe(true);
    for (const f of forms) {
      expect(f.intent.join(' ')).toBe('Gets account information from and makes payments using');
      expect(f.tech).toEqual(['[XML/HTTPS]']);
    }
  });

  it('every edge is a one-way arrow', () => {
    const root = parse(renderC4(BANKING));
    const paths = root.querySelectorAll('g[data-bl="edges"] path');
    expect(paths).toHaveLength(7);
    for (const p of paths) expect(p.getAttribute('marker-end')).toMatch(/^url\(#sk/);
  });
});

describe('c4: boundaries', () => {
  const head = (html: string): string[] => parse(html).querySelectorAll('g[data-bp="boundary"] text').map((t) => t.text);

  it('draws dashed and rounded, with the scope name over its type', () => {
    const root = parse(renderC4(BANKING));
    const outline = root.querySelector('g[data-bp="boundary"] path');
    expect(outline?.getAttribute('stroke-dasharray')).toBeTruthy();
    expect(outline?.getAttribute('d')).toMatch(/Q/);
    expect(head(renderC4(BANKING))).toEqual(['Internet banking', '[Software System]']);
  });

  it('the type follows the level: container → system, component → container, context → enterprise', () => {
    const comp = c4(`
level: component
boundary: { label: API application }
nodes:
  - { id: spa, kind: container, name: Web app }
  - { id: a, kind: component, name: Sign-in controller }
  - { id: b, kind: component, name: Security component }
edges: [spa -> a: signs in with, a -> b: checks with]
`);
    expect(head(renderC4(comp))).toEqual(['API application', '[Container]']);
    // A container outside the container in scope stays outside its boundary.
    expect(parse(renderC4(comp)).querySelectorAll('g[data-bp="boundary"]')).toHaveLength(1);
    const ctx = c4(`
level: context
boundary: { label: Big Bank plc }
nodes:
  - { id: u, kind: person, name: Customer }
  - { id: s, kind: system, name: Internet banking }
edges: [u -> s: banks with]
`);
    expect(head(renderC4(ctx))).toEqual(['Big Bank plc', '[Enterprise]']);
  });
});

describe('c4: the key lists exactly the notation in use', () => {
  it('a context diagram: person, system in scope, external system, uses', () => {
    const ctx = c4(`
level: context
nodes:
  - { id: u, kind: person, name: Shopper }
  - { id: s, kind: system, name: Shop }
  - { id: p, kind: external, name: Card acquirer }
edges: [u -> s: buys from, s -> p: charges cards with]
`);
    expect(keyLabels(parse(renderC4(ctx)))).toEqual(['person', 'system in scope', 'external system', 'uses']);
  });

  it('a container diagram: each shape it draws, the boundary, and both line styles', () => {
    expect(keyLabels(parse(renderC4(BANKING)))).toEqual([
      'person',
      'container',
      'web front end',
      'mobile app',
      'database',
      'queue',
      'external system',
      'software system boundary',
      'uses',
      'async',
    ]);
  });

  it('a dynamic diagram adds the step numeral', () => {
    const dyn = c4(`
nodes:
  - { id: a, kind: container, name: Web app }
  - { id: b, kind: container, name: API }
edges:
  - { from: a, to: b, label: Submits the order to, step: 1 }
`);
    expect(keyLabels(parse(renderC4(dyn)))).toContain('step in the scenario');
  });
});

describe('c4: the eyebrow names the diagram type and its scope', () => {
  it('container, component, context and dynamic', () => {
    expect(eyebrow(parse(renderC4(BANKING)))).toBe('Container diagram · Internet banking');
    const ctx = c4(`
nodes:
  - { id: u, kind: person, name: Shopper }
  - { id: s, kind: system, name: Shop }
edges: [u -> s: buys from]
`);
    expect(c4Level(ctx)).toBe('context');
    expect(eyebrow(parse(renderC4(ctx)))).toBe('System context · Shop');
    const dyn = c4(`
level: component
boundary: { label: API application }
nodes:
  - { id: a, kind: component, name: Sign-in controller }
  - { id: b, kind: component, name: Security component }
edges:
  - { from: a, to: b, label: Validates credentials with, step: 1 }
`);
    expect(eyebrow(parse(renderC4(dyn)))).toBe('Dynamic diagram · API application');
  });
});

describe('c4: auto-layout reads from the people down', () => {
  const rows = (data: BlockDataMap['c4']): Map<string, number> =>
    new Map(parse(renderC4(data)).querySelectorAll('g[data-bp^="nodes."]').map((g) => [g.getAttribute('data-bp') ?? '', Number(g.getAttribute('data-row'))]));

  it('people sit on the top row, the system below them, its dependencies below it', () => {
    const r = rows(BANKING);
    expect(r.get('nodes.0')).toBe(1);
    for (const i of [1, 2]) expect(r.get(`nodes.${i}`)).toBe(2);
    expect(r.get('nodes.3')).toBe(3);
    for (const i of [4, 5]) expect(r.get(`nodes.${i}`)).toBe(4);
  });

  it('an element that calls a person back sits on the first row under the people', () => {
    const grid = c4Grid(
      [
        { id: 'u', kind: 'person' },
        { id: 's', kind: 'system' },
        { id: 'x', kind: 'external' },
        { id: 'mail', kind: 'external' },
      ],
      [
        { from: 'u', to: 's' },
        { from: 's', to: 'x' },
        { from: 'x', to: 'mail' },
        { from: 'mail', to: 'u' },
      ],
      new Set(),
      'TB',
    );
    expect(grid.get('u')?.row).toBe(1);
    expect(grid.get('s')?.row).toBe(2);
    expect(grid.get('x')?.row).toBe(3);
    expect(grid.get('mail')?.row).toBe(2);
  });

  it('the boundary keeps its members together: no outsider takes a column between two of them', () => {
    const grid = c4Grid(
      [
        { id: 'u', kind: 'person' },
        { id: 'a', kind: 'container' },
        { id: 'x', kind: 'external' },
        { id: 'b', kind: 'container' },
      ],
      [
        { from: 'u', to: 'a' },
        { from: 'u', to: 'x' },
        { from: 'u', to: 'b' },
      ],
      new Set(['a', 'b']),
      'TB',
    );
    const cols = ['a', 'b'].map((id) => grid.get(id)?.col as number);
    const x = grid.get('x')?.col as number;
    expect(x < Math.min(...cols) || x > Math.max(...cols)).toBe(true);
  });

  it('`dir: LR` turns it on its side: the people take the first column', () => {
    const grid = c4Grid([{ id: 'u', kind: 'person' }, { id: 's', kind: 'system' }], [{ from: 'u', to: 's' }], new Set(), 'LR');
    expect(grid.get('u')).toEqual({ col: 1, row: 1 });
    expect(grid.get('s')).toEqual({ col: 2, row: 1 });
  });

  it('a row takes the columns nearest its neighbours, in order, a busy element first', () => {
    expect(fitRow([{ ideal: 1, range: [0, 2], weight: 3 }, { ideal: 1, range: [0, 2] }], 3)).toEqual([1, 2]);
    expect(fitRow([{ ideal: 0, range: [1, 2] }], 3)).toEqual([1]);
  });
});

describe('c4: two routes never meet at a bend', () => {
  it('a route that turns where another turns steps a track aside', () => {
    // A: down, then right into its target. B: right, then down — through A's corner.
    const pts = (xs: Array<[number, number]>) => xs.map(([x, y]) => ({ x, y }));
    const route = (p: Array<{ x: number; y: number }>) => ({ points: p, d: '', exit: 'B' as const, entry: 'L' as const, through: [] });
    const a = route(pts([[100, 0], [100, 100], [220, 100]]));
    const b = route(pts([[0, 100], [100, 100], [100, 200], [300, 200], [300, 260]]));
    const [, moved] = separateBends([a, b], []);
    const corner = moved?.points[1];
    expect(corner).toBeDefined();
    expect(corner?.x).not.toBe(100);
    expect(moved?.d).toMatch(/^M /);
  });
});

describe('c4: dynamic diagrams number the relationships', () => {
  it('each step draws the circled numeral on its relationship', () => {
    const dyn = c4(`
level: component
boundary: { label: API application }
nodes:
  - { id: spa, kind: container, family: spa, name: Single-page app }
  - { id: a, kind: component, name: Sign-in controller }
  - { id: b, kind: component, name: Security component }
edges:
  - { from: spa, to: a, label: Submits credentials to, tech: JSON/HTTPS, step: 1 }
  - { from: a, to: b, label: Validates credentials with, step: 2 }
`);
    const root = parse(renderC4(dyn));
    for (const [i, n] of [[0, '1'], [1, '2']] as const) {
      const g = root.querySelectorAll(`g[data-bp="edges.${i}"]`).find((x) => x.querySelector('circle') !== null);
      expect(g?.querySelector('text.t-badge')?.text).toBe(n);
    }
  });
});

describe('c4: no text is cut without a report', () => {
  it('a long description wraps in full and the cell grows', () => {
    const long =
      'Validates every booking against the carrier rate cards, prices it for the tenant, allocates capacity on the chosen carrier, and books the pickup slot.';
    const data = c4(`
nodes:
  - { id: a, kind: container, name: Booking service, tech: Go, desc: "${long}" }
  - { id: b, kind: container, name: Tracking service, tech: Rust }
edges: [a -> b: notifies]
`);
    const { value, cuts } = collectCuts(() => renderC4(data));
    expect(cuts).toHaveLength(0);
    expect(texts(node(parse(value), 0), 'c4-desc').join(' ')).toBe(long);
  });

  it('a description past seven lines ends with "…", keeps its whole text as the title, and is reported', () => {
    const huge = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
    const data = c4(`
nodes:
  - { id: a, kind: container, name: Booking service, desc: "${huge}" }
`);
    const { value, cuts } = collectCuts(() => renderC4(data));
    expect(cuts.some((c) => c.path === 'nodes.0.desc')).toBe(true);
    const g = node(parse(value), 0);
    expect(texts(g, 'c4-desc').pop()?.endsWith('…')).toBe(true);
    expect(g.querySelector('title')?.text).toBe(huge);
    // `check` names the field that was cut.
    expect(geometryReport('c4', data).issues.some((i) => i.path === 'nodes.0.desc')).toBe(true);
  });
});
