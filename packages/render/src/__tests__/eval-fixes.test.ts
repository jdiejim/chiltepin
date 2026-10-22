/**
 * Renderer fixes found by the generation eval (evals/generate, 2026-09-13):
 * wide drawings scroll instead of shrinking, gantt period heads never collide,
 * a long quadrant axis label never clips, and a state numeral never sits on a
 * state box.
 */

import { describe, expect, it } from 'vitest';
import { parseDocument } from 'chiltepin-core';
import { renderDocument } from '../index.js';
import { renderGantt } from '../blocks/gantt.js';
import { renderQuadrant } from '../blocks/quadrant.js';
import { renderState } from '../blocks/state.js';

const doc = (kind: string, body: string): string =>
  renderDocument(parseDocument('```' + kind + '\n' + body + '\n```\n', 't'));

describe('wide drawings keep their natural size', () => {
  it('a 12-state machine gets a scrolling stage; a small one still fits', () => {
    const states = Array.from({ length: 12 }, (_, i) => `  - { id: s${i}, col: ${i + 1}, row: 1, name: S${i} }`).join('\n');
    const wide = doc('state', `states:\n${states}\ntransitions:\n  - s0 -> s1: go`);
    expect(wide).toContain('class="diagram-stage diagram-stage--wide"');
    expect(wide).toMatch(/<svg[^>]*style="width:calc\(\d+px \* var\(--scale,1\)\);max-width:none"/);
    const small = doc('state', `states:\n  - { id: a, col: 1, row: 1, name: A }\n  - { id: b, col: 2, row: 1, name: B }\ntransitions:\n  - a -> b: go`);
    expect(small).not.toContain('class="diagram-stage diagram-stage--wide"');
    expect(small).toMatch(/<svg[^>]*style="max-width:min\(100%,/);
  });
});

describe('gantt period heads', () => {
  it('widen the columns, stagger onto two rows, and cut with a title only past that', () => {
    const periods = ['S1 · Jul 1-14', 'S2 · Jul 15-28', 'S3 · Jul 29 - Aug 11 (frozen)', 'S4 · Aug 12-25'];
    const svg = renderGantt({ periods, tasks: [{ label: 'A', start: 0, span: 2 }] });
    // two head rows: the y values alternate
    const ys = [...svg.matchAll(/class="t-eyebrow" text-anchor="middle">(?:<title>[^<]*<\/title>)?[^<]*<\/text>/g)].length;
    expect(ys).toBe(4);
    expect(svg).toMatch(/y="22"[^>]*class="t-eyebrow"/); // staggered row
    expect(svg).toMatch(/y="36"[^>]*class="t-eyebrow"/); // base row
    // The columns grow for the longest head: it shows whole, with no cut.
    expect(svg).toContain('>S3 · Jul 29 - Aug 11 (frozen)</text>');
    expect(svg).not.toContain('<title>S3');
    const huge = 'Sprint 3 · July 29 to August 11 · release freeze for the payments platform';
    const cut = renderGantt({ periods: ['S1', huge], tasks: [{ label: 'A', start: 0, span: 2 }] });
    expect(cut).toContain(`<title>${huge}</title>`); // cut, full text kept
    expect(cut).toMatch(/…<\/text>/);
    const short = renderGantt({ periods: ['Q1', 'Q2'], tasks: [{ label: 'A', start: 0, span: 1 }] });
    expect(short).not.toContain('<title>Q1');
    expect(short).toMatch(/y="22"[^>]*class="t-eyebrow"/);
  });
});

describe('quadrant axis labels', () => {
  it('a long y-axis endpoint label widens the left gutter instead of clipping', () => {
    const svg = renderQuadrant({
      yAxis: { label: 'Consistency', high: 'Drifts everywhere', low: 'Nothing' },
      items: [{ x: 0.5, y: 0.5, label: 'A' }],
    });
    const m = /<text x="(-?[\d.]+)" y="[\d.]+" class="t-sub c-soft" text-anchor="end"[^>]*>Drifts everywhere/.exec(svg);
    expect(m).not.toBeNull();
    const x = Number(m?.[1]);
    // end-anchored text of 17 chars at ~6.2px must start inside the viewBox
    expect(x - 17 * 6.2).toBeGreaterThanOrEqual(0);
    expect(svg).toMatch(/viewBox="0 0 6\d\d 440"/); // wider than the 580 default
  });
});

describe('state transition labels', () => {
  it('a short transition whose midpoint lands on a neighbouring state keeps its label off the box', () => {
    // start → TRIALING (col 2) and start → ACTIVE (col 3): the second edge's
    // midpoint falls on the TRIALING box.
    const svg = renderState({
      states: [
        { id: 's0', col: 1, row: 1, name: 'S0', kind: 'start' },
        { id: 'trial', col: 2, row: 1, name: 'TRIALING' },
        { id: 'active', col: 3, row: 1, name: 'ACTIVE' },
        { id: 'past', col: 4, row: 1, name: 'PAST_DUE' },
      ],
      transitions: [
        { from: 's0', to: 'trial', event: 'create' },
        { from: 's0', to: 'active', event: 'create paid' },
        { from: 'trial', to: 'active', event: 'trial ends' },
        { from: 'active', to: 'past', event: 'fails' },
      ],
    });
    const rects = [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" rx="23"/g)].map((m) => ({
      x: Number(m[1]),
      y: Number(m[2]),
      w: Number(m[3]),
      h: Number(m[4]),
    }));
    // Each label sits on its own transition (a paper mask), never a numeral.
    const masks = [
      ...svg.matchAll(/<g data-bp="transitions\.\d+"[^>]*><g><rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="([\d.]+)" fill="var\(--paper\)"/g),
    ].map((m) => ({ x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) }));
    expect(rects.length).toBe(3);
    expect(masks.length).toBe(4);
    expect(svg).not.toMatch(/<circle cx="[\d.]+" cy="[\d.]+" r="8"/);
    for (const l of masks) {
      for (const r of rects) {
        const overlap = l.x < r.x + r.w && r.x < l.x + l.w && l.y < r.y + r.h && r.y < l.y + l.h;
        expect(overlap, `label at ${l.x},${l.y} sits on a state box`).toBe(false);
      }
    }
  });
});
