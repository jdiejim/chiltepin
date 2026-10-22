/**
 * The page lane's core contracts: the shared heading anchors (`slug.ts`, the
 * one algorithm the renderer and the link check both use) and the cover's
 * `meta` fields (status, owners, reviewers, updated, version).
 */

import { describe, expect, it } from 'vitest';
import { BLOCK_TEMPLATES, headingIds, headingSlug, META_STATUSES, metaSchema, parseDocument } from '../index.js';
import { validateDocument } from '../validate.js';

describe('headingSlug', () => {
  it('lowercases, strips Markdown, accents and punctuation, and joins words with hyphens', () => {
    expect(headingSlug('How the API works')).toBe('how-the-api-works');
    expect(headingSlug('The `Depends()` chain')).toBe('the-depends-chain');
    expect(headingSlug('See [the spec](https://x.dev) now')).toBe('see-the-spec-now');
    expect(headingSlug('**Bold** _and_ ~~gone~~')).toBe('bold-and-gone');
    expect(headingSlug('Café — résumé')).toBe('cafe-resume');
    expect(headingSlug('Symptom → action')).toBe('symptom-action');
  });

  it('falls back to "section" when nothing is left', () => {
    expect(headingSlug('→ ← ·')).toBe('section');
  });
});

describe('headingIds', () => {
  it('gives a repeat -2, -3 in document order', () => {
    expect(headingIds(['Risks', 'Plan', 'Risks', 'Risks'])).toEqual(['risks', 'plan', 'risks-2', 'risks-3']);
  });

  it('never takes a reserved block id', () => {
    expect(headingIds(['Orders', 'Orders'], new Set(['orders']))).toEqual(['orders-2', 'orders-3']);
  });
});

describe('meta cover fields', () => {
  const md = (body: string): string => `\`\`\`meta\ntitle: T\n${body}\n\`\`\`\n\nText.\n`;

  it('accepts status, owners, reviewers, updated and version', () => {
    const doc = parseDocument(
      md('status: proposal\nowners: [Ana Ruiz, Ben Ito]\nreviewers: [Cara]\nupdated: 2026-10-14\nversion: 1.2'),
      't',
    );
    expect(validateDocument(doc, 't.md').filter((d) => d.level === 'error')).toEqual([]);
    expect(doc.meta).toMatchObject({
      status: 'proposal',
      owners: ['Ana Ruiz', 'Ben Ito'],
      reviewers: ['Cara'],
      updated: '2026-10-14',
      version: '1.2',
    });
  });

  it('knows exactly the seven statuses, and rejects any other word', () => {
    expect([...META_STATUSES]).toEqual(['draft', 'proposal', 'review', 'accepted', 'superseded', 'deprecated', 'example']);
    for (const s of META_STATUSES) expect(metaSchema.safeParse({ status: s }).success, s).toBe(true);
    expect(metaSchema.safeParse({ status: 'shipped' }).success).toBe(false);
    const doc = parseDocument(md('status: shipped'), 't');
    expect(validateDocument(doc, 't.md').some((d) => d.level === 'error')).toBe(true);
  });

  it('takes owners and reviewers as lists of names', () => {
    expect(metaSchema.safeParse({ owners: 'Ana' }).success).toBe(false);
    expect(metaSchema.safeParse({ owners: ['Ana'], reviewers: [] }).success).toBe(true);
  });

  it('the catalog example shows the new fields and validates clean', () => {
    const doc = parseDocument(`${BLOCK_TEMPLATES.meta}\nText.\n`, 't');
    expect(BLOCK_TEMPLATES.meta).toContain('status: draft');
    expect(BLOCK_TEMPLATES.meta).toContain('owners:');
    expect(validateDocument(doc, 't.md').filter((d) => d.level === 'error')).toEqual([]);
    expect(doc.meta?.status).toBe('draft');
  });
});
