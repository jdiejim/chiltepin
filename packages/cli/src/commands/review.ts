/**
 * `chiltepin review <file> [-o <dir>] [--json]` — the one review step for an
 * agent (or an author) after every draft.
 *
 * It runs every `check` diagnostic for the file, renders the doc, and looks
 * at every block the way a reader does (`io/review.ts`): light and dark at
 * 1280 px, the whole page at 400 px, and a print pass. Each problem becomes
 * one issue on its block, named in the block's data and paired with the fix
 * in the YAML:
 *
 * - `fit` — the drawing scrolls sideways, shrinks hard, or runs off a phone.
 * - `cut` — text was cut short (`…`), clipped by its box, or runs outside
 *   its node.
 * - `overlap` — text sits on other text, or an edge label sits away from
 *   its line.
 * - `tiny` — text renders under 8 px on a 400 px phone.
 * - `print` — print clips the block's content.
 * - `check` — a `chiltepin check` diagnostic, on the block it points into.
 *
 * It writes `contact-sheet.png` (every block, numbered, light beside dark,
 * issues badged), one PNG per block and theme, the 400 px page, and
 * `review.json`. The exit code is 1 when any issue is an error: a check
 * error, cut text, or text on text.
 */

import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, parse as parsePath, relative, resolve } from 'node:path';
import {
  describeBlockSchema,
  parseDocument,
  type BlockType,
  type Diagnostic,
  type FieldNode,
  type TypedSegment,
} from 'chiltepin-core';
import { GEOMETRY_TYPES, geometryReport, renderDocument, type GeometryReport } from 'chiltepin-render';
import { loadConfig } from '../io/config.js';
import {
  reviewPage,
  writeContactSheet,
  writeReviewJson,
  type MeasuredBlock,
  type RawFinding,
  type SheetTile,
  type TextRef,
} from '../io/review.js';
import { runCheck } from './check.js';
import { fitHint, fitMessage, SMALL_SCALE, STAGE_MAX } from './fit.js';
import { renderFailure } from './renderGuard.js';

/** What kind of problem an issue is. */
export type ReviewKind = 'fit' | 'cut' | 'overlap' | 'tiny' | 'print' | 'check';

/** One problem, in data terms, with its fix. */
export interface ReviewIssue {
  /** 1-based block number on the page; absent for a doc-level check finding. */
  readonly block?: number;
  readonly kind: ReviewKind;
  readonly level: 'error' | 'warn';
  /** What is wrong, naming the part of the data. */
  readonly message: string;
  /** The fix, in the block's YAML. */
  readonly fix: string;
  /** Data path of the part (`nodes.3`, `edges.1`), when one. */
  readonly path?: string;
  /** The part's field the issue is about (`tech`, `label`), when known. */
  readonly field?: string;
  /** Source line (the block's fence, or the diagnostic's line). */
  readonly line?: number;
  /** The diagnostic code, for `check` issues. */
  readonly code?: string;
}

/** One block as the review saw it. */
export interface ReviewBlock {
  readonly index: number;
  readonly type: string;
  /** The block's fence line. */
  readonly line: number;
  readonly id?: string;
  /** Section label, frame tag, figure number, title. */
  readonly label: string;
  readonly tag?: string;
  readonly fig?: string;
  readonly title?: string;
  /** Staged drawing width, and how it sits at the reader's width. */
  readonly width?: number;
  readonly scrolls: boolean;
  readonly scale: number;
  readonly shots: { readonly light: string; readonly dark: string; readonly full?: string };
  readonly issues: readonly ReviewIssue[];
}

/** The whole review. */
export interface ReviewResult {
  readonly file: string;
  readonly dir: string;
  readonly contactSheet: string;
  readonly phone: string;
  readonly json: string;
  readonly blocks: readonly ReviewBlock[];
  /** Every issue, block issues first in block order, then doc-level ones. */
  readonly issues: readonly ReviewIssue[];
  readonly summary: {
    readonly blocks: number;
    readonly errors: number;
    readonly warnings: number;
    readonly kinds: Readonly<Record<string, number>>;
    readonly ms: number;
  };
  readonly exitCode: 0 | 1;
}

