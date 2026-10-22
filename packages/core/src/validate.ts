/**
 * Validates a parsed {@link Document} against the block schemas and reports
 * structured {@link Diagnostic}s for malformed YAML, schema violations, suspect
 * fence tags, and empty bodies.
 *
 * Diagnostics carry precise positions (line + column within the document),
 * a one-line actionable `hint`, and "did you mean?" `suggestions` where a fix
 * is mechanically derivable — so the CLI and editors can show teachable errors
 * and offer quick-fixes.
 */

import type { z } from 'zod';
import type { Diagnostic } from './diagnostics.js';
import type { Document } from './types.js';
import { blockRegistry } from './blocks/registry.js';
import { NOT_FINITE_MESSAGE } from './blocks/schemas.js';
import { BLOCK_ALIASES } from './blocks/aliases.js';
import { DIALECT_PARSE_CODE, DIALECT_PARSE_HINT, isDialectSource } from './dialects.js';
import { fieldNamesAt } from './blocks/schema-walk.js';
import { resolveSwimlaneLane } from './blocks/swimlaneLayout.js';
import { TERSE_HINTS } from './blocks/contract.js';
import { locateYamlPath } from './yaml.js';
import { closest } from './suggest.js';
import type { BlockType } from './types.js';

interface IssueRender {
  readonly message: string;
  readonly hint?: string;
  readonly suggestions?: readonly string[];
}

/**
 * Turns a single zod issue into a message + actionable hint + suggestions.
 * Handles the common cases precisely; everything else falls back to the zod
 * message with a generic hint.
 */
function renderIssue(kind: BlockType, issue: z.ZodIssue): IssueRender {
  const path = issue.path.join('.');
  const at = path.length > 0 ? `${path}: ` : '';

  if (issue.code === 'unrecognized_keys') {
    const bad = issue.keys[0] ?? '';
    const valid = fieldNamesAt(kind, issue.path);
    const suggestions = closest(bad, valid, 3);
    const did = suggestions.length > 0 ? `Did you mean \`${suggestions[0]}\`? ` : '';
    // A "field" with a space in it, or one that starts like a number, is
    // almost always a value that an unquoted comma inside `{ … }` split into
    // a second key (`sub: managed, 2 nodes` → keys `sub` and `2 nodes`).
    const split = issue.keys.some((k) => /\s/.test(k) || /^\d/.test(k));
    const trap = split
      ? 'An unquoted comma inside `{ … }` splits one value into two keys — quote the value (`sub: "managed, 2 nodes"`). '
      : '';
    return {
      message: `${kind}: unknown field${issue.keys.length > 1 ? 's' : ''} ${issue.keys.map((k) => `'${k}'`).join(', ')}`,
      hint: `${trap}${did}Valid fields: ${valid.join(', ')}.`,
      ...(suggestions.length > 0 ? { suggestions } : {}),
    };
  }

  if (issue.code === 'invalid_enum_value') {
    const options = issue.options.map(String);
    const received = String(issue.received);
    const suggestions = closest(received, options, 3);
    const did = suggestions.length > 0 ? ` Did you mean \`${suggestions[0]}\`?` : '';
    return {
      message: `${kind}: ${at}invalid value "${received}"`,
      hint: `Use one of: ${options.join(' | ')}.${did}`,
      ...(suggestions.length > 0 ? { suggestions } : {}),
    };
  }

  if (issue.code === 'invalid_type') {
    // The classic "I wrote a number, the schema wants a string" trap.
    if (issue.expected === 'string' && issue.received === 'number') {
      return {
        message: `${kind}: ${at}expected a string but got a number`,
        hint: 'Quote the value to keep it a string (e.g. tech: "16").',
      };
    }
    // Grid coordinates, cell spans and draw counts are whole numbers: a
    // fraction of a cell has no position and half a row cannot be drawn.
    if (issue.expected === 'integer') {
      return {
        message: `${kind}: ${at}expected a whole number, got ${issue.received === 'float' ? 'a fraction' : String(issue.received)}`,
        hint: 'Coordinates, spans and counts are whole numbers. Round the value.',
      };
    }
    // A string where a list wants an object: the author reached for a terse
    // spelling the grammar does not have. Name the spellings that exist.
    if (issue.expected === 'object' && issue.received === 'string') {
      const listPath = issue.path.filter((seg): seg is string => typeof seg === 'string');
      const terse = TERSE_HINTS[kind]?.[listPath.join('.')];
      return {
        message: `${kind}: ${at}expected ${issue.expected}, got ${issue.received}`,
        hint:
          terse !== undefined
            ? `The only terse form here is ${terse}. Anything else needs the object form (\`chiltepin block ${kind}\`).`
            : `This list has no terse string form — use the object form (\`chiltepin block ${kind}\`).`,
      };
    }
    return {
      message: `${kind}: ${at}expected ${issue.expected}, got ${issue.received}`,
    };
  }

  return { message: `${kind}: ${at}${issue.message}` };
}

