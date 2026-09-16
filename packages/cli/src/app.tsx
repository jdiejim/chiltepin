/**
 * CLI dispatcher. Parses argv via commander, runs the matching command, and
 * decides between Ink rendering, plain output, and JSON output based on
 * {@link isInteractive} and `--json` flags.
 */

import { Command } from 'commander';
import pc from 'picocolors';
import React from 'react';
import { render as inkRender } from 'ink';
import { findConfig, loadConfig } from './io/config.js';
import { cliVersion } from './io/version.js';
import { runCheck } from './commands/check.js';
import {
  parseExportSize,
  runSingle,
  type ExportSize,
  type SingleFormat,
} from './commands/single.js';
import { runDemo } from './commands/demo.js';
import { DemoApp, type DemoPick } from './commands/DemoApp.js';
import { runBuild } from './commands/build.js';
import { runServe } from './commands/serve.js';
import { runStudio } from './commands/studio.js';
import { runInit, type InitResult } from './commands/init.js';
import { blockIndex, blockReference, resolveBlockName } from './commands/block.js';
import { copyToClipboard } from './io/clipboard.js';
import { systemPrompt } from './commands/skill.js';
import { resolve as resolvePath } from 'node:path';
import { writeFileSafe } from './io/write.js';
import {
  runSyncCsv,
  runSyncOpenApi,
  runSyncSchema,
  type CsvBlockKind,
  type SchemaDialect,
} from './commands/sync.js';
import {
  templateFor,
  writeNewDoc,
  NewPickerApp,
  DOC_TEMPLATES,
  DOC_TEMPLATE_INFO,
  isDocTemplate,
} from './commands/new.js';
import { projectStatus, formatStatus } from './commands/status.js';
import { runAudit, formatAudit } from './commands/audit/run.js';
import { DiagnosticsTable, formatDiagnosticsPlain } from './ui/DiagnosticsTable.js';
import { banner, examples, commandExamples, actionBanner, funLine } from './ui/banner.js';
import { isInteractive } from './tty.js';

/** Prints the cfonts action banner + a fun line for a command (interactive only). */
function flourish(word: string, lineKey: string = word): void {
  if (!isInteractive) return;
  console.log(actionBanner(word));
  console.log(funLine(lineKey) + '\n');
}
import type { BlockType } from 'chiltepin-core';
import {
  BLOCK_TYPES,
  BLOCK_ALIASES,
  BLOCK_FAMILIES,
  familyBlocks,
  isBlockFamily,
  type BlockFamily,
} from 'chiltepin-core';

/** Prints the created/skipped files and next-step hints after `chiltepin init`. */
function printInitSummary(result: InitResult): void {
  for (const f of result.created) console.log(pc.green('+ ') + f);
  for (const f of result.skipped) console.log(pc.dim('  skip ') + f + pc.dim(' (exists)'));
  console.log(
    pc.bold(`\nCreated ${result.created.length} file(s), skipped ${result.skipped.length}.`),
  );
  console.log(
    pc.dim(
      'Layout: docs/<area>/<doc>.md, kebab-case names · output goes to dist/ — do not commit it.',
    ),
  );
  console.log(
    `Next: ${pc.cyan('chiltepin check')} ${pc.dim('·')} ${pc.cyan('chiltepin docs/getting-started.md')} ${pc.dim('(render + open)')}`,
  );
  console.log(
    `AI:   ${pc.cyan('npx skills add jdiejim/chiltepin -y')} ${pc.dim('installs the authoring skill into Claude Code, Cursor, Codex, and 70+ agents')}`,
  );
}

