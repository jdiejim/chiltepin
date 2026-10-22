/**
 * System-design `block` diagrams: request steps (`edges[].step`) drawn as a
 * circled numeral set with the edge label, named request paths
 * (`edges[].path`) drawn in one category hue with a legend entry each, and
 * the silhouettes that keep a cache and a worker from reading as `replicas`.
 */

import { describe, expect, it } from 'vitest';
import { renderBlock, edgeAnchorRect } from '../blocks/blockGraph.js';
import { edgeLabelLayer } from '../svg/edgeSteps.js';
import { nodeSkin } from '../svg/blockStyle.js';
import { renderCluster } from '../blocks/cluster.js';

type Box = { x: number; y: number; w: number; h: number };

/** The `<g data-bp="…">` group whose content starts at `from` (the first one after it). */
function group(html: string, path: string, from = 0): string {
  const i = html.indexOf(`<g data-bp="${path}"`, from);
  if (i < 0) return '';
  let depth = 0;
  const re = /<g[\s>]|<\/g>/g;
  re.lastIndex = i;
  for (let m = re.exec(html); m !== null; m = re.exec(html)) {
    depth += m[0] === '</g>' ? -1 : 1;
    if (depth === 0) return html.slice(i, m.index + 4);
  }
  return html.slice(i);
}

/** The label overlay group of edge `ei` (drawn after the nodes). */
function labelGroup(html: string, ei: number): string {
  return group(html, `edges.${ei}`, html.indexOf('data-bl="nodes"'));
}

/** Every step badge in `svg`: centre and number. */
function badges(svg: string): Array<{ cx: number; cy: number; n: number; cls: string; stroke: string }> {
  return [
    ...svg.matchAll(
      /<circle cx="([\d.]+)" cy="([\d.]+)" r="8" fill="var\(--paper\)" stroke="([^"]+)"[^>]*\/><text [^>]*class="t-badge([^"]*)">(\d+)<\/text>/g,
    ),
  ].map((m) => ({ cx: Number(m[1]), cy: Number(m[2]), stroke: m[3] ?? '', cls: m[4] ?? '', n: Number(m[5]) }));
}

/** The body rect of each card-shaped node (its first `<rect>`). */
function nodeRects(html: string, count: number): Box[] {
  const out: Box[] = [];
  for (let i = 0; i < count; i++) {
    const m = /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/.exec(group(html, `nodes.${i}`));
    if (m !== null) out.push({ x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) });
  }
  return out;
}

/** The polyline points of edge `ei`'s route. */
function routePoints(html: string, ei: number): Array<{ x: number; y: number }> {
  const m = new RegExp(`<path d="([^"]+)"[^>]*data-bp="edges\\.${ei}"/>`).exec(html);
  const nums = [...(m?.[1] ?? '').matchAll(/-?[\d.]+/g)].map((n) => Number(n[0]));
  const pts: Array<{ x: number; y: number }> = [];
  for (let k = 0; k + 1 < nums.length; k += 2) pts.push({ x: nums[k] ?? 0, y: nums[k + 1] ?? 0 });
  return pts;
}

/** True when (x, y) lies on the polyline within `tol` px. */
function onRoute(pts: Array<{ x: number; y: number }>, x: number, y: number, tol = 1.5): boolean {
  for (let k = 0; k + 1 < pts.length; k++) {
    const a = pts[k] as { x: number; y: number };
    const b = pts[k + 1] as { x: number; y: number };
    const inX = x >= Math.min(a.x, b.x) - tol && x <= Math.max(a.x, b.x) + tol;
    const inY = y >= Math.min(a.y, b.y) - tol && y <= Math.max(a.y, b.y) + tol;
    if (inX && inY && (Math.abs(a.x - b.x) < 0.5 || Math.abs(a.y - b.y) < 0.5)) return true;
  }
  return false;
}