/**
 * Flattens `invalid_union` issues into the issues of the arm that fits best
 * (the arm with the FEWEST issues — a message with a typo'd field is "a
 * message with one unknown key", not "not a frame"). Every other issue passes
 * through. Recursive: a union arm may itself contain a union.
 */
function flattenIssues(issues: readonly z.ZodIssue[]): z.ZodIssue[] {
  const out: z.ZodIssue[] = [];
  for (const issue of issues) {
    if (issue.code !== 'invalid_union') {
      out.push(issue);
      continue;
    }
    let best: z.ZodIssue[] | undefined;
    for (const err of issue.unionErrors) {
      const arm = flattenIssues(err.issues);
      if (best === undefined || arm.length < best.length) best = arm;
    }
    out.push(...(best ?? [issue]));
  }
  return out;
}

/**
 * Drops the consequences of a non-finite number, keeping the cause.
 *
 * `.inf` fails `.finite()`, `.int()` and every `.max()` at once, so one typo
 * would report three times on one line. When a path carries the non-finite
 * issue, it is the only issue reported for that path.
 */
function dropNonFiniteFollowOns(issues: readonly z.ZodIssue[]): z.ZodIssue[] {
  const nonFinite = new Set(
    issues.filter((i) => i.message === NOT_FINITE_MESSAGE).map((i) => i.path.join('.')),
  );
  if (nonFinite.size === 0) return [...issues];
  return issues.filter(
    (i) => i.message === NOT_FINITE_MESSAGE || !nonFinite.has(i.path.join('.')),
  );
}

/** True when a sequence `messages` item is a frame marker of the given key. */
function hasKey(item: unknown, key: string): boolean {
  return typeof item === 'object' && item !== null && !Array.isArray(item) && key in item;
}

/**
 * Sequence frame markers must nest: every `else` / `end` needs an open frame
 * and every frame needs its `end`. Warnings only — the renderer still draws
 * an unclosed frame to the last row and ignores a stray marker.
 */
function lintSequenceFrames(
  seg: { readonly data: unknown; readonly raw: string; readonly line: number },
  file: string,
  positioned: boolean,
): Diagnostic[] {
  const data = seg.data;
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return [];
  const messages = (data as Record<string, unknown>)['messages'];
  if (!Array.isArray(messages)) return [];

  const at = (i: number): { line: number; column?: number } => {
    const loc = positioned ? locateYamlPath(seg.raw, ['messages', i]) : undefined;
    return loc !== undefined
      ? { line: seg.line + loc.line, column: loc.column }
      : { line: seg.line };
  };
  const warn = (i: number, message: string, hint: string, value: string): Diagnostic => ({
    file,
    ...at(i),
    level: 'warn',
    code: 'W_SEQ_FRAME',
    message,
    hint,
    value,
  });

  const out: Diagnostic[] = [];
  const open: Array<{ readonly i: number; readonly kind: string }> = [];
  messages.forEach((item, i) => {
    if (hasKey(item, 'frame')) {
      open.push({ i, kind: String((item as Record<string, unknown>)['frame']) });
    } else if (hasKey(item, 'else')) {
      if (open.length === 0) {
        out.push(
          warn(
            i,
            `sequence: messages[${i}] is an \`else\` with no open frame`,
            'Add a frame line before it (`- alt: condition`), or remove the `else`.',
            'else',
          ),
        );
      }
    } else if (hasKey(item, 'end')) {
      if (open.length === 0) {
        out.push(
          warn(
            i,
            `sequence: messages[${i}] is an \`end\` with no open frame`,
            'Remove the `end`, or add the frame line it closes (`- alt: condition`).',
            'end',
          ),
        );
      } else {
        open.pop();
      }
    }
  });
  for (const f of open) {
    out.push(
      warn(
        f.i,
        `sequence: the \`${f.kind}\` frame at messages[${f.i}] is never closed`,
        'Add `- end` after the last message of the frame.',
        f.kind,
      ),
    );
  }
  return out;
}

