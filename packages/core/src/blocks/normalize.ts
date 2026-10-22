/**
 * Input normalization — YAML sugar + scalar coercion.
 *
 * Called by `parseDocument` after YAML parse and alias patching, before the
 * segment is stored — so validate / render / studio / MCP all see the
 * canonical object shape. Input-only: the file keeps the author's terse form;
 * only the in-memory `data` is expanded.
 *
 * Sugar grammars (string items expand to objects; object items pass through;
 * non-matching strings pass through untouched and surface as schema errors —
 * the object form is the escape hatch for exotic ids):
 *
 * YAML wrinkle: written unquoted, `a -> b: label` is not a string — YAML
 * parses it as the single-pair mapping `{ 'a -> b': 'label' }`. The sugar
 * therefore also rescues single-pair mappings whose KEY carries the grammar
 * signature (an arrow, a crow's-foot operator, a `·`/status-bracket), by
 * reconstructing `key: value` and expanding that. Real object forms
 * (`{ from: a, to: b }`) never match a signature and pass through untouched.
 *
 * - sequence.messages / flow.edges / graph.edges / block.edges:
 *   `from -> to: label` — split on the FIRST `:`; arrows: `->` plain,
 *   `-->` response (sequence) / dashed (edges), `-x->` error. Sequence only:
 *   `-> +to` / `--> -to` activation signs, and the frame markers
 *   `alt: label` / `opt` / `loop` / `par` / `break` / `critical` / `else:
 *   label` / `end`. Block only: a leading `3. ` sets the edge's `step`.
 * - erd.relations: `user ||--o{ order: places` — crow's-foot cardinality
 *   (`||--||` 1:1 · `||--o{` 1:N · `}o--||` N:1 · `}o--o{` N:M · `||--o|`
 *   0..1); a `..` body (`||..o{`) is non-identifying; plain `->` is accepted
 *   with no cardinality.
 * - erd.entities[].columns: `email text unique !null default=now()`,
 *   `user_id uuid fk -> users.id`, `status enum(open,closed)` — see
 *   `erdColumnGrammar`.
 * - timeline.items: `[done] 2026-07 · label · desc` — optional leading
 *   status bracket, then 1 (label) / 2 (date · label) / 3 (date · label ·
 *   desc) `·`-separated parts.
 *
 * Coercion: at positions whose schema is a bare `z.string()` (never a union
 * with number/boolean — see `stringOnlyAt`), scalar numbers/booleans become
 * their string form, killing the "expected string, received number" trap for
 * values like `tech: 16`. Union positions (table cells, stats.value,
 * endpoint status, dfd num) keep their numbers.
 */

import { stringify as stringifyYaml } from 'yaml';
import type { BlockType } from '../types.js';
import { fieldNamesAt, stringOnlyAt } from './schema-walk.js';

/** Arrow head: `from -> to`, longest arrow first so `-->` never parses as `-` + `->`. */
const ARROW_RE = /^(\S+?)\s*(-x->|-->|->)\s*(\S+)$/;

/**
 * Sequence arrow head: `from -> to` with an optional activation sign before
 * the target — `A -> +B` opens a bar on B, `B --> -A` closes the bar on the
 * SENDER (Mermaid's convention: the `-` rides on the reply that leaves the
 * bar). The sign never becomes part of `to`.
 */
const SEQ_ARROW_RE = /^(\S+?)\s*(-x->|-->|->)\s*([+-]?)([^\s+-]\S*)$/;

/** Frame markers: the six combined-fragment kinds, plus `else` and `end`. */
const FRAME_HEAD_RE = /^(alt|opt|loop|par|break|critical|else|end)$/;

/**
 * ERD head: `from <op> to` — a crow's-foot operator (every Mermaid end:
 * `||` `|o` `}o` `}|` on the left, `||` `o|` `o{` `|{` on the right, with a
 * `--` identifying or `..` non-identifying body) or a plain `->`.
 */
const ERD_RE = /^(\S+?)\s*((?:\|\||\|o|\}o|\}\|)(?:--|\.\.)(?:\|\||o\||o\{|\|\{)|->)\s*(\S+)$/;

/**
 * Crow's-foot operator → `{ card, identifying }`. The left end says whether
 * `from` is one or many; the right end says the same for `to`, and an `o`
 * on the right (`o|`, `o{`) makes `to` optional (`0..1` / `0..N`) when `from`
 * is one. A `..` body is a non-identifying relation (dashed).
 */
function cardOf(op: string): { card?: string; identifying?: false } {
  if (op === '->') return {};
  const body = op.includes('..') ? '..' : '--';
  const [left, right] = op.split(body) as [string, string];
  const fromMany = left.startsWith('}');
  const toMany = right.endsWith('{');
  const toOptional = right.startsWith('o');
  // `||--o{` stays `1:N` (the documented spelling of one-to-many); only a
  // one-to-one with an optional `to` (`||--o|`) reads as `0..1`.
  const card = fromMany ? (toMany ? 'N:M' : 'N:1') : toMany ? '1:N' : toOptional ? '0..1' : '1:1';
  return { card, ...(body === '..' ? { identifying: false as const } : {}) };
}

/** Optional leading `[status]` bracket of a timeline item string. */
const STATUS_BRACKET_RE = /^\[([^\]]*)\]\s*/;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Splits `s` on its FIRST `:` into a head and an optional trimmed label. A
 * label in one pair of matching quotes loses them: a whole terse line quoted
 * for YAML (`'a -> b: "yes"'`) reads the same as the mapping form.
 */
function splitLabel(s: string): { readonly head: string; readonly label?: string } {
  const i = s.indexOf(':');
  if (i === -1) return { head: s.trim() };
  let label = s.slice(i + 1).trim();
  const q = label[0];
  if (label.length >= 2 && (q === '"' || q === "'") && label.endsWith(q)) label = label.slice(1, -1).trim();
  return { head: s.slice(0, i).trim(), ...(label.length > 0 ? { label } : {}) };
}

/**
 * A sequence `messages` item from its terse string:
 *
 * - `Client -> Server: request` → a message (`-->` response, `-x->` error;
 *   `-> +B` sets `activate`, `--> -A` sets `deactivate`);
 * - `alt: token valid` / `opt` / `loop: every 5s` / `par` / `break` /
 *   `critical` → a frame open (`{ frame, label? }`);
 * - `else: expired` → a frame else; a bare `end` → a frame end.
 */
function messageFromString(s: string): unknown {
  const { head, label } = splitLabel(s);
  if (FRAME_HEAD_RE.test(head)) {
    if (head === 'end') return { end: true };
    if (head === 'else') return label !== undefined ? { else: label } : s; // label required
    return { frame: head, ...(label !== undefined ? { label } : {}) };
  }
  const m = SEQ_ARROW_RE.exec(head);
  if (m === null) return s;
  const [, from, arrow, sign, to] = m as unknown as [string, string, string, string, string];
  const kind = arrow === '-->' ? 'response' : arrow === '-x->' ? 'error' : undefined;
  return {
    from,
    to,
    ...(label !== undefined ? { label } : {}),
    ...(kind !== undefined ? { kind } : {}),
    ...(sign === '+' ? { activate: true } : {}),
    ...(sign === '-' ? { deactivate: true } : {}),
  };
}

/** `a -> b: label` → an edge (`-->` dashed, `-x->` error). */
function edgeFromString(s: string): unknown {
  const { head, label } = splitLabel(s);
  const m = ARROW_RE.exec(head);
  if (m === null) return s;
  const [, from, arrow, to] = m as unknown as [string, string, string, string];
  const kind = arrow === '-->' ? 'dashed' : arrow === '-x->' ? 'error' : undefined;
  return {
    from,
    to,
    ...(label !== undefined ? { label } : {}),
    ...(kind !== undefined ? { kind } : {}),
  };
}

