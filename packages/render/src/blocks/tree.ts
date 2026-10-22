/**
 * Renders a `tree` block — an indented hierarchy of nodes, like a folder
 * tree. Nodes are linked via `parent` id. Roots are nodes without a `parent`
 * (or whose parent id is unknown). Children are indented based on depth.
 *
 * `variant: issue` (the former `mece` type) renders a MECE issue tree
 * instead — a left-to-right hierarchical SVG tree inside the diagram frame.
 * Layout uses DFS positioning: leaves stack vertically, branches center over
 * their first/last child.
 *
 * `variant: org` renders a top-down org chart — tidy subtree-width packing,
 * parents centered over their children, node `role` muted under the label.
 *
 * Skin (`DESIGN.md`) for both SVG variants: paper cards with an ink outline;
 * the root — the question or the head of the org — is the one accent; leaves
 * of an issue tree (the testable claims) are the secondary `paper-2` card.
 * Links are `muted` elbows. No depth colours, no shadows.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { cutTitle, fitText, FONT, reportCut, textWidth, type Wrapped } from '../svg/wrapText.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';

type TreeData = BlockDataMap['tree'];
type Node = NonNullable<TreeData['nodes']>[number];

/** A card's outline per role: the accent root, a primary branch, a secondary leaf. */
type Card = 'root' | 'branch' | 'leaf';

const CARD_ATTRS: Record<Card, string> = {
  root: 'fill="var(--accent-tint)" stroke="var(--accent)" stroke-width="1.5"',
  branch: 'fill="var(--paper)" stroke="var(--ink)" stroke-width="1.5"',
  leaf: 'fill="var(--paper-2)" stroke="var(--rule-solid)" stroke-width="1"',
};

const LINK_ATTRS = 'fill="none" stroke="var(--muted)" stroke-width="1.25"';

// ─── variant: issue (MECE issue tree — the former `mece` type) ───────────────

/** Line height of an issue-tree card label, and the tallest a card grows. */
const ISSUE_LH = 14;
const ISSUE_MAX_H = 104;

/** `35% of parent` as `35%`; `''` with no parent value to share. */
function shareOf(v: number, parent: number | undefined): string {
  return typeof parent === 'number' && parent > 0 ? `${Math.round((v / parent) * 100)}%` : '';
}

