/**
 * `spans` and `rollout` renderers: lanes / rows / chips / legend items land
 * where the skin says, the accent lands on the documented item, and no data
 * is dropped.
 */

import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { renderSpans } from '../blocks/spans.js';
import { renderRollout } from '../blocks/rollout.js';

const TRACE = {
  title: 'GET /orders/{id}',
  spans: [
    { id: 'get', name: 'GET /orders/{id}', service: 'api', start: 0, duration: 120, kind: 'server' as const },
    { id: 'auth', name: 'verify token', service: 'api', start: 4, duration: 10, parent: 'get' },
    { id: 'q1', name: 'SELECT orders', service: 'db', start: 18, duration: 40, parent: 'get', kind: 'db' as const },
    { id: 'c1', name: 'GET order:42', service: 'cache', start: 62, duration: 3, parent: 'get', kind: 'cache' as const },
    {
      id: 'pay',
      name: 'GET /payments/42',
      service: 'payments',
      start: 68,
      duration: 46,
      parent: 'get',
      kind: 'client' as const,
      error: true,
      attrs: { 'http.status': 502, retries: 1 },
      note: 'Upstream timed out.',
    },
    { id: 'pq', name: 'SELECT payment', service: 'db', start: 70, duration: 30, parent: 'pay', kind: 'db' as const },
  ],
};

const lanesOf = (html: string): string[] =>
  parse(html)
    .querySelectorAll('g.sp-lane text.t-name')
    .map((t) => t.text);