/** `user ||--o{ order: places` → an ERD relation with crow's-foot cardinality. */
function relationFromString(s: string): unknown {
  const { head, label } = splitLabel(s);
  const m = ERD_RE.exec(head);
  if (m === null) return s;
  const [, from, op, to] = m as unknown as [string, string, string, string];
  return {
    from,
    to,
    ...(label !== undefined ? { label } : {}),
    ...cardOf(op),
  };
}

/** `[done] 2026-07 · label · desc` → a timeline item. */
function timelineItemFromString(s: string): unknown {
  let rest = s.trim();
  let status: string | undefined;
  const b = STATUS_BRACKET_RE.exec(rest);
  if (b !== null) {
    status = (b[1] ?? '').trim();
    rest = rest.slice(b[0].length);
  }
  const parts = rest
    .split('·')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) return s; // nothing usable — schema error explains
  const withStatus = status !== undefined && status.length > 0 ? { status } : {};
  if (parts.length === 1) return { label: parts[0], ...withStatus };
  if (parts.length === 2) return { date: parts[0], label: parts[1], ...withStatus };
  return {
    date: parts[0],
    label: parts[1],
    desc: parts.slice(2).join(' · '),
    ...withStatus,
  };
}

/**
 * One sugar grammar: the string expander, its "this key is terse" signature,
 * and — the inverse — a {@link Grammar.contract} that writes the canonical
 * object back as the terse string.
 *
 * `contract` is a BEST GUESS. It never has to be careful: every contraction is
 * accepted only when `expand(contract(v))` deep-equals `v`
 * ({@link contractTerseValue}), so an item carrying anything the grammar
 * cannot say — a `summary`, a `note`, a `kind` no arrow spells, an id the
 * grammar would re-split — falls back to the object form on its own.
 */
interface Grammar {
  /** Expands a terse string; returns the input unchanged when it doesn't match. */
  readonly expand: (s: string) => unknown;
  /** True when a single-pair mapping KEY carries this grammar's operators. */
  readonly signature: (key: string) => boolean;
  /**
   * The terse string for a canonical item, or `undefined` when the grammar
   * has no spelling for it. Never trusted on its own — see the note above.
   */
  readonly contract?: (value: Record<string, unknown>) => string | undefined;
}

/** True when `v` has no keys outside `allowed`. */
function onlyKeys(v: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(v).every((k) => allowed.includes(k));
}

/** A defined string field, or `undefined` (a non-string kills the contraction). */
function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

/** `head` plus `: label` when there is a label. */
function withLabel(head: string, label: unknown): string | undefined {
  if (label === undefined) return head;
  const s = str(label);
  return s === undefined ? undefined : `${head}: ${s}`;
}

const MESSAGE_KEYS = ['from', 'to', 'label', 'kind', 'activate', 'deactivate'];
const ARROW_FOR_MESSAGE: Readonly<Record<string, string>> = { response: '-->', error: '-x->' };

/** The inverse of {@link messageFromString}. */
function messageToString(v: Record<string, unknown>): string | undefined {
  if (v['end'] === true) return onlyKeys(v, ['end']) ? 'end' : undefined;
  if (v['else'] !== undefined) {
    return onlyKeys(v, ['else']) ? withLabel('else', v['else']) : undefined;
  }
  const frame = str(v['frame']);
  if (frame !== undefined) {
    return onlyKeys(v, ['frame', 'label']) ? withLabel(frame, v['label']) : undefined;
  }
  const from = str(v['from']);
  const to = str(v['to']);
  if (from === undefined || to === undefined || !onlyKeys(v, MESSAGE_KEYS)) return undefined;
  const kind = v['kind'];
  const arrow = kind === undefined ? '->' : ARROW_FOR_MESSAGE[String(kind)];
  if (arrow === undefined) return undefined; // sync / async / note have no arrow
  if (v['activate'] === true && v['deactivate'] === true) return undefined;
  const sign = v['activate'] === true ? '+' : v['deactivate'] === true ? '-' : '';
  return withLabel(`${from} ${arrow} ${sign}${to}`, v['label']);
}

const ARROW_FOR_EDGE: Readonly<Record<string, string>> = { dashed: '-->', error: '-x->' };

/** The inverse of {@link edgeFromString}. */
function edgeToString(v: Record<string, unknown>): string | undefined {
  const from = str(v['from']);
  const to = str(v['to']);
  if (from === undefined || to === undefined) return undefined;
  if (!onlyKeys(v, ['from', 'to', 'label', 'kind'])) return undefined;
  const kind = v['kind'];
  const arrow = kind === undefined ? '->' : ARROW_FOR_EDGE[String(kind)];
  if (arrow === undefined) return undefined;
  return withLabel(`${from} ${arrow} ${to}`, v['label']);
}

const arrowGrammar = (expand: (s: string) => unknown): Grammar => ({
  expand,
  signature: (key) => ARROW_RE.test(key),
  contract: edgeToString,
});
const messageGrammar: Grammar = {
  expand: messageFromString,
  // `- alt: token valid` / `- else: expired` / `- end: true` are single-pair
  // maps too — their key is the frame keyword.
  signature: (key) => SEQ_ARROW_RE.test(key) || FRAME_HEAD_RE.test(key),
  contract: messageToString,
};
const edgeGrammar: Grammar = arrowGrammar(edgeFromString);

/**
 * A numbered `block` edge: `3. api -> cache: read` — a leading `N.` is the
 * request `step`. Before this form a head with a space before the arrow never
 * parsed, so no older line changes meaning. A line whose rest is not an edge
 * (`3. -> api`, an edge from the node `3.`) keeps the plain reading.
 */
const STEP_PREFIX_RE = /^(\d+)\.\s+(\S.*)$/;

function stepEdgeFromString(s: string): unknown {
  const m = STEP_PREFIX_RE.exec(s.trim());
  if (m === null) return edgeFromString(s);
  const out = edgeFromString(m[2] as string);
  if (typeof out === 'string' || !isPlainObject(out)) return edgeFromString(s);
  return { ...out, step: Number(m[1]) };
}

const stepEdgeGrammar: Grammar = {
  expand: stepEdgeFromString,
  signature: (key) => {
    const m = STEP_PREFIX_RE.exec(key.trim());
    return ARROW_RE.test(key) || (m !== null && ARROW_RE.test(m[2] as string));
  },
  contract: (v) => {
    const { step, ...rest } = v;
    if (step === undefined) return edgeToString(rest);
    if (typeof step !== 'number' || !Number.isInteger(step) || step < 1) return undefined;
    const edge = edgeToString(rest);
    return edge === undefined ? undefined : `${step}. ${edge}`;
  },
};

/** Cardinality → the crow's-foot operator that {@link cardOf} reads back. */
const CARD_OPS: Readonly<Record<string, string>> = {
  '1:1': '||--||',
  '1:N': '||--o{',
  'N:1': '}o--||',
  'N:M': '}o--o{',
  '0..1': '||--o|',
};

