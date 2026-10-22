#!/usr/bin/env node
// Diagram quality for a generation-eval run: what `score.mjs` cannot see.
//
//   node evals/generate/quality.mjs <project-dir> <run-dir> [--cli <bin.js>] [--skill <skill-dir>]
//
// <project-dir>/docs/<id>.md   the handed-off docs
// --cli    the CLI build the run used (default: this repo's packages/cli/dist/bin.js)
// --skill  the skill folder the run used (default: <project-dir>/.claude/skills/chiltepin)
//
// Three measures, all mechanical:
//
// 1. Geometry — each doc is rendered with the run's own CLI and opened in
//    headless Chromium. Per diagram: edges that run through a node that is not
//    their own endpoint, pairs of edges that share a stretch of line, edge
//    crossings, labels that sit on a node or on another label, and labels the
//    renderer moved off the edge into a numbered legend.
// 2. Fidelity — for cases with `facts`, the share of named parts the diagram
//    blocks carry (a fact matches when any `|` alternative appears).
// 3. Template echo — diagram labels that appear verbatim in the skill or in
//    the `chiltepin block <type>` examples but not in the request: content
//    copied from an example instead of built from the request.
// 4. Corpus sameness and voice — the share of docs that end on the same last
//    heading (FAIL above 30%), the first words of the headings, "assumed" per
//    100 words, mentions of "the request", and the fit count (diagrams that
//    scroll or shrink below 65% at the default page width).
// 5. Review — when the run's CLI has `chiltepin review`, its issue counts per
//    kind (cut, overlap, fit, tiny, print), the same pass an agent runs.
//
// Writes <run-dir>/quality.json, <run-dir>/html/<id>.html, one PNG per
// diagram under <run-dir>/shots/, and one full-page PNG per doc under
// <run-dir>/pages/ (the judge's page screenshot, see JUDGE.md).

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const require = createRequire(join(root, 'packages/cli/package.json'));
const YAML = require('yaml');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const cli = resolve(flag('--cli') ?? join(root, 'packages/cli/dist/bin.js'));
const skillFlag = flag('--skill');
const casesFlag = flag('--cases');
const chrome = flag('--chrome') ?? process.env.CHILTEPIN_EVAL_CHROME;
const [projectDir, runDir] = args.map((p) => resolve(p));
if (!projectDir || !runDir) {
  console.error('usage: node evals/generate/quality.mjs <project-dir> <run-dir> [--cli <bin.js>] [--skill <dir>] [--cases <yaml>]');
  process.exit(1);
}
const skillDir = resolve(skillFlag ?? join(projectDir, '.claude/skills/chiltepin'));
const cases = YAML.parse(readFileSync(resolve(casesFlag ?? join(here, 'cases.yaml')), 'utf8'));

