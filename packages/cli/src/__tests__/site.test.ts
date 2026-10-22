import { describe, expect, it } from 'vitest';
import { parseDocument } from 'chiltepin-core';
import { buildSite, type SiteDoc } from '../commands/site.js';

const DOC_A = `\`\`\`meta
title: Doc A
subtitle: The first document
tag: GUIDE
\`\`\`

\`\`\`sequence
id: seq-a
title: A flow
actors:
  - { id: C, name: Client }
  - { id: S, name: Server }
messages:
  - { from: C, to: S, label: GET /a, kind: sync }
\`\`\`

\`\`\`userstory
title: Stories
role: dev
want: cross-doc links
soThat: navigation works
links:
  - { ref: "b#seq-b", label: Cross }
  - { ref: "#seq-a", label: Same }
  - { ref: "#nope", label: Dangling }
\`\`\`
`;

const DOC_B = `\`\`\`meta
title: Doc B
tag: API
\`\`\`

\`\`\`sequence
id: seq-b
title: B flow
actors:
  - { id: C, name: Client }
  - { id: S, name: Server }
messages:
  - { from: C, to: S, label: GET /b, kind: sync }
\`\`\`
`;

const DOC_NESTED = `\`\`\`meta
title: Nested guide
\`\`\`

\`\`\`userstory
role: dev
want: relative links up
soThat: nested pages resolve
links:
  - { ref: "a#seq-a", label: Up and over }
\`\`\`
`;

function load(): SiteDoc[] {
  return [
    { slug: 'a', file: 'docs/a.md', doc: parseDocument(DOC_A, 'a') },
    { slug: 'b', file: 'docs/b.md', doc: parseDocument(DOC_B, 'b') },
    { slug: 'guides/x', file: 'docs/guides/x.md', doc: parseDocument(DOC_NESTED, 'guides/x') },
  ];
}

