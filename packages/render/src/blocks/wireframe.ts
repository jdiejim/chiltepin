/**
 * Renders UI mockups — low-fidelity wireframes inside device frames
 * (desktop window, browser, or phone). Each screen is a vertical stack of
 * UI elements (header, button, list, card, …) drawn as neutral placeholders,
 * Excalidraw-flavoured.
 *
 * Screens lay out left-to-right in a row. Element heights are fixed per type,
 * plus a line for each extra line a long label wraps to; the frame grows to
 * fit its content (phones keep a minimum height). A label that passes its
 * line cap ends with "…", keeps its full text in a `<title>`, and is reported
 * as a cut — no label runs past its element or its device frame.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { cutTitle, ellipsize, fitText, textWidth, type CutSite, type Font, type Wrapped } from '../svg/wrapText.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';
import { DECORATIVE } from '../svg/decorative.js';

type Screen = NonNullable<BlockDataMap['wireframe']['screens']>[number];
type Element = NonNullable<Screen['elements']>[number];

/** Inner content width per device (the drawable area inside the frame chrome). */
function contentWidth(device: string): number {
  if (device === 'phone') return 200;
  return 380; // desktop / browser
}

/** The faces the mockup text sets in (`.wf-*` in css.ts). */
const WF_H: Font = { size: 18, weight: 700 };
const WF_SUB: Font = { size: 12, weight: 600 };
const WF_BTN: Font = { size: 11, weight: 700 };
const WF_PH: Font = { size: 10 };
const WF_TAB: Font = { size: 8 };
const WF_STATUS: Font = { size: 9, mono: true };
const WF_URL: Font = { size: 8.5, mono: true };
const WF_CAPTION: Font = { size: 10, mono: true, tracking: 0.04 };

/** Line steps of the wrapping labels. */
const H_LH = 22;
const SUB_LH = 15;
const BTN_LH = 13;

/** A label's lines at a width, with an optional cut report (draw time only). */
function lines(label: string, width: number, font: Font, maxLines: number, report?: CutSite): Wrapped {
  return fitText(label, { width, font, maxLines, ...(report !== undefined ? { report } : {}) });
}

/** The cut site of an element's label. */
const elSite = (path: string | undefined): CutSite | undefined =>
  path === undefined ? undefined : { path: `${path}.label`, field: 'label', hint: 'Shorten the element `label`.' };

/** The nav pills in rows that fit `w` (a long nav wraps to a second row). */
function navRows(items: readonly string[], w: number): Array<Array<{ text: string; pw: number }>> {
  const rows: Array<Array<{ text: string; pw: number }>> = [[]];
  let used = 0;
  for (const it of items) {
    const pw = Math.min(w, 16 + textWidth(it, WF_PH));
    const row = rows[rows.length - 1] as Array<{ text: string; pw: number }>;
    if (row.length > 0 && used + pw > w) {
      rows.push([{ text: it, pw }]);
      used = pw + 8;
    } else {
      row.push({ text: it, pw });
      used += pw + 8;
    }
  }
  return rows;
}

const navItems = (el: Element): string[] => (el.label || 'Home, Docs, Pricing, About').split(',').map((t) => t.trim());

/** Line step of a tab name that wraps to a second line. */
const TAB_LH = 9;

/** The tab bar's names, each wrapped to its segment (two lines at most). */
function tabLines(el: Element, w: number, site?: CutSite): Wrapped[] {
  const items = (el.label || 'Home, Search, Bell, Profile').split(',').map((t) => t.trim());
  const seg = w / items.length;
  return items.map((it) => lines(it, seg - 4, WF_TAB, 2, site));
}