const relationGrammar: Grammar = {
  expand: relationFromString,
  signature: (key) => ERD_RE.test(key),
  contract: (v) => {
    const from = str(v['from']);
    const to = str(v['to']);
    if (from === undefined || to === undefined) return undefined;
    if (!onlyKeys(v, ['from', 'to', 'label', 'card', 'identifying'])) return undefined;
    const card = v['card'];
    const ident = v['identifying'];
    let op: string;
    if (card === undefined) {
      if (ident !== undefined) return undefined; // `->` says nothing about it
      op = '->';
    } else {
      const base = CARD_OPS[String(card)];
      if (base === undefined) return undefined;
      if (ident === true) return undefined; // `--` leaves `identifying` unset
      op = ident === false ? base.replace('--', '..') : base;
    }
    return withLabel(`${from} ${op} ${to}`, v['label']);
  },
};

/** `parts` joined with the ` · ` separator every dot grammar reads. */
function dotJoin(parts: ReadonlyArray<string | undefined>): string | undefined {
  return parts.some((p) => p === undefined) ? undefined : (parts as string[]).join(' · ');
}

/** `[status] ` when there is one. */
function bracket(status: unknown): string | undefined {
  if (status === undefined) return '';
  const s = str(status);
  return s === undefined ? undefined : `[${s}] `;
}

const timelineGrammar: Grammar = {
  expand: timelineItemFromString,
  signature: (key) => STATUS_BRACKET_RE.test(key) || key.includes('·'),
  contract: (v) => {
    if (!onlyKeys(v, ['date', 'label', 'desc', 'status'])) return undefined;
    const label = str(v['label']);
    const head = bracket(v['status']);
    if (label === undefined || head === undefined) return undefined;
    const parts: Array<string | undefined> = [];
    if (v['date'] !== undefined) parts.push(str(v['date']));
    parts.push(label);
    if (v['desc'] !== undefined) parts.push(str(v['desc']));
    const body = dotJoin(parts);
    return body === undefined ? undefined : head + body;
  },
};

/** Span head: `service/id` — the first `/` splits the lane from the id. */
const SPAN_HEAD_RE = /^([^/\s:]+)\/(\S+)$/;

/** A finite number written as a plain token (`0`, `12.5`). */
function numberToken(s: string | undefined): number | undefined {
  if (s === undefined || s.length === 0) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * `service/id: name · start · duration [· parent]` → a span. The head names
 * the lane and the id; the body is the span name, its offset, its length, and
 * an optional parent id. Anything the grammar can't read stays a string and
 * surfaces as a schema error.
 */
function spanFromString(s: string): unknown {
  const { head, label } = splitLabel(s);
  const m = SPAN_HEAD_RE.exec(head);
  if (m === null || label === undefined) return s;
  const parts = label
    .split('·')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length < 3 || parts.length > 4) return s;
  const start = numberToken(parts[1]);
  const duration = numberToken(parts[2]);
  if (start === undefined || duration === undefined) return s;
  const parent = parts[3];
  return {
    id: m[2],
    service: m[1],
    name: parts[0],
    start,
    duration,
    ...(parent !== undefined ? { parent } : {}),
  };
}
const spanGrammar: Grammar = {
  expand: spanFromString,
  signature: (key) => SPAN_HEAD_RE.test(key),
  contract: (v) => {
    if (!onlyKeys(v, ['id', 'service', 'name', 'start', 'duration', 'parent'])) return undefined;
    const id = str(v['id']);
    const service = str(v['service']);
    const name = str(v['name']);
    const start = v['start'];
    const duration = v['duration'];
    if (id === undefined || service === undefined || name === undefined) return undefined;
    if (typeof start !== 'number' || typeof duration !== 'number') return undefined;
    const parts: Array<string | undefined> = [name, String(start), String(duration)];
    if (v['parent'] !== undefined) parts.push(str(v['parent']));
    const body = dotJoin(parts);
    return body === undefined ? undefined : `${service}/${id}: ${body}`;
  },
};

/** A traffic share token: `10%`, `2.5%`. */
const TRAFFIC_RE = /^(\d+(?:\.\d+)?)\s*%$/;

/**
 * `[status] traffic% · name · duration — gate` → a rollout stage. The bracket,
 * the traffic share, the duration, and the gate are all optional; the name is
 * the first part that is not a percentage.
 */
function rolloutStageFromString(s: string): unknown {
  let rest = s.trim();
  let status: string | undefined;
  const b = STATUS_BRACKET_RE.exec(rest);
  if (b !== null) {
    status = (b[1] ?? '').trim();
    rest = rest.slice(b[0].length);
  }
  let gate: string | undefined;
  const dash = rest.indexOf(' — ');
  if (dash !== -1) {
    gate = rest.slice(dash + 3).trim();
    rest = rest.slice(0, dash);
  }
  const parts = rest
    .split('·')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  let traffic: number | undefined;
  const t = parts.length > 0 ? TRAFFIC_RE.exec(parts[0] ?? '') : null;
  if (t !== null) {
    traffic = Number(t[1]);
    parts.shift();
  }
  const name = parts.shift();
  if (name === undefined) return s; // nothing usable — schema error explains
  const duration = parts.length > 0 ? parts.join(' · ') : undefined;
  return {
    name,
    ...(traffic !== undefined ? { traffic } : {}),
    ...(duration !== undefined ? { duration } : {}),
    ...(gate !== undefined && gate.length > 0 ? { gate } : {}),
    ...(status !== undefined && status.length > 0 ? { status } : {}),
  };
}
/**
 * Checklist item: `'[pass] Dashboards exist — grafana/svc'` →
 * `{ status: 'pass', item: 'Dashboards exist', evidence: 'grafana/svc' }`.
 * The bracket is required (it is the verdict); the evidence is optional.
 */
function checklistItemFromString(s: string): unknown {
  const b = STATUS_BRACKET_RE.exec(s.trim());
  if (b === null) return s;
  const status = (b[1] ?? '').trim();
  const rest = s.trim().slice(b[0].length);
  const i = rest.indexOf(' — ');
  const item = (i === -1 ? rest : rest.slice(0, i)).trim();
  const evidence = i === -1 ? undefined : rest.slice(i + 3).trim();
  if (item.length === 0) return s;
  return { status, item, ...(evidence !== undefined && evidence.length > 0 ? { evidence } : {}) };
}
const checklistGrammar: Grammar = {
  expand: checklistItemFromString,
  signature: (key) => STATUS_BRACKET_RE.test(key),
  contract: (v) => {
    if (!onlyKeys(v, ['status', 'item', 'evidence'])) return undefined;
    const item = str(v['item']);
    const head = bracket(v['status']);
    if (item === undefined || head === undefined || head.length === 0) return undefined;
    if (v['evidence'] === undefined) return head + item;
    const ev = str(v['evidence']);
    return ev === undefined ? undefined : `${head}${item} — ${ev}`;
  },
};

const rolloutGrammar: Grammar = {
  expand: rolloutStageFromString,
  signature: (key) => STATUS_BRACKET_RE.test(key) || key.includes('·'),
  contract: (v) => {
    if (!onlyKeys(v, ['name', 'traffic', 'duration', 'gate', 'status'])) return undefined;
    const name = str(v['name']);
    const head = bracket(v['status']);
    if (name === undefined || head === undefined) return undefined;
    const traffic = v['traffic'];
    if (traffic !== undefined && typeof traffic !== 'number') return undefined;
    const parts: Array<string | undefined> = [];
    if (traffic !== undefined) parts.push(`${traffic}%`);
    parts.push(name);
    if (v['duration'] !== undefined) parts.push(str(v['duration']));
    const body = dotJoin(parts);
    if (body === undefined) return undefined;
    if (v['gate'] === undefined) return head + body;
    const gate = str(v['gate']);
    return gate === undefined ? undefined : `${head}${body} — ${gate}`;
  },
};

