/**
 * Renders a `packet` block — a wire format laid out bit by bit.
 *
 * The diagram every RFC draws in ASCII: a ruler of bit offsets across the top,
 * then the header's fields as cells whose width IS their bit count. Because
 * the picture is arithmetic rather than art, a field that doesn't fit the rest
 * of its row wraps and continues on the next one — which is exactly what the
 * bytes do.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';
import { DECORATIVE } from '../svg/decorative.js';
import { ellipsize, fitText, FONT, reportCut, splitIdentifier, textWidth, type Font, type Wrapped } from '../svg/wrapText.js';

type PacketData = BlockDataMap['packet'];

/**
 * Field fills alternate paper / paper-2 so neighbours read apart; an explicit
 * `accent` on a field marks it as the notable one (accent-tint + accent
 * stroke), `red` as the negative one. Hue never tells fields apart.
 */
const FILL_CYCLE = ['var(--paper)', 'var(--paper-2)'];
type CellPaint = { readonly fill: string; readonly stroke: string };
function paintFor(accent: string | undefined, index: number): CellPaint {
  if (accent === 'red') return { fill: 'var(--negative-tint)', stroke: 'var(--negative)' };
  if (accent === 'gray') return { fill: 'var(--paper-2)', stroke: 'var(--rule-solid)' };
  if (accent !== undefined) return { fill: 'var(--accent-tint)', stroke: 'var(--accent)' };
  return { fill: FILL_CYCLE[index % FILL_CYCLE.length] ?? 'var(--paper)', stroke: 'var(--ink)' };
}

const LEFT = 34; // room for the row's starting bit offset
const RIGHT = 8;
const TOP = 26; // the bit ruler
const ROW_H = 46;
const W = 880;

/** `.pk-name` sets in 11.5px Inter 700; `.pk-value` in 10px mono. */
const NAME_FONT: Font = { size: 11.5, weight: 700 };
const VALUE_FONT: Font = { size: 10, mono: true };
/** A cell narrower than this inside never shows a cut name: it takes a key letter instead. */
const MIN_CUT_W = 60;
/** A cell narrower than this inside sets a flag name (ACK, SYN) in mono, so a run of flags reads alike. */
const FLAG_W = 36;
/** A flag name is the field's name: ink, not the value's muted tone. */
const FLAG_STYLE = ' style="fill:var(--ink);font-weight:600"';
/** The key under the drawing: one row per lettered field. */
const KEY_ROW_H = 18;
const KEY_TOP = 14;

/** One drawn cell: a field, or the part of one that fits this row. */
interface Cell {
  readonly label: string;
  readonly value: string | undefined;
  readonly paint: CellPaint;
  readonly index: number;
  readonly row: number;
  readonly from: number;
  readonly bits: number;
  /** True when the field continues on the next row. */
  readonly cut: boolean;
  readonly cont: boolean;
}