/** Vertical space one element consumes (its drawn height + the gap below) in a column `w` wide. */
function elementHeight(el: Element, w: number): number {
  const rows = Math.max(1, el.rows ?? 1);
  const label = el.label ?? '';
  switch (el.type) {
    case 'header':
      return 34 + (lines(label, w, WF_H, 3).lines.length - 1) * H_LH;
    case 'subheader':
      return 26 + (Math.max(1, lines(label, w, WF_SUB, 3).lines.length) - 1) * SUB_LH;
    case 'text':
      return 16 + (rows - 1) * 12;
    case 'button':
      return 42 + (Math.max(1, lines(label, w - 24, WF_BTN, 2).lines.length) - 1) * BTN_LH;
    case 'input':
    case 'search':
      return 42;
    case 'image':
      return 96;
    case 'avatar':
      return 52 + Math.max(0, lines(label, w - 52, WF_SUB, 3).lines.length - 2) * SUB_LH;
    case 'card':
      return rows * 64 + (rows - 1) * 10;
    case 'list':
      return rows * 40;
    case 'nav':
      return 34 * navRows(navItems(el), w).length;
    case 'tabs':
      return 52 + (tabLines(el, w).some((t) => t.lines.length > 1) ? TAB_LH : 0);
    case 'divider':
      return 14;
    case 'badge':
      return 26;
    case 'toggle':
      return 30 + (Math.max(1, lines(label, w - 54, WF_SUB, 2).lines.length) - 1) * SUB_LH;
    case 'spacer':
      return 18 * rows;
    default:
      return 24;
  }
}

const PH = 'fill="var(--paper-2)" stroke="var(--rule-solid)" stroke-width="1"';

/** `<text>` lines of a wrapped label: the first carries the cut title. */
function textLines(w: Wrapped, x: number, y: number, lh: number, attrs: string): string {
  return w.lines
    .map((ln, j) => `<text x="${x}" y="${y + j * lh}"${attrs}>${j === 0 ? cutTitle(w) : ''}${escapeHtml(ln)}</text>`)
    .join('');
}

/** The avatar's label beside the circle: one line centred on it, two or three from its top. */
function avatarLabel(t: Wrapped, x: number, y: number): string {
  const y0 = t.lines.length <= 1 ? y + 27 : y + 20;
  return textLines(t, x, y0, SUB_LH, ' class="wf-sub" fill="var(--charcoal)"');
}