/**
 * Text-pair grammar for list-shaped blocks: an item may be a plain string,
 * split on the FIRST ` — ` (em dash) into lead + rest:
 *
 *   - Ship small — five focused releases beat one big one.   (takeaways)
 *   - SLO — the target the team commits to.                  (glossary)
 *   - Why is it fast? — The cache is warm.                   (faq)
 *
 * With no ` — `, the whole string becomes the lead field (when the rest field
 * is optional) or stays a string and surfaces as a schema error (when both
 * halves are required — glossary/faq). `alsoColon` additionally accepts
 * `Term: definition` (the natural glossary spelling).
 *
 * The single-pair-map signature is "the key is NOT a known item field": YAML
 * turns an unquoted `- SLO: the target` into `{ SLO: 'the target' }`, which is
 * reconstructed to `SLO: the target` and expanded — while a real field form
 * like `{ term: SLO }` never matches.
 */
function textPairGrammar(
  leadField: string,
  restField: string,
  restRequired: boolean,
  knownKeys: readonly string[],
  alsoColon = false,
): Grammar {
  const expand = (s: string): unknown => {
    const t = s.trim();
    if (t.length === 0) return s;
    let i = t.indexOf(' — ');
    let sep = 3;
    if (i === -1 && alsoColon) {
      i = t.indexOf(': ');
      sep = 2;
    }
    if (i === -1) return restRequired ? s : { [leadField]: t };
    const lead = t.slice(0, i).trim();
    const rest = t.slice(i + sep).trim();
    if (lead.length === 0) return s;
    return { [leadField]: lead, ...(rest.length > 0 ? { [restField]: rest } : {}) };
  };
  const contract = (v: Record<string, unknown>): string | undefined => {
    if (!onlyKeys(v, [leadField, restField])) return undefined;
    const lead = str(v[leadField]);
    if (lead === undefined) return undefined;
    if (v[restField] === undefined) return restRequired ? undefined : lead;
    const rest = str(v[restField]);
    return rest === undefined ? undefined : `${lead} — ${rest}`;
  };
  return { expand, contract, signature: (key) => !knownKeys.includes(key) };
}

const glossaryGrammar = textPairGrammar('term', 'def', true, ['term', 'def', 'avoid', 'id'], true);
const faqGrammar = textPairGrammar('q', 'a', true, ['q', 'a', 'open', 'id']);
const takeawaysGrammar = textPairGrammar('text', 'detail', false, ['text', 'detail', 'id']);
const listGrammar = textPairGrammar('lead', 'text', false, [
  'lead',
  'text',
  'icon',
  'accent',
  'done',
  'id',
]);
const stepsGrammar = textPairGrammar('title', 'body', false, [
  'title',
  'body',
  'code',
  'lang',
  'note',
  'id',
]);

/** Kanban card: `'Title'` or `'Title · tag'` → `{ title, tag? }`. */
const kanbanCardGrammar: Grammar = {
  expand: (s: string): unknown => {
    const parts = s
      .split('·')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (parts.length === 0) return s;
    if (parts.length === 1) return { title: parts[0] };
    return { title: parts[0], tag: parts.slice(1).join(' · ') };
  },
  signature: (key) => !['title', 'tag', 'id'].includes(key),
  contract: (v) => {
    if (!onlyKeys(v, ['title', 'tag'])) return undefined;
    const title = str(v['title']);
    if (title === undefined) return undefined;
    if (v['tag'] === undefined) return title;
    const tag = str(v['tag']);
    return tag === undefined ? undefined : `${title} · ${tag}`;
  },
};

