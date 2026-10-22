/**
 * `lintGenericLabels` — placeholder names on diagram nodes and actors.
 *
 * Pure analysis, no I/O: takes a {@link Document}, returns {@link Diagnostic}s
 * (always level `warn`, code `W_GENERIC_LABEL`). A node called `Service A`,
 * `Database`, or `Step 1` is a template echo: the writer filled a shape
 * instead of naming the component from the request. The warning names the
 * label and asks for the real name.
 *
 * Deliberately narrow, to keep false positives low: only the whole label is
 * tested, so `Orders API` and `API Gateway` pass and only a bare `API` warns.
 * Only architecture and flow diagrams are read — an algorithm `graph` names
 * its nodes `A`, `B`, `C` by design. Like `lintDensity`, it runs beside
 * `validateDocument` (the CLI's `check` calls both), so the block catalog's
 * grammar examples stay clean while a doc that copies one is flagged.
 */

import type { Diagnostic } from './diagnostics.js';
import type { BlockType, Document, Segment } from './types.js';
import { isDialectSource } from './dialects.js';
import { locateYamlPath } from './yaml.js';

/** One list of named items in a block: where the items live and which field names them. */
interface LabelField {
  /** Top-level list field (e.g. `nodes`). */
  readonly list: string;
  /** Field on each item that holds the visible name (e.g. `label`). */
  readonly field: string;
  /** Singular noun for the message (e.g. `node`). */
  readonly what: string;
  /**
   * A group panel's label. `Backend` or `Services` is a fair name for a
   * panel, so a group is held only to the editor placeholders and the
   * `TODO` markers, never to the bare-word list.
   */
  readonly panel?: boolean;
}

/** The `groups[].label` of a grid diagram. */
const GROUP_LABEL: LabelField = { list: 'groups', field: 'label', what: 'group', panel: true };

/** The diagram blocks this lint reads, and the field that names each drawn item. */
export const GENERIC_LABEL_FIELDS: Readonly<Partial<Record<BlockType, readonly LabelField[]>>> = {
  sequence: [{ list: 'actors', field: 'name', what: 'actor' }],
  flow: [{ list: 'nodes', field: 'label', what: 'node' }, GROUP_LABEL],
  block: [{ list: 'nodes', field: 'name', what: 'node' }, GROUP_LABEL],
  c4: [{ list: 'nodes', field: 'name', what: 'node' }, GROUP_LABEL],
  dfd: [{ list: 'nodes', field: 'name', what: 'node' }, GROUP_LABEL],
  felogic: [GROUP_LABEL],
  state: [GROUP_LABEL],
  cluster: [{ list: 'services', field: 'label', what: 'service' }],
  swimlane: [{ list: 'steps', field: 'label', what: 'step' }],
};

/** Whole labels that name no real component (compared lower-case, spaces collapsed). */
const BARE_PLACEHOLDERS: ReadonlySet<string> = new Set([
  'service',
  'component',
  'module',
  'node',
  'server',
  'backend',
  'back end',
  'back-end',
  'frontend',
  'front end',
  'front-end',
  'database',
  'db',
  'api',
  'foo',
  'bar',
  'baz',
  'qux',
  'lorem',
  'tbd',
  'tbc',
  'placeholder',
  'untitled',
  'thing',
  'something',
]);

/** `Service A`, `Service 1`, `Step 2`, `Component B` — a generic noun plus a letter or a counter. */
const NUMBERED_PLACEHOLDER =
  /^(service|component|module|node|server|step|box|process|system|thing|item|actor|entity|database|db)\s*(?:[a-z]|\d{1,3})$/i;
/**
 * `TODO`, `TBD: pick a queue`, `FIXME (owner)`, `lorem ipsum …`. The markers
 * are upper-case only, so a to-do app's `Todo API` stays a real name.
 */
