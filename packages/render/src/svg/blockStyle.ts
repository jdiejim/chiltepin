/**
 * Node-kind vocabulary + skin helpers for the architecture-flavoured blocks
 * (block / infra / event / ddd / network, cluster, felogic, …).
 *
 * The skin (see `DESIGN.md`) tells kinds apart by stroke weight, dash, fill,
 * an eyebrow chip and a glyph — and, under the two-channel rule, by a family
 * hue: compute is blue, network / edge / security green, state amber,
 * messaging teal, AI violet, people rose; external and unknown kinds stay
 * neutral. {@link nodeSkin} is that mapping; {@link nodeGlyph} draws the small
 * icons. No hex here: every colour is a role token.
 */

import { escapeHtml } from '../escape.js';
import { cloudGlyph, hasGlyph } from './glyphs.js';
import { hueInk, hueTint, type Hue } from './hues.js';

/**
 * The AI kit — the parts an AI system is built from, so a `block` (any preset)
 * draws an agent system from its pieces instead of the fixed `agentloop`
 * frame. Canonical kind → its aliases. `flow` shares the vocabulary for the
 * kinds its schema admits (`agent`, `llm`, `tool`, `memory`, `human`,
 * `guard`, `eval`).
 */
export const AI_KIT: Readonly<Record<string, readonly string[]>> = {
  agent: [],
  llm: ['model'],
  tool: [],
  memory: [],
  vector: ['embeddings'],
  human: ['reviewer'],
  guard: ['guardrail', 'policy'],
  eval: ['judge', 'grader'],
  prompt: [],
};

/** Every AI-kit kind word, canonical first then its aliases. */
export const AI_KIT_KINDS: readonly string[] = Object.entries(AI_KIT).flatMap(([k, aliases]) => [k, ...aliases]);

/**
 * Every node `kind` {@link blockStyle} styles specially — the case labels of
 * its switch, in switch order. Editors use this as the canonical dropdown of
 * documented kinds for the block-graph family (block / infra / event / ddd /
 * network / cluster). Keep it in sync when adding a case below.
 */
export const KNOWN_NODE_KINDS: readonly string[] = [
  'client',
  'service', 'microservice', 'compute', 'container',
  'data',
  'store', 'db', 'database', 'postgres', 'mysql', 'mongo', 'mongodb', 'dynamo',
  'bucket', 'blob', 'object', 's3',
  'queue', 'mq', 'broker', 'sqs', 'rabbitmq',
  'cache', 'redis', 'memcached',
  'gateway', 'lb', 'proxy',
  'function', 'lambda',
  'cdn',
  'external',
  'producer', 'topic', 'consumer',
  'context',
  'firewall', 'waf', 'shield',
  'dns',
  'auth', 'identity', 'idp', 'iam', 'oauth', 'sso',
  'monitor', 'observability', 'metrics', 'logs', 'tracing', 'apm',
  'scheduler', 'cron', 'job',
  'stream', 'kafka', 'kinesis',
  'warehouse', 'lake',
  'analytics', 'bi',
  'search', 'index', 'elasticsearch', 'opensearch',
  'registry',
  'ci', 'cicd', 'pipeline',
  'git', 'repo', 'scm',
  'device', 'iot',
  'email', 'sms',
  'config', 'settings',
  'ml', 'ai',
  // The AI kit: each its own chip, glyph and family hue (aliases follow the canonical word).
  ...AI_KIT_KINDS,
  'user', 'person', 'actor', 'browser', 'web', 'mobile',
  'vm', 'server', 'host',
  'secrets', 'vault', 'kms',
  'notification', 'webhook',
  'worker', 'etl',
  'shard', 'shards', 'sharded', 'replica', 'replicas', 'replicaset',
  'users', 'crowd',
  'region', 'geo', 'globe',
  // `preset: k8s` vocabulary (namespaces are groups; these are the node kinds).
  'deployment', 'pod', 'ingress', 'configmap', 'secret', 'cronjob', 'node', 'namespace', 'cluster',
  'sns',
];

/**
 * Colour triple for a node: outline (`accent` — a legacy field name, it is
 * the stroke), fill, text. The block renderer's paint model still carries
 * these three fields, now always as role tokens.
 */
export interface NodeColors {
  readonly accent: string;
  readonly fill: string;
  readonly text: string;
}