// ── Corpus for template echo: every skill file + every CLI block example ────
function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.md') ? [p] : [];
  });
}
const norm = (s) =>
  String(s)
    .toLowerCase()
    .replace(/\\n/g, ' ')
    .replace(/[^a-z0-9$%+.\- ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
let corpus = walk(skillDir).map((p) => readFileSync(p, 'utf8')).join('\n');
const run = (a) => execFileSync('node', [cli, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const types = run(['block'])
  .split('\n')
  .map((l) => /^\s{2,}([a-z0-9]+)\s/.exec(l)?.[1])
  .filter(Boolean);
for (const t of new Set(types)) {
  try {
    corpus += '\n' + run(['block', t]);
  } catch {
    /* an alias or a heading row, not a type */
  }
}
corpus = norm(corpus);

// ── Diagram blocks and their labels ─────────────────────────────────────────
const NON_DIAGRAM = new Set([
  'meta', 'callout', 'prose', 'divider', 'takeaways', 'table', 'spec', 'list', 'faq', 'glossary',
  'code', 'endpoint', 'pullquote', 'bignumber', 'stats', 'checklist', 'audit', 'scqa', 'proscons',
]);
function fences(md) {
  const out = [];
  const re = /^```([a-z0-9]+)[^\n]*\n([\s\S]*?)^```\s*$/gm;
  let m;
  while ((m = re.exec(md)) !== null) out.push({ type: m[1], body: m[2] });
  return out;
}
const LABEL_KEYS = new Set(['label', 'name', 'title', 'desc', 'tech', 'model', 'note', 'text', 'msg']);
function labelsOf(body) {
  const out = [];
  let data;
  try {
    data = YAML.parse(body);
  } catch {
    return out;
  }
  const visit = (v, key, depth) => {
    if (typeof v === 'string') {
      if (key === undefined) {
        // Terse list items: `a -> b: label`, `id: Label`, `Label · lane`.
        const arrow = /^\s*\S+\s*-[-x]*>+\s*\S+\s*:\s*(.+)$/.exec(v);
        if (arrow) out.push(arrow[1]);
        else out.push(...v.split(/\s+·\s+|:\s+/).slice(-1));
      } else if (LABEL_KEYS.has(key) && !(key === 'title' && depth === 1)) out.push(v);
      return;
    }
    if (Array.isArray(v)) v.forEach((x) => visit(x, undefined, depth + 1));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) visit(x, k, depth + 1);
  };
  visit(data, undefined, 0);
  return out;
}

// ── Geometry in the browser ─────────────────────────────────────────────────
const NODE_RE = /^(nodes|states|steps|classes|packages|cases|actors|services)\.\d+$/;
const EDGE_RE = /^(edges|links|transitions|relations|rels|deps)\.\d+$/;
function measure([nodeReSrc, edgeReSrc]) {
  const NODE = new RegExp(nodeReSrc);
  const EDGE = new RegExp(edgeReSrc);
  const STEP = 3;
  const inside = (p, b, pad) => p.x > b.x + pad && p.x < b.x + b.w - pad && p.y > b.y + pad && p.y < b.y + b.h - pad;
  const near = (p, b, pad) => p.x > b.x - pad && p.x < b.x + b.w + pad && p.y > b.y - pad && p.y < b.y + b.h + pad;
  const hit = (a, b, slack) =>
    a.x + slack < b.x + b.w && b.x + slack < a.x + a.w && a.y + slack < b.y + b.h && b.y + slack < a.y + a.h;
  const segX = (p1, p2, p3, p4) => {
    const d = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const d1 = d(p3, p4, p1);
    const d2 = d(p3, p4, p2);
    const d3 = d(p1, p2, p3);
    const d4 = d(p1, p2, p4);
    return d1 * d2 < 0 && d3 * d4 < 0;
  };
  const out = [];
  document.querySelectorAll('.diagram').forEach((frame, di) => {
    const svg = frame.querySelector('svg');
    if (!svg) return;
    const bpOf = (el) => el.getAttribute('data-bp') ?? '';
    const nodes = [...svg.querySelectorAll('[data-bp]')]
      .filter((el) => NODE.test(bpOf(el)) && el.tagName !== 'path')
      .map((el) => {
        // The node's own shape, not its label halo: the largest rect/polygon/path child.
        const shapes = [...el.querySelectorAll('rect,polygon,ellipse,circle,path')];
        let best = el.getBBox();
        let area = 0;
        for (const s of shapes) {
          const b = s.getBBox();
          if (b.width * b.height > area) {
            area = b.width * b.height;
            best = b;
          }
        }
        return { id: bpOf(el), x: best.x, y: best.y, w: best.width, h: best.height };
      })
      .filter((b) => b.w > 4 && b.h > 4);
    const edgeEls = [...svg.querySelectorAll('path[data-bp],line[data-bp],polyline[data-bp]')].filter((el) =>
      EDGE.test(bpOf(el)),
    );
    const edges = edgeEls.map((el) => {
      const len = el.getTotalLength();
      const pts = [];
      for (let t = 0; t <= len; t += STEP) {
        const p = el.getPointAtLength(t);
        pts.push({ x: p.x, y: p.y });
      }
      const end = el.getPointAtLength(len);
      pts.push({ x: end.x, y: end.y });
      const own = (p) => nodes.filter((n) => near(p, n, 14)).map((n) => n.id);
      return { id: bpOf(el), pts, ends: new Set([...own(pts[0]), ...own(pts[pts.length - 1])]) };
    });
    // 1. Edge through a foreign node: 3+ consecutive samples inside it.
    let throughNode = 0;
    const throughList = [];
    for (const e of edges) {
      const foreign = nodes.filter((n) => !e.ends.has(n.id));
      let run = 0;
      let flagged = false;
      for (const p of e.pts) {
        if (foreign.some((n) => inside(p, n, 3))) {
          run++;
          if (run >= 3 && !flagged) {
            flagged = true;
            throughNode++;
            throughList.push(e.id);
          }
        } else run = 0;
      }
    }
    // 2. Shared stretches: two edges within 2px of each other for > 24px,
    //    ignoring the 16px around any node (ports may legitimately converge).
    let overlaps = 0;
    const nearAnyNode = (p) => nodes.some((n) => near(p, n, 16));
    const free = edges.map((e) => e.pts.filter((p) => !nearAnyNode(p)));
    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        let shared = 0;
        for (const p of free[i]) {
          if (free[j].some((q) => Math.abs(p.x - q.x) < 2 && Math.abs(p.y - q.y) < 2)) shared++;
        }
        if (shared * STEP > 24) overlaps++;
      }
    }
    // 3. Crossings between simplified polylines.
    const simple = edges.map((e) => e.pts.filter((_, k) => k % 3 === 0 || k === e.pts.length - 1));
    let crossings = 0;
    for (let i = 0; i < simple.length; i++) {
      for (let j = i + 1; j < simple.length; j++) {
        let c = 0;
        const a = simple[i];
        const b = simple[j];
        for (let s = 0; s + 1 < a.length; s++) {
          for (let t = 0; t + 1 < b.length; t++) if (segX(a[s], a[s + 1], b[t], b[t + 1])) c++;
        }
        crossings += c;
      }
    }
    // 4. Labels: edge-path groups that carry text.
    const labels = [...svg.querySelectorAll('g[data-bp]')]
      .filter((g) => EDGE.test(bpOf(g)) && g.querySelector('text'))
      .map((g) => {
        const b = g.querySelector('text').getBBox();
        return { id: bpOf(g), x: b.x, y: b.y, w: b.width, h: b.height, badge: g.querySelector('circle') !== null };
      });
    let labelOnNode = 0;
    let labelOnLabel = 0;
    for (const l of labels) if (nodes.some((n) => hit(l, n, 2))) labelOnNode++;
    for (let i = 0; i < labels.length; i++)
      for (let j = i + 1; j < labels.length; j++) if (hit(labels[i], labels[j], 1)) labelOnLabel++;
    const legendSteps = frame.querySelectorAll('.edge-steps > *').length;
    out.push({
      index: di + 1,
      tag: (frame.querySelector('.tag, .diagram-tag, [class*="tag"]')?.textContent ?? '').trim().slice(0, 24),
      nodes: nodes.length,
      edges: edges.length,
      throughNode,
      throughList,
      overlaps,
      crossings,
      labels: labels.length,
      labelOnNode,
      labelOnLabel,
      numbered: legendSteps,
    });
  });
  return out;
}

// ── Run ─────────────────────────────────────────────────────────────────────
// ── Corpus text measures ────────────────────────────────────────────────────
/** `##` headings outside code fences, in order. */
function headings(md) {
  const out = [];
  let fence = null;
  for (const line of md.split('\n')) {
    const f = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (f) {
      if (fence === null) fence = f[1][0];
      else if (f[1][0] === fence) fence = null;
      continue;
    }
    if (fence !== null) continue;
    const h = /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (h) out.push(h[1].replace(/\{[^}]*\}\s*$/, '').trim());
  }
  return out;
}
const words = (md) => md.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
const count = (md, re) => (md.match(re) ?? []).length;
// The fit thresholds of `chiltepin check` (W_FIT) and `review` (cli/src/commands/fit.ts).
const STAGE_MAX = 1600;
const SMALL_SCALE = 0.65;
function fitStats() {
  return [...document.querySelectorAll('.diagram-stage')].map((stage) => {
    const svg = stage.querySelector('svg');
    const vb = svg?.viewBox?.baseVal;
    const width = vb && vb.width > 0 ? vb.width : 0;
    const shown = svg?.getBoundingClientRect().width ?? 0;
    return {
      width,
      scrolls: stage.scrollWidth > stage.clientWidth + 1 || width > STAGE_MAX,
      scale: width > 0 && shown > 0 ? shown / width : 1,
    };
  });
}