function renderIssueTree(data: TreeData): string {
  const nodes = data.nodes ?? [];
  const byId = new Map<string, Node>();
  const children = new Map<string, string[]>();
  for (const n of nodes) {
    byId.set(n.id, n);
    children.set(n.id, []);
  }
  const roots: string[] = [];
  for (const n of nodes) {
    if (n.parent !== undefined && byId.has(n.parent)) children.get(n.parent)?.push(n.id);
    else roots.push(n.id);
  }

  const pos = new Map<string, number>();
  const depth = new Map<string, number>();
  const seen = new Set<string>();
  let leaf = 0;
  let maxDepth = 0;
  const dfs = (id: string, d: number): void => {
    if (seen.has(id)) return;
    seen.add(id);
    depth.set(id, d);
    if (d > maxDepth) maxDepth = d;
    const ch = children.get(id) ?? [];
    if (ch.length === 0) {
      pos.set(id, leaf);
      leaf += 1;
    } else {
      for (const c of ch) dfs(c, d + 1);
      const first = pos.get(ch[0] ?? '') ?? 0;
      const last = pos.get(ch[ch.length - 1] ?? '') ?? 0;
      pos.set(id, (first + last) / 2);
    }
  };
  for (const r of roots) dfs(r, 0);

  // Each card: the label (wrapped), the note under it, and — when the tree
  // carries values — the value and its share of the parent at the right. One
  // card size for the whole tree, tall enough for the longest card.
  const valueOf = (n: Node): { own: string; share: string } | undefined => {
    if (typeof n.value !== 'number') return undefined;
    const parent = n.parent !== undefined ? byId.get(n.parent) : undefined;
    return { own: fmtValue(n.value, data.unit), share: shareOf(n.value, parent?.value) };
  };
  const valueW = Math.max(
    0,
    ...nodes.map((n) => {
      const v = valueOf(n);
      return v === undefined ? 0 : Math.max(textWidth(v.own, FONT.name), textWidth(v.share, FONT.sub)) + 10;
    }),
  );
  const nodeW = 168 + Math.ceil(valueW);
  const textW = 168 - 28;
  const fitCard = (n: Node, lines: number): { label: Wrapped; note: Wrapped } => ({
    label: fitText(n.label, { width: textW, font: FONT.name, maxLines: lines }),
    note: fitText(n.note, { width: textW, font: FONT.sub, maxLines: 2 }),
  });
  const cardH = (c: { label: Wrapped; note: Wrapped }): number =>
    c.label.lines.length * ISSUE_LH + (c.note.lines.length > 0 ? 3 + c.note.lines.length * 12 : 0) + 20;
  const nodeH = Math.min(ISSUE_MAX_H, Math.max(50, ...nodes.map((n) => cardH(fitCard(n, 4)))));
  const gapY = 16;
  const colGap = 56;
  const padX = 24;
  const padTop = 18;
  const padBot = 18;
  const xOf = (id: string): number => padX + (depth.get(id) ?? 0) * (nodeW + colGap);
  const yOf = (id: string): number => padTop + (pos.get(id) ?? 0) * (nodeH + gapY);
  const width = padX * 2 + (maxDepth + 1) * nodeW + maxDepth * colGap;
  const height = padTop + Math.max(leaf, 1) * (nodeH + gapY) - gapY + padBot;

  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"><title>Issue tree</title>`;

  // links
  for (const n of nodes) {
    if (n.parent === undefined || !byId.has(n.parent) || !pos.has(n.id)) continue;
    const px = xOf(n.parent) + nodeW;
    const pcy = yOf(n.parent) + nodeH / 2;
    const cx = xOf(n.id);
    const ccy = yOf(n.id) + nodeH / 2;
    const midX = (px + cx) / 2;
    s += `<path ${LINK_ATTRS} d="M ${px} ${pcy} H ${midX} V ${ccy} H ${cx}"/>`;
  }

  const cards = new Set<Card>();
  s += `<g${bl('nodes')}>`;
  nodes.forEach((n, ni) => {
    if (!pos.has(n.id)) return;
    const x = xOf(n.id);
    const y = yOf(n.id);
    const d = depth.get(n.id) ?? 0;
    const card: Card = d === 0 ? 'root' : (children.get(n.id) ?? []).length > 0 ? 'branch' : 'leaf';
    cards.add(card);
    const rect = `<rect x="${x}" y="${y}" width="${nodeW}" height="${nodeH}" rx="4" ${CARD_ATTRS[card]}/>`;
    // The most label lines the card holds beside the note; a longer label ends in "…".
    let fit = fitCard(n, 4);
    for (let lines = 3; cardH(fit) > nodeH && lines >= 1; lines--) fit = fitCard(n, lines);
    if (fit.label.truncated) {
      reportCut({ path: `nodes.${ni}.label`, field: 'label', full: fit.label.full, hint: 'Shorten the `label`, or move the detail to `note`.' });
    }
    if (fit.note.truncated) {
      reportCut({ path: `nodes.${ni}.note`, owner: n.label, field: 'note', full: fit.note.full, hint: 'Shorten the `note`.' });
    }
    const labelX = card === 'root' ? x + 14 + textW / 2 : x + 14;
    const anchor = card === 'root' ? 'middle' : 'start';
    const blockH = cardH(fit) - 20;
    const top = y + (nodeH - blockH) / 2;
    const cls = card === 'root' ? 't-name c-accent' : 't-name';
    const labelTexts = fit.label.lines
      .map(
        (ln, j) =>
          `<text x="${labelX}" y="${(top + 10 + j * ISSUE_LH).toFixed(1)}" class="${cls}" text-anchor="${anchor}">${j === 0 ? cutTitle(fit.label) : ''}${escapeHtml(ln)}</text>`,
      )
      .join('');
    const noteTop = top + fit.label.lines.length * ISSUE_LH + 3;
    const note = fit.note.lines
      .map(
        (ln, j) =>
          `<text x="${labelX}" y="${(noteTop + 9 + j * 12).toFixed(1)}" class="t-sub c-muted" text-anchor="${anchor}">${j === 0 ? cutTitle(fit.note) : ''}${escapeHtml(ln)}</text>`,
      )
      .join('');
    // The value, and the share of its parent it accounts for, at the right.
    const v = valueOf(n);
    const value =
      v === undefined
        ? ''
        : `<text x="${x + nodeW - 12}" y="${(y + nodeH / 2 - (v.share !== '' ? 2 : -4)).toFixed(1)}" class="${cls}" text-anchor="end"${bp(`nodes.${ni}.value`)}>${escapeHtml(v.own)}</text>` +
          (v.share !== ''
            ? `<text x="${x + nodeW - 12}" y="${(y + nodeH / 2 + 11).toFixed(1)}" class="t-sub c-muted" text-anchor="end">${escapeHtml(v.share)}</text>`
            : '');
    s += `<g${bp(`nodes.${ni}`)}>` + rect + labelTexts + note + value + `</g>`;
  });
  s += `</g>`; // close the nodes list container

  s += `</svg>`;
  const items: LegendItem[] = [];
  if (cards.has('root')) items.push({ swatch: 'node-accent', label: 'question' });
  if (cards.has('branch')) items.push({ swatch: 'node', label: 'branch' });
  if (cards.has('leaf')) items.push({ swatch: 'node-fill2', label: 'testable claim' });
  const legendHtml = renderLegend(items);
  return diagramFrame(
    {
      tag: 'MECE',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legendHtml.length > 0 ? { legendHtml } : {}),
    },
    s,
  );
}

