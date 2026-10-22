/**
 * Deck builds — `data-reveal="n"` (svg/reveal.ts) marks the group that
 * appears at step n. One test per ordered block: the sequence of values
 * follows the block's documented order, and the step count equals the item
 * count (several elements may share a step — a message and its badge, an
 * edge and its label — so distinct steps are what is counted).
 */

import { describe, expect, it } from 'vitest';
import { parse, type HTMLElement } from 'node-html-parser';
import { revealAttr } from '../svg/reveal.js';
import { renderSequence } from '../blocks/sequence.js';
import { renderFlow, flowRevealOrder } from '../blocks/flow.js';
import { renderSaga } from '../blocks/saga.js';
import { renderSpans } from '../blocks/spans.js';
import { renderSteps } from '../blocks/steps.js';
import { renderState } from '../blocks/state.js';
import { renderTimeline } from '../blocks/timeline.js';

const step = (el: HTMLElement): number => Number(el.getAttribute('data-reveal'));
const steps = (html: string, sel: string): number[] => parse(html).querySelectorAll(sel).map(step);
const distinct = (html: string): number[] =>
  [...new Set(steps(html, '[data-reveal]'))].sort((a, b) => a - b);
const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

describe('revealAttr', () => {
  it('emits the inert data attribute', () => {
    expect(revealAttr(3)).toBe(' data-reveal="3"');
  });
});

