/**
 * Renders an `endpoint` block — a Swagger-style API endpoint card: a method +
 * path header, optional summary/description/auth, and tables for parameters,
 * request-body fields, and responses, plus optional request/response examples.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';

type EndpointData = BlockDataMap['endpoint'];
type Param = NonNullable<EndpointData['params']>[number];
type Field = NonNullable<EndpointData['body']>[number];
type Resp = NonNullable<EndpointData['responses']>[number];

/**
 * Render-time JSON syntax highlighting: wraps keys, strings, numbers, and
 * literals in coloured spans. Escapes both matched tokens and the gaps between
 * them, so the result is safe to drop into a `<pre>`. Non-JSON text (e.g. a
 * curl line) passes through escaped, just without colour.
 */
export function highlightJson(src: string): string {
  const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  let out = '';
  let last = 0;
  for (let m = re.exec(src); m !== null; m = re.exec(src)) {
    out += esc(src.slice(last, m.index));
    const str = m[1];
    const colon = m[2];
    const kw = m[3];
    const num = m[4];
    if (str !== undefined) {
      out +=
        colon !== undefined
          ? `<span class="j-key">${esc(str)}</span>${colon}`
          : `<span class="j-str">${esc(str)}</span>`;
    } else if (kw !== undefined) {
      out += `<span class="j-kw">${esc(kw)}</span>`;
    } else if (num !== undefined) {
      out += `<span class="j-num">${esc(num)}</span>`;
    } else {
      out += esc(m[0]);
    }
    last = re.lastIndex;
  }
  out += esc(src.slice(last));
  return out;
}

function statusClass(status: string | number): string {
  const c = String(status).trim();
  if (c.startsWith('3')) return 'ep-3xx';
  if (c.startsWith('4')) return 'ep-4xx';
  if (c.startsWith('5')) return 'ep-5xx';
  return 'ep-2xx';
}

const reqTag = (required: boolean | undefined): string =>
  required === true ? ` <span class="ep-req">required</span>` : '';

function paramTable(params: readonly Param[]): string {
  const rows = params
    .map(
      // Inert span around the name: the cell also holds the "required" pill.
      (p, i) =>
        `<tr${bp(`params.${i}`)}><td class="ep-name"><span${bp(`params.${i}.name`)}>${escapeHtml(p.name)}</span>${reqTag(p.required)}</td>` +
        `<td class="ep-type">${escapeHtml(p.in ?? '')}</td>` +
        `<td class="ep-type"${bp(`params.${i}.type`)}>${escapeHtml(p.type ?? '')}</td>` +
        `<td${bp(`params.${i}.desc`)}>${escapeHtml(p.desc ?? '')}</td></tr>`,
    )
    .join('');
  return (
    `<table class="ep-table"><thead><tr><th>Name</th><th>In</th><th>Type</th><th>Description</th></tr></thead>` +
    `<tbody${bl('params')}>${rows}</tbody></table>`
  );
}

function fieldTable(fields: readonly Field[]): string {
  const rows = fields
    .map(
      // Inert span around the name: the cell also holds the "required" pill.
      (f, i) =>
        `<tr${bp(`body.${i}`)}><td class="ep-name"><span${bp(`body.${i}.name`)}>${escapeHtml(f.name)}</span>${reqTag(f.required)}</td>` +
        `<td class="ep-type"${bp(`body.${i}.type`)}>${escapeHtml(f.type ?? '')}</td>` +
        `<td${bp(`body.${i}.desc`)}>${escapeHtml(f.desc ?? '')}</td></tr>`,
    )
    .join('');
  return (
    `<table class="ep-table"><thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>` +
    `<tbody${bl('body')}>${rows}</tbody></table>`
  );
}

function responseTable(responses: readonly Resp[]): string {
  const rows = responses
    .map((r, i) => {
      const ex =
        r.example !== undefined
          ? `<tr><td></td><td colspan="2"><pre class="ep-ex"${bp(`responses.${i}.example`)}>${highlightJson(r.example)}</pre></td></tr>`
          : '';
      return (
        `<tr${bp(`responses.${i}`)}><td><span class="ep-status ${statusClass(r.status)}"${bp(`responses.${i}.status`)}>${escapeHtml(String(r.status))}</span></td>` +
        `<td colspan="2"${bp(`responses.${i}.desc`)}>${escapeHtml(r.desc ?? '')}</td></tr>${ex}`
      );
    })
    .join('');
  return (
    `<table class="ep-table"><thead><tr><th>Status</th><th colspan="2">Description</th></tr></thead>` +
    `<tbody${bl('responses')}>${rows}</tbody></table>`
  );
}

/**
 * `text` with a break opportunity (`<wbr>`) after every `sep`, and each
 * segment kept whole (`.seg`: no break inside, not even at a hyphen) — a long
 * path wraps between segments, never inside `{organisationId}` or
 * `feature-flags`. The text itself is unchanged.
 */
export function segmentBreaks(text: string, sep: string): string {
  return text
    .split(sep)
    .map((seg) => (seg === '' ? '' : `<span class="seg">${escapeHtml(seg)}</span>`))
    .join(`${escapeHtml(sep)}<wbr>`);
}

/** The endpoint path with a break after every `/` (see {@link segmentBreaks}). */
export function pathWithBreaks(path: string): string {
  return segmentBreaks(path, '/');
}

export function renderEndpoint(data: BlockDataMap['endpoint']): string {
  const head =
    `<div class="ep-head">` +
    `<span class="ep-method ${data.method.toLowerCase()}"${bp('method')}>${escapeHtml(data.method)}</span>` +
    `<span class="ep-path"${bp('path')}>${pathWithBreaks(data.path)}</span>` +
    (data.auth !== undefined ? `<span class="ep-auth"${bp('auth')}>${escapeHtml(data.auth)}</span>` : '') +
    `</div>`;

  const body: string[] = [];
  if (data.title !== undefined) body.push(`<div class="ep-title">${escapeHtml(data.title)}</div>`);
  if (data.description !== undefined) body.push(`<p class="ep-desc">${escapeHtml(data.description)}</p>`);

  const params = data.params ?? [];
  if (params.length > 0) body.push(`<div class="ep-section">Parameters</div>${paramTable(params)}`);

  const fields = data.body ?? [];
  if (fields.length > 0) body.push(`<div class="ep-section">Request body</div>${fieldTable(fields)}`);

  const responses = data.responses ?? [];
  if (responses.length > 0)
    body.push(`<div class="ep-section">Responses</div>${responseTable(responses)}`);

  if (data.request !== undefined)
    body.push(`<div class="ep-section">Example request</div><pre class="ep-ex"${bp('request')}>${highlightJson(data.request)}</pre>`);
  if (data.response !== undefined)
    body.push(`<div class="ep-section">Example response</div><pre class="ep-ex"${bp('response')}>${highlightJson(data.response)}</pre>`);

  return `<div class="endpoint">${head}<div class="ep-body">${body.join('')}</div></div>`;
}
