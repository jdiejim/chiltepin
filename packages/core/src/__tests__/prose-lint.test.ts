import { describe, expect, it } from 'vitest';
import { parseDocument } from '../parser.js';
import { lintProse, PROSE_CHECK_CODES } from '../prose/lint.js';
import { messages, SENTENCE_LIMIT } from '../prose/checks.js';
import { splitSentences } from '../prose/text.js';

/** Parses and lints a markdown string in one step. */
function lint(md: string, file = 'doc.md') {
  return lintProse(parseDocument(md, 'doc'), file);
}

function codes(md: string): string[] {
  return lint(md).map((d) => d.code);
}

describe('sentence splitter', () => {
  it('splits ordinary sentences', () => {
    const s = splitSentences('The cache is warm. The reads are fast.');
    expect(s.map((x) => x.text)).toEqual(['The cache is warm.', 'The reads are fast.']);
  });

  it('does not split on e.g., i.e., vs., or etc.', () => {
    const s = splitSentences('Use a queue, e.g. SQS, for retries vs. inline calls, i.e. no coupling.');
    expect(s).toHaveLength(1);
  });

  it('does not split on decimals, versions, or file extensions', () => {
    const s = splitSentences('Version v1.2 writes 3.5 MB to demo.md every run.');
    expect(s).toHaveLength(1);
  });

  it('splits after a terminator followed by closing quotes or emphasis markers', () => {
    const bold = splitSentences('**The winner is derived.** Each row marks its best value.');
    expect(bold.map((x) => x.text)).toEqual([
      '**The winner is derived.**',
      'Each row marks its best value.',
    ]);
    const quoted = splitSentences('He said "stop." Then we left.');
    expect(quoted.map((x) => x.text)).toEqual(['He said "stop."', 'Then we left.']);
  });

  it('does not split inside inline code or links', () => {
    const s = splitSentences('Run `chiltepin check --fix. now` first. See [docs](https://a.dev/x.y?q=1.2) next.');
    expect(s).toHaveLength(2);
  });

  it('masks an inline code span that wraps across a soft line break', () => {
    const s = splitSentences('The kind is one of: `alpha · beta ·\ngamma · delta` — pick one.');
    expect(s).toHaveLength(1);
    expect(s[0]?.words).toBe(7);
  });

  it('counts words after stripping code spans, URLs, and doc#id refs', () => {
    const s = splitSentences('See orders-api#happy-path and `some very long code span` at https://example.com/a/b now.');
    expect(s).toHaveLength(1);
    // Countable words: See, and, at, now.
    expect(s[0]?.words).toBe(4);
  });
});

describe('W_PROSE_LONG_SENTENCE', () => {
  const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');

  it('flags a descriptive sentence over 25 words', () => {
    const diags = lint(`Intro.\n\n${words(26)}.\n`);
    const hit = diags.find((d) => d.code === 'W_PROSE_LONG_SENTENCE');
    expect(hit).toBeDefined();
    expect(hit?.level).toBe('warn');
    expect(hit?.message).toContain('26 words');
    expect(hit?.message).toContain('…');
    expect(hit?.hint).toContain('25');
  });

  it('accepts a descriptive sentence of exactly 25 words', () => {
    expect(codes(`${words(25)}.\n`)).toEqual([]);
  });

  it('flags a procedural sentence over 20 words (steps item body)', () => {
    const md = `\`\`\`steps
items:
  - title: Install
    body: ${words(21)}.
\`\`\`
`;
    const diags = lint(md);
    expect(diags.map((d) => d.code)).toContain('W_PROSE_LONG_SENTENCE');
    expect(diags[0]?.hint).toContain('20');
  });

  it('does not count a long URL or code span toward the limit', () => {
    const md = `${words(20)} plus \`${words(30)}\` and https://example.com/${'x'.repeat(40)} end.\n`;
    // 20 + "plus" + "and" + "end" = 23 words, under the descriptive limit.
    expect(codes(md)).toEqual([]);
  });
});

