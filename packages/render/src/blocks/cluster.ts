/**
 * Renders a cluster diagram (Kubernetes-style) — namespace panels with
 * service tiles inside, optional replica counts as bar marks, and
 * orthogonal-routed edges between services across namespaces.
 *
 * Skin (`DESIGN.md`): a namespace is the `paper-2` group panel with a
 * hairline and a `.t-eyebrow` label (its `kind` as a chip top-right); a
 * service is the block family's shaped node — the same cylinder, pipe and
 * card silhouettes, kinds told apart by stroke, fill and eyebrow chip.
 * Replica marks are `muted` bars with a `×N` count. Edges follow the shared
 * stroke table (`solid` / `dashed` / `forbidden` / `error`).
 *
 * Accent rule: the one `gateway`-kind service, when exactly one exists — the
 * cluster's entry. Otherwise the cluster spends no colour.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { layoutEdges } from '../svg/edgeLayout.js';
import { LABEL_RUN, labelBox } from '../svg/edgeSteps.js';
import { geometryOf, type GeometryReport } from '../svg/geometry.js';
import { SKIN_EDGE } from '../svg/blockStyle.js';
import { blockLegend, renderShapedNode, edgeAnchorRect, growCells, shapedLabelDeficit } from './blockGraph.js';
import { cutTitle, ellipsize, FONT, textWidth } from '../svg/wrapText.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';

type Service = NonNullable<BlockDataMap['cluster']['services']>[number];

const CYLINDER_KINDS = new Set(['db', 'database', 'store', 'warehouse', 'lake', 'postgres', 'mysql', 'mongo', 'mongodb', 'dynamo']);

/** The widest a namespace panel grows to fit its label; a longer label is cut. */
const MAX_PANEL_W = 420;

export function renderCluster(data: BlockDataMap['cluster']): string {
  return layoutCluster(data).html;
}

/** Geometry report for a `cluster` block (see `geometryReport`). */
export function clusterGeometry(data: BlockDataMap['cluster']): GeometryReport {
  return layoutCluster(data).geometry;
}

