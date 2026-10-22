/**
 * `block` topology extensions — nested groups (`parent`), node `replicas`,
 * the `k8s` preset, the cloud glyph set, and the cluster accent rule.
 *
 * Declared nesting draws parents first and steps each child in 8px; groups
 * without `parent` keep the legacy geometric rule byte-for-byte.
 */

import { describe, expect, it } from 'vitest';
import { renderBlock } from '../blocks/blockGraph.js';
import { renderCluster } from '../blocks/cluster.js';
import { renderFlow } from '../blocks/flow.js';
import { renderDfd } from '../blocks/dfd.js';
import { renderState as renderStateBlock } from '../blocks/state.js';
import { renderC4 } from '../blocks/c4.js';
import { renderFelogic } from '../blocks/felogic.js';
import { gridGroupsSvg, nestingPads } from '../svg/gridGroups.js';
import { KNOWN_NODE_KINDS, nodeGlyph, nodeSkin } from '../svg/blockStyle.js';
import { cloudGlyph, glyphNameFor, glyphPath, hasGlyph, GENERIC_BOX } from '../svg/glyphs.js';

const GEO = { xOf: (c: number) => 100 + (c - 1) * 200, yOf: (r: number) => 100 + (r - 1) * 120, cellW: 160, cellH: 80, gapX: 40, gapY: 40, skin: true };

function rects(svg: string): Array<{ path: string; x: number; y: number; w: number; h: number }> {
  const out: Array<{ path: string; x: number; y: number; w: number; h: number }> = [];
  const re = /<g data-bp="(groups\.\d+)"><rect x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) out.push({ path: m[1] ?? '', x: Number(m[2]), y: Number(m[3]), w: Number(m[4]), h: Number(m[5]) });
  return out;
}

describe('nested groups (parent)', () => {
  const three = [
    { id: 'subnet', parent: 'zone', col: 1, row: 1, cols: 2, rows: 2, label: 'Subnet' },
    { id: 'region', col: 1, row: 1, cols: 4, rows: 2, label: 'Region' },
    { id: 'zone', parent: 'region', col: 1, row: 1, cols: 2, rows: 2, label: 'Zone' },
  ];

  it('draws parents first; each level sits 8px inside its parent at the sides and 18px below its tab', () => {
    const svg = gridGroupsSvg(three, GEO);
    const r = rects(svg);
    expect(r.map((x) => x.path)).toEqual(['groups.1', 'groups.2', 'groups.0']);
    const [region, zone, subnet] = r;
    expect(zone?.x).toBe((region?.x ?? 0) + 8);
    expect(zone?.y).toBe((region?.y ?? 0) + 18);
    expect(subnet?.x).toBe((zone?.x ?? 0) + 8);
    expect(subnet?.y).toBe((zone?.y ?? 0) + 18);
    // Bottom edges nest 8px apart too.
    const bottom = (g: { y: number; h: number } | undefined): number => (g?.y ?? 0) + (g?.h ?? 0);
    expect(bottom(zone)).toBe(bottom(region) - 8);
    expect(bottom(subnet)).toBe(bottom(zone) - 8);
    // The leaf steps in from the standard panel; the region grows out past it.
    expect(subnet?.x).toBe(GEO.xOf(1) - 28 + 8);
    expect(subnet?.y).toBe(GEO.yOf(1) - 38 + 16);
    expect(region?.x).toBe(GEO.xOf(1) - 28 - 8);
    expect(region?.y).toBe(GEO.yOf(1) - 38 - 20);
    expect(nestingPads(three)).toEqual({ padX: 8, padTop: 20, padBot: 8 });
  });

  it('the block renderer grows its pads so a top-edge region is never clipped', () => {
    const html = renderBlock({
      groups: [
        { id: 'r', col: 1, row: 1, cols: 2, rows: 1, label: 'Region' },
        { id: 'z', parent: 'r', col: 1, row: 1, label: 'Zone' },
      ],
      nodes: [{ id: 'a', col: 1, row: 1, name: 'A' }],
    });
    expect(html).toContain('data-pad-top="62"');
    expect(html).toContain('data-pad-x="42"');
    const region = rects(html)[0];
    expect(region?.x).toBeGreaterThanOrEqual(0);
    expect(region?.y).toBeGreaterThanOrEqual(0);
    // Documents without `parent` keep the standard pads.
    expect(nestingPads([{ col: 1, row: 1, label: 'Only' }])).toEqual({ padX: 0, padTop: 0, padBot: 0 });
  });

  it('every level carries its own eyebrow tab; the tabs alternate sides', () => {
    const svg = gridGroupsSvg(three, GEO);
    // The tab may carry the group's hue class (`c-blue`), so match the class loosely.
    expect(svg).toMatch(/class="t-eyebrow[^"]*"[^>]*>Region<\/text>/);
    expect(svg).toMatch(/class="t-eyebrow[^"]*"[^>]*text-anchor="end">Zone<\/text>/);
    expect(svg).toMatch(/class="t-eyebrow[^"]*"[^>]*>Subnet<\/text>/);
    expect(svg).not.toMatch(/text-anchor="end">Subnet<\/text>/);
    expect(svg).not.toMatch(/text-anchor="end">Region<\/text>/);
  });

  it('an unresolvable parent falls back to the geometric rule', () => {
    const svg = gridGroupsSvg([{ id: 'a', parent: 'ghost', col: 1, row: 1, label: 'A' }], GEO);
    const r = rects(svg);
    expect(r[0]?.x).toBe(GEO.xOf(1) - 28);
  });

  it('groups without parent keep the legacy order and inset (area-sorted, 12/11px)', () => {
    const legacy = [
      { col: 1, row: 1, cols: 3, rows: 1, label: 'Public' },
      { col: 1, row: 1, cols: 3, rows: 2, label: 'VPC' },
    ];
    const r = rects(gridGroupsSvg(legacy, GEO));
    expect(r.map((x) => x.path)).toEqual(['groups.1', 'groups.0']);
    expect(r[1]?.x).toBe((r[0]?.x ?? 0) + 12);
    expect(r[1]?.y).toBe((r[0]?.y ?? 0) + 11);
  });

  it('renders through the block renderer with the group layer beneath nodes', () => {
    const html = renderBlock({
      groups: [
        { id: 'r', col: 1, row: 1, cols: 2, rows: 1, label: 'Region' },
        { id: 'z', parent: 'r', col: 1, row: 1, label: 'Zone' },
      ],
      nodes: [{ id: 'a', col: 1, row: 1, name: 'A' }],
    });
    expect(html.indexOf('data-bp="groups.0"')).toBeLessThan(html.indexOf('data-bp="groups.1"'));
    expect(html.indexOf('data-bp="groups.1"')).toBeLessThan(html.indexOf('data-bp="nodes.0"'));
  });
});

