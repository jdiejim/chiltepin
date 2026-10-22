/**
 * Links in prose: the three internal forms resolve to a doc and an anchor;
 * a missing doc, block id, or heading id is E_DANGLING_LINK (same-document
 * links per document, the others across the set in `resolveRefs`); URLs,
 * images, and code are never links. Heading ids use the shared slug.
 */

import { describe, expect, it } from 'vitest';
import { parseDocument } from '../parser.js';
import { resolveRefs } from '../resolve.js';
import { docAnchors, lintLocalLinks, markdownHeadings, proseLinks, resolveLinkTarget } from '../links.js';
import { headingIds, headingSlug } from '../slug.js';

const doc = (md: string, slug = 't') => parseDocument(md, slug);
const seq = (id: string) => '```sequence\nid: ' + id + '\nactors:\n  - { id: a, name: A }\nmessages:\n  - a -> a: ping\n```\n';

describe('headingSlug / headingIds', () => {
  it('slugs heading text like the page does', () => {
    expect(headingSlug('Order flow')).toBe('order-flow');
    expect(headingSlug('The `POST /orders` path')).toBe('the-post-orders-path');
    expect(headingSlug('See [the API](x.md) — **now**')).toBe('see-the-api-now');
    expect(headingSlug('Café & crème')).toBe('cafe-creme');
    expect(headingSlug('!!!')).toBe('section');
  });

  it('numbers repeats and clashes with block ids', () => {
    expect(headingIds(['Setup', 'Setup', 'Run'], new Set(['run']))).toEqual(['setup', 'setup-2', 'run-2']);
  });
});

describe('resolveLinkTarget', () => {
  it('reads the three internal forms', () => {
    expect(resolveLinkTarget('#seq-order', 'payments/api')).toEqual({ doc: 'payments/api', anchor: 'seq-order', local: true });
    expect(resolveLinkTarget('payments/overview#seq-order', 'payments/api')).toEqual({
      doc: 'payments/overview',
      anchor: 'seq-order',
      local: false,
    });
    expect(resolveLinkTarget('./overview.md#flow', 'payments/api')).toEqual({ doc: 'payments/overview', anchor: 'flow', local: false });
    expect(resolveLinkTarget('../a.md', 'sub/b')).toEqual({ doc: 'a', local: false });
    expect(resolveLinkTarget('sub/b.md', 'a')).toEqual({ doc: 'sub/b', local: false });
  });

  it('leaves URLs, files, bare paths, and paths above the root alone', () => {
    for (const href of ['https://x.dev/a#b', 'mailto:a@b.c', '//cdn/x', '/abs#a', './logo.png', 'page.html#a', 'guides/setup', '../../README.md']) {
      expect(resolveLinkTarget(href, 'a')).toBeUndefined();
    }
  });
});

describe('proseLinks', () => {
  it('finds links with their line and column, never images or code', () => {
    const md = 'Intro.\n\nSee [the flow](#f) and ![logo](./l.png).\n\n`[not](#x)`\n\n```\n[nor](#y)\n```\n';
    const links = proseLinks(doc(md));
    expect(links).toEqual([{ text: 'the flow', href: '#f', line: 3, column: 5 }]);
  });

  it('reads the blocks that render inline Markdown', () => {
    const md = '```callout\ntone: note\nbody: "Read [the runbook](ops/runbook#steps) first."\n```\n';
    expect(proseLinks(doc(md)).map((l) => l.href)).toEqual(['ops/runbook#steps']);
  });
});

describe('markdownHeadings', () => {
  it('reads the headings the page renders: ATX, blockquoted, setext; never code', () => {
    const md =
      '## A\n\n> ## Quoted\n\nSetext two\n---\n\n    ## indented code\n\n```\n## fenced\n```\n\n  ### Indented ###\n\n# One\n\nTitle\n===\n\n## Retries {split}\n';
    expect(markdownHeadings(md)).toEqual([
      { depth: 2, text: 'A' },
      { depth: 2, text: 'Quoted' },
      { depth: 2, text: 'Setext two' },
      { depth: 3, text: 'Indented' },
      { depth: 2, text: 'Retries' },
    ]);
  });

  it('reads a backtick line with backticks in its info string as text, not a fence', () => {
    expect(markdownHeadings('- `flow` accepts\n  ```mermaid; `erd` accepts ```dbml\n\n## After\n')).toEqual([
      { depth: 2, text: 'After' },
    ]);
  });
});

describe('docAnchors', () => {
  it('holds figure anchors: a titled block with no id takes fig-<slug>', () => {
    const md =
      '## Order flow\n\n```flow\ntitle: Order flow\nnodes:\n  - a: A\n```\n\n```table\ntitle: Limits\ncolumns: [A]\nrows:\n  - [x]\n```\n\n```callout\ntone: note\ntitle: Note\nbody: x\n```\n';
    const anchors = docAnchors(doc(md));
    expect(anchors.has('order-flow')).toBe(true);
    expect(anchors.has('fig-order-flow')).toBe(true);
    expect(anchors.has('fig-limits')).toBe(true);
    // A callout draws its own title: no caption, no anchor.
    expect(anchors.has('fig-note')).toBe(false);
  });

  it('holds block ids and heading ids, heading ids yielding to block ids', () => {
    const anchors = docAnchors(doc('## Order flow\n\n' + seq('order-flow') + '\n### Retries {split}\n'));
    expect([...anchors].sort()).toEqual(['order-flow', 'order-flow-2', 'retries']);
  });
});

describe('E_DANGLING_LINK', () => {
  it('flags a same-document anchor that names nothing, with a suggestion', () => {
    const md = '## Order flow\n\nSee [the flow](#order-flw) and [ok](#order-flow) and [sec](#section-01).\n';
    const [d] = lintLocalLinks(doc(md), 't.md');
    expect(d?.code).toBe('E_DANGLING_LINK');
    expect(d?.level).toBe('error');
    expect(d?.message).toBe('Dangling link: [the flow](#order-flw): this document has no block id or heading "order-flw"');
    expect(d?.line).toBe(3);
    expect(d?.suggestions).toEqual(['order-flow']);
    expect(lintLocalLinks(doc(md), 't.md')).toHaveLength(1);
  });

  it('checks links to other documents across the set', () => {
    const api = doc(
      'See [order flow](payments/overview#seq-order), [gone](payments/overview#nope), [missing](./nope.md), and [heading](./overview.md#order-flow).\n',
      'payments/api',
    );
    const overview = doc('## Order flow\n\n' + seq('seq-order'), 'payments/overview');
    const { diagnostics } = resolveRefs([
      { doc: api, file: 'docs/payments/api.md' },
      { doc: overview, file: 'docs/payments/overview.md' },
    ]);
    const links = diagnostics.filter((d) => d.code === 'E_DANGLING_LINK').map((d) => d.message);
    expect(links).toEqual([
      'Dangling link: [gone](payments/overview#nope): "payments/overview" has no block id or heading "nope"',
      'Dangling link: [missing](./nope.md): no document "payments/nope"',
    ]);
  });
});
