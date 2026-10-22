/**
 * Site core shared by `chiltepin build` and `chiltepin serve` — pure functions, no I/O.
 *
 * {@link buildSite} turns a set of parsed documents into a multi-page static
 * site: one HTML page per doc (wrapped in a shell with a left nav sidebar), a
 * companion slide deck per doc at `<slug>.slides.html` (a Doc | Slides toggle
 * on each page links the two views), plus an `index.html` card grid built from
 * each doc's `meta`.
 *
 * Links work like real documentation:
 *
 * - Cross-doc reference chips (`data-ref="doc#id"`) become relative
 *   `<slug>.html#id` links, using the {@link resolveRefs} graph — on the page
 *   and in the deck.
 * - Prose links in the three internal forms (`#anchor`, `other-doc#anchor`,
 *   `./other.md#anchor`) become relative `.html` links.
 * - Local images (and `meta.logo`) are listed in `assets`, so `build` copies
 *   them next to the pages.
 * - The sidebar groups the docs by top folder, then by tag; the current doc
 *   lists its own `##` / `###` headings; a filter box searches every title
 *   and heading (`search.json`).
 *
 * With `sharedAssets` (`chiltepin build`), the stylesheet and the script are
 * written once (`assets/chiltepin.css`, `assets/chiltepin.js`) and every page
 * links them. Without it (`serve`, Studio), each page stays self-contained.
 *
 * Diagnostics (schema + ref) are returned as values — the callers decide how
 * to surface them (`chiltepin build` warns, `chiltepin serve` shows an in-page banner).
 */

import {
  blockIds,
  headingIds,
  lintLocalLinks,
  markdownHeadings,
  resolveLinkTarget,
  resolveRefs,
  stripInlineStyling,
  validateDocument,
  type BlockDataMap,
  type Diagnostic,
  type Document,
} from 'chiltepin-core';
import {
  buildThemeVars,
  DEFAULT_THEME,
  escapeHtml,
  FAVICON_LINK,
  houseCss,
  htmlRenderers,
  renderDocumentParts,
  renderProse,
  type DocumentParts,
  toSlides,
  schemeMarkup,
  type ColorScheme,
} from 'chiltepin-render';
import { guardRender } from './renderGuard.js';

/** A loaded document ready for site rendering. */
export interface SiteDoc {
  /** Slug (path under the docs root without `.md`, e.g. `guides/api`). */
  readonly slug: string;
  /** Source file path relative to the project root (for diagnostics). */
  readonly file: string;
  /** The parsed document. */
  readonly doc: Document;
}

/** One rendered page of the site. */
export interface SitePage {
  /** Output path relative to the site root (`index.html`, `<slug>.html`, or
   * the doc's deck at `<slug>.slides.html`). */
  readonly path: string;
  /** Complete standalone HTML. */
  readonly html: string;
  /** Page title. */
  readonly title: string;
}

/** A generated file that is not a page (`assets/chiltepin.css`, `search.json`). */
export interface SiteFile {
  readonly path: string;
  readonly content: string;
}

/** A local file a page links to (an image, `meta.logo`), to copy next to the pages. */
export interface SiteAsset {
  /** Source path relative to the project root, POSIX separators. */
  readonly from: string;
  /** Output path relative to the site root. */
  readonly to: string;
}

/** Options for {@link buildSite}. */
interface SiteOptions {
  /** Internal escape hatch: CSS-variable overrides emitted on `:root`. */
  readonly themeVars?: Readonly<Record<string, string>>;
  /** The pages' colour scheme (`dark` by default). */
  readonly colorScheme?: ColorScheme;
  /** Inject the live-reload `EventSource` script (serve only, never build). */
  readonly liveReload?: boolean;
  /** Build the rich index page: project TLDR, doc map grouped by folder and
   * tag, and a cross-reference graph. On by default — `false` emits the
   * plain card grid. */
  readonly richIndex?: boolean;
  /** Write the stylesheet and script once (`assets/`) and link them from
   * every page (`chiltepin build`). Off: every page inlines them. */
  readonly sharedAssets?: boolean;
}

/** Result of {@link buildSite}. */
interface SiteResult {
  /** All pages: `index.html` first, then per doc the page + its slide deck. */
  readonly pages: readonly SitePage[];
  /** Generated non-page files: `search.json`, and with `sharedAssets` the CSS and JS. */
  readonly files: readonly SiteFile[];
  /** Local images the pages link to, to copy into the output. */
  readonly assets: readonly SiteAsset[];
  /** Schema + reference diagnostics across the whole doc set. */
  readonly diagnostics: readonly Diagnostic[];
}

/** Live-reload client (kept tiny; EventSource reconnects natively). */
const LIVE_RELOAD_SCRIPT = `<script>new EventSource('/__events').onmessage=()=>location.reload()</script>`;

/** The shared stylesheet path and the shared script path, from the site root. */
const CSS_FILE = 'assets/chiltepin.css';
const JS_FILE = 'assets/chiltepin.js';

/**
 * Sidebar + index stylesheet in the editorial skin (`packages/render/DESIGN.md`):
 * role tokens only (`--paper`, `--ink`, `--muted`, `--soft`, `--rule`, …), so
 * the chrome follows the same light/dark sets the document does — those are
 * defined once, on `:root`, in the house CSS. Hairlines, no shadows, no filled
 * pills; small labels are mono eyebrows. Sticky sidebar that folds into a
 * `<details>` menu under 900px; nav and toggle never print.
 */