/** How the skin draws one node kind. */
export interface NodeSkin {
  /** The eyebrow chip text (`SVC`, `DB`, …); `''` when the kind has none. */
  readonly chip: string;
  /** Primary nodes: 1.5px `ink`. Secondary (stores, transport): 1px `rule-solid`. */
  readonly primary: boolean;
  /** `paper` (default) or `paper-2` (stores, queues, caches — the "inactive" fill). */
  readonly fill: 'paper' | 'paper-2';
  /** Dashed outline for external / boundary kinds. */
  readonly dashed: boolean;
  /**
   * The family hue (`DESIGN.md` › Two channels): the chip, the glyph and the
   * fill tint take it. Absent for neutral kinds (external, unknown, none).
   */
  readonly hue?: Hue;
}

const SKIN: Record<string, NodeSkin> = {};
const def = (kinds: readonly string[], skin: NodeSkin): void => {
  for (const k of kinds) SKIN[k] = skin;
};
const withHue = (sk: NodeSkin, hue: Hue | undefined): NodeSkin => (hue === undefined ? sk : { ...sk, hue });
const primary = (chip: string, hue?: Hue): NodeSkin => withHue({ chip, primary: true, fill: 'paper', dashed: false }, hue);
const secondary = (chip: string, hue?: Hue): NodeSkin => withHue({ chip, primary: false, fill: 'paper-2', dashed: false }, hue);
const external = (chip: string, hue?: Hue): NodeSkin => withHue({ chip, primary: true, fill: 'paper', dashed: true }, hue);

// People — rose.
def(['client', 'user', 'person', 'actor', 'users', 'crowd', 'browser', 'web', 'mobile', 'device', 'iot'], primary('CLIENT', 'rose'));
// Compute — blue.
def(['service', 'microservice', 'compute', 'container'], primary('SVC', 'blue'));
// A worker serves no requests: it takes jobs. Its own chip and a gear tell it from a service.
def(['worker', 'etl'], primary('WORKER', 'blue'));
def(['function', 'lambda'], primary('FN', 'blue'));
def(['context'], primary('CONTEXT', 'blue'));
def(['monitor', 'observability', 'metrics', 'logs', 'tracing', 'apm'], primary('OBS', 'blue'));
def(['scheduler', 'cron', 'job'], primary('CRON', 'blue'));
def(['analytics', 'bi'], primary('ANALYTICS', 'blue'));
def(['ci', 'cicd', 'pipeline'], primary('CI', 'blue'));
def(['vm', 'server', 'host'], primary('HOST', 'blue'));
// State — amber.
def(['data'], primary('DATA', 'amber'));
def(['store', 'db', 'database', 'postgres', 'mysql', 'mongo', 'mongodb', 'dynamo'], secondary('DB', 'amber'));
def(['shard', 'shards', 'sharded', 'replica', 'replicas', 'replicaset'], secondary('DB', 'amber'));
def(['bucket', 'blob', 'object', 's3'], secondary('BUCKET', 'amber'));
def(['warehouse', 'lake'], secondary('WAREHOUSE', 'amber'));
def(['cache', 'redis', 'memcached'], secondary('CACHE', 'amber'));
def(['search', 'index', 'elasticsearch', 'opensearch'], secondary('SEARCH', 'amber'));
def(['registry'], secondary('REGISTRY', 'amber'));
def(['git', 'repo', 'scm'], secondary('GIT', 'amber'));
def(['config', 'settings'], secondary('CONFIG', 'amber'));
def(['secrets', 'vault', 'kms'], secondary('SECRETS', 'amber'));
// Messaging — teal.
def(['queue', 'mq', 'broker', 'sqs', 'rabbitmq'], secondary('QUEUE', 'teal'));
def(['topic'], secondary('TOPIC', 'teal'));
def(['stream', 'kafka', 'kinesis'], secondary('BUS', 'teal'));
def(['producer'], primary('PRODUCER', 'teal'));
def(['consumer'], primary('CONSUMER', 'teal'));
def(['email', 'sms'], external('EMAIL', 'teal'));
def(['notification', 'webhook'], external('WEBHOOK', 'teal'));
// Network, edge and security — green.
def(['gateway', 'proxy'], primary('GATEWAY', 'green'));
def(['lb'], primary('LB', 'green'));
def(['cdn'], external('EDGE', 'green'));
def(['firewall', 'waf', 'shield'], primary('WAF', 'green'));
def(['dns'], external('DNS', 'green'));
def(['auth', 'identity', 'idp', 'iam', 'oauth', 'sso'], primary('AUTH', 'green'));
def(['region', 'geo', 'globe'], external('REGION', 'green'));
// External — neutral: outside the system, so outside the families.
def(['external'], external('EXT'));
// AI — violet. The kit's stores are amber, its tool blue, its person rose, its guard green.
def(['ml', 'ai'], primary('AI', 'violet'));
def(['agent'], primary('AGENT', 'violet'));
def(['llm', 'model'], primary('LLM', 'violet'));
def(['eval', 'judge', 'grader'], primary('EVAL', 'violet'));
def(['prompt'], primary('PROMPT', 'violet'));
def(['tool'], primary('TOOL', 'blue'));
def(['memory'], secondary('MEMORY', 'amber'));
def(['vector', 'embeddings'], secondary('VECTOR', 'amber'));
def(['human', 'reviewer'], external('HUMAN', 'rose'));
def(['guard', 'guardrail', 'policy'], primary('GUARD', 'green'));
// Kubernetes kinds (`preset: k8s`). `service` / `job` keep their generic skins.
def(['deployment'], primary('DEPLOY', 'blue'));
def(['pod'], primary('POD', 'blue'));
def(['ingress'], primary('INGRESS', 'green'));
def(['configmap'], secondary('CONFIG', 'amber'));
def(['secret'], secondary('SECRETS', 'amber'));
def(['cronjob'], primary('CRON', 'blue'));
def(['node'], primary('NODE', 'blue'));
def(['namespace'], secondary('NS'));
def(['cluster'], primary('CLUSTER', 'blue'));
def(['sns'], secondary('TOPIC', 'teal'));