describe('W_PROSE_LONG_PARAGRAPH', () => {
  it('flags a descriptive paragraph over 6 sentences', () => {
    const para = Array.from({ length: 7 }, (_, i) => `Sentence number ${i} is short.`).join(' ');
    const diags = lint(`${para}\n`);
    const hit = diags.find((d) => d.code === 'W_PROSE_LONG_PARAGRAPH');
    expect(hit?.message).toContain('7 sentences');
  });

  it('accepts 6 descriptive sentences', () => {
    const para = Array.from({ length: 6 }, (_, i) => `Sentence number ${i} is short.`).join(' ');
    expect(codes(`${para}\n`)).toEqual([]);
  });

  it('flags a steps item body over 3 sentences', () => {
    const md = `\`\`\`steps
items:
  - title: Deploy
    body: Push the tag. Wait for CI. Check the logs. Roll back on red.
\`\`\`
`;
    expect(codes(md)).toContain('W_PROSE_LONG_PARAGRAPH');
  });

  it('a bare > line splits blockquote paragraphs', () => {
    const four = 'One fact here. Two facts here. Three facts here. Four facts here.';
    // 8 sentences in one quote, split 4/4 by a bare `>` line: no finding.
    const md = `> ${four}\n>\n> ${four}\n`;
    expect(codes(md)).toEqual([]);
  });

  it('treats each markdown list item as its own paragraph', () => {
    // Seven one-sentence bullets — a list is not a paragraph.
    const md = Array.from({ length: 7 }, (_, i) => `- Bullet ${i} is short.`).join('\n');
    expect(codes(`${md}\n`)).toEqual([]);
  });

  const sevenSentences = Array.from({ length: 7 }, (_, i) => `Sentence number ${i} is short.`).join(' ');

  it('exempts a 7-sentence block description (fields stay complete)', () => {
    const md = `\`\`\`chart
description: ${sevenSentences}
\`\`\`
`;
    expect(codes(md)).toEqual([]);
  });

  it('exempts a 7-sentence callout body', () => {
    const md = `\`\`\`callout
body: ${sevenSentences}
\`\`\`
`;
    expect(codes(md)).toEqual([]);
  });

  it('still flags a 7-sentence prose block text', () => {
    const md = `\`\`\`prose
blocks:
  - type: p
    text: ${sevenSentences}
\`\`\`
`;
    expect(codes(md)).toContain('W_PROSE_LONG_PARAGRAPH');
  });
});

describe('block text fields keep the form checks', () => {
  const callout = (body: string) => `\`\`\`callout
body: ${body}
\`\`\`
`;

  it('long sentence still fires in a field', () => {
    const long = Array.from({ length: 26 }, (_, i) => `word${i}`).join(' ');
    expect(codes(callout(`${long}.`))).toContain('W_PROSE_LONG_SENTENCE');
  });

  it('tense still fires in a field', () => {
    expect(codes(callout('The parser has failed twice.'))).toContain('W_PROSE_TENSE');
  });

  it('filler opener still fires in a field', () => {
    expect(codes(callout('At a high level the design holds.'))).toContain('W_PROSE_FILLER_OPENER');
  });
});

describe('W_PROSE_PASSIVE_STEP', () => {
  const steps = (body: string) => `\`\`\`steps
items:
  - title: Step
    body: ${body}
\`\`\`
`;

  it('flags aux + regular -ed participle in a step', () => {
    const diags = lint(steps('The config is loaded by the CLI.'));
    const hit = diags.find((d) => d.code === 'W_PROSE_PASSIVE_STEP');
    expect(hit).toBeDefined();
    expect(hit?.message).toContain('is loaded');
    expect(hit?.hint).toContain('active voice');
  });

  it('flags aux + irregular participle in a step', () => {
    expect(codes(steps('The file is written to disk.'))).toContain('W_PROSE_PASSIVE_STEP');
  });

  it('flags get-passives', () => {
    expect(codes(steps('The branch gets merged after review.'))).toContain('W_PROSE_PASSIVE_STEP');
  });

  it('does not flag a copula + adjective', () => {
    expect(codes(steps('The button is red.'))).toEqual([]);
    expect(codes(steps('The setup is complicated.'))).toEqual([]);
    expect(codes(steps('The output is unchanged.'))).toEqual([]);
  });

  it('never fires outside steps blocks', () => {
    expect(codes('The config is loaded by the CLI.\n')).toEqual([]);
  });
});

