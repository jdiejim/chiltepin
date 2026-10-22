/**
 * `chiltepin review`: the JSON shape, the exit code, the images it writes,
 * and the issues it names in data terms — run with real Chromium.
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isChromiumAvailable } from '../io/pdf.js';
import { blockName, formatReview, runReview, type ReviewResult } from '../commands/review.js';
import { fitHint, fitMessage, fitOf, lintFit, misfits, stageWidth } from '../commands/fit.js';
import { parseDocument } from 'chiltepin-core';

const chromium = await isChromiumAvailable();

const BAD = `\`\`\`meta
title: Stress review
\`\`\`

## Request path

\`\`\`block
title: Request path
nodes:
  - { id: gw, col: 1, row: 1, kind: gateway, name: Edge gateway with a very long descriptive name that cannot fit, tech: Envoy }
  - { id: api, col: 2, row: 1, kind: service, name: orders-api, tech: Go }
edges:
  - gw -> api: routes
\`\`\`

See [the flow](#no-such-anchor).
`;

const CLEAN = `\`\`\`meta
title: Clean review
\`\`\`

## Request path

\`\`\`block
title: Request path
nodes:
  - { id: gw, col: 1, row: 1, kind: gateway, name: Edge, tech: Envoy }
  - { id: api, col: 2, row: 1, kind: service, name: orders-api, tech: Go }
edges:
  - gw -> api: routes
\`\`\`

\`\`\`callout
tone: tip
body: ":check: Every hop is labelled."
\`\`\`
`;

describe.skipIf(!chromium)('runReview', () => {
  const root = join(tmpdir(), `chiltepin-review-${randomBytes(6).toString('hex')}`);
  let bad: ReviewResult;
  let clean: ReviewResult;

  beforeAll(async () => {
    await mkdir(join(root, 'docs'), { recursive: true });
    await writeFile(join(root, 'chiltepin.config.json'), '{"docsDir":"docs","outDir":"dist"}');
    await writeFile(join(root, 'docs', 'bad.md'), BAD);
    await writeFile(join(root, 'docs', 'clean.md'), CLEAN);
    bad = await runReview({ cwd: root, input: 'docs/bad.md', output: 'out/bad' });
    clean = await runReview({ cwd: root, input: 'docs/clean.md', output: 'out/clean' });
  }, 90_000);

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('exits 1 on an error-level issue and 0 when every block is clean', () => {
    expect(bad.exitCode).toBe(1);
    expect(clean.exitCode).toBe(0);
    expect(clean.summary.errors).toBe(0);
  });

  it('an inline icon in a callout is a glyph, not a drawing that shrinks', () => {
    expect(clean.issues.filter((x) => x.kind === 'fit')).toEqual([]);
  });

  it('names a silent cut in data terms, with the fix in the YAML', () => {
    const cut = bad.issues.find((x) => x.kind === 'cut');
    expect(cut).toMatchObject({ block: 1, level: 'error', path: 'nodes.0', field: 'name' });
    expect(cut?.message).toMatch(/^node `gw` name "Edge gateway with a very long .*" is cut: the drawing shows \d+ of its 11 words$/);
    expect(cut?.fix).toContain('Shorten `name` on node `gw`');
  });

  it('carries every check diagnostic for the file (a dangling link is an error)', () => {
    const link = bad.issues.find((x) => x.code === 'E_DANGLING_LINK');
    expect(link).toMatchObject({ kind: 'check', level: 'error' });
    expect(link?.block).toBeUndefined();
  });

  it('writes review.json, the contact sheet, and a light and dark PNG per block', async () => {
    const json = JSON.parse(await readFile(bad.json, 'utf8')) as ReviewResult;
    expect(Object.keys(json).sort()).toEqual(
      ['blocks', 'contactSheet', 'dir', 'exitCode', 'file', 'issues', 'json', 'phone', 'summary'].sort(),
    );
    expect(json.summary).toMatchObject({ blocks: 1, errors: bad.summary.errors });
    expect(json.blocks[0]).toMatchObject({ index: 1, type: 'block', line: 7, title: 'Request path', scrolls: false });
    for (const p of [bad.contactSheet, bad.phone, bad.blocks[0]?.shots.light ?? '', bad.blocks[0]?.shots.dark ?? '']) {
      expect(existsSync(p), p).toBe(true);
    }
  });

  it('prints one line per issue: level, kind, block, what, and the fix', () => {
    const text = formatReview(bad);
    const lines = text.split('\n').filter((l) => /^(error|warn)/.test(l));
    expect(lines).toHaveLength(bad.issues.length);
    expect(lines.find((l) => l.includes(' cut '))).toMatch(/^error {2}cut +block 1 · .*Request path — node `gw` name .* Fix: Shorten `name`/);
    expect(text).toContain(`contact sheet  ${bad.contactSheet}`);
  });
});

describe('blockName', () => {
  it('reads block, figure, tag, and title', () => {
    expect(blockName({ index: 3, fig: 'Fig. 3', tag: 'FLOW', label: 'Flowchart', title: 'Request path' })).toBe(
      'block 3 · Fig. 3 · FLOW · Request path',
    );
    expect(blockName({ index: 1, label: 'table' })).toBe('block 1 · table');
  });
});

describe('fit (W_FIT, shared by check, shots, and review)', () => {
  it('scrolls past the 1600 stage and shrinks below 0.65 of the column', () => {
    expect(fitOf(2264)).toMatchObject({ scrolls: true, scale: 1 });
    expect(misfits(fitOf(1574))).toBe(true);
    expect(misfits(fitOf(1454))).toBe(false);
    expect(misfits(fitOf(900))).toBe(false);
    expect(fitMessage(fitOf(1574))).toBe('the drawing is 1574 px wide and shrinks to 65% in the page column, so its labels read small');
  });

  it('gives each block type its own data fix', () => {
    expect(fitHint('flow')).toContain('split the flow at a decision');
    expect(fitHint('sequence')).toContain('`alt` frame');
    expect(fitHint('swimlane')).toContain('handoff');
    expect(fitHint('erd')).toContain('aggregate');
  });

  it('reads the staged drawing width from the rendered block', () => {
    expect(stageWidth('<div class="diagram-stage"><svg viewBox="0 0 1812 300" style="x">')).toBe(1812);
    expect(stageWidth('<table></table>')).toBeUndefined();
  });

  it('warns on a flow that scrolls, with no browser', () => {
    const nodes = Array.from({ length: 14 }, (_, i) => `  - { id: n${String(i)}, col: ${String(i + 1)}, row: 1, label: Step number ${String(i)} }`).join('\n');
    const edges = Array.from({ length: 13 }, (_, i) => `  - n${String(i)} -> n${String(i + 1)}`).join('\n');
    const doc = parseDocument('```flow\nnodes:\n' + nodes + '\nedges:\n' + edges + '\n```\n', 't');
    const [d] = lintFit(doc, 't.md', []);
    expect(d).toMatchObject({ code: 'W_FIT', level: 'warn', line: 1 });
    expect(d?.message).toMatch(/^flow: the drawing is \d+ px wide and scrolls sideways/);
  });
});
