/**
 * The text-fitting core (`svg/wrapText.ts`): no text is dropped without a
 * mark. A wrap that drops words ends its last line with "…" and says so;
 * long identifiers break at their own joints; the width estimate is one
 * table for every renderer; cuts reach the geometry report.
 */

import { describe, expect, it } from 'vitest';
import {
  collectCuts,
  cutTitle,
  ellipsize,
  fitText,
  FONT,
  lineCount,
  reportCut,
  splitIdentifier,
  textWidth,
  wrapLines,
  wrapText,
} from '../svg/wrapText.js';
import { cutIssues } from '../svg/geometry.js';
import { geometryReport } from '../geometryReport.js';

describe('wrapText keeps its signature and marks every cut', () => {
  it('wraps word-aware and returns the same lines as before when nothing is cut', () => {
    expect(wrapText('Customer support ticket triage service', 20, 3)).toEqual([
      'Customer support',
      'ticket triage',
      'service',
    ]);
    expect(wrapText('', 20, 2)).toEqual([]);
    expect(wrapText(undefined, 20, 2)).toEqual([]);
  });

  it('ends the last kept line with "…" when words are dropped', () => {
    const lines = wrapText('Customer identity and access management platform', 22, 2);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('Customer identity and');
    expect(lines[1]?.endsWith('…')).toBe(true);
    expect((lines[1] ?? '').length).toBeLessThanOrEqual(22);
  });

  it('fills the last line with the rest of the text before it cuts', () => {
    // The old wrap dropped `entra_site_groups` whole and showed no sign.
    const w = wrapLines('roles · permissions · entra_site_groups', 30, 1);
    expect(w.truncated).toBe(true);
    expect(w.full).toBe('roles · permissions · entra_site_groups');
    expect(w.lines).toEqual(['roles · permissions · entra…']);
  });

  it('never ends a cut line on a dangling separator', () => {
    const w = wrapLines('alpha · beta · gamma · delta', 15, 1);
    expect(w.lines[0]).toMatch(/[a-z]…$/);
  });

  it('reports no cut for text that fits', () => {
    const w = wrapLines('Orders DB', 20, 2);
    expect(w).toEqual({ lines: ['Orders DB'], truncated: false, full: 'Orders DB' });
  });
});

describe('identifier-aware splitting', () => {
  it('breaks snake_case, dotted packages, paths and kebab-case after the delimiter', () => {
    expect(splitIdentifier('fetch_policy_document')).toEqual(['fetch_', 'policy_', 'document']);
    expect(splitIdentifier('com.example.checkout')).toEqual(['com.', 'example.', 'checkout']);
    expect(splitIdentifier('/checkout/payment')).toEqual(['/checkout/', 'payment']);
    expect(splitIdentifier('ingress-controller')).toEqual(['ingress-', 'controller']);
  });

  it('breaks camelCase and PascalCase, keeping acronyms whole', () => {
    expect(splitIdentifier('PaymentMethodSelectionPage')).toEqual(['Payment', 'Method', 'Selection', 'Page']);
    expect(splitIdentifier('usePaymentIntent')).toEqual(['use', 'Payment', 'Intent']);
    expect(splitIdentifier('HTTPServerError')).toEqual(['HTTP', 'Server', 'Error']);
    expect(splitIdentifier('plain')).toEqual(['plain']);
  });

  it('wraps a long identifier at its joints instead of overflowing the line', () => {
    expect(wrapText('fetch_policy_document', 14, 3)).toEqual(['fetch_policy_', 'document']);
    expect(wrapText('com.example.checkout.payments.adapters', 20, 3)).toEqual([
      'com.example.',
      'checkout.payments.',
      'adapters',
    ]);
    expect(wrapText('CheckoutApplicationShellProvider', 16, 3)).toEqual(['Checkout', 'ApplicationShell', 'Provider']);
  });

  it('hard-splits a run with no joint so no line is wider than the budget', () => {
    for (const ln of wrapText('Supercalifragilisticexpialidocious', 12, 4)) expect(ln.length).toBeLessThanOrEqual(12);
  });

  it('keeps a word that fits whole (no split inside short identifiers)', () => {
    expect(wrapText('use PaymentIntent here', 14, 3)).toEqual(['use', 'PaymentIntent', 'here']);
  });
});

