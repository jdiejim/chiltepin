import { describe, expect, it } from 'vitest';
import { ortho } from '../svg/ortho.js';
import { renderDfd } from '../blocks/dfd.js';

/** The `d` of every arrow path in the svg. */
const arrows = (html: string): string[] =>
  [...html.matchAll(/<path d="([^"]+)" fill="none"[^>]*marker-end/g)].map((m) => m[1] ?? '');

/** The last point of a path `d` (`… L x y`). */
const endOf = (d: string): string => /(-?\d+) (-?\d+)$/.exec(d)?.slice(1).join(',') ?? '';

describe('ortho (the public single-edge helper)', () => {
  it('lane 0 is byte-identical to the pre-lane route', () => {
    const A = { x: 0, y: 0, w: 100, h: 50 };
    const B = { x: 200, y: 0, w: 100, h: 50 };
    expect(ortho(A, B)).toEqual(ortho(A, B, 0));
    expect(ortho(A, B)).toEqual(ortho(A, B, 0, 0));
    expect(ortho(A, B).d).toBe('M 100 25 H 150 V 25 H 200');
  });

  it('opposite lanes produce two distinct parallel routes', () => {
    const A = { x: 0, y: 0, w: 100, h: 50 };
    const B = { x: 200, y: 0, w: 100, h: 50 };
    const ab = ortho(A, B, -1);
    const ba = ortho(B, A, 1);
    expect(ab.d).not.toBe(ba.d);
    // 10px per lane → label midpoints sit 20px apart, clear of each other.
    expect(Math.abs(ab.ly - ba.ly)).toBe(20);
  });
});

describe('grid renderers spread shared sides (the router)', () => {
  it('a dfd with two edges into one node draws two arrowheads at distinct entry points', () => {
    const fanIn = renderDfd({
      nodes: [
        { id: 'a', col: 1, row: 1, kind: 'process', name: 'A' },
        { id: 'c', col: 1, row: 2, kind: 'process', name: 'C' },
        { id: 'b', col: 2, row: 1, kind: 'process', name: 'B' },
        { id: 'd', col: 3, row: 1, kind: 'process', name: 'D' },
        { id: 'e', col: 4, row: 1, kind: 'process', name: 'E' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'c', to: 'b' },
        { from: 'd', to: 'e' },
      ],
    });
    const ds = arrows(fanIn);
    expect(ds.length).toBe(3);
    expect(endOf(ds[0] ?? '')).not.toBe('');
    expect(endOf(ds[0] ?? '')).not.toBe(endOf(ds[1] ?? ''));
    // The lone d→e edge is a straight line, the same as in a fan-in-free render.
    const solo = renderDfd({
      nodes: [
        { id: 'd', col: 3, row: 1, kind: 'process', name: 'D' },
        { id: 'e', col: 4, row: 1, kind: 'process', name: 'E' },
      ],
      edges: [{ from: 'd', to: 'e' }],
    });
    expect(ds[2]).toBe(arrows(solo)[0]);
    expect(ds[2]).toMatch(/^M \d+ \d+ L \d+ \d+$/);
  });

  it('a dfd with A→B and B→A emits two different edge paths', () => {
    const html = renderDfd({
      nodes: [
        { id: 'a', col: 1, row: 1, kind: 'process', name: 'A' },
        { id: 'b', col: 2, row: 1, kind: 'process', name: 'B' },
      ],
      edges: [
        { from: 'a', to: 'b', label: 'push' },
        { from: 'b', to: 'a', label: 'pull' },
      ],
    });
    const ds = arrows(html);
    expect(ds.length).toBe(2);
    expect(ds[0]).not.toBe(ds[1]);
  });
});