// ─── variant: org (top-down org chart) ───────────────────────────────────────
// Tidy top-down layout: a leaf takes one slot, a branch takes the sum of its
// children's slots, and every parent is centered over its children — so a
// wide level packs without overlap and the viewBox simply grows. Nodes are
// rounded cards: label bold (wrapped to two lines, ellipsized past that, the
// full text in <title>), `role` muted underneath. Links are vertical elbows.
// The root card takes the accent; every other card is a calm paper card.

const ORG_W = 148;
/** A card's height when its text fits (it grows, to {@link ORG_MAX_H}, when not). */
const ORG_BASE_H = 58;
const ORG_MAX_H = 112;
const ORG_HGAP = 18;
const ORG_VGAP = 34;
const ORG_SLOT = ORG_W + ORG_HGAP;
/** The width of a card's text column. */
const ORG_TEXT_W = ORG_W - 12;
const ORG_NAME_LH = 14;
const ORG_SUB_LH = 12;
// A parent with more than this many LEAF children stacks those leaves in up
// to two columns under itself — a wide rank stays readable instead of
// stretching the viewBox until every name scales away.
const ORG_STACK_MAX = 6;
const ORG_STACK_GAP = 26; // corridor between the two stacked columns (trunk)
const ORG_STACK_VGAP = 10; // vertical gap between stacked rows

/** An org card's text: the name (≤3 lines), the role (≤2), and the value line. */
interface OrgText {
  readonly label: Wrapped;
  readonly role: Wrapped;
  readonly value: string;
}

/** Height of an org card's text block. */
function orgBlockH(t: OrgText): number {
  return (
    t.label.lines.length * ORG_NAME_LH +
    (t.role.lines.length > 0 ? 7 + t.role.lines.length * ORG_SUB_LH : 0) +
    (t.value !== '' ? 4 + ORG_SUB_LH : 0)
  );
}