const overlaps = (a: Box, b: Box): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const SHORTENER = {
  nodes: [
    { id: 'web', col: 1, row: 1, kind: 'browser', name: 'checkout-web' },
    { id: 'api', col: 2, row: 1, kind: 'service', name: 'links-api' },
    { id: 'cache', col: 3, row: 1, kind: 'cache', name: 'link cache' },
    { id: 'db', col: 3, row: 2, kind: 'service', name: 'links-store' },
  ],
  edges: [
    { from: 'web', to: 'api', label: 'GET /abc', step: 1 },
    { from: 'api', to: 'cache', label: 'lookup', step: 2 },
    { from: 'api', to: 'db', step: 3 },
  ],
};

describe('request steps on block edges', () => {
  it('draws each step as a numeral on its own edge, never on a node', () => {
    const html = renderBlock(SHORTENER);
    const rects = nodeRects(html, 4);
    SHORTENER.edges.forEach((e, ei) => {
      const found = badges(labelGroup(html, ei));
      expect(found.map((b) => b.n), `edges.${ei}`).toEqual([e.step]);
      const b = found[0] as { cx: number; cy: number };
      expect(onRoute(routePoints(html, ei), b.cx, b.cy), `edges.${ei} badge on its route`).toBe(true);
      const box = { x: b.cx - 8, y: b.cy - 8, w: 16, h: 16 };
      for (const r of rects) expect(overlaps(box, r), `edges.${ei} badge clear of nodes`).toBe(false);
    });
  });

  it('sets the numeral just before its label, as one unit, and keeps the label', () => {
    const html = renderBlock(SHORTENER);
    const g = labelGroup(html, 1);
    const b = badges(g)[0] as { cx: number; cy: number; cls: string; stroke: string };
    const t = /<text x="([\d.]+)" y="([\d.]+)" class="t-arrow"[^>]*>lookup<\/text>/.exec(g);
    expect(t).not.toBeNull();
    // Same line, numeral first, the mask's left edge right after the badge.
    expect(Math.abs(Number(t?.[2]) - 3.5 - b.cy)).toBeLessThan(0.6);
    expect(Number(t?.[1])).toBeGreaterThan(b.cx + 8);
    // An authored step is an ink badge; a fallback numeral stays muted.
    expect(b.stroke).toBe('var(--ink)');
    expect(b.cls).toBe(' c-ink');
  });

  it('two numerals never overlap, and no label covers a numeral', () => {
    const html = renderBlock(SHORTENER);
    const all = badges(html.slice(html.indexOf('data-bl="nodes"')));
    expect(all).toHaveLength(3);
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i] as { cx: number; cy: number };
        const c = all[j] as { cx: number; cy: number };
        expect(Math.hypot(a.cx - c.cx, a.cy - c.cy)).toBeGreaterThanOrEqual(16);
      }
  });

  it('a stepped label with no clear place keeps its numeral and lists the words under that number', () => {
    // Two nodes leave a 4px slot around each route: no label fits, so the words move to the step list.
    const layer = edgeLabelLayer(
      [
        { lx: 50, ly: 10, points: [{ x: 40, y: 10 }, { x: 60, y: 10 }], label: 'a label far too long for this edge', path: 'edges.0', step: 7 },
        { lx: 50, ly: 60, points: [{ x: 40, y: 60 }, { x: 60, y: 60 }], label: 'also far too long here', path: 'edges.1' },
      ],
      [
        { x: 0, y: 0, w: 48, h: 80 },
        { x: 52, y: 0, w: 100, h: 80 },
      ],
      { skin: true },
    );
    expect(layer.fallbacks).toEqual(['edges.0', 'edges.1']);
    expect(layer.overlay).toMatch(/class="t-badge c-ink">7<\/text>/);
    // A stand-in numeral never repeats an authored step: it counts on from 7.
    expect(layer.overlay).toMatch(/class="t-badge">8<\/text>/);
    expect(layer.legend).toContain('<b>7</b>a label far too long for this edge');
    expect(layer.legend).toContain('<b>8</b>also far too long here');
  });

  it('without steps the label layer draws exactly what it did before', () => {
    const pending = [{ lx: 100, ly: 10, points: [{ x: 0, y: 10 }, { x: 200, y: 10 }], label: 'reads', path: 'edges.0' }];
    const layer = edgeLabelLayer(pending, [], { skin: true });
    expect(layer.overlay).not.toContain('<circle');
    expect(layer.overlay).toContain('>reads</text>');
  });

  it('steps work in the layered mode too', () => {
    const html = renderBlock({
      layers: [{ label: 'Clients' }, { label: 'Services' }],
      nodes: [
        { id: 'web', layer: 0, kind: 'browser', name: 'checkout-web' },
        { id: 'api', layer: 1, kind: 'service', name: 'links-api' },
      ],
      edges: [{ from: 'web', to: 'api', label: 'GET /abc', step: 1 }],
    });
    expect(badges(labelGroup(html, 0)).map((b) => b.n)).toEqual([1]);
  });
});