/** A grid group as the nesting lint reads it (the shared `gridGroupSchema` shape). */
interface GroupCells {
  readonly id?: string;
  readonly parent?: string;
  readonly col: number;
  readonly row: number;
  readonly cols?: number;
  readonly rows?: number;
}

/** The fix for a YAML parse failure, from the shape of the parser's message. */
function yamlParseHint(message: string): string {
  if (/flow sequence/i.test(message)) {
    return 'Inside `[ … ]` quote any cell that contains `[` `]` `{` `}` `,` or `:` — `"variants[]"`, `"1:N"`.';
  }
  if (/flow map|end with a \}/i.test(message)) {
    return 'An inline `{ … }` map must close with `}` on the same line. Use block style (one field per line) for a long item.';
  }
  if (/nested mappings are not allowed in compact mappings/i.test(message)) {
    // The parser quotes the offending line under its header; a `- ` item is a
    // terse line, anything else is a field whose value carries `: `.
    const excerpt = message.split('\n').map((l) => l.trim()).find((l, i) => i > 0 && l.length > 0) ?? '';
    return excerpt.startsWith('- ')
      ? 'A terse line cannot carry a `key: value` pair after its text. Write the whole item in the object form `{ … }` or keep to the terse grammar (`chiltepin block <type>`).'
      : 'A value with `: ` in it must be quoted — `note: "pass retryOn: () => true"`.';
  }
  if (/unexpected scalar at node end/i.test(message)) {
    return 'A value that starts with a quote must be quoted whole — write `note: "\\"Needs\\" lists …"` or wrap the entire value in single quotes.';
  }
  if (/mapping values are not allowed/i.test(message)) {
    return 'A value with `: ` in it must be quoted — `label: "GET /x: cached"`.';
  }
  return 'Often an unquoted special character (, : # | & *). Wrap the value in quotes.';
}

/**
 * The lens-repeat lint: one document that draws the same structural block
 * three or more times is almost always one shape reached for by habit
 * (a third `callout`, a fourth `sequence`). Tables, code and the cover are
 * exempt: rows and snippets repeat by nature. One warning per repeated type,
 * on its third occurrence, with the alternatives that usually fit.
 */
const LENS_EXEMPT: ReadonlySet<string> = new Set([
  'meta', 'table', 'code', 'prose', 'divider', 'figure', 'pullquote',
  // One block per item by nature: a route, an event, a story, a pattern, a screen.
  'endpoint', 'eventcontract', 'userstory', 'pattern', 'wireframe', 'persona', 'modelcard',
]);
/** The habit block warns on its third use; every other lens on its fourth. */
const LENS_LIMIT: Readonly<Record<string, number>> = { callout: 3 };
const LENS_ALTERNATIVES: Readonly<Record<string, string>> = {
  callout: '`list`, `spec`, `faq`, `glossary`, or `takeaways` carry several points better than a row of callouts',
  sequence: 'one `sequence` per question; a second interaction is often a `flow`, a `swimlane`, or an `alt` frame in the first',
  flow: 'a second decision tree is often the `state` of one object or a `swimlane` when owners differ',
  block: 'one topology per doc; a second view is a `c4` level, a `cluster`, or a `table` of parts',
  stats: 'merge the KPIs into one `stats` row, or use a `table` when they need a column each',
  spec: 'one `spec` per contract; several become a `table` or a `glossary`',
  steps: 'one procedure per `steps`; a second is a `checklist`, a `flow`, or a `swimlane`',
};
function isPlainRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function lintLensRepeat(doc: Document, file: string): Diagnostic[] {
  const seen = new Map<string, number>();
  const out: Diagnostic[] = [];
  // An API reference (three or more endpoint / eventcontract cards) carries
  // one sequence per route by design — the importer writes exactly that.
  const apiCards = doc.segments.filter((s) => s.kind === 'endpoint' || s.kind === 'eventcontract').length;
  for (const seg of doc.segments) {
    if (seg.kind === 'markdown' || LENS_EXEMPT.has(seg.kind)) continue;
    const data = isPlainRecord(seg.data) ? seg.data : {};
    // A sequence that documents one route (it carries `endpoint:`) is one
    // per route, like the endpoint card itself.
    if (seg.kind === 'sequence' && (apiCards >= 3 || data['endpoint'] !== undefined)) continue;
    // A chart kind, a block preset, or a variant is its own lens: a bar
    // chart next to a pareto and a histogram repeats nothing. So is a C4
    // level, and a C4 dynamic view: the zoom from context to components
    // is one story told at four levels.
    const c4Lens =
      seg.kind === 'c4'
        ? Array.isArray(data['edges']) && data['edges'].some((e) => isPlainRecord(e) && e['step'] !== undefined)
          ? 'dynamic'
          : data['level']
        : undefined;
    const facet = data['kind'] ?? data['preset'] ?? data['variant'] ?? c4Lens;
    const key = typeof facet === 'string' ? `${seg.kind}:${facet}` : seg.kind;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    if (n !== (LENS_LIMIT[seg.kind] ?? 4)) continue;
    const alt = LENS_ALTERNATIVES[seg.kind] ?? 'a different block usually answers the third question better — `chiltepin block` lists the families';
    out.push({
      file,
      line: seg.line,
      level: 'warn',
      code: 'W_LENS_REPEAT',
      message: `${seg.kind}: ${n === 3 ? 'third' : 'fourth'} \`${seg.kind}\` block in this document`,
      hint: `${alt}. Merge, or change the lens.`,
    });
  }
  return out;
}