/* ── Naming the data ───────────────────────────────────────────────────── */

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : undefined);
const oneLine = (s: string): string => s.replace(/\\n|\n/g, ' ').replace(/\s+/g, ' ').trim();
const quote = (s: string, n = 48): string => {
  const t = oneLine(s);
  return `"${t.length > n ? `${t.slice(0, n - 1)}…` : t}"`;
};

/** Singular noun for a list field (`nodes` → `node`, `entities` → `entity`). */
function singular(list: string): string {
  if (list.endsWith('ies')) return `${list.slice(0, -3)}y`;
  if (list.endsWith('sses')) return list.slice(0, -2);
  if (list === 'classes') return 'class';
  return list.endsWith('s') ? list.slice(0, -1) : list;
}

/** The field names of the items in `list`, from the block's schema. */
function listFields(type: string, list: string): Set<string> {
  const out = new Set<string>();
  const collect = (n: FieldNode): void => {
    if (n.kind === 'object') for (const f of n.fields) out.add(f.name);
    else if (n.kind === 'union') for (const a of n.arms) collect(a);
  };
  try {
    const root = describeBlockSchema(type as BlockType);
    if (root.kind !== 'object') return out;
    const field = root.fields.find((f) => f.name === list)?.node;
    if (field?.kind === 'array') collect(field.element);
  } catch {
    /* an unknown type has no fields to name */
  }
  return out;
}

/** A part of the block's data, from a `data-bp` path. */
interface Part {
  /** `nodes.3`. */
  readonly path: string;
  readonly list: string;
  /** `node`, `edge`, `actor`, … */
  readonly noun: string;
  /** `pg`, `api -> db`, or the first words of the label. */
  readonly name: string;
  readonly item: Rec;
  /** The field named by the path itself (`steps.1.label` → `label`). */
  readonly field?: string;
}

function partOf(data: unknown, bp: string | undefined): Part | undefined {
  if (bp === undefined || !isRec(data)) return undefined;
  const m = /^([A-Za-z]+)\.(\d+)(?:\.([A-Za-z]+))?/.exec(bp);
  if (m === null) return undefined;
  const list = m[1] as string;
  const items = data[list];
  if (!Array.isArray(items)) return undefined;
  const item = items[Number(m[2])];
  if (!isRec(item)) return undefined;
  const from = str(item['from']);
  const to = str(item['to']);
  const name =
    from !== undefined && to !== undefined
      ? `${from} -> ${to}`
      : (str(item['id']) ?? oneLine(str(item['name']) ?? str(item['label']) ?? str(item['title']) ?? `#${m[2] ?? ''}`));
  return {
    path: `${list}.${m[2] ?? ''}`,
    list,
    noun: singular(list),
    name,
    item,
    ...(m[3] !== undefined ? { field: m[3] } : {}),
  };
}

/** Which field of `part` drew `t`: the path's own field, the class, else the text. */
function fieldOf(part: Part, t: TextRef): string | undefined {
  if (part.field !== undefined) return part.field;
  const cls = t.cls ?? '';
  for (const f of ['tech', 'name', 'label', 'desc', 'note', 'sub', 'title', 'event', 'guard']) {
    if (new RegExp(`(?:^|[\\s-])${f}(?:$|[\\s-])`).test(cls) && part.item[f] !== undefined) return f;
  }
  if (/(?:^|[\s-])sub(?:$|[\s-])/.test(cls) && part.item['tech'] !== undefined) return 'tech';
  const seen = oneLine(t.text).replace(/…$/, '').toLowerCase();
  if (seen === '') return undefined;
  for (const [k, v] of Object.entries(part.item)) {
    if (typeof v === 'string' && ['id', 'from', 'to', 'kind'].indexOf(k) < 0 && oneLine(v).toLowerCase().includes(seen)) return k;
  }
  for (const [k, v] of Object.entries(part.item)) {
    if (typeof v === 'string' && ['id', 'from', 'to', 'kind'].indexOf(k) < 0 && seen.startsWith(oneLine(v).toLowerCase().slice(0, 12))) return k;
  }
  return undefined;
}