describe('named request paths', () => {
  const PATHS = {
    nodes: [
      { id: 'web', col: 1, row: 1, kind: 'browser', name: 'checkout-web' },
      { id: 'lb', col: 2, row: 1, kind: 'service', name: 'edge-router' },
      { id: 'read', col: 3, row: 1, kind: 'service', name: 'read-api' },
      { id: 'write', col: 3, row: 2, kind: 'service', name: 'write-api' },
    ],
    edges: [
      { from: 'web', to: 'lb', label: 'GET', step: 1, path: 'read' },
      { from: 'lb', to: 'read', step: 2, path: 'read' },
      { from: 'lb', to: 'write', label: 'POST', step: 3, path: 'write path', kind: 'dashed' as const },
      { from: 'write', to: 'read', label: 'rejects', kind: 'error' as const, path: 'write path' },
    ],
  };

  it('draws each path in its own hue, with matching heads and numerals', () => {
    const html = renderBlock(PATHS);
    expect(html).toMatch(/<path d="[^"]+" fill="none" stroke="var\(--hue-blue\)"[^>]*marker-end="url\(#skPath-blue\)" data-bp="edges\.0"\/>/);
    expect(html).toMatch(/<path d="[^"]+" fill="none" stroke="var\(--hue-blue\)"[^>]*marker-end="url\(#skPath-blue\)" data-bp="edges\.1"\/>/);
    // The second path takes amber; a dashed edge keeps its dash and gets the open head.
    expect(html).toMatch(/stroke="var\(--hue-amber\)" stroke-width="1\.5" stroke-dasharray="5 4" marker-end="url\(#skPathOpen-amber\)" data-bp="edges\.2"/);
    expect(html).toContain('<marker id="skPath-blue"');
    expect(html).toContain('<marker id="skPathOpen-amber"');
    expect(badges(labelGroup(html, 0))[0]?.cls).toBe(' c-blue');
    expect(badges(labelGroup(html, 2))[0]?.stroke).toBe('var(--hue-amber)');
  });

  it('an error edge on a path stays negative', () => {
    const html = renderBlock(PATHS);
    expect(html).toMatch(/stroke="var\(--negative\)"[^>]*marker-end="url\(#skErr\)" data-bp="edges\.3"/);
  });

  it('the legend names each path once, and drops "calls" when every solid edge is on a path', () => {
    const html = renderBlock(PATHS);
    const legend = html.slice(html.indexOf('class="diagram-legend"'));
    expect(legend.match(/>read path</g)).toHaveLength(1);
    expect(legend.match(/>write path</g)).toHaveLength(1);
    expect(legend).toContain('stroke="var(--hue-blue)"');
    expect(legend).not.toContain('>calls<');
    expect(legend).toContain('>async / optional<');
  });

  it('no path means no hue, no path markers and no path legend', () => {
    const html = renderBlock(SHORTENER);
    expect(html).not.toContain('skPath');
    expect(html).not.toMatch(/stroke="var\(--hue-[a-z]+\)"[^>]*data-bp="edges/);
    expect(html).toContain('>calls<');
  });
});

describe('a cache and a worker never read as replicas', () => {
  const doc = (extra: Record<string, unknown> = {}) =>
    renderBlock({
      nodes: [
        { id: 'c', col: 1, row: 1, kind: 'cache', name: 'session cache', ...extra },
        { id: 'w', col: 2, row: 1, kind: 'worker', name: 'email sender', ...extra },
        { id: 's', col: 3, row: 1, kind: 'service', name: 'orders-api', replicas: 3 },
      ],
    });
  const backCards = (g: string): number => (g.match(/opacity="0\.(45|7)"\/>/g) ?? []).length;

  it('a cache is one memory card: contacts along its base, no pile', () => {
    const html = doc();
    const cache = group(html, 'nodes.0');
    expect(cache).toContain('class="blk-pins"');
    expect(backCards(cache)).toBe(0);
    // The replica pile belongs to `replicas` alone.
    expect(backCards(group(html, 'nodes.2'))).toBe(2);
  });

  it('the label keeps clear of the contacts', () => {
    const cache = group(doc({ tech: 'Redis 7 cluster' }), 'nodes.0');
    const pinTop = Math.min(...[...cache.matchAll(/<rect x="[\d.]+" y="([\d.]+)" width="4" height="7"/g)].map((m) => Number(m[1])));
    const lastText = Math.max(...[...cache.matchAll(/<text x="[\d.]+" y="([\d.]+)" class="blk-(?:name|tech)/g)].map((m) => Number(m[1])));
    expect(lastText).toBeLessThan(pinTop);
  });

  it('a cache with replicas draws the pile behind the memory card', () => {
    const cache = group(doc({ replicas: 3 }), 'nodes.0');
    expect(cache).toContain('class="blk-pins"');
    expect(backCards(cache)).toBe(2);
    expect(cache).toContain('>×3</text>');
  });

  it('in a cluster the contacts give way to the replica bars along the base', () => {
    const html = renderCluster({
      clusters: [{ id: 'data', label: 'data namespace' }],
      services: [
        { id: 'r', cluster: 'data', label: 'redis', kind: 'cache', replicas: 2 },
        { id: 'm', cluster: 'data', label: 'memcached', kind: 'cache' },
      ],
    });
    expect(group(html, 'services.0')).not.toContain('class="blk-pins"');
    expect(group(html, 'services.0')).toContain('×2');
    expect(group(html, 'services.1')).toContain('class="blk-pins"');
  });

  it('a worker is a single card with its own chip and a gear, not a pile', () => {
    const html = doc();
    const worker = group(html, 'nodes.1');
    expect(backCards(worker)).toBe(0);
    expect(worker).toContain('>WORKER</text>');
    expect(nodeSkin('worker')).toMatchObject({ chip: 'WORKER', hue: 'blue' });
    expect(nodeSkin('service').chip).toBe('SVC');
    expect(html).toContain('>worker<');
  });
});

describe('arrows meet the drawn shape', () => {
  const cell = { x: 100, y: 50, w: 178, h: 88 };

  it('a function arrow ends on its circle, a padlock arrow on its body, a shard arrow on the cylinders', () => {
    const fn = edgeAnchorRect('function', cell);
    expect(fn.w).toBe(fn.h);
    expect(fn.x).toBeGreaterThan(cell.x + 20);
    expect(fn.x + fn.w / 2).toBe(cell.x + cell.w / 2);
    const vault = edgeAnchorRect('secrets', cell);
    expect(vault.x).toBeGreaterThan(cell.x + 20);
    expect(vault.x + vault.w).toBeLessThan(cell.x + cell.w - 20);
    expect(edgeAnchorRect('shards', cell)).toEqual({ x: cell.x + 12, y: cell.y, w: cell.w - 24, h: cell.h });
  });

  it('a cloud chip sits inside the outline, over the name', () => {
    const html = renderBlock({ nodes: [{ id: 'cdn', col: 1, row: 1, kind: 'cdn', name: 'storefront CDN' }] });
    const chip = /<text x="([\d.]+)" y="([\d.]+)" class="blk-chip t-eyebrow[^"]*" text-anchor="middle">EDGE<\/text>/.exec(html);
    expect(chip).not.toBeNull();
    const name = /<text x="[\d.]+" y="([\d.]+)" class="blk-name/.exec(html);
    // Cell top is 52; the chip sits half way down, the name under it.
    expect(Number(chip?.[2])).toBeGreaterThan(52 + 88 * 0.45);
    expect(Number(name?.[1])).toBeGreaterThan(Number(chip?.[2]));
  });
});
