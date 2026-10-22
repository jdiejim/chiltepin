/**
 * Diagnostic taxonomy.
 *
 * Library functions return `Diagnostic[]` rather than throwing for expected
 * conditions (parse, validation, resolution). The CLI maps these to console
 * output and exit codes.
 */

/** Severity level of a diagnostic. */
export type DiagnosticLevel = 'error' | 'warn';

/** Stable diagnostic code — useful for CI filters and machine consumers. */
export type DiagnosticCode =
  | 'E_PARSE_YAML'
  // A ```mermaid body holds a line the Mermaid dialect subset cannot read
  // (see `mermaid/`). Same severity and shape as E_PARSE_YAML.
  | 'E_PARSE_MERMAID'
  // A ```dbml / ```prisma body holds a line the schema dialect cannot read
  // (see `import/dbml.ts`, `import/prisma.ts`). Same shape as E_PARSE_YAML.
  | 'E_PARSE_DBML'
  | 'E_PARSE_PRISMA'
  | 'E_SCHEMA'
  | 'E_DUP_ID'
  | 'E_DANGLING_REF'
  | 'E_BAD_REF_FORMAT'
  | 'E_UNKNOWN_BLOCK'
  // A `swimlane` step names a lane that does not exist: a `lane:` label or
  // id with no match, or an index past the last lane (see `validate.ts`).
  // An error, like E_SCHEMA — the step has nowhere to be drawn.
  | 'E_SWIMLANE_LANE'
  // The bytes on disk are not a UTF-8 document (emitted by the CLI, which is
  // the layer that reads files). Reported instead of validating mojibake.
  | 'E_ENCODING'
  // A renderer threw while drawing a block (emitted by the CLI around
  // `chiltepin-render`). Names the document and the offending block.
  | 'E_RENDER'
  | 'W_EMPTY_BLOCK'
  | 'W_SUSPECT_BLOCK'
  | 'W_ALIAS_TYPE'
  // Density budget (see `density.ts`). Always a warning — a design nudge
  // ("split this diagram"), never blocking, never escalated by the CLI.
  | 'W_DENSE_BLOCK'
  // Sequence frame markers out of order: an `else`/`end` with no open frame,
  // or a frame never closed (see `validate.ts`). A warning — the renderer
  // draws what it can; the author fixes the marker.
  | 'W_SEQ_FRAME'
  // A grid group's `parent` does not resolve, or the child's cell range is
  // not inside its parent's (see `validate.ts`). A warning — the renderer
  // still draws both panels; the author moves the cells.
  | 'W_GROUP_NESTING'
  // A `c4` relationship with no `label`. The C4 notation asks every line to
  // name its intent (and container-level lines their technology); an
  // unlabelled arrow leaves the reader to guess what crosses it. A warning.
  | 'W_EDGE_LABEL'
  // A grid diagram's layout could not avoid a geometry problem: two nodes in
  // one cell, an edge forced through a node, an edge label with no clear
  // place on its edge, or many crossings (computed by `chiltepin-render`'s
  // `geometryReport`, reported by the CLI). Always a warning; the hint says
  // the fix in the block's data, never in pixels.
  | 'W_GEOMETRY'
  // The same structural block type used three or more times in one document
  // (tables and code excepted). One lens repeated is usually the writer
  // reaching for the familiar shape; the warning names alternatives.
  | 'W_LENS_REPEAT'
  // A diagram node, actor, or step named with a placeholder (`Service A`,
  // `Database`, `Step 1`, `TODO`) instead of the real component's name (see
  // `genericLabels.ts`). A warning — a template echo, never blocking.
  | 'W_GENERIC_LABEL'
  // On-disk convention (checked by the CLI — it is path-based, not
  // content-based): kebab-case filenames, at most `docs/<area>/<doc>.md`
  // under the docs root. Always a warning; no flag escalates it.
  | 'W_DOC_CONVENTION'
  // A Markdown link in prose (`[text](#anchor)`, `[text](doc#id)`,
  // `[text](./other.md#anchor)`) whose target doc, block id, or heading id
  // does not exist (see `links.ts` and `resolve.ts`). An error, like
  // E_DANGLING_REF: the built site would 404.
  | 'E_DANGLING_LINK'
  // A diagram is wider than the page can show: past the 1600-unit stage it
  // scrolls sideways, or it shrinks below a readable share of the column
  // (computed by the CLI from the rendered SVG viewBox). Always a warning;
  // the hint names the data fix for the block type.
  | 'W_FIT'
  // Graph lints (see `graphLints.ts`). Pure, high-precision warnings about
  // a diagram's data: a node no edge touches, a group panel with no node in
  // its cells, an edge written twice, a decision with an unlabelled branch,
  // an error edge into the success end, a sequence actor in no message.
  | 'W_ORPHAN_NODE'
  | 'W_EMPTY_GROUP'
  | 'W_DUP_EDGE'
  | 'W_DECISION_LABEL'
  | 'W_ERROR_INTO_SUCCESS'
  | 'W_IDLE_ACTOR'
  // Text copied unchanged from a `chiltepin new` doc template (see
  // `templateEcho.ts`). A warning: the example content was never replaced.
  | 'W_TEMPLATE_ECHO'
  // Prose-lint codes (see `prose/lint.ts`). Warnings by default; the CLI can
  // escalate them under a strict flag.
  | 'W_PROSE_LONG_SENTENCE'
  | 'W_PROSE_LONG_PARAGRAPH'
  | 'W_PROSE_PASSIVE_STEP'
  | 'W_PROSE_TENSE'
  | 'W_PROSE_FILLER_OPENER'
  | 'W_PROSE_TERM_DRIFT';

/**
 * Uniform diagnostic shape.
 *
 * Positions are 1-based. `line`/`column` point at the start of the offending
 * token; `endLine`/`endColumn` bound it when known (for editor underlines).
 * `hint` is a one-line, actionable fix; `suggestions` are "did you mean?"
 * candidates a tool can offer as quick-fixes. All position/help fields are
 * optional so older consumers keep working.
 */
export interface Diagnostic {
  /** File path the diagnostic refers to. */
  readonly file: string;
  /** 1-based line number, if applicable. */
  readonly line?: number;
  /** 1-based column number, if applicable. */
  readonly column?: number;
  /** 1-based end line, if the offending span is known. */
  readonly endLine?: number;
  /** 1-based exclusive end column, if the offending span is known. */
  readonly endColumn?: number;
  readonly level: DiagnosticLevel;
  readonly code: DiagnosticCode;
  /** Human-readable message. */
  readonly message: string;
  /** Offending raw value, where useful (e.g. the bad ref string). */
  readonly value?: string;
  /** One-line actionable fix, shown beneath the message. */
  readonly hint?: string;
  /** "Did you mean?" candidates — a tool may offer these as quick-fixes. */
  readonly suggestions?: readonly string[];
}

/** Base URL for per-code error documentation. */
const ERRORS_BASE = 'https://chiltepin.dev/errors';

/**
 * Returns the documentation URL for a diagnostic code.
 *
 * @param code - The diagnostic code.
 * @returns A stable help URL, e.g. `https://chiltepin.dev/errors/e_schema`.
 */
export function helpUrl(code: DiagnosticCode): string {
  return `${ERRORS_BASE}/${code.toLowerCase()}`;
}

/**
 * Exhaustiveness helper for `switch`/`if-else` chains over discriminated unions.
 * The compiler proves a branch is unreachable; calling this throws at runtime if
 * the proof fails.
 */
export function assertNever(x: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(x)}`);
}