/** Draws one element at (x, y) within a content column of width w. Returns SVG. */
function drawElement(el: Element, x: number, y: number, w: number, path?: string): string {
  const site = elSite(path);
  const rows = Math.max(1, el.rows ?? 1);
  const label = el.label ?? '';
  // Tones by fill: default = ink (paper text), danger = negative (paper text),
  // muted = paper-2 with ink text — the only filled shapes in a mockup.
  const accent =
    el.tone === 'danger'
      ? 'var(--negative)'
      : el.tone === 'muted'
        ? 'var(--paper-2)'
        : 'var(--ink)';
  const btnText = el.tone === 'muted' ? 'wf-btn on-light' : 'wf-btn';
  const btnStroke = el.tone === 'muted' ? ' stroke="var(--rule-solid)" stroke-width="1"' : '';
  const anchorX = el.align === 'c' ? x + w / 2 : el.align === 'r' ? x + w : x;
  const anchor = el.align === 'c' ? 'middle' : el.align === 'r' ? 'end' : 'start';

  switch (el.type) {
    case 'header':
      return textLines(lines(label || 'Heading', w, WF_H, 3, site), anchorX, y + 22, H_LH, ` class="wf-h" fill="var(--charcoal)" text-anchor="${anchor}"`);
    case 'subheader':
      return textLines(lines(label || 'Subheading', w, WF_SUB, 3, site), anchorX, y + 17, SUB_LH, ` class="wf-sub" fill="var(--gray)" text-anchor="${anchor}"`);
    case 'text': {
      let s = '';
      for (let i = 0; i < rows; i++) {
        const lw = i === rows - 1 ? w * 0.66 : w;
        s += `<rect x="${x}" y="${y + i * 12}" width="${lw}" height="6" rx="3" fill="var(--rule)"/>`;
      }
      return s;
    }
    case 'button': {
      const t = lines(label || 'Button', w - 24, WF_BTN, 2, site);
      const bh = 34 + (Math.max(1, t.lines.length) - 1) * BTN_LH;
      return (
        `<rect x="${x}" y="${y}" width="${w}" height="${bh}" rx="6" fill="${accent}"${btnStroke}/>` +
        textLines(t, x + w / 2, y + 22, BTN_LH, ` class="${btnText}" text-anchor="middle"`)
      );
    }
    case 'input':
    case 'search': {
      const icon =
        el.type === 'search'
          ? `<circle cx="${x + 16}" cy="${y + 17}" r="5" fill="none" stroke="var(--gray)" stroke-width="1.4"/><path d="M${x + 20} ${y + 21} l4 4" stroke="var(--gray)" stroke-width="1.4"/>`
          : '';
      const tx = el.type === 'search' ? x + 30 : x + 12;
      const ph = ellipsize(label || 'Type here…', x + w - 10 - tx, WF_PH, site);
      return (
        `<rect x="${x}" y="${y}" width="${w}" height="34" rx="8" fill="var(--white)" stroke="var(--rule-solid)" stroke-width="1.2"/>` +
        icon +
        `<text x="${tx}" y="${y + 21}" class="wf-ph-text">${cutTitle(ph)}${escapeHtml(ph.lines[0] ?? '')}</text>`
      );
    }
    case 'image':
      return (
        `<rect x="${x}" y="${y}" width="${w}" height="88" rx="8" ${PH}/>` +
        `<path d="M${x} ${y + 88} L${x + w * 0.4} ${y + 40} L${x + w * 0.62} ${y + 66} L${x + w * 0.78} ${y + 50} L${x + w} ${y + 88}" fill="none" stroke="var(--gray)" stroke-width="1.3"/>` +
        `<circle cx="${x + w * 0.74} " cy="${y + 26}" r="7" fill="none" stroke="var(--gray)" stroke-width="1.3"/>`
      );
    case 'avatar':
      return (
        `<circle cx="${x + 22}" cy="${y + 22}" r="20" ${PH}/>` +
        `<circle cx="${x + 22}" cy="${y + 17}" r="7" fill="var(--gray)"/>` +
        `<path d="M${x + 9} ${y + 40} a13 11 0 0 1 26 0" fill="var(--gray)"/>` +
        (label ? avatarLabel(lines(label, w - 52, WF_SUB, 3, site), x + 52, y) : '')
      );
    case 'card': {
      let s = '';
      for (let i = 0; i < rows; i++) {
        const cy = y + i * 74;
        s +=
          `<rect x="${x}" y="${cy}" width="${w}" height="64" rx="10" fill="var(--white)" stroke="var(--rule-solid)" stroke-width="1.2"/>` +
          `<rect x="${x + 12}" y="${cy + 12}" width="40" height="40" rx="8" ${PH}/>` +
          `<rect x="${x + 64}" y="${cy + 16}" width="${w - 92}" height="7" rx="3.5" fill="var(--rule)"/>` +
          `<rect x="${x + 64}" y="${cy + 34}" width="${(w - 92) * 0.6}" height="6" rx="3" fill="var(--rule)"/>`;
      }
      const cap = label
        ? `<text x="${x + 64}" y="${y + 30}" class="wf-ph-text"></text>`
        : '';
      return s + cap;
    }
    case 'list': {
      let s = '';
      for (let i = 0; i < rows; i++) {
        const ly = y + i * 40;
        s +=
          `<circle cx="${x + 16}" cy="${ly + 20}" r="12" ${PH}/>` +
          `<rect x="${x + 38}" y="${ly + 12}" width="${w - 76}" height="6" rx="3" fill="var(--rule)"/>` +
          `<rect x="${x + 38}" y="${ly + 24}" width="${(w - 76) * 0.55}" height="5" rx="2.5" fill="var(--rule)"/>` +
          `<path d="M${x + w - 14} ${ly + 15} l5 5 l-5 5" fill="none" stroke="var(--gray)" stroke-width="1.4"/>` +
          (i < rows - 1
            ? `<line x1="${x + 38}" y1="${ly + 40}" x2="${x + w}" y2="${ly + 40}" stroke="var(--light-gray)" stroke-width="1"/>`
            : '');
      }
      return s;
    }
    case 'nav': {
      // Rows of pill items (label is comma-separated item names); a nav
      // wider than the column wraps to a second row instead of spilling.
      let s = '';
      navRows(navItems(el), w).forEach((row, ri) => {
        let nx = x;
        for (const it of row) {
          const t = ellipsize(it.text, it.pw - 12, WF_PH, site);
          s +=
            `<rect x="${nx}" y="${y + 4 + ri * 34}" width="${it.pw}" height="22" rx="11" fill="var(--light-gray)"/>` +
            `<text x="${nx + it.pw / 2}" y="${y + 19 + ri * 34}" class="wf-ph-text" text-anchor="middle">${cutTitle(t)}${escapeHtml(t.lines[0] ?? '')}</text>`;
          nx += it.pw + 8;
        }
      });
      return s;
    }
    case 'tabs': {
      const items = (label || 'Home, Search, Bell, Profile').split(',').map((t) => t.trim());
      const seg = w / items.length;
      let s = `<line x1="${x}" y1="${y}" x2="${x + w}" y2="${y}" stroke="var(--rule)" stroke-width="1"${DECORATIVE}/>`;
      // A tab name wider than its segment wraps to a second line; past that it ends with "…".
      const names = tabLines(el, w, site);
      items.forEach((_it, i) => {
        const cx = x + seg * i + seg / 2;
        const t = names[i] ?? { lines: [], truncated: false, full: '' };
        s +=
          `<circle cx="${cx}" cy="${y + 18}" r="8" fill="none" stroke="${i === 0 ? accent : 'var(--gray)'}" stroke-width="1.6"/>` +
          textLines(t, cx, y + 42, TAB_LH, ` class="wf-tab" text-anchor="middle" fill="${i === 0 ? accent : 'var(--gray)'}"`);
      });
      return s;
    }
    case 'divider':
      return `<line x1="${x}" y1="${y + 7}" x2="${x + w}" y2="${y + 7}" stroke="var(--rule)" stroke-width="1"${DECORATIVE}/>`;
    case 'badge': {
      const t = ellipsize(label || 'New', w - 22, WF_BTN, site);
      const pw = Math.min(w, 22 + textWidth(t.lines[0] ?? '', WF_BTN));
      return (
        `<rect x="${anchorX - (anchor === 'middle' ? pw / 2 : anchor === 'end' ? pw : 0)}" y="${y}" width="${pw}" height="22" rx="11" fill="${accent}"${btnStroke}/>` +
        `<text x="${anchorX - (anchor === 'middle' ? 0 : anchor === 'end' ? pw / 2 : -pw / 2)}" y="${y + 15}" class="${btnText}" text-anchor="middle">${cutTitle(t)}${escapeHtml(t.lines[0] ?? '')}</text>`
      );
    }
    case 'toggle':
      return (
        (label ? textLines(lines(label, w - 54, WF_SUB, 2, site), x, y + 19, SUB_LH, ' class="wf-sub" fill="var(--charcoal)"') : '') +
        `<rect x="${x + w - 44}" y="${y + 6}" width="44" height="22" rx="11" fill="${accent}"${btnStroke}/>` +
        `<circle cx="${x + w - 16}" cy="${y + 17}" r="8" fill="var(--paper)" stroke="var(--rule-solid)" stroke-width="1"/>`
      );
    case 'spacer':
      return '';
    default:
      return '';
  }
}

