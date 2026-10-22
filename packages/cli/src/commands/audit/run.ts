/**
 * `chiltepin audit [path]` — orchestrates the sources, derives recommendations,
 * and formats the human report. Returns values; the CLI dispatcher owns exit
 * codes and printing. An audit is informational: it exits 0 whenever the
 * path is usable, even when it recommends nothing.
 */

import pc from 'picocolors';
import { resolve } from 'node:path';
import { collectBuiltin, isUsableRoot, FILE_CAP } from './builtinSource.js';
import { loadGraphify, graphifyStats, graphifyGodNodes } from './graphifySource.js';
import { deriveRecommendations } from './rules.js';
import type { AuditReport, AuditSourceName } from './types.js';

interface RunAuditOptions {
  readonly cwd: string;
  /** Directory to audit, relative to cwd (default: cwd itself). */
  readonly path?: string;
}

type RunAuditResult =
  | { readonly ok: true; readonly report: AuditReport }
  | { readonly ok: false; readonly error: string };

/** Runs the audit for one directory tree. */
export async function runAudit(options: RunAuditOptions): Promise<RunAuditResult> {
  const root = resolve(options.cwd, options.path ?? '.');
  if (!(await isUsableRoot(root))) {
    return { ok: false, error: `Cannot audit ${options.path ?? root}: not a directory.` };
  }

  // The builtin extractor always runs — graphify does not classify
  // entrypoints, routes, schemas, packages, or externals.
  const collected = await collectBuiltin(root);
  const graph = await loadGraphify(root);

  let source: AuditSourceName = 'builtin';
  const notices: string[] = [];
  let stats = collected.stats;
  let evidence = collected.evidence;

  if (graph.ok) {
    source = 'graphify';
    stats = graphifyStats(graph.graph);
    evidence = { ...evidence, godNodes: graphifyGodNodes(graph.graph) };
  } else if (graph.missing) {
    notices.push('Install graphify to get a richer audit (call graph, communities).');
  } else {
    notices.push(`${graph.reason} The audit used the builtin extractor.`);
  }
  if (collected.truncated) {
    notices.push(`The scan stopped at ${FILE_CAP} files. Counts are lower bounds.`);
  }

  const merged = { ...collected, stats, evidence };
  const recommendations = deriveRecommendations(merged, source);

  const report: AuditReport = {
    version: 1,
    source,
    ...(notices.length > 0 ? { notice: notices.join(' ') } : {}),
    stats,
    evidence,
    recommendations,
  };
  return { ok: true, report };
}

/** Top languages as `ts 120 · md 14 · …` (largest first, capped). */
function languagesLine(languages: Readonly<Record<string, number>>, cap = 6): string {
  const top = Object.entries(languages)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, cap);
  return top.map(([lang, n]) => `${lang} ${n}`).join(' · ');
}

/**
 * Formats the human report: stats line, recommendations table, next-step
 * hint. `plain` drops color (non-TTY / CHILTEPIN_PLAIN / tests).
 */
export function formatAudit(report: AuditReport, plain = false): string {
  const dim = (s: string): string => (plain ? s : pc.dim(s));
  const bold = (s: string): string => (plain ? s : pc.bold(s));
  const cyan = (s: string): string => (plain ? s : pc.cyan(s));
  const paint = (confidence: string): string => {
    if (plain) return confidence;
    if (confidence === 'high') return pc.green(confidence);
    if (confidence === 'medium') return pc.yellow(confidence);
    return pc.dim(confidence);
  };

  const lines: string[] = [];
  const langs = languagesLine(report.stats.languages);
  lines.push(`  ${dim('source'.padEnd(8))}${report.source}`);
  lines.push(
    `  ${dim('files'.padEnd(8))}${report.stats.files}${langs === '' ? '' : dim(` · ${langs}`)}`,
  );
  const e = report.evidence;
  const counts = [
    `${e.entrypoints.length} entrypoint(s)`,
    `${e.routes.length} route(s)`,
    `${e.schemas.length} schema(s)`,
    `${e.packages.length} package(s)`,
    `${e.externals.length} external(s)`,
    `${e.godNodes.length} god node(s)`,
  ].join(' · ');
  lines.push(`  ${dim('found'.padEnd(8))}${counts}`);
  lines.push('');

  if (report.recommendations.length === 0) {
    lines.push(`  ${bold('No recommendations.')} ${dim('The audit found too little evidence.')}`);
  } else {
    lines.push(`  ${bold('Recommended docs:')}`);
    const kindWidth = Math.max(...report.recommendations.map((r) => r.kind.length));
    for (const r of report.recommendations) {
      lines.push(
        `    ${paint(r.confidence.padEnd(7))} ${cyan(r.kind.padEnd(kindWidth))}  ${r.rationale} ${dim(`(${r.citations.length} citation(s))`)}`,
      );
    }
  }
  lines.push('');
  lines.push(
    `  ${dim('Next:')} run ${cyan('chiltepin audit --json')}, then ask your agent to write the docs you pick from it.`,
  );
  if (report.notice !== undefined) lines.push(`  ${dim(`note: ${report.notice}`)}`);
  lines.push('');
  return lines.join('\n');
}