export function renderPacket(data: PacketData): string {
  const width = data.width !== undefined && data.width > 0 ? Math.floor(data.width) : 32;
  const cells: Cell[] = [];
  let bit = 0; // running offset across the whole header

  data.fields.forEach((f, index) => {
    let left = Math.max(0, Math.floor(f.bits));
    let first = true;
    while (left > 0) {
      const row = Math.floor(bit / width);
      const from = bit % width;
      const take = Math.min(left, width - from);
      cells.push({
        label: f.label,
        value: f.value,
        paint: paintFor(f.accent, index),
        index,
        row,
        from,
        bits: take,
        cut: take < left,
        cont: !first,
      });
      bit += take;
      left -= take;
      first = false;
    }
  });

  const rows = Math.max(1, Math.ceil(bit / width) || 1);
  const cellW = (W - LEFT - RIGHT) / width;
  const keyRows = keyLayout(data, lettered(planCells(cells, cellW), cells)).rows;
  const height = TOP + rows * ROW_H + 10 + (keyRows > 0 ? KEY_TOP + keyRows * KEY_ROW_H - 4 : 0);
  const xAt = (b: number): number => LEFT + b * cellW;

  let s = `<svg viewBox="0 0 ${W} ${height}" role="img"><title>${escapeHtml(data.title ?? 'Packet layout')}</title>`;

  // Bit ruler: every 8th offset is labelled, the rest are ticks.
  s += `<g>`;
  for (let b = 0; b <= width; b += 1) {
    const x = xAt(b);
    const major = b % 8 === 0;
    s += `<line x1="${r(x)}" y1="${major ? 10 : 15}" x2="${r(x)}" y2="20" stroke="var(--rule)" stroke-width="1"${DECORATIVE}/>`;
    if (major && b < width) {
      s += `<text x="${r(x + 2)}" y="${8}" class="pk-tick">${b}</text>`;
    }
  }
  s += `</g>`;

  // Decide each cell's text. A name that fits shows whole (on one line, or
  // two when the cell has no value line); a short flag name that only fits in
  // mono shows in mono; a medium cell cuts the name with "…" (the full name is
  // in the title and the geometry report); a cell too narrow for any of that
  // shows a key letter, and the key under the drawing names the field.
  const plans = planCells(cells, cellW);
  const letters = new Map<number, string>();
  plans.forEach((p, i) => {
    const c = cells[i] as Cell;
    if (p.mode === 'letter' && !letters.has(c.index)) letters.set(c.index, keyLetter(letters.size));
  });

  s += `<g${bl('fields')}>`;
  cells.forEach((c, i) => {
    const plan = plans[i] as CellPlan;
    const x = xAt(c.from);
    const w = c.bits * cellW;
    const y = TOP + c.row * ROW_H;
    const cx = x + w / 2;
    s += `<g${bp(`fields.${c.index}`)}>`;
    s += `<rect x="${r(x + 1)}" y="${r(y + 2)}" width="${r(w - 2)}" height="${ROW_H - 6}" rx="3" fill="${c.paint.fill}" stroke="${c.paint.stroke}" stroke-width="1"/>`;
    const value = plan.value;
    const hasValue = value !== undefined && value.lines.length > 0;
    if (plan.mode === 'letter') {
      s += `<text x="${r(cx)}" y="${r(y + (hasValue ? 17 : 24))}" class="pk-name">${escapeHtml(letters.get(c.index) ?? '')}</text>`;
    } else if (plan.mode === 'mono') {
      s += `<text x="${r(cx)}" y="${r(y + (hasValue ? 17 : 24))}" class="pk-value pk-flag"${FLAG_STYLE}>${escapeHtml(plan.lines[0] ?? '')}</text>`;
    } else {
      const ys = plan.lines.length === 2 ? [15, 27] : [hasValue ? 17 : 24];
      plan.lines.forEach((ln, li) => {
        s += `<text x="${r(cx)}" y="${r(y + (ys[li] ?? 24))}" class="pk-name">${escapeHtml(ln)}</text>`;
      });
    }
    if (hasValue) s += `<text x="${r(cx)}" y="${r(y + 28)}" class="pk-value">${escapeHtml(value.lines[0] ?? '')}</text>`;
    s += `<text x="${r(cx)}" y="${r(y + ROW_H - 8)}" class="pk-bits">${c.bits}</text>`;
    const valuePart = c.value !== undefined && c.value !== '' ? ` = ${c.value}` : '';
    s += `<title>${escapeHtml(`${c.label}${valuePart} — ${c.bits} bit${c.bits === 1 ? '' : 's'} at offset ${c.row * width + c.from}`)}</title>`;
    s += `</g>`;
  });
  s += `</g>`;

  // Cuts are reported once per field, whichever of its cells cut.
  const reported = new Set<string>();
  plans.forEach((p, i) => {
    const c = cells[i] as Cell;
    for (const [field, w] of [['label', p.name], ['value', p.value]] as const) {
      if (w === undefined || !w.truncated || reported.has(`${c.index}.${field}`)) continue;
      reported.add(`${c.index}.${field}`);
      reportCut({
        path: `fields.${c.index}.${field}`,
        ...(field === 'value' ? { owner: c.label } : {}),
        field,
        full: w.full,
        hint: field === 'label' ? 'Shorten the field `label`; a short name fits a narrow field.' : 'Shorten the field `value`.',
      });
    }
  });

  // Row offsets down the left edge, in bits.
  for (let row = 0; row < rows; row++) {
    s += `<text x="${LEFT - 8}" y="${r(TOP + row * ROW_H + ROW_H / 2)}" class="pk-off">${row * width}</text>`;
  }
  s += keySvg(data, letters, TOP + rows * ROW_H + KEY_TOP);
  s += `</svg>`;

  const totalBits = bit;
  const footer =
    `<p class="pk-total">${totalBits} bits · ${Math.round((totalBits / 8) * 10) / 10} bytes` +
    (totalBits % width !== 0 ? ` · last row is ${totalBits % width} of ${width} bits` : '') +
    `</p>`;

  return diagramFrame(
    {
      tag: 'PACKET',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      footerHtml: footer,
    },
    s,
  );
}