describe('W_PROSE_TENSE', () => {
  const tense = (s: string) => lint(`${s}\n`).filter((d) => d.code === 'W_PROSE_TENSE');

  it('allows the present perfect with `since <time or event>` (incident and status prose)', () => {
    expect(tense('The ledger has been failing since 09:00.')).toEqual([]);
    expect(tense('The worker has retried 3 times since the deploy.')).toEqual([]);
  });

  it('allows the present perfect with `for <duration>`', () => {
    expect(tense('The queue has grown for 40 minutes.')).toEqual([]);
    expect(tense('Checkout has been degraded for 2h.')).toEqual([]);
  });

  it('still flags other non-simple tenses', () => {
    expect(tense('The parser has failed twice.')).toHaveLength(1);
    expect(tense('We had rolled back the deploy since the page fired.')).toHaveLength(1);
    expect(tense('The worker is retrying every 30 seconds.')).toHaveLength(1);
    expect(tense('The team has shipped it for the customer.')).toHaveLength(1);
  });

  it('flags perfect tense anywhere', () => {
    const diags = lint('The parser has failed twice.\n');
    const hit = diags.find((d) => d.code === 'W_PROSE_TENSE');
    expect(hit?.message).toContain('Perfect tense');
  });

  it('flags has been (perfect with irregular participle)', () => {
    expect(codes('The cache has been slow.\n')).toContain('W_PROSE_TENSE');
  });

  it('flags progressive tense anywhere', () => {
    const diags = lint('The job is running now.\n');
    const hit = diags.find((d) => d.code === 'W_PROSE_TENSE');
    expect(hit?.message).toContain('Progressive tense');
  });

  it('does not flag has + adjectival -ed', () => {
    expect(codes('The service has detailed logs.\n')).toEqual([]);
    expect(codes('The plan has limited scope.\n')).toEqual([]);
  });

  it('does not flag -ing nouns and adjectives', () => {
    expect(codes('The value is a string.\n')).toEqual([]);
    expect(codes('The field is missing.\n')).toEqual([]);
    expect(codes('The release is pending.\n')).toEqual([]);
    expect(codes('The rest is nothing special.\n')).toEqual([]);
  });

  it('does not flag a gerund complement after a nominal subject', () => {
    expect(codes('The goal is testing the parser.\n')).toEqual([]);
    expect(codes('The fix is renaming the field.\n')).toEqual([]);
  });

  it('requires the -ing token directly after the aux', () => {
    expect(codes('The queue is for batching writes.\n')).toEqual([]);
  });

  it('does not flag copula + -ing mass nouns', () => {
    expect(codes('Everything else is engineering we already own.\n')).toEqual([]);
    expect(codes('The hard part is naming.\n')).toEqual([]);
  });

  it('does not flag hyphenated -ing compounds', () => {
    expect(codes('The named pattern is load-bearing here.\n')).toEqual([]);
    expect(codes('The check is long-running by design.\n')).toEqual([]);
  });

  it('does not flag an inverted gerund after "so is"', () => {
    expect(codes('A parent without a side is an error, and so is placing two children on one side.\n')).toEqual([]);
  });
});

describe('W_PROSE_FILLER_OPENER', () => {
  it('flags each banned opener at sentence start', () => {
    for (const opener of [
      'In this section',
      "It's important to note",
      'It is important to note',
      'This diagram shows',
      'This section',
      "Let's dive into",
      'At a high level',
      'The blocks below',
    ]) {
      const diags = lint(`${opener} the design.\n`);
      expect(diags.map((d) => d.code)).toContain('W_PROSE_FILLER_OPENER');
    }
  });

  it('matches case-insensitively', () => {
    expect(codes('at a high level the design holds.\n')).toContain('W_PROSE_FILLER_OPENER');
  });

  it('requires a word boundary after the prefix', () => {
    expect(codes('This sectional view helps.\n')).toEqual([]);
  });

  it('only fires at sentence start', () => {
    expect(codes('The doc covers this section.\n')).toEqual([]);
  });
});