describe('buildSite', () => {
  it('emits index.html plus one page and one deck per doc (nested slugs keep dirs)', () => {
    const { pages } = buildSite(load());
    expect(pages.map((p) => p.path)).toEqual([
      'index.html',
      'a.html',
      'a.slides.html',
      'b.html',
      'b.slides.html',
      'guides/x.html',
      'guides/x.slides.html',
    ]);
  });

  it('rewrites cross-doc refs to <slug>.html#id with fixed attribute order', () => {
    const { pages } = buildSite(load());
    const a = pages.find((p) => p.path === 'a.html');
    expect(a?.html).toContain('data-ref="b#seq-b" href="b.html#seq-b"');
  });

  it('leaves same-doc refs as #id (no-op)', () => {
    const { pages } = buildSite(load());
    const a = pages.find((p) => p.path === 'a.html');
    expect(a?.html).toContain('data-ref="#seq-a" href="#seq-a"');
  });

  it('drops the href on dangling refs but keeps data-ref', () => {
    const { pages, diagnostics } = buildSite(load());
    const a = pages.find((p) => p.path === 'a.html');
    expect(a?.html).toContain('data-ref="#nope"');
    expect(a?.html).not.toContain('data-ref="#nope" href');
    expect(diagnostics.some((d) => d.code === 'E_DANGLING_REF' && d.value === '#nope')).toBe(true);
  });

  it('uses depth-relative hrefs from nested pages', () => {
    const { pages } = buildSite(load());
    const nested = pages.find((p) => p.path === 'guides/x.html');
    // Ref chip climbs out of guides/.
    expect(nested?.html).toContain('data-ref="a#seq-a" href="../a.html#seq-a"');
    // Nav + brand links climb too.
    expect(nested?.html).toContain('href="../index.html"');
    expect(nested?.html).toContain('href="../a.html">Doc A</a>');
  });

  it('renders a sidebar with every doc by folder, the current one highlighted, and its headings', () => {
    const docs = [
      ...load(),
      {
        slug: 'h',
        file: 'docs/h.md',
        doc: parseDocument('```meta\ntitle: With headings\n```\n\n## Order flow\n\nText.\n\n### Retries\n\nMore.\n', 'h'),
      },
    ];
    const { pages } = buildSite(docs);
    const a = pages.find((p) => p.path === 'a.html');
    expect(a?.html).toContain('<a class="current" href="a.html">Doc A</a>');
    expect(a?.html).toContain('href="b.html">Doc B</a>');
    expect(a?.html).toContain('href="guides/x.html">Nested guide</a>');
    // Root docs first, then each top folder under its own eyebrow.
    expect(a?.html).toContain('<div class="nav-head site-eyebrow">Documents</div>');
    expect(a?.html).toContain('<div class="nav-head site-eyebrow">guides</div>');
    // Doc A has no headings: no section list (block titles are not sections).
    expect(a?.html).not.toContain('class="nav-sections"');
    // The current doc lists its ## / ### headings, and the page carries the ids.
    const h = pages.find((p) => p.path === 'h.html')?.html ?? '';
    expect(h).toContain('<div class="nav-sections"><a href="#order-flow">Order flow</a><a class="h3" href="#retries">Retries</a></div>');
    expect(h).toContain('<h2 id="order-flow">');
    expect(h).toContain('<h3 id="retries">');
  });

  it('the nav and the search index carry plain words for styled headings and subtitles', () => {
    const src = '```meta\ntitle: Styled\nsubtitle: ":check: Ready for ==review== [Beta]{.pill}"\n```\n\n## :rocket: Launch [Beta]{.pill}\n\nText.\n';
    const { pages, files } = buildSite([{ slug: 's', file: 'docs/s.md', doc: parseDocument(src, 's') }]);
    const s = pages.find((p) => p.path === 's.html')?.html ?? '';
    expect(s).toContain('<div class="nav-sections"><a href="#launch-beta">Launch Beta</a></div>');
    const search = JSON.parse(files.find((f) => f.path === 'search.json')?.content ?? '[]') as { s?: string; h: [string, string][] }[];
    expect(search[0]?.s).toBe('✓ Ready for review Beta');
    expect(search[0]?.h).toEqual([['launch-beta', 'Launch Beta']]);
  });

  it('folds the menu under 900px, filters titles and headings, and never prints the chrome', () => {
    const { pages, files } = buildSite(load());
    const a = pages.find((p) => p.path === 'a.html')?.html ?? '';
    expect(a).toContain('<details class="nav-fold" open><summary>Menu</summary>');
    expect(a).toContain('<input class="nav-search" type="search"');
    expect(a).toContain('window.__chiltepinSearch=');
    expect(a).toContain('@media print{.site-nav,.site-bar,.view-toggle{display:none!important;}');
    const search = JSON.parse(files.find((f) => f.path === 'search.json')?.content ?? '[]') as { u: string; t: string }[];
    // Root docs first, ordered by tag (API before GUIDE), then each folder.
    expect(search.map((e) => e.u)).toEqual(['b.html', 'a.html', 'guides/x.html']);
  });

  it('puts the Doc | Slides toggle in a bar above the cover, not over it', () => {
    const { pages } = buildSite(load());
    const a = pages.find((p) => p.path === 'a.html')?.html ?? '';
    const bar = a.indexOf('<div class="site-bar">');
    expect(bar).toBeGreaterThan(0);
    expect(bar).toBeLessThan(a.indexOf('<div class="docskin">'));
    expect(a).not.toContain('position:absolute;top:30px;right:32px');
  });

  it('with sharedAssets writes the CSS and the script once and links them', () => {
    const { pages, files } = buildSite(load(), { sharedAssets: true });
    expect(files.map((f) => f.path).sort()).toEqual(['assets/chiltepin.css', 'assets/chiltepin.js', 'search.json']);
    const nested = pages.find((p) => p.path === 'guides/x.html')?.html ?? '';
    expect(nested).toContain('<link rel="stylesheet" href="../assets/chiltepin.css">');
    expect(nested).toContain('<script src="../assets/chiltepin.js" defer></script>');
    expect(nested).not.toContain('.docskin{');
    // The shared sheet is most of what an inline page repeated.
    const inline = buildSite(load()).pages.find((p) => p.path === 'guides/x.html')?.html ?? '';
    expect(nested.length).toBeLessThan(inline.length / 3);
  });

  it('rewrites prose links to the built pages, on the page and in the deck', () => {
    const docs = [
      ...load(),
      {
        slug: 'guides/l',
        file: 'docs/guides/l.md',
        doc: parseDocument(
          '```meta\ntitle: Links\n```\n\n## Here\n\nSee [B](b#seq-b), [A](../a.md#seq-a), [x](./x.md), [here](#here), [web](https://x.dev/a.md), and [gone](nope#a).\n',
          'guides/l',
        ),
      },
    ];
    const { pages } = buildSite(docs);
    const page = pages.find((p) => p.path === 'guides/l.html')?.html ?? '';
    expect(page).toContain('<a href="../b.html#seq-b">B</a>');
    expect(page).toContain('<a href="../a.html#seq-a">A</a>');
    expect(page).toContain('<a href="../guides/x.html">x</a>');
    expect(page).toContain('<a href="#here">here</a>');
    expect(page).toContain('<a href="https://x.dev/a.md">web</a>');
    expect(page).toContain('<a href="nope#a">gone</a>');
    const deck = pages.find((p) => p.path === 'guides/l.slides.html')?.html ?? '';
    expect(deck).toContain('href="../b.html#seq-b"');
    expect(deck).toContain('href="l.html#here"');
  });

  it('rewrites ref chips in the deck too', () => {
    const { pages } = buildSite(load());
    const deck = pages.find((p) => p.path === 'a.slides.html')?.html ?? '';
    expect(deck).toContain('data-ref="b#seq-b" href="b.html#seq-b"');
    expect(deck).toContain('data-ref="#seq-a" href="a.html#seq-a"');
  });

  it('lists local images and the meta logo to copy, and leaves URLs alone', () => {
    const docs = [
      {
        slug: 'guides/img',
        file: 'docs/guides/img.md',
        doc: parseDocument(
          '```meta\ntitle: Images\nlogo: ../brand/logo.svg\n```\n\n![Map](./map.png) ![Root](../../assets/hero.png) ![Web](https://x.dev/a.png)\n',
          'guides/img',
        ),
      },
    ];
    const { assets, pages } = buildSite(docs);
    expect(assets).toEqual(
      expect.arrayContaining([
        { from: 'docs/brand/logo.svg', to: 'brand/logo.svg' },
        { from: 'docs/guides/map.png', to: 'guides/map.png' },
        { from: 'assets/hero.png', to: 'assets/files/assets/hero.png' },
      ]),
    );
    expect(assets).toHaveLength(3);
    const page = pages.find((p) => p.path === 'guides/img.html')?.html ?? '';
    expect(page).toContain('src="./map.png"');
    expect(page).toContain('src="../assets/files/assets/hero.png"');
    expect(page).toContain('src="https://x.dev/a.png"');
  });

  it('builds an index card grid from each doc meta', () => {
    const { pages } = buildSite(load());
    const index = pages.find((p) => p.path === 'index.html');
    expect(index?.html).toContain('<a class="idx-card" href="a.html">');
    expect(index?.html).toContain('<span class="idx-tag">GUIDE</span>');
    expect(index?.html).toContain('<h2>Doc A</h2>');
    expect(index?.html).toContain('<p>The first document</p>');
    const md = buildSite([
      { slug: 'm', file: 'docs/m.md', doc: parseDocument('```meta\ntitle: M\nsubtitle: "Uses `POST /orders` and **idempotency keys**"\n```\n', 'm') },
    ]);
    expect(md.pages.find((p) => p.path === 'index.html')?.html).toContain(
      '<p>Uses <code>POST /orders</code> and <strong>idempotency keys</strong></p>',
    );
    expect(index?.html).toContain('<a class="idx-card" href="guides/x.html">');
    expect(index?.html).toContain('<h2>Nested guide</h2>');
  });

  it('puts a Doc | Slides toggle on doc pages (not the index)', () => {
    const { pages } = buildSite(load());
    const a = pages.find((p) => p.path === 'a.html');
    expect(a?.html).toContain('class="view-toggle"');
    expect(a?.html).toContain('<a aria-current="page" href="a.html">Doc</a>');
    expect(a?.html).toContain('<a href="a.slides.html">Slides</a>');
    const index = pages.find((p) => p.path === 'index.html');
    expect(index?.html).not.toContain('class="view-toggle"');
  });

  it('deck pages carry the standalone deck plus a back-link pill to the doc page', () => {
    const { pages } = buildSite(load());
    const deck = pages.find((p) => p.path === 'a.slides.html');
    expect(deck?.title).toBe('Doc A — Slides');
    expect(deck?.html).toContain('class="deck-nav"'); // toSlides markup intact
    expect(deck?.html).toContain('class="deck-doc-link" href="a.html"');
  });

  it('nested docs link page ↔ deck by basename (same directory at any depth)', () => {
    const { pages } = buildSite(load());
    const page = pages.find((p) => p.path === 'guides/x.html');
    expect(page?.html).toContain('<a href="x.slides.html">Slides</a>');
    const deck = pages.find((p) => p.path === 'guides/x.slides.html');
    expect(deck?.html).toContain('class="deck-doc-link" href="x.html"');
  });

  it('keeps the plain index unchanged when richIndex is false', () => {
    const { pages } = buildSite(load(), { richIndex: false });
    const index = pages.find((p) => p.path === 'index.html');
    expect(index?.html).not.toContain('idx-tldr');
    expect(index?.html).not.toContain('idx-group');
    expect(index?.html).not.toContain('idx-graph');
    expect(index?.html).not.toContain('<svg');
  });

  it('defaults to the rich index — byte-identical to an explicit richIndex: true', () => {
    const docs = load();
    const byDefault = buildSite(docs);
    const explicit = buildSite(docs, { richIndex: true });
    for (const p of byDefault.pages) {
      expect(explicit.pages.find((r) => r.path === p.path)?.html).toBe(p.html);
    }
    // Two top folders (the root with GUIDE and API, and guides/): the index
    // groups by folder, then by tag inside the root.
    const index = byDefault.pages.find((p) => p.path === 'index.html');
    expect(index?.html).toContain('class="idx-tldr"');
    expect(index?.html).toContain('<section class="idx-group" id="group-documents">');
    expect(index?.html).toContain('<section class="idx-group" id="group-guides">');
    expect(index?.html).toContain('class="idx-graph"');
  });

  it('injects the live-reload script only when liveReload is set', () => {
    const docs = load();
    const built = buildSite(docs);
    const served = buildSite(docs, { liveReload: true });
    for (const p of built.pages) expect(p.html).not.toContain('EventSource');
    for (const p of served.pages) {
      expect(p.html).toContain(`new EventSource('/__events').onmessage=()=>location.reload()`);
    }
  });
});

