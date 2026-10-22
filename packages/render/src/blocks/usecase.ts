/**
 * Renders a `usecase` block — a UML use-case diagram: the subject (system
 * boundary) with its name at the top, use cases as ellipses inside it,
 * primary actors left of it and supporting actors right of it, associations,
 * and `include` / `extend` / `generalize` relations.
 *
 * The layout (`usecaseLayout.ts`) owns every position: who stands on which
 * side, which column a case takes, the order that keeps crossings rare, and
 * a line that never passes a case, an actor or a label.
 *
 * Skin (`DESIGN.md`): a person is a stick figure and a time actor a clock,
 * both in their family hue (people rose, a timer blue); a system actor is a
 * dashed external box with its `«system»` keyword and name inside. The subject
 * is the inactive panel with its name as an eyebrow. Cases are `ink`
 * ellipses on `paper`; the one case in `focus` takes the accent. Associations
 * are plain `muted` lines, `include` / `extend` dashed with an open head and
 * their stereotype (and condition) on a paper mask on the line,
 * `generalize` solid with a hollow triangle. The legend lists only the
 * relation kinds in play.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { edgeMask } from '../svg/edgePill.js';
import { edgeLabelLayer, type AvoidRect } from '../svg/edgeSteps.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import type { Pt } from '../svg/router.js';
import { countPhrase, svgName } from '../svg/svgTitle.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';
import { caseBaselines, layoutUsecase, type UcActor, type UcCase } from './usecaseLayout.js';

export { ELLIPSE_CLEAR, layoutUsecase, segmentHitsEllipse } from './usecaseLayout.js';

const r1 = (v: number): number => Math.round(v * 10) / 10;

/** A polyline with softly rounded bends (any angle); `radius` per bend, 10 by default. */
function softPath(pts: readonly Pt[], radius: readonly number[] = []): string {
  const first = pts[0];
  if (first === undefined) return '';
  let d = `M${r1(first.x)} ${r1(first.y)}`;
  for (let k = 1; k < pts.length - 1; k++) {
    const prev = pts[k - 1] as Pt;
    const p = pts[k] as Pt;
    const next = pts[k + 1] as Pt;
    const lin = Math.hypot(p.x - prev.x, p.y - prev.y);
    const lout = Math.hypot(next.x - p.x, next.y - p.y);
    const r = Math.min(radius[k - 1] ?? 10, lin / 2, lout / 2);
    if (r < 1) {
      d += ` L${r1(p.x)} ${r1(p.y)}`;
      continue;
    }
    const ax = p.x - ((p.x - prev.x) / lin) * r;
    const ay = p.y - ((p.y - prev.y) / lin) * r;
    const bx = p.x + ((next.x - p.x) / lout) * r;
    const by = p.y + ((next.y - p.y) / lout) * r;
    d += ` L${r1(ax)} ${r1(ay)} Q${r1(p.x)} ${r1(p.y)} ${r1(bx)} ${r1(by)}`;
  }
  const last = pts[pts.length - 1] as Pt;
  if (pts.length > 1) d += ` L${r1(last.x)} ${r1(last.y)}`;
  return d;
}

function actorGlyph(a: UcActor): string {
  const { x, y } = a;
  if (a.kind === 'system' && a.glyph !== undefined) {
    const g = a.glyph;
    let s = `<rect x="${r1(g.x)}" y="${r1(g.y)}" width="${r1(g.w)}" height="${r1(g.h)}" rx="4" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.25" stroke-dasharray="4 3"/>`;
    s += `<text x="${r1(x)}" y="${r1(g.y + 16)}" class="t-sub" text-anchor="middle">«system»</text>`;
    return s;
  }
  if (a.kind === 'time') {
    const ink = 'var(--hue-blue)';
    return (
      `<circle cx="${r1(x)}" cy="${r1(y)}" r="15" fill="var(--paper)" stroke="${ink}" stroke-width="1.5"/>` +
      `<path d="M${r1(x)} ${r1(y - 9)} V${r1(y)} H${r1(x + 7)}" fill="none" stroke="${ink}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`
    );
  }
  const ink = 'var(--hue-rose)';
  return (
    `<circle cx="${r1(x)}" cy="${r1(y - 16)}" r="6.5" fill="var(--paper)" stroke="${ink}" stroke-width="1.5"/>` +
    `<path d="M${r1(x)} ${r1(y - 9.5)} V${r1(y + 6)} M${r1(x - 12)} ${r1(y - 3)} H${r1(x + 12)} M${r1(x)} ${r1(y + 6)} L${r1(x - 9)} ${r1(y + 21)} M${r1(x)} ${r1(y + 6)} L${r1(x + 9)} ${r1(y + 21)}" fill="none" stroke="${ink}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`
  );
}

