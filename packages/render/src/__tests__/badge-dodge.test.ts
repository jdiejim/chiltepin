/**
 * Edge labels keep clear of node boxes: an edge midpoint can land ON a node
 * (a long edge passing a box in a tight auto-layout), which once printed a
 * circled numeral over the node's label (the "Ch②ge" bug). Labels now sit on
 * their own edge at a spot clear of every node box (+ clearance), so the
 * shape that reproduced the bug draws plain on-edge labels, none on a node.
 */

import { describe, expect, it } from 'vitest';
import { parseDocument } from 'chiltepin-core';
import { renderDocumentParts } from '../parts.js';

/** The exact shape that reproduced the bug: a vertical chain with a skip edge. */
const FLOW =
  '```flow\nnodes: [Receive, Lookup, Charge, Ack]\nedges:\n  - Receive -> Lookup: by key\n  - Lookup -> Ack: hit\n  - Lookup -> Charge: miss\n  - Charge -> Ack: record\n```\n';

interface R {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** All stroked `x/y/width/height` node boxes in the svg. */
function nodeBoxes(svg: string): R[] {
  return [...svg.matchAll(/<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)"[^>]*stroke/g)].map((m) => ({
    x: Number(m[1]),
    y: Number(m[2]),
    w: Number(m[3]),
    h: Number(m[4]),
  }));
}

/** The paper masks behind the edge labels. */
function labelMasks(svg: string): R[] {
  return [...svg.matchAll(/<g data-bp="edges\.\d+"[^>]*><g><rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)" fill="var\(--paper\)"\/>/g)].map(
    (m) => ({ x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) }),
  );
}

describe('edge labels keep clear of node boxes', () => {
  it('every label sits on its edge and no label mask overlaps a node box', () => {
    const { body } = renderDocumentParts(parseDocument(FLOW, 't'));
    const boxes = nodeBoxes(body);
    const masks = labelMasks(body);
    expect(boxes.length).toBeGreaterThanOrEqual(4);
    expect(masks.length).toBe(4); // 4 labelled edges, all on their edges
    expect(body).not.toContain('class="edge-steps"');
    for (const l of masks) {
      for (const r of boxes) {
        const overlap = l.x < r.x + r.w && r.x < l.x + l.w && l.y < r.y + r.h && r.y < l.y + l.h;
        expect(overlap, `label at (${l.x},${l.y}) overlaps node box (${r.x},${r.y},${r.w},${r.h})`).toBe(false);
      }
    }
  });
});
