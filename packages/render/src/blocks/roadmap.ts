/**
 * Renders a `roadmap` block — themes × periods. One column per period in
 * the authored order, one row per theme (`themes`, else first-seen item
 * order); each item is a chip spanning its `from` … `to` columns (`to`
 * defaults to `from`). Items of one theme that overlap in time stack into
 * lanes — greedy first-free lane, in author order — so no two chips ever
 * share a pixel. `now` draws a dashed vertical rule at the start of that
 * period with a `NOW` tag, under the chips. An item whose theme or period is
 * not in the lists is skipped (core lints it).
 *
 * Width: a column is as wide as the longest one-period label wants, but no
 * wider than the page allows ({@link TARGET_W} across), and never under
 * {@link COL_FLOOR}. Past eight periods that are month names, a second
 * header row groups the months under their quarters.
 *
 * Skin (`DESIGN.md`): status is the author's mark. `done` is `paper-2` with
 * muted text; `current` takes the accent outline and bold ink text (the
 * work happening now); `next` is outlined; `later` is a dashed soft outline;
 * `risk` is `negative`. A chip label that does not fit its span runs on
 * beside the chip when the lane is free to its right; else it is cut with
 * an ellipsis. The full label (and the note) live in the chip's `<title>`.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { DECORATIVE } from '../svg/decorative.js';
import { renderLegend, type LegendItem, type LegendSwatch } from '../svg/legend.js';
import { countPhrase, diagramName } from '../svg/svgTitle.js';
import { FONT, cutTitle, ellipsize, fitText, textWidth, type Font, type Wrapped } from '../svg/wrapText.js';
import { diagramFrame } from './frame.js';

type RoadmapData = BlockDataMap['roadmap'];
type Item = RoadmapData['items'][number];
type Status = NonNullable<Item['status']>;

const PAD = 22;
/** Width of one period column: at least this, grown to fit the longest one-column label (capped). */
const COL_MIN = 150;
const COL_MAX = 260;
/** The drawing's target width — about the page column — and the narrowest a column may get to fit it. */
const TARGET_W = 1000;
const COL_FLOOR = 56;
/** Height of the period header row (a quarter row adds {@link QUARTER_H}). */
const HEAD_H = 26;
const QUARTER_H = 16;

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** A run of consecutive month periods in one quarter of one year. */
interface QuarterRun {
  readonly label: string;
  readonly from: number;
  readonly to: number;
}

/**
 * Groups month periods (`Jan`, `February`, `Mar 26`, `Apr 2027`) into quarter
 * runs, or `undefined` when any period is not a month name.
 */