/** `node \`pg\` tech text`, `edge \`api -> db\` label`, or the text itself. */
function describeText(data: unknown, t: TextRef): { what: string; part?: Part; field?: string } {
  const part = partOf(data, t.bp);
  if (part === undefined) return { what: `the text ${quote(t.text)}` };
  const field = fieldOf(part, t);
  return {
    what: `${part.noun} \`${part.name}\`${field !== undefined ? ` ${field}` : ''} ${quote(t.text, 36)}`,
    part,
    ...(field !== undefined ? { field } : {}),
  };
}

/** The fix for text that does not fit its place. */
function shortenFix(type: string, part: Part | undefined, field: string | undefined): string {
  if (part === undefined) return 'Shorten the text, or split the block.';
  const fields = listFields(type, part.list);
  const f = field ?? (fields.has('label') ? 'label' : fields.has('name') ? 'name' : 'text');
  if (str(part.item['from']) !== undefined && str(part.item['to']) !== undefined) {
    return `Shorten \`${part.path}.${f}\`, and say the detail in the prose under the block.`;
  }
  const into = ['note', 'desc', 'description', 'sub'].find((n) => n !== f && fields.has(n));
  const wider = (f === 'name' || f === 'label') && fields.has('w') && part.item['w'] === undefined;
  const alts = [
    into !== undefined ? `move the detail to \`${into}\`` : undefined,
    wider ? `give the ${part.noun} \`w: 2\`` : undefined,
  ].filter((s): s is string => s !== undefined);
  return `Shorten \`${f}\` on ${part.noun} \`${part.name}\`${alts.length > 0 ? `, or ${alts.join(', or ')}` : ''}.`;
}

/** Lower case, single spaces, no ellipsis or soft breaks: text as compared. */
const flat = (s: string): string =>
  s.replace(/\\n|\n/g, ' ').replace(/…/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

/** The fields of a node or edge whose text should reach the drawing. */
const DRAWN_FIELDS = ['name', 'label', 'tech', 'title', 'event'] as const;

/**
 * A field whose text the drawing does not hold in full, though it holds its
 * first word: the renderer cut it (silently, or with "…"). A field the
 * renderer does not draw at all (no first word) is not reported.
 */
function cutFields(item: Rec, drawn: string): { field: string; value: string; shown: number }[] {
  const out: { field: string; value: string; shown: number }[] = [];
  const page = ` ${flat(drawn)} `;
  for (const field of DRAWN_FIELDS) {
    const value = str(item[field]);
    if (value === undefined) continue;
    const want = flat(value);
    const words = want.split(' ').filter((w) => w !== '');
    if (words.length < 2 || page.includes(` ${want} `) || page.includes(want)) continue;
    if (!page.includes(` ${words[0] ?? ''} `) && !page.includes(` ${words[0] ?? ''}`)) continue;
    // How many leading words did reach the page, in order?
    let n = 0;
    while (n < words.length && page.includes(` ${words.slice(0, n + 1).join(' ')}`)) n++;
    if (n < words.length) out.push({ field, value, shown: n });
  }
  return out;
}

/**
 * How many leading words of `value` survive in a geometry cut message, which
 * quotes the drawn text ending in "…".
 */
function shownWords(value: string, message: string): number {
  const m = /"([^"]*)…"/.exec(message);
  if (m === null) return 0;
  const drawn = `${oneLine(m[1] ?? '')} `;
  const words = oneLine(value).split(' ');
  let n = 0;
  while (n < words.length && drawn.startsWith(`${words.slice(0, n + 1).join(' ')} `)) n++;
  return n;
}

/** Turns one browser finding into issues on its block. */
function issuesOf(seg: TypedSegment, index: number, f: RawFinding): ReviewIssue[] {
  if (f.kind !== 'drawn') {
    const one = issueOf(seg, index, f);
    return one !== undefined ? [one] : [];
  }
  const part = partOf(seg.data, f.bp);
  if (part === undefined) return [];
  return cutFields(part.item, f.text).map((c) => {
    const words = oneLine(c.value).split(' ');
    return {
      block: index,
      line: seg.line,
      kind: 'cut' as const,
      level: 'error' as const,
      message: `${part.noun} \`${part.name}\` ${c.field} ${quote(c.value, 40)} is cut: the drawing shows ${c.shown} of its ${words.length} words`,
      fix: shortenFix(seg.kind, part, c.field),
      path: part.path,
      field: c.field,
    };
  });
}

