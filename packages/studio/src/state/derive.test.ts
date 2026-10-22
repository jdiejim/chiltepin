/**
 * The dark-surface decision that drives high-contrast selection/highlight
 * colors (regression: navy outlines were invisible on the dark docskin
 * surface), and the derive memo.
 */

import { describe, expect, it } from 'vitest';
import { derive, docSurface } from './derive.js';

describe('docSurface', () => {
  it('follows the system dark preference — the renderer flips on prefers-color-scheme', () => {
    expect(docSurface(true)).toBe('dark');
    expect(docSurface(false)).toBe('light');
  });
});

describe('derive', () => {
  const SRC = '```meta\ntitle: T\n```\n\nHello.\n';

  it('parses, validates and renders a source', () => {
    const d = derive(SRC, 'guide');
    expect(d.doc.meta?.title).toBe('T');
    expect(d.renderError).toBeNull();
    expect(d.rendered?.segments.length).toBe(d.doc.segments.length);
  });

  it('runs the same lints as `chiltepin check` (core lintDocument)', () => {
    const src =
      '```meta\ntitle: T\n```\n\n```block\nnodes:\n  - { id: api, name: Orders API }\n  - { id: n9, name: New database }\n  - { id: db, name: orders-db }\nedges:\n  - api -> db\n  - api -> db\n```\n';
    const codes = derive(src, 'lints').diagnostics.map((d) => d.code);
    expect(codes).toEqual(expect.arrayContaining(['W_GENERIC_LABEL', 'W_ORPHAN_NODE', 'W_DUP_EDGE']));
  });

  it('memoises on (source, slug) — same inputs return the same object', () => {
    const a = derive(SRC, 'guide');
    expect(derive(SRC, 'guide')).toBe(a);
    expect(derive(SRC, 'other')).not.toBe(a);
    expect(derive(SRC + '\nMore.\n', 'guide')).not.toBe(a);
  });
});