const SITE_CSS = `
body{margin:0;}
.site{display:flex;align-items:flex-start;max-width:1440px;margin:0 auto;}
.site-nav{position:sticky;top:0;flex:none;width:248px;max-height:100vh;overflow-y:auto;padding:28px 18px 48px;border-right:1px solid var(--rule);font-family:var(--font-body);font-size:13px;color:var(--ink);}
.site-nav .nav-brand{display:block;font-family:var(--font-display);font-weight:600;font-size:14px;letter-spacing:.01em;color:var(--ink);text-decoration:none;padding:4px 8px;margin-bottom:6px;}
.site-eyebrow{font-family:var(--font-mono);font-size:10px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:var(--soft);}
.site-nav .nav-head{padding:10px 8px 6px;border-top:1px solid var(--rule);}
.site-nav a{display:block;color:var(--ink);text-decoration:none;padding:4px 8px;border-radius:4px;line-height:1.45;}
.site-nav a:hover{background:var(--paper-2);}
.site-nav a.current{color:var(--ink);font-weight:600;background:var(--paper-2);box-shadow:inset 2px 0 0 var(--ink);}
.site-nav .nav-tag{display:block;font-family:var(--font-mono);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--soft);padding:6px 8px 2px;}
.site-nav .nav-sections{margin:2px 0 8px 12px;padding-left:10px;border-left:1px solid var(--rule);}
.site-nav .nav-sections a{font-size:12px;color:var(--muted);}
.site-nav .nav-sections a.h3{padding-left:18px;font-size:11.5px;}
.site-nav .nav-sections a:hover{color:var(--ink);}
.site-nav .nav-fold > summary{display:none;}
.site-nav .nav-search{display:block;width:100%;box-sizing:border-box;margin:4px 0 10px;padding:6px 9px;border:1px solid var(--rule-solid);border-radius:5px;background:var(--paper);color:var(--ink);font:inherit;font-size:12.5px;}
.site-nav .nav-search:focus{outline:2px solid var(--ink);outline-offset:1px;}
.site-nav .nav-results{list-style:none;margin:0 0 10px;padding:0;}
.site-nav .nav-results a{font-size:12px;}
.site-nav .nav-results .nav-hit-doc{display:block;font-size:10.5px;color:var(--soft);}
.site-nav .nav-results .nav-none{padding:4px 8px;font-size:12px;color:var(--soft);}
.site-main{flex:1;min-width:0;}
.site-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;max-width:var(--page-max,1180px);box-sizing:border-box;margin:0 auto;padding:22px 56px 0;font-family:var(--font-body);font-size:12px;color:var(--soft);}
.site-bar .crumbs a{color:var(--muted);text-decoration:none;}
.site-bar .crumbs a:hover{color:var(--ink);text-decoration:underline;}
.site-bar .crumbs span{margin:0 6px;color:var(--soft);}
.site-main .docskin{padding-top:24px;}
@media (max-width:900px){
.site{display:block;}
.site-nav{position:static;width:auto;max-height:none;border-right:0;border-bottom:1px solid var(--rule);padding:14px 20px;}
.site-nav .nav-fold > summary{display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600;padding:6px 8px;list-style:none;}
.site-nav .nav-fold > summary::-webkit-details-marker{display:none;}
.site-nav .nav-fold > summary::before{content:'☰';font-size:14px;}
.site-bar{padding:14px 20px 0;}
}
@media print{.site-nav,.site-bar,.view-toggle{display:none!important;}.site{display:block;max-width:none;}}
.idx-head{padding:16px 0 28px;margin-bottom:36px;border-bottom:1px solid var(--rule);}
.idx-eyebrow{margin-bottom:10px;}
.idx-title{font-family:var(--font-display);font-weight:700;font-size:clamp(32px,4.4vw,48px);line-height:1.1;letter-spacing:-.015em;color:var(--ink);margin:0;}
.idx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;}
.idx-card{display:block;border:1px solid var(--rule-solid);border-radius:6px;background:var(--paper);padding:20px 22px 16px;text-decoration:none;color:var(--ink);box-shadow:none;}
.idx-card:hover{border-color:var(--ink);}
.idx-card .idx-tag{display:inline-block;font-family:var(--font-mono);font-size:10px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;line-height:1.3;padding:2px 7px;border:1px solid var(--rule-solid);border-radius:2px;background:var(--paper);color:var(--muted);margin-bottom:12px;}
.idx-card h2{font-family:var(--font-body);font-weight:600;font-size:16px;line-height:1.3;color:var(--ink);margin:0 0 6px;}
.idx-card p{font-size:13px;line-height:1.55;color:var(--muted);margin:0 0 12px;}
.idx-card p code{font-family:var(--font-mono);font-size:12px;}
.idx-card .idx-slug{font-family:var(--font-mono);font-size:11px;color:var(--soft);}
.site-main{position:relative;}
.view-toggle{display:inline-flex;border:1px solid var(--rule-solid);border-radius:6px;background:var(--paper);overflow:hidden;font-family:var(--font-body);font-size:12px;font-weight:600;letter-spacing:.01em;box-shadow:none;}
.view-toggle a{display:flex;align-items:center;padding:5px 14px;color:var(--muted);text-decoration:none;line-height:1.4;}
.view-toggle a + a{border-left:1px solid var(--rule-solid);}
.view-toggle a:hover{color:var(--ink);background:var(--paper-2);}
.view-toggle a[aria-current]{background:var(--ink);color:var(--paper);}
.view-toggle a[aria-current]:hover{background:var(--ink);color:var(--paper);}
`;

/**
 * Floating "Document ▸" chip spliced into deck pages — top-right, out of the
 * way of the deck's own bottom nav bar; a paper chip with a hairline, no shadow.
 */
const DECK_BACK_CSS = `
.deck-doc-link{position:fixed;top:14px;right:18px;z-index:20;display:inline-flex;align-items:center;gap:7px;
  padding:6px 14px;border:1px solid var(--rule-solid);border-radius:6px;
  background:var(--paper);
  font-family:var(--font-body);font-size:12px;font-weight:600;letter-spacing:.01em;color:var(--ink);
  text-decoration:none;box-shadow:none;}
.deck-doc-link:hover{background:var(--paper-2);border-color:var(--ink);}
@media print{.deck-doc-link{display:none;}}
`;

/**
 * Styles for the rich index only. In the shared stylesheet with
 * `sharedAssets`, else inlined into the index page's main column — never into
 * a doc page, so pages built with `--no-rich-index` stay byte-identical.
 */