/** Fits an org card's text to `nameLines` / `roleLines` at most. */
function orgText(n: Node, value: string, nameLines: number, roleLines: number): OrgText {
  return {
    label: fitText(n.label, { width: ORG_TEXT_W, font: FONT.name, maxLines: nameLines }),
    role: fitText(n.role, { width: ORG_TEXT_W, font: FONT.sub, maxLines: roleLines }),
    value,
  };
}

function renderOrgTree(data: TreeData): string {
  const nodes = data.nodes ?? [];
  const byId = new Map<string, Node>();
  const children = new Map<string, string[]>();
  for (const n of nodes) {
    byId.set(n.id, n);
    children.set(n.id, []);
  }
  // A node whose parent id is unknown renders as a root — never a throw.
  const roots: string[] = [];
  for (const n of nodes) {
    if (n.parent !== undefined && byId.has(n.parent)) children.get(n.parent)?.push(n.id);
    else roots.push(n.id);
  }

  // The value line: the number with its unit, and its share of the parent.
  const valueLine = (n: Node): string => {
    if (typeof n.value !== 'number') return '';
    const parent = n.parent !== undefined ? byId.get(n.parent) : undefined;
    const share = shareOf(n.value, parent?.value);
    return share !== '' ? `${fmtValue(n.value, data.unit)} · ${share}` : fmtValue(n.value, data.unit);
  };
  // One card height for the chart: tall enough for every card's whole text
  // (name ≤3 lines, role ≤2), up to a cap; past it the text ends in "…".
  const ORG_PAD = 20;
  const ORG_H = Math.min(
    ORG_MAX_H,
    Math.max(ORG_BASE_H, ...nodes.map((n) => orgBlockH(orgText(n, valueLine(n), 3, 2)) + ORG_PAD)),
  );
  // The stacking rule: a parent with more than ORG_STACK_MAX leaf children
  // (leaf = no children of its own) stacks those leaves in up to two columns
  // under itself. Branch children keep their normal recursive slots.
  const isLeaf = (id: string): boolean => (children.get(id) ?? []).length === 0;
  const stackOf = (id: string): { leaves: string[]; branches: string[] } | undefined => {
    const ch = children.get(id) ?? [];
    const leaves = ch.filter((c) => isLeaf(c));
    if (leaves.length <= ORG_STACK_MAX) return undefined;
    return { leaves, branches: ch.filter((c) => !isLeaf(c)) };
  };
  const STACK_W = ORG_W * 2 + ORG_STACK_GAP + ORG_HGAP;

  // Pass 1 — subtree widths (in px, each including its trailing gap).
  const widths = new Map<string, number>();
  const measuring = new Set<string>();
  const widthOf = (id: string): number => {
    const known = widths.get(id);
    if (known !== undefined) return known;
    if (measuring.has(id)) return ORG_SLOT; // cycle guard
    measuring.add(id);
    const stack = stackOf(id);
    const ch = children.get(id) ?? [];
    const w =
      stack !== undefined
        ? Math.max(ORG_SLOT, stack.branches.reduce((a, c) => a + widthOf(c), 0) + STACK_W)
        : ch.length === 0
          ? ORG_SLOT
          : Math.max(ORG_SLOT, ch.reduce((a, c) => a + widthOf(c), 0));
    measuring.delete(id);
    widths.set(id, w);
    return w;
  };

  // Pass 2 — x centers (parents centered over first/last child) + y tops.
  const cx = new Map<string, number>();
  const yTop = new Map<string, number>();
  const depth = new Map<string, number>();
  const seen = new Set<string>();
  const stackedLeaf = new Set<string>();
  const trunks: Array<{ parent: string; trunkX: number }> = [];
  let maxBottom = 0;
  const place = (id: string, left: number, y: number, d: number): void => {
    if (seen.has(id)) return;
    seen.add(id);
    depth.set(id, d);
    yTop.set(id, y);
    if (y + ORG_H > maxBottom) maxBottom = y + ORG_H;
    const ch = children.get(id) ?? [];
    if (ch.length === 0) {
      cx.set(id, left + ORG_SLOT / 2);
      return;
    }
    const rowY = y + ORG_H + ORG_VGAP;
    const stack = stackOf(id);
    if (stack !== undefined) {
      const totalW = stack.branches.reduce((a, c) => a + widthOf(c), 0) + STACK_W;
      let cur = left + (widthOf(id) - totalW) / 2;
      for (const c of stack.branches) {
        place(c, cur, rowY, d + 1);
        cur += widthOf(c);
      }
      // Two columns astride the trunk corridor, rows growing downward.
      const trunkX = cur + (STACK_W - ORG_HGAP) / 2;
      stack.leaves.forEach((leaf, i) => {
        if (seen.has(leaf)) return;
        seen.add(leaf);
        depth.set(leaf, d + 1);
        stackedLeaf.add(leaf);
        const col = i % 2;
        const row = Math.floor(i / 2);
        const ly = rowY + row * (ORG_H + ORG_STACK_VGAP);
        yTop.set(leaf, ly);
        if (ly + ORG_H > maxBottom) maxBottom = ly + ORG_H;
        cx.set(
          leaf,
          col === 0
            ? trunkX - ORG_STACK_GAP / 2 - ORG_W / 2
            : trunkX + ORG_STACK_GAP / 2 + ORG_W / 2,
        );
      });
      trunks.push({ parent: id, trunkX });
      const first = stack.branches.length > 0 ? (cx.get(stack.branches[0] ?? '') ?? trunkX) : trunkX;
      cx.set(id, (first + trunkX) / 2);
      return;
    }
    // Children of a narrow parent still center under it.
    const kidsW = ch.reduce((a, c) => a + widthOf(c), 0);
    let cur = left + (widthOf(id) - kidsW) / 2;
    for (const c of ch) {
      place(c, cur, rowY, d + 1);
      cur += widthOf(c);
    }
    const first = cx.get(ch[0] ?? '') ?? 0;
    const last = cx.get(ch[ch.length - 1] ?? '') ?? 0;
    cx.set(id, (first + last) / 2);
  };
  const padX = 16;
  const padY = 16;
  let cursor = padX;
  for (const r of roots) {
    place(r, cursor, padY, 0);
    cursor += widthOf(r);
  }

  const width = Math.max(cursor - ORG_HGAP + padX, padX * 2 + ORG_W);
  const height = maxBottom + padY;
  const xOf = (id: string): number => Math.round(((cx.get(id) ?? 0) - ORG_W / 2) * 10) / 10;
  const yOf = (id: string): number => yTop.get(id) ?? padY;

  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"><title>Org chart</title>`;

  // Vertical parent→child elbows, drawn under the cards. Stacked leaves get
  // their trunk-and-stub connectors below instead.
  for (const n of nodes) {
    if (n.parent === undefined || !byId.has(n.parent) || !cx.has(n.id) || stackedLeaf.has(n.id))
      continue;
    const px = Math.round(((cx.get(n.parent) ?? 0)) * 10) / 10;
    const py = yOf(n.parent) + ORG_H;
    const chx = Math.round(((cx.get(n.id) ?? 0)) * 10) / 10;
    const chy = yOf(n.id);
    const midY = py + ORG_VGAP / 2;
    s += `<path ${LINK_ATTRS} d="M ${px} ${py} V ${midY} H ${chx} V ${chy}"/>`;
  }

  // Stacked groups: one trunk down the corridor, a short stub to each card.
  for (const t of trunks) {
    const kids = (children.get(t.parent) ?? []).filter((c) => stackedLeaf.has(c));
    const py = yOf(t.parent) + ORG_H;
    const tx = Math.round(t.trunkX * 10) / 10;
    let bottom = py;
    let stubs = '';
    for (const c of kids) {
      const cyMid = yOf(c) + ORG_H / 2;
      if (cyMid > bottom) bottom = cyMid;
      const ccx = cx.get(c) ?? 0;
      const edgeX = Math.round((ccx < t.trunkX ? ccx + ORG_W / 2 : ccx - ORG_W / 2) * 10) / 10;
      stubs += `<path ${LINK_ATTRS} d="M ${tx} ${cyMid} H ${edgeX}"/>`;
    }
    const pcx = Math.round((cx.get(t.parent) ?? 0) * 10) / 10;
    s += `<path ${LINK_ATTRS} d="M ${pcx} ${py} V ${py + ORG_VGAP / 2} H ${tx} V ${bottom}"/>` + stubs;
  }

  let hasRoot = false;
  let hasReport = false;
  s += `<g${bl('nodes')}>`;
  nodes.forEach((n, ni) => {
    if (!cx.has(n.id)) return;
    const x = xOf(n.id);
    const y = yOf(n.id);
    const root = (depth.get(n.id) ?? 0) === 0;
    if (root) hasRoot = true;
    else hasReport = true;
    // The whole text when it fits the card; else the role, then the name,
    // give up lines, and what still does not fit ends with "…".
    const plans: ReadonlyArray<readonly [number, number]> = [[3, 2], [3, 1], [2, 1], [1, 1]];
    let text = orgText(n, valueLine(n), 3, 2);
    for (const [nl, rl] of plans) {
      text = orgText(n, valueLine(n), nl, rl);
      if (orgBlockH(text) + ORG_PAD <= ORG_H) break;
    }
    if (text.label.truncated) {
      reportCut({ path: `nodes.${ni}.label`, field: 'label', full: text.label.full, hint: 'Shorten the `label`, or move the detail to `role`.' });
    }
    if (text.role.truncated) {
      reportCut({ path: `nodes.${ni}.role`, owner: n.label, field: 'role', full: text.role.full, hint: 'Shorten the `role`.' });
    }
    const midX = x + ORG_W / 2;
    const cls = root ? 't-name c-accent' : 't-name';
    let ty = y + (ORG_H - orgBlockH(text)) / 2 + 10;
    let labelSvg = '';
    text.label.lines.forEach((ln, j) => {
      labelSvg += `<text x="${midX}" y="${ty.toFixed(1)}" class="${cls}" text-anchor="middle"${j === 0 ? bp(`nodes.${ni}.label`) : ''}>${escapeHtml(ln)}</text>`;
      ty += ORG_NAME_LH;
    });
    ty += 7 - ORG_NAME_LH + ORG_SUB_LH - 1;
    let role = '';
    text.role.lines.forEach((ln, j) => {
      role += `<text x="${midX}" y="${ty.toFixed(1)}" class="t-sub c-muted" text-anchor="middle"${j === 0 ? bp(`nodes.${ni}.role`) : ''}>${escapeHtml(ln)}</text>`;
      ty += ORG_SUB_LH;
    });
    if (text.value !== '') {
      if (text.role.lines.length > 0) ty += 4;
      role += `<text x="${midX}" y="${ty.toFixed(1)}" class="t-sub" text-anchor="middle"${bp(`nodes.${ni}.value`)}>${escapeHtml(text.value)}</text>`;
    }
    const cut = text.label.truncated || text.role.truncated;
    const tip = cut ? `<title>${escapeHtml(n.role !== undefined && n.role !== '' ? `${n.label} — ${String(n.role)}` : n.label)}</title>` : '';
    s +=
      `<g${bp(`nodes.${ni}`)}>` +
      `<rect x="${x}" y="${y}" width="${ORG_W}" height="${ORG_H}" rx="4" ${CARD_ATTRS[root ? 'root' : 'branch']}/>` +
      tip +
      labelSvg +
      role +
      `</g>`;
  });
  s += `</g>`;

  s += `</svg>`;
  const items: LegendItem[] = [];
  if (hasRoot) items.push({ swatch: 'node-accent', label: 'head' });
  if (hasReport) items.push({ swatch: 'node', label: 'reports to the card above' });
  const legendHtml = renderLegend(items);
  return diagramFrame(
    {
      tag: 'ORG',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legendHtml.length > 0 ? { legendHtml } : {}),
    },
    s,
  );
}

