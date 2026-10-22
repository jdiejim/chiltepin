/**
 * `lintDocument` — every check one document can run on its own.
 *
 * One entry point, so `chiltepin check` and Studio report the same findings
 * for the same text: schema validation, the prose lint, the inline-styling
 * lint, the density budget, placeholder names, the graph lints, template
 * echo, and same-document links.
 * Checks that need more than the document stay with their callers: the
 * cross-document references and links (`resolveRefs`, over the whole set),
 * and the geometry and fit checks (they lay the drawing out with
 * `chiltepin-render`).
 *
 * Pure: no I/O. Findings come back in check order; callers sort them.
 */

import { lintDensity } from './density.js';
import type { Diagnostic } from './diagnostics.js';
import { lintGenericLabels } from './genericLabels.js';
import { lintGraphs } from './graphLints.js';
import { lintInline } from './inlineLint.js';
import { lintLocalLinks } from './links.js';
import { lintProse } from './prose/lint.js';
import { lintTemplateEcho } from './templateEcho.js';
import type { Document } from './types.js';
import { validateDocument } from './validate.js';

/**
 * Validates and lints one document.
 *
 * @param doc - The parsed document.
 * @param file - The file path to use in diagnostics.
 * @returns Errors from validation and dangling same-document links; every
 *   other finding is a warning.
 */
export function lintDocument(doc: Document, file: string): Diagnostic[] {
  return [
    ...validateDocument(doc, file),
    ...lintProse(doc, file),
    // Unknown icons and span classes, and too many highlights in a section.
    ...lintInline(doc, file),
    // A design nudge ("split this diagram"), never a gate.
    ...lintDensity(doc, file),
    // Placeholder node names (`Service A`, `New node`): a template echo.
    ...lintGenericLabels(doc, file),
    ...lintGraphs(doc, file),
    ...lintTemplateEcho(doc, file),
    ...lintLocalLinks(doc, file),
  ];
}
