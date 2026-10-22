/**
 * The page as documentation (DESIGN.md › Headings and figures): heading
 * anchors, figure captions and numbers, the table of contents, the cover,
 * link-preview meta tags, and the stage scale floor that keeps a diagram
 * readable on a phone.
 */

import { describe, expect, it } from 'vitest';
import { headingIds, parseDocument } from 'chiltepin-core';
import { renderDocument } from '../document.js';
import { proseHeadings, renderProse } from '../markdown.js';
import { captionRepeatsHeading, renderDocumentParts, renderDocumentSegments, renderSlides } from '../parts.js';
import { renderToc, wantsToc } from '../outline.js';
import { renderCover } from '../blocks/meta.js';
import { MIN_STAGE_SCALE, sectionLabelFor, withFrameCaption } from '../blocks/frame.js';

const flow = (title?: string, id?: string): string =>
  '```flow\n' +
  (id !== undefined ? `id: ${id}\n` : '') +
  (title !== undefined ? `title: ${title}\n` : '') +
  'nodes:\n  - { id: a, label: A, col: 1, row: 1 }\n  - { id: b, label: B, col: 2, row: 1 }\nedges:\n  - { from: a, to: b }\n```\n';
const table = (title?: string): string =>
  '```table\n' + (title !== undefined ? `title: ${title}\n` : '') + 'columns: [A]\nrows:\n  - [x]\n```\n';

function body(md: string): string {
  return renderDocumentParts(parseDocument(md, 't')).body;
}

