/**
 * The CLI's brand marks — a compact one-line banner for `chiltepin` / `chiltepin --help`
 * — plus the per-command action banners and the grouped help epilogue.
 *
 * Both respect non-TTY stdout and `CHILTEPIN_PLAIN=1`: piped output gets one
 * plain, uncolored line (no ANSI escapes, no cfonts art).
 */

import pc from 'picocolors';
import cfonts from 'cfonts'; // CJS module — default import, then `.render`

const TAGLINE = 'Documentation-as-code — Markdown with typed, fenced YAML blocks.';

/** Chile red — the ripe→dried gradient the per-command action
 *  banners (studio, check, …) render in. Same accent as the render skin. */
const BRAND_GRADIENT = ['#e4744c', '#b04a25'];

/** True when output must stay plain: piped/redirected stdout or CHILTEPIN_PLAIN=1. */
const plainOutput = (): boolean =>
  process.stdout.isTTY !== true || process.env['CHILTEPIN_PLAIN'] === '1';

/** The one-line plain (uncolored) banner used whenever ANSI isn't welcome. */
const plainLine = (version: string): string => `chiltepin v${version} — ${TAGLINE}`;

/**
 * A fun per-command header: the action word rendered big in chile red via
 * cfonts (e.g. "slides", "preview", "check").
 */
export function actionBanner(word: string): string {
  try {
    const out = cfonts.render(word, {
      font: 'tiny',
      gradient: BRAND_GRADIENT,
      transitionGradient: true,
      space: false,
      env: 'node',
    });
    if (out !== false && typeof out === 'object' && out.string !== undefined) {
      return `\n${out.string}\n`;
    }
  } catch {
    /* fall back to a plain bold word */
  }
  return `\n  ${pc.red(pc.bold(word))}\n`;
}

const FUN_LINES: Readonly<Record<string, string>> = {
  html: 'Roasting your doc into HTML…',
  slides: 'Slicing the pepper into slides…',
  pdf: 'Drying one PDF in the sun…',
  preview: 'Tasting the preview…',
  check: 'Checking the crop for bad pods…',
  new: 'Planting a fresh doc…',
  demo: 'Serving up the chiltepin demo…',
  build: 'Grinding the whole harvest into a site…',
  serve: 'Serving fresh docs — reloads on save…',
  studio: 'Opening the studio — the harvest goes visual…',
};

/** A fun, action-themed chile status line. */
export function funLine(action: string): string {
  return pc.dim(`  ${FUN_LINES[action] ?? `${action}…`}`);
}

/**
 * The compact banner shown on `chiltepin` / `chiltepin --help`: a single line — red
 * chile glyph, bold wordmark, dim version + tagline. Plain and uncolored
 * when stdout isn't a TTY or `CHILTEPIN_PLAIN=1`.
 */
export function banner(version = '0.0.2'): string {
  if (plainOutput()) return `\n${plainLine(version)}\n`;
  const glyph = pc.red('●');
  const name = pc.bold(pc.red('chiltepin'));
  return `\n  ${glyph} ${name} ${pc.dim(`v${version} — ${TAGLINE}`)}\n`;
}

/** The command groups shown after top-level help, in display order. */
const HELP_GROUPS: ReadonlyArray<{
  readonly header: string;
  readonly commands: readonly string[];
}> = [
  { header: 'WORK', commands: ['init', 'new', 'check', 'studio'] },
  { header: 'OUTPUT', commands: ['html', 'slides', 'pdf', 'build'] },
  { header: 'REFERENCE', commands: ['block', 'demo'] },
  { header: 'SETUP', commands: ['sync'] },
];

/** The grouped command epilogue, shown after top-level help. Uncolored when
 *  output must stay plain — picocolors alone would still emit ANSI on piped
 *  output whenever a `CI` env var is set (e.g. GitHub Actions). */