/**
 * C4 notation: every relationship names its intent, and container-level
 * lines name their technology. An unlabelled `c4` edge is a warning that says
 * which one and what to add; the renderer still draws the arrow.
 */
function lintEdgeLabels(
  seg: { readonly data: unknown; readonly raw: string; readonly line: number },
  file: string,
  positioned: boolean,
): Diagnostic[] {
  const data = seg.data;
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return [];
  const edges = (data as Record<string, unknown>)['edges'];
  if (!Array.isArray(edges)) return [];
  const level = (data as Record<string, unknown>)['level'];
  const out: Diagnostic[] = [];
  edges.forEach((e, i) => {
    if (typeof e !== 'object' || e === null || Array.isArray(e)) return;
    const edge = e as { from?: unknown; to?: unknown; label?: unknown; tech?: unknown };
    const label = typeof edge.label === 'string' ? edge.label.trim() : '';
    if (label.length > 0) return;
    const loc = positioned ? locateYamlPath(seg.raw, ['edges', i]) : undefined;
    out.push({
      file,
      ...(loc !== undefined ? { line: seg.line + loc.line, column: loc.column } : { line: seg.line }),
      level: 'warn',
      code: 'W_EDGE_LABEL',
      message: `c4: the relationship ${String(edge.from)} → ${String(edge.to)} has no label`,
      hint:
        level === 'container' || level === 'component'
          ? 'C4 asks every line to say what crosses it and, at container level, over what (`label: reads orders`, `tech: HTTPS/JSON`).'
          : 'C4 asks every line to say what crosses it — a verb phrase, not "uses" (`label: places orders`).',
      value: `${String(edge.from)} -> ${String(edge.to)}`,
    });
  });
  return out;
}

/**
 * A swimlane step's `lane` must name a lane: a label or `id` (matched
 * case-insensitively, trimmed) or a 0-based index inside `lanes`. An error —
 * the step has nowhere to be drawn — that lists the lanes it could name.
 */
