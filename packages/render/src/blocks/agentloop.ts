/**
 * Renders an `agentloop` block — the canonical LLM agent-loop diagram, in
 * pure SVG inside the diagram frame (tag AGENT).
 *
 * Layout: the environment (user) card on the left, the agent card (the
 * loop's one accent: accent stroke on accent-tint, sparkle glyph, mono model
 * chip) in the centre, a column of paper-2 tool cards on the right (two
 * columns past {@link ONE_COLUMN_MAX} tools — every tool shows), and a
 * paper-2 memory cylinder beneath the agent when `memory` is present.
 * Numbered loop arrows: ① env→agent "prompt", ② agent→tools "tool call",
 * ③ tools→agent "result" (dashed return), ④ agent→env "response";
 * agent↔memory is a dashed "read/write" link. `stop` renders as a foot line
 * below the diagram.
 *
 * Text: every box grows to hold its text. Names wrap at words, and a long
 * tool name breaks at its own joints (`fetch_` · `policy_document`). Text
 * that still does not fit ends with "…", keeps its full text in a `<title>`,
 * and is reported as a cut (`label-truncated`).
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { nodeGlyph } from '../svg/blockStyle.js';
import { cutTitle, ellipsize, fitText, textWidth, type Font, type Wrapped } from '../svg/wrapText.js';
import { bl, bp } from '../paths.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { diagramFrame } from './frame.js';

type AgentloopData = BlockDataMap['agentloop'];
type Tool = NonNullable<AgentloopData['tools']>[number];

const ENV_X = 16;
const ENV_W = 118;
const ENV_MIN_H = 56;
const AGENT_X = 232;
const AGENT_W = 176;
/** The agent card widens to this when its name would take more than two lines. */
const AGENT_W_WIDE = 212;
/** Gap between the agent card and the first tool column (room for ② / ③). */
const TOOLS_GAP = 104;
const TOOL_W = 134;
const TOOL_GAP = 10;
/** Past this many tools, the tools take two columns. */
const ONE_COLUMN_MAX = 5;
const MEM_W = 176;

/** The type roles of the loop's text (see `.al-*` in `css.ts`). */
const ENV_FONT: Font = { size: 12, weight: 600 };
const NAME_FONT: Font = { size: 13, weight: 600 };
const CHIP_FONT: Font = { size: 9.5, mono: true, weight: 500, tracking: 0.04 };
const NOTE_FONT: Font = { size: 10.5 };
const TOOL_NAME_FONT: Font = { size: 11, mono: true, weight: 600 };
const TOOL_DESC_FONT: Font = { size: 10 };
const MEM_FONT: Font = { size: 10 };

/** Line heights, px. */
const ENV_LH = 14;
const NAME_LH = 16;
const NOTE_LH = 13;
const TOOL_NAME_LH = 13;
const TOOL_DESC_LH = 13;
const MEM_LH = 13;

/** Paints (DESIGN.md): the agent is the loop's one accent; env is a primary paper node; tools and memory are secondary paper-2 nodes. */
const ENV = { fill: 'var(--paper)', stroke: 'var(--ink)' };
const AGENT = { fill: 'var(--accent-tint)', stroke: 'var(--accent)' };
const TOOL = { fill: 'var(--paper-2)', stroke: 'var(--rule-solid)' };
const MEM = { fill: 'var(--paper-2)', stroke: 'var(--ink)' };

/** The shared hollow step badge (r=8, muted stroke, `.t-badge` numeral) + its mono label, above an arrow. */
function loopBadge(n: number, x: number, y: number, label: string): string {
  return (
    `<circle cx="${x}" cy="${y}" r="8" class="step-badge"/>` +
    `<text x="${x}" y="${y + 3}" text-anchor="middle" class="t-badge">${n}</text>` +
    `<text x="${x + 13}" y="${y + 3.5}" class="al-lbl">${escapeHtml(label)}</text>`
  );
}

/** `<text>` lines from `y`, `lh` apart; the first carries the `<title>` of a cut text. */
function textLines(
  w: Wrapped,
  x: number,
  y: number,
  lh: number,
  cls: string,
  opts: { readonly anchor?: 'middle'; readonly path?: string } = {},
): string {
  const anchor = opts.anchor === 'middle' ? ' text-anchor="middle"' : '';
  const lines = w.lines
    .map(
      (ln, i) =>
        `<text x="${x}" y="${y + i * lh}"${anchor} class="${cls}"${w.lines.length === 1 && opts.path !== undefined ? bp(opts.path) : ''}>${i === 0 ? cutTitle(w) : ''}${escapeHtml(ln)}</text>`,
    )
    .join('');
  // A wrapped text keeps one data path on the group of its lines.
  return w.lines.length > 1 && opts.path !== undefined ? `<g${bp(opts.path)}>${lines}</g>` : lines;
}