/** The baseline of an actor's first name line. */
function nameTop(a: UcActor): number {
  if (a.kind === 'system' && a.glyph !== undefined) return a.glyph.y + 16 + 16;
  return a.y + (a.kind === 'time' ? 32 : 37);
}

function caseBox(c: UcCase): AvoidRect {
  return { x: c.cx - c.rx, y: c.cy - c.ry, w: 2 * c.rx, h: 2 * c.ry };
}

export function renderUsecase(data: BlockDataMap['usecase']): string {
  const L = layoutUsecase(data);
  const links = data.links ?? [];
  const relations = data.relations ?? [];

  const a11y = svgName('Use-case diagram', data.system ?? data.title, [
    countPhrase(data.actors.length, 'actor'),
    countPhrase(data.cases.length, 'use case'),
  ]);
  let s = `<svg viewBox="0 0 ${L.width} ${L.height}"${a11y.attrs}>${a11y.title}`;
  s +=
    `<defs><marker id="ucTri" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="13" markerHeight="13" markerUnits="userSpaceOnUse" orient="auto-start-reverse">` +
    `<path d="M1,1 L13,7 L1,13 z" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.2" stroke-linejoin="round"/></marker></defs>`;

  // The subject.
  const b = L.bound;
  s += `<g${bp('system')}><rect x="${r1(b.x)}" y="${r1(b.y)}" width="${r1(b.w)}" height="${r1(b.h)}" rx="8" fill="var(--paper-2)" stroke="var(--rule-solid)" stroke-width="1"/>`;
  if (data.system !== undefined && L.title !== undefined) {
    s += `<text x="${r1(L.title.x + 6)}" y="${r1(L.title.y + 12.5)}" class="t-eyebrow">${escapeHtml(data.system)}</text>`;
  }
  s += `</g>`;

  // Associations, beneath the shapes.
  s += `<g${bl('links')}>`;
  links.forEach((_, li) => {
    const line = L.links[li];
    if (line === undefined) return;
    const pts = line.pts;
    const attrs = `stroke="var(--muted)" stroke-width="1.25"${bp(`links.${li}`)}`;
    if (pts.length === 2) {
      const [p, q] = pts as [Pt, Pt];
      s += `<line x1="${r1(p.x)}" y1="${r1(p.y)}" x2="${r1(q.x)}" y2="${r1(q.y)}" ${attrs}/>`;
    } else s += `<path d="${softPath(pts, line.radius)}" fill="none" ${attrs}/>`;
  });
  s += `</g>`;

  // Relations between cases (and between actors).
  const relKinds = new Set<string>();
  s += `<g${bl('relations')}>`;
  relations.forEach((rel, ri) => {
    const line = L.relLines[ri];
    if (line === undefined) return;
    relKinds.add(rel.kind);
    const gen = rel.kind === 'generalize';
    const dash = gen ? '' : ' stroke-dasharray="5 4"';
    const head = gen ? 'url(#ucTri)' : 'url(#skOpen)';
    s += `<path d="${softPath(line.pts, line.radius ?? (line.routed ? [6, 6, 6, 6, 6, 6] : []))}" fill="none" stroke="var(--muted)" stroke-width="1.25"${dash} marker-end="${head}"${bp(`relations.${ri}`)}/>`;
  });
  s += `</g>`;

  // Use cases.
  const avoid: AvoidRect[] = [];
  s += `<g${bl('cases')}>`;
  L.cases.forEach((c, ci) => {
    avoid.push(caseBox(c));
    const focus = L.focus === ci;
    const { name, note } = caseBaselines(c);
    const stroke = focus ? 'stroke="var(--accent)" stroke-width="1.75"' : 'stroke="var(--ink)" stroke-width="1.5"';
    let g = `<g${bp(`cases.${ci}`)}><ellipse cx="${r1(c.cx)}" cy="${r1(c.cy)}" rx="${c.rx}" ry="${c.ry}" fill="var(${focus ? '--accent-tint' : '--paper'})" ${stroke}/>`;
    g += `<g${bp(`cases.${ci}.name`)}>`;
    c.name.forEach((ln, k) => {
      g += `<text x="${r1(c.cx)}" y="${r1(c.cy + (name[k] ?? 0))}" class="t-name" text-anchor="middle">${escapeHtml(ln)}</text>`;
    });
    g += `</g>`;
    if (c.note.length > 0) {
      g += `<g${bp(`cases.${ci}.note`)}>`;
      c.note.forEach((ln, k) => {
        g += `<text x="${r1(c.cx)}" y="${r1(c.cy + (note[k] ?? 0))}" class="t-sub" text-anchor="middle">${escapeHtml(ln)}</text>`;
      });
      g += `</g>`;
    }
    s += g + `</g>`;
  });
  s += `</g>`;

  // Actors.
  s += `<g${bl('actors')}>`;
  L.actors.forEach((a, ai) => {
    avoid.push(a.box);
    const y0 = nameTop(a);
    let g = `<g${bp(`actors.${ai}`)}>${actorGlyph(a)}<g${bp(`actors.${ai}.name`)}>`;
    a.name.forEach((ln, k) => {
      g += `<text x="${r1(a.x)}" y="${r1(y0 + k * 15)}" class="t-name" text-anchor="middle">${escapeHtml(ln)}</text>`;
    });
    s += g + `</g></g>`;
  });
  s += `</g>`;
  if (L.title !== undefined) avoid.push(L.title);

  // Labels, each on its own line (the layout found the spot).
  for (const lb of L.labels) s += `<g${bp(lb.path)}>${edgeMask({ lx: lb.lx, ly: lb.ly }, lb.lines)}</g>`;
  // A label with no clear place on its line falls back to a numeral and a step list.
  const routes = [...L.links, ...L.relLines].flatMap((l) => (l !== undefined ? [l.pts] : []));
  const fallback =
    L.unplaced.length > 0
      ? edgeLabelLayer(
          L.unplaced.map((u) => ({ lx: u.pts[0]?.x ?? 0, ly: u.pts[0]?.y ?? 0, points: u.pts, label: u.text, path: u.path })),
          [...avoid, ...L.labels.map((lb) => lb.box)],
          { skin: true, routes, bounds: { x: 0, y: 0, w: L.width, h: L.height } },
        )
      : undefined;
  if (fallback !== undefined) s += fallback.overlay;
  s += `</svg>`;

  // The relation kinds in play (an association only beside one of them), and the focus.
  const items: LegendItem[] = [];
  if (L.focus !== undefined) items.push({ swatch: 'node-accent', label: 'in focus' });
  if (relKinds.size > 0 && links.length > 0) items.push({ swatch: 'line', label: 'association · takes part' });
  if (relKinds.has('include')) items.push({ swatch: 'edge-dashed', label: '«include» · always runs' });
  if (relKinds.has('extend')) items.push({ swatch: 'edge-dashed', label: '«extend» · runs on a condition' });
  if (relKinds.has('generalize')) items.push({ swatch: 'chip', chip: '△', label: 'is a kind of' });
  const legend = renderLegend(items);

  return diagramFrame(
    {
      tag: 'USE CASE',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legend.length > 0 ? { legendHtml: legend } : {}),
    },
    s + (fallback?.legend ?? ''),
  );
}