function lintSwimlaneLanes(
  seg: { readonly data: unknown; readonly raw: string; readonly line: number },
  file: string,
  positioned: boolean,
): Diagnostic[] {
  const data = seg.data;
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return [];
  const rec = data as Record<string, unknown>;
  const steps = Array.isArray(rec['steps']) ? rec['steps'] : [];
  const lanes = (Array.isArray(rec['lanes']) ? rec['lanes'] : []).filter(
    (l): l is { id?: string; label: string } =>
      typeof l === 'object' && l !== null && typeof (l as { label?: unknown }).label === 'string',
  );
  const names = lanes.map((l) => l.label).join(', ');
  const out: Diagnostic[] = [];
  steps.forEach((st, i) => {
    if (typeof st !== 'object' || st === null || Array.isArray(st)) return;
    const step = st as { id?: unknown; lane?: unknown };
    const lane = step.lane;
    if (typeof lane !== 'string' && typeof lane !== 'number') return;
    if (resolveSwimlaneLane(lane, lanes) !== undefined) return;
    const loc = positioned ? locateYamlPath(seg.raw, ['steps', i, 'lane']) : undefined;
    const id = String(step.id ?? i);
    const message =
      lanes.length === 0
        ? `swimlane: step ${id} has a lane, but the block declares no lanes`
        : typeof lane === 'string'
          ? `swimlane: step ${id} names lane "${lane}", which is not one of the lanes`
          : `swimlane: step ${id} has lane ${String(lane)}, but there are ${String(lanes.length)} lanes (0–${String(lanes.length - 1)})`;
    out.push({
      file,
      ...(loc !== undefined ? { line: seg.line + loc.line, column: loc.column } : { line: seg.line }),
      level: 'error',
      code: 'E_SWIMLANE_LANE',
      message,
      hint:
        lanes.length === 0
          ? 'Add `lanes:` — one label per owner — then name a lane by its label (`lane: Sales`).'
          : `Lanes: ${names}. Name one by its label or id (case-insensitive), or by its 0-based index.`,
      value: String(lane),
    });
  });
  return out;
}

/**
 * Nested grid groups (`groups[].parent`) must resolve to a sibling `id`, and
 * a child's cell range must sit inside its parent's. Warnings only — the
 * renderer still draws both panels; the author moves the cells.
 */
function lintGroupNesting(
  seg: { readonly data: unknown; readonly raw: string; readonly line: number },
  file: string,
  positioned: boolean,
): Diagnostic[] {
  const data = seg.data;
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return [];
  const groups = (data as Record<string, unknown>)['groups'];
  if (!Array.isArray(groups)) return [];
  const list = groups.filter(
    (g): g is GroupCells => typeof g === 'object' && g !== null && !Array.isArray(g),
  );
  if (!list.some((g) => g.parent !== undefined)) return [];

  const byId = new Map<string, GroupCells>();
  for (const g of list) if (g.id !== undefined) byId.set(g.id, g);
  const warn = (i: number, message: string, hint: string, value: string): Diagnostic => {
    const loc = positioned ? locateYamlPath(seg.raw, ['groups', i, 'parent']) : undefined;
    return {
      file,
      ...(loc !== undefined ? { line: seg.line + loc.line, column: loc.column } : { line: seg.line }),
      level: 'warn',
      code: 'W_GROUP_NESTING',
      message,
      hint,
      value,
    };
  };

  const out: Diagnostic[] = [];
  list.forEach((g, i) => {
    if (g.parent === undefined) return;
    const p = byId.get(g.parent);
    if (p === undefined || p === g) {
      out.push(
        warn(
          i,
          `groups[${i}] names parent \`${g.parent}\`, which is not another group's id`,
          'Give the parent group an `id` and reference it, or remove `parent`.',
          g.parent,
        ),
      );
      return;
    }
    const inside =
      g.col >= p.col &&
      g.row >= p.row &&
      g.col + (g.cols ?? 1) <= p.col + (p.cols ?? 1) &&
      g.row + (g.rows ?? 1) <= p.row + (p.rows ?? 1);
    if (!inside) {
      out.push(
        warn(
          i,
          `groups[${i}] is not inside its parent \`${g.parent}\` (cells ${g.col},${g.row} +${g.cols ?? 1}×${g.rows ?? 1} vs ${p.col},${p.row} +${p.cols ?? 1}×${p.rows ?? 1})`,
          'Move the child inside the parent cell range, or grow the parent `cols` / `rows`.',
          g.parent,
        ),
      );
    }
  });
  return out;
}

/**
 * The trailing ATX heading of a prose run, if the run ends with one (ignoring
 * trailing blank lines). Returns the heading text and its 0-based line offset
 * within the run.
 *
 * Exported for the renderer: a prose run that ends with a heading TITLES the
 * block that follows — the section head suppresses a near-duplicate block
 * `title`, and a title-less block inherits the heading for the sections nav.
 */
/**
 * Heading markers — `## Title {split}`, `{top}`, `{source: …}`.
 *
 * They are authored on the heading but belong to the SLIDE, not to the text,
 * so every consumer strips them before displaying a title. One definition
 * here, because the renderer, the deck and the nav all have to agree: a marker
 * that one of them fails to strip shows up verbatim in front of a reader.
 */
