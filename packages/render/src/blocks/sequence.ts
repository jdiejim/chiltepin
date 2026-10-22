/**
 * Renders a sequence diagram as inline SVG, plus an optional step-by-step
 * list below the SVG and an optional diagram footer with metadata pills.
 *
 * Matches the layout of `resources/sample-orders-api.html` (the canonical
 * "rich" rendering).
 *
 * Actors are objects (`{id, name, sub?, external?}`); messages reference
 * actors by `id`. Message `kind` (skin: `DESIGN.md` › Strokes and arrows):
 * - `sync` — 1.5px `muted`, small filled head, ink label (default)
 * - `response` — dashed `5 4`, open head
 * - `async` — 1.25px dotted `2 3`, open head
 * - `error` — `negative`, filled head; step list item gets `.err`
 * - `note` — no arrow: a note box beside one lifeline (`from === to`) or
 *   spanning two (`from !== to`, "note over A,B")
 *
 * The accent goes to the last `response` that reaches the first actor — the
 * answer the caller gets — and to the endpoint method word in the eyebrow.
 *
 * A message from an actor to itself draws a self-loop. The `messages` list
 * also carries frame markers — `{ frame, label? }` opens a combined fragment
 * (alt / opt / loop / par / break / critical), `{ else }` starts its next
 * branch, `{ end: true }` closes it — drawn as UML frames under the messages.
 *
 * Rows have variable heights (message 36, frame open 28, else 24, end 14,
 * note 36 + 13 per extra wrapped line); `y` is computed per item in order.
 *
 * Activation bars: explicit when any message carries `activate` /
 * `deactivate` (a bar opens on `to`, closes on `from`); otherwise inferred —
 * a bar opens on each incoming sync/async message and closes at the next
 * response/error back to the caller (or the actor's last outgoing message).
 * An inferred bar opened inside a fragment branch closes when that branch
 * ends (`else` / `end`), and a bar that nothing extends (a call with no reply
 * and no later message from the callee) is not drawn — an empty box says
 * nothing. Nesting depth counts only the bars actually drawn.
 *
 * Numbering counts messages only: a note is never numbered. Actor heads grow
 * to fit their name and subtitle (both wrap; nothing is cut), and frame tabs
 * paint above the activation bars.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { wrapAll } from './wrapAll.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { revealAttr } from '../svg/reveal.js';
import { countPhrase, svgName } from '../svg/svgTitle.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';

type MsgKind = 'sync' | 'response' | 'async' | 'error' | 'note';

interface KindStyle {
  readonly cls: string;
  readonly marker: 'sqArrow' | 'sqOpen' | 'sqErr' | null;
  readonly txt: string;
}

const KIND: Record<MsgKind, KindStyle> = {
  sync: { cls: 'msg-line', marker: 'sqArrow', txt: 'msg-text t-arrow em' },
  response: { cls: 'msg-line dashed', marker: 'sqOpen', txt: 'msg-text t-arrow' },
  async: { cls: 'msg-line async', marker: 'sqOpen', txt: 'msg-text t-arrow' },
  error: { cls: 'msg-line err', marker: 'sqErr', txt: 'msg-text t-arrow err' },
  note: { cls: '', marker: null, txt: 'msg-text t-arrow note' },
};

/* ── row model ─────────────────────────────────────────────────────────── */

const ROW_MSG = 36;
const ROW_OPEN = 28;
const ROW_ELSE = 24;
const ROW_END = 14;
const NOTE_LINE = 13;
const NOTE_CHARS = 34;
const FRAME_PAD = 18;
const FRAME_INSET = 12;
const BAR_PAD = 6;
/** Approximate advance of one 9.5px mono glyph — for extents, never layout. */
const CHAR_W = 6;
/** Actor head rhythm: a 13px name line, a 10px mono subtitle line, the pad, and the band an `EXT` chip takes. */
const NAME_LINE = 14;
const SUB_LINE = 12;
const HEAD_PAD = 6;
const CHIP_BAND = 13;
/** Subtitle characters per line inside the 150px head (10px mono). */
const SUB_CHARS = 22;
/** Lane geometry: lane width, the minimum gap, and what a label needs beyond its glyphs (badge + margins). */
const LANE_W = 150;
const GAP_MIN = 46;
const LABEL_CH = 6.2;
const LABEL_PAD = 40;

/**
 * The gap after each lane (all but the last): the 46px minimum, widened so
 * the widest label of any message spanning exactly that adjacent pair fits
 * between the two lifelines (`chars × 6.2 + 40` inside `laneW + gap`). A
 * message crossing several lanes gets the sum of the gaps it crosses, so
 * only adjacent pairs need checking.
 */
