/**
 * Heading anchors. One algorithm for the renderer (heading `id`s) and the
 * link check (`[text](#slug)`), so a link that resolves in `check` resolves
 * on the page.
 */
export function headingSlug(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_~]/g, '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'section';
}

/** Ids for headings in document order: a repeat, or a clash with `reserved` (block ids), gets `-2`, `-3`, … */
export function headingIds(texts: readonly string[], reserved: ReadonlySet<string> = new Set()): string[] {
  const used = new Set(reserved);
  return texts.map((t) => {
    const base = headingSlug(t);
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return id;
  });
}
