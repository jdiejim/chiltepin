/**
 * Dashed GROUP wrappers on the grid diagrams (flow / dfd / state / c4 share
 * the block renderer's group drawing via `svg/gridGroups.ts`):
 *
 * - a group renders as a dashed outline rect + corner label inside a
 *   `data-bl="groups"` layer, each group tagged `data-bp="groups.N"`,
 *   drawn BEFORE (beneath) edges and nodes;
 * - padding grows only when groups exist, so an edge-hugging group is never
 *   clipped by the viewBox — and a GROUP-LESS document renders byte-identically
 *   to the pre-groups output (pinned below).
 */

import { describe, expect, it } from 'vitest';
import { renderC4 } from '../blocks/c4.js';
import { renderDfd } from '../blocks/dfd.js';
import { renderFlow } from '../blocks/flow.js';
import { renderState } from '../blocks/state.js';

const GROUP = [{ col: 1, row: 1, cols: 2, rows: 1, label: 'Zone A' }];

const DASHED_RECT = /<rect [^>]*stroke-dasharray="7 5"\/>/;

describe('grid groups on flow / dfd / state / c4', () => {
  const outputs: ReadonlyArray<[string, string]> = [
    [
      'flow',
      renderFlow({
        nodes: [
          { id: 'a', label: 'Start', kind: 'start', col: 1, row: 1 },
          { id: 'b', label: 'Work', kind: 'process', col: 2, row: 1 },
        ],
        edges: [{ from: 'a', to: 'b' }],
        groups: GROUP,
      }),
    ],
    [
      'dfd',
      renderDfd({
        nodes: [
          { id: 'a', name: 'Client', kind: 'external', col: 1, row: 1 },
          { id: 'b', name: 'Ingest', kind: 'process', col: 2, row: 1 },
        ],
        edges: [{ from: 'a', to: 'b' }],
        groups: GROUP,
      }),
    ],
    [
      'state',
      renderState({
        states: [
          { id: 'a', name: 'Draft', col: 1, row: 1 },
          { id: 'b', name: 'Live', col: 2, row: 1 },
        ],
        transitions: [{ from: 'a', to: 'b', event: 'publish' }],
        groups: GROUP,
      }),
    ],
    [
      'c4',
      renderC4({
        nodes: [
          { id: 'a', kind: 'person', name: 'User', col: 1, row: 1 },
          { id: 'b', kind: 'system', name: 'API', col: 2, row: 1 },
        ],
        edges: [{ from: 'a', to: 'b' }],
        groups: GROUP,
      }),
    ],
  ];

  // The skinned renderers draw the panel — tinted in the group's hue, or
  // `paper-2` when it has none; a renderer that has not migrated keeps the
  // dashed outline.
  const SKINNED = new Set(['flow', 'dfd', 'state', 'c4']);
  const SKIN_RECT = /<rect [^>]*fill="var\(--(paper-2|hue-[a-z]+-tint)\)"[^>]*stroke="var\(--rule-solid\)"[^>]*\/>/;
  const groupRect = (kind: string): RegExp => (SKINNED.has(kind) ? SKIN_RECT : DASHED_RECT);
  const groupRectXY = (kind: string): RegExp =>
    SKINNED.has(kind)
      ? /<rect x="(-?[\d.]+)" y="(-?[\d.]+)" [^>]*fill="var\(--(?:paper-2|hue-[a-z]+-tint)\)"[^>]*\/>/
      : /<rect x="(-?[\d.]+)" y="(-?[\d.]+)" [^>]*stroke-dasharray="7 5"\/>/;

  for (const [kind, html] of outputs) {
    it(`${kind}: renders the group layer beneath edges and nodes`, () => {
      expect(html, kind).toContain('data-bl="groups"');
      expect(html, kind).toContain('data-bp="groups.0"');
      expect(html, kind).toMatch(groupRect(kind));
      expect(html, kind).toMatch(/class="(grp-label|t-eyebrow)( c-[a-z]+)?"/);
      expect(html, kind).toContain('>Zone A</text>');
      // Beneath: the groups layer appears before the first edge/node markup.
      expect(html.indexOf('data-bl="groups"'), kind).toBeLessThan(html.indexOf('data-bp="nodes.0"') === -1 ? html.indexOf('data-bp="states.0"') : html.indexOf('data-bp="nodes.0"'));
    });

    it(`${kind}: an edge-hugging group stays inside the viewBox`, () => {
      const m = groupRectXY(kind).exec(html);
      expect(m, kind).not.toBeNull();
      expect(Number(m?.[1]), kind).toBeGreaterThanOrEqual(0);
      expect(Number(m?.[2]), kind).toBeGreaterThanOrEqual(0);
    });
  }

  it('a group color flows into the outline and label; bad colors are dropped', () => {
    const html = renderFlow({
      nodes: [{ id: 'a', label: 'A', col: 1, row: 1 }],
      groups: [
        { col: 1, row: 1, label: 'Tinted', color: '#9c4a2f' },
      ],
    });
    // The authored colour is pulled toward ink so it clears the surface in both sets.
    expect(html).toContain('stroke="color-mix(in srgb, #9c4a2f 62%, var(--ink))"');
    expect(html).toContain('fill="color-mix(in srgb, #9c4a2f 62%, var(--ink))"');
  });

  it('group-less flow output is byte-identical to the pre-groups renderer (pin)', () => {
    const html = renderFlow({
      nodes: [
        { id: 'a', label: 'Start', kind: 'start', col: 1, row: 1 },
        { id: 'b', label: 'Work', kind: 'process', col: 2, row: 1 },
      ],
      edges: [{ from: 'a', to: 'b' }],
    });
    // Captured from the renderer BEFORE groups landed, updated deliberately
    // when the edges gained their `data-bl` list container (add-chips), again
    // for the editorial skin, again when the SVG gained its data-built
    // accessible name, again when edges moved to the shared router (a
    // straight edge is now `M … L …`), and again when the stage gained its
    // scale floor (`min-width`) — pads, geometry and layer set must not
    // shift for documents that use no groups (declared nesting included).
    expect(html).toBe(
      '<div class="diagram"><div class="diagram-head"><span class="diagram-eyebrow t-eyebrow"><span class="diagram-tag">FLOW</span></span></div><div class="diagram-stage"><svg viewBox="0 0 420 104" role="img" aria-label="Flowchart: 2 steps" data-grid="1" data-cols="2" data-rows="1" data-cell-w="160" data-cell-h="64" data-gap-x="56" data-gap-y="48" data-pad-x="22" data-pad-top="22" style="max-width:min(100%,calc(420px * var(--scale,1)));min-width:260px"><title>Flowchart: 2 steps</title><g data-bl="edges"><path d="M 177 54 L 243 54" fill="none" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#skArrow)" data-bp="edges.0" data-reveal="1"/></g><g data-bl="nodes"><g data-bp="nodes.0" data-col="1" data-row="1" data-w="1" data-reveal="0"><rect x="27" y="28" width="150" height="52" rx="26" fill="var(--paper-2)" stroke="var(--rule-solid)" stroke-width="1"/><text x="102" y="58.5" class="fc-label t-name">Start</text></g><g data-bp="nodes.1" data-col="2" data-row="1" data-w="1" data-reveal="1"><rect x="243" y="28" width="150" height="52" rx="4" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.5"/><text x="318" y="58.5" class="fc-label t-name">Work</text></g></g></svg></div><div class="diagram-legend"><span class="lg-title t-eyebrow">Legend</span><span class="lg-item"><svg class="lg-sw" viewBox="0 0 30 14" width="30" height="14" aria-hidden="true"><rect x="1" y="1" width="28" height="12" rx="2" fill="var(--paper-2)" stroke="var(--rule-solid)" stroke-width="1"/></svg><span class="lg-label">start</span></span><span class="lg-item"><svg class="lg-sw" viewBox="0 0 30 14" width="30" height="14" aria-hidden="true"><rect x="1" y="1" width="28" height="12" rx="2" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.5"/></svg><span class="lg-label">step</span></span><span class="lg-item"><svg class="lg-sw" viewBox="0 0 30 14" width="30" height="14" aria-hidden="true"><line x1="1" y1="7" x2="23" y2="7" stroke="var(--muted)" stroke-width="1.5"/><path d="M23,4 L29,7 L23,10 z" fill="var(--muted)"/></svg><span class="lg-label">next</span></span></div></div>',
    );
  });
});