/** Splits on `·`, trimming and dropping empties. */
function dotParts(s: string): string[] {
  return s
    .split('·')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/** A signature that rescues any single-pair map whose key is NOT a real field. */
const notAField =
  (kind: BlockType, path: ReadonlyArray<string | number>) =>
  (key: string): boolean =>
    key !== 'id' && !fieldNamesAt(kind, [...path, 0, key]).includes(key);

/**
 * Node sugar for grid diagrams: `'rx: Receive'` → `{ id: 'rx', label: 'Receive' }`
 * (or `name:` for the kinds that spell it that way); a bare `'Receive'` uses the
 * text as BOTH id and label, so a quick sketch is just names + arrows:
 *
 *   nodes: [Receive, Check, Ship]
 *   edges: [Receive -> Check, Check -> Ship]
 */
function nodeGrammar(kind: BlockType, nodesField: string, labelField: 'label' | 'name'): Grammar {
  const expand = (s: string): unknown => {
    const t = s.trim();
    if (t.length === 0) return s;
    const i = t.indexOf(': ');
    if (i === -1) return { id: t, [labelField]: t };
    const id = t.slice(0, i).trim();
    const label = t.slice(i + 2).trim();
    if (id.length === 0 || label.length === 0 || /\s/.test(id)) return s;
    return { id, [labelField]: label };
  };
  const isField = notAField(kind, [nodesField]);
  const contract = (v: Record<string, unknown>): string | undefined => {
    if (!onlyKeys(v, ['id', labelField])) return undefined;
    const id = str(v['id']);
    const label = str(v[labelField]);
    if (id === undefined || label === undefined) return undefined;
    return id === label ? id : `${id}: ${label}`;
  };
  return { expand, contract, signature: (key) => !/\s/.test(key) && isField(key) };
}

/** `'a -> b: label'` with NO kind field on the target — plain from/to/label. */
const linkGrammar: Grammar = {
  expand: (s: string): unknown => {
    const out = edgeFromString(s);
    if (typeof out === 'string' || !isPlainObject(out)) return out;
    const { kind: _drop, ...rest } = out as { kind?: unknown };
    return rest;
  },
  signature: (key) => ARROW_RE.test(key),
  contract: (v) => (onlyKeys(v, ['from', 'to', 'label']) ? edgeToString(v) : undefined),
};

/** `'idle -> active: submit'` → a state transition (the label is the EVENT). */
const transitionGrammar: Grammar = {
  expand: (s: string): unknown => {
    const out = edgeFromString(s);
    if (typeof out === 'string' || !isPlainObject(out)) return out;
    const o = out as { from: string; to: string; label?: string };
    // `event` is required by the schema — seed empty when unlabelled.
    return { from: o.from, to: o.to, event: o.label ?? '' };
  },
  signature: (key) => ARROW_RE.test(key),
  contract: (v) => {
    if (!onlyKeys(v, ['from', 'to', 'event'])) return undefined;
    const from = str(v['from']);
    const to = str(v['to']);
    const event = str(v['event']);
    if (from === undefined || to === undefined || event === undefined) return undefined;
    return event === '' ? `${from} -> ${to}` : `${from} -> ${to}: ${event}`;
  },
};

/** The erd column fields — a single-pair map whose key is one of these is a real object form. */
const ERD_COLUMN_FIELDS = ['name', 'type', 'pk', 'fk', 'unique', 'nullable', 'default', 'index', 'enum', 'ref', 'note'];

/**
 * ERD column: `'name type flags…'` — the name, then any of, in any order:
 *
 *   pk · fk · unique (uk) · !null (notnull) · null (?) · index (idx)
 *   default=<value> · -> table.column (an FK with its target)
 *   enum(a,b,c) (an inline value list; the type becomes `enum`)
 *
 * Every other token joins the type (`double precision`, `numeric(10,2)`).
 * `'email text unique !null default=now()'` and `'user_id uuid fk -> users.id'`
 * are the documented shapes.
 */
/**
 * The single-pair rescue reconstructs `'id: uuid pk'` from `{ id: 'uuid pk' }`,
 * so a leading `name:` is a separator, not data. It is the ONLY colon the
 * grammar may touch: `default=12:00`, `0::numeric` and `enum(a:b,c)` all carry
 * meaningful colons further in. Matches only a colon that closes the first
 * token and is followed by whitespace.
 */
const ERD_RESCUE_HEAD = /^([^\s:]+):(?=\s|$)/;

/** Flag tokens the grammar reads; anything else after `default=` belongs to the default. */
const ERD_FLAGS = new Set([
  'pk', 'fk', 'unique', 'uk', '!null', 'notnull', 'not-null', 'null', '?', 'index', 'idx',
]);

/**
 * Splits an ERD column string into tokens on whitespace, keeping quoted runs
 * and parenthesised runs whole — so `default="hello world"`, `numeric(10, 2)`
 * and `enum(a, b)` each stay one token.
 */
function erdColumnTokens(s: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quote: string | undefined;
  let depth = 0;
  for (const ch of s) {
    if (quote !== undefined) {
      cur += ch;
      if (ch === quote) quote = undefined;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === '(') depth += 1;
    else if (ch === ')' && depth > 0) depth -= 1;
    if (/\s/.test(ch) && depth === 0) {
      if (cur.length > 0) out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.length > 0) out.push(cur);
  return out;
}

/** Strips one matching pair of surrounding quotes, if the value carries them. */
function unquote(v: string): string {
  const q = v[0];
  return v.length >= 2 && (q === '"' || q === "'") && v.endsWith(q) ? v.slice(1, -1) : v;
}

/** True when the value needs quoting to survive `erdColumnTokens` unchanged. */
function needsQuoting(v: string): boolean {
  return /\s/.test(v);
}

const erdColumnGrammar: Grammar = {
  expand: (s: string): unknown => {
    const tokens = erdColumnTokens(s.replace(ERD_RESCUE_HEAD, '$1 '));
    const name = tokens.shift();
    if (name === undefined) return s;
    const out: Record<string, unknown> = { name };
    const typeParts: string[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i] ?? '';
      const lower = t.toLowerCase();
      if (lower === 'pk') out['pk'] = true;
      else if (lower === 'fk') out['fk'] = true;
      else if (lower === 'unique' || lower === 'uk') out['unique'] = true;
      else if (lower === '!null' || lower === 'notnull' || lower === 'not-null') out['nullable'] = false;
      else if (lower === 'null' || lower === '?') out['nullable'] = true;
      else if (lower === 'index' || lower === 'idx') out['index'] = true;
      else if (lower.startsWith('default=')) {
        // `default=` runs to the end of a quoted value, or to the next flag —
        // a SQL default is often several words (`CURRENT TIMESTAMP`). Only
        // `->` and the flag words above end an unquoted one.
        const head = t.slice('default='.length);
        const parts = [unquote(head)];
        if (head === unquote(head)) {
          while (i + 1 < tokens.length) {
            const nxt = tokens[i + 1] ?? '';
            if (nxt === '->' || ERD_FLAGS.has(nxt.toLowerCase())) break;
            parts.push(nxt);
            i += 1;
          }
        }
        out['default'] = parts.join(' ');
      } else if (t === '->') {
        const target = tokens[i + 1];
        if (target !== undefined) {
          out['fk'] = true;
          out['ref'] = target;
          i += 1;
        }
      } else if (/^enum\(.*\)$/i.test(t)) {
        out['enum'] = t
          .slice(5, -1)
          .split(',')
          .map((v) => unquote(v.trim()))
          .filter((v) => v.length > 0);
        typeParts.push('enum');
      } else typeParts.push(t);
    }
    if (typeParts.length > 0) out['type'] = typeParts.join(' ');
    return out;
  },
  signature: (key) => !/\s/.test(key) && !ERD_COLUMN_FIELDS.includes(key),
  contract: (v) => {
    const name = str(v['name']);
    if (name === undefined || !onlyKeys(v, ERD_COLUMN_FIELDS)) return undefined;
    const tokens: string[] = [name];
    const enumVals = v['enum'];
    if (enumVals !== undefined) {
      if (!Array.isArray(enumVals) || !enumVals.every((e) => typeof e === 'string')) return undefined;
      tokens.push(`enum(${(enumVals as string[]).join(',')})`);
    } else if (v['type'] !== undefined) {
      const type = str(v['type']);
      if (type === undefined) return undefined;
      tokens.push(type);
    }
    if (v['pk'] === true) tokens.push('pk');
    // `-> target` already implies `fk`, so a standalone `fk` would be noise.
    if (v['fk'] === true && v['ref'] === undefined) tokens.push('fk');
    if (v['unique'] === true) tokens.push('unique');
    if (v['nullable'] === false) tokens.push('!null');
    else if (v['nullable'] === true) tokens.push('null');
    if (v['index'] === true) tokens.push('index');
    if (v['default'] !== undefined) {
      const d = str(v['default']);
      // A default with a quote in it has no unambiguous terse spelling — the
      // contraction declines and the item stays in object form.
      if (d === undefined || d.includes('"') || d.includes("'")) return undefined;
      tokens.push(needsQuoting(d) ? `default="${d}"` : `default=${d}`);
    }
    if (v['ref'] !== undefined) {
      const ref = str(v['ref']);
      if (ref === undefined) return undefined;
      tokens.push('->', ref);
    }
    return tokens.join(' ');
  },
};

/** Stat: `'label · value · delta'` — trend inferred from the delta's sign. */
const statGrammar: Grammar = {
  expand: (s: string): unknown => {
    const parts = dotParts(s);
    if (parts.length < 2) return s; // value + label both required
    const out: Record<string, unknown> = { label: parts[0], value: parts[1] };
    const delta = parts[2];
    if (delta !== undefined) {
      out['delta'] = delta;
      if (delta.startsWith('+')) out['trend'] = 'up';
      else if (delta.startsWith('-')) out['trend'] = 'down';
    }
    return out;
  },
  signature: (key) => key.includes('·'),
  contract: (v) => {
    // `trend` is inferred from the delta's sign — an explicit one the sign
    // does not produce is exactly what the round-trip guard rejects.
    if (!onlyKeys(v, ['label', 'value', 'delta', 'trend'])) return undefined;
    const parts: Array<string | undefined> = [str(v['label']), str(v['value'])];
    if (v['delta'] !== undefined) parts.push(str(v['delta']));
    return dotJoin(parts);
  },
};

/** Team member: `'Name · role · focus'`. */
const teamGrammar: Grammar = {
  expand: (s: string): unknown => {
    const parts = dotParts(s);
    const name = parts[0];
    if (name === undefined) return s;
    return {
      name,
      ...(parts[1] !== undefined ? { role: parts[1] } : {}),
      ...(parts[2] !== undefined ? { focus: parts.slice(2).join(' · ') } : {}),
    };
  },
  signature: (key) => key.includes('·'),
  contract: (v) => {
    if (!onlyKeys(v, ['name', 'role', 'focus'])) return undefined;
    const parts: Array<string | undefined> = [str(v['name'])];
    if (v['role'] !== undefined) parts.push(str(v['role']));
    if (v['focus'] !== undefined) parts.push(str(v['focus']));
    return dotJoin(parts);
  },
};

const TIME_RE = /^~?\d{1,2}:\d{2}$/;
const DURATION_RE = /^~?\d+\s*(m|min|mins|h|hr|hrs)$/i;

/** Agenda item: `'09:00 · 20m · Title — desc'` — time/duration detected by shape. */
const agendaGrammar: Grammar = {
  expand: (s: string): unknown => {
    const parts = dotParts(s);
    if (parts.length === 0) return s;
    const out: Record<string, unknown> = {};
    if (parts.length > 1 && TIME_RE.test(parts[0] ?? '')) out['time'] = parts.shift();
    if (parts.length > 1 && DURATION_RE.test(parts[0] ?? '')) out['duration'] = parts.shift();
    const title = parts.join(' · ');
    const d = title.indexOf(' — ');
    if (d === -1) out['title'] = title;
    else {
      out['title'] = title.slice(0, d).trim();
      out['desc'] = title.slice(d + 3).trim();
    }
    return out;
  },
  signature: (key) => key.includes('·') || TIME_RE.test(key),
  contract: (v) => {
    if (!onlyKeys(v, ['time', 'duration', 'title', 'desc'])) return undefined;
    const parts: Array<string | undefined> = [];
    if (v['time'] !== undefined) parts.push(str(v['time']));
    if (v['duration'] !== undefined) parts.push(str(v['duration']));
    parts.push(str(v['title']));
    const body = dotJoin(parts);
    if (body === undefined) return undefined;
    if (v['desc'] === undefined) return body;
    const desc = str(v['desc']);
    return desc === undefined ? undefined : `${body} — ${desc}`;
  },
};

/** OKR key result: `'[status] Text · 60'` — bracket status, trailing `· progress`. */
const krGrammar: Grammar = {
  expand: (s: string): unknown => {
    let rest = s.trim();
    let status: string | undefined;
    const b = STATUS_BRACKET_RE.exec(rest);
    if (b !== null) {
      status = (b[1] ?? '').trim();
      rest = rest.slice(b[0].length);
    }
    const parts = dotParts(rest);
    const last = parts[parts.length - 1];
    const raw = last !== undefined && /^\d+(\.\d+)?%?$/.test(last) ? Number(last.replace('%', '')) : undefined;
    if (raw === undefined) return s; // progress is required — schema explains
    // The schema's `progress` is a 0-1 fraction; the terse form reads as a
    // percentage (`· 60` or `· 60%`), so anything above 1 divides by 100.
    const progress = raw > 1 ? raw / 100 : raw;
    return {
      kr: parts.slice(0, -1).join(' · '),
      progress,
      ...(status !== undefined && status.length > 0 ? { status } : {}),
    };
  },
  signature: (key) => STATUS_BRACKET_RE.test(key) || key.includes('·'),
  contract: (v) => {
    if (!onlyKeys(v, ['kr', 'progress', 'status'])) return undefined;
    const kr = str(v['kr']);
    const head = bracket(v['status']);
    const progress = v['progress'];
    if (kr === undefined || head === undefined || typeof progress !== 'number') return undefined;
    // The terse form reads as a percentage; `0.6 * 100` is 60.000000000000004
    // in binary floating point, so round the product back to a clean decimal
    // (the round-trip guard rejects it if this ever drifts).
    const pct = progress <= 1 ? Number((progress * 100).toPrecision(12)) : progress;
    return `${head}${kr} · ${pct}`;
  },
};

/**
 * Event payload / header field: `name type [required] — desc`. The name is
 * the first token, `required` is an optional last token before the dash,
 * and everything between is the type (so `Item[]` and `string (ISO 8601)`
 * both work). The description follows ` — `.
 */
const EVENT_FIELD_KEYS = ['name', 'type', 'required', 'desc', 'example'];
const eventFieldGrammar: Grammar = {
  expand: (s: string): unknown => {
    let head = s.trim();
    let desc: string | undefined;
    const dash = head.indexOf(' — ');
    if (dash !== -1) {
      desc = head.slice(dash + 3).trim();
      head = head.slice(0, dash);
    }
    // The single-pair rescue reconstructs `'order_id: uuid required'` — treat
    // the first ':' of the head as a space (the desc keeps its colons).
    const tokens = head.replace(':', ' ').split(/\s+/).filter((t) => t.length > 0);
    const name = tokens.shift();
    if (name === undefined) return s;
    let required = false;
    if (tokens.length > 1 && /^required$/i.test(tokens[tokens.length - 1] ?? '')) {
      tokens.pop();
      required = true;
    }
    const type = tokens.join(' ');
    if (type.length === 0) return s; // type is required — schema error explains
    return {
      name,
      type,
      ...(required ? { required: true } : {}),
      ...(desc !== undefined && desc.length > 0 ? { desc } : {}),
    };
  },
  signature: (key) => !/\s/.test(key) && !EVENT_FIELD_KEYS.includes(key),
  contract: (v) => {
    if (!onlyKeys(v, EVENT_FIELD_KEYS)) return undefined; // `example` has no spelling
    const name = str(v['name']);
    const type = str(v['type']);
    if (name === undefined || type === undefined) return undefined;
    let out = `${name} ${type}`;
    if (v['required'] === true) out += ' required';
    else if (v['required'] !== undefined) return undefined;
    if (v['desc'] === undefined) return out;
    const desc = str(v['desc']);
    return desc === undefined ? undefined : `${out} — ${desc}`;
  },
};

/** Event error: `Name — when the consumer sees it`. */
const eventErrorGrammar = textPairGrammar('name', 'when', false, ['name', 'when', 'id']);

/**
 * Saga step: `id: Name · service · compensate` — three parts after the id
 * give name, service, and the compensating action; four give name, service,
 * action, compensate; two give name and service only.
 */
const SAGA_STEP_KEYS = ['id', 'name', 'service', 'action', 'compensate', 'status'];
const sagaStepGrammar: Grammar = {
  expand: (s: string): unknown => {
    const t = s.trim();
    const i = t.indexOf(': ');
    if (i === -1) return s;
    const id = t.slice(0, i).trim();
    if (id.length === 0 || /\s/.test(id)) return s;
    const parts = dotParts(t.slice(i + 2));
    const name = parts[0];
    const service = parts[1];
    if (name === undefined || service === undefined) return s; // both required — schema explains
    const out: Record<string, unknown> = { id, name, service };
    if (parts.length === 3) out['compensate'] = parts[2];
    else if (parts.length >= 4) {
      out['action'] = parts[2];
      out['compensate'] = parts.slice(3).join(' · ');
    }
    return out;
  },
  signature: (key) => !/\s/.test(key) && !SAGA_STEP_KEYS.includes(key),
  contract: (v) => {
    if (!onlyKeys(v, SAGA_STEP_KEYS)) return undefined;
    const id = str(v['id']);
    const parts: Array<string | undefined> = [str(v['name']), str(v['service'])];
    const action = v['action'];
    const compensate = v['compensate'];
    // Three parts read as `name · service · compensate`, so an `action`
    // without a `compensate` has no spelling.
    if (action !== undefined) {
      if (compensate === undefined) return undefined;
      parts.push(str(action));
    }
    if (compensate !== undefined) parts.push(str(compensate));
    const body = dotJoin(parts);
    return id === undefined || body === undefined ? undefined : `${id}: ${body}`;
  },
};

/**
 * Expands the terse items of `data[key]` via `grammar`, leaving everything
 * else untouched. Handles both spellings of a terse item:
 *
 * - a plain string (the quoted form) — expanded directly;
 * - a single-pair mapping (the unquoted `head: label` form YAML produces)
 *   whose key matches the grammar signature — reconstructed and expanded.
 *
 * Anything else (real object forms, non-arrays) passes through untouched.
 */
function expandItem(grammar: Grammar, item: unknown): unknown {
  if (typeof item === 'string') return grammar.expand(item);
  if (isPlainObject(item)) {
    const entries = Object.entries(item);
    if (entries.length !== 1) return item;
    const [k, v] = entries[0] as [string, unknown];
    // `A -> B: 200` — YAML types a bare numeric/boolean label; it is still
    // the label. Only nested structures mean "this is a real object form".
    const label =
      typeof v === 'string'
        ? v
        : v === null
          ? ''
          : typeof v === 'number' || typeof v === 'boolean'
            ? String(v)
            : undefined;
    // A key with whitespace can never be a real field name, so a single-pair
    // map whose key carries spaces is a terse line that YAML split at its
    // colon (`- order_id uuid required — Total: sum of lines` → key
    // `order_id uuid required — Total`, value `sum of lines`). Reconstruct it.
    if (label === undefined || !(grammar.signature(k) || /\s/.test(k))) return item;
    const out = grammar.expand(label.length > 0 ? `${k}: ${label}` : k);
    return typeof out === 'string' ? item : out; // no match — keep the original
  }
  return item;
}

function mapArrayField(
  data: Record<string, unknown>,
  key: string,
  grammar: Grammar,
): Record<string, unknown> {
  const arr = data[key];
  if (!Array.isArray(arr)) return data;
  let changed = false;
  const next = arr.map((item) => {
    const out = expandItem(grammar, item);
    if (out !== item) changed = true;
    return out;
  });
  return changed ? { ...data, [key]: next } : data;
}

/** A lane is just its label: `lanes: [Dev, QA, Ops]`. */
const laneGrammar: Grammar = {
  expand: (s) => ({ label: s.trim() }),
  signature: () => false, // single-pair lanes have no terse form
  contract: (v) => (onlyKeys(v, ['label']) ? str(v['label']) : undefined),
};

/**
 * `id: Label · Lane` or `id: Label · Lane · kind` → a swimlane step whose
 * `lane` is the lane's label. The id carries no spaces. A bare `id: Label`
 * names no lane and stays a string, so the schema reports the missing field.
 */
function swimlaneStepFromString(s: string): unknown {
  const t = s.trim();
  const i = t.indexOf(': ');
  if (i === -1) return s;
  const id = t.slice(0, i).trim();
  if (id.length === 0 || /\s/.test(id)) return s;
  const parts = t
    .slice(i + 2)
    .split('·')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length < 2 || parts.length > 3) return s;
  const [label, lane, kind] = parts as [string, string, string | undefined];
  return { id, label, lane, ...(kind !== undefined ? { kind } : {}) };
}
const swimlaneStepGrammar: Grammar = {
  expand: swimlaneStepFromString,
  signature: (key) => !/\s/.test(key) && notAField('swimlane', ['steps'])(key),
  contract: (v) => {
    if (!onlyKeys(v, ['id', 'label', 'lane', 'kind'])) return undefined;
    const id = str(v['id']);
    const label = str(v['label']);
    const lane = str(v['lane']); // a numeric lane has no terse spelling
    if (id === undefined || label === undefined || lane === undefined) return undefined;
    if (id.length === 0 || /\s/.test(id) || label.includes('·') || lane.includes('·')) return undefined;
    const parts: Array<string | undefined> = [label, lane];
    if (v['kind'] !== undefined) parts.push(str(v['kind']));
    const body = dotJoin(parts);
    return body === undefined ? undefined : `${id}: ${body}`;
  },
};

