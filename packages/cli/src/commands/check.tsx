/**
 * `chiltepin check` — validate one or more documents and report diagnostics.
 *
 * Runs core's `lintDocument` (schema validation, the STE-informed prose
 * lint, the density budget, placeholder names, the graph lints, template
 * echo, same-document links — the same call Studio makes), cross-doc
 * reference and link resolution, the diagram geometry check
 * (`lintGeometry`), the page-fit check (`lintFit`), and the on-disk
 * convention check (`lintConventions`) over every matched doc. Prose
 * findings are warnings by default; `--strict-prose` escalates them to
 * errors. Every other warning stays a warning.
 *
 * References and links resolve against the whole docs folder, so checking
 * one file still finds the documents it links to.
 *
 * Pure {@link runCheck} returns `{ diagnostics, exitCode }`. The UI layer
 * picks how to render: JSON, Ink table (interactive TTY), or plain text (CI).
 */

import {
  lintDocument,
  parseDocument,
  PROSE_CHECK_CODES,
  resolveRefs,
  type Diagnostic,
  type Document,
} from 'chiltepin-core';
import { GEOMETRY_TYPES, geometryReport, type GeometryReport } from 'chiltepin-render';
import { encodingDiagnostics, loadDocs, type DocFile } from '../io/files.js';
import { lintConventions } from './conventions.js';
import { lintFit } from './fit.js';

/** The prose-lint codes, as a set for the strict-prose escalation. */
const PROSE_CODES: ReadonlySet<string> = new Set(PROSE_CHECK_CODES);

/** The block types with grid geometry (see `geometryReport`). */
const GEOMETRY_TYPE_SET: ReadonlySet<string> = new Set(GEOMETRY_TYPES);

/**
 * `W_GEOMETRY` warnings: each grid diagram is laid out as the renderer lays it
 * out, and every problem the layout could not avoid (two nodes in one cell,
 * an edge through a node, a label with no clear place, many crossings) is
 * reported on the block's fence line, with a hint in the block's own data.
 * A block that failed validation is skipped (its errors come first), and a
 * renderer failure is not this check's to report.
 */
export function lintGeometry(doc: Document, file: string, validation: readonly Diagnostic[]): Diagnostic[] {
  const out: Diagnostic[] = [];
  const errorLines = validation.filter((d) => d.level === 'error').map((d) => d.line ?? 0);
  for (const seg of doc.segments) {
    if (seg.kind === 'markdown' || !GEOMETRY_TYPE_SET.has(seg.kind)) continue;
    if (seg.parseError !== undefined || seg.data === undefined || seg.data === null) continue;
    // The fence, the body, and the closing fence.
    const last = seg.line + seg.raw.split('\n').length + 1;
    if (errorLines.some((l) => l >= seg.line && l <= last)) continue;
    let report: GeometryReport;
    try {
      report = (geometryReport as (type: string, data: unknown) => GeometryReport)(seg.kind, seg.data);
    } catch {
      continue;
    }
    const label = seg.sourceType ?? seg.kind;
    for (const issue of report.issues) {
      out.push({
        file,
        line: seg.line,
        level: 'warn',
        code: 'W_GEOMETRY',
        message: `${label}: ${issue.message}`,
        ...(issue.path !== undefined ? { value: issue.path } : {}),
        hint: issue.hint,
      });
    }
  }
  return out;
}

/** Inputs to {@link runCheck}. */
interface CheckOptions {
  /** Glob patterns to expand. */
  readonly patterns: readonly string[];
  /** Working directory. */
  readonly cwd: string;
  /** Docs root for slug derivation. */
  readonly docsRoot: string;
  /** Escalate W_PROSE_* warnings to errors (they then affect the exit code). */
  readonly strictProse?: boolean;
}

/** Result of running `chiltepin check` — diagnostics aggregated across all matched docs. */
export interface CheckResult {
  /** All diagnostics in file/line order. */
  readonly diagnostics: readonly Diagnostic[];
  /** Files that were checked. */
  readonly files: readonly string[];
  /** Per-file source lines, for code frames (keyed by the diagnostic `file`). */
  readonly sources: ReadonlyMap<string, readonly string[]>;
  /** Suggested exit code: 0 = clean, 1 = errors present. */
  readonly exitCode: 0 | 1;
}

/**
 * Validates a set of documents and resolves references across them.
 *
 * @param opts - Options including glob patterns and docs root.
 * @returns Aggregated diagnostics + suggested exit code.
 */
export async function runCheck(opts: CheckOptions): Promise<CheckResult> {
  const docs = await loadDocs(opts.patterns, opts.cwd, opts.docsRoot);
  // A file that is not UTF-8 is reported, not parsed: validating the
  // replacement characters it decodes to would call mojibake a clean document.
  const parse = (list: readonly DocFile[]): { doc: Document; file: string }[] =>
    list
      .filter((d) => d.encodingError === undefined)
      .map((d) => ({ doc: parseDocument(d.source, d.slug), file: d.file }));
  const parsed = parse(docs);

  const diagnostics: Diagnostic[] = [...encodingDiagnostics(docs)];

  for (const { doc, file } of parsed) {
    // One call for everything core can check in one document (Studio makes
    // the same call). Only `--strict-prose` escalates; every other warning
    // stays a warning.
    const own = lintDocument(doc, file);
    diagnostics.push(...own);
    // Geometry: what each grid diagram's layout could not avoid. Fit: a
    // drawing that scrolls sideways or shrinks too far. Both need the
    // renderer, so they run here, not in core.
    diagnostics.push(...lintGeometry(doc, file, own));
    diagnostics.push(...lintFit(doc, file, own));
  }

  // On-disk convention (path-based, so it runs here, not in core). Always a
  // warning — `--strict-prose` does not escalate it.
  for (const d of docs) {
    diagnostics.push(...lintConventions(d.file, d.absolute, opts.cwd, opts.docsRoot));
  }

  // References and links resolve against the whole docs folder: checking one
  // file still finds the documents it links to. Context docs come first, so
  // a duplicate id is reported on the checked file; only the checked files'
  // findings are kept.
  const checked = new Set(docs.map((d) => d.absolute));
  const context = (await loadDocs([`${opts.docsRoot}/**/*.md`], opts.cwd, opts.docsRoot)).filter(
    (d) => !checked.has(d.absolute),
  );
  const reported = new Set(parsed.map((p) => p.file));
  const resolved = resolveRefs([...parse(context), ...parsed]);
  diagnostics.push(...resolved.diagnostics.filter((d) => reported.has(d.file)));

  // `--strict-prose`: prose findings become errors and gate the exit code.
  const escalated: Diagnostic[] =
    opts.strictProse === true
      ? diagnostics.map((d) =>
          d.level === 'warn' && PROSE_CODES.has(d.code) ? { ...d, level: 'error' } : d,
        )
      : diagnostics;

  escalated.sort((a, b) => {
    const f = a.file.localeCompare(b.file);
    if (f !== 0) return f;
    return (a.line ?? 0) - (b.line ?? 0);
  });

  const exitCode = escalated.some((d) => d.level === 'error') ? 1 : 0;

  const sources = new Map<string, readonly string[]>();
  for (const d of docs) {
    if (d.encodingError !== undefined) continue; // no readable text to frame
    sources.set(d.file, d.source.split(/\r\n|\r|\n/));
  }

  return {
    diagnostics: escalated,
    files: docs.map((d: DocFile) => d.file),
    sources,
    exitCode,
  };
}
