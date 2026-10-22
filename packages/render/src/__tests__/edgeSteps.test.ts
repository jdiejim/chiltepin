/**
 * The one labelled-edge rule shared by every edge-bearing diagram renderer:
 * each label sits ON its own edge (`.t-arrow` on a paper mask, inside the
 * edge's `data-bp` group), however many labelled edges the diagram has. A
 * circled numeral plus a legend entry is only the per-edge last resort for a
 * label with no clear place (see `router.test.ts`); `state` lists such a
 * numeral against its transition table instead of a second legend.
 */

import { describe, expect, it } from 'vitest';
import { renderDfd } from '../blocks/dfd.js';
import { renderFlow } from '../blocks/flow.js';
import { renderGraph } from '../blocks/graph.js';
import { renderState } from '../blocks/state.js';
import { renderSwimlane } from '../blocks/swimlane.js';
import { renderUml } from '../blocks/uml.js';
import { renderFelogic } from '../blocks/felogic.js';

const chain = (n: number): { nodes: Array<{ id: string; name: string; col: number; row: number }>; edges: Array<{ from: string; to: string; label: string }> } => {
  const nodes = Array.from({ length: n + 1 }, (_, i) => ({
    id: `n${i}`,
    name: `Node ${i}`,
    col: i + 1,
    row: 1,
  }));
  const edges = Array.from({ length: n }, (_, i) => ({
    from: `n${i}`,
    to: `n${i + 1}`,
    label: `step ${i}`,
  }));
  return { nodes, edges };
};

/** The text of the `.t-arrow` label drawn inside the `data-bp="<path>"` group. */
function labelOn(html: string, path: string): string {
  const m = new RegExp(`<g data-bp="${path.replace('.', '\\.')}"[^>]*><g><rect[^>]*/>((?:<text[^>]*class="t-arrow[^"]*"[^>]*>[^<]*</text>)+)</g></g>`).exec(html);
  if (m === null || m[1] === undefined) return '';
  return [...m[1].matchAll(/>([^<]*)<\/text>/g)].map((t) => t[1]).join(' ');
}