/**
 * Every terse list field, keyed by block type then by FIELD KEY — the array's
 * path with its indices dropped, so a nested list reads `entities.columns`.
 * This is the single source of truth for the sugar: parsing expands through it
 * ({@link applySugar}) and editing contracts through it
 * ({@link contractTerseItems}), so the two can never drift.
 *
 * Aliases are covered — they map to these canonical kinds.
 */
const TERSE_FIELDS: Partial<Record<BlockType, Readonly<Record<string, Grammar>>>> = {
  sequence: { messages: messageGrammar },
  // Relations get the crow's-foot grammar; each entity's columns get the
  // `'id uuid pk'` token grammar (nested, like kanban cards).
  erd: { relations: relationGrammar, 'entities.columns': erdColumnGrammar },
  flow: { edges: edgeGrammar, nodes: nodeGrammar('flow', 'nodes', 'label') },
  graph: { edges: edgeGrammar, nodes: nodeGrammar('graph', 'nodes', 'label') },
  block: { edges: stepEdgeGrammar, nodes: nodeGrammar('block', 'nodes', 'name') },
  state: { transitions: transitionGrammar, states: nodeGrammar('state', 'states', 'name') },
  dfd: { edges: linkGrammar, nodes: nodeGrammar('dfd', 'nodes', 'name') },
  swimlane: { links: edgeGrammar, lanes: laneGrammar, steps: swimlaneStepGrammar },
  c4: { edges: edgeGrammar },
  // A cluster's edge list is `edges` (the schema's own name) — the sugar used
  // to be registered under `links`, which no cluster body has, so the terse
  // form never expanded there. Registering the real field fixes that.
  cluster: { edges: edgeGrammar },
  stats: { stats: statGrammar },
  team: { members: teamGrammar },
  agenda: { items: agendaGrammar },
  okr: { 'items.krs': krGrammar },
  timeline: { items: timelineGrammar },
  eventcontract: {
    schema: eventFieldGrammar,
    headers: eventFieldGrammar,
    errors: eventErrorGrammar,
  },
  saga: { steps: sagaStepGrammar },
  spans: { spans: spanGrammar },
  rollout: { stages: rolloutGrammar },
  glossary: { terms: glossaryGrammar },
  faq: { items: faqGrammar },
  takeaways: { items: takeawaysGrammar },
  list: { items: listGrammar },
  steps: { items: stepsGrammar },
  kanban: { 'columns.cards': kanbanCardGrammar },
  checklist: { items: checklistGrammar, 'groups.items': checklistGrammar },
  usecase: { links: edgeGrammar },
  pkg: { deps: edgeGrammar },
  threatmodel: { edges: edgeGrammar, nodes: nodeGrammar('threatmodel', 'nodes', 'name') },
  mindmap: { nodes: nodeGrammar('mindmap', 'nodes', 'label') },
};

