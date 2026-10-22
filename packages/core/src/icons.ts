/**
 * The icon names a doc may use. Core keeps the names, so a lint can check an
 * icon without the drawings; the renderer keeps the drawings, typed against
 * this list, so the two never drift.
 *
 * The same names serve the `list` and `drivers` `icon` fields and the inline
 * `:name:` form in prose, table cells, and callout bodies.
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
  'arrow-up',
  'arrow-down',
  'arrow-right',
  'arrow-left',
  'plus',
  'alert',
  'ban',
  'bug',
  'rocket',
  'sparkle',
  'cloud',
  'cpu',
  'globe',
  'mail',
  'phone',
  'chat',
  'calendar',
  'search',
  'settings',
  'code',
  'terminal',
  'git-branch',
  'package',
  'chart',
  'trend-up',
  'trend-down',
  'dollar',
  'target',
  'heart',
  'thumbs-up',
  'thumbs-down',
  'bulb',
  'book',
  'home',
  'folder',
  'image',
  'play',
  'pause',
  'refresh',
  'download',
  'upload',
  'external',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

const NAMES: ReadonlySet<string> = new Set(ICON_NAMES);

/** True when `name` is a known icon. */
export function isIconName(name: string): name is IconName {
  return NAMES.has(name);
}

/** Spoken names that differ from the icon name with its hyphens read as spaces. */
const LABELS: Readonly<Partial<Record<IconName, string>>> = {
  x: 'cross',
  warn: 'warning',
  doc: 'document',
  bulb: 'idea',
  external: 'external link',
  phone: 'mobile phone',
};

/**
 * The accessible name of an inline icon: what a screen reader says for it.
 * An icon in a table cell can carry the whole meaning (`:check:` for "yes"),
 * so an inline icon is never hidden from assistive technology.
 */
export function iconLabel(name: IconName): string {
  return LABELS[name] ?? name.replace(/-/g, ' ');
}

/**
 * Plain-text stand-ins: the icons that mark a state or a direction have a
 * text symbol, so a search entry or a page description keeps them. Every
 * other icon sits beside words that carry its meaning, and plain text drops it.
 */
const TEXT: Readonly<Partial<Record<IconName, string>>> = {
  check: '✓',
  x: '✗',
  minus: '−',
  plus: '+',
  star: '★',
  'arrow-up': '↑',
  'arrow-down': '↓',
  'arrow-right': '→',
  'arrow-left': '←',
};

/** The plain-text stand-in for an icon, or `''` when plain text drops it. */
export function iconText(name: IconName): string {
  return TEXT[name] ?? '';
}

/**
 * Common emoji shortcodes an author may type from habit, mapped to the icon
 * that draws the same idea. Used only for "did you mean" hints; the renderer
 * draws known names only.
 */
export const ICON_SYNONYMS: Readonly<Record<string, IconName>> = {
  warning: 'warn',
  white_check_mark: 'check',
  heavy_check_mark: 'check',
  tick: 'check',
  cross: 'x',
  no_entry: 'ban',
  no_entry_sign: 'ban',
  information_source: 'info',
  mag: 'search',
  gear: 'settings',
  zap: 'bolt',
  sparkles: 'sparkle',
  lightbulb: 'bulb',
  memo: 'doc',
  file: 'doc',
  page_facing_up: 'doc',
  email: 'mail',
  envelope: 'mail',
  speech_balloon: 'chat',
  house: 'home',
  file_folder: 'folder',
  books: 'book',
  dart: 'target',
  moneybag: 'dollar',
  money: 'dollar',
  repeat: 'refresh',
  chart_with_upwards_trend: 'trend-up',
  chart_with_downwards_trend: 'trend-down',
  bar_chart: 'chart',
  iphone: 'phone',
  mobile: 'phone',
  hourglass: 'clock',
  computer: 'cpu',
  link_external: 'external',
};