/** Runs the CLI for the given argv (typically `process.argv`). */
export async function main(argv: readonly string[]): Promise<number> {
  // Both spellings work: commander allows one short flag per option, so a
  // lone -V normalizes to --version before parsing.
  argv = argv.map((a) => (a === '-V' ? '--version' : a));
  const version = cliVersion();
  const program = new Command();
  program
    .name('chiltepin')
    .description('Author, validate, render, and export Chiltepin documentation.')
    // Lowercase -v is what fingers type; commander's default is -V only, so
    // register the flag string explicitly and alias -V below.
    .version(version, '-v, --version', 'print the version')
    // Banner + workflow only on top-level help — not on every subcommand's --help.
    .addHelpText('beforeAll', (ctx) => (ctx.command.name() === 'chiltepin' ? banner(version) : ''))
    .addHelpText('after', (ctx) => (ctx.command.name() === 'chiltepin' ? examples() : ''))
    .exitOverride();

  let exitCode = 0;

  // Smart bare `chiltepin` + the `chiltepin <file.md>` shortcut. A bare .md argument is
  // the most natural gesture, so it becomes the shortest command: render +
  // open (today's preview). Bare `chiltepin` in a TTY shows a mini project status
  // (or an init hint outside a project); non-TTY keeps the help output.
  program
    .argument('[file]', 'a .md file to render + open in the browser (same as `chiltepin html <file> -p`)')
    .action(async (file: string | undefined) => {
      const cwd = process.cwd();
      if (file !== undefined) {
        if (!/\.md$/i.test(file)) {
          // Keep the unknown-command contract for non-.md strays (`chiltepin claude`).
          console.error(`error: unknown command '${file}'`);
          exitCode = 1;
          return;
        }
        flourish('preview');
        const result = await runSingle({
          cwd,
          input: file,
          format: 'html',
          preview: true,
          open: isInteractive, // script-safe: piped output renders but doesn't open
        });
        const verb = result.opened ? 'Opened' : 'Wrote';
        console.log(`${pc.green(verb)} ${result.output} ${pc.dim(`(${result.bytes} bytes)`)}`);
        return;
      }

      // Non-TTY / CHILTEPIN_PLAIN: stay script-safe — print the regular help.
      if (!isInteractive) {
        program.outputHelp();
        return;
      }

      console.log(banner(version));
      if (findConfig(cwd) === undefined) {
        console.log(`  Not a Chiltepin project yet — run ${pc.cyan('chiltepin init')} to scaffold one.`);
        console.log(
          `  ${pc.dim('Curious first?')} ${pc.cyan('chiltepin demo')} ${pc.dim('renders every block · ')}${pc.cyan('chiltepin block')} ${pc.dim('lists them.')}`,
        );
        console.log('');
        return;
      }
      const status = await projectStatus(cwd);
      console.log(formatStatus(status));
    });

  program
    .command('init')
    .description('Scaffold a new Chiltepin project in the current directory')
    .option('--force', 'overwrite existing files')
    .option('-y, --yes', 'accepted for compatibility (init has no prompts)', undefined)
    .action(async (opts: { force?: boolean }) => {
      const result = await runInit({
        cwd: process.cwd(),
        ...(opts.force === true ? { force: true } : {}),
      });
      printInitSummary(result);
    });

  program
    .command('check [globs...]')
    .description('Validate documents (default: docs/**/*.md)')
    .option('--json', 'emit machine-readable JSON')
    .option('--strict-prose', 'treat prose-lint warnings (W_PROSE_*) as errors')
    .action(async (globs: string[], opts: { json?: boolean; strictProse?: boolean }) => {
      const cwd = process.cwd();
      const config = await loadConfig(cwd);
      const patterns = globs.length > 0 ? globs : [`${config.docsDir}/**/*.md`];
      const result = await runCheck({
        patterns,
        cwd,
        docsRoot: config.docsDir,
        ...(opts.strictProse === true ? { strictProse: true } : {}),
      });
      if (opts.json === true) {
        process.stdout.write(
          JSON.stringify({ diagnostics: result.diagnostics, files: result.files }, null, 2) + '\n',
        );
      } else if (isInteractive) {
        flourish('check');
        const { waitUntilExit } = inkRender(
          <DiagnosticsTable
            diagnostics={result.diagnostics}
            fileCount={result.files.length}
            sources={result.sources}
          />,
        );
        await waitUntilExit();
      } else {
        process.stdout.write(
          formatDiagnosticsPlain(result.diagnostics, result.files.length, result.sources),
        );
      }
      exitCode = result.exitCode;
    });

  // `chiltepin audit [path]` — evidence report + rule-derived doc recommendations.
  // Informational: exits 0 whenever the path is usable, 2 when it is not.
  program
    .command('audit [path]')
    .description('Audit a codebase and recommend which Chiltepin docs to write (evidence-cited)')
    .option('--json', 'emit machine-readable JSON (schema version 1)')
    .action(async (pathArg: string | undefined, opts: { json?: boolean }) => {
      const result = await runAudit({
        cwd: process.cwd(),
        ...(pathArg !== undefined ? { path: pathArg } : {}),
      });
      if (!result.ok) {
        console.error(pc.red(result.error));
        exitCode = 2;
        return;
      }
      if (opts.json === true) {
        process.stdout.write(JSON.stringify(result.report, null, 2) + '\n');
        return;
      }
      if (isInteractive) {
        flourish('audit');
        console.log(formatAudit(result.report, false));
      } else {
        process.stdout.write(formatAudit(result.report, true) + '\n');
      }
    });

  // Hidden compat: `chiltepin preview` ≡ `chiltepin <file.md>` ≡ `chiltepin html <file> -p`.
  program
    .command('preview <input>', { hidden: true })
    .description('Render a document to a temp HTML file and open it (same as `chiltepin <file.md>`)')
    .action(async (input: string) => {
      flourish('preview');
      const result = await runSingle({
        cwd: process.cwd(),
        input,
        format: 'html',
        preview: true,
        open: isInteractive,
      });
      const verb = result.opened ? 'Opened' : 'Wrote';
      console.log(`${pc.green(verb)} ${result.output} ${pc.dim(`(${result.bytes} bytes)`)}`);
    });

  // `chiltepin new [name]` — one verb for "make something": doc templates (adr,
  // runbook, …) AND single-block scaffolds (sequence, erd, …), resolved by
  // name (alias spellings like `waterfall` resolve to their canonical block).
  // Bare + TTY → two-section Ink picker; bare + non-TTY → list the names.
  program
    .command('new [name]')
    .description(
      'Create from a template — a full doc (adr, runbook, …) or a single block (sequence, erd, …)',
    )
    .option('-o, --output <path>', 'write to a file instead of printing to stdout')
    .option('--force', 'with -o, replace the file if it already exists')
    .action(async (nameArg: string | undefined, opts: { output?: string; force?: boolean }) => {
      const cwd = process.cwd();

      // Resolve a name: doc template → block type → permanent alias.
      const resolveName = (n: string): { type: string; note?: string } | undefined => {
        if (isDocTemplate(n) || BLOCK_TYPES.includes(n as BlockType)) return { type: n };
        const alias = BLOCK_ALIASES[n];
        if (alias !== undefined) {
          const patch = Object.entries(alias.patch ?? {})
            .map(([k, v]) => `${k}: ${String(v)}`)
            .join(', ');
          return {
            type: alias.type,
            note: `\`${n}\` now lives in \`${alias.type}\`${patch === '' ? '' : ` (${patch})`} — both spellings work; no change needed.`,
          };
        }
        return undefined;
      };

      const emit = async (type: string): Promise<void> => {
        if (opts.output !== undefined) {
          const p = await writeNewDoc({
            cwd,
            type,
            out: opts.output,
            ...(opts.force === true ? { force: true } : {}),
          });
          console.log(`${pc.green('✓')} Wrote ${p}`);
          return;
        }
        const content = isDocTemplate(type)
          ? (DOC_TEMPLATES[type] as string)
          : templateFor(type as BlockType);
        if (isInteractive)
          console.log(pc.dim(`# ${type} — paste into a docs/*.md (or re-run with -o <path>)\n`));
        process.stdout.write(content);
        if (isInteractive && copyToClipboard(content))
          console.log(pc.green('\n✓ copied to clipboard'));
      };

      if (nameArg !== undefined) {
        const hit = resolveName(nameArg);
        if (hit === undefined) {
          console.error(
            pc.red(`Unknown template or block: ${nameArg}. Run \`chiltepin new\` to list them.`),
          );
          exitCode = 2;
          return;
        }
        // The alias note rides stderr so piped stdout stays a clean template.
        if (hit.note !== undefined) console.error(pc.yellow(hit.note));
        await emit(hit.type);
        return;
      }

      // Bare `chiltepin new`, non-TTY: list every name (script-safe).
      if (!isInteractive) {
        console.log('Doc templates:');
        for (const [name, info] of Object.entries(DOC_TEMPLATE_INFO)) {
          console.log(`  ${name.padEnd(14)}${info.description}`);
        }
        console.log('\nBlocks:');
        for (const fam of BLOCK_FAMILIES) {
          console.log(`  ${fam.label}: ${familyBlocks(fam.id).join('  ')}`);
        }
        console.log('\nUsage: chiltepin new <name> [-o <path>]');
        return;
      }

      // Bare `chiltepin new`, TTY: two-section picker (Doc templates | Blocks by family).
      flourish('new');
      let picked: string | undefined;
      const { waitUntilExit } = inkRender(
        <NewPickerApp
          onPick={(n) => {
            picked = n;
          }}
        />,
      );
      await waitUntilExit();
      if (picked === undefined) return; // cancelled with q / escape
      await emit(picked);
    });

  // `chiltepin build` — render every doc into a static HTML site under outDir.
  program
    .command('build')
    .description('Build a static HTML site from all docs — index, sidebar nav, cross-doc links')
    .option('--out <dir>', 'output directory (default: config outDir, "dist")')
    .option(
      '--rich-index',
      'build the rich index page — project TLDR, doc map by tag, cross-reference graph (default)',
    )
    .option('--no-rich-index', 'build the plain card-grid index instead')
    .action(async (opts: { out?: string; richIndex?: boolean }) => {
      flourish('build');
      const result = await runBuild({
        cwd: process.cwd(),
        ...(opts.out !== undefined ? { out: opts.out } : {}),
        ...(opts.richIndex !== undefined ? { richIndex: opts.richIndex } : {}),
      });
      // Schema/ref findings are warnings here — `chiltepin check` stays the gate.
      // A render failure (E_RENDER) is an error: it names the document and the
      // block, the rest of the build still ran, and the exit code is 1.
      if (result.diagnostics.length > 0) {
        for (const d of result.diagnostics) {
          const loc = d.line !== undefined ? `${d.file}:${d.line}` : d.file;
          const fatal = d.code === 'E_RENDER' || d.code === 'E_ENCODING';
          const line = `${fatal ? 'error' : 'warn '}  ${loc}  ${d.code}  ${d.message}`;
          console.error(fatal ? pc.red(line) : pc.yellow(line));
        }
        const errors = result.diagnostics.filter(
          (d) => d.code === 'E_RENDER' || d.code === 'E_ENCODING',
        ).length;
        const warnings = result.diagnostics.length - errors;
        const parts: string[] = [];
        if (errors > 0) parts.push(`${errors} error(s)`);
        if (warnings > 0) parts.push(`${warnings} warning(s)`);
        console.error(
          (errors > 0 ? pc.red : pc.yellow)(`${parts.join(', ')} — run \`chiltepin check\` for details`),
        );
      }
      const bytes = result.pages.reduce((sum, p) => sum + p.bytes, 0);
      // Decks are companion views, not documents — report them separately so
      // "page(s)" keeps meaning index + one per doc.
      const decks = result.pages.filter((p) => p.path.endsWith('.slides.html')).length;
      const deckPart = decks > 0 ? ` + ${decks} deck(s)` : '';
      console.log(
        `${pc.green('✓')} ${result.pages.length - decks} page(s)${deckPart} → ${result.outDirRel}/ ${pc.dim(`(${bytes} bytes)`)}`,
      );
      // Pruning: only files the previous build recorded as its own are removed.
      if (result.removed.length > 0) {
        for (const p of result.removed) console.log(pc.dim(`  removed ${p}`));
        console.log(
          `${pc.green('✓')} ${result.removed.length} stale file(s) removed ${pc.dim('(no longer generated)')}`,
        );
      }
      if (result.pruneDeferred) {
        console.log(
          pc.dim(
            `Note: ${result.outDirRel}/ had no build manifest, so nothing was pruned. The next build prunes what this one generated.`,
          ),
        );
      }
      exitCode = result.exitCode;
    });

  // Hidden compat: `chiltepin serve` still works, but `chiltepin studio` (Site mode) is
  // the one local surface — it mounts the same live-reloading site at /site/.
  program
    .command('serve', { hidden: true })
    .description(
      'Serve the docs site locally with live reload (compat — `chiltepin studio` includes this as Site mode)',
    )
    .option('--port <n>', 'port to listen on (0 = pick a free port)', '4173')
    .option('--no-open', "don't open the browser")
    .option(
      '--rich-index',
      'serve the rich index page — project TLDR, doc map by tag, cross-reference graph (default)',
    )
    .option('--no-rich-index', 'serve the plain card-grid index instead')
    .action(async (opts: { port: string; open: boolean; richIndex?: boolean }) => {
      flourish('serve');
      const parsed = Number.parseInt(opts.port, 10);
      await runServe({
        cwd: process.cwd(),
        port: Number.isNaN(parsed) ? 4173 : parsed,
        open: opts.open,
        ...(opts.richIndex !== undefined ? { richIndex: opts.richIndex } : {}),
      });
    });

  // `chiltepin studio` — THE local surface: visual editor over a file-bridge API
  // (files stay canonical) with Edit | Site | Present modes in one server.
  program
    .command('studio')
    .description(
      'open the local studio — a Home page of your docs, edit in place, present as slides; the built site is one click away; files stay the source of truth',
    )
    .option('--port <n>', 'port to listen on (0 = pick a free port)', '4174')
    .option('--no-open', "don't open the browser")
    .action(async (opts: { port: string; open: boolean }) => {
      flourish('studio');
      const parsed = Number.parseInt(opts.port, 10);
      await runStudio({
        cwd: process.cwd(),
        port: Number.isNaN(parsed) ? 4174 : parsed,
        open: opts.open,
      });
    });

  const syncCmd = program
    .command('sync')
    .description(
      'Generate Chiltepin docs from external sources (OpenAPI, CSV, SQL / DBML / Prisma schemas)',
    );
  syncCmd
    .command('openapi <spec>')
    .description('Generate (or drift-check) a doc from an OpenAPI 3.x spec')
    .option('-o, --out <path>', 'write generated markdown to this path')
    .option('--check <path>', 'compare against an existing doc and fail on drift')
    .option('--slug <slug>', 'block-id namespace (defaults to the output basename)')
    .option('--force', 'with --out, replace the file if it already exists')
    .action(
      async (
        spec: string,
        opts: { out?: string; check?: string; slug?: string; force?: boolean },
      ) => {
        const result = await runSyncOpenApi({
          cwd: process.cwd(),
          spec,
          ...(opts.out !== undefined ? { out: opts.out } : {}),
          ...(opts.check !== undefined ? { check: opts.check } : {}),
          ...(opts.slug !== undefined ? { slug: opts.slug } : {}),
          ...(opts.force === true ? { force: true } : {}),
        });
        if (result.exitCode === 0) {
          console.log(pc.green('✓ ') + result.message);
        } else {
          console.error(pc.red(result.message));
          if (result.diff !== undefined) console.error(result.diff);
        }
        exitCode = result.exitCode;
      },
    );
  syncCmd
    .command('csv <file>')
    .description('Turn a CSV into a table/statustable/chart block (stdout), or a whole doc (--out)')
    .option('-o, --out <path>', 'write a minimal doc (meta + block) to this path and validate it')
    .option('--block <type>', 'target block: table | statustable | chart (default: auto-suggest)')
    .option('--title <title>', 'doc title with --out (default: prettified file name)')
    .option('--delimiter <d>', 'field delimiter: "," ";" or "tab" (default: auto-detect)')
    .option('--force', 'with --out, replace the file if it already exists')
    .action(
      async (
        file: string,
        opts: { out?: string; block?: string; title?: string; delimiter?: string; force?: boolean },
      ) => {
        if (
          opts.block !== undefined &&
          opts.block !== 'table' &&
          opts.block !== 'statustable' &&
          opts.block !== 'chart'
        ) {
          console.error(pc.red(`Unknown block: ${opts.block}. Use table | statustable | chart.`));
          exitCode = 2;
          return;
        }
        const result = await runSyncCsv({
          cwd: process.cwd(),
          file,
          ...(opts.out !== undefined ? { out: opts.out } : {}),
          ...(opts.block !== undefined ? { block: opts.block as CsvBlockKind } : {}),
          ...(opts.title !== undefined ? { title: opts.title } : {}),
          ...(opts.delimiter !== undefined ? { delimiter: opts.delimiter } : {}),
          ...(opts.force === true ? { force: true } : {}),
        });
        // Auto-picked block: say why, on stderr so piped stdout stays a clean fence.
        if (result.reason !== undefined) {
          console.error(pc.dim(`→ ${result.block}: ${result.reason}`));
        }
        for (const w of result.warnings) console.error(pc.yellow(`warn  ${w}`));
        if (result.message !== undefined) {
          console.error(pc.red(result.message));
          exitCode = result.exitCode;
          return;
        }
        if (result.fence !== undefined) {
          process.stdout.write(result.fence);
          if (isInteractive && copyToClipboard(result.fence)) {
            console.log(pc.green('\n✓ copied to clipboard'));
          }
        }
        if (result.outPath !== undefined) {
          console.log(`${pc.green('✓')} Wrote ${result.outPath} ${pc.dim(`(${result.block})`)}`);
          const diags = result.check?.diagnostics ?? [];
          if (diags.length === 0) {
            console.log(`${pc.green('✓')} chiltepin check: clean`);
          } else {
            for (const d of diags) {
              const loc = d.line !== undefined ? `${d.file}:${d.line}` : d.file;
              const paint = d.level === 'error' ? pc.red : pc.yellow;
              console.error(paint(`${d.level}  ${loc}  ${d.code}  ${d.message}`));
            }
            console.error(pc.dim(`chiltepin check: ${diags.length} diagnostic(s)`));
          }
        }
        exitCode = result.exitCode;
      },
    );
  // `chiltepin sync sql | dbml | prisma <file>` — a database schema → an `erd` fence (stdout) or a doc (--out).
  const schemaSync = (dialect: SchemaDialect, what: string): void => {
    syncCmd
      .command(`${dialect} <file>`)
      .description(`Turn ${what} into an erd block (stdout), or a whole doc (--out)`)
      .option('-o, --out <path>', 'write a minimal doc (meta + erd) to this path and validate it')
      .option('--title <title>', 'doc title with --out (default: prettified file name)')
      .option('--id <id>', 'block id (default: the file stem as a slug)')
      .option('--force', 'with --out, replace the file if it already exists')
      .action(
        async (
          file: string,
          opts: { out?: string; title?: string; id?: string; force?: boolean },
        ) => {
          const result = await runSyncSchema({
            cwd: process.cwd(),
            file,
            dialect,
            ...(opts.out !== undefined ? { out: opts.out } : {}),
            ...(opts.title !== undefined ? { title: opts.title } : {}),
            ...(opts.id !== undefined ? { id: opts.id } : {}),
            ...(opts.force === true ? { force: true } : {}),
          });
          if (result.message !== undefined) {
            console.error(pc.red(result.message));
            exitCode = result.exitCode;
            return;
          }
          if (result.fence !== undefined) {
            process.stdout.write(result.fence);
            if (isInteractive && copyToClipboard(result.fence)) {
              console.log(pc.green('\n✓ copied to clipboard'));
            }
          }
          if (result.outPath !== undefined) {
            console.log(
              `${pc.green('✓')} Wrote ${result.outPath} ${pc.dim(`(erd · ${result.entities} entities · ${result.relations} relations)`)}`,
            );
            const diags = result.check?.diagnostics ?? [];
            if (diags.length === 0) {
              console.log(`${pc.green('✓')} chiltepin check: clean`);
            } else {
              for (const d of diags) {
                const loc = d.line !== undefined ? `${d.file}:${d.line}` : d.file;
                const paint = d.level === 'error' ? pc.red : pc.yellow;
                console.error(paint(`${d.level}  ${loc}  ${d.code}  ${d.message}`));
              }
              console.error(pc.dim(`chiltepin check: ${diags.length} diagnostic(s)`));
            }
          }
          exitCode = result.exitCode;
        },
      );
  };
  schemaSync('sql', 'SQL DDL (CREATE TABLE …)');
  schemaSync('dbml', 'a DBML schema');
  schemaSync('prisma', 'a Prisma schema');

  // Single-document shortcuts: `chiltepin html|slides|pdf <input> [-o out] [-p]`.
  const single = (name: SingleFormat, desc: string): void => {
    const cmd = program
      .command(`${name} <input>`)
      .description(desc)
      .option('-o, --output <path>', 'output file path')
      .option('-p, --preview', 'render to a temp file and open it in the browser')
      .option(
        '--force',
        `with -o, replace a file that is not already a .${name === 'slides' ? 'html' : name} file`,
      );
    if (name === 'html' || name === 'pdf') {
      cmd.option(
        '--size <preset>',
        'set the page width: sm (720 px) | md (960 px) | lg (1280 px) | xl (1600 px). Without this option, the page keeps the default width.',
      );
    }
    cmd.action(
      async (
        input: string,
        opts: {
          output?: string;
          preview?: boolean;
          size?: string;
          force?: boolean;
        },
      ) => {
        let size: ExportSize | undefined;
        if (opts.size !== undefined) {
          size = parseExportSize(opts.size);
          if (size === undefined) {
            console.error(pc.red(`Unknown size: ${opts.size}. Use one of: sm | md | lg | xl`));
            exitCode = 2;
            return;
          }
        }
        const word = opts.preview === true ? 'preview' : name;
        if (isInteractive) {
          console.log(actionBanner(word));
          console.log(funLine(word) + '\n');
        }
        const result = await runSingle({
          cwd: process.cwd(),
          input,
          format: name,
          ...(opts.output !== undefined ? { output: opts.output } : {}),
          ...(opts.preview === true ? { preview: true } : {}),
          ...(size !== undefined ? { size } : {}),
          ...(opts.force === true ? { force: true } : {}),
        });
        const verb = result.opened ? 'Opened' : 'Wrote';
        console.log(`${pc.green(verb)} ${result.output} ${pc.dim(`(${result.bytes} bytes)`)}`);
      },
    );
  };
  single('html', 'Render one document to a standalone HTML file');
  single('slides', 'Render one document to a self-contained slide deck');
  single('pdf', 'Render one document to a PDF (needs Chromium once)');

  // `chiltepin demo [family] [-s]` — render the bundled showcase doc (all blocks, or
  // one family) and open it (-s = slides). Bare TTY invocation shows a picker.
  program
    .command('demo [family]')
    .description(
      `Render the built-in showcase and open it — all blocks or one family (${BLOCK_FAMILIES.map((f) => f.id).join(' | ')}); -s for a slide deck`,
    )
    .option('-s, --slides', 'render as a slide deck')
    .option('-o, --output <path>', 'write the rendered file to a path (implies --no-open)')
    .option('--no-open', "write the file but don't open it")
    .option('--force', 'with -o, replace a file that is not already an .html file')
    .action(
      async (
        familyArg: string | undefined,
        opts: { slides?: boolean; open?: boolean; output?: string; force?: boolean },
      ) => {
        let family: BlockFamily | undefined;
        if (familyArg !== undefined) {
          if (!isBlockFamily(familyArg)) {
            const choices = BLOCK_FAMILIES.map((f) => f.id).join(' | ');
            console.error(pc.red(`Unknown family: ${familyArg}. Try one of: ${choices}`));
            exitCode = 2;
            return;
          }
          family = familyArg;
        } else if (isInteractive) {
          // Bare `chiltepin demo` in a TTY: pick a family (or everything) interactively.
          let picked: DemoPick | undefined;
          const { waitUntilExit } = inkRender(
            <DemoApp
              onPick={(p) => {
                picked = p;
              }}
            />,
          );
          await waitUntilExit();
          if (picked === undefined) return; // cancelled with q / escape
          family = picked.family;
        }
        flourish('demo');
        const result = await runDemo({
          format: opts.slides === true ? 'slides' : 'html',
          ...(family !== undefined ? { family } : {}),
          ...(opts.output !== undefined
            ? { output: resolvePath(process.cwd(), opts.output) }
            : { preview: opts.open !== false }),
          ...(opts.force === true ? { force: true } : {}),
        });
        const verb = result.opened ? 'Opened' : 'Wrote';
        console.log(`${pc.green(verb)} ${result.output} ${pc.dim(`(${result.bytes} bytes)`)}`);
      },
    );

  // `chiltepin block [type]` — the reference an agent reads: every block on one
  // line (no argument), or one block's fields, terse forms, and a validating
  // example, all derived from the schema. `--json` for the structured form.
  program
    .command('block [type]')
    .description(
      "Block reference — every type on one line, or one type's fields, enums, terse forms, and example",
    )
    .option('--json', 'emit the contract as JSON')
    .action((typeArg: string | undefined, opts: { json?: boolean }) => {
      if (typeArg === undefined) {
        process.stdout.write(blockIndex());
        return;
      }
      const hit = resolveBlockName(typeArg);
      if (hit === undefined) {
        console.error(pc.red(`Unknown block: ${typeArg}. Run \`chiltepin block\` to list them.`));
        exitCode = 2;
        return;
      }
      // The alias note rides stderr so piped stdout stays the clean contract.
      if (hit.alias !== undefined) {
        console.error(
          pc.yellow(
            `\`${hit.alias}\` is an old spelling of \`${hit.type}\` — both work; showing \`${hit.type}\`.`,
          ),
        );
      }
      process.stdout.write(blockReference(hit.type, opts.json === true));
    });

  // `chiltepin skill` — emit the authoring grammar as a copy-paste system prompt for
  // any tool without a repo-file adapter (Microsoft 365 Copilot, a custom GPT,
  // ChatGPT, Gemini). Prints to stdout (so it pipes), copies to the clipboard in
  // a terminal, or writes to a file with -o.
  program
    .command('skill', { hidden: true })
    .description(
      'Print the Chiltepin authoring grammar as a copy-paste system prompt (for Copilot / custom GPTs / any AI)',
    )
    .option('-o, --output <path>', 'write the system prompt to a file instead of printing it')
    .option(
      '--raw',
      'emit the raw skill file verbatim (with frontmatter) instead of the wrapped prompt',
    )
    .option('--force', 'with -o, replace the file if it already exists')
    .action(async (opts: { output?: string; raw?: boolean; force?: boolean }) => {
      const text = await systemPrompt({ ...(opts.raw === true ? { raw: true } : {}) });
      if (opts.output !== undefined) {
        await writeFileSafe(
          resolvePath(process.cwd(), opts.output),
          text,
          opts.force === true ? { force: true } : {},
        );
        console.log(`${pc.green('✓')} Wrote ${opts.output} ${pc.dim(`(${text.length} chars)`)}`);
        return;
      }
      if (isInteractive) {
        console.log(
          pc.dim(
            "# Chiltepin system prompt — paste into your tool's system / custom-instructions box\n",
          ),
        );
      }
      console.log(text);
      if (isInteractive && copyToClipboard(text)) {
        console.log(pc.green('\n✓ copied to clipboard') + pc.dim(` (${text.length} chars)`));
      }
    });

  // Per-command EXAMPLES epilogue — one data table in banner.ts drives them.
  for (const cmd of program.commands) {
    const name = cmd.name();
    if (commandExamples(name) !== '') {
      cmd.addHelpText('after', () => commandExamples(name));
    }
  }

  try {
    await program.parseAsync(argv as string[], { from: 'node' });
  } catch (err) {
    const e = err as Error & { code?: string; exitCode?: number };
    if (e.code === 'commander.helpDisplayed' || e.code === 'commander.version') {
      return 0;
    }
    if (e.code === 'commander.help') return 0;
    if (typeof e.exitCode === 'number' && e.code?.startsWith('commander.')) {
      return e.exitCode;
    }
    console.error(pc.red(e.message ?? String(err)));
    return 1;
  }

  return exitCode;
}

