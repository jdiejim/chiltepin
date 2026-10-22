/**
 * Renders a row of KPI / stat cards with an optional delta.
 *
 * The delta carries two separate facts, and each comes from its own source:
 *
 * - The arrow is the direction of the change, read from the delta's sign
 *   (`+18%` ▲, `-22 ms` ▼, `0` —). A delta with no sign (`slipped`) falls
 *   back to the author's `trend`.
 * - The colour is the judgement, read from `better` (the good direction): a
 *   change that way is good (`hue-green`), the other way bad (`negative`).
 *   Without `better` the delta stays neutral (`muted`) — the renderer never
 *   guesses that "down" is bad, because a latency drop is good news.
 *
 * A stat's `accent` is the author's own colour (data, kept as written after
 * sanitising); an unsafe value falls back to the skin's `accent` token.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { safeColor } from '../sanitize.js';

type Stat = NonNullable<BlockDataMap['stats']['stats']>[number];
type Dir = 'up' | 'down' | 'flat';

const GLYPH: Record<Dir, string> = { up: '▲', down: '▼', flat: '—' };

/** The direction a delta string states by its sign, or `undefined` when it states none. */
export function deltaDirection(delta: string): Dir | undefined {
  const t = delta.trim();
  if (/^[+↑▲]/.test(t)) return 'up';
  if (/^[-−–↓▼]/.test(t)) return 'down';
  // A bare zero (`0`, `0%`, `0.0 pp`, `±0`) is no change.
  if (/^±?0+([.,]0+)?(\s*[^\d\s].*)?$/.test(t)) return 'flat';
  return undefined;
}

/** The arrow and the judgement of one stat's delta. */
export function deltaTone(s: Pick<Stat, 'delta' | 'trend' | 'better'>): { dir: Dir; tone: 'good' | 'bad' | 'neutral' } {
  const dir = (s.delta !== undefined ? deltaDirection(s.delta) : undefined) ?? s.trend ?? 'flat';
  if (s.better === undefined || dir === 'flat') return { dir, tone: 'neutral' };
  return { dir, tone: dir === s.better ? 'good' : 'bad' };
}

export function renderStats(data: BlockDataMap['stats']): string {
  const stats = data.stats ?? [];
  const cards = stats
    .map((s, i) => {
      const accent =
        s.accent !== undefined
          ? ` style="border-top-color:${safeColor(s.accent, 'var(--accent)')}"`
          : '';
      let delta = '';
      if (s.delta !== undefined) {
        const { dir, tone } = deltaTone(s);
        const why = s.better !== undefined ? ` title="${s.better === 'up' ? 'higher' : 'lower'} is better"` : '';
        delta = `<div class="stat-delta ${dir} ${tone}"${why}${bp(`stats.${i}.delta`)}>${GLYPH[dir]} ${escapeHtml(s.delta)}</div>`;
      }
      return (
        `<div class="stat-card"${accent}${bp(`stats.${i}`)}>` +
        `<div class="stat-value"${bp(`stats.${i}.value`)}>${escapeHtml(s.value)}</div>` +
        `<div class="stat-label"${bp(`stats.${i}.label`)}>${escapeHtml(s.label)}</div>` +
        delta +
        `</div>`
      );
    })
    .join('');
  return `<div class="stat-row"${bl('stats')}>${cards}</div>`;
}
