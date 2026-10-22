/**
 * The icon names a doc may use. Core keeps the names, so a lint can check an
 * icon without the drawings; the renderer keeps the drawings, typed against
 * this list, so the two never drift.
 */
export const ICON_NAMES = [
  'location',
  'shield',
  'grid',
  'lock',
  'key',
  'user',
  'clock',
  'check',
  'database',
  'bolt',
  'flag',
  'doc',
  'link',
  'eye',
  'server',
  'layers',
  'x',
  'minus',
  'warn',
  'info',
  'star',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

const NAMES: ReadonlySet<string> = new Set(ICON_NAMES);

/** True when `name` is a known icon. */
export function isIconName(name: string): name is IconName {
  return NAMES.has(name);
}