// ─── Rich index (default; `--no-rich-index` opts out) ────────────────────────

const RICH_R1 = `\`\`\`meta
title: Parser guide
subtitle: Parser walkthrough
tag: Guide
\`\`\`

\`\`\`sequence
id: seq-r1
title: Parse flow
actors:
  - { id: C, name: Client }
  - { id: S, name: Server }
messages:
  - { from: C, to: S, label: parse, kind: sync }
\`\`\`
`;

const RICH_R2 = `\`\`\`meta
title: Renderer guide
tag: GUIDE
\`\`\`
`;

const RICH_R3 = `\`\`\`meta
title: API reference
tag: API
\`\`\`

\`\`\`userstory
role: dev
want: a link to the parser
soThat: readers can jump
links:
  - { ref: "r1#seq-r1", label: Parser }
\`\`\`
`;

const RICH_R4 = `\`\`\`meta
title: Nested note
subtitle: A nested note
\`\`\`
`;

const RICH_R5 = `\`\`\`meta
title: API cookbook
tag: API · v2
\`\`\`
`;

function loadRich(): SiteDoc[] {
  return [
    { slug: 'r1', file: 'docs/r1.md', doc: parseDocument(RICH_R1, 'r1') },
    { slug: 'r2', file: 'docs/r2.md', doc: parseDocument(RICH_R2, 'r2') },
    { slug: 'r3', file: 'docs/r3.md', doc: parseDocument(RICH_R3, 'r3') },
    { slug: 'notes/r4', file: 'docs/notes/r4.md', doc: parseDocument(RICH_R4, 'notes/r4') },
    { slug: 'r5', file: 'docs/r5.md', doc: parseDocument(RICH_R5, 'r5') },
  ];
}