export function laneGaps(
  actors: ReadonlyArray<{ readonly id: string }>,
  items: ReadonlyArray<SeqItem>,
): number[] {
  const idx = (id: string): number => actors.findIndex((a) => a.id === id);
  const gaps = actors.slice(0, -1).map(() => GAP_MIN);
  for (const m of items) {
    if (!('from' in m) || m.kind === 'note') continue;
    const a = idx(m.from);
    const b = idx(m.to);
    if (a < 0 || b < 0 || Math.abs(a - b) !== 1) continue;
    const lo = Math.min(a, b);
    const need = Math.ceil((m.label ?? '').length * LABEL_CH + LABEL_PAD) - LANE_W;
    if (need > (gaps[lo] ?? 0)) gaps[lo] = need;
  }
  return gaps;
}

interface MsgRow {
  readonly kind: 'msg';
  /** Index in `messages` (the data path). */
  readonly idx: number;
  /** Diagram number — counts messages only, never frame markers or notes (a note is 0). */
  readonly n: number;
  readonly top: number;
  /** The message line's y (a note's box bottom). */
  readonly y: number;
  readonly fromI: number;
  readonly toI: number;
  readonly msgKind: MsgKind;
  readonly label: string;
  readonly from: string;
  readonly to: string;
  readonly summary?: string;
  readonly code?: string;
  readonly note?: string;
  readonly activate: boolean;
  readonly deactivate: boolean;
  /** Wrapped note text (notes only). */
  readonly lines: readonly string[];
}

interface FrameRow {
  readonly kind: 'open' | 'else' | 'end';
  readonly idx: number;
  readonly top: number;
  /** The frame edge (open/end) or the divider (else) y. */
  readonly y: number;
  readonly frame: string;
  readonly label: string;
}

type Row = MsgRow | FrameRow;

interface Frame {
  readonly open: FrameRow;
  readonly elses: FrameRow[];
  readonly children: Frame[];
  end?: FrameRow;
  x1: number;
  x2: number;
}

interface Bar {
  readonly i: number;
  readonly y1: number;
  /** Creation order (a bar opened inside a fragment branch has a higher one). */
  readonly seq: number;
  y2: number;
  /** Auto mode: who called, and the actor's last outgoing row so far. */
  readonly caller: number;
  last: number;
  /** The reveal step of the message that opened the bar (deck builds). */
  readonly step: number;
}

type SeqItem = NonNullable<BlockDataMap['sequence']['messages']>[number];

function isMsgRow(r: Row): r is MsgRow {
  return r.kind === 'msg';
}

/* ── step list ─────────────────────────────────────────────────────────── */

/**
 * Deck build order: every message and every frame `open` / `else` marker is
 * one step, in document order (an `end` marker draws nothing of its own — the
 * frame body appears whole at its `open`). Keyed by the item's `messages` index.
 */
function revealSteps(rows: readonly Row[]): Map<number, number> {
  const steps = new Map<number, number>();
  let n = 0;
  for (const r of rows) {
    if (r.kind === 'end') continue;
    steps.set(r.idx, n);
    n += 1;
  }
  return steps;
}