/** One tool card's text, fitted to the card. */
interface ToolText {
  readonly name: Wrapped;
  readonly desc: Wrapped;
  readonly h: number;
}

function toolText(tool: Tool, ti: number): ToolText {
  const width = TOOL_W - 22;
  const name = fitText(tool.name, {
    width,
    font: TOOL_NAME_FONT,
    maxLines: 3,
    report: { path: `tools.${ti}.name`, field: 'name', hint: 'Shorten the tool `name`.' },
  });
  const desc = fitText(tool.desc, {
    width,
    font: TOOL_DESC_FONT,
    maxLines: 5,
    report: {
      path: `tools.${ti}.desc`,
      owner: tool.name,
      field: 'desc',
      hint: 'Shorten the tool `desc` to one sentence.',
    },
  });
  const extraName = Math.max(0, name.lines.length - 1) * TOOL_NAME_LH;
  const h = (desc.lines.length > 0 ? 28 + desc.lines.length * TOOL_DESC_LH : 26) + extraName;
  return { name, desc, h };
}

export function renderAgentloop(data: AgentloopData): string {
  const tools = data.tools ?? [];
  const hasTools = tools.length > 0;
  const memory = data.memory;
  const env = data.env ?? 'User';

  // Agent card: the sparkle and the name, the model chip, then the note.
  const nameAt = (w: number): Wrapped => fitText(data.agent.name, { width: w - 48, font: NAME_FONT, maxLines: 3 });
  const agentW = nameAt(AGENT_W).lines.length > 2 ? AGENT_W_WIDE : AGENT_W;
  const name = fitText(data.agent.name, {
    width: agentW - 48,
    font: NAME_FONT,
    maxLines: 3,
    report: { path: 'agent.name', field: 'name', hint: 'Shorten the agent `name`; put the detail in `note`.' },
  });
  const note = fitText(data.agent.note, {
    width: agentW - 24,
    font: NOTE_FONT,
    maxLines: 8,
    report: {
      path: 'agent.note',
      owner: data.agent.name,
      field: 'note',
      hint: 'Shorten the agent `note`, and put the rest in the prose.',
    },
  });
  const model = data.agent.model ?? '';
  const hasModel = model.length > 0;
  const chip = hasModel
    ? ellipsize(model, agentW - 24 - 16, CHIP_FONT, {
        path: 'agent.model',
        owner: data.agent.name,
        field: 'model',
        hint: 'Shorten `model` to the model id.',
      })
    : undefined;
  const nameH = name.lines.length * NAME_LH;
  const agentH = Math.max(
    56,
    20 + nameH + (hasModel ? 22 : 0) + (note.lines.length > 0 ? note.lines.length * NOTE_LH + 8 : 0),
  );

  // Environment card: the person glyph over the wrapped name.
  const envText = fitText(env, {
    width: ENV_W - 16,
    font: ENV_FONT,
    maxLines: 4,
    report: { path: 'env', field: 'env', hint: 'Shorten `env` to the name of the caller.' },
  });
  const envH = Math.max(ENV_MIN_H, 44 + Math.max(0, envText.lines.length - 1) * ENV_LH + 12);

  // Tools: every tool shows — one column, or two past ONE_COLUMN_MAX.
  const toolTexts = tools.map((t, ti) => toolText(t, ti));
  const colH = (col: readonly ToolText[]): number =>
    col.reduce((acc, t) => acc + t.h, 0) + TOOL_GAP * Math.max(0, col.length - 1);
  const cols = tools.length > ONE_COLUMN_MAX ? 2 : 1;
  // Two columns split in order where the taller column is shortest.
  let split = toolTexts.length;
  if (cols === 2) {
    let best = Infinity;
    for (let k = 1; k < toolTexts.length; k++) {
      const tallest = Math.max(colH(toolTexts.slice(0, k)), colH(toolTexts.slice(k)));
      if (tallest < best) {
        best = tallest;
        split = k;
      }
    }
  }
  const columns = cols === 2 ? [toolTexts.slice(0, split), toolTexts.slice(split)] : [toolTexts];
  const toolsColH = hasTools ? Math.max(...columns.map(colH)) : 0;
  const toolX = AGENT_X + agentW + TOOLS_GAP;
  // 660 wide as before; a wide agent card or a second tool column widens it.
  const width = Math.max(660, hasTools ? toolX + cols * TOOL_W + (cols - 1) * TOOL_GAP + 14 : 0);

  const top = 10;
  const centerY = Math.round(top + Math.max(agentH, toolsColH, envH, 64) / 2);
  const agentY = Math.round(centerY - agentH / 2);
  const envY = Math.round(centerY - envH / 2);
  const toolsTop = Math.round(centerY - toolsColH / 2);
  const bandBottom = Math.max(agentY + agentH, envY + envH, hasTools ? toolsTop + toolsColH : 0);

  // Memory cylinder (only when `memory:` is present; empty list → just a label).
  const memItems = memory ?? [];
  const hasMemory = memory !== undefined;
  const memTexts = memItems.map((item, i) =>
    fitText(item, {
      width: MEM_W - 24,
      font: MEM_FONT,
      maxLines: 2,
      report: { path: `memory.${i}`, field: 'memory', hint: 'Shorten the memory item to a few words.' },
    }),
  );
  // Items sit 15px apart (one line each), a wrapped item 13px per extra line.
  const memStep = (w: Wrapped): number => w.lines.length * MEM_LH + 2;
  const lastBase = 41 + memTexts.reduce((acc, w) => acc + memStep(w), 0) - (memTexts.length > 0 ? MEM_LH + 2 : 0);
  const memH = hasMemory ? Math.max(44, lastBase + 9) : 0;
  const memX = Math.round(AGENT_X + (agentW - MEM_W) / 2);
  const memTop = bandBottom + 46;
  const height = hasMemory ? memTop + memH + 8 : bandBottom + 12;

  let s = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img"><title>Agent loop</title>`;

  // Environment card (left).
  s +=
    `<rect x="${ENV_X}" y="${envY}" width="${ENV_W}" height="${envH}" rx="4" fill="${ENV.fill}" stroke="${ENV.stroke}" stroke-width="1.5"/>` +
    nodeGlyph('user', ENV_X + Math.round(ENV_W / 2) - 8, envY + 10, 'var(--muted)') +
    textLines(envText, ENV_X + Math.round(ENV_W / 2), envY + 44, ENV_LH, 'al-env', { anchor: 'middle', path: 'env' });

  // Agent card (centre) — the one accent.
  s += `<rect x="${AGENT_X}" y="${agentY}" width="${agentW}" height="${agentH}" rx="4" fill="${AGENT.fill}" stroke="${AGENT.stroke}" stroke-width="1.5"/>`;
  s += nodeGlyph('agent', AGENT_X + 12, agentY + 12, 'var(--accent)');
  s += textLines(name, AGENT_X + 36, agentY + 24, NAME_LH, 'al-name', { path: 'agent.name' });
  let cursorY = agentY + 18 + nameH;
  if (chip !== undefined) {
    const shown = chip.lines[0] ?? '';
    const chipW = Math.min(agentW - 24, Math.ceil(16 + textWidth(shown, CHIP_FONT)));
    s +=
      `<rect x="${AGENT_X + 12}" y="${cursorY}" width="${chipW}" height="16" rx="3" fill="var(--paper)" stroke="var(--rule-solid)" stroke-width="1"/>` +
      `<text x="${AGENT_X + 12 + Math.round(chipW / 2)}" y="${cursorY + 11.5}" text-anchor="middle" class="al-chip"${bp('agent.model')}>${cutTitle(chip)}${escapeHtml(shown)}</text>`;
    cursorY += 22;
  }
  s += textLines(note, AGENT_X + 12, cursorY + 10, NOTE_LH, 'al-note', { path: 'agent.note' });

  // Tools (right): one column, or two.
  if (hasTools) {
    s += `<g${bl('tools')}>`;
    columns.forEach((col, c) => {
      const tx = toolX + c * (TOOL_W + TOOL_GAP);
      let ty = Math.round(centerY - colH(col) / 2);
      col.forEach((tt, k) => {
        const ti = c * split + k;
        s += `<g${bp(`tools.${ti}`)}>`;
        s += `<rect x="${tx}" y="${ty}" width="${TOOL_W}" height="${tt.h}" rx="4" fill="${TOOL.fill}" stroke="${TOOL.stroke}" stroke-width="1"/>`;
        s += textLines(tt.name, tx + 11, ty + 17, TOOL_NAME_LH, 'al-tool-name', { path: `tools.${ti}.name` });
        const descY = ty + 17 + tt.name.lines.length * TOOL_NAME_LH + 1;
        s += textLines(tt.desc, tx + 11, descY, TOOL_DESC_LH, 'al-tool-desc');
        s += `</g>`;
        ty += tt.h + TOOL_GAP;
      });
    });
    s += `</g>`; // close the tools list container
  }

  // Loop arrows. ① prompt (env → agent) above, ④ response (agent → env) below.
  const yIn = centerY - 13;
  const yOut = centerY + 13;
  s += `<line x1="${ENV_X + ENV_W}" y1="${yIn}" x2="${AGENT_X - 4}" y2="${yIn}" class="al-edge" marker-end="url(#gArrow)"/>`;
  s += loopBadge(1, ENV_X + ENV_W + 18, yIn - 13, 'prompt');
  // ④ is a response: dashed, open head (DESIGN.md › Strokes and arrows).
  s += `<line x1="${AGENT_X}" y1="${yOut}" x2="${ENV_X + ENV_W + 4}" y2="${yOut}" class="al-edge dashed" marker-end="url(#gSoft)"/>`;
  s += loopBadge(4, ENV_X + ENV_W + 18, yOut + 17, 'response');

  // ② tool call (agent → tools), ③ result (dashed return).
  if (hasTools) {
    const ax = AGENT_X + agentW;
    s += `<line x1="${ax}" y1="${yIn}" x2="${toolX - 4}" y2="${yIn}" class="al-edge" marker-end="url(#gArrow)"/>`;
    s += loopBadge(2, ax + 18, yIn - 13, 'tool call');
    s += `<line x1="${toolX}" y1="${yOut}" x2="${ax + 4}" y2="${yOut}" class="al-edge dashed" marker-end="url(#gSoft)"/>`;
    s += loopBadge(3, ax + 18, yOut + 17, 'result');
  }

  // Memory cylinder + dashed read/write link.
  if (hasMemory) {
    const cx = AGENT_X + Math.round(agentW / 2);
    s += `<line x1="${cx}" y1="${agentY + agentH + 3}" x2="${cx}" y2="${memTop - 8}" class="al-edge dashed" marker-start="url(#gSoft)" marker-end="url(#gSoft)"/>`;
    s += `<text x="${cx + 8}" y="${Math.round((agentY + agentH + memTop) / 2) + 3}" class="al-lbl">read/write</text>`;
    const ry = 7;
    s +=
      `<path d="M${memX} ${memTop + ry} a ${Math.round(MEM_W / 2)} ${ry} 0 0 1 ${MEM_W} 0 V ${memTop + memH - ry} a ${Math.round(MEM_W / 2)} ${ry} 0 0 1 -${MEM_W} 0 Z" fill="${MEM.fill}" stroke="${MEM.stroke}" stroke-width="1"/>` +
      `<ellipse cx="${memX + Math.round(MEM_W / 2)}" cy="${memTop + ry}" rx="${Math.round(MEM_W / 2)}" ry="${ry}" fill="${MEM.fill}" stroke="${MEM.stroke}" stroke-width="1"/>`;
    s += `<text x="${memX + Math.round(MEM_W / 2)}" y="${memTop + 27}" text-anchor="middle" class="al-mem">memory</text>`;
    s += `<g${bl('memory')}>`;
    let my = memTop + 41;
    memTexts.forEach((w, i) => {
      s += textLines(w, memX + Math.round(MEM_W / 2), my, MEM_LH, 'al-mem-item', { anchor: 'middle', path: `memory.${i}` });
      my += memStep(w);
    });
    s += `</g>`; // close the memory list container
  }

  s += `</svg>`;

  const foot =
    data.stop !== undefined && data.stop.length > 0
      ? `<div class="al-foot"><span class="al-foot-label">stops when:</span> <span${bp('stop')}>${escapeHtml(data.stop)}</span></div>`
      : '';

  // Legend: the node kinds and edge styles this loop actually draws.
  const secondary = [hasTools ? 'tool' : '', hasMemory ? 'memory' : ''].filter((k) => k.length > 0);
  const legendItems: LegendItem[] = [
    { swatch: 'node', label: 'environment' },
    { swatch: 'node-accent', label: 'agent' },
    ...(secondary.length > 0 ? [{ swatch: 'node-fill2', label: secondary.join(' · ') } as LegendItem] : []),
    { swatch: 'edge', label: hasTools ? 'prompt · tool call' : 'prompt' },
    { swatch: 'edge-dashed', label: hasTools ? 'response · result' : 'response' },
  ];
  const legend = renderLegend(legendItems);

  return diagramFrame(
    {
      tag: 'AGENT',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legend.length > 0 ? { legendHtml: legend } : {}),
      ...(foot.length > 0 ? { footerHtml: foot } : {}),
    },
    s,
  );
}
