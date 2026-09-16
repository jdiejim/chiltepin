/**
 * Markdown mode of the snippet highlighter (`lang: markdown`): headings,
 * emphasis, links, list markers and quotes get token colors, and fenced
 * regions inside the sample still run the generic code tokenizer.
 */

import { describe, expect, it } from 'vitest';
import { highlightCode } from '../highlight.js';

const MD = [
  '# Title',
  '',
  'Some **bold** and *soft* and `inline()` text.',
  '',
  '- first [link](https://x.dev)',
  '> a quote',
  '```js',
  'const x = f(1)',
  '```',
].join('\n');

describe('highlightCode lang=markdown', () => {
  it('colors Markdown structure', () => {
    const html = highlightCode(MD, 'markdown');
    expect(html).toContain('<span class="kw"># Title</span>');
    expect(html).toContain('<span class="fn">**bold**</span>');
    expect(html).toContain('<span class="ty">*soft*</span>');
    expect(html).toContain('<span class="str">`inline()`</span>');
    expect(html).toContain('<span class="num">-</span>');
    expect(html).toContain('<span class="fn">[link]</span><span class="com">(https://x.dev)</span>');
    expect(html).toContain('<span class="com">&gt; a quote</span>');
    // Inside the fence, the generic tokenizer takes over.
    expect(html).toContain('<span class="kw">const</span>');
    expect(html).toContain('<span class="fn">f</span>');
  });

  it('only the md/markdown/mdx labels switch modes', () => {
    expect(highlightCode('# not a heading', 'python')).toContain('class="com"'); // # = comment
    expect(highlightCode('# heading', 'MD')).toContain('class="kw"');
    expect(highlightCode('# heading')).toContain('class="com"'); // no lang → generic
  });

  it('escapes HTML in every branch', () => {
    const html = highlightCode('# <b>\n**<i>**\n> <u>', 'md');
    expect(html).not.toContain('<b>');
    expect(html).not.toContain('<i>');
    expect(html).not.toContain('<u>');
  });

  it('lang: text (and plain / prompt) gets no token spans at all', () => {
    const prompt = 'Role: Act as a reviewer.\n- Start with: [files]. Do not delete this block for now.';
    for (const lang of ['text', 'plain', 'plaintext', 'prompt']) {
      const out = highlightCode(prompt, lang);
      expect(out).not.toContain('<span');
      expect(out).toContain('Do not delete this block for now.');
    }
    // and without a plain label the same words are still highlighted as code
    expect(highlightCode(prompt, 'js')).toContain('<span class="kw">');
  });
});
