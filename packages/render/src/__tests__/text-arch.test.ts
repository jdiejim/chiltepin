/**
 * No silent cuts in the architecture renderers (`uml`, `pkg`, `frontend`,
 * `dfd`, `threatmodel`, `wireframe`). Long, realistic names — PascalCase
 * components, dotted packages, snake_case tables, full method signatures —
 * wrap at their joints and grow their box; text that still does not fit ends
 * with "…", keeps its full text in a `<title>`, and reaches the geometry
 * report as `label-truncated` with the field's data path.
 */

import { describe, expect, it } from 'vitest';
import { parse, type HTMLElement } from 'node-html-parser';
import { geometryReport, type GeometryReport } from '../geometryReport.js';
import { renderUml } from '../blocks/uml.js';
import { renderPkg } from '../blocks/pkg.js';
import { renderFrontend } from '../blocks/frontend.js';
import { renderDfd } from '../blocks/dfd.js';
import { renderThreatmodel } from '../blocks/threatmodel.js';
import { renderWireframe } from '../blocks/wireframe.js';
import { FONT, textWidth } from '../svg/wrapText.js';

const report = (type: string, data: unknown): GeometryReport =>
  (geometryReport as (t: string, d: unknown) => GeometryReport)(type, data);

const cutPaths = (r: GeometryReport): string[] =>
  r.issues.filter((i) => i.kind === 'label-truncated').map((i) => i.path ?? '');

/** The text of an element without its `<title>`. */
const shown = (el: HTMLElement | null | undefined): string =>
  (el?.childNodes ?? [])
    .filter((n) => !(n instanceof Object && 'tagName' in n && (n as HTMLElement).tagName === 'TITLE'))
    .map((n) => n.text)
    .join('');

const num = (el: HTMLElement | null | undefined, a: string): number => Number(el?.getAttribute(a));