describe('sequence reveal', () => {
  const actors = [
    { id: 'A', name: 'A' },
    { id: 'B', name: 'B' },
    { id: 'C', name: 'C' },
  ];
  const html = renderSequence({
    actors,
    messages: [
      { from: 'A', to: 'B', label: 'call', summary: 'one' },
      { frame: 'alt', label: 'ok' },
      { from: 'B', to: 'C', label: 'q', summary: 'two' },
      { from: 'C', to: 'B', label: 'r', kind: 'response', summary: 'three' },
      { else: 'fail' },
      { from: 'B', to: 'A', label: 'err', kind: 'error', summary: 'four' },
      { end: true },
    ],
  });

  it('messages and frame markers step in document order; `end` draws nothing of its own', () => {
    expect(steps(html, 'g[data-bl="messages"] > g')).toEqual([0, 2, 3, 5]);
    expect(steps(html, 'g[data-bp="messages.1"]')).toEqual([1, 1]); // frame body + tab
    expect(steps(html, 'g[data-bp="messages.4"]')).toEqual([4, 4]); // else divider + guard
    // 7 items, of which the `end` marker is not a step.
    expect(distinct(html)).toEqual(range(6));
  });

  it('the step list reveals in step with the diagram', () => {
    expect(steps(html, '.seq-steps li')).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('an activation bar appears with the message that opened it', () => {
    expect(steps(html, 'rect.activation')).toEqual([0, 2]);
  });
});

describe('flow reveal', () => {
  const nodes = [
    { id: 'e', label: 'Done', kind: 'end' as const },
    { id: 's', label: 'Start', kind: 'start' as const },
    { id: 'd', label: 'Ok?', kind: 'decision' as const },
    { id: 'a', label: 'Work' },
    { id: 'x', label: 'Failed', kind: 'end' as const },
  ];
  const edges = [
    { from: 's', to: 'a' },
    { from: 'a', to: 'd' },
    { from: 'd', to: 'e', label: 'yes' },
    { from: 'd', to: 'x', label: 'no' },
  ];

  it('walks the nodes topologically from `start`, and an edge arrives with the node it leads to', () => {
    expect([...flowRevealOrder(nodes, edges).entries()]).toEqual([
      ['s', 0],
      ['a', 1],
      ['d', 2],
      ['e', 3],
      ['x', 4],
    ]);
    const html = renderFlow({ nodes, edges });
    // Node groups are emitted in document order; their steps follow the walk.
    expect(steps(html, 'g[data-bl="nodes"] > g')).toEqual([3, 0, 2, 1, 4]);
    expect(steps(html, 'g[data-bl="edges"] > path')).toEqual([1, 2, 3, 4]);
    // Edge labels reveal with their edge.
    expect(steps(html, 'g[data-bp="edges.2"]')).toEqual([3]);
    expect(distinct(html)).toEqual(range(nodes.length));
  });

  it('a cycle still yields every node once', () => {
    const cyc = [
      { id: 'a', label: 'a' },
      { id: 'b', label: 'b' },
      { id: 'c', label: 'c' },
    ];
    const order = flowRevealOrder(cyc, [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'a' },
    ]);
    expect([...order.values()].sort((p, q) => p - q)).toEqual([0, 1, 2]);
  });
});

describe('saga reveal', () => {
  const html = renderSaga({
    failAt: 'ship',
    steps: [
      { id: 'pay', service: 'payments', name: 'Charge card', compensate: 'Refund' },
      { id: 'stock', service: 'inventory', name: 'Reserve stock', compensate: 'Release' },
      { id: 'ship', service: 'shipping', name: 'Book courier', compensate: 'Cancel booking' },
    ],
  });

  it('steps left to right, then the compensations from the failure point back', () => {
    expect(steps(html, 'g[data-bl="steps"] > g')).toEqual([0, 1, 2]);
    expect(steps(html, '.sg-forward line')).toEqual([1, 2]);
    // The compensating flow walks stock (step 3) then pay (step 4).
    expect(steps(html, 'g[data-bp="steps.1.compensate"]')).toEqual([3]);
    expect(steps(html, 'g[data-bp="steps.0.compensate"]')).toEqual([4]);
    expect(steps(html, '.sg-compflow path')).toEqual([3, 4]);
    // The failed step's own compensation is never reached: it shows with its step.
    expect(steps(html, 'g[data-bp="steps.2.compensate"]')).toEqual([2]);
    // 3 steps + 2 compensations walked.
    expect(distinct(html)).toEqual(range(5));
  });
});

describe('spans reveal', () => {
  const html = renderSpans({
    spans: [
      { id: 'root', service: 'api', name: 'GET /x', start: 0, duration: 100 },
      { id: 'late', service: 'db', name: 'query', start: 40, duration: 20, parent: 'root' },
      { id: 'early', service: 'cache', name: 'get', start: 10, duration: 5, parent: 'root', note: 'hit' },
    ],
  });

  it('bars by start, across lanes; a connector arrives with its child', () => {
    // Bar groups are emitted per lane in data order: root, late, early.
    expect(steps(html, 'g[data-bl="spans"] > g')).toEqual([0, 2, 1]);
    expect(steps(html, 'path.sp-link')).toEqual([2, 1]);
    expect(steps(html, '.sp-details li')).toEqual([1]);
    expect(distinct(html)).toEqual(range(3));
  });
});

describe('steps reveal', () => {
  it('items in order', () => {
    const html = renderSteps({ items: [{ title: 'a' }, { title: 'b' }, { title: 'c' }] });
    expect(steps(html, 'li.stp-item')).toEqual([0, 1, 2]);
    expect(distinct(html)).toEqual(range(3));
  });
});

describe('state reveal', () => {
  it('transitions in document order, the label and the table row with the arrow', () => {
    const html = renderState({
      states: [
        { id: 'i', name: 'Idle' },
        { id: 'r', name: 'Running' },
        { id: 'd', name: 'Done', kind: 'terminal' },
      ],
      transitions: [
        { from: 'i', to: 'r', event: 'start' },
        { from: 'r', to: 'r', event: 'tick' },
        { from: 'r', to: 'd', event: 'finish' },
      ],
    });
    expect(steps(html, 'svg path[data-bp^="transitions."]')).toEqual([0, 1, 2]);
    expect(steps(html, 'svg g[data-bp^="transitions."]')).toEqual([0, 1, 2]);
    expect(steps(html, 'table tr[data-reveal]')).toEqual([0, 1, 2]);
    expect(distinct(html)).toEqual(range(3));
  });
});

describe('timeline reveal', () => {
  it('items in order', () => {
    const html = renderTimeline({
      items: [
        { label: 'a', status: 'done' },
        { label: 'b', status: 'current' },
        { label: 'c' },
      ],
    });
    expect(steps(html, '.tl-item')).toEqual([0, 1, 2]);
    expect(distinct(html)).toEqual(range(3));
  });
});