/** Kinds that draw as the agent card: sparkle, name, and `tech` as a mono model chip. */
const AGENT_CARD: ReadonlySet<string> = new Set(['agent', 'llm', 'model', 'ml', 'ai']);

/** True when `kind` draws as the agent card (`agent`, `llm` / `model`, `ml`, `ai`). */
export function isAgentCard(kind: string | undefined): boolean {
  return AGENT_CARD.has((kind ?? '').trim().toLowerCase());
}

/**
 * Maps a node `kind` to its skin. Unknown kinds are primary paper nodes whose
 * chip is the kind word itself (so an author's `kind: billing` still reads);
 * no kind → no chip.
 */
export function nodeSkin(kind: string | undefined): NodeSkin {
  const k = (kind ?? '').trim().toLowerCase();
  if (k === '') return { chip: '', primary: true, fill: 'paper', dashed: false };
  return SKIN[k] ?? primary(k.toUpperCase());
}

/**
 * The node's fill from its skin: the accent tint on the focal node, else the
 * family hue's tint, else `paper` / `paper-2` for a neutral kind.
 */
export function skinFill(sk: NodeSkin, accent = false): string {
  if (accent) return 'var(--accent-tint)';
  if (sk.hue !== undefined) return hueTint(sk.hue);
  return sk.fill === 'paper-2' ? 'var(--paper-2)' : 'var(--paper)';
}

/**
 * The agent card's model chip (`agentloop`, `flow`, `block`): a hairline box on
 * `paper` with the model name in mono, left-aligned at `x` with its top at
 * `y`, never wider than `maxW`. A longer name is cut with an ellipsis and
 * the whole name stays on the chip as its hover title.
 */
export function modelChipSvg(x: number, y: number, text: string, maxW: number): string {
  const fit = Math.max(4, Math.floor((maxW - 12) / 5.6));
  const cut = text.length > fit;
  const t = cut ? `${text.slice(0, fit - 1).trimEnd()}…` : text;
  const w = Math.min(maxW, 12 + t.length * 5.6);
  const title = cut ? `<title>${escapeHtml(text)}</title>` : '';
  return (
    `<rect x="${x}" y="${y}" width="${w.toFixed(1)}" height="13" rx="3" fill="var(--paper)" stroke="var(--rule-solid)" stroke-width="1"/>` +
    `<text x="${(x + w / 2).toFixed(1)}" y="${(y + 9.5).toFixed(1)}" text-anchor="middle" class="al-chip">${title}${escapeHtml(t)}</text>`
  );
}

/** The colour of a node's glyph and silhouette: accent when focal, else its hue, else `muted`. */
export function skinGlyphColor(sk: NodeSkin, accent = false): string {
  if (accent) return 'var(--accent)';
  return sk.hue !== undefined ? hueInk(sk.hue) : 'var(--muted)';
}