function renderStepList(
  rows: readonly Row[],
  frames: readonly Frame[],
  actorById: Map<string, { name: string }>,
  steps: ReadonlyMap<number, number>,
): string {
  const rv = (idx: number): string => {
    const n = steps.get(idx);
    return n === undefined ? '' : revealAttr(n);
  };
  const msgs = rows.filter(isMsgRow);
  if (!msgs.some((r) => r.summary !== undefined && r.summary.length > 0)) return '';

  // A frame divider appears when the frame holds at least one summarised
  // step, so the list mirrors the diagram without empty headings.
  const dividers = new Set<number>();
  const visit = (f: Frame): void => {
    const lo = f.open.idx;
    const hi = f.end?.idx ?? Number.POSITIVE_INFINITY;
    const has = msgs.some((r) => r.idx > lo && r.idx < hi && r.summary !== undefined && r.summary.length > 0);
    if (has) {
      dividers.add(f.open.idx);
      for (const e of f.elses) dividers.add(e.idx);
    }
    f.children.forEach(visit);
  };
  frames.forEach(visit);

  const lis: string[] = [];
  for (const r of rows) {
    if (r.kind === 'open' && dividers.has(r.idx)) {
      const label = r.label.length > 0 ? `<span class="step-frame-label">${escapeHtml(r.label)}</span>` : '';
      lis.push(
        `<li class="step-frame"${bp(`messages.${r.idx}`)}${rv(r.idx)}>` +
          `<span class="step-frame-tag">${escapeHtml(r.frame.toUpperCase())}</span>${label}</li>`,
      );
      continue;
    }
    if (r.kind === 'else' && dividers.has(r.idx)) {
      lis.push(
        `<li class="step-frame else"${bp(`messages.${r.idx}`)}${rv(r.idx)}>` +
          `<span class="step-frame-tag">else</span><span class="step-frame-label">${escapeHtml(r.label)}</span></li>`,
      );
      continue;
    }
    if (r.kind !== 'msg' || r.summary === undefined || r.summary.length === 0) continue;
    const errCls = r.msgKind === 'error' ? ' class="err"' : '';
    const actorErrCls = r.msgKind === 'error' ? ' err' : '';
    const fromName = actorById.get(r.from)?.name ?? r.from;
    const toName =
      r.msgKind === 'note' || r.from === r.to
        ? ''
        : ` &rarr; ${escapeHtml(actorById.get(r.to)?.name ?? r.to)}`;
    const actorLabel = `${escapeHtml(fromName)}${toName}`;
    const code =
      r.code !== undefined && r.code.length > 0 ? `<pre class="sql">${escapeHtml(r.code)}</pre>` : '';
    const note =
      r.note !== undefined && r.note.length > 0 ? `<span class="step-note">${escapeHtml(r.note)}</span>` : '';
    // A note is not a message: its marker is the note glyph, never a number.
    const stepN = r.msgKind === 'note' ? `<span class="step-n note">i</span>` : `<span class="step-n">${r.n}</span>`;
    lis.push(
      `<li${errCls}${bp(`messages.${r.idx}`)}${rv(r.idx)}>` +
        stepN +
        `<span class="step-actor${actorErrCls}">${actorLabel}</span>` +
        `<span class="step-summary">${escapeHtml(r.summary)}</span>` +
        code +
        note +
        `</li>`,
    );
  }

  return (
    `<div class="seq-steps">` +
    `<div class="seq-steps-title">Step-by-step</div>` +
    `<ol>${lis.join('')}</ol>` +
    `</div>`
  );
}

function renderFoot(foot: NonNullable<BlockDataMap['sequence']['foot']>): string {
  if (foot.length === 0) return '';
  const parts = foot
    .map((f, i) => `<span${bp(`foot.${i}`)}><strong>${escapeHtml(f.label)}:</strong> ${escapeHtml(f.value)}</span>`)
    .join('');
  return `<div class="diagram-foot"${bl('foot')}>${parts}</div>`;
}

/* ── layout ────────────────────────────────────────────────────────────── */

/** Lays the items out top to bottom; returns the rows and the y past the last row. */
function layoutRows(items: readonly SeqItem[], idx: (id: string) => number, startY: number): { rows: Row[]; cursor: number } {
  const rows: Row[] = [];
  let cursor = startY - ROW_MSG;
  let n = 0;
  items.forEach((m, k) => {
    const rec = m as Record<string, unknown>;
    if ('frame' in rec) {
      const label = typeof rec['label'] === 'string' ? rec['label'] : '';
      rows.push({ kind: 'open', idx: k, top: cursor, y: cursor + 14, frame: String(rec['frame']), label });
      cursor += ROW_OPEN;
      return;
    }
    if ('else' in rec) {
      rows.push({ kind: 'else', idx: k, top: cursor, y: cursor + 8, frame: '', label: String(rec['else'] ?? '') });
      cursor += ROW_ELSE;
      return;
    }
    if ('end' in rec) {
      rows.push({ kind: 'end', idx: k, top: cursor, y: cursor + 10, frame: '', label: '' });
      cursor += ROW_END;
      return;
    }
    const msg = m as Extract<SeqItem, { from: string }>;
    // Unknown kinds (invalid per schema, but render is lenient) fall back to
    // the default `sync` style instead of crashing on a missing KIND entry.
    const msgKind: MsgKind = msg.kind !== undefined && msg.kind in KIND ? (msg.kind as MsgKind) : 'sync';
    // Notes are not messages: they never take (or skip) a number.
    if (msgKind !== 'note') n += 1;
    const label = msg.label ?? '';
    // A note wraps to as many lines as it needs; its row grows with it.
    const lines = msgKind === 'note' ? wrapAll(label, NOTE_CHARS) : [];
    const h = msgKind === 'note' ? ROW_MSG + NOTE_LINE * Math.max(0, lines.length - 1) : ROW_MSG;
    const row: MsgRow = {
      kind: 'msg',
      idx: k,
      n: msgKind === 'note' ? 0 : n,
      top: cursor,
      y: cursor + h,
      fromI: idx(msg.from),
      toI: idx(msg.to),
      msgKind,
      label,
      from: msg.from,
      to: msg.to,
      activate: msg.activate === true,
      deactivate: msg.deactivate === true,
      lines,
      ...(msg.summary !== undefined ? { summary: msg.summary } : {}),
      ...(msg.code !== undefined ? { code: msg.code } : {}),
      ...(msg.note !== undefined ? { note: msg.note } : {}),
    };
    rows.push(row);
    cursor += h;
  });
  return { rows, cursor };
}

