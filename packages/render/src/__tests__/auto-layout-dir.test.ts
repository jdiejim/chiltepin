import { describe, expect, it } from 'vitest';
import { renderFlow } from '../blocks/flow.js';
import { renderC4 } from '../blocks/c4.js';
import { renderState } from '../blocks/state.js';
import { renderDfd } from '../blocks/dfd.js';

/** Reads the SVG viewBox back as `{ w, h }` — the diagram's natural box. */
function box(html: string): { w: number; h: number } {
  const m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(html);
  if (m === null) throw new Error('no viewBox in rendered output');
  return { w: Number(m[1]), h: Number(m[2]) };
}

// A six-rank chain with two side branches — the shape that used to render as a
// tall column of ranks nobody could read on a slide.
const CHAIN = {
  nodes: [
    { id: 'req', kind: 'start' as const, label: 'Request' },
    { id: 'auth', kind: 'decision' as const, label: 'Authenticated?' },
    { id: 'rate', kind: 'decision' as const, label: 'Under rate limit?' },
    { id: 'handle', label: 'Handle request' },
    { id: 'cache', label: 'Write cache' },
    { id: 'ok', kind: 'end' as const, label: '200 OK' },
    { id: 'deny', kind: 'end' as const, label: '401' },
  ],
  edges: [
    { from: 'req', to: 'auth' },
    { from: 'auth', to: 'rate' },
    { from: 'auth', to: 'deny', kind: 'error' as const },
    { from: 'rate', to: 'handle' },
    { from: 'handle', to: 'cache' },
    { from: 'cache', to: 'ok' },
  ],
};

describe('grid auto-layout direction', () => {
  it('lays a coordinate-less flow out left-to-right — wider than tall', () => {
    const { w, h } = box(renderFlow(CHAIN));
    expect(w).toBeGreaterThan(h);
  });

  it('`dir: TB` puts the ranks back down the page', () => {
    const wide = box(renderFlow(CHAIN));
    const tall = box(renderFlow({ ...CHAIN, dir: 'TB' }));
    expect(tall.h).toBeGreaterThan(tall.w);
    // Same graph, transposed grid: the two boxes swap their long axis.
    expect(tall.h).toBeGreaterThan(wide.h);
    expect(tall.w).toBeLessThan(wide.w);
  });

  it('honours authored coordinates — `dir` steers auto-layout only', () => {
    const placed = {
      nodes: [
        { id: 'a', col: 1, row: 1, kind: 'start' as const, label: 'A' },
        { id: 'b', col: 1, row: 2, label: 'B' },
        { id: 'c', col: 1, row: 3, kind: 'end' as const, label: 'C' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ],
    };
    expect(renderFlow({ ...placed, dir: 'LR' })).toBe(renderFlow(placed));
  });

  it('c4 quick mode puts the people on top, and takes `dir: LR`', () => {
    const c4 = {
      nodes: [
        { id: 'user', kind: 'person' as const, name: 'Analyst' },
        { id: 'web', kind: 'container' as const, name: 'Web app' },
        { id: 'api', kind: 'container' as const, name: 'API' },
        { id: 'db', kind: 'store' as const, name: 'Postgres' },
      ],
      edges: [
        { from: 'user', to: 'web' },
        { from: 'web', to: 'api' },
        { from: 'api', to: 'db' },
      ],
    };
    // A C4 diagram reads from the people down: a chain stacks top to bottom.
    const tall = box(renderC4(c4));
    const wide = box(renderC4({ ...c4, dir: 'LR' }));
    expect(tall.h).toBeGreaterThan(tall.w);
    expect(wide.w).toBeGreaterThan(wide.h);
  });

  it('state and dfd keep their left-to-right default and accept `dir`', () => {
    const st = {
      states: [
        { id: 's0', kind: 'start' as const },
        { id: 'pending', kind: 'wait' as const, name: 'PENDING' },
        { id: 'done', kind: 'terminal' as const, name: 'DONE' },
      ],
      transitions: [
        { from: 's0', to: 'pending', event: 'create' },
        { from: 'pending', to: 'done', event: 'ship' },
      ],
    };
    expect(box(renderState(st)).w).toBeGreaterThan(box(renderState({ ...st, dir: 'TB' })).w);

    const dfd = {
      nodes: [
        { id: 'client', kind: 'external' as const, name: 'Client' },
        { id: 'proc', kind: 'process' as const, name: 'Place order' },
        { id: 'db', kind: 'store' as const, name: 'orders' },
      ],
      edges: [
        { from: 'client', to: 'proc' },
        { from: 'proc', to: 'db' },
      ],
    };
    expect(box(renderDfd(dfd)).w).toBeGreaterThan(box(renderDfd({ ...dfd, dir: 'TB' })).w);
  });
});