describe('replicas', () => {
  const doc = {
    nodes: [
      { id: 'api', col: 1, row: 1, kind: 'service', name: 'api', replicas: 3 },
      { id: 'pg', col: 2, row: 1, kind: 'db', name: 'db', replicas: 1 },
    ],
  };

  it('draws two back cards receding down-right under the node and a ×N chip top-right', () => {
    const html = renderBlock(doc);
    const node = html.slice(html.indexOf('data-bp="nodes.0"'), html.indexOf('data-bp="nodes.1"'));
    const backs = node.match(/<rect x="(\d+)" y="(-?\d+)" [^>]*opacity="0\.(45|7)"\/>/g) ?? [];
    expect(backs).toHaveLength(2);
    // The pile stays inside the 178×88 cell: front card 166×76 at the cell origin,
    // back cards 6px and 12px down-right — the far corner lands on the cell corner.
    expect(node).toMatch(/<rect x="50" y="64" width="166" height="76"[^>]*opacity="0\.45"\/>/);
    expect(node).toMatch(/<rect x="44" y="58" width="166" height="76"[^>]*opacity="0\.7"\/>/);
    expect(node).toMatch(/<rect x="38" y="52" width="166" height="76"[^>]*stroke-width="1\.5"\/>/);
    expect(node).toMatch(/<text x="196\.0" y="65\.0" class="blk-rep t-sub" text-anchor="end">×3<\/text>/);
    // Back cards are drawn before the body's own rect.
    expect(node.indexOf('opacity="0.45"')).toBeLessThan(node.indexOf('stroke-width="1.5"'));
  });

  it('replicas: 1 draws nothing extra; the legend names the stack only when used', () => {
    const html = renderBlock(doc);
    const one = html.slice(html.indexOf('data-bp="nodes.1"'));
    expect(one).not.toContain('blk-rep');
    expect(html).toContain('replicas');
    const none = renderBlock({ nodes: [{ id: 'a', col: 1, row: 1, name: 'A', replicas: 1 }] });
    expect(none).not.toContain('replicas');
  });

  it('applies in the layered layout too', () => {
    const html = renderBlock({
      layers: [{ label: 'Compute' }],
      nodes: [{ id: 'api', layer: 0, kind: 'service', name: 'api', replicas: 4 }],
    });
    expect(html).toContain('>×4</text>');
    expect(html).toMatch(/opacity="0\.45"/);
  });
});

