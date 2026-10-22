import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { BLOCK_TEMPLATES, parseDocument } from 'chiltepin-core';
import { renderMindmap } from '../blocks/mindmap.js';
import { renderDocument } from '../document.js';

type Data = Parameters<typeof renderMindmap>[0];

const ONBOARDING: Data = {
  center: 'Onboarding v2',
  nodes: [
    { id: 'acct', label: 'Account', accent: 'blue' },
    { id: 'sso', parent: 'acct', label: 'SSO first' },
    { id: 'invite', parent: 'acct', label: 'Team invites' },
    { id: 'data', label: 'Data import', accent: 'teal' },
    { id: 'csv', parent: 'data', label: 'CSV' },
    { id: 'api', parent: 'data', label: 'API sync' },
    { id: 'learn', label: 'Learning', accent: 'amber' },
    { id: 'tour', parent: 'learn', label: 'Product tour' },
    { id: 'tmpl', parent: 'learn', label: 'Templates' },
  ],
};

const NO_HEX = /#[0-9a-f]{3,6}\b/i;

/** The x of a node's first label line. */
function xOf(html: string, path: string): number {
  return Number(parse(html).querySelector(`[data-bp="${path}"] text`)?.getAttribute('x'));
}

/** The centre pill's middle x. */
function centerX(html: string): number {
  const rect = parse(html).querySelector('[data-bp="center"] rect');
  return Number(rect?.getAttribute('x')) + Number(rect?.getAttribute('width')) / 2;
}

describe('mindmap', () => {
  it('renders the catalog template', () => {
    const html = renderDocument(parseDocument(BLOCK_TEMPLATES.mindmap, 'mm'));
    expect(html).toContain('Onboarding v2');
    expect(html).toContain('Team invites');
    expect(html).not.toContain('NaN');
  });

  it('puts alternate branches on opposite sides of the centre', () => {
    const html = renderMindmap(ONBOARDING);
    expect(html).not.toMatch(NO_HEX);
    const cx = centerX(html);
    // Branch 1 right, branch 2 left, branch 3 right — and their children follow.
    expect(xOf(html, 'nodes.0')).toBeGreaterThan(cx);
    expect(xOf(html, 'nodes.1')).toBeGreaterThan(xOf(html, 'nodes.0'));
    expect(xOf(html, 'nodes.3')).toBeLessThan(cx);
    expect(xOf(html, 'nodes.4')).toBeLessThan(xOf(html, 'nodes.3'));
    expect(xOf(html, 'nodes.6')).toBeGreaterThan(cx);
    // Left labels end at their anchor, right labels start at it.
    const root = parse(html);
    expect(root.querySelector('[data-bp="nodes.3"] text')?.getAttribute('text-anchor')).toBe('end');
    expect(root.querySelector('[data-bp="nodes.0"] text')?.getAttribute('text-anchor')).toBe('start');
  });

  it('stacks the branches on one side without overlap, a parent centred on its children', () => {
    const html = renderMindmap(ONBOARDING);
    const y = (path: string): number => Number(parse(html).querySelector(`[data-bp="${path}"] text`)?.getAttribute('y'));
    // Right side: Account's children above Learning's, all distinct rows.
    const rightRows = ['nodes.1', 'nodes.2', 'nodes.7', 'nodes.8'].map(y);
    expect([...rightRows].sort((a, b) => a - b)).toEqual(rightRows);
    expect(new Set(rightRows).size).toBe(4);
    // Account sits between SSO first and Team invites.
    expect(y('nodes.0')).toBeGreaterThan(y('nodes.1'));
    expect(y('nodes.0')).toBeLessThan(y('nodes.2'));
  });

  it('draws one curved connector per node and a hairline under each label', () => {
    const root = parse(renderMindmap(ONBOARDING));
    expect(root.querySelectorAll('path[d*="Q"]')).toHaveLength(9);
    expect(root.querySelectorAll('.diagram-stage line')).toHaveLength(9);
  });

  it('colour-codes flagged branches with the category hues and keeps unflagged ones muted', () => {
    const html = renderMindmap(ONBOARDING);
    // Each branch takes the hue it names: blue, teal, amber.
    expect(html).toContain('stroke="var(--hue-blue)"');
    expect(html).toContain('stroke="var(--hue-teal)"');
    expect(html).toContain('stroke="var(--hue-amber)"');
    expect(html).not.toContain('var(--series-');
    expect(html).not.toContain('var(--accent)');
    const legend = parse(html).querySelectorAll('.diagram-legend .lg-label').map((l) => l.text);
    expect(legend).toEqual(['Account', 'Data import', 'Learning']);
    // One flagged branch takes the accent; `red` is negative; none means muted.
    const one = renderMindmap({ center: 'c', nodes: [{ id: 'a', label: 'A', accent: 'blue' }, { id: 'b', label: 'B' }, { id: 'r', label: 'R', accent: 'red' }] });
    expect(one).toContain('stroke="var(--accent)"');
    expect(one).toContain('stroke="var(--negative)"');
    expect(one).toContain('stroke="var(--muted)"');
  });

  it('wraps a long label onto more lines and grows the viewBox to fit', () => {
    const short = renderMindmap({ center: 'c', nodes: [{ id: 'a', label: 'Short' }] });
    const long = renderMindmap({
      center: 'c',
      nodes: [{ id: 'a', label: 'A branch label that is much longer than the twenty-four character line' }],
    });
    const w = (h: string): number => Number(parse(h).querySelector('svg')?.getAttribute('viewBox')?.split(' ')[2]);
    expect(w(long)).toBeGreaterThan(w(short));
    expect(parse(long).querySelectorAll('[data-bp="nodes.0"] text')).toHaveLength(4);
  });
});