describe('spans', () => {
  it('draws one lane per service in first-appearance order and one bar per span', () => {
    const html = renderSpans(TRACE);
    expect(lanesOf(html)).toEqual(['api', 'db', 'cache', 'payments']);
    const bars = parse(html).querySelectorAll('g[data-bl="spans"] > g');
    expect(bars).toHaveLength(6);
    expect(bars.map((g) => g.getAttribute('data-bp'))).toEqual(['spans.0', 'spans.1', 'spans.2', 'spans.5', 'spans.3', 'spans.4']);
  });

  it('places bars by start and sizes them by duration on one scale', () => {
    const root = parse(renderSpans(TRACE));
    const rect = (bp: string): { x: number; w: number } => {
      const r = root.querySelector(`g[data-bp="${bp}"] rect.sp-bar`);
      return { x: Number(r?.getAttribute('x')), w: Number(r?.getAttribute('width')) };
    };
    const rootBar = rect('spans.0');
    const db = rect('spans.2');
    const cache = rect('spans.3');
    // 120 ms is the whole plot; 40 ms is a third of it; 3 ms still shows.
    expect(db.w / rootBar.w).toBeCloseTo(40 / 120, 2);
    expect(db.x - rootBar.x).toBeCloseTo((18 / 120) * rootBar.w, 2);
    expect(cache.w).toBeGreaterThanOrEqual(2);
  });

  it('lightens bars by depth and puts paper text on the dark fills', () => {
    const root = parse(renderSpans(TRACE));
    expect(root.querySelector('g[data-bp="spans.0"] rect.sp-bar')?.classNames).toContain('d0');
    expect(root.querySelector('g[data-bp="spans.1"] rect.sp-bar')?.classNames).toContain('d1');
    expect(root.querySelector('g[data-bp="spans.5"] rect.sp-bar')?.classNames).toContain('d2');
    // A name inside a muted bar is paper; inside an accent-tinted (critical
    // path) or paper-2 bar it is ink.
    expect(root.querySelector('g[data-bp="spans.2"] text[data-bp="spans.2.name"]')?.classNames).toContain('sp-on-dark');
    expect(root.querySelector('g[data-bp="spans.0"] text[data-bp="spans.0.name"]')?.classNames).toContain('c-ink');
    expect(root.querySelector('g[data-bp="spans.5"] text[data-bp="spans.5.name"]')?.classNames).toContain('c-ink');
  });

  it('gives the accent to the critical path — root, then the longest child at each hop', () => {
    const root = parse(renderSpans(TRACE));
    const crit = root.querySelectorAll('rect.sp-bar.crit').map((r) => r.parentNode.getAttribute('data-bp'));
    // get (120) → pay (46, the longest child) → pq (its only child).
    expect(crit).toEqual(['spans.0', 'spans.5', 'spans.4']);
  });

  it('marks an error with the negative outline and an ERR chip', () => {
    const root = parse(renderSpans(TRACE));
    const g = root.querySelector('g[data-bp="spans.4"]');
    expect(g?.querySelector('rect.sp-bar')?.classNames).toContain('err');
    expect(g?.querySelector('text.sp-chip-text.err')?.text).toBe('ERR');
  });

  it('draws one parent → child connector per child span', () => {
    expect(parse(renderSpans(TRACE)).querySelectorAll('path.sp-link')).toHaveLength(5);
  });

  it('labels every bar with its duration in the unit, and every name survives', () => {
    const html = renderSpans({ ...TRACE, unit: 's' });
    const root = parse(html);
    expect(root.querySelectorAll('text.sp-dur').map((t) => t.text)).toEqual(['120 s', '10 s', '40 s', '30 s', '3 s', '46 s']);
    for (const s of TRACE.spans) expect(root.querySelectorAll(`text[data-bp$=".name"]`).map((t) => t.text)).toContain(s.name);
    // A name that cannot fit its 3-second bar moves outside instead of being cut.
    const small = root.querySelector('g[data-bp="spans.3"]');
    const nameX = Number(small?.querySelector('text[data-bp="spans.3.name"]')?.getAttribute('x'));
    const barX = Number(small?.querySelector('rect.sp-bar')?.getAttribute('x'));
    const barW = Number(small?.querySelector('rect.sp-bar')?.getAttribute('width'));
    expect(nameX).toBeGreaterThan(barX + barW);
  });

  it('puts nice-number ticks on the axis in the unit', () => {
    const ticks = parse(renderSpans(TRACE))
      .querySelectorAll('g.sp-axis-g text')
      .map((t) => t.text);
    expect(ticks).toEqual(['0 ms', '20 ms', '40 ms', '60 ms', '80 ms', '100 ms', '120 ms']);
  });

  it('chips each lane with its dominant kind and lists the kinds in the legend', () => {
    const root = parse(renderSpans(TRACE));
    expect(root.querySelectorAll('g.sp-lane text.sp-chip-text').map((t) => t.text)).toEqual(['SVC', 'DB', 'CACHE', 'CLIENT']);
    const legend = root.querySelectorAll('.diagram-legend .lg-label').map((t) => t.text);
    // The root and the depth-2 span are on the critical path, so their depth
    // fills are never drawn — the legend lists only what is on the page.
    expect(legend).toEqual(['nested span', 'critical path', 'error', 'server', 'db', 'cache', 'client']);
    const flat = parse(
      renderSpans({
        spans: [
          { id: 'a', name: 'root', service: 'api', start: 0, duration: 10 },
          { id: 'b', name: 'leaf', service: 'db', start: 1, duration: 2, parent: 'a' },
          { id: 'c', name: 'other', service: 'db', start: 4, duration: 5, parent: 'a' },
          { id: 'd', name: 'deep', service: 'db', start: 5, duration: 1, parent: 'b' },
        ],
      }),
    )
      .querySelectorAll('.diagram-legend .lg-label')
      .map((t) => t.text);
    expect(flat).toEqual(['nested span', 'nested twice or more', 'critical path']);
  });

  it('lists attrs and notes under the drawing — nothing is dropped', () => {
    const root = parse(renderSpans(TRACE));
    const li = root.querySelector('.sp-details li[data-bp="spans.4"]');
    expect(li?.querySelectorAll('.sp-d-attr').map((t) => t.text)).toEqual(['http.status=502', 'retries=1']);
    expect(li?.querySelector('.sp-d-note')?.text).toBe('Upstream timed out.');
    expect(root.querySelectorAll('.sp-details li')).toHaveLength(1);
  });

  it('grows the canvas so a long trailing label never leaves the viewBox', () => {
    const name = 'a very long operation name that will not fit inside a two millisecond bar';
    const long = {
      spans: [
        { id: 'a', name: 'root', service: 'api', start: 0, duration: 100 },
        { id: 'b', name, service: 'api', start: 98, duration: 2, parent: 'a' },
      ],
    };
    const root = parse(renderSpans(long));
    const vb = root.querySelector('svg')?.getAttribute('viewBox')?.split(' ') ?? [];
    const width = Number(vb[2]);
    const text = root.querySelector('text[data-bp="spans.1.name"]');
    const x = Number(text?.getAttribute('x'));
    expect(x + name.length * 6).toBeLessThanOrEqual(width);
  });

  it('frames the drawing with the SPANS eyebrow and the title', () => {
    const html = renderSpans(TRACE);
    expect(html).toContain('>SPANS<');
    expect(html).toContain('GET /orders/{id}');
  });
});

