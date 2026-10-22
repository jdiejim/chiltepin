/**
 * Global SVG `<defs>` shared by multiple block renderers (markers used as edge
 * arrow heads, a drop-shadow filter for boxed nodes).
 *
 * Emitted once near the top of the rendered body so subsequent SVGs can
 * reference them by id. Ported from `resources/doc-studio.jsx` `GlobalDefs`.
 */

/**
 * Returns the SVG element containing global marker + filter definitions.
 * The element is invisible (width/height = 0) but the defs are scoped to the
 * document so any subsequent `<svg>` can use `marker-end="url(#gArrow)"` etc.
 */
export function globalDefsSvg(): string {
  return (
    `<svg width="0" height="0" style="position:absolute" aria-hidden="true">` +
    `<defs>` +
    `<marker id="gArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">` +
    `<path d="M0,0 L10,5 L0,10 z" fill="var(--charcoal)"/></marker>` +
    `<marker id="gSoft" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">` +
    `<path d="M0,0 L10,5 L0,10 z" fill="var(--gray)"/></marker>` +
    `<marker id="gErr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">` +
    `<path d="M0,0 L10,5 L0,10 z" fill="var(--negative)"/></marker>` +
    `<marker id="gTri" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="14" markerHeight="14" orient="auto-start-reverse">` +
    `<path d="M1,1 L13,7 L1,13 z" fill="var(--paper)" stroke="var(--purple)" stroke-width="1.2"/></marker>` +
    // The skin's heads (DESIGN.md › Strokes and arrows): a small 6px filled
    // head in `muted`, an open head for returns / async, `negative`, `accent`.
    `<marker id="skArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">` +
    `<path d="M0,0 L10,5 L0,10 z" fill="var(--muted)"/></marker>` +
    `<marker id="skOpen" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">` +
    `<path d="M1,1 L9,5 L1,9" fill="none" stroke="var(--muted)" stroke-width="1.6"/></marker>` +
    // The error head carries a cross on the line just behind it, so an error
    // edge still reads as one in greyscale and on paper, not by hue alone.
    `<marker id="skErr" viewBox="-16 0 26 10" refX="9" refY="5" markerWidth="15.6" markerHeight="6" orient="auto-start-reverse">` +
    `<path d="M0,0 L10,5 L0,10 z" fill="var(--negative)"/>` +
    `<path d="M-13,1.5 L-6,8.5 M-13,8.5 L-6,1.5" fill="none" stroke="var(--negative)" stroke-width="2" stroke-linecap="round"/></marker>` +
    `<marker id="skAccent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">` +
    `<path d="M0,0 L10,5 L0,10 z" fill="var(--accent)"/></marker>` +
    `<filter id="gshadow" x="-20%" y="-20%" width="140%" height="170%">` +
    `<feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="var(--ink)" flood-opacity="0.13"/></filter>` +
    `</defs>` +
    `</svg>`
  );
}