describe('meta phrases (W_PROSE_FILLER_OPENER)', () => {
  it('flags a phrase that points at the brief the reader never saw', () => {
    for (const s of [
      'The request names no model, so this doc assumes Sonnet.',
      'The request named no services.',
      'The worker retries; the request named none.',
      'The request does not name a region.',
      'The fields are listed as requested.',
      'See the closing list for open questions.',
    ]) {
      const hit = lint(`${s}\n`).find((d) => d.message.startsWith('Meta phrase'));
      expect(hit?.code, s).toBe('W_PROSE_FILLER_OPENER');
      expect(hit?.hint).toContain('assumption');
    }
  });

  it('reads list items and table cells too, once each', () => {
    const md = '```list\nitems:\n  - "On-call DBA — the request names no give-up path"\n```\n';
    const hits = lint(md).filter((d) => d.message.startsWith('Meta phrase'));
    expect(hits).toHaveLength(1);
    expect(hits[0]?.line).toBe(1);
  });

  it('never flags the HTTP request', () => {
    for (const s of [
      'The request body carries the order id.',
      'An error sends the request to the wrong tool.',
      'If the request does not specify a version, the API uses v2.',
      'The request names the account in its path.',
      'Only the request path is synchronous.',
    ]) {
      expect(lint(`${s}\n`).filter((d) => d.message.startsWith('Meta phrase')), s).toEqual([]);
    }
  });
});

describe('W_PROSE_TERM_DRIFT', () => {
  const fixture = (prose: string) => `\`\`\`glossary
terms:
  - term: SLO
    def: The service-level objective the team commits to.
    avoid: [uptime target, service promise]
\`\`\`

${prose}
`;

  it('flags an avoided phrase in markdown prose, naming the approved term', () => {
    const diags = lint(fixture('The uptime target for reads holds at 99.9 percent.'));
    const hit = diags.find((d) => d.code === 'W_PROSE_TERM_DRIFT');
    expect(hit).toBeDefined();
    expect(hit?.message).toContain('"uptime target"');
    expect(hit?.message).toContain('"SLO"');
    expect(hit?.hint).toContain('Replace');
    expect(hit?.value).toBe('uptime target');
  });

  it('matches case-insensitively on a word boundary', () => {
    expect(codes(fixture('Our Uptime Target is strict.'))).toContain('W_PROSE_TERM_DRIFT');
    expect(codes(fixture('The uptime targets2 metric is unrelated.'))).not.toContain(
      'W_PROSE_TERM_DRIFT',
    );
  });

  it('flags an avoided phrase in a block text field', () => {
    const md = `${fixture('Clean prose here.')}
\`\`\`callout
body: We hold the service promise for reads.
\`\`\`
`;
    expect(codes(md)).toContain('W_PROSE_TERM_DRIFT');
  });

  it('ignores matches inside inline code', () => {
    expect(codes(fixture('Set `uptime target` in the config.'))).toEqual([]);
  });

  it('reports nothing without a glossary avoid list', () => {
    const md = '```glossary\nterms:\n  - SLO — the objective.\n```\n\nThe uptime target holds.\n';
    expect(codes(md)).toEqual([]);
  });
});