const CANARY = {
  title: 'Checkout v2',
  strategy: 'canary' as const,
  stages: [
    { name: 'Smoke', traffic: 1, duration: '15m', gate: 'no 5xx', status: 'done' as const },
    { name: 'Canary', traffic: 10, duration: '30m', gate: 'error rate < 0.5%', status: 'current' as const, note: 'Two AZs.' },
    { name: 'Half', traffic: 50, duration: '1h', gate: 'p95 < 300ms', status: 'next' as const },
    { name: 'Full', traffic: 100, status: 'next' as const },
  ],
  rollback: 'Flip the flag off; the old version keeps serving.',
};

describe('rollout', () => {
  it('renders one card per stage, in order, with the name and a STAGE n eyebrow', () => {
    const root = parse(renderRollout(CANARY));
    const cards = root.querySelectorAll('.ro-strip > .ro-stage');
    expect(cards).toHaveLength(4);
    expect(cards.map((c) => c.querySelector('.ro-name')?.text)).toEqual(['Smoke', 'Canary', 'Half', 'Full']);
    expect(cards[2]?.querySelector('.ro-n')?.text).toBe('Stage 3');
  });

  it('draws a traffic bar proportional to traffic on every stage that has one', () => {
    const root = parse(renderRollout(CANARY));
    const widths = root.querySelectorAll('.ro-fill').map((f) => f.getAttribute('style'));
    expect(widths).toEqual(['width:1%', 'width:10%', 'width:50%', 'width:100%']);
    expect(root.querySelectorAll('.ro-pct').map((p) => p.text)).toEqual(['1%', '10%', '50%', '100%']);
    expect(parse(renderRollout({ stages: [{ name: 'A' }] })).querySelectorAll('.ro-fill')).toHaveLength(0);
  });

  it('encodes status by the shared chip vocabulary — current is the one accent', () => {
    const root = parse(renderRollout(CANARY));
    const cards = root.querySelectorAll('.ro-stage');
    expect(cards[0]?.classNames).toContain('ro-s-done');
    expect(cards[1]?.classNames).toContain('ro-s-current');
    expect(cards[2]?.classNames).toContain('ro-s-next');
    expect(root.querySelectorAll('.ro-stage.ro-s-current')).toHaveLength(1);
    expect(root.querySelectorAll('.ro-status').map((c) => c.text)).toEqual(['done', 'current', 'next', 'next']);
    expect(root.querySelector('.ro-status.ro-st-current')?.getAttribute('data-bp')).toBe('stages.1.status');
  });

  it('puts each gate as a chip on the connector to the next stage', () => {
    const root = parse(renderRollout(CANARY));
    const links = root.querySelectorAll('.ro-strip > .ro-link');
    // Three connectors between four stages; the last stage has no gate, so no trailing stub.
    expect(links).toHaveLength(3);
    expect(links.map((l) => l.querySelector('.ro-gate')?.text)).toEqual(['no 5xx', 'error rate < 0.5%', 'p95 < 300ms']);
    expect(links[1]?.querySelector('.ro-gate')?.getAttribute('data-bp')).toBe('stages.1.gate');
    // A gate on the last stage gets a trailing stub so it is never dropped.
    const tail = parse(renderRollout({ stages: [{ name: 'Only', gate: 'all green' }] }));
    expect(tail.querySelector('.ro-link.ro-link-end .ro-gate')?.text).toBe('all green');
  });

  it('keeps the duration, the note, and the rollback footer', () => {
    const root = parse(renderRollout(CANARY));
    expect(root.querySelectorAll('.ro-dur').map((d) => d.text)).toEqual(['15m', '30m', '1h']);
    expect(root.querySelector('.ro-note')?.text).toBe('Two AZs.');
    expect(root.querySelector('.ro-rollback')?.getAttribute('data-bp')).toBe('rollback');
    expect(root.querySelector('.ro-rollback-text')?.text).toBe('Flip the flag off; the old version keeps serving.');
  });

  it('lists the statuses present plus the gate chip in the legend', () => {
    const legend = parse(renderRollout(CANARY))
      .querySelectorAll('.diagram-legend .lg-label')
      .map((t) => t.text);
    expect(legend).toEqual(['done', 'current', 'next', 'gate — must pass to advance']);
    const blocked = parse(renderRollout({ stages: [{ name: 'A', status: 'blocked' }, { name: 'B', status: 'done' }] }))
      .querySelectorAll('.diagram-legend .lg-label')
      .map((t) => t.text);
    expect(blocked).toEqual(['done', 'blocked']);
  });

  it('frames the strip with the ROLLOUT eyebrow and the strategy', () => {
    const html = renderRollout(CANARY);
    expect(html).toContain('>ROLLOUT<');
    expect(html).toContain('<span class="diagram-tag-path">canary</span>');
  });
});