const ALIGN_MARKER = /\s*\{(top|center|middle|bottom|split)\}\s*$/i;
const SOURCE_MARKER = /\s*\{source:\s*([^}]+)\}\s*$/i;
/** `{nobuild}` — the deck shows this slide's diagrams whole, with no step-through reveal. */
const BUILD_MARKER = /\s*\{nobuild\}\s*$/i;

/** The heading text with any trailing markers removed. */
export function stripHeadingMarkers(text: string): string {
  let out = text;
  for (let pass = 0; pass < 4; pass++) {
    const next = out.replace(SOURCE_MARKER, '').replace(ALIGN_MARKER, '').replace(BUILD_MARKER, '');
    if (next === out) break;
    out = next;
  }
  return out.replace(/\s+$/, '');
}

/** True when the heading carries the `{nobuild}` marker (in any position among the trailing markers). */
export function readBuildMarker(text: string): boolean {
  let out = text;
  for (let pass = 0; pass < 4; pass++) {
    if (BUILD_MARKER.test(out)) return true;
    const next = out.replace(SOURCE_MARKER, '').replace(ALIGN_MARKER, '');
    if (next === out) break;
    out = next;
  }
  return false;
}

/** The `{source: …}` marker's text, if the heading carries one. */
export function readSourceMarker(text: string): string | undefined {
  const m = SOURCE_MARKER.exec(text);
  return m === null ? undefined : (m[1] ?? '').trim();
}

/** The `{top|center|bottom|split}` marker, if the heading carries one. */
export function readAlignMarker(text: string): string | undefined {
  // The source and build markers may sit outside it: `## T {top} {source: x}`.
  const m = ALIGN_MARKER.exec(text.replace(SOURCE_MARKER, '').replace(BUILD_MARKER, '').replace(SOURCE_MARKER, ''));
  return m === null ? undefined : (m[1] ?? '').toLowerCase();
}

export function trailingHeading(text: string): { readonly text: string; readonly offset: number } | undefined {
  const lines = text.split('\n');
  let i = lines.length - 1;
  while (i >= 0 && (lines[i] ?? '').trim() === '') i--;
  if (i < 0) return undefined;
  const m = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec((lines[i] ?? '').trim());
  if (m === null) return undefined;
  return { text: stripHeadingMarkers((m[1] ?? '').trim()), offset: i };
}

/** Lowercases and strips punctuation/whitespace so near-duplicates compare equal. */
function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

/**
 * True when a markdown heading and the following block's title read as the
 * same thing: equal after normalization, or one contains the other. Mere
 * adjacency with different texts never fires.
 *
 * Used by the renderer to suppress a block title under a same-text heading
 * ("the heading titles the block"), and by generators (e.g. the CLI's OpenAPI
 * importer) to avoid emitting a redundant title in the first place.
 */