/**
 * The AI kit's own glyphs (16×16 at `x, y`): wrench (tool), rewind clock
 * (memory), points in a plane (vector), shield with a check (guard), gauge
 * (eval), prompt window (prompt). `''` for any other kind. The agent / model
 * sparkle and the person stay in {@link nodeGlyph}, shared with older kinds.
 */
function aiGlyph(k: string, x: number, y: number, c: string): string {
  if (k === 'tool') {
    // An open-ended wrench: the jaw ring opens to the upper right, the handle runs down-left.
    return (
      `<g stroke="${c}" fill="none" stroke-linecap="round">` +
      `<path d="M${x + 14.5} ${y + 4.4} A 3.6 3.6 0 1 1 ${x + 11.6} ${y + 1.5}" stroke-width="1.5"/>` +
      `<path d="M${x + 8.4} ${y + 7.6} L ${x + 2.5} ${y + 13.5}" stroke-width="2.4"/>` +
      `</g>`
    );
  }
  if (k === 'memory') {
    // A clock with a backward arrow — what the agent remembers from earlier turns.
    return (
      `<g stroke="${c}" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
      `<path d="M${x + 1.9} ${y + 6.3} A 6.5 6.5 0 1 1 ${x + 1.6} ${y + 9.6}"/>` +
      `<path d="M${x + 0.6} ${y + 3.4} L ${x + 1.9} ${y + 6.3} L ${x + 4.9} ${y + 5.4}"/>` +
      `<path d="M${x + 8} ${y + 5} V ${y + 8.5} L ${x + 10.6} ${y + 10}"/>` +
      `</g>`
    );
  }
  if (k === 'vector' || k === 'embeddings') {
    // Two axes and three points — an embedding space.
    return (
      `<g>` +
      `<path d="M${x + 2} ${y + 1} V ${y + 14} H ${x + 15}" fill="none" stroke="${c}" stroke-width="1.3" stroke-linecap="round"/>` +
      `<circle cx="${x + 6.5}" cy="${y + 9.5}" r="1.6" fill="${c}"/>` +
      `<circle cx="${x + 9.5}" cy="${y + 4.5}" r="1.6" fill="${c}"/>` +
      `<circle cx="${x + 12.5}" cy="${y + 8.5}" r="1.6" fill="${c}"/>` +
      `</g>`
    );
  }
  if (k === 'guard' || k === 'guardrail' || k === 'policy') {
    return (
      `<g stroke="${c}" stroke-width="1.3" fill="none" stroke-linejoin="round" stroke-linecap="round">` +
      `<path d="M${x + 8} ${y} L ${x + 15} ${y + 3} V ${y + 9} Q ${x + 15} ${y + 14} ${x + 8} ${y + 16} Q ${x + 1} ${y + 14} ${x + 1} ${y + 9} V ${y + 3} Z"/>` +
      `<path d="M${x + 5} ${y + 8.2} L ${x + 7.3} ${y + 10.5} L ${x + 11} ${y + 6}"/>` +
      `</g>`
    );
  }
  if (k === 'eval' || k === 'judge' || k === 'grader') {
    // A gauge: the arc, the needle, the pivot.
    return (
      `<g stroke="${c}" fill="none" stroke-linecap="round">` +
      `<path d="M${x + 1.5} ${y + 12} A 6.5 6.5 0 0 1 ${x + 14.5} ${y + 12}" stroke-width="1.4"/>` +
      `<path d="M${x + 8} ${y + 12} L ${x + 11.5} ${y + 6.8}" stroke-width="1.5"/>` +
      `<circle cx="${x + 8}" cy="${y + 12}" r="1.6" fill="${c}" stroke="none"/>` +
      `</g>`
    );
  }
  if (k === 'prompt') {
    // A prompt window: the frame, a `>` caret and the input line.
    return (
      `<g stroke="${c}" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
      `<rect x="${x + 1}" y="${y + 2}" width="14" height="12" rx="2"/>` +
      `<path d="M${x + 4} ${y + 6} L ${x + 6.5} ${y + 8} L ${x + 4} ${y + 10}"/>` +
      `<path d="M${x + 8.5} ${y + 10} H ${x + 12}"/>` +
      `</g>`
    );
  }
  return '';
}