/** Lays out and draws a `cluster` block: the framed HTML plus its geometry report. */
function layoutCluster(data: BlockDataMap['cluster']): { html: string; geometry: GeometryReport } {
  const clusters = data.clusters ?? [];
  const services = data.services ?? [];
  const edges = data.edges ?? [];
  const svcByCluster = new Map<string, Service[]>();
  for (const c of clusters) svcByCluster.set(c.id, []);
  for (const sv of services) {
    const list = svcByCluster.get(sv.cluster);
    if (list !== undefined) list.push(sv);
  }
  const serviceW = 158;
  // The replica marks take a strip at the bottom of a service; the label keeps clear of it.
  const reserveOf = (sv: Service): number =>
    (sv.replicas ?? 0) > 0 ? (CYLINDER_KINDS.has((sv.kind ?? '').toLowerCase()) ? 26 : 17) : 0;
  // One service height: tall enough for every service's whole name and tech, up to a cap.
  const serviceH = growCells(78, 134, (h) =>
    Math.max(
      0,
      ...services.map((sv) =>
        shapedLabelDeficit(
          { kind: sv.kind, name: sv.label, tech: sv.tech, reserveBottom: reserveOf(sv) },
          { x: 0, y: 0, w: serviceW, h },
        ),
      ),
    ),
  );
  // Services and namespaces sit apart enough for the widest edge label to
  // sit on its edge between them.
  const widest = Math.max(0, ...edges.map((e) => (e.label !== undefined && e.label !== '' ? labelBox(e.label).w : 0)));
  const gapS = Math.max(22, widest > 0 ? widest + LABEL_RUN : 0);
  const cPadX = 24;
  const cHeader = 34;
  const cPadBot = 22;
  const cGap = Math.max(34, widest > 0 ? widest + LABEL_RUN : 0);
  const outerPad = 26;

  interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
  }
  const rects = new Map<string, Rect>();
  interface ClusterBox {
    c: NonNullable<BlockDataMap['cluster']['clusters']>[number];
    x: number;
    y: number;
    w: number;
    h: number;
  }
  const clusterBoxes: ClusterBox[] = [];

  // Namespaces sit side by side, each sized to its own services (≤2 per row) —
  // no shared width, so a one-service namespace stays a small box.
  let x = outerPad;
  let maxH = 0;
  for (const c of clusters) {
    const list = svcByCluster.get(c.id) ?? [];
    const colsC = Math.min(2, Math.max(1, list.length));
    const rowsC = Math.max(1, Math.ceil(list.length / colsC));
    // Wide enough for the namespace label and its kind chip on one line.
    const headW = textWidth(c.label, FONT.eyebrow) + (c.kind !== undefined ? textWidth(c.kind, FONT.eyebrow) + 16 : 0) + 24;
    const w = Math.max(colsC * serviceW + (colsC - 1) * gapS + cPadX * 2, Math.min(Math.ceil(headW), MAX_PANEL_W));
    const h = cHeader + rowsC * serviceH + (rowsC - 1) * gapS + cPadBot;
    clusterBoxes.push({ c, x, y: outerPad, w, h });
    list.forEach((sv, i) => {
      const row = Math.floor(i / colsC);
      const col = i % colsC;
      rects.set(sv.id, {
        x: x + cPadX + (w - (colsC * serviceW + (colsC - 1) * gapS + cPadX * 2)) / 2 + col * (serviceW + gapS),
        y: outerPad + cHeader + row * (serviceH + gapS),
        w: serviceW,
        h: serviceH,
      });
    });
    if (h > maxH) maxH = h;
    x += w + cGap;
  }
  const width = x - cGap + outerPad;
  const height = outerPad * 2 + maxH;

  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"><title>Cluster diagram</title>`;

  // Namespace panels — the skin's group panel: paper-2 wash, hairline, an
  // eyebrow label top-left and the kind chip top-right.
  s += `<g${bl('clusters')}>`;
  clusterBoxes.forEach((cb, ci) => {
    const kindW = cb.c.kind !== undefined ? textWidth(cb.c.kind, FONT.eyebrow) + 16 : 0;
    const kindLabel =
      cb.c.kind !== undefined
        ? `<text x="${cb.x + cb.w - 12}" y="${cb.y + 16}" class="t-eyebrow" text-anchor="end">${escapeHtml(cb.c.kind)}</text>`
        : '';
    // A label longer than the widest panel is cut with "…" (full text in the title).
    const label = ellipsize(cb.c.label, cb.w - 24 - kindW, FONT.eyebrow, {
      path: `clusters.${ci}.label`,
      field: 'label',
      hint: 'Shorten the namespace `label`.',
    });
    s +=
      `<g${bp(`clusters.${ci}`)}>` +
      `<rect x="${cb.x}" y="${cb.y}" width="${cb.w}" height="${cb.h}" rx="6" fill="var(--paper-2)" fill-opacity="0.6" stroke="var(--rule-solid)" stroke-width="1"/>` +
      `<text x="${cb.x + 12}" y="${cb.y + 16}" class="t-eyebrow">${cutTitle(label)}${escapeHtml(label.lines[0] ?? '')}</text>` +
      kindLabel +
      `</g>`;
  });
  s += `</g>`; // close the clusters list container

  // edges — routed around every service, off the namespace borders, each
  // label on its own edge.
  const edgeKinds = new Set<string>();
  s += `<g${bl('edges')}>`;
  // Arrows meet the shape a kind draws (a gateway's bar, a cloud's outline),
  // not the cell around it.
  const kindOf = new Map(services.map((sv) => [sv.id, sv.kind]));
  const nameOf = new Map(services.map((sv) => [sv.id, sv.label]));
  const styleOf = (e: (typeof edges)[number]): { stroke: string; sw: number; dash: string; marker: string; err: boolean } =>
    SKIN_EDGE[e.kind ?? 'solid'] ??
    SKIN_EDGE['solid'] ?? { stroke: 'var(--muted)', sw: 1.5, dash: '', marker: 'skArrow', err: false };
  const bounds = { x: 0, y: 0, w: width, h: height };
  const { routes, labels } = layoutEdges(
    [...rects.entries()].map(([id, r]) => ({ id, box: edgeAnchorRect(kindOf.get(id), r, undefined, nameOf.get(id)), obstacle: r })),
    edges,
    edges.map((e, ei) => ({ label: e.label, err: styleOf(e).err, path: `edges.${ei}` })),
    {
      dir: 'LR',
      bounds,
      obstacles: clusterBoxes.map((cb) => ({ x: cb.x + 10, y: cb.y + 5, w: Math.min(Math.ceil(textWidth(cb.c.label, FONT.eyebrow)) + 4, cb.w - 20), h: 13 })),
      rails: clusterBoxes.map((cb) => ({ x: cb.x, y: cb.y, w: cb.w, h: cb.h })),
    },
  );
  edges.forEach((e, ei) => {
    const p = routes[ei];
    if (p === undefined) return;
    edgeKinds.add(e.kind ?? 'solid');
    const st = styleOf(e);
    const dash = st.dash.length > 0 ? ` stroke-dasharray="${st.dash}"` : '';
    s += `<path d="${p.d}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}"${dash} marker-end="url(#${st.marker})"${bp(`edges.${ei}`)}/>`;
  });
  s += `</g>`; // close the edges list container

  // The single accent: the one gateway-kind service, if exactly one.
  const gateways = services.filter((sv) => (sv.kind ?? '').toLowerCase() === 'gateway');
  const accentId = gateways.length === 1 ? gateways[0]?.id : undefined;

  // services — the block family's shaped nodes, plus the replica marks.
  s += `<g${bl('services')}>`;
  services.forEach((sv, si) => {
    const r = rects.get(sv.id);
    if (r === undefined) return;
    const reps = sv.replicas ?? 0;
    let repIndicator = '';
    if (reps > 0) {
      const shown = Math.min(reps, 5);
      // A cylinder's bottom rim takes the last 13px; the marks sit above it.
      const baseY = CYLINDER_KINDS.has((sv.kind ?? '').toLowerCase()) ? r.y + r.h - 24 : r.y + r.h - 14;
      let bars = '';
      for (let j = 0; j < shown; j++) {
        bars += `<rect x="${r.x + 12 + j * 7}" y="${baseY}" width="4" height="8" rx="1" fill="var(--muted)"/>`;
      }
      repIndicator =
        `<g>` +
        bars +
        `<text x="${r.x + 12 + shown * 7 + 4}" y="${baseY + 7}" class="t-sub">×${reps}</text>` +
        `</g>`;
    }
    const node = renderShapedNode(
      {
        kind: sv.kind,
        name: sv.label,
        ...(sv.tech !== undefined ? { tech: sv.tech } : {}),
        path: `services.${si}`,
        reserveBottom: reserveOf(sv),
      },
      r,
      undefined,
      sv.id === accentId,
    );
    s += `<g${bp(`services.${si}`)}>${node}${repIndicator}</g>`;
  });
  s += `</g>`; // close the services list container

  s += labels.overlay; // labels on top, never crossed by a line
  s += `</svg>`;
  const steps = labels.legend;
  const geometry = geometryOf({
    nodeWord: 'service',
    edgeWord: 'edge',
    nodes: services.map((sv, si) => ({ id: sv.id, name: sv.label, path: `services.${si}` })),
    edges: edges.map((e, ei) => ({ from: e.from, to: e.to, label: e.label, path: `edges.${ei}` })),
    routes,
    fallbacks: labels.fallbackIndex,
    labelBoxes: labels.boxes,
    nodeBoxes: [...rects.values()],
    quick: false,
    dir: 'LR',
    cells: false,
  });

  const legend = blockLegend(services, edgeKinds, accentId !== undefined);
  const html = diagramFrame(
    {
      tag: 'CLUSTER',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legend.length > 0 ? { legendHtml: legend } : {}),
    },
    s + steps,
  );
  return { html, geometry };
}
