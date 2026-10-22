/**
 * Renders an `eventcontract` block — the async twin of `endpoint`: one card
 * per event. A head strip (eyebrow `EVENT · v2`, the event name, the channel
 * chip), a PRODUCERS → CONSUMERS strip of mono chips, the delivery facts as
 * outlined word chips, the payload and header fields as tables, an example
 * on the code surface, the errors a consumer must handle, and a note.
 *
 * Skin (`DESIGN.md`): the card is paper on a hairline; every chip carries a
 * word, never a hue. The one accent is the partition-key row of the payload
 * table (`#`), so the field the ordering guarantee hangs on reads first.
 * `?` marks an optional field.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { highlightJson, segmentBreaks } from './endpoint.js';

type EventData = BlockDataMap['eventcontract'];
type Field = NonNullable<EventData['schema']>[number];

/** A mono word chip (a producer, a consumer). */
function chip(text: string, path: string): string {
  return `<span class="evc-chip"${bp(path)}>${escapeHtml(text)}</span>`;
}

/** One column of the producers → consumers strip. */
function partyColumn(label: string, list: string, names: readonly string[]): string {
  const chips =
    names.length > 0
      ? names.map((n, i) => chip(n, `${list}.${i}`)).join('')
      : `<span class="evc-none t-sub">—</span>`;
  return (
    `<div class="evc-party">` +
    `<span class="evc-party-label t-eyebrow">${escapeHtml(label)}${names.length > 0 ? ` (${names.length})` : ''}</span>` +
    `<div class="evc-chips"${bl(list)}>${chips}</div>` +
    `</div>`
  );
}

/** A delivery fact as an outlined chip: the label word, then the value. */
function fact(label: string, value: string, path: string): string {
  return (
    `<span class="evc-fact"${bp(path)}>` +
    `<span class="evc-fact-k t-eyebrow">${escapeHtml(label)}</span>` +
    `<span class="evc-fact-v">${escapeHtml(value)}</span>` +
    `</span>`
  );
}

/**
 * The field table. The `#` marker goes on the key field (the row takes the
 * accent), `?` on every optional field; a required field has no marker.
 */
function fieldTable(fields: readonly Field[], list: string, key: string | undefined): string {
  const rows = fields
    .map((f, i) => {
      const isKey = key !== undefined && f.name === key;
      const mark = isKey ? '#' : f.required === true ? '' : '?';
      const cls = isKey ? ' class="evc-key"' : '';
      const eg =
        f.example !== undefined
          ? ` <span class="evc-eg">e.g. ${escapeHtml(f.example)}</span>`
          : '';
      return (
        `<tr${cls}${bp(`${list}.${i}`)}>` +
        `<td class="evc-mark">${mark}</td>` +
        `<td class="evc-fname"${bp(`${list}.${i}.name`)}>${escapeHtml(f.name)}</td>` +
        `<td class="evc-type"${bp(`${list}.${i}.type`)}>${escapeHtml(f.type)}</td>` +
        `<td class="evc-desc"><span${bp(`${list}.${i}.desc`)}>${escapeHtml(f.desc ?? '')}</span>${eg}</td>` +
        `</tr>`
      );
    })
    .join('');
  return (
    `<table class="evc-table"><thead><tr><th></th><th>Field</th><th>Type</th><th>Description</th></tr></thead>` +
    `<tbody${bl(list)}>${rows}</tbody></table>`
  );
}

export function renderEventcontract(data: EventData): string {
  const eyebrow =
    `<span class="evc-eyebrow t-eyebrow">EVENT` +
    (data.version !== undefined ? `<span class="evc-sep">·</span><span${bp('version')}>${escapeHtml(data.version)}</span>` : '') +
    `</span>`;
  const head =
    `<div class="evc-head">` +
    eyebrow +
    // A dotted name breaks only after a dot, never inside a segment.
    `<span class="evc-name"${bp('name')}>${segmentBreaks(data.name, '.')}</span>` +
    (data.channel !== undefined
      ? `<span class="evc-channel"${bp('channel')}><span class="t-eyebrow">channel</span><span>${segmentBreaks(data.channel, '.')}</span></span>`
      : '') +
    `</div>`;

  const body: string[] = [];
  if (data.title !== undefined) body.push(`<div class="evc-title">${escapeHtml(data.title)}</div>`);
  if (data.summary !== undefined) body.push(`<p class="evc-summary"${bp('summary')}>${escapeHtml(data.summary)}</p>`);
  if (data.description !== undefined) body.push(`<p class="evc-desc-p">${escapeHtml(data.description)}</p>`);

  const producers = data.producers ?? [];
  const consumers = data.consumers ?? [];
  if (producers.length > 0 || consumers.length > 0) {
    body.push(
      `<div class="evc-strip">` +
        partyColumn('Producers', 'producers', producers) +
        `<span class="evc-arrow t-arrow" aria-hidden="true">→</span>` +
        partyColumn('Consumers', 'consumers', consumers) +
        `</div>`,
    );
  }

  const facts: string[] = [];
  if (data.delivery !== undefined) facts.push(fact('delivery', data.delivery, 'delivery'));
  if (data.ordering !== undefined) facts.push(fact('ordering', data.ordering, 'ordering'));
  if (data.key !== undefined) facts.push(fact('key', data.key, 'key'));
  if (data.retention !== undefined) facts.push(fact('retention', data.retention, 'retention'));
  if (facts.length > 0) body.push(`<div class="evc-facts">${facts.join('')}</div>`);

  const fields = data.schema ?? [];
  if (fields.length > 0) {
    const hasKey = data.key !== undefined && fields.some((f) => f.name === data.key);
    const hasOpt = fields.some((f) => f.required !== true && !(hasKey && f.name === data.key));
    const keyLine: string[] = [];
    if (hasKey) keyLine.push(`<span class="evc-mark-k">#</span> partition key`);
    if (hasOpt) keyLine.push(`<span class="evc-mark-k">?</span> optional`);
    body.push(
      `<div class="evc-section">Payload</div>` +
        fieldTable(fields, 'schema', data.key) +
        (keyLine.length > 0 ? `<div class="evc-keyline t-sub">${keyLine.join(' · ')}</div>` : ''),
    );
  }

  const headers = data.headers ?? [];
  if (headers.length > 0) body.push(`<div class="evc-section">Headers</div>${fieldTable(headers, 'headers', undefined)}`);

  if (data.example !== undefined)
    body.push(`<div class="evc-section">Example</div><pre class="ep-ex"${bp('example')}>${highlightJson(data.example)}</pre>`);

  const errors = data.errors ?? [];
  if (errors.length > 0) {
    const rows = errors
      .map(
        (e, i) =>
          `<tr${bp(`errors.${i}`)}><td class="evc-fname"${bp(`errors.${i}.name`)}>${escapeHtml(e.name)}</td>` +
          `<td class="evc-desc"${bp(`errors.${i}.when`)}>${escapeHtml(e.when ?? '')}</td></tr>`,
      )
      .join('');
    body.push(
      `<div class="evc-section">Errors</div>` +
        `<table class="evc-table"><thead><tr><th>Error</th><th>When</th></tr></thead><tbody${bl('errors')}>${rows}</tbody></table>`,
    );
  }

  if (data.note !== undefined) body.push(`<p class="evc-note"${bp('note')}>${escapeHtml(data.note)}</p>`);

  return `<div class="eventcontract">${head}<div class="evc-body">${body.join('')}</div></div>`;
}