const RICH_INDEX_CSS = `
.idx-tldr{display:grid;gap:5px;margin-top:16px;font-size:13px;line-height:1.55;color:var(--muted);}
.idx-tldr a{color:var(--muted);text-decoration:none;}
.idx-tldr a:hover{color:var(--ink);}
.idx-tldr strong{font-family:var(--font-mono);font-size:10px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:var(--ink);}
.idx-group{margin-bottom:40px;}
.idx-group-head{display:flex;align-items:baseline;gap:10px;font-family:var(--font-body);font-weight:600;font-size:18px;color:var(--ink);margin:0 0 14px;padding-bottom:8px;border-bottom:1px solid var(--rule);}
.idx-group-count{font-family:var(--font-mono);font-size:10px;font-weight:500;letter-spacing:.14em;color:var(--soft);}
.idx-sub-head{margin:18px 0 10px;}
.idx-graph{margin-top:8px;}
.idx-graph-legend{list-style:none;margin:14px 0 0;padding:0;display:grid;gap:6px;font-size:13px;}
.idx-graph-legend a{color:var(--link);text-decoration:none;font-weight:600;}
.idx-graph-legend a:hover{text-decoration:underline;}
.idx-graph-legend .idx-slug{font-family:var(--font-mono);font-size:11px;color:var(--soft);margin-left:8px;}
`;

/**
 * The sidebar script: folds the menu under 900px, and filters every doc
 * title, subtitle, tag, and heading as the reader types. Vanilla, no
 * dependency; reads the index from `window.__chiltepinSearch`.
 */
const SITE_JS = `(function(){
var mq=window.matchMedia&&window.matchMedia('(max-width:900px)');
document.querySelectorAll('.nav-fold').forEach(function(d){if(mq&&mq.matches)d.removeAttribute('open');});
var box=document.querySelector('.nav-search');var out=document.querySelector('.nav-results');
if(!box||!out)return;var root=box.getAttribute('data-root')||'';
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
box.addEventListener('input',function(){
var q=box.value.trim().toLowerCase();var data=window.__chiltepinSearch||[];
if(q===''){out.hidden=true;out.innerHTML='';return;}
var words=q.split(/\\s+/);var hits=[];
data.forEach(function(d){
var hay=(d.t+' '+(d.s||'')+' '+(d.g||'')).toLowerCase();
if(words.every(function(w){return hay.indexOf(w)>=0;}))hits.push({u:d.u,t:d.t,doc:d.g||''});
(d.h||[]).forEach(function(h){var t=h[1].toLowerCase();if(words.every(function(w){return t.indexOf(w)>=0;}))hits.push({u:d.u+'#'+h[0],t:h[1],doc:d.t});});
});
out.hidden=false;
out.innerHTML=hits.length===0?'<li class="nav-none">No match</li>':hits.slice(0,14).map(function(h){return '<li><a href="'+esc(root+h.u)+'">'+esc(h.t)+(h.doc?'<span class="nav-hit-doc">'+esc(h.doc)+'</span>':'')+'</a></li>';}).join('');
});
})();`;

/** `../` prefix that climbs from a page at `slug` back to the site root. */
function rootPrefix(slug: string): string {
  const depth = slug.split('/').length - 1;
  return '../'.repeat(depth);
}

/** Matches the ref-chip attribute pair as emitted by the renderers — the
 * attribute order (`data-ref` then `href`) is fixed at emission and locked by
 * render unit tests, so this anchored rewrite is safe over our own markup. */
const REF_CHIP_RE = / data-ref="([^"]+)" href="#[^"]*"/g;

/** Same shape as core's `REF_RE`: optional doc part + `#` + id. */
const REF_RE = /^([\w/.-]+)?#([\w.-]+)$/;

/**
 * Rewrites cross-doc ref chips in one page's HTML: `data-ref="doc#id"` gets
 * `href="<relative>/doc.html#id"`; same-doc refs keep `#id` (or point at the
 * doc page from its deck); dangling refs lose the `href` (the chip renders
 * plain) but keep `data-ref`.
 */
function rewriteRefs(
  html: string,
  slug: string,
  nodes: ReadonlyMap<string, { readonly doc: string }>,
  inDeck = false,
): string {
  const prefix = rootPrefix(slug);
  return html.replace(REF_CHIP_RE, (whole, ref: string) => {
    const m = REF_RE.exec(ref);
    if (m === null) return whole;
    const targetDoc = m[1] ?? slug;
    const id = m[2] ?? '';
    const node = nodes.get(id);
    if (node === undefined || node.doc !== targetDoc) return ` data-ref="${ref}"`; // dangling
    if (node.doc === slug) return ` data-ref="${ref}" href="${inDeck ? `${escapeHtml(slugBase(slug))}.html` : ''}#${id}"`;
    return ` data-ref="${ref}" href="${prefix}${node.doc}.html#${id}"`;
  });
}

/** The `href` of every link the renderers write for Markdown (`<a href="…"`). */
const MD_LINK_RE = /<a href="([^"]*)"/g;

/**
 * Rewrites prose links in the three internal forms to the built pages:
 * `other-doc#id` and `./other.md#id` become `<relative>/other-doc.html#id`.
 * A `#anchor` stays on the page (from a deck it points at the doc page). A
 * link to a doc the site does not have is left as written (`check` reports
 * it as `E_DANGLING_LINK`).
 */
function rewriteLinks(html: string, slug: string, slugs: ReadonlySet<string>, inDeck = false): string {
  const prefix = rootPrefix(slug);
  return html.replace(MD_LINK_RE, (whole, raw: string) => {
    const href = raw.replace(/&amp;/g, '&');
    const target = resolveLinkTarget(href, slug);
    if (target === undefined) return whole;
    const frag = target.anchor !== undefined ? `#${encodeURIComponent(target.anchor)}` : '';
    if (target.local) return inDeck ? `<a href="${escapeHtml(slugBase(slug))}.html${frag}"` : whole;
    if (!slugs.has(target.doc)) return whole;
    if (target.doc === slug && !inDeck) return `<a href="${frag === '' ? `${escapeHtml(slugBase(slug))}.html` : frag}"`;
    return `<a href="${escapeHtml(prefix + target.doc)}.html${frag}"`;
  });
}

/** `<img src="…">` as the renderers write it (cover logo, Markdown images, figures). */
const IMG_RE = /(<img\b[^>]*?\ssrc=")([^"]*)(")/g;

/** POSIX `dirname`. */
function dirOf(p: string): string {
  const i = p.lastIndexOf('/');
  return i < 0 ? '' : p.slice(0, i);
}

/** `a/./b/../c` → `a/c`; `undefined` when it climbs above the start. */
function normalizePosix(p: string): string | undefined {
  const out: string[] = [];
  for (const part of p.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (out.length === 0) return undefined;
      out.pop();
    } else out.push(part);
  }
  return out.join('/');
}

