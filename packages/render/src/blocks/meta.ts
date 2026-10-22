/**
 * Meta is rendered as the document cover (not as a body block). The registry
 * entry for `meta` returns an empty string; {@link renderCover} produces the
 * cover from the {@link Document.meta} data.
 *
 * The cover reads like an engineering doc header: a meta row (status chip,
 * tag, reading time), the title and subtitle, then a facts strip (owners,
 * reviewers, updated, version) when the meta block names them.
 *
 * Class names match doc-studio: `.cover-pad`, `.cover-meta`,
 * `.cover-title`, `.cover-sub`, `.cover-logo`.
 */

import type { MetaData } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { safeUrl } from '../sanitize.js';

/** The derived line of the cover: reading time and figure count (pages only). */
export interface CoverStats {
  readonly minutes: number;
  readonly figures: number;
}

/** The status words the cover knows; anything else shows as a plain chip. */
const STATUS_LABEL: Readonly<Record<string, string>> = {
  draft: 'Draft',
  proposal: 'Proposal',
  review: 'In review',
  accepted: 'Accepted',
  superseded: 'Superseded',
  deprecated: 'Deprecated',
  example: 'Example',
};

/** `<time>` when the date reads as ISO (`2026-10-01`), else the text as written. */
function dateHtml(text: string): string {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(text.trim());
  return iso
    ? `<time datetime="${escapeHtml(text.trim())}">${escapeHtml(text)}</time>`
    : escapeHtml(text);
}

function fact(label: string, valueHtml: string): string {
  return `<div class="cover-fact"><dt class="t-eyebrow">${label}</dt><dd>${valueHtml}</dd></div>`;
}

/** Renders the document cover (logo, meta row, title, subtitle, facts strip). */
export function renderCover(meta: MetaData | undefined, stats?: CoverStats): string {
  const title = meta?.title ?? 'Untitled';
  const tag = meta?.tag ?? '';
  const subtitle = meta?.subtitle;
  const sub =
    subtitle !== undefined ? `<p class="cover-sub">${escapeHtml(subtitle)}</p>` : '';
  const logo =
    meta?.logo !== undefined && meta.logo !== ''
      ? `<img class="cover-logo" src="${escapeHtml(safeUrl(meta.logo))}" alt="${escapeHtml(title)}">`
      : '';

  const status = meta?.status?.trim().toLowerCase();
  const statusChip =
    status !== undefined && status !== ''
      ? `<span class="cover-status cs-${escapeHtml(status.replace(/[^a-z0-9-]/g, ''))}">` +
        `${escapeHtml(STATUS_LABEL[status] ?? meta?.status ?? '')}</span>`
      : '';
  const tagHtml = tag !== '' ? `<span class="cover-tag accent">${escapeHtml(tag)}</span>` : '';
  const read =
    stats !== undefined
      ? `<span class="cover-read">${stats.minutes}&nbsp;min read` +
        (stats.figures > 0 ? ` · ${stats.figures}&nbsp;figure${stats.figures === 1 ? '' : 's'}` : '') +
        `</span>`
      : '';
  const metaRow =
    statusChip !== '' || tagHtml !== '' || read !== ''
      ? `<div class="cover-meta"><span class="cover-kind">${statusChip}${tagHtml}</span>${read}</div>`
      : '';

  const names = (xs: readonly string[] | undefined): string =>
    (xs ?? []).map((x) => `<span class="cover-name">${escapeHtml(x)}</span>`).join(', ');
  const facts: string[] = [];
  if (meta?.owners !== undefined && meta.owners.length > 0) {
    facts.push(fact(meta.owners.length === 1 ? 'Owner' : 'Owners', names(meta.owners)));
  }
  if (meta?.reviewers !== undefined && meta.reviewers.length > 0) {
    facts.push(fact(meta.reviewers.length === 1 ? 'Reviewer' : 'Reviewers', names(meta.reviewers)));
  }
  if (meta?.updated !== undefined && meta.updated !== '') facts.push(fact('Updated', dateHtml(meta.updated)));
  if (meta?.version !== undefined && meta.version !== '') {
    facts.push(fact('Version', `<span class="cover-version">${escapeHtml(meta.version)}</span>`));
  }
  const factsHtml = facts.length > 0 ? `<dl class="cover-facts">${facts.join('')}</dl>` : '';

  return (
    `<div class="cover-pad">` +
    logo +
    metaRow +
    `<h1 class="cover-title">${escapeHtml(title)}</h1>` +
    sub +
    factsHtml +
    `</div>`
  );
}

/**
 * Block-registry entry for `meta`. Always returns empty: the cover is rendered
 * separately by {@link renderCover}, called from {@link renderDocument}.
 */
export function renderMetaBlock(): string {
  return '';
}