/**
 * Returns a small SVG glyph (database cylinder, queue bars, function ƒ, …)
 * for the given node kind, or empty string if no glyph applies.
 *
 * @param kind - Node kind.
 * @param x - Glyph top-left x.
 * @param y - Glyph top-left y.
 * @param c - Stroke / fill color.
 * @param bg - The node's fill, for a glyph part that must hide what is behind it.
 */
export function nodeGlyph(kind: string | undefined, x: number, y: number, c: string, bg = 'var(--paper)'): string {
  const k = (kind ?? '').toLowerCase();
  const ai = aiGlyph(k, x, y, c);
  if (ai !== '') return ai;
  if (
    k === 'store' || k === 'db' || k === 'database' ||
    k === 'postgres' || k === 'mysql' || k === 'mongo' || k === 'mongodb' || k === 'dynamo'
  ) {
    return (
      `<g stroke="${c}" stroke-width="1.3" fill="none">` +
      `<ellipse cx="${x + 8}" cy="${y + 3}" rx="7" ry="3"/>` +
      `<path d="M${x + 1} ${y + 3} V ${y + 13}"/>` +
      `<path d="M${x + 15} ${y + 3} V ${y + 13}"/>` +
      `<path d="M${x + 1} ${y + 13} a 7 3 0 0 0 14 0"/>` +
      `</g>`
    );
  }
  if (k === 'bucket' || k === 'blob' || k === 'object' || k === 's3') {
    return (
      `<g stroke="${c}" stroke-width="1.3" fill="none">` +
      `<ellipse cx="${x + 8}" cy="${y + 3}" rx="7" ry="2.5"/>` +
      `<path d="M${x + 1.5} ${y + 3} L ${x + 3.5} ${y + 14} L ${x + 12.5} ${y + 14} L ${x + 14.5} ${y + 3}"/>` +
      `</g>`
    );
  }
  if (k === 'queue' || k === 'topic' || k === 'mq' || k === 'broker' || k === 'sqs' || k === 'rabbitmq') {
    return (
      `<g stroke="${c}" stroke-width="1.6">` +
      `<path d="M${x + 2} ${y + 1} V ${y + 14}"/>` +
      `<path d="M${x + 8} ${y + 1} V ${y + 14}"/>` +
      `<path d="M${x + 14} ${y + 1} V ${y + 14}"/>` +
      `</g>`
    );
  }
  if (k === 'firewall' || k === 'waf' || k === 'shield') {
    return `<path d="M${x + 8} ${y} L ${x + 15} ${y + 3} V ${y + 9} Q ${x + 15} ${y + 14} ${x + 8} ${y + 16} Q ${x + 1} ${y + 14} ${x + 1} ${y + 9} V ${y + 3} Z" fill="none" stroke="${c}" stroke-width="1.3"/>`;
  }
  if (k === 'dns') {
    return (
      `<g stroke="${c}" stroke-width="1.2" fill="none">` +
      `<circle cx="${x + 8}" cy="${y + 8}" r="7"/>` +
      `<ellipse cx="${x + 8}" cy="${y + 8}" rx="3" ry="7"/>` +
      `<path d="M${x + 1.5} ${y + 8} H ${x + 14.5}"/>` +
      `</g>`
    );
  }
  if (k === 'auth' || k === 'identity' || k === 'idp' || k === 'iam' || k === 'oauth' || k === 'sso') {
    return (
      `<g stroke="${c}" stroke-width="1.4" fill="none">` +
      `<circle cx="${x + 5}" cy="${y + 8}" r="3.5"/>` +
      `<path d="M${x + 8.5} ${y + 8} H ${x + 15} M${x + 12.5} ${y + 8} V ${y + 11.5} M${x + 15} ${y + 8} V ${y + 10.5}"/>` +
      `</g>`
    );
  }
  if (k === 'monitor' || k === 'observability' || k === 'metrics' || k === 'logs' || k === 'tracing' || k === 'apm') {
    return `<path d="M${x} ${y + 9} H ${x + 4} L ${x + 6.5} ${y + 3} L ${x + 9.5} ${y + 13} L ${x + 12} ${y + 9} H ${x + 16}" fill="none" stroke="${c}" stroke-width="1.5" stroke-linejoin="round"/>`;
  }
  if (k === 'scheduler' || k === 'cron' || k === 'job') {
    return (
      `<g stroke="${c}" stroke-width="1.3" fill="none">` +
      `<circle cx="${x + 8}" cy="${y + 8}" r="7"/>` +
      `<path d="M${x + 8} ${y + 4} V ${y + 8} L ${x + 11.5} ${y + 10}"/>` +
      `</g>`
    );
  }
  if (k === 'stream' || k === 'kafka' || k === 'kinesis') {
    const wave = (dy: number): string =>
      `<path d="M${x + 1} ${y + 4 + dy} q 3.5 -3 7 0 t 7 0" fill="none" stroke="${c}" stroke-width="1.4"/>`;
    return `<g>${wave(0)}${wave(4.5)}${wave(9)}</g>`;
  }
  if (k === 'warehouse' || k === 'lake') {
    return (
      `<g stroke="${c}" stroke-width="1.3" fill="none">` +
      `<ellipse cx="${x + 8}" cy="${y + 3}" rx="7" ry="3"/>` +
      `<path d="M${x + 1} ${y + 3} V ${y + 13}"/>` +
      `<path d="M${x + 15} ${y + 3} V ${y + 13}"/>` +
      `<path d="M${x + 1} ${y + 8} a 7 3 0 0 0 14 0"/>` +
      `<path d="M${x + 1} ${y + 13} a 7 3 0 0 0 14 0"/>` +
      `</g>`
    );
  }
  if (k === 'search' || k === 'index') {
    return (
      `<g stroke="${c}" stroke-width="1.4" fill="none">` +
      `<circle cx="${x + 6.5}" cy="${y + 6.5}" r="5"/>` +
      `<path d="M${x + 10.5} ${y + 10.5} L ${x + 15} ${y + 15}"/>` +
      `</g>`
    );
  }
  if (k === 'ml' || k === 'model' || k === 'llm' || k === 'agent' || k === 'ai') {
    return `<path d="M${x + 8} ${y + 1} L ${x + 9.8} ${y + 6.2} L ${x + 15} ${y + 8} L ${x + 9.8} ${y + 9.8} L ${x + 8} ${y + 15} L ${x + 6.2} ${y + 9.8} L ${x + 1} ${y + 8} L ${x + 6.2} ${y + 6.2} Z" fill="${c}"/>`;
  }
  if (k === 'user' || k === 'person' || k === 'actor' || k === 'human' || k === 'reviewer') {
    return `<g fill="${c}"><circle cx="${x + 8}" cy="${y + 4.5}" r="3.5"/><path d="M ${x + 2} ${y + 15} a 6 6.5 0 0 1 12 0 z"/></g>`;
  }
  if (k === 'browser' || k === 'web') {
    return (
      `<g stroke="${c}" stroke-width="1.3" fill="none">` +
      `<rect x="${x + 1}" y="${y + 2}" width="14" height="12" rx="2"/>` +
      `<path d="M${x + 1} ${y + 6} H ${x + 15}"/>` +
      `</g>`
    );
  }
  if (k === 'mobile') {
    return (
      `<g stroke="${c}" stroke-width="1.3" fill="none">` +
      `<rect x="${x + 4}" y="${y + 1}" width="8" height="14" rx="2"/>` +
      `<path d="M${x + 7} ${y + 12.5} H ${x + 9}"/>` +
      `</g>`
    );
  }
  if (k === 'vm' || k === 'server' || k === 'host') {
    return (
      `<g stroke="${c}" stroke-width="1.3" fill="none">` +
      `<rect x="${x + 2}" y="${y + 2}" width="12" height="5" rx="1.2"/>` +
      `<rect x="${x + 2}" y="${y + 9}" width="12" height="5" rx="1.2"/>` +
      `<path d="M${x + 4.5} ${y + 4.5} H ${x + 7} M${x + 4.5} ${y + 11.5} H ${x + 7}"/>` +
      `</g>`
    );
  }
  if (k === 'secrets' || k === 'vault' || k === 'kms') {
    return (
      `<g stroke="${c}" stroke-width="1.3" fill="none">` +
      `<rect x="${x + 3}" y="${y + 7}" width="10" height="8" rx="1.5"/>` +
      `<path d="M${x + 5} ${y + 7} V ${y + 5} a 3 3 0 0 1 6 0 V ${y + 7}"/>` +
      `</g>`
    );
  }
  if (k === 'notification' || k === 'webhook') {
    return (
      `<g stroke="${c}" stroke-width="1.3" fill="none">` +
      `<path d="M${x + 3} ${y + 11} a 5 5 0 0 1 1.6 -3.6 V ${y + 5} a 3.4 3.4 0 0 1 6.8 0 v 2.4 a 5 5 0 0 1 1.6 3.6 z"/>` +
      `<path d="M${x + 6.5} ${y + 13.5} a 1.5 1.5 0 0 0 3 0"/>` +
      `</g>`
    );
  }
  if (k === 'email' || k === 'sms') {
    return (
      `<g stroke="${c}" stroke-width="1.3" fill="none">` +
      `<rect x="${x + 1}" y="${y + 3}" width="14" height="10" rx="1.5"/>` +
      `<path d="M${x + 1.5} ${y + 4} L ${x + 8} ${y + 9} L ${x + 14.5} ${y + 4}"/>` +
      `</g>`
    );
  }
  if (k === 'registry') {
    return (
      `<g stroke="${c}" stroke-width="1.2" fill="none">` +
      `<rect x="${x + 1}" y="${y + 8}" width="6" height="6" rx="1"/>` +
      `<rect x="${x + 9}" y="${y + 8}" width="6" height="6" rx="1"/>` +
      `<rect x="${x + 5}" y="${y + 1}" width="6" height="6" rx="1"/>` +
      `</g>`
    );
  }
  if (k === 'ci' || k === 'cicd' || k === 'pipeline') {
    return (
      `<g stroke="${c}" stroke-width="1.3" fill="none">` +
      `<circle cx="${x + 8}" cy="${y + 8}" r="7"/>` +
      `<path d="M${x + 6} ${y + 5} L ${x + 11.5} ${y + 8} L ${x + 6} ${y + 11} Z" fill="${c}" stroke="none"/>` +
      `</g>`
    );
  }
  if (k === 'git' || k === 'repo' || k === 'scm') {
    return (
      `<g stroke="${c}" stroke-width="1.3" fill="none">` +
      `<circle cx="${x + 4}" cy="${y + 3.5}" r="2.5"/>` +
      `<circle cx="${x + 4}" cy="${y + 12.5}" r="2.5"/>` +
      `<circle cx="${x + 12}" cy="${y + 6}" r="2.5"/>` +
      `<path d="M${x + 4} ${y + 6} V ${y + 10} M${x + 4} ${y + 8} q 0 -2 3 -2 h 2.5"/>` +
      `</g>`
    );
  }
  if (k === 'device' || k === 'iot') {
    return (
      `<g stroke="${c}" stroke-width="1.2" fill="none">` +
      `<rect x="${x + 4}" y="${y + 4}" width="8" height="8" rx="1.5"/>` +
      `<path d="M${x + 6} ${y + 4} V ${y + 1} M${x + 10} ${y + 4} V ${y + 1} M${x + 6} ${y + 15} V ${y + 12} M${x + 10} ${y + 15} V ${y + 12} M${x + 4} ${y + 6} H ${x + 1} M${x + 4} ${y + 10} H ${x + 1} M${x + 15} ${y + 6} H ${x + 12} M${x + 15} ${y + 10} H ${x + 12}"/>` +
      `</g>`
    );
  }
  if (k === 'analytics' || k === 'bi') {
    return (
      `<g fill="${c}">` +
      `<rect x="${x + 1}" y="${y + 9}" width="3.4" height="6" rx="0.8"/>` +
      `<rect x="${x + 6.3}" y="${y + 5}" width="3.4" height="10" rx="0.8"/>` +
      `<rect x="${x + 11.6}" y="${y + 1}" width="3.4" height="14" rx="0.8"/>` +
      `</g>`
    );
  }
  if (k === 'config' || k === 'settings') {
    return (
      `<g stroke="${c}" stroke-width="1.3" fill="none">` +
      `<circle cx="${x + 8}" cy="${y + 8}" r="4"/>` +
      `<path d="M${x + 8} ${y + 1} V ${y + 3.5} M${x + 8} ${y + 12.5} V ${y + 15} M${x + 1} ${y + 8} H ${x + 3.5} M${x + 12.5} ${y + 8} H ${x + 15} M${x + 3} ${y + 3} L ${x + 5} ${y + 5} M${x + 11} ${y + 11} L ${x + 13} ${y + 13} M${x + 13} ${y + 3} L ${x + 11} ${y + 5} M${x + 5} ${y + 11} L ${x + 3} ${y + 13}"/>` +
      `</g>`
    );
  }
  if (k === 'cache' || k === 'redis' || k === 'memcached') {
    // stacked slabs (memory layers) — three offset parallelograms
    const slab = (dy: number): string =>
      `<path d="M${x + 1} ${y + 5 + dy} L${x + 8} ${y + 2 + dy} L${x + 15} ${y + 5 + dy} L${x + 8} ${y + 8 + dy} Z" fill="none" stroke="${c}" stroke-width="1.2"/>`;
    return `<g>${slab(0)}${slab(3.5)}${slab(7)}</g>`;
  }
  if (k === 'function' || k === 'lambda') {
    return `<text x="${x + 7}" y="${y + 14}" font-family="Georgia, serif" font-size="17" font-style="italic" font-weight="700" fill="${c}" text-anchor="middle">ƒ</text>`;
  }
  if (k === 'cdn' || k === 'external') {
    return `<path d="M${x + 3} ${y + 13} a 4 4 0 0 1 0.5 -8 a 5 5 0 0 1 9.5 1.2 a 3 3 0 0 1 1 6.8 z" fill="none" stroke="${c}" stroke-width="1.3"/>`;
  }
  if (k === 'gateway' || k === 'lb' || k === 'proxy') {
    return (
      `<g stroke="${c}" stroke-width="1.5" fill="none">` +
      `<path d="M${x + 2} ${y + 1} L ${x + 8} ${y + 7} L ${x + 2} ${y + 13}"/>` +
      `<path d="M${x + 8} ${y + 1} L ${x + 14} ${y + 7} L ${x + 8} ${y + 13}"/>` +
      `</g>`
    );
  }
  if (k === 'worker' || k === 'etl') {
    // A gear: a hub ring and eight teeth.
    const teeth = [0, 45, 90, 135, 180, 225, 270, 315]
      .map((deg) => {
        const a = (deg * Math.PI) / 180;
        const p = (rad: number): string => `${(x + 8 + Math.cos(a) * rad).toFixed(2)} ${(y + 8 + Math.sin(a) * rad).toFixed(2)}`;
        return `M${p(5)} L ${p(7.5)}`;
      })
      .join(' ');
    return (
      `<g stroke="${c}" fill="none">` +
      `<circle cx="${x + 8}" cy="${y + 8}" r="5" stroke-width="1.4"/>` +
      `<circle cx="${x + 8}" cy="${y + 8}" r="1.8" stroke-width="1.2"/>` +
      `<path d="${teeth}" stroke-width="2.2" stroke-linecap="round"/>` +
      `</g>`
    );
  }
  if (k === 'service' || k === 'microservice' || k === 'compute' || k === 'container') {
    return (
      `<g stroke="${c}" stroke-width="1.3">` +
      `<rect x="${x + 4}" y="${y + 1}" width="11" height="11" rx="1.5" fill="none"/>` +
      `<rect x="${x + 1}" y="${y + 4}" width="11" height="11" rx="1.5" fill="${bg}"/>` +
      `</g>`
    );
  }
  // Kinds the legacy switch never drew (pod, deployment, ingress, …) take the
  // single-stroke cloud glyph set. Kinds neither knows keep drawing nothing.
  return hasGlyph(k) ? cloudGlyph(k, x, y, c) : '';
}

/** Edge-style preset: per-kind stroke, dash, marker, error flag. */
export interface EdgeStyle {
  readonly stroke: string;
  readonly sw: number;
  readonly dash: string;
  readonly marker: string;
  readonly err: boolean;
}

/**
 * The skin's edge table (`DESIGN.md` › Strokes and arrows): default 1.5px
 * `muted` with a small filled head; dashed = open head; forbidden / error =
 * `negative` with the cross head (`skErr`), and forbidden also dashed, so
 * both read without hue — in greyscale and on paper.
 */
export const SKIN_EDGE: Record<string, EdgeStyle> = {
  solid: { stroke: 'var(--muted)', sw: 1.5, dash: '', marker: 'skArrow', err: false },
  dashed: { stroke: 'var(--muted)', sw: 1.5, dash: '5 4', marker: 'skOpen', err: false },
  forbidden: { stroke: 'var(--negative)', sw: 1.5, dash: '4 3', marker: 'skErr', err: true },
  error: { stroke: 'var(--negative)', sw: 1.5, dash: '', marker: 'skErr', err: true },
};
