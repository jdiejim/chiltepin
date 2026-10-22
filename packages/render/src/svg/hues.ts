/**
 * The category hues — the second colour channel of the skin (`DESIGN.md` ›
 * Two channels). Hue says *what kind of thing* a mark is: a node's family
 * (from its `kind`) or a group's zone. The renderer picks it from the data;
 * an author names a hue only on a group or layer (`color: teal`), never on a
 * node. The accent keeps the other channel: the one focal answer.
 *
 * Every hue is a role token pair in `css.ts` — `--hue-<name>` (text-safe on
 * paper, paper-2 and its own tint) and `--hue-<name>-tint` (an opaque fill).
 * No value lives here.
 */

/** The six category hues, in the rotation order groups take them. */
export const HUES = ['blue', 'amber', 'violet', 'teal', 'green', 'rose'] as const;

export type Hue = (typeof HUES)[number];

const HUE_SET: ReadonlySet<string> = new Set(HUES);

/** True when `v` names one of the category hues (`blue`, `teal`, …). */
export function isHue(v: string | undefined): v is Hue {
  return v !== undefined && HUE_SET.has(v.trim().toLowerCase());
}

/** The hue named by an author's `color` value, or `undefined` for a hex / anything else. */
export function hueOf(color: string | undefined): Hue | undefined {
  if (color === undefined) return undefined;
  const v = color.trim().toLowerCase();
  return HUE_SET.has(v) ? (v as Hue) : undefined;
}

/** The hue's line / text colour token. */
export function hueInk(h: Hue): string {
  return `var(--hue-${h})`;
}

/** The hue's opaque tint token — a node or panel fill. */
export function hueTint(h: Hue): string {
  return `var(--hue-${h}-tint)`;
}

/** The text-colour modifier class (` c-<hue>`), with its leading space. */
export function hueClass(h: Hue | undefined): string {
  return h === undefined ? '' : ` c-${h}`;
}

/**
 * Assigns a hue to each of `n` panels (groups or layers), deterministically.
 *
 * - An authored hue (`color: teal`) is kept as written.
 * - An authored non-hue colour (a hex) gets no hue — the legacy tint path.
 * - Otherwise the panel takes `preferred[i]` — the family hue most of its
 *   nodes share — unless another panel already holds that hue; then the next
 *   free hue in {@link HUES} order. Panels differ from each other until all
 *   six hues are spent, after which the rotation repeats.
 *
 * `auto: false` keeps unnamed panels hue-less (the renderer's neutral panel).
 */
export function assignPanelHues(
  colors: readonly (string | undefined)[],
  preferred: readonly (Hue | undefined)[] = [],
  auto = true,
): (Hue | undefined)[] {
  const out: (Hue | undefined)[] = colors.map((c) => hueOf(c));
  const taken = new Set<Hue>(out.filter((h): h is Hue => h !== undefined));
  let cursor = 0;
  colors.forEach((c, i) => {
    if (!auto || c !== undefined) return;
    const want = preferred[i];
    let pick: Hue | undefined = want !== undefined && !taken.has(want) ? want : undefined;
    if (pick === undefined) {
      for (let k = 0; k < HUES.length; k++) {
        const h = HUES[(cursor + k) % HUES.length] as Hue;
        if (!taken.has(h)) {
          pick = h;
          cursor = (cursor + k + 1) % HUES.length;
          break;
        }
      }
    }
    if (pick === undefined) {
      // All six spent: repeat the rotation (still deterministic).
      pick = HUES[cursor % HUES.length] as Hue;
      cursor = (cursor + 1) % HUES.length;
    }
    taken.add(pick);
    out[i] = pick;
  });
  return out;
}

/** The hue most of `hues` share (ties: the first to reach the top count); `undefined` when none has one. */
export function dominantHue(hues: readonly (Hue | undefined)[]): Hue | undefined {
  const counts = new Map<Hue, number>();
  let best: Hue | undefined;
  let bestN = 0;
  for (const h of hues) {
    if (h === undefined) continue;
    const n = (counts.get(h) ?? 0) + 1;
    counts.set(h, n);
    if (n > bestN) {
      best = h;
      bestN = n;
    }
  }
  return best;
}