describe('uml (F7): members wrap with a hanging indent inside their class', () => {
  const SIG = '+ authorise(intent: PaymentIntent, idempotencyKey: string): Promise<AuthorisationResult>';
  const data = {
    classes: [
      {
        id: 'svc',
        name: 'PaymentAuthorisationService',
        stereotype: 'service',
        attrs: ['- gateway: PaymentServiceProviderGatewayClient'],
        methods: [SIG, '+ capture(id: string): void'],
      },
      { id: 'sepa', name: 'SepaDirectDebitPaymentMethod', attrs: ['- iban: String'] },
      { id: 'intent', name: 'PaymentIntent', attrs: ['+ id: string'] },
    ],
    rels: [
      { from: 'svc', to: 'intent', kind: 'composition' as const, label: 'contains 1..*' },
      { from: 'sepa', to: 'intent', kind: 'association' as const },
    ],
  };
  const root = parse(renderUml(data));
  const box = (ci: number): { x: number; y: number; w: number; h: number } => {
    const r = root.querySelector(`[data-bp="classes.${ci}"] rect`);
    return { x: num(r, 'x'), y: num(r, 'y'), w: num(r, 'width'), h: num(r, 'height') };
  };

  it('keeps the visibility marker on line one and sets every body line at the indent after it', () => {
    const t = root.querySelector('[data-bp="classes.0.methods.0"]');
    const spans = t?.querySelectorAll('tspan') ?? [];
    expect(spans.length).toBeGreaterThan(1);
    const xs = spans.map((s) => num(s, 'x'));
    // All body lines share one x, right of the text inset by the marker's width.
    expect(new Set(xs).size).toBe(1);
    expect(xs[0]).toBeCloseTo(box(0).x + 12 + textWidth('+ ', FONT.sub), 1);
    // Nothing is lost: marker + body lines spell the whole signature.
    expect(`+ ${spans.map((s) => s.text).join(' ')}`.replace(/\s+/g, ' ')).toBe(SIG);
  });

  it('never sets a member line wider than its class box', () => {
    const b = box(0);
    for (const t of root.querySelectorAll('[data-bp="classes.0"] text.t-sub')) {
      const spans = t.querySelectorAll('tspan');
      const lines = spans.length > 0 ? spans.map((s) => ({ x: num(s, 'x'), text: s.text })) : [{ x: num(t, 'x'), text: t.text }];
      for (const ln of lines) expect(ln.x + textWidth(ln.text, FONT.sub)).toBeLessThanOrEqual(b.x + b.w - 11.5);
    }
  });

  it('sizes a class by its name at the 13px / 600 metric', () => {
    expect(box(1).w).toBeGreaterThanOrEqual(textWidth('SepaDirectDebitPaymentMethod', FONT.name) + 24);
  });

  it('lays classes out so no two boxes overlap', () => {
    const rects = [0, 1, 2].map(box);
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i] as { x: number; y: number; w: number; h: number };
        const b = rects[j] as { x: number; y: number; w: number; h: number };
        const hit = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(hit, `classes ${i} and ${j}`).toBe(false);
      }
  });

  it('keeps the composition ◆ clear of its edge label', () => {
    const path = root.querySelector('path[data-bp="rels.0"]');
    const m = /^M([\d.]+),([\d.]+) L([\d.]+),([\d.]+)/.exec(path?.getAttribute('d') ?? '');
    expect(m).not.toBeNull();
    const [ax, ay, bx, by] = [Number(m?.[1]), Number(m?.[2]), Number(m?.[3]), Number(m?.[4])];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    // The diamond spans 6–17px out from the box along the first segment.
    const tip = { x: ax + ((bx - ax) / len) * 17, y: ay + ((by - ay) / len) * 17 };
    const mask = root.querySelector('g[data-bp="rels.0"] rect');
    const l = { x: num(mask, 'x'), y: num(mask, 'y'), w: num(mask, 'width'), h: num(mask, 'height') };
    const inside = (p: { x: number; y: number }): boolean => p.x >= l.x && p.x <= l.x + l.w && p.y >= l.y && p.y <= l.y + l.h;
    expect(inside({ x: ax, y: ay })).toBe(false);
    expect(inside(tip)).toBe(false);
  });

  it('leaves a member that fits untouched (one plain <text>)', () => {
    expect(renderUml(data)).toContain('class="t-sub c-ink" data-bp="classes.0.methods.1">+ capture(id: string): void</text>');
  });

  it('cuts a member past four lines with "…", a <title>, and a label-truncated report', () => {
    const huge = `+ ${'reconcile(ledgerEntry: LedgerEntry, settlementBatch: SettlementBatch) '.repeat(5).trim()}`;
    const cut = { classes: [{ id: 'a', name: 'Ledger', methods: [huge] }] };
    const t = parse(renderUml(cut)).querySelector('[data-bp="classes.0.methods.0"]');
    expect(t?.querySelector('title')?.text).toBe(huge);
    expect(t?.querySelectorAll('tspan').at(-1)?.text.endsWith('…')).toBe(true);
    expect(cutPaths(report('uml', cut))).toEqual(['classes.0.methods.0']);
  });
});

