/**
 * Chiltepin core: parser, block schemas, validation, and reference resolver.
 *
 * Pure library — no I/O. Reads strings, returns models and diagnostics.
 *
 * @packageDocumentation
 */

export const version = '0.0.0';

export {
  BLOCK_TYPES,
  BLOCK_TYPE_SET,
  type BlockType,
  type Document,
  type MetaData,
  type ProseSegment,
  type Segment,
  type TypedSegment,
} from './types.js';

export {
  BLOCK_ALIASES,
  ALIAS_TYPE_SET,
  BLOCK_SYNONYMS,
  type BlockAlias,
} from './blocks/aliases.js';

export {
  normalizeBlockData,
  textBodyData,
  textBodyYaml,
  contractTerseItems,
  contractTerseValue,
  canonicalTerseItem,
  hasTerseGrammar,
} from './blocks/normalize.js';

export {
  resolveSwimlaneLane,
  swimlaneColumns,
  swimlanePlacements,
  type SwimlanePlacement,
  type SwimlaneStepInput,
  type SwimlaneLaneInput,
  type SwimlaneLinkInput,
  resolveSwimlanePhase,
  type SwimlanePhaseInput,
  type SwimlaneBand,
} from './blocks/swimlaneLayout.js';

export {
  MERMAID_SOURCE,
  MERMAID_KEYWORDS,
  detectMermaidKind,
  convertMermaid,
  mermaidBodyYaml,
  type MermaidKind,
  type MermaidResult,
} from './mermaid/index.js';

export {
  DIALECT_SOURCES,
  DIALECT_PARSE_CODE,
  DIALECT_PARSE_HINT,
  isDialectSource,
  detectDialectKind,
  convertDialect,
  dialectBodyYaml,
  type DialectSource,
} from './dialects.js';

export { convertDbml } from './import/dbml.js';
export { convertPrisma } from './import/prisma.js';
export { convertSqlDdl } from './import/sqlddl.js';
export { erdFence, serializeErdBody, type DialectResult } from './import/schemaModel.js';

export {
  type Diagnostic,
  type DiagnosticCode,
  type DiagnosticLevel,
  assertNever,
  helpUrl,
} from './diagnostics.js';

export { levenshtein, closest } from './suggest.js';
export { headingSlug, headingIds } from './slug.js';
export { ICON_NAMES, ICON_SYNONYMS, iconLabel, iconText, isIconName, type IconName } from './icons.js';
export {
  CHIP_STATUSES,
  ICON_FIELDS,
  INLINE_MD_FIELDS,
  SPAN_CLASSES,
  SPAN_HUES,
  inlineMdStrings,
  inlineStart,
  matchIcon,
  matchIconLike,
  matchMark,
  matchSpan,
  readSpanClasses,
  scanInline,
  stringsAt,
  stripInlineStyling,
  type ChipStatus,
  type FieldString,
  type IconMatch,
  type InlineFinding,
  type InlineMatch,
  type SpanClassResult,
  type SpanHue,
  type SpanMatch,
  type SpanProblem,
  type SpanStyle,
} from './inline.js';
export { HIGHLIGHT_LIMIT, lintInline } from './inlineLint.js';
export { splitMarkdown, type RawSegment } from './splitter.js';
export { parseBlockBody, locateYamlPath, type YamlParseResult, type YamlLocation } from './yaml.js';
export { parseDocument } from './parser.js';
export {
  validateDocument,
  isNearDuplicateTitle,
  trailingHeading,
  stripHeadingMarkers,
  readSourceMarker,
  readAlignMarker,
  readBuildMarker,
} from './validate.js';
export {
  segmentSpan,
  replaceBlockBody,
  replaceProse,
  insertBlock,
  insertProse,
  removeSegment,
  moveSegment,
  serializeBlockData,
  editableBodyYaml,
  setYamlPath,
  deleteYamlPath,
  contractTerseAt,
  type SegmentSpan,
} from './edit.js';
export { resolveRefs, type RefGraph, type InputDocument } from './resolve.js';

