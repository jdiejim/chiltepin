import { describe, expect, it } from 'vitest';
import { ICON_NAMES, isIconName } from 'chiltepin-core';
import { ICONS, iconPaths, iconSvg } from '../svg/icons.js';

describe('shared icons', () => {
  it('draws every name core lists, and nothing more', () => {
    expect(Object.keys(ICONS).sort()).toEqual([...ICON_NAMES].sort());
    for (const name of ICON_NAMES) expect(ICONS[name]).toMatch(/^<(path|circle|rect|ellipse)/);
  });

  it('knows a name only when it is listed', () => {
    expect(isIconName('check')).toBe(true);
    expect(isIconName('nope')).toBe(false);
    expect(iconPaths('nope')).toBeUndefined();
  });

  it('draws an unknown name as the fallback ring, at the same size', () => {
    expect(iconSvg('nope')).toContain('<circle cx="12" cy="12" r="8"/>');
    expect(iconSvg('check', 'ic')).toContain('class="ic"');
    expect(iconSvg('check')).not.toContain('#');
  });
});