describe('pkg: dotted names wrap at the dots and members fit the folder', () => {
  const data = {
    packages: [
      {
        id: 'a',
        col: 1,
        row: 1,
        name: 'com.example.checkout.payments.adapters',
        contains: ['StripePaymentGatewayAdapter', 'payment_webhook_signature_verifier'],
      },
      { id: 'b', col: 2, row: 1, name: 'domain', contains: ['Order'] },
    ],
    deps: [{ from: 'a', to: 'b', kind: 'import' as const }],
  };
  const root = parse(renderPkg(data));

  it('breaks a long package name after its dots, every part present, no title (nothing cut)', () => {
    const name = root.querySelector('[data-bp="packages.0.name"]');
    const parts = name?.querySelectorAll('tspan').map((t) => t.text) ?? [];
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts.slice(0, -1)) expect(p.endsWith('.')).toBe(true);
    expect(parts.join('')).toBe('com.example.checkout.payments.adapters');
    expect(name?.querySelector('title')).toBeNull();
  });

  it('grows the folder width so the longest member sits inside it', () => {
    const r = root.querySelector('[data-bp="packages.0"] rect');
    const w = num(r, 'width');
    expect(w).toBeGreaterThanOrEqual(textWidth('payment_webhook_signature_verifier', FONT.sub) + 20);
    expect(root.querySelector('[data-bp="packages.0.contains.1"]')?.text).toBe('payment_webhook_signature_verifier');
    expect(cutPaths(report('pkg', data))).toEqual([]);
  });

  it('reports the members past the cap, named in the "+n more" title', () => {
    const many = { packages: [{ id: 'a', name: 'a', contains: Array.from({ length: 14 }, (_, i) => `member${i + 1}`) }] };
    expect(cutPaths(report('pkg', many))).toEqual(['packages.0.contains.12', 'packages.0.contains.13']);
  });
});

describe('frontend: PascalCase names break at a capital and the card grows', () => {
  const data = {
    nodes: [
      { id: 'app', name: 'CheckoutApplicationShellProvider', kind: 'root' as const, note: 'wraps auth and feature flags' },
      { id: 'layout', parent: 'app', name: 'AuthenticatedCheckoutLayoutWithSidebar', kind: 'layout' as const, note: 'two-column layout with sticky summary' },
      { id: 'hook', parent: 'app', name: 'usePaymentIntentWithRetries', kind: 'hook' as const, note: 'polls intent status every 2 s' },
    ],
  };
  const root = parse(renderFrontend(data));

  it('splits the name at a camelCase boundary, keeps every part, and fits the card', () => {
    const g = root.querySelector('[data-bp="nodes.1"]');
    const card = g?.querySelector('rect');
    const names = g?.querySelectorAll('text.t-name').map((t) => shown(t)) ?? [];
    expect(names.length).toBeGreaterThan(1);
    expect(names.join('')).toBe('AuthenticatedCheckoutLayoutWithSidebar');
    expect(names[1]?.[0]).toMatch(/[A-Z]/);
    const w = num(card, 'width');
    for (const n of names) expect(textWidth(n, FONT.name)).toBeLessThanOrEqual(w - 24);
  });

  it('wraps the note inside the card instead of spilling past it', () => {
    const g = root.querySelector('[data-bp="nodes.1"]');
    const card = g?.querySelector('rect');
    const notes = g?.querySelectorAll('text.t-sub').map((t) => shown(t)) ?? [];
    expect(notes.join(' ')).toBe('two-column layout with sticky summary');
    for (const n of notes) expect(textWidth(n, FONT.sub)).toBeLessThanOrEqual(num(card, 'width') - 24);
    const last = g?.querySelectorAll('text').at(-1);
    expect(num(last, 'y')).toBeLessThan(num(card, 'y') + num(card, 'height') - 2);
    expect(cutPaths(report('frontend', data))).toEqual([]);
  });

  it('cuts a name past its caps with "…", a <title>, and a report', () => {
    const cut = { nodes: [{ id: 'x', name: 'An extremely long component name that keeps going and going well past every reasonable cap' }] };
    const t = parse(renderFrontend(cut)).querySelector('[data-bp="nodes.0"] text.t-name');
    expect(t?.querySelector('title')?.text).toBe(cut.nodes[0]?.name);
    expect(cutPaths(report('frontend', cut))).toEqual(['nodes.0.name']);
  });
});

