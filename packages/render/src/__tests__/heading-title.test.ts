/**
 * "The heading titles the block" — the page's heading contract
 * (DESIGN.md › Headings and figures):
 *
 *  - the author's `##` / `###` are the only document headings: a block
 *    `title` never renders as a heading, it becomes the figure caption
 *    "Fig. N · title";
 *  - a block `title` that near-duplicates the heading directly above keeps
 *    the number only ("Fig. N") — the heading already says it;
 *  - a title-less block under a heading inherits the heading text into the
 *    sections nav (but adds no caption of its own);
 *  - a DIFFERENTLY-titled block under a heading keeps its own caption (the
 *    old "meridian case" — mere adjacency never merges).
 */

import { describe, expect, it } from 'vitest';
import { parseDocument } from 'chiltepin-core';
import { renderDocumentParts, renderSlides } from '../parts.js';

const TABLE = '```table\ntitle: Type scale\ncolumns: [A]\nrows:\n  - [x]\n```\n';
const UNTITLED_TABLE = '```table\ncolumns: [A]\nrows:\n  - [x]\n```\n';

function parts(md: string) {
  return renderDocumentParts(parseDocument(md, 't'));
}

describe('heading titles the block', () => {
  it('keeps only the figure number when the title near-duplicates the heading above', () => {
    const p = parts(`## Type scale\n\n${TABLE}`);
    // The prose heading renders once…
    expect(p.body).toContain('Type scale<a class="h-anchor"');
    // …and the block's caption carries the number, not the title again.
    expect(p.body).toContain('<p class="fig-caption" id="fig-type-scale"><span class="fig-num">Fig.&nbsp;1</span></p>');
    expect(p.body).not.toContain('class="section-title"');
    // The sections nav and the figure list keep the title.
    expect(p.sections[0]?.title).toBe('Type scale');
    expect(p.outline?.figures[0]?.title).toBe('Type scale');
  });

  it('captions the block with its own title when the heading above says something different', () => {
    const p = parts(`## Design tokens\n\n${TABLE}`);
    expect(p.body).toContain(
      '<span class="fig-num">Fig.&nbsp;1</span><span class="fig-sep" aria-hidden="true"> · </span><span class="fig-title" data-bp="title">Type scale</span>',
    );
    expect(p.body).not.toContain('class="section-title"');
    expect(p.sections[0]?.title).toBe('Type scale');
  });

  it('keeps the caption title when prose does not END with the heading', () => {
    const p = parts(`## Type scale\n\nTrailing prose.\n\n${TABLE}`);
    expect(p.body).toContain('<span class="fig-title" data-bp="title">Type scale</span>');
  });

  it('a title-less block inherits the heading into the sections nav', () => {
    const p = parts(`## Payment flow\n\n${UNTITLED_TABLE}`);
    // No caption of its own — the heading right above is the title.
    expect(p.body).not.toContain('fig-caption');
    expect(p.outline?.figures).toEqual([]);
    // But navigation knows what this section is called.
    expect(p.sections[0]?.title).toBe('Payment flow');
  });

  it('a title-less block with no heading stays untitled in the nav', () => {
    const p = parts(`Some prose without a heading.\n\n${UNTITLED_TABLE}`);
    expect(p.sections[0]?.title).toBeUndefined();
  });

  it('pages drop the SECTION NN · TYPE eyebrow; decks keep their section head', () => {
    const md = `## Design tokens\n\n${TABLE}`;
    const p = parts(md);
    expect(p.body).not.toContain('section-num');
    expect(p.body).not.toContain('SECTION 01');
    const deck = renderSlides(parseDocument(md, 't'));
    const html = deck.slides.map((s) => s.html).join('');
    expect(html).toContain('<div class="section-num">SECTION 01 · Comparison</div>');
    expect(html).not.toContain('fig-caption');
  });
});