const MARKER_PLACEHOLDER =
  /^(?:(?:TODO|TBD|TBC|FIXME|XXX)(?:\s*[:(\u2013\u2014-].*)?|[Ll]orem ipsum\b.*)$/;
/** A single letter (`X`, `A`) or punctuation only (`...`, `…`, `???`, `-`). */
const SYMBOL_PLACEHOLDER = /^(?:[a-z]|[\p{P}\p{S}\s]+)$/iu;

/**
 * The name an editor gives a new item: `New node`, `New database`, `New group
 * 3`. Studio writes `New <noun>` with the list's singular noun or the picked
 * kind; nobody renamed it. The noun must be one of those words, so a real
 * name that starts with "New" (`New Zendesk ticket`, `New Relic`, `New York
 * office`) never matches.
 */
const EDITOR_PLACEHOLDER = /^new ([a-z][a-z ]*?)(?: \d+)?$/i;
const EDITOR_NOUNS: ReadonlySet<string> = new Set([
  // Structural nouns: the singular of each list an editor appends to.
  'node', 'group', 'actor', 'step', 'state', 'service', 'process', 'item', 'column', 'stage',
  'edge', 'link', 'lane', 'entity', 'table', 'class', 'package', 'case', 'part', 'member',
  'term', 'question', 'takeaway', 'stat', 'tag', 'body', 'cluster', 'message', 'transition',
  'phase', 'boundary', 'layer', 'area', 'row', 'field', 'task', 'block', 'component', 'module',
  'decision', 'action', 'event', 'container', 'system', 'person', 'external', 'element',
  'paragraph', 'key result', 'relationship', 'flow', 'store', 'datastore', 'subnet', 'zone',
  // Node kinds an editor picks from (generic words only, no product names).
  'database', 'db', 'queue', 'cache', 'topic', 'worker', 'function', 'gateway', 'bucket',
  'stream', 'consumer', 'producer', 'client', 'user', 'browser', 'mobile', 'server', 'host',
  'agent', 'llm', 'model', 'tool', 'memory', 'human', 'guard', 'eval', 'prompt', 'vector',
  'proxy', 'lb', 'cdn', 'dns', 'firewall', 'monitor', 'scheduler', 'job', 'warehouse',
  'ingress', 'pod', 'deployment', 'secret', 'webhook', 'notification', 'start', 'end',
]);

/** True for an editor's placeholder name (`New node`, `New group 3`). */
function isEditorPlaceholder(s: string): boolean {
  const m = EDITOR_PLACEHOLDER.exec(s);
  return m?.[1] !== undefined && EDITOR_NOUNS.has(m[1].trim().toLowerCase());
}

/**
 * True when a label is a bare placeholder rather than a component's name.
 *
 * @param label - The visible name of a node, actor, or step.
 */
export function isGenericLabel(label: string): boolean {
  const s = label.trim().replace(/\s+/g, ' ');
  if (s.length === 0) return false;
  return (
    BARE_PLACEHOLDERS.has(s.toLowerCase()) ||
    NUMBERED_PLACEHOLDER.test(s) ||
    MARKER_PLACEHOLDER.test(s) ||
    SYMBOL_PLACEHOLDER.test(s) ||
    isEditorPlaceholder(s)
  );
}

/**
 * True when a group panel's label is a placeholder: an editor default
 * (`New group`) or a `TODO`/`TBD` marker. Bare words (`Backend`, `Services`)
 * are fair panel names and pass.
 *
 * @param label - The visible label of a group panel.
 */
export function isPlaceholderGroupLabel(label: string): boolean {
  const s = label.trim().replace(/\s+/g, ' ');
  return s.length > 0 && (isEditorPlaceholder(s) || MARKER_PLACEHOLDER.test(s));
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Checks the named items of every architecture and flow diagram. Returns one
 * `W_GENERIC_LABEL` warning per distinct placeholder label in a block — never
 * errors, never throws on odd data.
 *
 * @param doc - The parsed document (same input as `validateDocument`).
 * @param file - The file path to use in diagnostics.
 */
export function lintGenericLabels(doc: Document, file: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const seg of doc.segments as readonly Segment[]) {
    if (seg.kind === 'markdown') continue;
    if (seg.parseError !== undefined || !isRecord(seg.data)) continue;
    const fields = GENERIC_LABEL_FIELDS[seg.kind];
    if (fields === undefined) continue;
    // A dialect body (mermaid) has no YAML positions; its findings sit on the fence.
    const positioned = !isDialectSource(seg.sourceType);
    const seen = new Set<string>();

    for (const { list, field, what, panel } of fields) {
      const items = seg.data[list];
      if (!Array.isArray(items)) continue;
      items.forEach((item, i) => {
        if (!isRecord(item)) return;
        const label = item[field];
        if (typeof label !== 'string') return;
        if (!(panel === true ? isPlaceholderGroupLabel(label) : isGenericLabel(label))) return;
        const key = `${what}\u0000${label.trim().toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);
        const loc = positioned
          ? (locateYamlPath(seg.raw, [list, i, field]) ?? locateYamlPath(seg.raw, [list, i]))
          : undefined;
        diagnostics.push({
          file,
          ...(loc !== undefined
            ? { line: seg.line + loc.line, column: loc.column }
            : { line: seg.line }),
          level: 'warn',
          code: 'W_GENERIC_LABEL',
          message: `${seg.kind}: the ${what} "${label.trim()}" has a placeholder name`,
          hint:
            panel === true
              ? 'Name the boundary the panel draws (for example `Region · eu-west-1` or `Payments team`), or delete the group.'
              : isEditorPlaceholder(label.trim())
                ? 'The editor wrote this default name. Rename it to the real component (for example `orders-db`), or delete the item and its edges.'
                : 'Use the name of the real component from the request (for example `Orders API` or `ledger-db`). ' +
                  'If the request names no component, ask, or state the name as an assumption in the doc.',
          value: label.trim(),
        });
      });
    }
  }

  return diagnostics;
}
