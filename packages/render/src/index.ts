/**
 * Chiltepin HTML renderer.
 *
 * Pure function: takes a parsed {@link Document}, returns a standalone HTML
 * string. No DOM, no browser, no I/O.
 *
 * @packageDocumentation
 */

export { houseCss, LIGHT_SET, DARK_SET, systemSchemeCss } from './css.js';
export { FAVICON_SVG, FAVICON_DATA_URI, FAVICON_LINK } from './brand.js';
export { escapeHtml } from './escape.js';
export { safeColor, safeUrl } from './sanitize.js';
export { renderProse, proseHeadings, type ProseHeading } from './markdown.js';
export {
  renderToc,
  type DocumentOutline,
  type DocumentHeading,
  type DocumentFigure,
} from './outline.js';
export { schemeMarkup, renderDocument, type RenderOptions } from './document.js';
export {
  renderDocumentParts,
  renderDocumentSegments,
  renderSlides,
  buildThemeVars,
  type RenderPartsOptions,
  type ColorScheme,
  type DocumentParts,
  type DocumentSection,
  type RenderedSegment,
  type DocumentSegmentsResult,
  type Slide,
  type SlidePart,
  type SlidesResult,
} from './parts.js';
export { toSlides } from './deck.js';
export {
  htmlRenderers,
  type HtmlRenderer,
  type HtmlRendererRegistry,
} from './registry.js';
export {
  themes,
  themeStyle,
  DEFAULT_THEME,
  type ThemeName,
} from './themes.js';

// Geometry report: what a grid diagram's layout could not avoid (W_GEOMETRY).
export {
  geometryReport,
  GEOMETRY_TYPES,
  type GeometryIssue,
  type GeometryIssueKind,
  type GeometryReport,
} from './geometryReport.js';

// Canonical node-kind lists (for editor dropdowns).
export { KNOWN_NODE_KINDS } from './svg/blockStyle.js';
export { KNOWN_LOGIC_KINDS } from './blocks/felogic.js';

// Re-export shared SVG utilities for downstream block renderers.
export {
  globalDefsSvg,
  ortho,
  wrapText,
  edgePill,
  type Box,
  type Route,
  type PillPoint,
} from './svg/index.js';