export {
  lintProse,
  PROSE_CHECK_CODES,
  type ProseCheckCode,
  type ProseLintOptions,
} from './prose/lint.js';
export { type ProseContext, type ProseUnit, collectProseUnits } from './prose/surfaces.js';

export { lintDensity, DENSITY_BUDGETS, type DensityBudget } from './density.js';
export {
  lintGenericLabels,
  isGenericLabel,
  isPlaceholderGroupLabel,
  GENERIC_LABEL_FIELDS,
} from './genericLabels.js';
export { lintGraphs } from './graphLints.js';
export { lintTemplateEcho } from './templateEcho.js';
export { lintDocument } from './lintDocument.js';
export {
  proseLinks,
  markdownHeadings,
  docHeadings,
  docAnchors,
  blockIds,
  resolveLinkTarget,
  lintLocalLinks,
  type ProseLink,
  type LinkTarget,
  type MarkdownHeading,
} from './links.js';

export {
  blockSchemas,
  type BlockDataMap,
  metaSchema,
  META_STATUSES,
  calloutSchema,
  tableSchema,
  sequenceSchema,
  SEQUENCE_FRAME_KINDS,
  erdSchema,
  ERD_CARDS,
  ERD_ENTITY_KINDS,
  userstorySchema,
  timelineSchema,
  kanbanSchema,
  proseSchema,
  glossarySchema,
  prosconsSchema,
  cvtSchema,
  statsSchema,
  codeSchema,
  agendaSchema,
  treeSchema,
  pyramidSchema,
  flowSchema,
  stateSchema,
  dfdSchema,
  journeySchema,
  ganttSchema,
  graphSchema,
  quadrantSchema,
  swimlaneSchema,
  c4Schema,
  umlSchema,
  frontendSchema,
  clusterSchema,
  blockGraphSchema,
  felogicSchema,
  statustableSchema,
  cycleSchema,
  STATUSTABLE_DEFAULT_STATUSES,
  STATUS_COLOR_ALIASES,
  normalizeStatusColor,
  type StatusColor,
} from './blocks/schemas.js';

export { blockRegistry, type BlockDef, type BlockRegistry } from './blocks/registry.js';

export { describeBlockSchema, type FieldNode } from './blocks/introspect.js';
export { rescueInlineCommas } from './blocks/rescue.js';

export {
  blockContract,
  formatBlockContract,
  terseFieldsOf,
  TERSE_HINTS,
  type BlockContract,
} from './blocks/contract.js';

export { stringOnlyAt } from './blocks/schema-walk.js';

export {
  BLOCK_TEMPLATES,
  templateBody,
  BLOCK_DESCRIPTIONS,
  BLOCK_LABELS,
  BLOCK_FAMILY,
  BLOCK_FAMILIES,
  familyBlocks,
  isBlockFamily,
  type BlockFamily,
} from './blocks/catalog.js';

export {
  DOC_TEMPLATES,
  DOC_TEMPLATE_INFO,
  isDocTemplate,
  type DocTemplateInfo,
} from './blocks/docTemplates.js';

export {
  parseCsv,
  csvToTable,
  csvToStatustable,
  csvToChart,
  suggestCsvImport,
  type ImportDiagnostic,
  type CsvDelimiter,
  type ParseCsvOptions,
  type ParseCsvResult,
  type CsvImportResult,
  type CsvImportSuggestion,
  type CsvToTableOptions,
  type CsvToStatustableOptions,
  type CsvToChartOptions,
} from './import/csv.js';

export { IMPORTERS, importerForFile, type Importer } from './import/registry.js';

export { parseOpenApi } from './import/openapi/parse.js';
export { openapiToMarkdown, type GenerateOptions } from './import/openapi/generate.js';
export {
  openApiSchema,
  HTTP_METHODS,
  type OpenApiSpec,
  type OpenApiOperation,
  type OpenApiSchema,
  type OpenApiParameter,
  type HttpMethod,
} from './import/openapi/schemas.js';