export function examples(): string {
  const p = plainOutput();
  const dim = (s: string): string => (p ? s : pc.dim(s));
  const cyan = (s: string): string => (p ? s : pc.cyan(s));
  const rows = HELP_GROUPS.map(
    (g) => `  ${dim(g.header.padEnd(10))}${g.commands.map((c) => cyan(c)).join(dim(' · '))}`,
  );
  return [
    '',
    ...rows,
    '',
    `  ${cyan('chiltepin <file.md>')} ${dim('renders + opens a doc — the fastest preview')}`,
    `  ${cyan('npx skills add jdiejim/chiltepin -y')} ${dim('installs the authoring skill into your AI agent')}`,
    `  ${dim('Docs:')} https://github.com/jdiejim/chiltepin`,
    '',
  ].join('\n');
}

/**
 * Real usage examples per visible command — one data table drives every
 * command's `--help` EXAMPLES epilogue ({@link commandExamples}).
 */
const COMMAND_EXAMPLES: Readonly<
  Record<string, ReadonlyArray<readonly [cmd: string, note: string]>>
> = {
  init: [
    ['chiltepin init', 'scaffold docs/ and chiltepin.config.json'],
    ['chiltepin init --force', 'overwrite the starter files'],
  ],
  new: [
    ['chiltepin new', 'pick a doc template or block scaffold interactively'],
    ['chiltepin new adr -o docs/decisions/001-queue.md', 'scaffold an ADR into a file'],
    ['chiltepin new sequence', 'print a sequence-block scaffold to paste'],
  ],
  check: [
    ['chiltepin check', 'validate every doc under docs/'],
    ['chiltepin check docs/api.md', 'validate one file'],
    ['chiltepin check --json', 'machine-readable diagnostics (CI)'],
  ],
  studio: [
    ['chiltepin studio', 'open the studio — Edit · Site · Present, files stay the source of truth'],
    ['chiltepin studio --port 5000 --no-open', 'pick the port, skip the browser'],
  ],
  html: [
    ['chiltepin html docs/design.md', 'write docs/design.html next to the source'],
    ['chiltepin html docs/design.md -p', 'render to a temp file and open it'],
  ],
  slides: [
    ['chiltepin slides docs/roadmap.md -p', 'open the doc as a slide deck'],
    ['chiltepin slides docs/roadmap.md -o deck.html', 'write the deck to a file'],
  ],
  pdf: [
    ['chiltepin pdf docs/design.md', 'write docs/design.pdf (downloads Chromium once)'],
    ['chiltepin pdf docs/design.md -o out/design.pdf', 'choose the output path'],
  ],
  build: [
    ['chiltepin build', 'build the whole site into dist/'],
    ['chiltepin build --out site', 'build into a different directory'],
  ],
  block: [
    ['chiltepin block', 'every block type, one line each, by family'],
    ['chiltepin block sequence', 'fields, enums, terse forms, and a validating example'],
    ['chiltepin block erd --json', 'the same contract as JSON'],
  ],
  demo: [
    ['chiltepin demo', 'render the built-in showcase of every block and open it'],
    ['chiltepin demo charts -s', 'one family, as a slide deck'],
  ],
  sync: [
    ['chiltepin sync openapi api.yaml -o docs/api.md', 'generate a doc from an OpenAPI spec'],
    ['chiltepin sync openapi api.yaml --check docs/api.md', 'fail on drift (CI)'],
    [
      'chiltepin sync csv sales.csv',
      'print a ready-to-paste block (auto-picks table/statustable/chart)',
    ],
    [
      'chiltepin sync csv sales.csv -o docs/sales.md',
      'wrap the block in a doc, write it, and validate',
    ],
    ['chiltepin sync csv sales.csv --block chart', 'force the target block type'],
  ],
};

/**
 * The EXAMPLES epilogue for one command's `--help`, or `''` when the command
 * has no examples (hidden compat commands). Plain-aware like {@link examples}.
 */
export function commandExamples(name: string): string {
  const rows = COMMAND_EXAMPLES[name];
  if (rows === undefined) return '';
  const p = plainOutput();
  const dim = (s: string): string => (p ? s : pc.dim(s));
  const cyan = (s: string): string => (p ? s : pc.cyan(s));
  const width = Math.max(...rows.map(([cmd]) => cmd.length));
  return [
    '',
    'Examples:',
    ...rows.map(([cmd, note]) => `  ${cyan('$ ' + cmd.padEnd(width))}  ${dim(note)}`),
    '',
  ].join('\n');
}
