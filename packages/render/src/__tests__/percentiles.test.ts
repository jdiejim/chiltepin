import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { BLOCK_TEMPLATES, parseDocument } from 'chiltepin-core';
import { renderPercentiles } from '../blocks/percentiles.js';
import type { BlockDataMap } from 'chiltepin-core';

type Data = BlockDataMap['percentiles'];

function catalog(): Data {
  const doc = parseDocument(BLOCK_TEMPLATES.percentiles, 'percentiles');
  const seg = doc.segments.find((s) => s.kind === 'percentiles');
  if (seg === undefined || seg.kind !== 'percentiles' || seg.data === null || seg.data === undefined) throw new Error('no template');
  return seg.data as Data;
}

const cx = (el: { getAttribute: (k: string) => string | undefined } | null): number => Number(el?.getAttribute('cx'));

describe('percentiles', () => {
  const data = catalog();
  const html = renderPercentiles(data);
  const root = parse(html);

  it('renders the catalog template with one row per series', () => {
    expect(root.querySelectorAll('g[data-bl="rows"] > g')).toHaveLength(3);
    expect(html).toContain('POST /payments');
  });

  it('marks POST /payments p99 as over the SLO', () => {
    const rows = root.querySelectorAll('g[data-bl="rows"] > g');
    const payments = rows[2];
    expect(payments?.getAttribute('data-over')).toBe('1');
    expect(payments?.querySelector('circle[data-bp="rows.2.p99"]')?.getAttribute('fill')).toBe('var(--negative)');
    // GET /cart (p99 90) is inside the SLO: its p99 keeps the accent.
    expect(rows[1]?.getAttribute('data-over')).toBeUndefined();
    expect(rows[1]?.querySelector('circle[data-bp="rows.1.p99"]')?.getAttribute('fill')).toBe('var(--accent)');
  });

  it('orders the dots left to right: p50 < p90 < p95 < p99 < max', () => {
    for (let i = 0; i < 3; i++) {
      const xs = ['p50', 'p90', 'p95', 'p99'].map((k) => cx(root.querySelector(`[data-bp="rows.${i}.${k}"]`)));
      const max = cx(root.querySelector(`g[data-bp="rows.${i}.max"] circle`));
      for (let k = 1; k < xs.length; k++) expect(xs[k]).toBeGreaterThan(xs[k - 1] ?? 0);
      expect(max).toBeGreaterThan(xs[3] ?? 0);
    }
  });

  it('draws the SLO rule with its label and unit-suffixed ticks', () => {
    expect(root.querySelector('g[data-bp="slo"] line')?.getAttribute('stroke-dasharray')).toBe('4 3');
    expect(html).toContain('SLO 300ms');
    expect(html).toMatch(/>\d+ms</);
  });

  it('keeps every dot inside the plot and prints no NaN or hex', () => {
    const vb = root.querySelector('svg')?.getAttribute('viewBox')?.split(' ').map(Number) ?? [];
    const w = vb[2] ?? 0;
    for (const c of root.querySelectorAll('circle')) {
      const x = cx(c);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(w);
    }
    expect(html).not.toMatch(/NaN/);
    expect(html).not.toMatch(/#[0-9a-f]{3,6}\b/i);
    expect(root.querySelector('.diagram-legend')?.text).toContain('p99 over the SLO');
  });

  it('spreads a long tail on a log scale with decade ticks', () => {
    const h = renderPercentiles({ ...data, scale: 'log' });
    expect(h).toContain('>10ms<');
    expect(h).toContain('>1k ms<');
    const r = parse(h);
    // On a log axis GET /cart's p50 (18) and p99 (90) sit further apart than on the linear axis.
    const linRoot = parse(renderPercentiles({ ...data, scale: 'linear' }));
    const lin = cx(linRoot.querySelector('[data-bp="rows.1.p99"]')) - cx(linRoot.querySelector('[data-bp="rows.1.p50"]'));
    const log = cx(r.querySelector('[data-bp="rows.1.p99"]')) - cx(r.querySelector('[data-bp="rows.1.p50"]'));
    expect(log).toBeGreaterThan(lin);
  });

  it('draws a row SLO as a short rule across that row only', () => {
    const h = renderPercentiles({ rows: [{ label: 'a', p50: 10, p99: 50, slo: 40 }, { label: 'b', p50: 10, p99: 20 }] });
    const r = parse(h);
    expect(r.querySelector('[data-bp="rows.0.slo"]')).not.toBeNull();
    expect(r.querySelector('g[data-bp="slo"]')).toBeNull();
    expect(r.querySelectorAll('g[data-bl="rows"] > g')[0]?.getAttribute('data-over')).toBe('1');
  });
});
