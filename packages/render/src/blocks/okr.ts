/**
 * Renders an `okr` block — objectives with key results. One card per
 * objective: the objective as the bold headline with an optional right-aligned
 * owner chip, then one row per key result — the KR text, a slim rounded
 * progress bar toned by status (done / on-track `ink`, at-risk `hue-amber`,
 * off-track `negative`, no status `ink`), the percentage in mono, and the
 * status chip. The bar, the percentage and the chip sit on one grid
 * (`1fr 40px 84px`), so every track in the card has the same length.
 *
 * Only the bar is clamped to [0, 1]: the percentage prints the true progress
 * (`135%`, `−10%`), and a KR past its target gets a tick at the target mark,
 * so "done and then some" never reads as a plain 100%.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';

type OkrData = BlockDataMap['okr'];
type OkrItem = OkrData['items'][number];
type Kr = OkrItem['krs'][number];

/** Progress-bar tone class for a KR status. */
function krTone(status: Kr['status']): string {
  if (status === 'done' || status === 'on-track') return 'okr-b-ok';
  if (status === 'at-risk') return 'okr-b-warn';
  if (status === 'off-track') return 'okr-b-bad';
  return 'okr-b-plain';
}

/** The true progress as a percentage: `1.35` → `135%`, `-0.1` → `−10%`. */
export function okrPct(progress: number): string {
  if (!Number.isFinite(progress)) return '0%';
  const p = Math.round(progress * 100);
  return p < 0 ? `\u2212${-p}%` : `${p}%`;
}

function renderKr(kr: Kr, path: string): string {
  const clamped = Number.isFinite(kr.progress) ? Math.min(Math.max(kr.progress, 0), 1) : 0;
  const width = Math.round(clamped * 1000) / 10;
  const pct = okrPct(kr.progress);
  const over = Number.isFinite(kr.progress) && kr.progress > 1;
  return (
    `<div class="okr-kr"${bp(path)}>` +
    `<div class="okr-kr-text"${bp(`${path}.kr`)}>${escapeHtml(kr.kr)}</div>` +
    `<div class="okr-kr-bar">` +
    `<div class="okr-track${over ? ' okr-over' : ''}"><div class="okr-fill ${krTone(kr.status)}" style="width:${width}%"></div>` +
    (over ? `<span class="okr-tick" title="${escapeHtml(`${pct} of target`)}"></span>` : '') +
    `</div>` +
    `<span class="okr-pct"${bp(`${path}.progress`)}>${escapeHtml(pct)}</span>` +
    (kr.status !== undefined
      ? `<span class="okr-status okr-s-${kr.status}"${bp(`${path}.status`)}>${escapeHtml(kr.status)}</span>`
      : '') +
    `</div>` +
    `</div>`
  );
}

function renderItem(item: OkrItem, i: number): string {
  const owner =
    item.owner !== undefined
      ? `<span class="okr-owner"${bp(`items.${i}.owner`)}>${escapeHtml(item.owner)}</span>`
      : '';
  const krs = item.krs.map((kr, k) => renderKr(kr, `items.${i}.krs.${k}`)).join('');
  return (
    `<div class="okr-item"${bp(`items.${i}`)}>` +
    `<div class="okr-top">` +
    `<span class="okr-objective"${bp(`items.${i}.objective`)}>${escapeHtml(item.objective)}</span>` +
    owner +
    `</div>` +
    `<div class="okr-krs"${bl(`items.${i}.krs`)}>${krs}</div>` +
    `</div>`
  );
}

export function renderOkr(data: OkrData): string {
  const head =
    data.title !== undefined ? `<div class="okr-head">${escapeHtml(data.title)}</div>` : '';
  const desc =
    data.description !== undefined
      ? `<p class="okr-desc">${escapeHtml(data.description)}</p>`
      : '';
  const items = data.items.map((item, i) => renderItem(item, i)).join('');
  return `<div class="okr">${head}${desc}<div class="okr-list"${bl('items')}>${items}</div></div>`;
}