/**
 * Finds the local images in one page's HTML and plans their copies: a file
 * inside the docs folder keeps its place relative to the page; a file
 * elsewhere in the project goes under `assets/files/` and the `src` is
 * rewritten to reach it. URLs (`https:`, `data:`, `/abs`) are left alone.
 */
function collectImages(
  html: string,
  d: SiteDoc,
  assets: Map<string, string>,
): string {
  const fileDir = dirOf(d.file.replace(/\\/g, '/'));
  const slugDir = dirOf(d.slug);
  // The docs root, as a project-relative path: the doc's folder minus its slug folders.
  const docsRoot = slugDir === '' ? fileDir : fileDir.slice(0, Math.max(0, fileDir.length - slugDir.length - 1));
  return html.replace(IMG_RE, (whole, open: string, raw: string, close: string) => {
    const src = raw.replace(/&amp;/g, '&');
    if (src === '' || /^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('/') || src.startsWith('#')) return whole;
    const clean = src.split(/[?#]/)[0] ?? src;
    const from = normalizePosix(`${fileDir}/${clean}`);
    if (from === undefined) return whole;
    const inDocs = docsRoot === '' || from.startsWith(`${docsRoot}/`);
    const to = inDocs ? (docsRoot === '' ? from : from.slice(docsRoot.length + 1)) : `assets/files/${from}`;
    assets.set(to, from);
    if (inDocs) return whole;
    return `${open}${escapeHtml(rootPrefix(d.slug) + to)}${close}`;
  });
}

/** Basename of a slug — deck/page siblings live in the same directory, so
 * their mutual links are plain basenames (correct at any nesting depth). */
function slugBase(slug: string): string {
  return slug.split('/').pop() ?? slug;
}

/** Top folder of a slug (`guides/api` → `guides`), `''` for a doc at the root. */
function folderOf(slug: string): string {
  const slash = slug.indexOf('/');
  return slash > 0 ? slug.slice(0, slash) : '';
}

/** First token of a compound tag badge, the family name:
 * `ADR · Accepted · 2026-06-13` → `ADR`. */
function tagToken(tag: string): string {
  return (tag.split('·')[0] ?? tag).trim();
}

/** A doc's tag token, or `''`. */
function tagOf(d: { readonly doc: Document }): string {
  const tag = d.doc.meta?.tag?.trim();
  return tag !== undefined && tag.length > 0 ? tagToken(tag) : '';
}

/** Root docs first, then folders A→Z; inside a folder, by tag (untagged last), then title. */
function navOrder<T extends { readonly slug: string; readonly doc: Document }>(docs: readonly T[]): T[] {
  const title = (d: T): string => d.doc.meta?.title ?? d.slug;
  return [...docs].sort((a, b) => {
    const fa = folderOf(a.slug);
    const fb = folderOf(b.slug);
    if (fa !== fb) return fa === '' ? -1 : fb === '' ? 1 : fa.localeCompare(fb);
    const ta = tagOf(a).toLowerCase();
    const tb = tagOf(b).toLowerCase();
    if (ta !== tb) return ta === '' ? 1 : tb === '' ? -1 : ta.localeCompare(tb);
    return title(a).localeCompare(title(b));
  });
}

/** One `##` / `###` heading of a doc, with the anchor the page gives it. */
interface NavHeading {
  readonly id: string;
  readonly depth: 2 | 3;
  readonly text: string;
}

/**
 * A doc's outline headings with their anchors. The renderer's outline when
 * it has one; else the same contract from core (`markdownHeadings`, then
 * `headingIds` with the block ids reserved).
 */
function headingsOf(doc: Document, parts: DocumentParts): NavHeading[] {
  const outline = (parts as { readonly outline?: { readonly headings?: readonly NavHeading[] } }).outline;
  if (outline?.headings !== undefined) return [...outline.headings];
  const all = doc.segments.flatMap((s) => (s.kind === 'markdown' ? markdownHeadings(s.text) : []));
  const ids = headingIds(
    all.map((h) => h.text),
    new Set(blockIds(doc)),
  );
  return all.map((h, i) => ({ id: ids[i] ?? 'section', depth: h.depth, text: h.text }));
}

/**
 * Gives each bare `<h2>` / `<h3>` of the prose its anchor, in order. A page
 * whose renderer already set the ids is left as it is (only a bare tag takes
 * one), so the ids always match `headingsOf`.
 */
function anchorHeadings(body: string, headings: readonly NavHeading[]): string {
  let i = 0;
  return body.replace(/<h([23])>/g, (whole, depth: string) => {
    const h = headings[i];
    if (h === undefined || String(h.depth) !== depth) return whole;
    i += 1;
    return `<h${depth} id="${escapeHtml(h.id)}">`;
  });
}

/** A heading's text for the nav: inline Markdown (and inline styling) reduced to plain text. */
function plainHeading(text: string): string {
  return stripInlineStyling(text)
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Nav entry for the sidebar doc list. */
interface NavDoc {
  readonly slug: string;
  readonly title: string;
  readonly doc: Document;
}

/** The sidebar: a filter box, every doc by folder then tag (the current one
 * highlighted, with its headings), folded into a menu on a narrow screen.
 * `current === undefined` on the index page. */
function sidebar(navDocs: readonly NavDoc[], current: string | undefined, headings: readonly NavHeading[]): string {
  const prefix = current !== undefined ? rootPrefix(current) : '';
  const ordered = navOrder(navDocs);
  let html = '';
  let folder: string | undefined;
  let tag: string | undefined;
  // A folder shows tag labels only when its tags group docs: two or more
  // tags, and no more tags than half its docs (else every doc is its own tag).
  const tagsIn = new Map<string, Set<string>>();
  const countIn = new Map<string, number>();
  for (const d of ordered) {
    const f = folderOf(d.slug);
    const set = tagsIn.get(f) ?? new Set<string>();
    set.add(tagOf(d).toLowerCase());
    tagsIn.set(f, set);
    countIn.set(f, (countIn.get(f) ?? 0) + 1);
  }
  const labelled = (f: string): boolean => {
    const tags = tagsIn.get(f)?.size ?? 0;
    return tags > 1 && tags <= Math.ceil((countIn.get(f) ?? 0) / 2);
  };
  for (const d of ordered) {
    const f = folderOf(d.slug);
    if (f !== folder) {
      html += `<div class="nav-head site-eyebrow">${escapeHtml(f === '' ? 'Documents' : f)}</div>`;
      folder = f;
      tag = undefined;
    }
    const t = tagOf(d);
    // A tag label only where a folder mixes tags.
    if (labelled(f) && t.toLowerCase() !== tag) {
      html += `<span class="nav-tag">${escapeHtml(t === '' ? 'Other' : t)}</span>`;
    }
    tag = t.toLowerCase();
    const isCurrent = d.slug === current;
    const cls = isCurrent ? ' class="current"' : '';
    html += `<a${cls} href="${prefix}${escapeHtml(d.slug)}.html">${escapeHtml(d.title)}</a>`;
    if (isCurrent && headings.length > 0) {
      const secs = headings
        .map((h) => `<a${h.depth === 3 ? ' class="h3"' : ''} href="#${escapeHtml(h.id)}">${escapeHtml(plainHeading(h.text))}</a>`)
        .join('');
      html += `<div class="nav-sections">${secs}</div>`;
    }
  }
  return (
    `<aside class="site-nav">` +
    `<a class="nav-brand" href="${prefix}index.html">Documentation</a>` +
    `<details class="nav-fold" open><summary>Menu</summary>` +
    `<input class="nav-search" type="search" placeholder="Filter titles and headings" aria-label="Filter titles and headings" data-root="${prefix}">` +
    `<ul class="nav-results" hidden></ul>` +
    `<nav>${html}</nav>` +
    `</details>` +
    `</aside>`
  );
}

/** Compact Doc | Slides segmented control shown on every doc page. */
function viewToggle(slug: string): string {
  const base = escapeHtml(slugBase(slug));
  return (
    `<nav class="view-toggle" aria-label="View as">` +
    `<a aria-current="page" href="${base}.html">Doc</a>` +
    `<a href="${base}.slides.html">Slides</a>` +
    `</nav>`
  );
}

/**
 * The bar above a doc: where it sits (Docs / folder / title) and the
 * Doc | Slides toggle. In the page flow, so it never covers the cover's tag
 * and status.
 */
function siteBar(slug: string, title: string): string {
  const prefix = rootPrefix(slug);
  const f = folderOf(slug);
  const crumbs =
    `<nav class="crumbs" aria-label="Breadcrumb"><a href="${prefix}index.html">Docs</a>` +
    (f !== '' ? `<span>/</span>${escapeHtml(f)}` : '') +
    `<span>/</span>${escapeHtml(title)}</nav>`;
  return `<div class="site-bar">${crumbs}${viewToggle(slug)}</div>`;
}

/**
 * Dresses a standalone deck (from `chiltepin-render`'s `toSlides`) for the
 * site: splices a floating back-link pill — and, when serving, the same
 * live-reload script the doc pages get — just before `</body>`. String-splice
 * only; the deck markup itself is never modified.
 */
function deckWithChrome(deckHtml: string, slug: string, liveReload: boolean): string {
  const base = escapeHtml(slugBase(slug));
  const pill = `<a class="deck-doc-link" href="${base}.html">Document <span aria-hidden="true">▸</span></a>`;
  const chrome = `<style>${DECK_BACK_CSS}</style>${pill}${liveReload ? LIVE_RELOAD_SCRIPT : ''}`;
  return deckHtml
    .replace('</head>', `${FAVICON_LINK}\n</head>`)
    .replace('</body>', `${chrome}</body>`);
}

/** What every page shell shares: the stylesheet, and how the script loads. */
interface ShellAssets {
  /** Shared: link `assets/chiltepin.css` and `assets/chiltepin.js`. */
  readonly shared: boolean;
  /** The search index, as a script body (inline pages only). */
  readonly searchScript: string;
}

/** Wraps a page's nav + main content into a standalone HTML document. */
function pageShell(args: {
  readonly title: string;
  readonly css: string;
  readonly themeVars: string;
  readonly nav: string;
  readonly main: string;
  readonly liveReload: boolean;
  /** Doc pages only: the bar with the breadcrumbs and the Doc | Slides control. */
  readonly bar?: string;
  readonly colorScheme?: ColorScheme;
  readonly assets: ShellAssets;
  /** `../` back to the site root. */
  readonly prefix: string;
}): string {
  const themeBlock = args.themeVars.length > 0 ? `<style>:root{${args.themeVars}}</style>` : '';
  const reload = args.liveReload ? LIVE_RELOAD_SCRIPT : '';
  // Dark is the look; the config's `colorScheme` stamps light or lets the OS
  // choose, the same way `renderDocument` does.
  const scheme = schemeMarkup(args.colorScheme);
  const styles = args.assets.shared
    ? `<link rel="stylesheet" href="${args.prefix}${CSS_FILE}">`
    : `<style>${args.css}</style>`;
  const siteStyles = args.assets.shared ? '' : `<style>${SITE_CSS}</style>`;
  const script = args.assets.shared
    ? `<script src="${args.prefix}${JS_FILE}" defer></script>`
    : `<script>${args.assets.searchScript}${SITE_JS}</script>`;
  return (
    `<!doctype html>\n` +
    `<html lang="en"${scheme.stamp}>\n` +
    `<head>\n` +
    `<meta charset="utf-8">\n` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">\n` +
    `<title>${escapeHtml(args.title)}</title>\n` +
    `${FAVICON_LINK}\n` +
    styles +
    themeBlock +
    scheme.style +
    siteStyles +
    `\n</head>\n` +
    `<body>\n` +
    `<div class="site">\n` +
    args.nav +
    `\n<main class="site-main">${args.bar ?? ''}<div class="docskin">${args.main}</div></main>\n` +
    `</div>\n` +
    script +
    reload +
    `</body>\n` +
    `</html>\n`
  );
}

/** A subtitle as inline Markdown for a card or a digest line (no nested links). */
function inlineSubtitle(sub: string): string {
  return renderProse(sub)
    .replace(/^<div class="prose">\s*/, '')
    .replace(/\s*<\/div>\s*$/, '')
    .replace(/^<p>/, '')
    .replace(/<\/p>\s*$/, '')
    .replace(/<\/?a\b[^>]*>/g, '')
    .trim();
}

/** Renders one index card (shared by the plain grid and the rich doc map).
 * `tagDisplay` overrides the tag pill text (rich doc map: first-seen casing
 * inside a group); the default renders `meta.tag` as written. */
function indexCard(d: SiteDoc, tagDisplay?: string): string {
  const meta = d.doc.meta;
  const shownTag = tagDisplay ?? meta?.tag;
  const tag = shownTag !== undefined ? `<span class="idx-tag">${escapeHtml(shownTag)}</span>` : '';
  const title = escapeHtml(meta?.title ?? d.slug);
  const sub = meta?.subtitle !== undefined ? `<p>${inlineSubtitle(meta.subtitle)}</p>` : '';
  return (
    `<a class="idx-card" href="${escapeHtml(d.slug)}.html">` +
    tag +
    `<h2>${title}</h2>` +
    sub +
    `<span class="idx-slug">${escapeHtml(d.slug)}</span>` +
    `</a>`
  );
}

/** Renders the index page's meta-card grid. */
function indexCards(docs: readonly SiteDoc[]): string {
  const cards = docs.map((d) => indexCard(d)).join('');
  return (
    `<div class="idx-head">` +
    `<div class="idx-eyebrow site-eyebrow">${docs.length} document${docs.length === 1 ? '' : 's'}</div>` +
    `<h1 class="idx-title">Documentation</h1>` +
    `</div>` +
    `<div class="idx-grid">${cards}</div>`
  );
}

// ─── Rich index (default; `--no-rich-index` opts out) ────────────────────────

/** One group of docs on the rich index: a top folder (or, in a flat docs
 * folder, a tag), with its tag sub-groups when it mixes tags. */
interface IndexGroup {
  /** Display label — a folder name, a meta tag as written, or `Documents`. */
  readonly label: string;
  /** Anchor id on the group's section (`group-…`). */
  readonly anchor: string;
  readonly docs: readonly SiteDoc[];
  /** Tag sub-groups (folder groups that mix tags), in display order. */
  readonly tags: readonly { readonly label: string; readonly docs: readonly SiteDoc[] }[];
}

/** Groups docs by their first tag token (case-insensitive), untagged as `Documents`. */
function byTag(docs: readonly SiteDoc[]): { key: string; label: string; docs: SiteDoc[] }[] {
  const map = new Map<string, { key: string; label: string; docs: SiteDoc[] }>();
  for (const d of docs) {
    const t = tagOf(d);
    const key = t === '' ? '' : t.toLowerCase();
    const g = map.get(key);
    if (g !== undefined) g.docs.push(d);
    else map.set(key, { key, label: t === '' ? 'Documents' : t, docs: [d] });
  }
  return [...map.values()];
}

/**
 * Groups docs for the rich index: by top folder first (root docs first, then
 * folders A→Z), and inside a folder that mixes tags, by tag (largest first).
 * A docs folder with no subfolders groups by tag, largest first.
 */
function groupDocs(docs: readonly SiteDoc[]): IndexGroup[] {
  const folders = new Map<string, SiteDoc[]>();
  for (const d of docs) {
    const f = folderOf(d.slug);
    const list = folders.get(f);
    if (list !== undefined) list.push(d);
    else folders.set(f, [d]);
  }
  const bySize = <T extends { label: string; docs: readonly unknown[] }>(a: T, b: T): number =>
    b.docs.length - a.docs.length || (a.label < b.label ? -1 : 1);
  let raw: { label: string; docs: SiteDoc[]; tags: { label: string; docs: SiteDoc[] }[] }[];
  if (folders.size <= 1) {
    raw = byTag(docs)
      .sort(bySize)
      .map((g) => ({ label: g.label, docs: g.docs, tags: [] }));
  } else {
    raw = [...folders.entries()]
      .sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)))
      .map(([f, list]) => {
        const tags = byTag(list).sort(bySize);
        return {
          label: f === '' ? 'Documents' : f,
          docs: tags.flatMap((t) => t.docs),
          tags: tags.length > 1 ? tags.map((t) => ({ label: t.key === '' ? 'Other' : t.label, docs: t.docs })) : [],
        };
      });
  }
  const seen = new Set<string>();
  return raw.map((g) => {
    const base = `group-${g.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'docs'}`;
    let anchor = base;
    for (let n = 2; seen.has(anchor); n += 1) anchor = `${base}-${n}`;
    seen.add(anchor);
    return { label: g.label, anchor, docs: g.docs, tags: g.tags };
  });
}