describe('lintProse API', () => {
  it('returns only warnings with W_PROSE_ codes and the given file path', () => {
    const diags = lint('This section has been growing while it is running along without a break, but the goal is described here.\n', 'x/y.md');
    expect(diags.length).toBeGreaterThan(0);
    for (const d of diags) {
      expect(d.level).toBe('warn');
      expect(d.code.startsWith('W_PROSE_')).toBe(true);
      expect(d.file).toBe('x/y.md');
      expect(d.hint).toBeDefined();
    }
  });

  it('honors the checks filter', () => {
    const md = 'In this section the parser has failed.\n';
    const all = lintProse(parseDocument(md, 'doc'), 'doc.md');
    expect(all.map((d) => d.code).sort()).toEqual(['W_PROSE_FILLER_OPENER', 'W_PROSE_TENSE']);
    const only = lintProse(parseDocument(md, 'doc'), 'doc.md', { checks: ['W_PROSE_TENSE'] });
    expect(only.map((d) => d.code)).toEqual(['W_PROSE_TENSE']);
  });

  it('never analyzes headings, code fences, or table rows', () => {
    const md = [
      '# This section has been running along for many words in a very long heading that keeps going and going',
      '',
      '```',
      'The config is loaded and it has been failing while it is running.',
      '```',
      '',
      '| The parser has failed | is running |',
      '| --- | --- |',
      '',
    ].join('\n');
    expect(codes(md)).toEqual([]);
  });

  it('carries a line number pointing into the source', () => {
    const md = 'Clean first line here.\n\nThe parser has failed.\n';
    const hit = lint(md).find((d) => d.code === 'W_PROSE_TENSE');
    expect(hit?.line).toBe(3);
  });

  it('never analyzes YAML frontmatter at the top of the document', () => {
    const md = [
      '---',
      'name: my-skill',
      'description: >-',
      '  The parser has failed and it is running while this very long line keeps on going past every sentence limit we set for descriptive prose in a document.',
      '---',
      '',
      'The parser has failed.',
      '',
    ].join('\n');
    const diags = lint(md);
    // Only the real prose after the frontmatter is analyzed.
    expect(diags.map((d) => d.code)).toEqual(['W_PROSE_TENSE']);
    expect(diags[0]?.line).toBe(7);
  });

  it('a shorter ``` inside a ```` example fence is content, not a toggle', () => {
    const md = [
      'Clean opening line.',
      '',
      '````',
      '## Example',
      '',
      '```sequence',
      'id: seq-1',
      'actors: []',
      'messages: []',
      '```',
      '',
      'The parser has failed inside the example, and it is running long.',
      '````',
      '',
      'The parser has failed.',
      '',
    ].join('\n');
    const diags = lint(md);
    expect(diags.map((d) => d.code)).toEqual(['W_PROSE_TENSE']);
    expect(diags[0]?.line).toBe(15);
  });

  it('a typed block split out of an open ```` fence stays example content', () => {
    // The block parser lifts the ```sequence fence into its own segment even
    // inside a ```` example; fence state must survive across segments so the
    // text after the inner block is still masked.
    const md = [
      '````',
      '```prose',
      'description: The parser has failed while it is running.',
      '```',
      'The cache has been slow in this example line.',
      '````',
      '',
      'Real prose has failed here.',
      '',
    ].join('\n');
    const diags = lint(md);
    expect(diags.map((d) => d.code)).toEqual(['W_PROSE_TENSE']);
    expect(diags[0]?.line).toBe(8);
  });
});

describe('the linter passes its own messages (STE self-test)', () => {
  const examples = [
    messages.longSentence(27, 'the span', 'procedural'),
    messages.longSentence(31, 'the span', 'descriptive'),
    messages.longParagraph(8, 'procedural'),
    messages.longParagraph(9, 'descriptive'),
    messages.passiveStep('the span'),
    messages.tense('perfect', 'the span'),
    messages.tense('progressive', 'the span'),
    messages.fillerOpener('In this section'),
    messages.termDrift('uptime target', 'the span', 'SLO'),
  ];

  it('keeps every message and hint sentence at 20 words or fewer', () => {
    for (const ex of examples) {
      for (const text of [ex.message, ex.hint]) {
        for (const s of splitSentences(text)) {
          expect(s.words, `too long: ${s.text}`).toBeLessThanOrEqual(SENTENCE_LIMIT.procedural);
        }
      }
    }
  });

  it('exposes all six codes', () => {
    expect(PROSE_CHECK_CODES).toHaveLength(6);
  });
});