describe('buildSite rich index', () => {
  it('puts a TLDR digest at the top: doc count plus one line per group', () => {
    const { pages } = buildSite(loadRich(), { richIndex: true });
    const index = pages.find((p) => p.path === 'index.html');
    expect(index?.html).toContain('<div class="idx-eyebrow site-eyebrow">5 documents</div>');
    // Multi-doc group line: label + count only — no single doc's subtitle.
    expect(index?.html).toContain('<a href="#group-documents"><strong>Documents</strong> · 4 documents</a>');
    // A group of one keeps its doc's subtitle as the one-liner.
    expect(index?.html).toContain('<a href="#group-notes"><strong>notes</strong> · 1 document — A nested note</a>');
  });

  it('groups cards by top folder first (root first), then by tag token inside a folder', () => {
    const { pages } = buildSite(loadRich(), { richIndex: true });
    const html = pages.find((p) => p.path === 'index.html')?.html ?? '';
    expect(html).toContain(
      '<section class="idx-group" id="group-documents"><h2 class="idx-group-head">Documents<span class="idx-group-count">4</span></h2>',
    );
    expect(html).toContain('<section class="idx-group" id="group-notes"><h2 class="idx-group-head">notes<span class="idx-group-count">1</span></h2>');
    expect(html.indexOf('id="group-documents"')).toBeLessThan(html.indexOf('id="group-notes"'));
    // Inside the root: tag sub-groups (case-insensitive first token), largest first, ties by label.
    expect(html).toContain('<div class="idx-sub-head site-eyebrow">API · 2</div>');
    expect(html).toContain('<div class="idx-sub-head site-eyebrow">Guide · 2</div>');
    expect(html.indexOf('API · 2')).toBeLessThan(html.indexOf('Guide · 2'));
    const api = html.slice(html.indexOf('API · 2'), html.indexOf('Guide · 2'));
    expect(api).toContain('<a class="idx-card" href="r3.html">');
    expect(api).toContain('<a class="idx-card" href="r5.html">');
    // The full compound badge stays on the card — only grouping uses the token.
    expect(html).toContain('<span class="idx-tag">API · v2</span>');
  });

  it('labels the tags in the sidebar only where a folder groups docs by tag', () => {
    const { pages } = buildSite(loadRich());
    const html = pages.find((p) => p.path === 'r1.html')?.html ?? '';
    // Root: 4 docs, 2 tags (API, Guide) — labelled; notes/: 1 doc — not.
    expect(html).toContain('<span class="nav-tag">API</span>');
    expect(html).toContain('<span class="nav-tag">Guide</span>');
    expect(html.match(/class="nav-tag"/g)).toHaveLength(2);
  });

  it('groups a flat docs folder by tag', () => {
    const flat = loadRich().filter((d) => !d.slug.includes('/'));
    const html = buildSite(flat, { richIndex: true }).pages.find((p) => p.path === 'index.html')?.html ?? '';
    expect(html).toContain('<section class="idx-group" id="group-api"><h2 class="idx-group-head">API<span class="idx-group-count">2</span></h2>');
    expect(html).toContain('<section class="idx-group" id="group-guide"><h2 class="idx-group-head">Guide<span class="idx-group-count">2</span></h2>');
  });

  it('normalizes tag casing on cards inside a group to the first-seen form', () => {
    const { pages } = buildSite(loadRich(), { richIndex: true });
    const html = pages.find((p) => p.path === 'index.html')?.html ?? '';
    // r2 is tagged GUIDE; inside the Guide group its pill shows Guide (r1's casing).
    const cardStart = html.indexOf('class="idx-card" href="r2.html"');
    const r2Card = html.slice(cardStart, html.indexOf('</a>', cardStart));
    expect(r2Card).toContain('<span class="idx-tag">Guide</span>');
    expect(html).not.toContain('<span class="idx-tag">GUIDE</span>');
  });

  it('falls back to the flat card grid when most groups are singletons', () => {
    const docs = [
      { slug: 'r1', file: 'docs/r1.md', doc: parseDocument(RICH_R1, 'r1') },
      { slug: 'r3', file: 'docs/r3.md', doc: parseDocument(RICH_R3, 'r3') },
      { slug: 'r5', file: 'docs/r5.md', doc: parseDocument(RICH_R5.replace('API · v2', 'RFC'), 'r5') },
    ];
    const { pages } = buildSite(docs, { richIndex: true });
    const html = pages.find((p) => p.path === 'index.html')?.html ?? '';
    // Three groups of one (Guide, API, RFC) — grouping restates the grid.
    // (The stylesheet still carries the .idx-* rules; the markup must not.)
    expect(html).not.toContain('class="idx-tldr"');
    expect(html).not.toContain('class="idx-group"');
    expect(html).toContain('<div class="idx-grid">');
    expect(html).toContain('<a class="idx-card" href="r1.html">');
    // The cross-reference graph (r3 → r1) still renders.
    expect(html).toContain('class="idx-graph"');
    expect(html).toContain('<svg');
  });

  it('renders the cross-reference graph through the graph renderer, with a link legend', () => {
    const { pages } = buildSite(loadRich(), { richIndex: true });
    const index = pages.find((p) => p.path === 'index.html');
    const html = index?.html ?? '';
    expect(html).toContain('class="idx-graph"');
    expect(html).toContain('<svg'); // real rendered graph block
    expect(html).toContain('Cross-references');
    // Node labels are doc titles; only docs in an edge appear.
    expect(html).toContain('Parser guide');
    expect(html).toContain('API reference');
    // Legend links each graph doc to its page.
    expect(html).toContain('<li><a href="r3.html">API reference</a>');
    expect(html).toContain('<li><a href="r1.html">Parser guide</a>');
  });

  it('omits the graph section when no doc references another', () => {
    const docs = loadRich().filter((d) => d.slug !== 'r3'); // r3 holds the only cross-ref
    const { pages } = buildSite(docs, { richIndex: true });
    const index = pages.find((p) => p.path === 'index.html');
    // The stylesheet still carries `.idx-graph` rules; the markup must not.
    expect(index?.html).not.toContain('class="idx-graph"');
    expect(index?.html).not.toContain('<svg');
  });

  it('changes only the index page — doc pages and decks stay identical', () => {
    const docs = loadRich();
    const plain = buildSite(docs, { richIndex: false });
    const rich = buildSite(docs, { richIndex: true });
    for (const p of plain.pages) {
      if (p.path === 'index.html') continue;
      expect(rich.pages.find((r) => r.path === p.path)?.html).toBe(p.html);
    }
  });
});