function r(v: number): number {
  return Math.round(v * 10) / 10;
}

/** How one cell shows its field. */
interface CellPlan {
  /** `name`: the name in `.pk-name` (whole, wrapped, or cut); `mono`: a short flag name in mono; `letter`: a key letter. */
  readonly mode: 'name' | 'mono' | 'letter';
  readonly lines: readonly string[];
  /** The name as fitted (`truncated` when cut). Undefined for a key letter. */
  readonly name?: Wrapped;
  /** The value line, when the field has one and the cell shows it. */
  readonly value?: Wrapped;
}

/** True when every word of `text` fits `width` whole (or at its identifier joints). */
function wordsFit(text: string, width: number, font: Font): boolean {
  return text
    .split(/\s+/)
    .filter((wd) => wd !== '')
    .every((wd) => textWidth(wd, font) <= width || splitIdentifier(wd).every((p) => p.length > 1 && textWidth(p, font) <= width));
}

/** Plans the text of one cell `w` px wide (see the drawing loop). */
function planCell(c: Cell, w: number): CellPlan {
  const room = w - 8;
  const suffix = c.cont ? ' (cont.)' : c.cut ? ' →' : '';
  const hasValue = c.value !== undefined && c.value !== '';
  // The value: whole in mono when it fits, else cut (in a cell wide enough to
  // cut a name) or carried by the key.
  const valueFits = hasValue && textWidth(c.value ?? '', VALUE_FONT) <= w - 6;
  const value = hasValue ? (valueFits ? ellipsize(c.value, w - 6, VALUE_FONT) : room >= MIN_CUT_W ? ellipsize(c.value, room, VALUE_FONT) : undefined) : undefined;
  if (hasValue && value === undefined) return { mode: 'letter', lines: [] };
  const full = (text: string): Wrapped => ({ lines: [text], truncated: false, full: c.label });
  // A short flag (ACK, SYN) in a one-bit cell: mono sets it narrower.
  if (room < FLAG_W && textWidth(c.label, VALUE_FONT) <= w - 4) {
    return { mode: 'mono', lines: [c.label], name: full(c.label), ...(value !== undefined ? { value } : {}) };
  }
  if (suffix !== '' && textWidth(c.label + suffix, NAME_FONT) <= room) {
    return { mode: 'name', lines: [c.label + suffix], name: full(c.label + suffix), ...(value !== undefined ? { value } : {}) };
  }
  if (textWidth(c.label, NAME_FONT) <= room) {
    return { mode: 'name', lines: [c.label], name: full(c.label), ...(value !== undefined ? { value } : {}) };
  }
  // Two lines, when there is no value line and no word breaks mid-word.
  if (!hasValue && wordsFit(c.label, room, NAME_FONT)) {
    const two = fitText(c.label, { width: room, font: NAME_FONT, maxLines: 2 });
    if (!two.truncated) return { mode: 'name', lines: two.lines, name: two };
  }
  // A short name in a small cell: mono sets it narrower.
  if (textWidth(c.label, VALUE_FONT) <= w - 4) {
    return { mode: 'mono', lines: [c.label], name: full(c.label), ...(value !== undefined ? { value } : {}) };
  }
  if (room >= MIN_CUT_W) {
    const cut = ellipsize(c.label, room, NAME_FONT);
    return { mode: 'name', lines: cut.lines, name: cut, ...(value !== undefined ? { value } : {}) };
  }
  return { mode: 'letter', lines: [], ...(value !== undefined && !value.truncated ? { value } : {}) };
}