export function quarterRuns(periods: readonly string[]): QuarterRun[] | undefined {
  const parsed = periods.map((p) => {
    const m = /^([A-Za-z]{3,9})\.?(?:\s+'?(\d{2}|\d{4}))?$/.exec(p.trim());
    if (m === null) return undefined;
    const month = MONTHS.indexOf((m[1] ?? '').slice(0, 3).toLowerCase());
    return month < 0 ? undefined : { q: Math.floor(month / 3) + 1, year: m[2] };
  });
  if (parsed.some((x) => x === undefined)) return undefined;
  const runs: QuarterRun[] = [];
  parsed.forEach((x, i) => {
    if (x === undefined) return;
    const label = x.year !== undefined ? `Q${x.q} ${x.year.length === 2 ? `’${x.year}` : x.year}` : `Q${x.q}`;
    const prev = runs[runs.length - 1];
    if (prev !== undefined && prev.label === label && prev.to === i - 1) runs[runs.length - 1] = { ...prev, to: i };
    else runs.push({ label, from: i, to: i });
  });
  return runs;
}
/** Chip height and the gap between lanes / rows. */
const CHIP_H = 24;
const LANE_GAP = 6;
const ROW_PAD = 10;
/** Horizontal inset of a chip inside its span. */
const CHIP_INSET = 6;
/** The chip text (`.rm-label`): 10.5px mono. */
const CHIP_FONT: Font = { size: 10.5, mono: true };
/** The widest a theme label line gets (13px semibold Inter), px. */
const THEME_W = 160;
const THEME_LINE_H = 15;

const CHIP_ATTRS: Record<Status, string> = {
  done: 'fill="var(--paper-2)" stroke="var(--rule-solid)" stroke-width="1"',
  current: 'fill="var(--paper)" stroke="var(--accent)" stroke-width="1.5"',
  next: 'fill="var(--paper)" stroke="var(--ink)" stroke-width="1.25"',
  later: 'fill="var(--paper)" stroke="var(--muted)" stroke-width="1.25" stroke-dasharray="4 3"',
  risk: 'fill="var(--negative-tint)" stroke="var(--negative)" stroke-width="1.25"',
};
const TEXT_CLS: Record<Status, string> = {
  done: 'rm-label t-sub c-muted',
  current: 'rm-label t-sub c-ink rm-current',
  next: 'rm-label t-sub c-ink',
  later: 'rm-label t-sub c-soft',
  risk: 'rm-label t-sub c-negative',
};
const STATUS_SWATCH: Record<Status, LegendSwatch> = {
  done: 'node-fill2',
  current: 'node-accent-outline',
  next: 'node',
  later: 'node-dashed',
  risk: 'node-negative',
};
const STATUS_ORDER: readonly Status[] = ['done', 'current', 'next', 'later', 'risk'];

/** A placed item: its authored index, its column span, and its lane in the theme row. */
export interface PlacedItem {
  readonly i: number;
  readonly item: Item;
  readonly from: number;
  readonly to: number;
  readonly lane: number;
}

/**
 * Assigns lanes within one theme: each item, in author order, takes the
 * first lane where no earlier item overlaps its column span.
 */
function assignLanes(spans: readonly { i: number; item: Item; from: number; to: number }[]): PlacedItem[] {
  const lanes: { from: number; to: number }[][] = [];
  return spans.map((sp) => {
    let lane = lanes.findIndex((l) => l.every((o) => sp.to < o.from || sp.from > o.to));
    if (lane === -1) {
      lane = lanes.length;
      lanes.push([]);
    }
    lanes[lane]?.push({ from: sp.from, to: sp.to });
    return { ...sp, lane };
  });
}

/** A chip label cut to `px` with "…" when it does not fit (the cut is reported). */
function fit(label: string, px: number, path: string): { text: string; cut: boolean } {
  const w = ellipsize(label, px, CHIP_FONT, { field: 'label', path, hint: 'shorten the label or widen its span' });
  return { text: w.lines[0] ?? '', cut: w.truncated };
}

export function renderRoadmap(data: RoadmapData): string {
  const periods = data.periods;
  const colOf = new Map<string, number>();
  periods.forEach((p, i) => {
    if (!colOf.has(p)) colOf.set(p, i);
  });

  // Themes: the authored list, else first-seen order across the items.
  const themes: string[] = data.themes !== undefined ? [...data.themes] : [];
  if (data.themes === undefined) {
    for (const it of data.items) if (!themes.includes(it.theme)) themes.push(it.theme);
  }

  // Resolve every item to a column span; unknown theme / period → skipped.
  const byTheme = new Map<string, { i: number; item: Item; from: number; to: number }[]>();
  for (const t of themes) byTheme.set(t, []);
  data.items.forEach((item, i) => {
    const row = byTheme.get(item.theme);
    const a = colOf.get(item.from);
    const b = item.to !== undefined ? colOf.get(item.to) : a;
    if (row === undefined || a === undefined || b === undefined) return;
    row.push({ i, item, from: Math.min(a, b), to: Math.max(a, b) });
  });

  const placed = themes.map((t) => assignLanes(byTheme.get(t) ?? []));
  // Columns widen to fit the longest label that spans one period, so the
  // catalog-scale label is never cut; longer spans have room to spare.
  const oneCol = placed.flat().filter((pl) => pl.from === pl.to);
  const wantW = Math.max(0, ...oneCol.map((pl) => textWidth(pl.item.label, CHIP_FONT) + 16 + CHIP_INSET * 2 + 4));
  const themeFits: Wrapped[] = themes.map((t, ti) =>
    fitText(t, { width: THEME_W, font: FONT.name, maxLines: 3, report: { field: 'theme', ...(data.themes !== undefined ? { path: `themes.${ti}` } : {}) } }),
  );
  const themeLines = themeFits.map((w) => w.lines);
  const labelW = PAD + Math.max(60, ...themeLines.map((ls) => Math.max(0, ...ls.map((l) => textWidth(l, FONT.name))))) + 14;
  const gridX = labelW;
  // The labels ask for a width; the page caps it; a floor keeps a column usable.
  const avail = Math.floor((TARGET_W - gridX - PAD) / Math.max(periods.length, 1));
  const COL_W = Math.max(COL_FLOOR, Math.min(Math.min(COL_MAX, Math.max(COL_MIN, Math.ceil(wantW))), avail));
  const gridW = periods.length * COL_W;
  const width = gridX + gridW + PAD;
  const quarters = periods.length > 8 ? quarterRuns(periods) : undefined;
  const headH = HEAD_H + (quarters !== undefined ? QUARTER_H : 0);

  // Row heights: lanes × chip, at least tall enough for the theme label.
  const rowH = placed.map((rows, ti) => {
    const lanes = Math.max(1, ...rows.map((r) => r.lane + 1));
    const chips = lanes * CHIP_H + (lanes - 1) * LANE_GAP;
    const label = (themeLines[ti]?.length ?? 1) * THEME_LINE_H;
    return Math.max(chips, label) + ROW_PAD * 2;
  });
  const gridY = PAD + headH;
  const gridH = rowH.reduce((a, b) => a + b, 0);
  const height = gridY + gridH + PAD;

  const f = (v: number): string => v.toFixed(1);
  const drawn = placed.reduce((a, r) => a + r.length, 0);
  const name = diagramName('Roadmap', data.title, [countPhrase(themes.length, 'theme'), countPhrase(periods.length, 'period'), countPhrase(drawn, 'item')]);
  let s = `<svg viewBox="0 0 ${f(width)} ${f(height)}" role="img" aria-label="${escapeHtml(name)}"><title>${escapeHtml(name)}</title>`;

  // Quarter row (months past eight periods): one label per quarter run, and
  // a firmer rule where each quarter starts.
  if (quarters !== undefined) {
    s += `<g class="rm-quarters">`;
    for (const q of quarters) {
      const x = gridX + q.from * COL_W;
      const w = (q.to - q.from + 1) * COL_W;
      s += `<text x="${f(x + w / 2)}" y="${f(PAD + 10)}" class="t-eyebrow c-ink" text-anchor="middle">${escapeHtml(q.label)}</text>`;
      s += `<line x1="${f(x)}" y1="${f(PAD)}" x2="${f(x)}" y2="${f(gridY + gridH)}" stroke="var(--rule-solid)" stroke-width="1"${DECORATIVE}/>`;
    }
    s += `</g>`;
  }
  // Period header and column hairlines. A period name too wide for a narrow
  // column shows its first three letters (the full name is its tooltip).
  const periodY = PAD + 12 + (quarters !== undefined ? QUARTER_H : 0);
  s += `<g${bl('periods')}>`;
  periods.forEach((p, ci) => {
    const x = gridX + ci * COL_W;
    const short = p.length * 6.4 > COL_W - 6 ? p.slice(0, 3) : p;
    const tip = short !== p ? `<title>${escapeHtml(p)}</title>` : '';
    s += `<text x="${f(x + COL_W / 2)}" y="${f(periodY)}" class="t-eyebrow" text-anchor="middle"${bp(`periods.${ci}`)}>${tip}${escapeHtml(short)}</text>`;
    s += `<line x1="${f(x)}" y1="${f(gridY)}" x2="${f(x)}" y2="${f(gridY + gridH)}" stroke="var(--rule)" stroke-width="1"${DECORATIVE}/>`;
  });
  s += `</g>`;
  s += `<line x1="${f(gridX + gridW)}" y1="${f(gridY)}" x2="${f(gridX + gridW)}" y2="${f(gridY + gridH)}" stroke="var(--rule)" stroke-width="1"${DECORATIVE}/>`;
  s += `<line x1="${f(PAD)}" y1="${f(gridY)}" x2="${f(gridX + gridW)}" y2="${f(gridY)}" stroke="var(--rule-solid)" stroke-width="1"/>`;

  // The "now" rule at the start of its period — drawn before the chips, so a
  // chip sits on top of it and its label stays whole.
  const nowCol = data.now !== undefined ? colOf.get(data.now) : undefined;
  if (nowCol !== undefined) {
    const x = gridX + nowCol * COL_W;
    s +=
      `<g class="rm-now"${bp('now')}>` +
      `<line x1="${f(x)}" y1="${f(gridY)}" x2="${f(x)}" y2="${f(gridY + gridH + 6)}" stroke="var(--ink)" stroke-width="1.25" stroke-dasharray="4 3"/>` +
      // The tag sits under the grid, clear of the period header.
      `<text x="${f(x)}" y="${f(gridY + gridH + 15)}" class="t-eyebrow c-ink" text-anchor="middle">now</text>` +
      `</g>`;
  }

  // Theme rows: label at the left, a hairline under each row.
  const present = new Set<Status>();
  let y = gridY;
  s += `<g${bl('items')}>`;
  themes.forEach((t, ti) => {
    const h = rowH[ti] ?? CHIP_H + ROW_PAD * 2;
    const lines = themeLines[ti] ?? [t];
    const ty0 = y + h / 2 - ((lines.length - 1) * THEME_LINE_H) / 2 + 4.5;
    const themePath = data.themes !== undefined ? bp(`themes.${ti}`) : '';
    lines.forEach((line, li) => {
      const tip = li === 0 ? cutTitle(themeFits[ti] ?? { truncated: false, full: '' }) : '';
      s += `<text x="${f(PAD)}" y="${f(ty0 + li * THEME_LINE_H)}" class="t-name c-ink rm-theme"${li === 0 ? themePath : ''}>${tip}${escapeHtml(line)}</text>`;
    });
    for (const pl of placed[ti] ?? []) {
      const status: Status = pl.item.status ?? 'next';
      present.add(status);
      const x = gridX + pl.from * COL_W + CHIP_INSET;
      const w = (pl.to - pl.from + 1) * COL_W - CHIP_INSET * 2;
      const cy = y + ROW_PAD + pl.lane * (CHIP_H + LANE_GAP);
      const lab = fit(pl.item.label, w - 16, `items.${pl.i}.label`);
      const title = pl.item.note !== undefined ? `${pl.item.label} — ${pl.item.note}` : pl.item.label;
      // A label too long for its chip runs on beside it when the lane is free
      // to the right (up to the next chip, or the grid's end); only when it
      // is not does the label take an ellipsis.
      const nextFrom = Math.min(
        periods.length,
        ...(placed[ti] ?? []).filter((o) => o.lane === pl.lane && o.from > pl.to).map((o) => o.from),
      );
      const room = gridX + nextFrom * COL_W - CHIP_INSET - (x + w + 6);
      const beside = lab.cut && textWidth(pl.item.label, CHIP_FONT) <= room;
      const text = beside
        ? `<text x="${f(x + w + 6)}" y="${f(cy + CHIP_H / 2 + 3.5)}" class="${TEXT_CLS[status]} rm-beside"${bp(`items.${pl.i}.label`)}>${escapeHtml(pl.item.label)}</text>`
        : `<text x="${f(x + 8)}" y="${f(cy + CHIP_H / 2 + 3.5)}" class="${TEXT_CLS[status]}"${bp(`items.${pl.i}.label`)}>${escapeHtml(lab.text)}</text>`;
      s +=
        `<g class="rm-item rm-${status}"${bp(`items.${pl.i}`)}>` +
        `<title>${escapeHtml(title)}</title>` +
        `<rect x="${f(x)}" y="${f(cy)}" width="${f(w)}" height="${CHIP_H}" rx="3" ${CHIP_ATTRS[status]}/>` +
        text +
        `</g>`;
    }
    y += h;
    s += `<line x1="${f(PAD)}" y1="${f(y)}" x2="${f(gridX + gridW)}" y2="${f(y)}" stroke="var(--rule)" stroke-width="1"${DECORATIVE}/>`;
  });
  s += `</g>`;

  s += `</svg>`;

  const legend: LegendItem[] = STATUS_ORDER.filter((st) => present.has(st)).map((st) => ({
    swatch: STATUS_SWATCH[st],
    label: st === 'current' ? 'current — in progress' : st === 'next' ? 'next / planned' : st,
  }));
  if (nowCol !== undefined) legend.push({ swatch: 'line-dashed', stroke: 'var(--ink)', label: 'now' });
  const legendHtml = renderLegend(legend);

  return diagramFrame(
    {
      tag: 'ROADMAP',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legendHtml.length > 0 ? { legendHtml } : {}),
    },
    s,
  );
}
