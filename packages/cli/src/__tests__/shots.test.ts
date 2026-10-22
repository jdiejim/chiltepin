import { describe, expect, it } from 'vitest';
import { shotAdvice } from '../commands/shots.js';

const shot = { index: 1, tag: 'FLOW', path: '/tmp/x.png', width: 900, scrolls: false, scale: 1 };

describe('shotAdvice', () => {
  it('says nothing for a drawing that fits the page', () => {
    expect(shotAdvice(shot)).toBeUndefined();
  });

  it('names the data fix when the drawing scrolls', () => {
    const advice = shotAdvice({ ...shot, width: 2400, scrolls: true });
    expect(advice).toContain('scrolls sideways (2400 wide)');
    expect(advice).toContain('dir: TB');
  });

  it('flags a drawing that shrinks below readable size', () => {
    expect(shotAdvice({ ...shot, width: 1500, scale: 0.62 })).toContain('shrinks to 62%');
    expect(shotAdvice({ ...shot, width: 1100, scale: 0.85 })).toBeUndefined();
  });
});