/**
 * The {@link TERSE_FIELDS} key an array PATH names: the string segments joined
 * by `.` (indices dropped). `['entities', 0, 'columns']` → `entities.columns`.
 */
function fieldKey(path: ReadonlyArray<string | number>): string {
  return path.filter((s): s is string => typeof s === 'string').join('.');
}

/** The grammar for the list at `path` in a `kind` block, if it has one. */
function grammarFor(kind: BlockType, path: ReadonlyArray<string | number>): Grammar | undefined {
  return TERSE_FIELDS[kind]?.[fieldKey(path)];
}

/** Expands `data[parent][*][child]` (or `data[key]` for a one-segment key). */
function mapNestedField(
  data: Record<string, unknown>,
  parent: string,
  child: string,
  grammar: Grammar,
): Record<string, unknown> {
  const arr = data[parent];
  if (!Array.isArray(arr)) return data;
  let changed = false;
  const next = arr.map((el) => {
    if (!isPlainObject(el)) return el;
    const out = mapArrayField(el, child, grammar);
    if (out !== el) changed = true;
    return out;
  });
  return changed ? { ...data, [parent]: next } : data;
}

/** Runs every terse grammar registered for `kind` over `data`. */
function applySugar(kind: BlockType, data: Record<string, unknown>): Record<string, unknown> {
  const fields = TERSE_FIELDS[kind];
  if (fields === undefined) return data;
  let out = data;
  for (const [key, grammar] of Object.entries(fields)) {
    const [parent, child] = key.split('.') as [string, string | undefined];
    out =
      child === undefined
        ? mapArrayField(out, parent, grammar)
        : mapNestedField(out, parent, child, grammar);
  }
  return out;
}