/** Nests the frame markers into a tree (stray `else`/`end` are ignored). */
function buildFrames(rows: readonly Row[]): Frame[] {
  const roots: Frame[] = [];
  const stack: Frame[] = [];
  for (const r of rows) {
    if (r.kind === 'open') {
      const f: Frame = { open: r, elses: [], children: [], x1: 0, x2: 0 };
      const parent = stack[stack.length - 1];
      if (parent !== undefined) parent.children.push(f);
      else roots.push(f);
      stack.push(f);
    } else if (r.kind === 'else') {
      stack[stack.length - 1]?.elses.push(r);
    } else if (r.kind === 'end') {
      const f = stack.pop();
      if (f !== undefined) f.end = r;
    }
  }
  return roots;
}

/** Horizontal extent [x1, x2] a message row occupies (lifelines, loops, note boxes). */
function rowExtent(r: MsgRow, cx: (i: number) => number, noteBox: (r: MsgRow) => { x: number; w: number } | null): [number, number] | null {
  if (r.msgKind === 'note') {
    const box = noteBox(r);
    return box === null ? null : [box.x, box.x + box.w];
  }
  if (r.fromI < 0 && r.toI < 0) return null;
  if (r.fromI < 0) return [cx(r.toI), cx(r.toI)];
  if (r.toI < 0) return [cx(r.fromI), cx(r.fromI) + 36 + r.label.length * CHAR_W];
  if (r.fromI === r.toI) {
    const x = cx(r.fromI);
    return [x, x + 36 + r.label.length * CHAR_W];
  }
  return [Math.min(cx(r.fromI), cx(r.toI)), Math.max(cx(r.fromI), cx(r.toI))];
}

/* ── main ──────────────────────────────────────────────────────────────── */

