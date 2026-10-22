import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { BLOCK_TEMPLATES, parseDocument } from 'chiltepin-core';
import { renderPerfbudget, perfStatus } from '../blocks/perfbudget.js';
import type { BlockDataMap } from 'chiltepin-core';

type Data = BlockDataMap['perfbudget'];

function catalog(): Data {
  const doc = parseDocument(BLOCK_TEMPLATES.perfbudget, 'perfbudget');
  const seg = doc.segments.find((s) => s.kind === 'perfbudget');
  if (seg === undefined || seg.kind !== 'perfbudget' || seg.data === null || seg.data === undefined) throw new Error('no template');
  return seg.data as Data;
}

describe('perfbudget', () => {
  const data = catalog();
  const html = renderPerfbudget(data);
  const root = parse(html);

  it('renders the catalog template with one row per metric', () => {
    expect(root.querySelectorAll('g[data-bl="metrics"] > g')).toHaveLength(5);
    expect(html).toContain('Product page — web vitals');
    expect(html).toContain('p75, mobile, 4G, 30-day field data');
  });

  it('derives over / near / ok per row, honouring lowerIsBetter', () => {
    const statuses = root.querySelectorAll('g[data-bl="metrics"] > g').map((g) => g.getAttribute('data-status'));
    // LCP ok, INP over, CLS ok, JS near (285 / 300), Lighthouse over (84 < 90, higher is better).
    expect(statuses).toEqual(['ok', 'over', 'ok', 'near', 'over']);
    expect(data.metrics.map(perfStatus)).toEqual(['ok', 'over', 'ok', 'near', 'over']);
  });

  it('counts the statuses in the footer and colours the bars by status', () => {
    // INP misses a ceiling (over); Lighthouse misses a floor (below).
    expect(root.querySelectorAll('.pb-foot span').map((sp) => sp.text.trim())).toEqual(['1 over', '1 below', '1 near', '2 ok']);
    const bars = root.querySelectorAll('rect[data-bp$=".measured"]').map((r) => r.getAttribute('fill'));
    // Near is a warning (amber), never the accent; a miss is negative.
    expect(bars).toEqual(['var(--muted)', 'var(--negative)', 'var(--muted)', 'var(--hue-amber)', 'var(--negative)']);
  });

  it('puts the budget mark at one x for every row and scales bars against it', () => {
    const mark = root.querySelector('line[stroke-dasharray="4 3"]');
    const bx = Number(mark?.getAttribute('x1'));
    expect(Number.isFinite(bx)).toBe(true);
    const bars = root.querySelectorAll('rect[data-bp$=".measured"]');
    const x0 = Number(bars[0]?.getAttribute('x'));
    const ends = bars.map((r) => x0 + Number(r.getAttribute('width')));
    // INP (260 / 200) crosses the mark; LCP (2140 / 2500) stays short of it.
    expect(ends[1]).toBeGreaterThan(bx);
    expect(ends[0]).toBeLessThan(bx);
    // Lighthouse is over but its bar is shorter than the mark (higher is better).
    expect(ends[4]).toBeLessThan(bx);
  });

  it('prints the measured value with its unit and the budget under the label', () => {
    expect(html).toContain('>2,140ms<');
    expect(html).toContain('budget ≤ 2,500ms');
    expect(html).toContain('budget ≥ 90');
    expect(html).toContain('>0.04<');
  });

  it('has a legend, no NaN, and no hex', () => {
    expect(root.querySelector('.diagram-legend')).not.toBeNull();
    expect(html).not.toMatch(/NaN/);
    expect(html).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  });

  it('cuts a bar that runs off the track instead of growing past it', () => {
    const h = renderPerfbudget({ metrics: [{ metric: 'TTFB', budget: 100, measured: 900, unit: 'ms' }] });
    const r = parse(h);
    const bar = r.querySelector('rect[data-bp="metrics.0.measured"]');
    const track = r.querySelector('rect[data-decorative]');
    expect(Number(bar?.getAttribute('width'))).toBeLessThanOrEqual(Number(track?.getAttribute('width')));
    expect(h).toContain('>900ms<');
  });
});