/**
 * Plans every cell. Once the drawing needs a key, a cell that would cut its
 * name takes a key letter instead: the key shows the whole name, so nothing
 * is cut.
 */
function planCells(cells: readonly Cell[], cellW: number): CellPlan[] {
  const plans = cells.map((c) => planCell(c, c.bits * cellW));
  if (!plans.some((p) => p.mode === 'letter')) return plans;
  return plans.map((p) =>
    p.mode === 'name' && (p.name?.truncated === true || p.value?.truncated === true)
      ? { mode: 'letter', lines: [], ...(p.value !== undefined && !p.value.truncated ? { value: p.value } : {}) }
      : p,
  );
}

/** The field indices whose cells show a key letter, in field order. */
function lettered(plans: readonly CellPlan[], cells: readonly Cell[]): number[] {
  const out: number[] = [];
  plans.forEach((p, i) => {
    const c = cells[i];
    if (c !== undefined && p.mode === 'letter' && !out.includes(c.index)) out.push(c.index);
  });
  return out;
}

/** `A`…`Z`, then `AA`, `AB`, … */
function keyLetter(i: number): string {
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return i < 26 ? (a[i] ?? 'A') : `${a[Math.floor(i / 26) - 1] ?? 'Z'}${a[i % 26] ?? 'A'}`;
}

/** One key entry: its letter and the full text that names the field. */
function keyText(f: PacketData['fields'][number]): string {
  const value = f.value !== undefined && f.value !== '' ? ` = ${f.value}` : '';
  const bits = Math.max(0, Math.floor(f.bits));
  return `${f.label}${value} · ${bits} bit${bits === 1 ? '' : 's'}`;
}

/** Entries flow left to right and wrap at the drawing's width. */
function keyLayout(data: PacketData, fields: readonly number[]): { rows: number; at: Array<{ field: number; x: number; row: number }> } {
  const at: Array<{ field: number; x: number; row: number }> = [];
  let x = LEFT;
  let row = 0;
  for (const fi of fields) {
    const f = data.fields[fi];
    if (f === undefined) continue;
    const w = 22 + textWidth(keyText(f), FONT.sub);
    if (x > LEFT && x + w > W - RIGHT) {
      x = LEFT;
      row += 1;
    }
    at.push({ field: fi, x, row });
    x += w + 22;
  }
  return { rows: at.length === 0 ? 0 : row + 1, at };
}

/** The key under the drawing: a letter chip and the field it stands for. */
function keySvg(data: PacketData, letters: ReadonlyMap<number, string>, top: number): string {
  const layout = keyLayout(data, [...letters.keys()]);
  if (layout.at.length === 0) return '';
  let s = `<g class="pk-key">`;
  for (const e of layout.at) {
    const f = data.fields[e.field];
    if (f === undefined) continue;
    const y = top + e.row * KEY_ROW_H;
    s +=
      `<g${bp(`fields.${e.field}.label`)}>` +
      `<rect x="${r(e.x)}" y="${r(y)}" width="16" height="14" rx="2" fill="var(--paper)" stroke="var(--ink)" stroke-width="1"/>` +
      `<text x="${r(e.x + 8)}" y="${r(y + 10.5)}" class="t-badge c-ink" text-anchor="middle">${escapeHtml(letters.get(e.field) ?? '')}</text>` +
      `<text x="${r(e.x + 22)}" y="${r(y + 10.5)}" class="t-sub">${escapeHtml(keyText(f))}</text>` +
      `</g>`;
  }
  return s + `</g>`;
}