/** The fix for a diagnostic that carries no hint of its own. */
const CODE_FIX: Readonly<Record<string, string>> = {
  E_DUP_ID: 'Ids are repo-global: rename one of the two `id:` values.',
  E_DANGLING_REF: 'Fix the `ref:` string, or add the `id:` it names to the target block.',
  E_BAD_REF_FORMAT: 'Write the ref as `doc#id` or `#id`.',
  E_UNKNOWN_BLOCK: 'Use one of the block types that `chiltepin block` lists.',
  E_ENCODING: 'Save the file as UTF-8.',
  W_EMPTY_BLOCK: 'Add the block fields, or delete the block.',
  W_ALIAS_TYPE: 'No change is necessary: both spellings work. Use the canonical name in a new block.',
};

/** The fix for a check diagnostic: its hint, else the code's usual fix. */
function diagnosticFix(d: Diagnostic): string {
  return d.hint ?? CODE_FIX[d.code] ?? 'Run `chiltepin check` and read `check.md` for this code.';
}

/** Turns one browser finding into an issue on its block. */
function issueOf(seg: TypedSegment, index: number, f: Exclude<RawFinding, { kind: 'drawn' }>): ReviewIssue | undefined {
  const type = seg.kind;
  const at = { block: index, line: seg.line };
  switch (f.kind) {
    case 'outside':
    case 'clipped':
    case 'ellipsis': {
      const d = describeText(seg.data, f.text);
      // A chip draws the node's `kind`: the renderer owns that text.
      if (/(?:^|[\s-])chip(?:$|[\s-])/.test(f.text.cls ?? '')) return undefined;
      const how =
        f.kind === 'outside'
          ? `runs ${String(f.px)} px outside its box`
          : f.kind === 'clipped'
            ? `is clipped by its box (${String(f.px)} px hidden)`
            : 'is cut short';
      return {
        ...at,
        kind: 'cut',
        level: 'error',
        message: `${d.what} ${how}`,
        fix: shortenFix(type, d.part, d.field),
        ...(d.part !== undefined ? { path: d.part.path } : {}),
        ...(d.field !== undefined ? { field: d.field } : {}),
      };
    }
    case 'overlap': {
      const isChip = (t: TextRef): boolean => /(?:^|[\s-])chip(?:$|[\s-])/.test(t.cls ?? '');
      if (isChip(f.a) !== isChip(f.b)) {
        // A node's own text ran up into its kind chip: the text is too tall.
        const chip = isChip(f.a) ? f.a : f.b;
        const d = describeText(seg.data, isChip(f.a) ? f.b : f.a);
        const fields = d.part !== undefined ? listFields(type, d.part.list) : new Set<string>();
        // Long text that wraps pushes the name up into the chip: the author
        // can fix that. A chip drawn over one short name is the renderer's.
        const long = d.part === undefined
          ? undefined
          : ['tech', 'name', 'label', 'desc'].find((k) => (str(d.part?.item[k]) ?? '').length > 18);
        return {
          ...at,
          kind: 'overlap',
          level: long !== undefined ? 'error' : 'warn',
          message: `${d.what} runs into its ${quote(chip.text)} chip`,
          fix:
            d.part !== undefined && long !== undefined
              ? `Shorten \`${long}\` on ${d.part.noun} \`${d.part.name}\` so it fits on one line${fields.has('w') && d.part.item['w'] === undefined ? `, or give the ${d.part.noun} \`w: 2\`` : ''}.`
              : 'The renderer drew the chip over a short name. No data change fixes it: keep the data as it is.',
          ...(d.part !== undefined ? { path: d.part.path } : {}),
        };
      }
      const a = describeText(seg.data, f.a);
      const b = describeText(seg.data, f.b);
      const isEdge = (x: { part?: Part }): boolean => x.part !== undefined && str(x.part.item['from']) !== undefined;
      const edge = [a, b].find(isEdge);
      const fix =
        isEdge(a) && isEdge(b) && a.part?.path !== b.part?.path
          ? `Two ${a.part?.noun ?? 'edge'}s put their labels in one spot: move one of the boxes they join to another cell (\`col\`/\`row\`), or split the diagram.`
          : edge?.part !== undefined
          ? `Shorten \`${edge.part.path}.${edge.field ?? 'label'}\`, or remove \`col\`/\`row\` so auto-layout gives the edge room.`
          : a.part !== undefined && b.part !== undefined && a.part.path !== b.part.path
            ? `Move \`${b.part.name}\` to a free cell (\`col\`/\`row\`), or shorten one of the texts.`
            : shortenFix(type, a.part, a.field);
      return {
        ...at,
        kind: 'overlap',
        level: 'error',
        message: `${a.what} sits on ${b.what} (${String(f.x)}×${String(f.y)} px)`,
        fix,
        ...(a.part !== undefined ? { path: a.part.path } : {}),
      };
    }
    case 'far-label': {
      const d = describeText(seg.data, f.text);
      return {
        ...at,
        kind: 'overlap',
        level: 'warn',
        message: `${d.what} sits ${String(f.px)} px from its own line, so it reads as another edge's label`,
        fix: `Shorten \`${d.part?.path ?? 'the edge'}.label\`, or remove \`col\`/\`row\` so auto-layout gives the edge room.`,
        ...(d.part !== undefined ? { path: d.part.path } : {}),
      };
    }
  }
}

/** The fix for print clipping, per block type and clipped element. */
function printFix(type: string, cls: string): string {
  if (type === 'code' || /(?:^|-)(?:ex|code|pre|example)$/.test(cls)) return 'Break the long lines of the code or example: print does not scroll.';
  if (type === 'table' || type === 'statustable') return 'Remove a column, or shorten the widest cells.';
  return 'Split the block, or shorten its widest row.';
}

/** The fix for text too small on a phone, per block type. */
function tinyFix(type: string): string {
  if (type === 'flow' || type === 'block' || type === 'c4' || type === 'dfd' || type === 'state' || type === 'felogic') {
    return 'Set `dir: TB` so the drawing is narrow, or split it into two blocks.';
  }
  if (type === 'sequence') return 'Remove actors that take part in one message, or split the sequence at an `alt` frame.';
  return 'Split the block into two, so each draws fewer columns.';
}

/** The typed segments that render as a section, in page order. */
function sectionSegments(segments: readonly TypedSegment[]): TypedSegment[] {
  return segments.filter(
    (s) => s.kind !== 'meta' && s.parseError === undefined && s.data !== undefined && s.data !== null,
  );
}

/** The last line of a block (its closing fence). */
function lastLine(seg: TypedSegment): number {
  return seg.line + seg.raw.split('\n').length + 1;
}

/* ── The run ───────────────────────────────────────────────────────────── */

/** Runs the review of one document. */
export async function runReview(opts: {
  readonly cwd: string;
  readonly input: string;
  /** Output folder; defaults to `<tmp>/chiltepin-review/<slug>`. */
  readonly output?: string;
  readonly log?: (message: string) => void;
}): Promise<ReviewResult> {
  const started = Date.now();
  const inputAbs = resolve(opts.cwd, opts.input);
  const file = relative(opts.cwd, inputAbs) || opts.input;
  const source = await readFile(inputAbs, 'utf8');
  const slug = parsePath(inputAbs).name;
  const config = await loadConfig(opts.cwd);
  const doc = parseDocument(source, slug);

  // Every `check` diagnostic for this file (links resolve against the docs folder).
  const check = await runCheck({ patterns: [inputAbs], cwd: opts.cwd, docsRoot: config.docsDir });
  const diagnostics: Diagnostic[] = check.diagnostics.filter((d) => resolve(opts.cwd, d.file) === inputAbs);

  let html: string;
  try {
    html = renderDocument(doc, { colorScheme: config.colorScheme });
  } catch (err) {
    const d = renderFailure(doc, file, 'page', err);
    const where = d.line !== undefined ? `${d.file}:${String(d.line)}` : d.file;
    throw new Error(`${where}  ${d.message}`, { cause: err });
  }

  const dir = opts.output !== undefined ? resolve(opts.cwd, opts.output) : join(tmpdir(), 'chiltepin-review', slug);
  const page = await reviewPage(html, dir, {
    prefix: slug,
    autoInstallBrowser: true,
    ...(opts.log !== undefined ? { log: opts.log } : {}),
  });

  const segs = sectionSegments(doc.segments.filter((s): s is TypedSegment => s.kind !== 'markdown'));
  const geometryTypes = new Set<string>(GEOMETRY_TYPES);
  const used = new Set<Diagnostic>();
  const blocks: ReviewBlock[] = [];

  page.blocks.forEach((m: MeasuredBlock, i) => {
    const seg = (m.blockId !== undefined ? segs.find((s) => s.id === m.blockId) : undefined) ?? segs[i];
    if (seg === undefined) return;
    const issues: ReviewIssue[] = [];
    const at = { block: m.index, line: seg.line };

    // Check diagnostics that point into this block. A W_FIT is replaced by
    // the measured fit below; a cut label from the geometry report becomes a
    // `cut` issue.
    const inBlock = diagnostics.filter((d) => d.line !== undefined && d.line >= seg.line && d.line <= lastLine(seg));
    let geometry: GeometryReport | undefined;
    if (geometryTypes.has(seg.kind)) {
      try {
        geometry = (geometryReport as (t: string, d: unknown) => GeometryReport)(seg.kind, seg.data);
      } catch {
        geometry = undefined;
      }
    }
    const cutPaths = new Set<string>();
    const geometryMessages: string[] = [];
    for (const g of geometry?.issues ?? []) {
      if ((g.kind as string) !== 'label-truncated') continue;
      if (g.path !== undefined) cutPaths.add(g.path);
      geometryMessages.push(g.message);
      // Name the part in data terms when the path points at one field of it.
      const part = partOf(seg.data, g.path);
      const field = part?.field;
      const value = part !== undefined && field !== undefined ? str(part.item[field]) : undefined;
      if (part !== undefined && field !== undefined && value !== undefined) {
        cutPaths.add(`${part.path}.${field}`);
        const words = oneLine(value).split(' ');
        issues.push({
          ...at,
          kind: 'cut',
          level: 'error',
          message: `${part.noun} \`${part.name}\` ${field} ${quote(value, 40)} is cut: the drawing shows ${shownWords(value, g.message)} of its ${words.length} words`,
          fix: shortenFix(seg.kind, part, field),
          path: part.path,
          field,
        });
      } else {
        issues.push({ ...at, kind: 'cut', level: 'error', message: g.message, fix: g.hint, ...(g.path !== undefined ? { path: g.path } : {}) });
      }
      const twin = inBlock.find((d) => d.code === 'W_GEOMETRY' && d.message.endsWith(g.message));
      if (twin !== undefined) used.add(twin);
    }
    for (const d of inBlock) {
      used.add(d);
      if (d.code === 'W_FIT') continue;
      if (d.code === 'W_GEOMETRY' && geometryMessages.some((msg) => d.message.endsWith(msg))) continue;
      if (d.code === 'W_GEOMETRY' && issues.some((x) => d.message.endsWith(x.message))) continue;
      issues.push({
        block: m.index,
        kind: 'check',
        level: d.level,
        message: `${d.code} ${d.message}`,
        fix: diagnosticFix(d),
        ...(d.value !== undefined && /^[a-z]+\.\d+/i.test(d.value) ? { path: d.value } : {}),
        ...(d.line !== undefined ? { line: d.line } : {}),
        code: d.code,
      });
    }

    // Fit, as measured at the reader's width.
    const small = !m.scrolls && m.scale < SMALL_SCALE;
    if ((m.scrolls || small) && m.width !== undefined) {
      issues.push({
        ...at,
        kind: 'fit',
        level: 'warn',
        message: fitMessage({ width: m.width, scrolls: m.scrolls, scale: Math.round(m.scale * 100) / 100, small }),
        fix: fitHint(seg.kind),
      });
    } else if (m.phoneOverflow !== undefined) {
      issues.push({
        ...at,
        kind: 'fit',
        level: 'warn',
        message: `the block runs ${String(m.phoneOverflow)} px past a 400 px phone screen, so the page scrolls sideways`,
        fix: /table|cvt|matrix|statustable|spec|scorecard|options/.test(seg.kind)
          ? 'Remove a column, or move long cell text to the prose under the table.'
          : fitHint(seg.kind),
      });
    }

    // What the reader pass saw. One issue per part and kind.
    const seen = new Set<string>();
    // A silent cut (`drawn`) comes before the "…" finding of the same part.
    const ordered = [...m.findings].sort((a, b) => (a.kind === 'drawn' ? 0 : 1) - (b.kind === 'drawn' ? 0 : 1));
    for (const f of ordered) {
      for (const issue of issuesOf(seg, m.index, f)) {
        if (
          issue.kind === 'cut' &&
          issue.path !== undefined &&
          (cutPaths.has(issue.path) || (issue.field !== undefined && cutPaths.has(`${issue.path}.${issue.field}`)))
        ) {
          continue;
        }
        const key =
          issue.path !== undefined
            ? `${issue.kind}\u0000${issue.path}\u0000${issue.field ?? ''}`
            : `${issue.kind}\u0000${issue.message}`;
        if (seen.has(key)) continue;
        seen.add(key);
        issues.push(issue);
      }
    }

    if (m.tiny !== undefined) {
      issues.push({
        ...at,
        kind: 'tiny',
        level: 'warn',
        message: `its main text renders under 8 px on a 400 px phone (${String(m.tiny.count)} text${m.tiny.count === 1 ? '' : 's'}, smallest ${String(m.tiny.min)} px, ${quote(m.tiny.sample, 30)})`,
        fix: tinyFix(seg.kind),
      });
    }
    if (m.print !== undefined && m.print.length > 0) {
      const worst = m.print.reduce((a, b) => (b.px > a.px ? b : a));
      issues.push({
        ...at,
        kind: 'print',
        level: 'warn',
        message: `print clips ${String(worst.px)} px of \`.${worst.cls}\`${m.print.length > 1 ? ` (and ${String(m.print.length - 1)} more)` : ''}`,
        fix: printFix(seg.kind, worst.cls),
      });
    }

    blocks.push({
      index: m.index,
      type: seg.sourceType ?? seg.kind,
      line: seg.line,
      ...(seg.id !== undefined ? { id: seg.id } : {}),
      label: m.label !== '' ? m.label : seg.kind,
      ...(m.tag !== undefined ? { tag: m.tag } : {}),
      ...(m.fig !== undefined ? { fig: m.fig } : {}),
      ...(m.title !== undefined ? { title: m.title } : {}),
      ...(m.width !== undefined ? { width: m.width } : {}),
      scrolls: m.scrolls,
      scale: m.scale,
      shots: m.shots,
      // Errors first: they are the ones to fix before anything else.
      issues: [...issues].sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1)),
    });
  });

  // Diagnostics outside every block: prose, the meta block, the file itself.
  const docIssues: ReviewIssue[] = diagnostics
    .filter((d) => !used.has(d))
    .map((d) => ({
      kind: 'check' as const,
      level: d.level,
      message: `${d.code} ${d.message}`,
      fix: diagnosticFix(d),
      ...(d.line !== undefined ? { line: d.line } : {}),
      code: d.code,
    }));

  const issues = [
    ...blocks.flatMap((b) => b.issues),
    ...[...docIssues].sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1)),
  ];
  const errors = issues.filter((x) => x.level === 'error').length;
  const kinds: Record<string, number> = {};
  for (const x of issues) kinds[x.kind] = (kinds[x.kind] ?? 0) + 1;

  const contactSheet = join(dir, 'contact-sheet.png');
  const tiles: SheetTile[] = blocks.map((b) => ({
    index: b.index,
    caption: [b.tag ?? b.label, b.title].filter((s) => s !== undefined && s !== '').join(' · '),
    light: b.shots.light,
    dark: b.shots.dark,
    errors: b.issues.filter((x) => x.level === 'error').length,
    warnings: b.issues.filter((x) => x.level === 'warn').length,
    kinds: [...new Set(b.issues.map((x) => (x.kind === 'check' ? (x.code ?? 'check') : x.kind)))],
    notes: [...b.issues]
      .sort((x, y) => (x.level === y.level ? 0 : x.level === 'error' ? -1 : 1))
      .map((x) => ({ level: x.level, text: `${x.kind === 'check' ? (x.code ?? 'check') : x.kind} — ${issueText(x)}` })),
  }));
  const summaryLine = `${String(blocks.length)} blocks · ${String(errors)} error(s) · ${String(issues.length - errors)} warning(s) · light | dark at ${String(1280)} px`;
  await writeContactSheet(contactSheet, file, summaryLine, tiles, {
    autoInstallBrowser: true,
    ...(opts.log !== undefined ? { log: opts.log } : {}),
  });

  const json = join(dir, 'review.json');
  const result: ReviewResult = {
    file,
    dir,
    contactSheet,
    phone: page.phone,
    json,
    blocks,
    issues,
    summary: { blocks: blocks.length, errors, warnings: issues.length - errors, kinds, ms: Date.now() - started },
    exitCode: errors > 0 ? 1 : 0,
  };
  await writeReviewJson(json, result);
  return result;
}

