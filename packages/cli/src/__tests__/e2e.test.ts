import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

const BIN = resolve(import.meta.dirname, '../../dist/bin.js');
const RESOURCES = resolve(import.meta.dirname, '../../../../resources');

function runBin(
  args: readonly string[],
  cwd: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((res, rej) => {
    // Strip runner color hints (GitHub Actions sets CI=true, which flips
    // picocolors on even for piped output) so assertions are deterministic —
    // the binary's own plain-guard is what we're testing.
    const env: NodeJS.ProcessEnv = { ...process.env, CHILTEPIN_PLAIN: '1' };
    delete env['CI'];
    delete env['FORCE_COLOR'];
    const child = spawn('node', [BIN, ...args], { cwd, env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (b: Buffer) => (stdout += b.toString('utf8')));
    child.stderr.on('data', (b: Buffer) => (stderr += b.toString('utf8')));
    child.on('error', rej);
    child.on('close', (code) => res({ code: code ?? -1, stdout, stderr }));
  });
}

const skipIfNotBuilt = !existsSync(BIN);
if (skipIfNotBuilt) {
  console.warn(`[skip] CLI e2e — built bin not found at ${BIN}. Run: pnpm build`);
}

describe.skipIf(skipIfNotBuilt)('chiltepin CLI (built bin)', () => {
  it('chiltepin check resources/chiltepin-roadmap.md exits 0', async () => {
    const repoRoot = resolve(import.meta.dirname, '../../../..');
    const { code } = await runBin(['check', 'resources/chiltepin-roadmap.md'], repoRoot);
    expect(code).toBe(0);
  }, 30_000);

  it('chiltepin check resources/orders-api.md exits 0', async () => {
    const repoRoot = resolve(import.meta.dirname, '../../../..');
    const { code } = await runBin(['check', 'resources/orders-api.md'], repoRoot);
    expect(code).toBe(0);
  }, 30_000);

  it('chiltepin check on a broken doc exits 1 and names file + line + value', async () => {
    const tmp = join(tmpdir(), `chiltepin-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    const file = join(tmp, 'bad.md');
    writeFileSync(
      file,
      '```userstory\nrole: u\nwant: w\nsoThat: t\nlinks:\n  - { ref: "#missing", label: x }\n```\n',
    );
    try {
      const { code, stdout } = await runBin(['check', 'bad.md'], tmp);
      expect(code).toBe(1);
      expect(stdout).toContain('bad.md');
      expect(stdout).toContain('E_DANGLING_REF');
      expect(stdout).toContain('#missing');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('chiltepin check warns on a filler opener but exits 0', async () => {
    const tmp = join(tmpdir(), `chiltepin-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    writeFileSync(
      join(tmp, 'prose.md'),
      '```meta\ntitle: Prose\n```\n\nIn this section we look at the parser.\n',
    );
    try {
      const { code, stdout } = await runBin(['check', 'prose.md'], tmp);
      expect(code).toBe(0);
      expect(stdout).toContain('W_PROSE_FILLER_OPENER');
      expect(stdout).toContain('warn');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('chiltepin check --strict-prose exits 1 and the output quotes the span', async () => {
    const tmp = join(tmpdir(), `chiltepin-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    writeFileSync(
      join(tmp, 'prose.md'),
      '```meta\ntitle: Prose\n```\n\nIn this section we look at the parser.\n',
    );
    try {
      const { code, stdout } = await runBin(['check', 'prose.md', '--strict-prose'], tmp);
      expect(code).toBe(1);
      expect(stdout).toContain('W_PROSE_FILLER_OPENER');
      expect(stdout).toContain('error');
      // The code frame quotes the offending line.
      expect(stdout).toContain('In this section we look at the parser.');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('chiltepin check --json emits valid JSON', async () => {
    const tmp = join(tmpdir(), `chiltepin-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    writeFileSync(join(tmp, 'ok.md'), '```meta\ntitle: OK\n```\n');
    try {
      const { code, stdout } = await runBin(['check', 'ok.md', '--json'], tmp);
      expect(code).toBe(0);
      const parsed = JSON.parse(stdout) as { diagnostics: unknown[]; files: string[] };
      expect(parsed.diagnostics).toEqual([]);
      expect(parsed.files).toContain('ok.md');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('chiltepin build writes index.html + one page and one deck per doc (nested dirs kept)', async () => {
    const tmp = join(tmpdir(), `chiltepin-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(join(tmp, 'docs', 'guides'), { recursive: true });
    writeFileSync(join(tmp, 'docs', 'a.md'), '```meta\ntitle: Doc A\ntag: GUIDE\n```\n');
    writeFileSync(join(tmp, 'docs', 'guides', 'b.md'), '```meta\ntitle: Doc B\n```\n');
    try {
      const { code, stdout } = await runBin(['build'], tmp);
      expect(code).toBe(0);
      // Decks are reported separately — "page(s)" stays index + one per doc.
      expect(stdout).toContain('3 page(s) + 2 deck(s)');
      expect(existsSync(join(tmp, 'dist', 'index.html'))).toBe(true);
      expect(existsSync(join(tmp, 'dist', 'a.html'))).toBe(true);
      expect(existsSync(join(tmp, 'dist', 'a.slides.html'))).toBe(true);
      expect(existsSync(join(tmp, 'dist', 'guides', 'b.html'))).toBe(true);
      expect(existsSync(join(tmp, 'dist', 'guides', 'b.slides.html'))).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('chiltepin build (rich index by default) writes a grouped index with a TLDR and a cross-reference graph', async () => {
    const tmp = join(tmpdir(), `chiltepin-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(join(tmp, 'docs'), { recursive: true });
    writeFileSync(
      join(tmp, 'docs', 'a.md'),
      '```meta\ntitle: Doc A\nsubtitle: First guide\ntag: GUIDE\n```\n\n' +
        '```sequence\nid: seq-a\ntitle: A flow\nactors:\n  - { id: C, name: Client }\n' +
        '  - { id: S, name: Server }\nmessages:\n  - { from: C, to: S, label: GET /a, kind: sync }\n```\n',
    );
    writeFileSync(join(tmp, 'docs', 'b.md'), '```meta\ntitle: Doc B\ntag: guide\n```\n');
    writeFileSync(
      join(tmp, 'docs', 'c.md'),
      '```meta\ntitle: Doc C\ntag: API\n```\n\n' +
        '```userstory\nrole: dev\nwant: a link\nsoThat: readers jump\nlinks:\n' +
        '  - { ref: "a#seq-a", label: Flow }\n```\n',
    );
    try {
      const { code } = await runBin(['build'], tmp);
      expect(code).toBe(0);
      const index = readFileSync(join(tmp, 'dist', 'index.html'), 'utf8');
      // TLDR digest line: group label + count (no subtitle on multi-doc groups).
      expect(index).toContain('<strong>GUIDE</strong> · 2 documents</a>');
      expect(index).toContain('<strong>API</strong> · 1 document');
      // The two group headings.
      expect(index).toContain('GUIDE<span class="idx-group-count">2</span>');
      expect(index).toContain('API<span class="idx-group-count">1</span>');
      // The cross-reference graph renders as SVG.
      expect(index).toContain('class="idx-graph"');
      expect(index).toContain('<svg');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('chiltepin build on all-singleton tags falls back to the flat card grid by default', async () => {
    const tmp = join(tmpdir(), `chiltepin-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(join(tmp, 'docs'), { recursive: true });
    writeFileSync(join(tmp, 'docs', 'a.md'), '```meta\ntitle: Doc A\ntag: GUIDE\n```\n');
    writeFileSync(join(tmp, 'docs', 'b.md'), '```meta\ntitle: Doc B\ntag: API\n```\n');
    try {
      const { code } = await runBin(['build'], tmp);
      expect(code).toBe(0);
      const index = readFileSync(join(tmp, 'dist', 'index.html'), 'utf8');
      // Every group is a singleton — grouping would restate the grid, so the
      // rich index degrades to the flat card grid: no digest, no group
      // headers, and (with no cross-refs here) no graph section either.
      expect(index).toContain('<div class="idx-grid">');
      expect(index).toContain('class="idx-card" href="a.html"');
      expect(index).not.toContain('class="idx-tldr"');
      expect(index).not.toContain('class="idx-group"');
      expect(index).not.toContain('class="idx-graph"');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('chiltepin build --no-rich-index keeps the plain index (no rich styles at all)', async () => {
    const tmp = join(tmpdir(), `chiltepin-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(join(tmp, 'docs'), { recursive: true });
    writeFileSync(join(tmp, 'docs', 'a.md'), '```meta\ntitle: Doc A\ntag: GUIDE\n```\n');
    try {
      const { code } = await runBin(['build', '--no-rich-index'], tmp);
      expect(code).toBe(0);
      const index = readFileSync(join(tmp, 'dist', 'index.html'), 'utf8');
      // Not even the rich stylesheet: the plain page stays byte-identical to
      // the pre-rich-index output.
      expect(index).not.toContain('idx-tldr');
      expect(index).not.toContain('idx-group');
      expect(index).not.toContain('idx-graph');
      expect(index).toContain('class="idx-card" href="a.html"');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('chiltepin build honors richIndex: false in chiltepin.config.json', async () => {
    const tmp = join(tmpdir(), `chiltepin-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(join(tmp, 'docs'), { recursive: true });
    writeFileSync(join(tmp, 'chiltepin.config.json'), JSON.stringify({ richIndex: false }));
    writeFileSync(join(tmp, 'docs', 'a.md'), '```meta\ntitle: Doc A\ntag: GUIDE\n```\n');
    try {
      const { code } = await runBin(['build'], tmp);
      expect(code).toBe(0);
      const index = readFileSync(join(tmp, 'dist', 'index.html'), 'utf8');
      expect(index).not.toContain('idx-tldr');
      expect(index).not.toContain('idx-group');
      expect(index).not.toContain('idx-graph');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('chiltepin build --out overrides the output dir and warns (exit 0) on diagnostics', async () => {
    const tmp = join(tmpdir(), `chiltepin-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(join(tmp, 'docs'), { recursive: true });
    // Dangling ref → a warning at build time, not a failure.
    writeFileSync(
      join(tmp, 'docs', 'a.md'),
      '```userstory\nrole: u\nwant: w\nsoThat: t\nlinks:\n  - { ref: "#missing", label: x }\n```\n',
    );
    try {
      const { code, stderr } = await runBin(['build', '--out', 'site'], tmp);
      expect(code).toBe(0);
      expect(stderr).toContain('E_DANGLING_REF');
      expect(existsSync(join(tmp, 'site', 'index.html'))).toBe(true);
      expect(existsSync(join(tmp, 'site', 'a.html'))).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('chiltepin html writes a non-empty HTML file', async () => {
    const tmp = join(tmpdir(), `chiltepin-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    const out = join(tmp, 'out.html');
    try {
      const { code } = await runBin(
        ['html', join(RESOURCES, 'chiltepin-roadmap.md'), '-o', out],
        tmp,
      );
      expect(code).toBe(0);
      expect(existsSync(out)).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('-v, -V, and --version all print the real version (never the 0.0.0 fallback)', async () => {
    for (const flag of ['-v', '-V', '--version']) {
      const r = await runBin([flag], process.cwd());
      expect(r.code).toBe(0);
      expect(r.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
      expect(r.stdout.trim()).not.toBe('0.0.0');
    }
  });

  it('the old adapter aliases are gone — `chiltepin claude` is an unknown command', async () => {
    const repoRoot = resolve(import.meta.dirname, '../../../..');
    for (const alias of ['claude', 'cursor', 'copilot', 'github', 'windsurf', 'mcp']) {
      const { code, stderr } = await runBin([alias], repoRoot);
      expect(code, `chiltepin ${alias} must fail`).not.toBe(0);
      expect(stderr).toContain('unknown command');
    }
  }, 30_000);

  it('chiltepin prompt is gone — unknown command, non-zero exit', async () => {
    const repoRoot = resolve(import.meta.dirname, '../../../..');
    const { code, stderr } = await runBin(['prompt'], repoRoot);
    expect(code).not.toBe(0);
    expect(stderr).toContain('unknown command');
  }, 30_000);

  it('chiltepin --help pipes clean: no ANSI escapes, banner line + grouped epilogue', async () => {
    const repoRoot = resolve(import.meta.dirname, '../../../..');
    const { code, stdout } = await runBin(['--help'], repoRoot);
    expect(code).toBe(0);
    // Piped (non-TTY) output must carry no ANSI escape sequences at all.
    // eslint-disable-next-line no-control-regex
    expect(stdout).not.toMatch(/\u001b\[/);
    expect(stdout).toContain('chiltepin v'); // the plain one-line banner
    // The four-group command epilogue.
    for (const header of ['WORK', 'OUTPUT', 'REFERENCE', 'SETUP']) {
      expect(stdout).toContain(header);
    }
    // review, shots, and audit sit in the groups like every other command.
    expect(stdout).toMatch(/WORK +init · new · check · review · studio/);
    expect(stdout).toMatch(/OUTPUT +html · slides · pdf · shots · build/);
    expect(stdout).toMatch(/SETUP +sync · audit/);
    expect(stdout).toContain('npx skills add jdiejim/chiltepin');
    expect(stdout).toContain('chiltepin <file.md>');
    expect(stdout).toMatch(/^ {2}block /m);
    expect(stdout).toMatch(/^ {2}demo /m);
    // Hidden or removed commands stay out of the command listing.
    for (const hidden of [
      'preview',
      'serve',
      'skill',
      'catalog',
      'design',
      'tour',
      'explore',
      'install',
      'template',
      'compare',
      'pptx',
    ]) {
      expect(stdout, `${hidden} must be hidden from top-level help`).not.toMatch(
        new RegExp(`^  ${hidden} `, 'm'),
      );
    }
    // serve stepped back behind studio: absent from the grouped epilogue too
    // (\b keeps words like "server" out of the assertion).
    expect(stdout).not.toMatch(/\bserve\b/);
  }, 30_000);

  it('bare chiltepin (non-TTY) prints help — in a project dir and outside one', async () => {
    const repoRoot = resolve(import.meta.dirname, '../../../..');
    const tmp = join(tmpdir(), `chiltepin-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    try {
      for (const cwd of [repoRoot, tmp]) {
        const { code, stdout } = await runBin([], cwd);
        expect(code).toBe(0);
        expect(stdout).toContain('Usage: chiltepin');
        expect(stdout).toContain('REFERENCE');
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('chiltepin <file.md> shortcut renders the doc (script-safe: writes, does not open)', async () => {
    const tmp = join(tmpdir(), `chiltepin-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(join(tmp, 'docs'), { recursive: true });
    writeFileSync(join(tmp, 'docs', 'hello.md'), '```meta\ntitle: Hello\n```\n');
    try {
      const { code, stdout } = await runBin(['docs/hello.md'], tmp);
      expect(code).toBe(0);
      const m = /Wrote (\S+\.html)/.exec(stdout);
      expect(m, 'should report the rendered file').not.toBeNull();
      expect(existsSync((m as RegExpExecArray)[1] as string)).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('chiltepin new resolves doc templates, block types, and alias spellings', async () => {
    const tmp = join(tmpdir(), `chiltepin-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    try {
      const adr = await runBin(['new', 'adr'], tmp);
      expect(adr.code).toBe(0);
      // Templates are finished example docs, not forms — an ADR arrives with a
      // real decision in it, and the author edits rather than fills in.
      expect(adr.stdout).toContain('```meta');
      expect(adr.stdout).toContain('## Consequences');
      expect(adr.stdout).not.toMatch(/TODO|ADR-NNN|YYYY-MM-DD/);

      const seq = await runBin(['new', 'sequence'], tmp);
      expect(seq.code).toBe(0);
      expect(seq.stdout).toContain('```sequence');

      // alias → canonical template + a one-line note (stderr keeps stdout clean)
      const waterfall = await runBin(['new', 'waterfall'], tmp);
      expect(waterfall.code).toBe(0);
      expect(waterfall.stdout).toContain('```chart');
      expect(waterfall.stderr).toContain('now lives in `chart`');

      // bare + non-TTY lists both sections
      const list = await runBin(['new'], tmp);
      expect(list.code).toBe(0);
      expect(list.stdout).toContain('Doc templates:');
      // Every template name keeps a gap before its description, long names too.
      const rows = list.stdout.split('Blocks:')[0]?.split('\n').filter((l) => /^ {2}\S/.test(l)) ?? [];
      expect(rows.length).toBeGreaterThan(5);
      for (const row of rows) expect(row, row).toMatch(/^ {2}[a-z0-9-]+ {2,}\S/);
      expect(list.stdout).toContain('Blocks:');

      // -o writes a file
      const out = await runBin(['new', 'adr', '-o', 'docs/decisions/001.md'], tmp);
      expect(out.code).toBe(0);
      expect(existsSync(join(tmp, 'docs/decisions/001.md'))).toBe(true);

      // unknown names fail with a pointer to the picker
      const nope = await runBin(['new', 'nope'], tmp);
      expect(nope.code).toBe(2);
      expect(nope.stderr).toContain('Unknown template or block');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('removed commands are unknown: explore / install / tour / design / catalog / compare / pptx', async () => {
    const tmp = join(tmpdir(), `chiltepin-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    try {
      for (const cmd of [
        'explore',
        'install',
        'tour',
        'design',
        'catalog',
        'compare',
        'template',
      ]) {
        const { code, stderr } = await runBin([cmd], tmp);
        expect(code, `chiltepin ${cmd} must fail`).not.toBe(0);
        expect(stderr).toContain('unknown command');
      }
      const pptx = await runBin(['pptx', 'x.md'], tmp);
      expect(pptx.code).not.toBe(0);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('chiltepin block lists every type by family; chiltepin block <type> prints the contract + example', async () => {
    const tmp = join(tmpdir(), `chiltepin-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    try {
      const index = await runBin(['block'], tmp);
      expect(index.code).toBe(0);
      expect(index.stdout).toMatch(/^\d+ block types/);
      expect(index.stdout).toContain('Flows & state');
      expect(index.stdout).toContain('  sequence');

      const seq = await runBin(['block', 'sequence'], tmp);
      expect(seq.code).toBe(0);
      expect(seq.stdout).toContain('sequence — ');
      expect(seq.stdout).toContain('messages[]');
      expect(seq.stdout).toContain('```sequence');
      expect(seq.stdout).toContain('`from -> to: label`');

      // An alias resolves, with the note on stderr so stdout stays clean.
      const alias = await runBin(['block', 'waterfall'], tmp);
      expect(alias.code).toBe(0);
      expect(alias.stdout).toContain('chart — ');
      expect(alias.stderr).toContain('old spelling');

      const json = await runBin(['block', 'erd', '--json'], tmp);
      expect(json.code).toBe(0);
      const parsed = JSON.parse(json.stdout) as { type: string; fields: string[]; example: string };
      expect(parsed.type).toBe('erd');
      expect(parsed.fields.length).toBeGreaterThan(3);

      const nope = await runBin(['block', 'nope'], tmp);
      expect(nope.code).toBe(2);
      expect(nope.stderr).toContain('Unknown block');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('chiltepin demo -o writes the showcase; chiltepin skill prints the stitched skill', async () => {
    const tmp = join(tmpdir(), `chiltepin-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    try {
      const demo = await runBin(['demo', '-o', 'demo.html'], tmp);
      expect(demo.code).toBe(0);
      expect(existsSync(join(tmp, 'demo.html'))).toBe(true);
      const skill = await runBin(['skill'], tmp);
      expect(skill.code).toBe(0);
      expect(skill.stdout).toContain('Chiltepin');
      expect(skill.stdout).toContain('chiltepin block');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('chiltepin init writes three files and points at the skills install', async () => {
    const tmp = join(tmpdir(), `chiltepin-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    try {
      const { code, stdout } = await runBin(['init', '-y'], tmp);
      expect(code).toBe(0);
      expect(stdout).toContain('Created 3 file(s)');
      expect(stdout).toContain('npx skills add jdiejim/chiltepin');
      expect(existsSync(join(tmp, 'chiltepin.config.json'))).toBe(true);
      expect(existsSync(join(tmp, 'docs/getting-started.md'))).toBe(true);
      expect(existsSync(join(tmp, '.chiltepin'))).toBe(false);
      expect(existsSync(join(tmp, '.claude'))).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('colorScheme in the config stamps every built page; the default is dark with no stamp', async () => {
    const tmp = join(tmpdir(), `chiltepin-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(join(tmp, 'docs'), { recursive: true });
    writeFileSync(join(tmp, 'docs', 'a.md'), '```meta\ntitle: A\n```\n\nHello.\n');
    try {
      writeFileSync(join(tmp, 'chiltepin.config.json'), '{ "docsDir": "docs", "outDir": "dist" }');
      expect((await runBin(['build'], tmp)).code).toBe(0);
      const dark = readFileSync(join(tmp, 'dist', 'a.html'), 'utf8');
      expect(dark).not.toMatch(/<html[^>]*data-theme/);
      // The skin is written once and linked from every page.
      expect(dark).toContain('<link rel="stylesheet" href="assets/chiltepin.css">');
      expect(readFileSync(join(tmp, 'dist', 'assets', 'chiltepin.css'), 'utf8')).toContain('color-scheme:dark');
      writeFileSync(join(tmp, 'chiltepin.config.json'), '{ "docsDir": "docs", "outDir": "dist", "colorScheme": "light" }');
      expect((await runBin(['build'], tmp)).code).toBe(0);
      const light = readFileSync(join(tmp, 'dist', 'a.html'), 'utf8');
      expect(light).toContain('<html lang="en" data-theme="light">');
      const deck = readFileSync(join(tmp, 'dist', 'a.slides.html'), 'utf8');
      expect(deck).toContain('data-theme="light"');
      expect((await runBin(['html', 'docs/a.md', '-o', 'one.html'], tmp)).code).toBe(0);
      expect(readFileSync(join(tmp, 'one.html'), 'utf8')).toContain('data-theme="light"');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('chiltepin build prints an error-level finding as "error", and still builds', async () => {
    const tmp = join(tmpdir(), `chiltepin-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(join(tmp, 'docs'), { recursive: true });
    writeFileSync(join(tmp, 'chiltepin.config.json'), '{ "docsDir": "docs", "outDir": "dist" }');
    writeFileSync(join(tmp, 'docs', 'a.md'), '```meta\ntitle: A\n```\n\nSee [gone](#nowhere).\n');
    try {
      const { code, stderr } = await runBin(['build'], tmp);
      expect(code).toBe(0);
      expect(stderr).toMatch(/^error {2}docs\/a\.md:5 {2}E_DANGLING_LINK/m);
      expect(stderr).not.toMatch(/^warn .*E_DANGLING_LINK/m);
      expect(stderr).toContain('1 error(s)');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('chiltepin sync csv prints a ready-to-paste block fence with the suggestion reason on stderr', async () => {
    const tmp = join(tmpdir(), `chiltepin-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    writeFileSync(join(tmp, 'team.csv'), 'name,role,team\nAda,eng,core\nGrace,pm,growth\n');
    try {
      const { code, stdout, stderr } = await runBin(['sync', 'csv', 'team.csv'], tmp);
      expect(code).toBe(0);
      expect(stdout).toContain('```table');
      expect(stdout).toContain('columns: [name, role, team]');
      expect(stdout).toContain('[Ada, eng, core]');
      // The auto-pick reason rides stderr so piped stdout stays a clean fence.
      expect(stderr).toContain('table');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('chiltepin sync csv --out writes a minimal doc that passes chiltepin check', async () => {
    const tmp = join(tmpdir(), `chiltepin-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    writeFileSync(join(tmp, 'sales.csv'), 'month,units\nJan,4\nFeb,7\n');
    try {
      const out = await runBin(
        ['sync', 'csv', 'sales.csv', '--out', 'docs/sales.md', '--title', 'Sales'],
        tmp,
      );
      expect(out.code).toBe(0);
      expect(out.stdout).toContain('Wrote');
      expect(out.stdout).toContain('chiltepin check: clean');
      expect(existsSync(join(tmp, 'docs/sales.md'))).toBe(true);
      const check = await runBin(['check', 'docs/sales.md'], tmp);
      expect(check.code).toBe(0);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('chiltepin sync csv auto-detects a status column and emits a statustable', async () => {
    const tmp = join(tmpdir(), `chiltepin-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    writeFileSync(join(tmp, 'tasks.csv'), 'task,status\nShip it,done\nPlan next,todo\n');
    try {
      const { code, stdout, stderr } = await runBin(['sync', 'csv', 'tasks.csv'], tmp);
      expect(code).toBe(0);
      expect(stdout).toContain('```statustable');
      expect(stdout).toContain('status: done');
      expect(stderr).toContain('statustable');
      expect(stderr).toContain('status column');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('chiltepin sync csv exits 1 on a broken CSV (unterminated quote)', async () => {
    const tmp = join(tmpdir(), `chiltepin-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    writeFileSync(join(tmp, 'broken.csv'), 'a,b\n"unclosed,1\n');
    try {
      const { code, stderr } = await runBin(['sync', 'csv', 'broken.csv'], tmp);
      expect(code).toBe(1);
      expect(stderr).toContain('unterminated');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('chiltepin sync csv --delimiter overrides auto-detection', async () => {
    const tmp = join(tmpdir(), `chiltepin-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    // Auto-detect would pick ',' (2 commas vs 1 semicolon on line 1).
    writeFileSync(join(tmp, 'semi.csv'), 'a,b;c,d\n1,2;3,4\n');
    try {
      const forced = await runBin(
        ['sync', 'csv', 'semi.csv', '--delimiter', ';', '--block', 'table'],
        tmp,
      );
      expect(forced.code).toBe(0);
      expect(forced.stdout).toContain('"a,b"'); // one field, not two
      const bad = await runBin(['sync', 'csv', 'semi.csv', '--delimiter', '|'], tmp);
      expect(bad.code).toBe(2);
      expect(bad.stderr).toContain('unknown delimiter');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('chiltepin sync sql --out refuses to overwrite a hand-written doc (W-4)', async () => {
    const tmp = join(tmpdir(), `chiltepin-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(join(tmp, 'docs'), { recursive: true });
    writeFileSync(join(tmp, 'schema.sql'), 'CREATE TABLE users (id uuid PRIMARY KEY);\n');
    const precious = '# PRECIOUS\n\nHand-written content that must not vanish.\n';
    writeFileSync(join(tmp, 'docs/precious.md'), precious);
    try {
      const refused = await runBin(['sync', 'sql', 'schema.sql', '--out', 'docs/precious.md'], tmp);
      expect(refused.code).toBe(1);
      expect(refused.stderr).toContain('docs/precious.md');
      expect(refused.stderr).toContain('--force');
      expect(readFileSync(join(tmp, 'docs/precious.md'), 'utf8')).toBe(precious);

      const forced = await runBin(
        ['sync', 'sql', 'schema.sql', '--out', 'docs/precious.md', '--force'],
        tmp,
      );
      expect(forced.code).toBe(0);
      expect(readFileSync(join(tmp, 'docs/precious.md'), 'utf8')).toContain('```erd');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('chiltepin build prunes the pages of a deleted doc, keeping user files (W-5)', async () => {
    const tmp = join(tmpdir(), `chiltepin-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(join(tmp, 'docs'), { recursive: true });
    writeFileSync(join(tmp, 'docs', 'keep.md'), '```meta\ntitle: Keep\n```\n');
    writeFileSync(join(tmp, 'docs', 'goner.md'), '```meta\ntitle: Goner\n```\n');
    try {
      expect((await runBin(['build'], tmp)).code).toBe(0);
      writeFileSync(join(tmp, 'dist', 'CNAME'), 'docs.example.com\n');
      rmSync(join(tmp, 'docs', 'goner.md'));

      const second = await runBin(['build'], tmp);
      expect(second.code).toBe(0);
      expect(second.stdout).toContain('2 stale file(s) removed');
      expect(existsSync(join(tmp, 'dist', 'goner.html'))).toBe(false);
      expect(existsSync(join(tmp, 'dist', 'goner.slides.html'))).toBe(false);
      expect(existsSync(join(tmp, 'dist', 'keep.html'))).toBe(true);
      expect(existsSync(join(tmp, 'dist', 'CNAME'))).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('chiltepin check reports a non-UTF-8 file instead of calling it clean (B-2)', async () => {
    const tmp = join(tmpdir(), `chiltepin-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(join(tmp, 'docs'), { recursive: true });
    writeFileSync(join(tmp, 'docs', 'ok.md'), '```meta\ntitle: OK\n```\n');
    writeFileSync(
      join(tmp, 'docs', 'badbytes.md'),
      Buffer.concat([Buffer.from('# Bad\n\n'), Buffer.from([0xff, 0x80, 0xfe, 0x0a])]),
    );
    try {
      const { code, stdout } = await runBin(['check'], tmp);
      expect(code).toBe(1);
      expect(stdout).toContain('E_ENCODING');
      expect(stdout).toContain('badbytes.md');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('chiltepin build names the document and block behind a renderer crash (B-3)', async () => {
    const tmp = join(tmpdir(), `chiltepin-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(join(tmp, 'docs'), { recursive: true });
    writeFileSync(join(tmp, 'docs', 'ok.md'), '```meta\ntitle: Fine\n```\n');
    writeFileSync(
      join(tmp, 'docs', 'boom.md'),
      '```meta\ntitle: Boom\n```\n\n```saga\nsteps:\n  - { id: a, name: A }\n```\n',
    );
    try {
      const { code, stderr } = await runBin(['build'], tmp);
      expect(code).toBe(1);
      expect(stderr).toContain('E_RENDER');
      expect(stderr).toContain('docs/boom.md');
      expect(stderr).toContain('saga');
      // The rest of the build still ran.
      expect(existsSync(join(tmp, 'dist', 'ok.html'))).toBe(true);
      expect(existsSync(join(tmp, 'dist', 'index.html'))).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);
});