/** TLDR digest: one line per group — its label and doc count. A group of one
 * also carries that doc's subtitle as its one-liner; a larger group does not
 * (one doc's subtitle does not describe the group). Meta fields and counts
 * only. */
function tldrDigest(groups: readonly IndexGroup[]): string {
  const lines = groups
    .map((g) => {
      const sub = g.docs.length === 1 ? g.docs[0]?.doc.meta?.subtitle : undefined;
      const tail = sub !== undefined ? ` — ${inlineSubtitle(sub)}` : '';
      const count = `${g.docs.length} document${g.docs.length === 1 ? '' : 's'}`;
      return `<a href="#${g.anchor}"><strong>${escapeHtml(g.label)}</strong> · ${count}${tail}</a>`;
    })
    .join('');
  return `<nav class="idx-tldr">${lines}</nav>`;
}

/**
 * Renders the doc-to-doc cross-reference graph as a real `graph` block via
 * the `chiltepin-render` registry — the renderer owns all layout (auto-grid,
 * left-to-right). An edge A→B means a block in A references an id in B; the
 * reference count becomes the edge `weight` when above 1. Node click-through
 * is not in the graph schema, so a legend under the graph links each doc.
 * Returns `''` when no doc references another — the section is omitted.
 */
function crossRefGraphSection(
  docs: readonly SiteDoc[],
  refEdges: ReadonlyArray<{ readonly from: string; readonly to: string }>,
): string {
  // Ref-graph endpoints are `doc#id` (or `doc@line` when the source block has
  // no id); ids and slugs never contain `#` or `@`, so the doc is the head.
  const counts = new Map<string, number>();
  for (const e of refEdges) {
    const from = e.from.split(/[#@]/, 1)[0] ?? '';
    const to = e.to.split('#', 1)[0] ?? '';
    if (from.length === 0 || to.length === 0 || from === to) continue;
    const key = `${from}\u0000${to}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (counts.size === 0) return '';

  const involved = new Set<string>();
  for (const key of counts.keys()) {
    const [from, to] = key.split('\u0000');
    if (from !== undefined) involved.add(from);
    if (to !== undefined) involved.add(to);
  }
  const graphDocs = docs.filter((d) => involved.has(d.slug));
  const data: BlockDataMap['graph'] = {
    title: 'Cross-references',
    nodes: graphDocs.map((d) => ({ id: d.slug, label: d.doc.meta?.title ?? d.slug })),
    edges: [...counts.entries()].map(([key, count]) => {
      const sep = key.indexOf('\u0000');
      return {
        from: key.slice(0, sep),
        to: key.slice(sep + 1),
        ...(count > 1 ? { weight: count } : {}),
      };
    }),
  };
  const legend = graphDocs
    .map(
      (d) =>
        `<li><a href="${escapeHtml(d.slug)}.html">${escapeHtml(d.doc.meta?.title ?? d.slug)}</a>` +
        `<span class="idx-slug">${escapeHtml(d.slug)}</span></li>`,
    )
    .join('');
  return (
    `<section class="idx-graph">` +
    htmlRenderers.graph(data) +
    `<ul class="idx-graph-legend">${legend}</ul>` +
    `</section>`
  );
}

/** Renders a list of cards. Tags that differ only in case inside a group
 * display with the first-seen casing (`Guide` + `GUIDE` → both `Guide`). */
function groupCards(docs: readonly SiteDoc[]): string {
  const firstSeen = new Map<string, string>();
  return docs
    .map((d) => {
      const tag = d.doc.meta?.tag;
      if (tag === undefined) return indexCard(d);
      const key = tag.trim().toLowerCase();
      const display = firstSeen.get(key) ?? tag;
      if (!firstSeen.has(key)) firstSeen.set(key, tag);
      return indexCard(d, display);
    })
    .join('');
}

/** Groups are informative only when docs actually share them. Above this
 * singleton share, the doc map degrades to a restatement of the card grid —
 * so it (and the digest) is dropped for the plain flat grid. */
const SINGLETON_LIMIT = 0.6;

/**
 * Renders the rich index: TLDR head, doc map grouped by folder then tag, and
 * the cross-reference graph. Deterministic — built only from the parsed docs.
 *
 * Degeneracy fallback: when more than {@link SINGLETON_LIMIT} of the groups
 * hold a single doc, grouping adds nothing — the page keeps the flat card
 * grid with no digest and no group headers, and the rich index contributes
 * only the cross-reference graph section (if any).
 */
function richIndexMain(
  docs: readonly SiteDoc[],
  refEdges: ReadonlyArray<{ readonly from: string; readonly to: string }>,
  inlineCss: boolean,
): string {
  const groups = groupDocs(docs);
  const singletons = groups.filter((g) => g.docs.length === 1).length;
  const degenerate = groups.length > 0 && singletons / groups.length > SINGLETON_LIMIT;
  const head =
    `<div class="idx-head">` +
    `<div class="idx-eyebrow site-eyebrow">${docs.length} document${docs.length === 1 ? '' : 's'}</div>` +
    `<h1 class="idx-title">Documentation</h1>` +
    (groups.length > 0 && !degenerate ? tldrDigest(groups) : '') +
    `</div>`;
  const body = degenerate
    ? `<div class="idx-grid">${docs.map((d) => indexCard(d)).join('')}</div>`
    : groups
        .map(
          (g) =>
            `<section class="idx-group" id="${g.anchor}">` +
            `<h2 class="idx-group-head">${escapeHtml(g.label)}` +
            `<span class="idx-group-count">${g.docs.length}</span></h2>` +
            (g.tags.length > 0
              ? g.tags
                  .map(
                    (t) =>
                      `<div class="idx-sub-head site-eyebrow">${escapeHtml(t.label)} · ${t.docs.length}</div>` +
                      `<div class="idx-grid">${groupCards(t.docs)}</div>`,
                  )
                  .join('')
              : `<div class="idx-grid">${groupCards(g.docs)}</div>`) +
            `</section>`,
        )
        .join('');
  return (inlineCss ? `<style>${RICH_INDEX_CSS}</style>` : '') + head + body + crossRefGraphSection(docs, refEdges);
}

/** The body of a placeholder page for a document whose render threw. */
function failedBody(d: SiteDoc, message: string): string {
  return (
    `<div class="idx-head">` +
    `<div class="idx-eyebrow site-eyebrow">Render failed</div>` +
    `<h1 class="idx-title">${escapeHtml(d.doc.meta?.title ?? d.slug)}</h1>` +
    `</div>` +
    `<p>${escapeHtml(d.file)} could not be rendered.</p>` +
    `<pre><code>${escapeHtml(message)}</code></pre>`
  );
}

/** Stand-in parts for a document whose render threw — same shape, no content. */
function failedParts(d: SiteDoc, message: string): DocumentParts {
  return {
    css: houseCss,
    themeVars: '',
    body: failedBody(d, message),
    title: d.doc.meta?.title ?? d.slug,
    sections: [],
  };
}

/** One entry of `search.json`: a page and its headings. */
interface SearchEntry {
  /** Page path from the site root (`guides/api.html`). */
  readonly u: string;
  /** Title, subtitle, and tag. */
  readonly t: string;
  readonly s?: string;
  readonly g?: string;
  /** Headings: `[anchor, text]`. */
  readonly h: readonly (readonly [string, string])[];
}

/**
 * Builds the whole site in memory: `index.html` plus, per doc, one page and
 * one slide deck, with the sidebar nav, cross-doc ref links, and prose links
 * resolved; the search index; and, with `sharedAssets`, the shared CSS and
 * JS. Pure — no file writes.
 *
 * A renderer that throws is contained: that document gets a placeholder page
 * and an `E_RENDER` diagnostic naming the block, and every other document
 * still builds.
 */
export function buildSite(docs: readonly SiteDoc[], opts: SiteOptions = {}): SiteResult {
  const diagnostics: Diagnostic[] = [];
  // Schema, then links: a dangling link is a 404 on the built site.
  for (const d of docs) diagnostics.push(...validateDocument(d.doc, d.file), ...lintLocalLinks(d.doc, d.file));
  const resolved = resolveRefs(docs.map((d) => ({ doc: d.doc, file: d.file })));
  diagnostics.push(...resolved.diagnostics);

  const themeOpts = {
    ...(opts.themeVars !== undefined ? { themeVars: opts.themeVars } : {}),
    ...(opts.colorScheme !== undefined ? { colorScheme: opts.colorScheme } : {}),
  };
  const liveReload = opts.liveReload === true;
  const shared = opts.sharedAssets === true;
  const slugs = new Set(docs.map((d) => d.slug));

  // A renderer that throws takes down its own document, not the build. The
  // diagnostic names the file and the offending block; the page it would have
  // produced becomes a placeholder carrying the same message, so the site keeps
  // the same URLs and nothing 404s while the author fixes the block.
  const rendered = docs.map((d) => {
    const guarded = guardRender(d.doc, d.file, 'page', () =>
      renderDocumentParts(d.doc, themeOpts),
    );
    if (guarded.ok) {
      return { doc: d, parts: guarded.value, failed: false, headings: headingsOf(d.doc, guarded.value) };
    }
    diagnostics.push(guarded.diagnostic);
    return { doc: d, parts: failedParts(d, guarded.diagnostic.message), failed: true, headings: [] as NavHeading[] };
  });
  const navDocs: NavDoc[] = rendered.map((r) => ({
    slug: r.doc.slug,
    title: r.doc.doc.meta?.title ?? r.doc.slug,
    doc: r.doc.doc,
  }));
  // The index reuses the first doc's css/themeVars (identical for every doc);
  // an empty doc set still gets a styled index from the skin directly.
  const first = rendered[0];
  const css = first?.parts.css ?? houseCss;
  const themeVars = first?.parts.themeVars ?? buildThemeVars(DEFAULT_THEME, opts.themeVars);

  // The search index: every page's title, subtitle, tag, and headings.
  const search: SearchEntry[] = navOrder(rendered.map((r) => ({ slug: r.doc.slug, doc: r.doc.doc, headings: r.headings }))).map(
    (r) => {
      const meta = r.doc.meta;
      return {
        u: `${r.slug}.html`,
        t: meta?.title ?? r.slug,
        ...(meta?.subtitle !== undefined ? { s: stripInlineStyling(meta.subtitle) } : {}),
        ...(meta?.tag !== undefined ? { g: meta.tag } : {}),
        h: r.headings.map((h) => [h.id, plainHeading(h.text)] as const),
      };
    },
  );
  const searchJson = JSON.stringify(search);
  const assets: ShellAssets = {
    shared,
    searchScript: `window.__chiltepinSearch=${searchJson.replace(/</g, '\\u003c')};`,
  };

  const images = new Map<string, string>();
  const pages: SitePage[] = [];
  pages.push({
    path: 'index.html',
    title: 'Documentation',
    html: pageShell({
      title: 'Documentation',
      css,
      themeVars,
      nav: sidebar(navDocs, undefined, []),
      main:
        opts.richIndex !== false
          ? richIndexMain(docs, resolved.graph.edges, !shared)
          : indexCards(docs),
      liveReload,
      ...(opts.colorScheme !== undefined ? { colorScheme: opts.colorScheme } : {}),
      assets,
      prefix: '',
    }),
  });

  for (const { doc, parts, failed, headings } of rendered) {
    const body = collectImages(rewriteLinks(anchorHeadings(parts.body, headings), doc.slug, slugs), doc, images);
    const shell = pageShell({
      title: parts.title,
      css: parts.css,
      themeVars: parts.themeVars,
      nav: sidebar(navDocs, doc.slug, headings),
      main: body,
      liveReload,
      ...(opts.colorScheme !== undefined ? { colorScheme: opts.colorScheme } : {}),
      bar: siteBar(doc.slug, parts.title),
      assets,
      prefix: rootPrefix(doc.slug),
    });
    pages.push({
      path: `${doc.slug}.html`,
      title: parts.title,
      html: rewriteRefs(shell, doc.slug, resolved.graph.nodes),
    });
    // Every doc also ships as a slide deck, linked from the page's toggle. A
    // document whose page already failed is not re-rendered as slides — the
    // deck would fail the same way, slowly, and say nothing new.
    let deckHtml: string | undefined;
    let deckError = 'The page could not be rendered.';
    if (!failed) {
      const deck = guardRender(doc.doc, doc.file, 'slide deck', () =>
        deckWithChrome(toSlides(doc.doc, themeOpts), doc.slug, liveReload),
      );
      if (deck.ok) {
        deckHtml = collectImages(
          rewriteRefs(rewriteLinks(deck.value, doc.slug, slugs, true), doc.slug, resolved.graph.nodes, true),
          doc,
          images,
        );
      } else {
        diagnostics.push(deck.diagnostic);
        deckError = deck.diagnostic.message;
      }
    }
    pages.push({
      path: `${doc.slug}.slides.html`,
      title: `${parts.title} — Slides`,
      html:
        deckHtml ??
        pageShell({
          title: `${parts.title} — Slides`,
          css: parts.css,
          themeVars: parts.themeVars,
          nav: sidebar(navDocs, doc.slug, []),
          main: failedBody(doc, deckError),
          liveReload,
          ...(opts.colorScheme !== undefined ? { colorScheme: opts.colorScheme } : {}),
          assets,
          prefix: rootPrefix(doc.slug),
        }),
    });
  }

  const files: SiteFile[] = [{ path: 'search.json', content: searchJson + '\n' }];
  if (shared) {
    files.push({ path: CSS_FILE, content: `${css}\n${SITE_CSS}\n${RICH_INDEX_CSS}` });
    files.push({ path: JS_FILE, content: `${assets.searchScript}\n${SITE_JS}\n` });
  }
  return {
    pages,
    files,
    assets: [...images.entries()].map(([to, from]) => ({ from, to })),
    diagnostics,
  };
}