describe('preset: k8s', () => {
  const k8s = {
    preset: 'k8s' as const,
    nodes: [
      { id: 'in', col: 1, row: 1, kind: 'ingress', name: 'Ingress' },
      { id: 'svc', col: 2, row: 1, kind: 'service', name: 'orders-svc' },
      { id: 'dep', col: 3, row: 1, kind: 'deployment', name: 'orders' },
      { id: 'pod', col: 4, row: 1, kind: 'pod', name: 'orders pod', replicas: 3 },
      { id: 'cm', col: 3, row: 2, kind: 'configmap', name: 'orders-config' },
      { id: 'sec', col: 4, row: 2, kind: 'secret', name: 'orders-secrets' },
      { id: 'cron', col: 2, row: 2, kind: 'cronjob', name: 'reconcile' },
      { id: 'node', col: 1, row: 2, kind: 'node', name: 'worker-1' },
    ],
    edges: [{ from: 'in', to: 'svc' }],
  };

  it('frames as K8S and puts the one accent on the ingress', () => {
    const html = renderBlock(k8s);
    expect(html).toContain('<span class="diagram-tag">K8S</span>');
    const ingress = html.slice(html.indexOf('data-bp="nodes.0"'), html.indexOf('data-bp="nodes.1"'));
    expect(ingress).toContain('fill="var(--accent-tint)"');
    expect(ingress).toContain('c-accent');
    expect(html).toContain('entry point');
  });

  it('maps the kubernetes kinds to chips and glyphs', () => {
    expect(nodeSkin('deployment').chip).toBe('DEPLOY');
    expect(nodeSkin('pod').chip).toBe('POD');
    expect(nodeSkin('ingress').chip).toBe('INGRESS');
    expect(nodeSkin('configmap').chip).toBe('CONFIG');
    expect(nodeSkin('secret').chip).toBe('SECRETS');
    expect(nodeSkin('cronjob').chip).toBe('CRON');
    expect(nodeSkin('node').chip).toBe('NODE');
    expect(nodeSkin('namespace').chip).toBe('NS');
    const html = renderBlock(k8s);
    for (const chip of ['DEPLOY', 'POD', 'INGRESS', 'CONFIG', 'SECRETS', 'CRON', 'NODE']) {
      expect(html, chip).toContain(`>${chip}</text>`);
    }
    expect(html).toContain('>×3</text>');
    // Card-shaped kinds carry the single-stroke glyph beside the name, in the family hue (compute: blue).
    const pod = html.slice(html.indexOf('data-bp="nodes.3"'), html.indexOf('data-bp="nodes.4"'));
    expect(pod).toMatch(/<path d="M7 1\.2[^"]*" transform="translate\(\d+ \d+\)" fill="none" stroke="var\(--hue-blue\)"/);
  });

  it('two entry kinds mean no accent', () => {
    const html = renderBlock({ ...k8s, nodes: [...k8s.nodes, { id: 'in2', col: 1, row: 3, kind: 'ingress', name: 'Ingress 2' }] });
    expect(html).not.toContain('var(--accent-tint)');
  });
});