mkdirSync(join(runDir, 'html'), { recursive: true });
mkdirSync(join(runDir, 'shots'), { recursive: true });
mkdirSync(join(runDir, 'pages'), { recursive: true });
const canReview = (() => {
  try {
    return run(['--help']).includes('review');
  } catch {
    return false;
  }
})();
const browser = await chromium.launch(chrome ? { executablePath: chrome } : {});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1.5 });
const rows = [];
for (const c of cases) {
  const src = join(projectDir, 'docs', `${c.id}.md`);
  if (!existsSync(src)) continue;
  const md = readFileSync(src, 'utf8');
  const html = join(runDir, 'html', `${c.id}.html`);
  try {
    execFileSync('node', [cli, 'html', src, '-o', html, '--force', '--size', 'xl'], { cwd: projectDir, stdio: 'ignore' });
  } catch {
    execFileSync('node', [cli, 'html', src, '-o', html, '--size', 'xl'], { cwd: projectDir, stdio: 'ignore' });
  }
  await page.goto('file://' + html);
  await page.waitForTimeout(150);
  const geo = await page.evaluate(measure, [NODE_RE.source, EDGE_RE.source]);
  const frames = await page.$$('.diagram');
  for (let i = 0; i < frames.length; i++) {
    await frames[i].screenshot({ path: join(runDir, 'shots', `${c.id}-${String(i + 1).padStart(2, '0')}.png`) });
  }
  // Fit at the reader's default width, and the judge's full-page screenshot.
  const plain = join(runDir, 'html', `${c.id}.default.html`);
  execFileSync('node', [cli, 'html', src, '-o', plain, '--force'], { cwd: projectDir, stdio: 'ignore' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('file://' + plain);
  await page.waitForTimeout(100);
  const fits = await page.evaluate(`(${fitStats.toString().replace('STAGE_MAX', String(STAGE_MAX))})()`);
  const misfit = fits.filter((f) => f.scrolls || f.scale < SMALL_SCALE).length;
  await page.screenshot({ path: join(runDir, 'pages', `${c.id}.png`), fullPage: true });
  await page.setViewportSize({ width: 1400, height: 900 });
  // The review an agent runs, when this CLI has it.
  let review = null;
  if (canReview) {
    try {
      execFileSync('node', [cli, 'review', src, '-o', join(runDir, 'review', c.id), '--json'], {
        cwd: projectDir,
        stdio: ['ignore', 'pipe', 'ignore'],
        env: { ...process.env, ...(chrome ? { CHILTEPIN_CHROME: chrome } : {}) },
      });
    } catch {
      /* exit 1 means an error-level issue: the JSON is still written */
    }
    try {
      review = JSON.parse(readFileSync(join(runDir, 'review', c.id, 'review.json'), 'utf8')).summary;
    } catch {
      review = null;
    }
  }
  const heads = headings(md);
  const blocks = fences(md);
  const diagrams = blocks.filter((b) => !NON_DIAGRAM.has(b.type));
  const diagramText = norm(diagrams.map((b) => b.body).join('\n'));
  const docText = norm(md);
  const facts = c.facts ?? [];
  const factHits = facts.map((f) => ({
    fact: f,
    inDiagram: f.split('|').some((alt) => diagramText.includes(norm(alt))),
    inDoc: f.split('|').some((alt) => docText.includes(norm(alt))),
  }));
  const req = norm(c.request);
  const echoes = [
    ...new Set(
      diagrams
        .flatMap((b) => labelsOf(b.body))
        .map(norm)
        .filter((l) => l.length >= 10 && l.split(' ').length >= 2 && corpus.includes(l) && !req.includes(l)),
    ),
  ];
  const sum = (k) => geo.reduce((s, g) => s + g[k], 0);
  rows.push({
    id: c.id,
    diagrams: geo.length,
    diagramTypes: diagrams.map((b) => b.type),
    geometry: geo,
    throughNode: sum('throughNode'),
    overlaps: sum('overlaps'),
    crossings: sum('crossings'),
    labels: sum('labels'),
    labelCollisions: sum('labelOnNode') + sum('labelOnLabel'),
    numbered: sum('numbered'),
    facts: facts.length,
    factsInDiagrams: factHits.filter((f) => f.inDiagram).length,
    factsInDoc: factHits.filter((f) => f.inDoc).length,
    missingFacts: factHits.filter((f) => !f.inDiagram).map((f) => f.fact),
    echoes,
    sequence: blocks.map((b) => b.type),
    leadsWithCallout: blocks.find((b) => b.type !== 'meta')?.type === 'callout',
    headings: heads,
    lastHeading: heads.length > 0 ? heads[heads.length - 1].toLowerCase() : null,
    words: words(md),
    assumed: count(md, /\bassumed\b/gi),
    theRequest: count(md, /\bthe request\b/gi),
    fit: misfit,
    review,
  });
}
await browser.close();

const tot = (k) => rows.reduce((s, r) => s + r[k], 0);
const withFacts = rows.filter((r) => r.facts > 0);
const summary = {
  docs: rows.length,
  diagrams: tot('diagrams'),
  throughNode: tot('throughNode'),
  overlaps: tot('overlaps'),
  crossings: tot('crossings'),
  labels: tot('labels'),
  labelCollisions: tot('labelCollisions'),
  numbered: tot('numbered'),
  factRecall:
    withFacts.length === 0
      ? null
      : withFacts.reduce((s, r) => s + r.factsInDiagrams, 0) / withFacts.reduce((s, r) => s + r.facts, 0),
  echoes: rows.reduce((s, r) => s + r.echoes.length, 0),
  // Skeleton sameness: docs that open with a callout, docs that use `spec`,
  // and the mean pairwise Jaccard similarity of the block-type sets (1 = every
  // doc uses the same blocks).
  leadCallout: rows.filter((r) => r.leadsWithCallout).length,
  specDocs: rows.filter((r) => r.sequence.includes('spec')).length,
  skeletonSimilarity: (() => {
    const sets = rows.map((r) => new Set(r.sequence));
    let sum = 0;
    let n = 0;
    for (let i = 0; i < sets.length; i++)
      for (let j = i + 1; j < sets.length; j++) {
        const inter = [...sets[i]].filter((x) => sets[j].has(x)).length;
        sum += inter / new Set([...sets[i], ...sets[j]]).size;
        n++;
      }
    return n === 0 ? null : Math.round((sum / n) * 100) / 100;
  })(),
  // Sameness: the share of docs that end on the most common last heading.
  // Above 30% the corpus reads as one template: FAIL.
  lastHeading: (() => {
    const tally = new Map();
    for (const r of rows) if (r.lastHeading) tally.set(r.lastHeading, (tally.get(r.lastHeading) ?? 0) + 1);
    const [heading, n] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
    const share = rows.length === 0 ? 0 : Math.round((n / rows.length) * 100) / 100;
    return { heading, docs: n, share, fail: share > 0.3 };
  })(),
  // Voice: the first word of every `##` heading, most common first.
  headingFirstWords: (() => {
    const tally = new Map();
    let all = 0;
    for (const r of rows)
      for (const h of r.headings) {
        const w = (h.split(/\s+/)[0] ?? '').toLowerCase().replace(/[^\p{L}\p{N}-]/gu, '');
        if (!w) continue;
        all++;
        tally.set(w, (tally.get(w) ?? 0) + 1);
      }
    return [...tally.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([word, n]) => ({ word, n, share: Math.round((n / Math.max(all, 1)) * 100) / 100 }));
  })(),
  assumedPer100Words:
    Math.round((rows.reduce((s, r) => s + r.assumed, 0) / Math.max(rows.reduce((s, r) => s + r.words, 0), 1)) * 10000) / 100,
  theRequest: rows.reduce((s, r) => s + r.theRequest, 0),
  theRequestDocs: rows.filter((r) => r.theRequest > 0).length,
  fit: rows.reduce((s, r) => s + r.fit, 0),
  review: canReview
    ? rows.reduce(
        (acc, r) => {
          for (const [k, n] of Object.entries(r.review?.kinds ?? {})) acc[k] = (acc[k] ?? 0) + n;
          acc.errors += r.review?.errors ?? 0;
          return acc;
        },
        { errors: 0 },
      )
    : null,
};
writeFileSync(join(runDir, 'quality.json'), JSON.stringify({ summary, rows }, null, 2) + '\n');

const pad = (s, n) => String(s ?? '-').padEnd(n);
console.log(
  `  ${pad('id', 22)} ${pad('diag', 5)} ${pad('thru', 5)} ${pad('ovl', 4)} ${pad('cross', 6)} ${pad('lbl', 4)} ${pad('coll', 5)} ${pad('numd', 5)} ${pad('facts', 7)} echo`,
);
for (const r of rows) {
  console.log(
    `  ${pad(r.id, 22)} ${pad(r.diagrams, 5)} ${pad(r.throughNode, 5)} ${pad(r.overlaps, 4)} ${pad(r.crossings, 6)} ${pad(r.labels, 4)} ${pad(r.labelCollisions, 5)} ${pad(r.numbered, 5)} ${pad(r.facts ? `${r.factsInDiagrams}/${r.facts}` : '-', 7)} ${r.echoes.length}${r.echoes.length ? ' · ' + r.echoes.slice(0, 3).join(' | ') : ''}`,
  );
}
console.log(
  `\n  ${summary.diagrams} diagrams · through-node ${summary.throughNode} · shared stretches ${summary.overlaps} · crossings ${summary.crossings} · label collisions ${summary.labelCollisions} · labels moved to a numbered legend ${summary.numbered} · fact recall ${summary.factRecall === null ? '-' : Math.round(summary.factRecall * 100) + '%'} · template echoes ${summary.echoes}`,
);
console.log(
  `  skeleton: ${summary.leadCallout}/${summary.docs} open with a callout · ${summary.specDocs}/${summary.docs} use spec · block-set similarity ${summary.skeletonSimilarity}`,
);
const lh = summary.lastHeading;
console.log(
  `  last heading: ${lh.docs}/${summary.docs} end on "${lh.heading ?? '-'}" (${Math.round(lh.share * 100)}%)${lh.fail ? ' · FAIL (above 30%)' : ''}`,
);
console.log(
  `  heading first words: ${summary.headingFirstWords.map((w) => `${w.word} ${Math.round(w.share * 100)}%`).join(' · ') || '-'}`,
);
console.log(
  `  voice: "assumed" ${summary.assumedPer100Words} per 100 words · "the request" ${summary.theRequest} times in ${summary.theRequestDocs}/${summary.docs} docs · fit ${summary.fit} diagrams scroll or shrink`,
);
if (summary.review) {
  console.log(`  review: ${Object.entries(summary.review).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
}
if (lh.fail) process.exitCode = 1;