describe('metrics: one estimate per type role', () => {
  it('sets mono at a fixed advance and sans proportionally', () => {
    expect(textWidth('iiii', FONT.sub)).toBeCloseTo(textWidth('MMMM', FONT.sub));
    expect(textWidth('iiii', FONT.name)).toBeLessThan(textWidth('MMMM', FONT.name) / 2);
  });

  it('estimates a 13px semibold name within a few percent of a real browser (and errs wide)', () => {
    // Measured in Chromium (system sans at 13px / 600): 188px and 160.5px.
    expect(textWidth('Customer identity and access', FONT.name)).toBeGreaterThan(188);
    expect(textWidth('Customer identity and access', FONT.name)).toBeLessThan(188 * 1.08);
    expect(textWidth('Application load balancer', FONT.name)).toBeGreaterThan(160);
    // 10px mono: SF Mono / Menlo advance ≈ 0.602em.
    expect(textWidth('Customer identity and access', FONT.sub)).toBeGreaterThanOrEqual(168.5);
  });

  it('fits pixel budgets: every fitted line is within the width', () => {
    const w = fitText('Insurance claims triage and routing agent', { width: 150, maxLines: 3 });
    expect(w.truncated).toBe(false);
    for (const ln of w.lines) expect(textWidth(ln, FONT.name)).toBeLessThanOrEqual(150);
    expect(lineCount('Insurance claims triage and routing agent', 150)).toBe(w.lines.length);
  });

  it('ellipsizes one line to its width, and keeps short text whole', () => {
    expect(ellipsize('ACK', 40, FONT.code)).toEqual({ lines: ['ACK'], truncated: false, full: 'ACK' });
    const cut = ellipsize('Acknowledgment number', 60, FONT.code);
    expect(cut.truncated).toBe(true);
    expect(cut.lines[0]?.endsWith('…')).toBe(true);
    expect(textWidth(cut.lines[0] ?? '', FONT.code)).toBeLessThanOrEqual(60);
  });
});

describe('cut reports', () => {
  it('puts the full text in a <title> only when the text was cut', () => {
    expect(cutTitle({ truncated: false, full: 'x' })).toBe('');
    expect(cutTitle({ truncated: true, full: 'a <b> & c' })).toBe('<title>a &lt;b&gt; &amp; c</title>');
  });

  it('collects cuts reported during a render, and none outside one', () => {
    reportCut({ field: 'name', full: 'ignored' }); // no collector: a no-op
    const { value, cuts } = collectCuts(() => {
      fitText('A very long agent name that cannot fit', { width: 60, maxLines: 1, report: { field: 'name', path: 'agent.name' } });
      fitText('Short', { width: 60, report: { field: 'name' } });
      return 7;
    });
    expect(value).toBe(7);
    expect(cuts).toEqual([{ field: 'name', path: 'agent.name', full: 'A very long agent name that cannot fit' }]);
  });

  it('turns cuts into one label-truncated issue each, deduplicated, with a data-terms hint', () => {
    const issues = cutIssues([
      { field: 'tech', path: 'nodes.7.tech', owner: 'App DB', full: 'roles · permissions · entra_site_groups' },
      { field: 'tech', path: 'nodes.7.tech', owner: 'App DB', full: 'roles · permissions · entra_site_groups' },
      { field: 'name', path: 'nodes.1.name', full: 'x', hint: 'Shorten `name`.' },
    ]);
    expect(issues).toHaveLength(2);
    expect(issues[0]).toMatchObject({ kind: 'label-truncated', path: 'nodes.7.tech' });
    expect(issues[0]?.message).toContain('`tech` of "App DB"');
    expect(issues[0]?.hint).toMatch(/Shorten `tech`/);
    expect(issues[1]?.hint).toBe('Shorten `name`.');
  });

  it('reaches the geometry report for the layered block in meridian-access-model', () => {
    const r = geometryReport('block', {
      layers: [{ label: 'Shared backbone' }],
      nodes: [{ id: 'db', layer: 0, kind: 'db', name: 'App DB', tech: 'roles · permissions · entra_site_groups · and five more tables of audit history' }],
    });
    const cut = r.issues.find((i) => i.kind === 'label-truncated');
    expect(cut?.path).toBe('nodes.0.tech');
    expect(cut?.message).toContain('App DB');
  });
});