describe('dfd and threatmodel: identifier names wrap at their joints', () => {
  const dfd = {
    nodes: [
      { id: 'p', col: 1, row: 1, name: 'Validate payment details and create the payment intent', kind: 'process' as const },
      { id: 's', col: 2, row: 1, name: 'payment_intents_postgresql_table', kind: 'store' as const },
    ],
    edges: [{ from: 'p', to: 's', label: 'intent row' }],
  };

  it('dfd: breaks a snake_case table name after an underscore, inside the cell', () => {
    const g = parse(renderDfd(dfd)).querySelector('[data-bp="nodes.1.name"]');
    const lines = g?.querySelectorAll('text').map((t) => t.text) ?? [];
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0]?.endsWith('_')).toBe(true);
    expect(lines.join('')).toBe('payment_intents_postgresql_table');
    for (const ln of lines) expect(textWidth(ln, FONT.name)).toBeLessThanOrEqual(148 - 18);
    expect(cutPaths(report('dfd', dfd))).toEqual([]);
  });

  it('dfd: a name past four lines ends with "…", carries a <title>, and is reported', () => {
    const name = 'Validate the payment details, create the payment intent, then notify the ledger and the fraud service';
    const cut = { nodes: [{ id: 'p', col: 1, row: 1, name, kind: 'process' as const }] };
    const g = parse(renderDfd(cut)).querySelector('[data-bp="nodes.0.name"]');
    expect(g?.querySelector('title')?.text).toBe(name);
    expect(g?.querySelectorAll('text').at(-1)?.text.endsWith('…')).toBe(true);
    expect(cutPaths(report('dfd', cut))).toEqual(['nodes.0.name']);
  });

  it('threatmodel: grows the cell for a four-line name and reports nothing', () => {
    const tm = {
      nodes: [{ id: 'api', col: 1, row: 1, name: 'Payment authorisation API gateway for mobile banking clients', kind: 'process' as const }],
    };
    const root = parse(renderThreatmodel(tm));
    const lines = root.querySelectorAll('[data-bp="nodes.0.name"] text').map((t) => t.text);
    expect(lines.join(' ')).toBe('Payment authorisation API gateway for mobile banking clients');
    const h = num(root.querySelector('[data-bp="nodes.0"] rect'), 'height');
    expect(h).toBe(66 + (lines.length - 1) * 14);
    expect(cutPaths(report('threatmodel', tm))).toEqual([]);
  });
});

describe('wireframe: labels wrap or cut visibly, inside their element and frame', () => {
  const data = {
    screens: [
      {
        device: 'browser' as const,
        url: 'https://admin.example.com/billing/subscriptions/past-due?sort=oldest&page=3',
        elements: [
          { type: 'header' as const, label: 'Past-due subscriptions awaiting a payment retry this week' },
          { type: 'tabs' as const, label: 'Saved cards, New card, PayPal, Apple Pay' },
          { type: 'button' as const, label: 'Retry every failed card payment now' },
        ],
      },
    ],
  };
  const html = renderWireframe(data);
  const root = parse(html);

  it('wraps a long header to more lines and grows its element', () => {
    const lines = root.querySelectorAll('[data-bp="screens.0.elements.0"] text.wf-h').map((t) => t.text);
    expect(lines.length).toBe(2);
    expect(lines.join(' ')).toBe('Past-due subscriptions awaiting a payment retry this week');
    for (const ln of lines) expect(textWidth(ln, { size: 18, weight: 700 })).toBeLessThanOrEqual(380);
  });

  it('cuts a long url with "…", keeps it whole in a <title>, and reports `screens.0.url`', () => {
    const url = root.querySelector('[data-bp="screens.0.url"]');
    expect(url?.querySelector('title')?.text).toBe(data.screens[0]?.url);
    expect(shown(url).endsWith('…')).toBe(true);
    expect(cutPaths(report('wireframe', data))).toEqual(['screens.0.url']);
  });

  it('gives each wireframe on a page its own clip id', () => {
    const other = renderWireframe({ screens: [{ device: 'phone' as const, elements: [] }] });
    const id = (h: string): string | undefined => /clipPath id="([^"]+)"/.exec(h)?.[1];
    expect(id(html)).not.toBe(id(other));
    expect(renderWireframe(data)).toBe(html); // still deterministic
  });
});