/* ── Output ────────────────────────────────────────────────────────────── */

/** An issue's message without its code prefix or a closing full stop. */
function issueText(x: ReviewIssue): string {
  const msg = x.kind === 'check' && x.code !== undefined && x.message.startsWith(`${x.code} `) ? x.message.slice(x.code.length + 1) : x.message;
  return msg.replace(/[.\s]+$/, '');
}

/** `block 3 · FLOW · Request path`, the block's name in every issue line. */
export function blockName(b: Pick<ReviewBlock, 'index' | 'tag' | 'label' | 'fig' | 'title'>): string {
  return ['block ' + String(b.index), b.fig, b.tag ?? b.label, b.title].filter((s) => s !== undefined && s !== '').join(' · ');
}

/** Paint helpers; identity when output must stay plain. */
export interface Paint {
  readonly red: (s: string) => string;
  readonly yellow: (s: string) => string;
  readonly green: (s: string) => string;
  readonly dim: (s: string) => string;
  readonly bold: (s: string) => string;
  readonly cyan: (s: string) => string;
}

const PLAIN: Paint = { red: (s) => s, yellow: (s) => s, green: (s) => s, dim: (s) => s, bold: (s) => s, cyan: (s) => s };

/**
 * The review as text: a header, one line per issue (block, kind, what, and
 * the fix), and where the images are. Grep-friendly: every issue line starts
 * with `error` or `warn`.
 */