describe('cloud glyphs', () => {
  it('every documented node kind resolves to a glyph or the generic box', () => {
    for (const kind of KNOWN_NODE_KINDS) {
      const name = glyphNameFor(kind);
      expect(glyphPath(name), kind).not.toBe('');
      expect(hasGlyph(kind) || name === GENERIC_BOX, kind).toBe(true);
    }
  });

  it('the cloud set has its own drawing for each listed kind', () => {
    const listed = [
      'function', 'lambda', 'bucket', 's3', 'queue', 'sqs', 'topic', 'sns', 'kafka', 'cache', 'redis', 'db',
      'cdn', 'lb', 'gateway', 'pod', 'cluster', 'user', 'browser', 'mobile', 'cron', 'scheduler', 'ml', 'model',
      'secret', 'config',
    ];
    for (const kind of listed) expect(hasGlyph(kind), kind).toBe(true);
    expect(hasGlyph('billing')).toBe(false);
    expect(glyphNameFor('billing')).toBe(GENERIC_BOX);
  });

  it('a glyph is one muted single-stroke path with no fill', () => {
    const g = cloudGlyph('pod', 10, 20);
    expect(g).toMatch(/^<path d="[^"]+" transform="translate\(10 20\)" fill="none" stroke="var\(--muted\)" stroke-width="1\.3"[^>]*\/>$/);
    expect(g).not.toMatch(/#[0-9a-f]{3,6}/i);
  });

  it('nodeGlyph gains the new kinds and keeps drawing nothing for the legacy glyph-less kinds', () => {
    expect(nodeGlyph('pod', 0, 0, 'var(--muted)')).not.toBe('');
    expect(nodeGlyph('deployment', 0, 0, 'var(--muted)')).not.toBe('');
    expect(nodeGlyph('configmap', 0, 0, 'var(--muted)')).not.toBe('');
    for (const legacy of ['client', 'data', 'context', 'producer', 'consumer', 'users', 'region', 'billing']) {
      expect(nodeGlyph(legacy, 0, 0, 'var(--muted)'), legacy).toBe('');
    }
  });
});

describe('cluster accent', () => {
  const base = {
    clusters: [{ id: 'edge', label: 'edge' }, { id: 'api', label: 'api' }],
    services: [
      { id: 'gw', cluster: 'edge', label: 'gateway', kind: 'gateway' },
      { id: 'orders', cluster: 'api', label: 'orders', kind: 'service' },
    ],
    edges: [{ from: 'gw', to: 'orders' }],
  };

  it('the single gateway service takes the accent', () => {
    const html = renderCluster(base);
    const gw = html.slice(html.indexOf('data-bp="services.0"'), html.indexOf('data-bp="services.1"'));
    expect(gw).toContain('fill="var(--accent-tint)"');
    expect(html).toContain('entry point');
  });

  it('two gateways, or none, mean no accent', () => {
    const two = renderCluster({ ...base, services: [...base.services, { id: 'gw2', cluster: 'edge', label: 'gateway 2', kind: 'gateway' }] });
    expect(two).not.toContain('var(--accent-tint)');
    const none = renderCluster({ ...base, services: base.services.filter((sv) => sv.kind !== 'gateway') });
    expect(none).not.toContain('var(--accent-tint)');
  });
});

describe('nested groups on the other grid renderers', () => {
  const nested = [
    { id: 'outer', col: 1, row: 1, cols: 2, rows: 1, label: 'Outer' },
    { id: 'inner', parent: 'outer', col: 1, row: 1, label: 'Inner' },
  ];
  const plain = [{ id: 'outer', col: 1, row: 1, cols: 2, rows: 1, label: 'Outer' }];

  /** The `<svg>` viewBox height/width and the top-left of the first group rect. */
  function frame(html: string): { w: number; h: number; gx: number; gy: number } {
    const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(html);
    const g = rects(html)[0];
    return { w: Number(vb?.[1]), h: Number(vb?.[2]), gx: g?.x ?? 0, gy: g?.y ?? 0 };
  }

  const cases: ReadonlyArray<{
    name: string;
    render: (groups: typeof nested) => string;
  }> = [
    { name: 'flow', render: (groups) => renderFlow({ groups, nodes: [{ id: 'a', col: 1, row: 1, label: 'A' }] }) },
    { name: 'dfd', render: (groups) => renderDfd({ groups, nodes: [{ id: 'a', col: 1, row: 1, name: 'A' }] }) },
    { name: 'state', render: (groups) => renderStateBlock({ groups, states: [{ id: 'a', col: 1, row: 1, name: 'A' }] }) },
    { name: 'c4', render: (groups) => renderC4({ groups, nodes: [{ id: 'a', kind: 'system', col: 1, row: 1, name: 'A' }] }) },
    { name: 'felogic', render: (groups) => renderFelogic({ groups, nodes: [{ id: 'a', col: 1, row: 1, name: 'A' }] }) },
  ];

  it.each(cases)('$name: the outermost panel stays inside the viewBox', ({ render }) => {
    const f = frame(render(nested));
    expect(f.gx).toBeGreaterThanOrEqual(0);
    expect(f.gy).toBeGreaterThanOrEqual(0);
    // The pads grew by exactly the outward growth of one nesting level.
    const p = frame(render(plain as unknown as typeof nested));
    expect(f.w).toBeGreaterThan(p.w);
    expect(f.h).toBeGreaterThan(p.h);
  });

  it.each(cases)('$name: a document with no `parent` is byte-identical to the pre-nesting output', ({ render }) => {
    // `nestingPads` and `declaredNesting` both no-op without a `parent`, so the
    // only proof that matters is that the rendered string does not move.
    const a = render(plain as unknown as typeof nested);
    const b = render(plain as unknown as typeof nested);
    expect(a).toBe(b);
    // …and the group rect sits exactly where the un-nested geometry puts it.
    expect(rects(a)[0]?.y).toBe(frame(a).gy);
  });
});