/** The cut site of a screen's title. */
const titleSite = (idx: number): CutSite => ({ path: `screens.${idx}.title`, field: 'title', hint: 'Shorten the screen `title`.' });

/**
 * A short id stem from the block's own data (FNV-1a), so two wireframes on
 * one page never share a `clipPath` id — the second would clip to the
 * first's frame — and the output stays deterministic.
 */
function idStem(data: unknown): string {
  let h = 0x811c9dc5;
  for (const ch of JSON.stringify(data) ?? '') {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/** Renders one device frame and its stacked content. Returns {svg, width, height}. */
function drawScreen(screen: Screen, idx: number, stem = ''): { svg: string; width: number; height: number } {
  const device = screen.device ?? 'browser';
  const cw = contentWidth(device);
  const pad = 16;
  const els = screen.elements ?? [];
  let contentH = 0;
  for (const el of els) contentH += elementHeight(el, cw) + 10;
  contentH = Math.max(contentH, 80);

  // chrome heights
  const isPhone = device === 'phone';
  const isBrowser = device === 'browser';
  const titleBarH = 30;
  const addressBarH = isBrowser ? 26 : 0;
  const chromeTop = titleBarH + addressBarH;
  const homeBarH = isPhone ? 24 : 0;

  const frameW = cw + pad * 2;
  const screenH = contentH + pad;
  const frameH = chromeTop + screenH + homeBarH;
  const rx = isPhone ? 30 : 14;
  const sw = isPhone ? 2.4 : 1.8;
  const clip = `wfclip${stem}${idx}`;

  // Inner chrome + content, drawn first and clipped to the rounded frame so
  // nothing spills the corners. The border stroke is drawn LAST, on top, so the
  // outline is always crisp and visible above the fills.
  let inner = '';
  if (isPhone) {
    inner += `<rect x="0" y="0" width="${frameW}" height="${titleBarH}" fill="var(--light-gray)"/>`;
    inner += `<rect x="${frameW / 2 - 26}" y="6" width="52" height="9" rx="4.5" fill="var(--charcoal)"/>`;
    if (screen.title) {
      // The status bar holds the title left of the notch: cut with "…" past it.
      // Left of the notch (52px, centred), like a status bar's clock.
      const t = ellipsize(screen.title, frameW / 2 - 26 - 8 - 16, WF_STATUS, titleSite(idx));
      inner += `<text x="16" y="20" class="wf-status"${bp(`screens.${idx}.title`)}>${cutTitle(t)}${escapeHtml(t.lines[0] ?? '')}</text>`;
    }
    inner += `<text x="${frameW - 16}" y="20" class="wf-status" text-anchor="end">100%</text>`;
  } else {
    inner += `<rect x="0" y="0" width="${frameW}" height="${titleBarH}" fill="var(--light-gray)"/>`;
    inner += `<line x1="0" y1="${titleBarH}" x2="${frameW}" y2="${titleBarH}" stroke="var(--rule)" stroke-width="1"${DECORATIVE}/>`;
    inner += `<circle cx="18" cy="15" r="5" fill="var(--rule-solid)"/><circle cx="34" cy="15" r="5" fill="var(--rule-solid)"/><circle cx="50" cy="15" r="5" fill="var(--rule-solid)"/>`;
    if (screen.title && !isBrowser) {
      // Centred between the window dots and the right edge: cut with "…" past it.
      const t = ellipsize(screen.title, frameW - 2 * 64, WF_STATUS, titleSite(idx));
      inner += `<text x="${frameW / 2}" y="20" class="wf-status" text-anchor="middle"${bp(`screens.${idx}.title`)}>${cutTitle(t)}${escapeHtml(t.lines[0] ?? '')}</text>`;
    }
    if (isBrowser) {
      const url = screen.url ?? screen.title ?? 'example.com';
      const field = screen.url !== undefined ? 'url' : 'title';
      const t = ellipsize(url, frameW - 84 - 20, WF_URL, { path: `screens.${idx}.${field}`, field, hint: 'Shorten the screen `url`.' });
      inner += `<rect x="68" y="${titleBarH + 5}" width="${frameW - 84}" height="16" rx="8" fill="var(--white)" stroke="var(--rule-solid)" stroke-width="1"/>`;
      inner += `<text x="78" y="${titleBarH + 16}" class="wf-url"${bp(`screens.${idx}.url`)}>${cutTitle(t)}${escapeHtml(t.lines[0] ?? '')}</text>`;
    }
  }

  let cy = chromeTop + pad;
  inner += `<g${bl(`screens.${idx}.elements`)}>`;
  els.forEach((el, j) => {
    inner += `<g${bp(`screens.${idx}.elements.${j}`)}>${drawElement(el, pad, cy, cw, `screens.${idx}.elements.${j}`)}</g>`;
    cy += elementHeight(el, cw) + 10;
  });
  inner += `</g>`; // close the elements list container
  if (isPhone) {
    inner += `<rect x="${frameW / 2 - 30}" y="${frameH - 15}" width="60" height="5" rx="2.5" fill="var(--charcoal)" opacity="0.55"/>`;
  }

  const s =
    `<g>` +
    `<defs><clipPath id="${clip}"><rect x="0" y="0" width="${frameW}" height="${frameH}" rx="${rx}"/></clipPath></defs>` +
    // solid paper backing under the chrome and content (no shadow — DESIGN.md)
    `<rect x="0" y="0" width="${frameW}" height="${frameH}" rx="${rx}" fill="var(--paper)"/>` +
    `<g clip-path="url(#${clip})">${inner}</g>` +
    // border on top — always visible above the fills
    `<rect x="0" y="0" width="${frameW}" height="${frameH}" rx="${rx}" fill="none" stroke="var(--ink)" stroke-width="${sw}"/>` +
    `</g>`;
  return { svg: s, width: frameW, height: frameH };
}

export function renderWireframe(data: BlockDataMap['wireframe']): string {
  const screens = data.screens ?? [];
  const gap = 36;
  const capH = 22;
  const padX = 8;
  const padY = 8;

  const stem = `${idStem(screens)}-`;
  const drawn = screens.map((screen, i) => drawScreen(screen, i, stem));
  const totalW = drawn.reduce((a, d) => a + d.width, 0) + gap * Math.max(0, drawn.length - 1);
  const maxH = drawn.reduce((a, d) => Math.max(a, d.height), 0);
  // Captions wrap under their screen (up to four lines); the band grows for the longest.
  const captions = screens.map((screen, i) => {
    const cap = screen.label;
    const d = drawn[i];
    if (cap === undefined || cap.length === 0 || d === undefined) return undefined;
    return fitText(cap, {
      width: d.width,
      font: WF_CAPTION,
      maxLines: 4,
      report: { path: `screens.${i}.label`, field: 'label', hint: 'Shorten the screen `label`, or move it to the prose.' },
    });
  });
  const capLines = Math.max(2, ...captions.map((c) => c?.lines.length ?? 0));
  const width = totalW + padX * 2;
  const height = maxH + capH + (capLines - 2) * 12 + padY * 2;

  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"><title>${escapeHtml(data.title ?? 'UI mockup')}</title>`;
  s += `<g${bl('screens')}>`;
  let x = padX;
  drawn.forEach((d, i) => {
    const screen = screens[i];
    s += `<g transform="translate(${x}, ${padY})"${bp(`screens.${i}`)}>${d.svg}</g>`;
    const cap = captions[i];
    if (screen !== undefined && cap !== undefined) {
      s += `<g${bp(`screens.${i}.label`)}>${cutTitle(cap)}`;
      cap.lines.forEach((ln, j) => {
        s += `<text x="${x + d.width / 2}" y="${padY + maxH + 16 + j * 12}" class="wf-caption" text-anchor="middle">${escapeHtml(ln)}</text>`;
      });
      s += `</g>`;
    }
    x += d.width + gap;
  });
  s += `</g>`; // close the screens list container
  s += `</svg>`;

  return diagramFrame(
    {
      tag: 'UI',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    s,
  );
}