export function formatReview(r: ReviewResult, paint: Paint = PLAIN): string {
  const lines: string[] = [];
  const secs = (r.summary.ms / 1000).toFixed(1);
  const head =
    r.summary.errors > 0
      ? paint.red(`✗ ${String(r.summary.errors)} error(s)`)
      : paint.green('✓ no errors');
  lines.push(
    `${paint.bold('review')} ${r.file}  ${head} ${paint.dim(`· ${String(r.summary.warnings)} warning(s) · ${String(r.summary.blocks)} blocks · ${secs}s`)}`,
  );
  const byIndex = new Map(r.blocks.map((b) => [b.index, b]));
  const width = Math.max(4, ...r.issues.map((x) => (x.kind === 'check' ? (x.code ?? 'check') : x.kind).length));
  for (const x of r.issues) {
    const lvl = x.level === 'error' ? paint.red('error') : paint.yellow('warn ');
    const b = x.block !== undefined ? byIndex.get(x.block) : undefined;
    const where = b !== undefined ? blockName(b) : `line ${String(x.line ?? 1)}`;
    const kind = x.kind === 'check' ? (x.code ?? 'check') : x.kind;
    lines.push(`${lvl}  ${paint.cyan(kind.padEnd(width))}  ${paint.bold(where)} — ${issueText(x)}. ${paint.dim('Fix:')} ${x.fix}`);
  }
  if (r.issues.length === 0) lines.push(paint.green('  Every block fits, nothing is cut, no text overlaps. Look at the contact sheet once.'));
  lines.push('');
  lines.push(`${paint.dim('contact sheet')}  ${r.contactSheet}`);
  lines.push(`${paint.dim('blocks       ')}  ${r.dir} ${paint.dim(`(one PNG per block, light and dark · ${parsePath(r.phone).base} · review.json)`)}`);
  lines.push(
    paint.dim(
      r.summary.errors > 0
        ? 'Fix the errors in the YAML, then run `chiltepin review` again. Open the contact sheet to see each block.'
        : 'Open the contact sheet and look at each block before you hand the doc off.',
    ),
  );
  return lines.join('\n') + '\n';
}

/** Re-exported for `shots`: the thresholds both commands share. */
export { SMALL_SCALE, STAGE_MAX };