/** Recursively coerces number/boolean scalars to strings at string-only positions. */
function coerce(kind: BlockType, value: unknown, path: ReadonlyArray<string | number>): unknown {
  if (Array.isArray(value)) {
    return value.map((v, i) => coerce(kind, v, [...path, i]));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, coerce(kind, v, [...path, k])]),
    );
  }
  if ((typeof value === 'number' || typeof value === 'boolean') && stringOnlyAt(kind, path)) {
    return String(value);
  }
  return value;
}

/**
 * Normalizes a block's parsed data to canonical shape: sugar expansion first,
 * then scalar coercion. Non-object data (empty body, scalar/array bodies)
 * passes through untouched.
 *
 * @param kind - The block's CANONICAL type (aliases already resolved).
 * @param data - The parsed (and alias-patched) YAML body.
 */
export function normalizeBlockData(kind: BlockType, data: unknown): unknown {
  if (!isPlainObject(data)) return data;
  return coerce(kind, applySugar(kind, data), []);
}

/* ── Contraction: the inverse of the sugar ──────────────────────────────────
 * An edit writes canonical OBJECTS, so a whole-list write would rewrite every
 * terse line the author typed as three lines of fields — one deleted item
 * turning into a rewrite of the block. Contraction writes the terse string
 * back, and is trusted only when it is exactly faithful.
 */

/** Structural equality, key order insensitive (`undefined` values ignored). */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = Object.keys(a).filter((k) => a[k] !== undefined);
    const kb = Object.keys(b).filter((k) => b[k] !== undefined);
    return ka.length === kb.length && ka.every((k) => k in b && deepEqual(a[k], b[k]));
  }
  return false;
}

/**
 * The canonical (sugar-expanded, coerced) value of ONE raw list item — what
 * `normalizeBlockData` would have produced for it. Used to recognise an
 * unchanged item across a rewrite, whichever form the author wrote it in.
 *
 * @param kind - The block's canonical type.
 * @param path - The path of the LIST (e.g. `['messages']`).
 * @param raw - The item as it appears in the YAML body.
 */
export function canonicalTerseItem(
  kind: BlockType,
  path: ReadonlyArray<string | number>,
  raw: unknown,
): unknown {
  const grammar = grammarFor(kind, path);
  const expanded = grammar === undefined ? raw : expandItem(grammar, raw);
  return coerce(kind, expanded, [...path, 0]);
}

/**
 * The terse string for `value` at a terse list path, or `undefined` when the
 * grammar has no exactly faithful spelling for it.
 *
 * Faithfulness is checked mechanically, never by eye: the candidate is kept
 * only when `expand(candidate)` deep-equals `value`. Anything the grammar
 * cannot say — an extra field, an id it would re-split, a kind no arrow
 * spells — fails that check and stays an object.
 */
export function contractTerseValue(
  kind: BlockType,
  path: ReadonlyArray<string | number>,
  value: unknown,
): string | undefined {
  if (!isPlainObject(value)) return undefined; // already terse, or not an item
  const grammar = grammarFor(kind, path);
  if (grammar?.contract === undefined) return undefined;
  const candidate = grammar.contract(value);
  if (candidate === undefined) return undefined;
  return deepEqual(canonicalTerseItem(kind, path, candidate), value) ? candidate : undefined;
}

/**
 * `items` with every contractible entry replaced by its terse string; entries
 * with no faithful spelling are returned untouched.
 *
 * @param kind - The block's canonical type.
 * @param path - The list's field name, or its path for a nested list
 *   (`'messages'`, `['entities', 0, 'columns']`).
 * @param items - The canonical item array about to be written.
 */
export function contractTerseItems(
  kind: BlockType,
  path: string | ReadonlyArray<string | number>,
  items: readonly unknown[],
): unknown[] {
  const p = typeof path === 'string' ? [path] : path;
  return items.map((item) => contractTerseValue(kind, p, item) ?? item);
}

/**
 * How a contracted string should be SPELLED in YAML. The unquoted author form
 * of a `head: label` grammar is a single-pair mapping (`- api -> pay: charge`),
 * which is what the sugar's single-pair rescue reads back; returning that pair
 * keeps a freshly written item looking like the lines around it. `null` means
 * "write it as a plain scalar".
 */
export function terseSpelling(
  kind: BlockType,
  path: ReadonlyArray<string | number>,
  terse: string,
): { readonly key: string; readonly value: string } | null {
  const grammar = grammarFor(kind, path);
  if (grammar === undefined) return null;
  const i = terse.indexOf(': ');
  if (i <= 0) return null;
  const key = terse.slice(0, i);
  const value = terse.slice(i + 2);
  // The rescue reconstructs exactly `${key}: ${value}` — the string the
  // round-trip guard already accepted — so the two spellings cannot diverge.
  return value.length > 0 && grammar.signature(key) ? { key, value } : null;
}

/** True when the list at `path` in a `kind` block has a terse grammar. */
export function hasTerseGrammar(
  kind: BlockType,
  path: ReadonlyArray<string | number>,
): boolean {
  return grammarFor(kind, path) !== undefined;
}

/** Structural equality for edit-time comparisons (re-exported for `edit.ts`). */
export { deepEqual as deepEqualData };

/* ── Bare-text bodies ───────────────────────────────────────────────────────
 * Text-first blocks accept their body as PLAIN TEXT — no YAML at all:
 *
 *   ```callout
 *   Heads up: the API rate limit is 100 req/min.
 *   ```
 *
 * The whole body becomes the block's text field (callout `body`, pullquote
 * `text`), so colons, quotes and dashes never need YAML escaping. The escape
 * hatch back to fields is leading with one: a body whose FIRST non-blank line
 * is `<known-field>:` (or `id:`) parses as YAML exactly as before.
 */
const TEXT_BODY: Partial<Record<BlockType, string>> = {
  callout: 'body',
  pullquote: 'text',
};

/** True when the body's first non-blank line is a known `field:` for `kind`. */
function leadsWithField(kind: BlockType, text: string): boolean {
  const first = text.split('\n').find((l) => l.trim() !== '') ?? '';
  const m = /^([A-Za-z][A-Za-z0-9_-]*):(\s|$)/.exec(first.trim());
  if (m === null) return false;
  const key = m[1] ?? '';
  return key === 'id' || fieldNamesAt(kind, []).includes(key);
}

/**
 * The parsed data for a bare-text body, or `undefined` when the body should go
 * through the normal YAML parse (not a text-first kind, empty, or field-led).
 */
export function textBodyData(kind: BlockType, raw: string): Record<string, unknown> | undefined {
  const field = TEXT_BODY[kind];
  if (field === undefined) return undefined;
  const text = raw.trim();
  if (text === '' || leadsWithField(kind, text)) return undefined;
  return { [field]: text };
}

/**
 * The explicit-YAML equivalent of a bare-text body, or `undefined` when `raw`
 * is not one. Editors (the studio's YAML path ops) canonicalize through this
 * before structured edits, so a bare-text block upgrades to fields instead of
 * failing the edit.
 */
export function textBodyYaml(kind: BlockType, raw: string): string | undefined {
  const data = textBodyData(kind, raw);
  if (data === undefined) return undefined;
  return stringifyYaml(data);
}
