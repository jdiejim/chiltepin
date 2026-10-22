/**
 * Memoised derivation of the parsed/validated/rendered views of the current
 * source. Lives outside React so every component shares one computation per
 * (source, slug) pair — the store holds only the raw strings, and this module
 * turns them into a {@link Document}, diagnostics, and per-segment HTML.
 */

import {
  lintDocument,
  parseDocument,
  type Diagnostic,
  type Document,
} from 'chiltepin-core';
import { renderDocumentSegments, type DocumentSegmentsResult } from 'chiltepin-render';

/** Everything derivable from the current source. */
interface Derived {
  readonly doc: Document;
  readonly diagnostics: readonly Diagnostic[];
  /** `null` only if the renderer itself threw (a renderer bug, not user error). */
  readonly rendered: DocumentSegmentsResult | null;
  readonly renderError: string | null;
}

/**
 * Whether the rendered document paints a dark surface — selection outlines
 * and direct-edit highlights swap to high-contrast colors on it (navy on
 * near-black is invisible). The renderer's tokens follow the system
 * (`prefers-color-scheme`), so the surface does too.
 */
export function docSurface(systemDark: boolean): 'dark' | 'light' {
  return systemDark ? 'dark' : 'light';
}

interface CacheEntry {
  source: string;
  slug: string;
  value: Derived;
}

let cache: CacheEntry | null = null;

/**
 * Parses, lints, and renders `source`. Memoised on both inputs. The lints are
 * core's `lintDocument`, the same call `chiltepin check` makes, so the canvas
 * and the CLI report the same findings for the same text.
 */
export function derive(source: string, slug: string): Derived {
  if (cache !== null && cache.source === source && cache.slug === slug) {
    return cache.value;
  }
  const doc = parseDocument(source, slug);
  const diagnostics = lintDocument(doc, `${slug}.md`);
  let rendered: DocumentSegmentsResult | null = null;
  let renderError: string | null = null;
  try {
    rendered = renderDocumentSegments(doc);
  } catch (err) {
    renderError = err instanceof Error ? err.message : String(err);
  }
  const value: Derived = { doc, diagnostics, rendered, renderError };
  cache = { source, slug, value };
  return value;
}