describe('heading anchors', () => {
  it('gives every ## and ### the shared headingIds id, with block ids reserved', () => {
    const md = `## Risks\n\nText.\n\n${flow('Path', 'risks')}\n## Plan\n\n### Risks\n\n## Risks\n`;
    const p = renderDocumentParts(parseDocument(md, 't'));
    const expected = headingIds(['Risks', 'Plan', 'Risks', 'Risks'], new Set(['risks']));
    expect(expected).toEqual(['risks-2', 'plan', 'risks-3', 'risks-4']);
    expect(p.outline?.headings.map((h) => h.id)).toEqual(expected);
    expect(p.outline?.headings.map((h) => h.depth)).toEqual([2, 2, 3, 2]);
    expect(p.body).toContain('<h2 id="risks-2">Risks<a class="h-anchor" href="#risks-2" aria-label="Link to this section"></a></h2>');
    expect(p.body).toContain('<h3 id="risks-3">Risks<a class="h-anchor" href="#risks-3"');
    // The block keeps its own id as its anchor.
    expect(p.body).toContain('<span class="block-anchor" id="risks" aria-hidden="true"></span>');
  });

  it('slugs the heading source the way check does: markers off, Markdown stripped', () => {
    const p = renderDocumentParts(parseDocument('## The `Depends()` chain {split}\n\nText.\n', 't'));
    expect(p.outline?.headings[0]).toEqual({ id: 'the-depends-chain', depth: 2, text: 'The `Depends()` chain' });
    expect(p.body).toContain('<h2 id="the-depends-chain">The <code>Depends()</code> chain<a class="h-anchor"');
  });

  it('proseHeadings walks the same tokens renderProse renders, # links hidden from text', () => {
    const text = '## One\n\n> ## Quoted\n\nPara\n\n#### Deep\n\n### Two\n';
    expect(proseHeadings(text)).toEqual([
      { depth: 2, text: 'One' },
      { depth: 2, text: 'Quoted' },
      { depth: 3, text: 'Two' },
    ]);
    const html = renderProse(text, ['one', 'quoted', 'two']);
    expect(html).toContain('<h2 id="one">');
    expect(html).toContain('<h2 id="quoted">');
    expect(html).toContain('<h4>Deep</h4>');
    expect(html).toContain('<h3 id="two">');
    // The # glyph is CSS, so a heading's text content stays its words.
    expect(html).not.toMatch(/h-anchor[^>]*>#/);
  });

  it('slides render prose headings without ids', () => {
    const deck = renderSlides(parseDocument('## One\n\n### Two\n\nText.\n', 't'));
    expect(deck.slides.map((s) => s.html).join('')).not.toContain('id="two"');
  });
});

describe('figure captions', () => {
  it('numbers titled figures in order; an untitled block takes no number', () => {
    const p = renderDocumentParts(parseDocument(`${flow('First')}\n${table()}\n${table('Second')}`, 't'));
    expect(p.outline?.figures.map((f) => [f.num, f.title, f.anchor])).toEqual([
      [1, 'First', 'fig-first'],
      [2, 'Second', 'fig-second'],
    ]);
    expect(p.body.match(/class="fig-num"/g)?.length).toBe(2);
  });

  it('fills the frame’s .diagram-title slot, caption first, type eyebrow after it', () => {
    const html = body(flow('Triage the lag'));
    const head = html.slice(html.indexOf('<div class="diagram-head">'), html.indexOf('<div class="diagram-stage">'));
    expect(head).toContain('<span class="diagram-title fig-caption" id="fig-triage-the-lag">');
    expect(head.indexOf('diagram-title')).toBeLessThan(head.indexOf('diagram-eyebrow'));
    expect(head).toContain('Fig.&nbsp;1');
  });

  it('puts a caption line above a block that has no frame', () => {
    const html = body(table('Pool headroom'));
    expect(html).toContain('<p class="fig-caption" id="fig-pool-headroom">');
    expect(html.indexOf('fig-caption')).toBeLessThan(html.indexOf('pres-table'));
  });

  it('a block id is the figure anchor; a title anchor never takes a heading id', () => {
    const withId = renderDocumentParts(parseDocument(flow('Path', 'pay-path'), 't'));
    expect(withId.outline?.figures[0]?.anchor).toBe('pay-path');
    expect(withId.sections[0]?.anchor).toBe('pay-path');
    const clash = renderDocumentParts(parseDocument(`## Fig orders\n\nText.\n\n${table('Orders')}\n${table('Orders')}`, 't'));
    expect(clash.outline?.headings[0]?.id).toBe('fig-orders');
    expect(clash.outline?.figures.map((f) => f.anchor)).toEqual(['fig-orders-2', 'fig-orders-3']);
  });

  it('a narrative block’s title is a plain label with no number', () => {
    const html = body('```list\ntitle: The additive rule\nitems:\n  - One\n  - Two\n```\n');
    expect(html).toContain('<p class="fig-caption is-label" id="fig-the-additive-rule"><span class="fig-title" data-bp="title">The additive rule</span></p>');
    expect(html).not.toContain('fig-num');
  });

  it('a callout draws its own title, with no caption around it', () => {
    const html = body('```callout\ntone: warn\ntitle: Near the limit\nbody: Pool at 82%.\n```\n');
    expect(html).toContain('<div class="callout-title" data-bp="title">Near the limit</div>');
    expect(html).not.toContain('fig-caption');
  });

  it('keeps a title that is more specific than the heading above', () => {
    expect(captionRepeatsHeading('Rollout', 'Single-write rollout')).toBe(false);
    expect(captionRepeatsHeading('Type scale', 'Type scale')).toBe(true);
    expect(captionRepeatsHeading('Phasing and timeline', 'Phasing')).toBe(true);
    const html = body(`## Rollout\n\n${flow('Single-write rollout')}`);
    expect(html).toContain('<span class="fig-title" data-bp="title">Single-write rollout</span>');
  });

  it('a page without headings still reads: every titled block is a captioned figure', () => {
    const p = renderDocumentParts(parseDocument(`Intro.\n\n${flow('One path')}\nMore.\n\n${table('Data')}`, 't'));
    expect(p.outline?.headings).toEqual([]);
    expect(p.outline?.figures.map((f) => f.title)).toEqual(['One path', 'Data']);
  });

  it('withFrameCaption only fills a frame head that has no title yet', () => {
    expect(withFrameCaption('<table></table>', '<span>c</span>')).toBeUndefined();
    const framed = '<div class="diagram"><div class="diagram-head"><span class="diagram-eyebrow t-eyebrow">X</span></div></div>';
    expect(withFrameCaption(framed, '<span class="diagram-title">c</span>')).toBe(
      '<div class="diagram"><div class="diagram-head"><span class="diagram-title">c</span><span class="diagram-eyebrow t-eyebrow">X</span></div></div>',
    );
    const titled = framed.replace('</span></div>', '</span><span class="diagram-title">t</span></div>');
    expect(withFrameCaption(titled, '<span class="diagram-title">c</span>')).toBeUndefined();
  });

  it('labels felogic with variant: be as backend logic', () => {
    expect(sectionLabelFor({ kind: 'felogic', data: { variant: 'be' } })).toBe('Backend logic');
    expect(sectionLabelFor({ kind: 'felogic', data: {} })).toBe('Frontend logic');
  });
});

describe('table of contents', () => {
  const long = ['## One', '## Two', '### Two a', '## Three', '## Four'].map((h) => `${h}\n\nText.\n`).join('\n') + `\n${flow('Path')}`;

  it('appears for 4+ headings: a sticky rail, a collapsed list, a figure list, and back-to-top links', () => {
    const html = renderDocument(parseDocument(long, 't'));
    expect(html).toContain('<div class="docskin has-toc" id="doc-top">');
    expect(html).toContain('<nav class="toc-rail" aria-label="Contents">');
    expect(html).toContain('<details class="toc-inline">');
    expect(html).toContain('<a href="#two">Two</a><ol class="toc-sub"><li><a href="#two-a">Two a</a></li></ol>');
    expect(html).toContain('<details class="toc-figlist">');
    expect(html).toContain('<a href="#fig-path"><span class="toc-fignum">Fig.&nbsp;1</span>');
    expect(html).toContain('<a class="toc-top" href="#doc-top">Back to top</a>');
    expect(html).toContain('<p class="doc-end"><a href="#doc-top">Back to top</a></p>');
    // The collapsed list sits above the first section.
    expect(html.indexOf('toc-inline')).toBeLessThan(html.indexOf('id="one"'));
  });

  it('stays out of a short page', () => {
    const doc = parseDocument(`## One\n\nText.\n\n${flow('Path')}`, 't');
    const p = renderDocumentSegments(doc);
    expect(wantsToc(doc, p.outline)).toBe(false);
    expect(renderDocument(doc)).not.toContain('class="toc-rail"');
  });

  it('lists figures when a long page has no headings', () => {
    const many = Array.from({ length: 7 }, (_, i) => `Text ${i}.\n\n${flow(`Step ${i + 1}`)}`).join('\n');
    const doc = parseDocument(many, 't');
    const p = renderDocumentSegments(doc);
    expect(wantsToc(doc, p.outline)).toBe(true);
    const toc = renderToc(p.outline);
    expect(toc.rail).toContain('<div class="toc-label t-eyebrow">Figures</div>');
    expect(toc.rail).toContain('href="#fig-step-7"');
  });

  it('never enters the parts body (site and Studio embed it as is)', () => {
    const p = renderDocumentParts(parseDocument(long, 't'));
    expect(p.body).not.toContain('class="toc-rail"');
  });
});

describe('cover', () => {
  it('prints status, tag, reading time and figures in place of the fixed DOCUMENT label', () => {
    const html = renderCover(
      { title: 'T', tag: 'DESIGN DOC', status: 'proposal', owners: ['Ana', 'Ben'], reviewers: ['Cara'], updated: '2026-10-14', version: '1.2' },
      { minutes: 6, figures: 4 },
    );
    expect(html).not.toContain('DOCUMENT');
    expect(html).toContain('<span class="cover-status cs-proposal">Proposal</span>');
    expect(html).toContain('<span class="cover-tag accent">DESIGN DOC</span>');
    expect(html).toContain('<span class="cover-read">6&nbsp;min read · 4&nbsp;figures</span>');
    expect(html).toContain('<dt class="t-eyebrow">Owners</dt><dd><span class="cover-name">Ana</span>, <span class="cover-name">Ben</span></dd>');
    expect(html).toContain('<dt class="t-eyebrow">Reviewer</dt>');
    expect(html).toContain('<time datetime="2026-10-14">2026-10-14</time>');
    expect(html).toContain('<span class="cover-version">1.2</span>');
  });

  it('every status has its chip class; text is escaped', () => {
    for (const s of ['draft', 'proposal', 'review', 'accepted', 'superseded', 'deprecated', 'example']) {
      expect(renderCover({ title: 'T', status: s })).toContain(`cover-status cs-${s}`);
    }
    expect(renderCover({ title: 'T', owners: ['<b>x</b>'] })).toContain('&lt;b&gt;x&lt;/b&gt;');
  });

  it('omits the meta row and the facts strip when there is nothing to say', () => {
    const html = renderCover({ title: 'T' });
    expect(html).not.toContain('cover-meta');
    expect(html).not.toContain('cover-facts');
  });

  it('the page derives reading time and figure count', () => {
    const p = renderDocumentParts(parseDocument(`\`\`\`meta\ntitle: T\n\`\`\`\n\nWords here.\n\n${flow('A')}\n${flow('B')}`, 't'));
    expect(p.body).toContain('1&nbsp;min read · 2&nbsp;figures');
  });
});

describe('link previews', () => {
  it('emits the subtitle as description and Open Graph tags', () => {
    const html = renderDocument(parseDocument('```meta\ntitle: Ledger "v2"\nsubtitle: One write per payment.\n```\n\nText.\n', 't'));
    expect(html).toContain('<meta name="description" content="One write per payment.">');
    expect(html).toContain('<meta property="og:description" content="One write per payment.">');
    expect(html).toContain('<meta property="og:title" content="Ledger &quot;v2&quot;">');
    expect(html).toContain('<meta property="og:type" content="article">');
  });

  it('skips the description when there is no subtitle', () => {
    const html = renderDocument(parseDocument('```meta\ntitle: T\n```\n\nText.\n', 't'));
    expect(html).not.toContain('name="description"');
    expect(html).toContain('<meta property="og:title" content="T">');
  });
});

describe('the stage scale floor', () => {
  it('gives every drawing a min-width so its scale never drops below 0.62', () => {
    const html = body(flow('Path'));
    const m = /viewBox="0 0 (\d+) \d+"[^>]*style="[^"]*min-width:(\d+)px"/.exec(html);
    expect(m).not.toBeNull();
    expect(Number(m?.[2])).toBe(Math.round(Number(m?.[1]) * MIN_STAGE_SCALE));
    expect(MIN_STAGE_SCALE * 13).toBeGreaterThanOrEqual(8); // a 13px name stays at 8px
  });
});