// ─── default: indented folder tree ───────────────────────────────────────────

/**
 * A node's value with the block's unit: two decimals at most, five-digit and
 * longer numbers grouped (`2400`, `12,400`); a currency sign leads (`$420`),
 * a word unit follows after a space (`42 people`), a symbol or short unit
 * follows tight (`3.4%`, `420k$`, `2400ms`).
 */
function fmtValue(v: number, unit: string | undefined): string {
  const rounded = Math.round(v * 100) / 100;
  const text = Math.abs(rounded) >= 10000 ? rounded.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(rounded);
  if (unit === undefined || unit === '') return text;
  if (/^[$€£¥₹]$/u.test(unit)) return `${unit}${text}`;
  return /^\p{L}{4,}|\s/u.test(unit) ? `${text} ${unit}` : `${text}${unit}`;
}

export function renderTree(data: TreeData): string {
  if (data.variant === 'issue') return renderIssueTree(data);
  if (data.variant === 'org') return renderOrgTree(data);
  const nodes = data.nodes ?? [];
  const byId = new Map<string, Node>();
  const children = new Map<string, string[]>();
  // Original array index per node — rows render in DFS order, but data paths
  // must address the node's position in the YAML `nodes` array.
  const indexOf = new Map<Node, number>();
  nodes.forEach((n, i) => indexOf.set(n, i));
  for (const n of nodes) {
    byId.set(n.id, n);
    children.set(n.id, []);
  }
  const roots: string[] = [];
  for (const n of nodes) {
    if (n.parent !== undefined && byId.has(n.parent)) {
      children.get(n.parent)?.push(n.id);
    } else {
      roots.push(n.id);
    }
  }

  type Out = { node: Node; depth: number; branch: boolean; parent?: Node };
  const out: Out[] = [];
  const seen = new Set<string>();
  const walk = (id: string, depth: number, parent?: Node): void => {
    if (seen.has(id)) return;
    seen.add(id);
    const node = byId.get(id);
    if (node === undefined) return;
    const kids = children.get(id) ?? [];
    out.push({ node, depth, branch: kids.length > 0, ...(parent !== undefined ? { parent } : {}) });
    for (const c of kids) walk(c, depth + 1, node);
  };
  for (const r of roots) walk(r, 0);

  const rows = out
    .map((row) => {
      const ni = indexOf.get(row.node) ?? 0;
      const branchCls = row.branch ? ' branch' : '';
      const glyph = row.branch ? '▸' : '—';
      const note =
        row.node.note !== undefined
          ? `<span class="tnote"${bp(`nodes.${ni}.note`)}>${escapeHtml(row.node.note)}</span>`
          : '';
      // Values turn the hierarchy into a DRIVER TREE: the number itself, plus
      // its share of the parent — which is the figure that says where the
      // total actually comes from.
      let value = '';
      if (typeof row.node.value === 'number') {
        const own = fmtValue(row.node.value, data.unit);
        const parentValue = row.parent?.value;
        const share =
          typeof parentValue === 'number' && parentValue > 0
            ? `<span class="tshare">${Math.round((row.node.value / parentValue) * 100)}%</span>`
            : '';
        value = `<span class="tvalue"${bp(`nodes.${ni}.value`)}>${escapeHtml(own)}</span>${share}`;
      }
      return (
        `<div class="tree-row${branchCls}" style="padding-left:${row.depth * 22}px"${bp(`nodes.${ni}`)}>` +
        `<span class="tw">${glyph}</span>` +
        `<span class="tlabel"${bp(`nodes.${ni}.label`)}>${escapeHtml(row.node.label)}</span>` +
        note +
        value +
        `</div>`
      );
    })
    .join('');
  return `<div class="tree-list"${bl('nodes')}>${rows}</div>`;
}