export function isNearDuplicateTitle(heading: string, title: string): boolean {
  const a = normalizeTitle(heading);
  const b = normalizeTitle(title);
  if (a.length === 0 || b.length === 0) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * Validates a document. Returns diagnostics — never throws for expected failures.
 *
 * @param doc - The parsed document.
 * @param file - The file path to use in diagnostics.
 */
export function validateDocument(doc: Document, file: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Note on heading/title adjacency: a prose run that ends with a heading
  // TITLES the block that follows — the renderer suppresses a near-duplicate
  // block `title` (and a title-less block inherits the heading in the sections
  // nav), so duplication is healed at render time rather than warned about
  // here (the old W_DUP_HEADING).

  // Suspect fence tags (typos of real block types) → warnings.
  for (const sf of doc.suspectFences ?? []) {
    diagnostics.push({
      file,
      line: sf.line,
      column: 1,
      level: 'warn',
      code: 'W_SUSPECT_BLOCK',
      message: `Unknown block type "${sf.tag}" — rendered as plain text`,
      hint: `Did you mean \`\`\`${sf.suggestion}? Use one of the documented block types.`,
      value: sf.tag,
      suggestions: [sf.suggestion],
    });
  }

  for (const seg of doc.segments) {
    if (seg.kind === 'markdown') continue;

    // Alias fences: informational nudge toward the canonical spelling.
    // A warning only — warnings never fail `chiltepin check`. A dialect fence
    // (mermaid / dbml / prisma) is not an alias (`BLOCK_ALIASES` has no entry
    // for it by design) — it never warns.
    const dialect = isDialectSource(seg.sourceType) ? seg.sourceType : undefined;
    // A dialect body has no YAML positions — its diagnostics sit on the fence.
    const isMermaid = dialect !== undefined;
    if (seg.sourceType !== undefined && dialect === undefined) {
      const alias = BLOCK_ALIASES[seg.sourceType];
      if (alias !== undefined) {
        const patch = Object.entries(alias.patch ?? {})
          .map(([k, v]) => `${k}: ${String(v)}`)
          .join(', ');
        const target = patch.length > 0 ? `\`${alias.type}\` (${patch})` : `\`${alias.type}\``;
        diagnostics.push({
          file,
          line: seg.line,
          column: 1,
          level: 'warn',
          code: 'W_ALIAS_TYPE',
          message: `\`${seg.sourceType}\` now lives in ${target} — both spellings work; no change needed`,
          value: seg.sourceType,
          suggestions: [alias.type],
        });
      }
    }

    if (seg.parseError !== undefined) {
      // Translate body-relative parse position to a document-absolute one.
      const line =
        seg.parseErrorLine !== undefined ? seg.line + seg.parseErrorLine : seg.line;
      diagnostics.push({
        file,
        line,
        ...(seg.parseErrorColumn !== undefined ? { column: seg.parseErrorColumn } : {}),
        level: 'error',
        code: dialect !== undefined ? DIALECT_PARSE_CODE[dialect] : 'E_PARSE_YAML',
        message: `${seg.kind}: ${seg.parseError}`,
        hint: dialect !== undefined ? DIALECT_PARSE_HINT[dialect] : yamlParseHint(seg.parseError),
      });
      continue;
    }

    if (seg.data === null || seg.data === undefined) {
      diagnostics.push({
        file,
        line: seg.line,
        level: 'warn',
        code: 'W_EMPTY_BLOCK',
        message: `${seg.kind}: empty body`,
        hint: 'Add the fields this block needs, or remove the block.',
      });
      continue;
    }

    const def = blockRegistry[seg.kind];
    // `id` is an envelope concern handled by the parser; strip it before
    // per-schema validation so strict schemas don't flag it as unknown.
    const dataForSchema =
      typeof seg.data === 'object' && !Array.isArray(seg.data) && 'id' in seg.data
        ? Object.fromEntries(
            Object.entries(seg.data as Record<string, unknown>).filter(([k]) => k !== 'id'),
          )
        : seg.data;
    const result = def.schema.safeParse(dataForSchema);
    if (result.success && seg.kind === 'sequence') {
      diagnostics.push(...lintSequenceFrames(seg, file, !isMermaid));
    }
    if (result.success) {
      diagnostics.push(...lintGroupNesting(seg, file, !isMermaid));
      if (seg.kind === 'c4') diagnostics.push(...lintEdgeLabels(seg, file, !isMermaid));
      if (seg.kind === 'swimlane') diagnostics.push(...lintSwimlaneLanes(seg, file, !isMermaid));
    }
    if (!result.success) {
      for (const issue of dropNonFiniteFollowOns(flattenIssues(result.error.issues))) {
        const rendered = renderIssue(seg.kind, issue);
        // Point at the offending token. For a missing required field the exact
        // path won't resolve, so fall back to the containing object/array. A
        // Mermaid body has no YAML positions — its diagnostics sit on the fence.
        const loc = isMermaid
          ? undefined
          : (locateYamlPath(seg.raw, issue.path) ??
            (issue.path.length > 0
              ? locateYamlPath(seg.raw, issue.path.slice(0, -1))
              : undefined));
        const position =
          loc !== undefined
            ? {
                line: seg.line + loc.line,
                column: loc.column,
                ...(loc.endColumn !== undefined ? { endColumn: loc.endColumn } : {}),
              }
            : { line: seg.line };
        diagnostics.push({
          file,
          ...position,
          level: 'error',
          code: 'E_SCHEMA',
          message: rendered.message,
          ...(rendered.hint !== undefined ? { hint: rendered.hint } : {}),
          ...(rendered.suggestions !== undefined ? { suggestions: rendered.suggestions } : {}),
        });
      }
    }
  }

  diagnostics.push(...lintLensRepeat(doc, file));
  return diagnostics;
}