export function renderSequence(data: BlockDataMap['sequence']): string {
  const actors = data.actors ?? [];
  const messages = data.messages ?? [];
  const N = Math.max(actors.length, 1);
  const leftPad = 24;
  const laneW = LANE_W;
  const gaps = laneGaps(actors, messages);
  const headY = 16;
  // Long actor names and subtitles wrap inside the head instead of running
  // past its edges; every head grows together to the tallest. An external
  // actor's `EXT` chip takes the top-left corner: its content starts under it.
  const nameLines = actors.map((a) => wrapAll(a.name, a.external === true ? 16 : 19));
  const subLines = actors.map((a) => (a.sub !== undefined ? wrapAll(a.sub, SUB_CHARS) : []));
  const contentH = (i: number): number =>
    (nameLines[i]?.length ?? 1) * NAME_LINE + ((subLines[i]?.length ?? 0) > 0 ? 2 + (subLines[i]?.length ?? 0) * SUB_LINE : 0);
  const headTopPad = (i: number): number => (actors[i]?.external === true ? CHIP_BAND : HEAD_PAD);
  const headH = Math.max(40, ...actors.map((_, i) => headTopPad(i) + contentH(i) + HEAD_PAD));
  const laneX: number[] = [];
  for (let i = 0; i < N; i++) laneX.push(leftPad + laneW / 2 + i * laneW + gaps.slice(0, i).reduce((a, g) => a + g, 0));
  const cx = (i: number): number => laneX[i] ?? leftPad + laneW / 2;
  const width = leftPad * 2 + N * laneW + gaps.reduce((a, g) => a + g, 0);
  const idx = (id: string): number => actors.findIndex((a) => a.id === id);
  const msgStartY = headY + headH + 28;

  const { rows, cursor } = layoutRows(messages, idx, msgStartY);
  const msgRows = rows.filter(isMsgRow);
  const steps = revealSteps(rows);
  const rv = (i: number): string => revealAttr(steps.get(i) ?? 0);
  // One trailing message row of air under the last item.
  const bottom = cursor + ROW_MSG + 12;
  const height = bottom + 6;

  // The accent: the last response that reaches the first actor (the answer
  // the caller gets). None when no response ever comes back to it.
  let accentIdx = -1;
  for (const r of msgRows) {
    if (r.msgKind === 'response' && r.toI === 0 && r.fromI > 0) accentIdx = r.idx;
  }

  /** The note box for a note row, or null when neither actor is known. */
  const noteBox = (r: MsgRow): { x: number; w: number; top: number; h: number } | null => {
    if (r.fromI < 0 && r.toI < 0) return null;
    const chars = Math.max(0, ...r.lines.map((l) => l.length));
    const top = r.top + 14;
    const h = r.y - r.top - 18;
    if (r.fromI < 0 || r.toI < 0 || r.fromI === r.toI) {
      const x0 = cx(r.fromI < 0 ? r.toI : r.fromI);
      const w = Math.max(72, Math.round(chars * CHAR_W) + 16);
      // Beside the lifeline: to its right, or to its left when that would
      // run off the canvas (the last lane).
      const x = x0 + 12 + w <= width - 2 ? x0 + 12 : x0 - 12 - w;
      return { x, w, top, h };
    }
    const a = Math.min(cx(r.fromI), cx(r.toI));
    const b = Math.max(cx(r.fromI), cx(r.toI));
    const w = Math.max(b - a + 60, Math.round(chars * CHAR_W) + 16);
    const mid = (a + b) / 2;
    return { x: Math.round(mid - w / 2), w, top, h };
  };

  // Frames: extent = the lifelines its rows touch (nested frames included,
  // each child inset by FRAME_INSET so edges never coincide), padded.
  const frames = buildFrames(rows);
  const sizeFrame = (f: Frame): void => {
    f.children.forEach(sizeFrame);
    const lo = f.open.idx;
    const hi = f.end?.idx ?? Number.POSITIVE_INFINITY;
    let x1 = Number.POSITIVE_INFINITY;
    let x2 = Number.NEGATIVE_INFINITY;
    for (const r of msgRows) {
      if (r.idx <= lo || r.idx >= hi) continue;
      const ext = rowExtent(r, cx, noteBox);
      if (ext === null) continue;
      x1 = Math.min(x1, ext[0]);
      x2 = Math.max(x2, ext[1]);
    }
    if (x1 === Number.POSITIVE_INFINITY) {
      x1 = leftPad;
      x2 = width - leftPad;
    } else {
      x1 -= FRAME_PAD;
      x2 += FRAME_PAD;
    }
    for (const c of f.children) {
      x1 = Math.min(x1, c.x1 - FRAME_INSET);
      x2 = Math.max(x2, c.x2 + FRAME_INSET);
    }
    f.x1 = Math.max(2, Math.round(x1));
    f.x2 = Math.min(width - 2, Math.round(x2));
  };
  frames.forEach(sizeFrame);
  const frameBottom = (f: Frame): number => f.end?.y ?? cursor + 6;

  // Activation bars.
  const explicit = msgRows.some((r) => r.activate || r.deactivate);
  const bars: Bar[] = [];
  const open = new Map<number, Bar[]>();
  const openOn = (i: number): Bar[] => {
    let list = open.get(i);
    if (list === undefined) {
      list = [];
      open.set(i, list);
    }
    return list;
  };
  const openBar = (i: number, y: number, caller: number, step: number): void => {
    const list = openOn(i);
    const bar: Bar = { i, y1: y, y2: Number.NaN, seq: bars.length, caller, last: y, step };
    list.push(bar);
    bars.push(bar);
  };
  // Auto mode: the `seq` each open fragment branch started at. A bar opened
  // inside a branch closes when the branch ends — the next branch is an
  // alternative, not a continuation.
  const branchFrom: number[] = [];
  const closeBranch = (from: number): void => {
    for (const list of open.values()) {
      for (let k = list.length - 1; k >= 0; k--) {
        const b = list[k] as Bar;
        if (b.seq < from) continue;
        b.y2 = b.last;
        list.splice(k, 1);
      }
    }
  };
  for (const r of rows) {
    if (r.kind !== 'msg') {
      if (explicit) continue;
      if (r.kind === 'open') {
        branchFrom.push(bars.length);
        continue;
      }
      const from = branchFrom[branchFrom.length - 1];
      if (from === undefined) continue;
      closeBranch(from);
      if (r.kind === 'else') branchFrom[branchFrom.length - 1] = bars.length;
      else branchFrom.pop();
      continue;
    }
    if (explicit) {
      if (r.activate && r.toI >= 0) openBar(r.toI, r.y, r.fromI, steps.get(r.idx) ?? 0);
      if (r.deactivate && r.fromI >= 0) {
        const bar = openOn(r.fromI).pop();
        if (bar !== undefined) bar.y2 = r.y;
      }
      continue;
    }
    if (r.msgKind === 'note' || r.fromI < 0) continue;
    // Any outgoing message extends the actor's open bars.
    for (const b of openOn(r.fromI)) b.last = r.y;
    if (r.toI < 0 || r.toI === r.fromI) continue;
    if (r.msgKind === 'sync' || r.msgKind === 'async') {
      openBar(r.toI, r.y, r.fromI, steps.get(r.idx) ?? 0);
    } else {
      // response / error back to the caller closes that caller's bar.
      const list = openOn(r.fromI);
      for (let k = list.length - 1; k >= 0; k--) {
        const b = list[k] as Bar;
        if (b.caller !== r.toI) continue;
        b.y2 = r.y;
        list.splice(k, 1);
        break;
      }
    }
  }
  for (const list of open.values()) {
    for (const b of list) b.y2 = explicit ? cursor : b.last;
  }
  // An inferred bar nothing extended (no reply, no later message from the
  // callee) is an empty box: drop it. Depth then counts the drawn bars that
  // are still active on the same lifeline when a bar opens.
  const drawn = bars.filter((b) => explicit || b.y2 > b.y1);
  const depthOf = new Map<Bar, number>(
    drawn.map((b) => [b, drawn.filter((o) => o !== b && o.i === b.i && o.seq < b.seq && o.y1 <= b.y1 && o.y2 > b.y1).length]),
  );

  // The accessible name, built from the data: what the diagram is about and
  // how big it is (`msgRows` counts messages only, never frame markers).
  const a11y = svgName('Sequence diagram', data.title ?? data.endpoint?.path, [
    `${countPhrase(msgRows.length, 'message')} between ${countPhrase(actors.length, 'actor')}`,
  ]);
  let s =
    `<svg viewBox="0 0 ${width} ${height}"${a11y.attrs}>` +
    a11y.title +
    `<defs>` +
    `<marker id="sqArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">` +
    `<path d="M0,0 L10,5 L0,10 z" fill="var(--muted)"/></marker>` +
    `<marker id="sqOpen" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">` +
    `<path d="M1,1 L9,5 L1,9" fill="none" stroke="var(--muted)" stroke-width="1.6"/></marker>` +
    `<marker id="sqErr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">` +
    `<path d="M0,0 L10,5 L0,10 z" fill="var(--negative)"/></marker>` +
    // The accent message is always a response, so its head is the open
    // return head in `accent` — the legend swatch draws the same stroke.
    `<marker id="sqAccent" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">` +
    `<path d="M1,1 L9,5 L1,9" fill="none" stroke="var(--accent)" stroke-width="1.6"/></marker>` +
    `</defs>`;

  // Frame bodies sit under everything; their tabs and guards go above the
  // lifelines (so a lifeline never cuts through a tab) but under messages.
  let frameBodies = '';
  let frameLabels = '';
  const lifelines = actors.map((_, i) => cx(i));
  // A guard that would start on top of a lifeline (the frame's left edge is
  // 18px left of the leftmost lifeline it touches) moves just right of it.
  const guardX = (x0: number, label: string): number => {
    const span = (label.length + 2) * CHAR_W;
    const hit = lifelines.find((x) => x >= x0 - 6 && x <= x0 + span);
    return hit === undefined ? x0 : hit + 12;
  };
  const drawFrame = (f: Frame): void => {
    const y1 = f.open.y;
    const y2 = frameBottom(f);
    const path = bp(`messages.${f.open.idx}`) + rv(f.open.idx);
    frameBodies +=
      `<g${path}><rect x="${f.x1}" y="${y1}" width="${f.x2 - f.x1}" height="${Math.max(0, y2 - y1)}" rx="4" class="seq-frame"/></g>`;
    const tag = f.open.frame.toUpperCase();
    const tabW = 10 + tag.length * 7;
    const guard =
      f.open.label.length > 0
        ? `<text x="${guardX(f.x1 + tabW + 8, f.open.label)}" y="${y1 + 12}" class="seq-frame-guard t-arrow c-soft">[${escapeHtml(f.open.label)}]</text>`
        : '';
    frameLabels +=
      `<g${path}>` +
      `<rect x="${f.x1}" y="${y1}" width="${tabW}" height="16" rx="2" class="seq-frame-tab"/>` +
      `<text x="${f.x1 + 5}" y="${y1 + 11.5}" class="seq-frame-tab-text t-eyebrow">${escapeHtml(tag)}</text>` +
      guard +
      `</g>`;
    for (const e of f.elses) {
      const ep = bp(`messages.${e.idx}`) + rv(e.idx);
      frameBodies += `<g${ep}><line x1="${f.x1}" y1="${e.y}" x2="${f.x2}" y2="${e.y}" class="seq-frame-else"/></g>`;
      frameLabels += `<g${ep}><text x="${guardX(f.x1 + 8, e.label)}" y="${e.y + 14}" class="seq-frame-guard t-arrow c-soft">[${escapeHtml(e.label)}]</text></g>`;
    }
    f.children.forEach(drawFrame);
  };
  frames.forEach(drawFrame);
  s += frameBodies;

  for (let i = 0; i < actors.length; i++) {
    const x = cx(i);
    s += `<line x1="${x}" y1="${headY + headH}" x2="${x}" y2="${bottom}" class="lifeline"/>`;
  }

  for (const b of drawn) {
    const y1 = b.y1 - BAR_PAD;
    const y2 = b.y2 + BAR_PAD;
    s += `<rect x="${cx(b.i) - 3 + (depthOf.get(b) ?? 0) * 4}" y="${y1}" width="6" height="${Math.max(0, y2 - y1)}" class="activation"${revealAttr(b.step)}/>`;
  }

  s += `<g${bl('actors')}>`;
  actors.forEach((a, i) => {
    const ext = a.external === true;
    const extCls = ext ? ' ext' : '';
    const ls = nameLines[i] ?? [];
    const subs = subLines[i] ?? [];
    // Vertical rhythm inside the head: an `EXT` chip (external actors) takes
    // the top band, then the name lines and the subtitle lines, centred in
    // the room left (every head shares the tallest head's height).
    const top = headY + headTopPad(i) + Math.max(0, (headH - headTopPad(i) - HEAD_PAD - contentH(i)) / 2);
    const nameY = Math.round((top + 11) * 10) / 10;
    const subY = Math.round((top + ls.length * NAME_LINE + 2 + 9) * 10) / 10;
    const name =
      ls.length <= 1
        ? `<text x="${cx(i)}" y="${nameY}" class="lane-head-text t-name">${escapeHtml(a.name)}</text>`
        : ls
            .map(
              (ln, j) =>
                `<text x="${cx(i)}" y="${nameY + j * NAME_LINE}" class="lane-head-text t-name">${escapeHtml(ln)}</text>`,
            )
            .join('');
    const sub = subs
      .map((ln, j) => `<text x="${cx(i)}" y="${subY + j * SUB_LINE}" class="lane-head-sub t-sub">${escapeHtml(ln)}</text>`)
      .join('');
    const chip = ext ? `<text x="${cx(i) - laneW / 2 + 8}" y="${headY + 11}" class="lane-head-chip t-eyebrow">EXT</text>` : '';
    s +=
      `<g${bp(`actors.${i}`)}>` +
      `<rect x="${cx(i) - laneW / 2}" y="${headY}" width="${laneW}" height="${headH}" rx="4" class="lane-head${extCls}"/>` +
      chip +
      name +
      sub +
      `</g>`;
  });
  s += `</g>`;

  s += frameLabels;

  s += `<g${bl('messages')}>`;
  const used = { sync: false, response: false, async: false, error: false, note: false };
  for (const r of msgRows) {
    const base = KIND[r.msgKind];
    const isAccent = r.idx === accentIdx;
    const k: KindStyle = isAccent
      ? { cls: `${base.cls} accent`, marker: 'sqAccent' as unknown as 'sqArrow', txt: `${base.txt} accent` }
      : base;
    used[r.msgKind] = true;
    const rowBp = bp(`messages.${r.idx}`) + rv(r.idx);
    const errCls = r.msgKind === 'error' ? ' err' : '';
    // A note is not numbered: its badge (when the step list lists it) shows `i`.
    const badge = (x: number, y: number): string =>
      `<circle cx="${x}" cy="${y}" r="8" class="step-badge${errCls}${r.msgKind === 'note' ? ' note' : ''}"/>` +
      `<text x="${x}" y="${y + 3}" class="step-badge-text t-badge${errCls === '' ? '' : ' c-negative'}">${r.msgKind === 'note' ? 'i' : r.n}</text>`;

    // `note` kind — a note box beside one lifeline or over two.
    if (r.msgKind === 'note') {
      const box = noteBox(r);
      if (box === null) continue;
      const hasSummary = r.summary !== undefined && r.summary.length > 0;
      const tx = box.x + box.w / 2;
      const text = r.lines
        .map((ln, j) => `<text x="${tx}" y="${box.top + 16 + j * NOTE_LINE}" class="seq-note-text t-sub" text-anchor="middle">${escapeHtml(ln)}</text>`)
        .join('');
      s +=
        `<g${rowBp}>` +
        `<rect x="${box.x}" y="${box.top}" width="${box.w}" height="${box.h}" rx="3" class="seq-note"/>` +
        `<path d="M${box.x + box.w - 7},${box.top} v7 h7" class="seq-note-fold"/>` +
        text +
        (hasSummary ? badge(box.x + 2, box.top) : '') +
        `</g>`;
      continue;
    }
    // One end unknown (lenient render) — number + label on the known lane.
    if (r.fromI < 0 || r.toI < 0) {
      if (r.fromI < 0 && r.toI < 0) continue;
      const x = cx(r.fromI < 0 ? r.toI : r.fromI);
      s +=
        `<g${rowBp}>` +
        badge(x + 18, r.y - 10) +
        `<text x="${x + 34}" y="${r.y - 6}" class="msg-text note">${escapeHtml(r.label)}</text>` +
        `</g>`;
      continue;
    }
    // self-message — a loop out to the right and back to the same lifeline
    if (r.fromI === r.toI) {
      const x = cx(r.fromI);
      const markerAttr = k.marker !== null ? ` marker-end="url(#${k.marker})"` : '';
      s +=
        `<g${rowBp}>` +
        `<path d="M${x},${r.y - 14} H${x + 28} V${r.y} H${x + 3}" class="${k.cls} self"${markerAttr}/>` +
        badge(x + 16, r.y - 26) +
        `<text x="${x + 36}" y="${r.y - 4}" class="${k.txt}" text-anchor="start">${escapeHtml(r.label)}</text>` +
        `</g>`;
      continue;
    }

    const x1 = cx(r.fromI);
    const x2 = cx(r.toI);
    const ltr = x2 > x1;
    const end = x2 + (ltr ? -3 : 3);
    // Badge sits just inside the from-lane on the side facing the target.
    const badgeX = ltr ? x1 + 18 : x1 - 18;
    // Label anchors next to the badge (start-aligned LTR, end-aligned RTL).
    // Matches the sample's `<text x="badgeX+18" ... >` / `<text x="badgeX-18" ... text-anchor="end">` layout.
    const labelX = ltr ? badgeX + 16 : badgeX - 16;
    const labelAnchor = ltr ? 'start' : 'end';
    const markerAttr = k.marker !== null ? ` marker-end="url(#${k.marker})"` : '';
    s +=
      `<g${rowBp}>` +
      `<line x1="${x1}" y1="${r.y}" x2="${end}" y2="${r.y}" class="${k.cls}"${markerAttr}/>` +
      badge(badgeX, r.y - 10) +
      `<text x="${labelX}" y="${r.y - 6}" class="${k.txt}" text-anchor="${labelAnchor}">${escapeHtml(r.label)}</text>` +
      `</g>`;
  }
  s += `</g>`;

  s += `</svg>`;

  const actorById = new Map<string, { name: string }>();
  for (const a of actors) actorById.set(a.id, { name: a.name });
  const stepList = renderStepList(rows, frames, actorById, steps);
  const footHtml = data.foot !== undefined ? renderFoot(data.foot) : '';

  // Legend: one item per encoding the diagram used.
  const items: LegendItem[] = [];
  if (used.sync) items.push({ swatch: 'edge', label: 'call' });
  if (used.response) items.push({ swatch: 'edge-dashed', label: 'response' });
  if (used.async) items.push({ swatch: 'edge-async', label: 'async' });
  if (used.error) items.push({ swatch: 'edge-error', label: 'error' });
  if (accentIdx >= 0) items.push({ swatch: 'edge-accent-dashed', label: 'the answer the caller gets' });
  if (actors.some((a) => a.external === true)) items.push({ swatch: 'chip', chip: 'EXT', label: 'external actor' });
  if (frames.length > 0) items.push({ swatch: 'node-fill2', label: 'fragment (alt / opt / loop)' });
  if (drawn.length > 0) items.push({ swatch: 'node', label: 'active' });
  const legend = renderLegend(items);

  // Eyebrow: `SEQUENCE · POST /oauth/token`; the method word takes the accent.
  const method = data.endpoint?.method;
  const frameOpts: Parameters<typeof diagramFrame>[0] = {
    tag: 'SEQUENCE',
    ...(method !== undefined ? { tagClass: method.toLowerCase(), method } : {}),
    ...(data.endpoint?.path !== undefined ? { path: data.endpoint.path } : {}),
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(data.description !== undefined ? { desc: data.description } : {}),
    ...(legend.length > 0 ? { legendHtml: legend } : {}),
    ...(footHtml.length > 0 ? { footerHtml: footHtml } : {}),
  };

  return diagramFrame(frameOpts, s + stepList);
}