describe('edge labels sit on their own edge (no numeral legend)', () => {
  it('dfd keeps every label on its edge, at any count', () => {
    const { nodes, edges } = chain(6);
    const html = renderDfd({ nodes, edges });
    expect(html).not.toContain('class="edge-steps"');
    for (let i = 0; i < 6; i++) expect(labelOn(html, `edges.${i}`)).toBe(`step ${i}`);
  });

  it('flow puts each label on its edge, error tint kept, reveal step kept', () => {
    const nodes = [
      { id: 'a', label: 'A', col: 1, row: 1 },
      { id: 'b', label: 'B', col: 2, row: 1 },
      { id: 'c', label: 'C', col: 3, row: 1 },
      { id: 'd', label: 'D', col: 4, row: 1 },
      { id: 'e', label: 'E', col: 5, row: 1 },
      { id: 'f', label: 'F', col: 6, row: 1 },
    ];
    const edges = [
      { from: 'a', to: 'b', label: 'one' },
      { from: 'b', to: 'c' }, // unlabelled: draws no label
      { from: 'c', to: 'd', label: 'two' },
      { from: 'd', to: 'e', label: 'three' },
      { from: 'e', to: 'f', label: 'no', kind: 'error' as const },
    ];
    const html = renderFlow({ nodes, edges });
    expect(html).not.toContain('class="edge-steps"');
    expect(labelOn(html, 'edges.0')).toBe('one');
    expect(labelOn(html, 'edges.1')).toBe('');
    expect(labelOn(html, 'edges.3')).toBe('three');
    // The label reveals with its edge; the error label keeps the negative tint.
    expect(html).toContain('<g data-bp="edges.4" data-reveal="5"><g>');
    expect(html).toMatch(/class="t-arrow c-negative"[^>]*>no</);
  });

  it('graph shows the weighted "label · w" text on the edge', () => {
    const nodes = Array.from({ length: 5 }, (_, i) => ({ id: `n${i}`, label: `N${i}`, col: i + 1, row: 1 }));
    const edges = Array.from({ length: 4 }, (_, i) => ({ from: `n${i}`, to: `n${i + 1}`, label: `hop${i}`, weight: i + 1 }));
    const html = renderGraph({ nodes, edges });
    expect(html).not.toContain('class="edge-steps"');
    expect(labelOn(html, 'edges.0')).toBe('hop0 · 1');
  });

  it('swimlane keeps link labels on the links (links.N paths)', () => {
    const lanes = [{ label: 'One' }, { label: 'Two' }];
    const steps = [
      { id: 's1', col: 1, lane: 0, label: 'A' },
      { id: 's2', col: 2, lane: 0, label: 'B' },
      { id: 's3', col: 3, lane: 1, label: 'C' },
      { id: 's4', col: 4, lane: 1, label: 'D' },
      { id: 's5', col: 5, lane: 0, label: 'E' },
    ];
    const links = [
      { from: 's1', to: 's2', label: 'l1' },
      { from: 's2', to: 's3', label: 'l2' },
      { from: 's3', to: 's4', label: 'l3' },
      { from: 's4', to: 's5', label: 'l4' },
    ];
    const html = renderSwimlane({ lanes, steps, links });
    expect(html).not.toContain('class="edge-steps"');
    expect(labelOn(html, 'links.2')).toBe('l3');
  });

  it('uml puts relation labels on the relation lines (rels.N paths)', () => {
    const classes = Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, name: `C${i}` }));
    const rels = Array.from({ length: 4 }, (_, i) => ({ from: `c${i}`, to: `c${i + 1}`, label: `rel${i}` }));
    const html = renderUml({ classes, rels });
    expect(html).not.toContain('class="edge-steps"');
    expect(labelOn(html, 'rels.1')).toBe('rel1');
  });

  it('felogic follows the same rule with edges.N paths', () => {
    const nodes = Array.from({ length: 5 }, (_, i) => ({ id: `m${i}`, name: `Mod ${i}`, col: i + 1, row: 1 }));
    const edges = Array.from({ length: 4 }, (_, i) => ({ from: `m${i}`, to: `m${i + 1}`, label: `call${i}` }));
    const html = renderFelogic({ nodes, edges });
    expect(html).not.toContain('class="edge-steps"');
    expect(labelOn(html, 'edges.0')).toBe('call0');
  });

  it('state keeps transition labels on the arrows and the plain table (no № column)', () => {
    const states = [
      { id: 'a', name: 'A', col: 1, row: 1 },
      { id: 'b', name: 'B', col: 2, row: 1 },
      { id: 'c', name: 'C', col: 3, row: 1 },
      { id: 'd', name: 'D', col: 4, row: 1 },
      { id: 'e', name: 'E', col: 5, row: 1 },
    ];
    const transitions = [
      { from: 'a', to: 'b', event: 'go1' },
      { from: 'b', to: 'c', event: 'go2' },
      { from: 'c', to: 'd', event: 'go3' },
      { from: 'd', to: 'e', event: 'go4' },
    ];
    const html = renderState({ states, transitions });
    expect(html).not.toContain('class="edge-steps"');
    expect(html).not.toContain('<th>№</th>');
    expect(labelOn(html, 'transitions.2')).toBe('go3');
    // The table row still twins with its arrow.
    expect(html).toContain('<tr data-bp="transitions.2" data-reveal="2">');
  });

  it('a long label wraps to two lines on its edge instead of moving to a legend', () => {
    const nodes = [
      { id: 'a', label: 'A', col: 1, row: 1 },
      { id: 'b', label: 'B', col: 2, row: 1 },
    ];
    const html = renderFlow({ nodes, edges: [{ from: 'a', to: 'b', label: 'retry with backoff' }] });
    expect(labelOn(html, 'edges.0').replace(/\s+/g, ' ')).toBe('retry with backoff');
    expect(html).not.toContain('class="edge-steps"');
  });
});
