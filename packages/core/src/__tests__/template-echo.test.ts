/**
 * W_TEMPLATE_ECHO: a doc that ships a `chiltepin new` template with its
 * example content in place warns once and names the template; a doc that
 * borrows one example sentence, or a doc the author rewrote, stays quiet.
 */

import { describe, expect, it } from 'vitest';
import { DOC_TEMPLATES } from '../blocks/docTemplates.js';
import { parseDocument } from '../parser.js';
import { lintTemplateEcho } from '../templateEcho.js';

const lint = (md: string) => lintTemplateEcho(parseDocument(md, 't'), 't.md');

describe('W_TEMPLATE_ECHO', () => {
  it.each(Object.keys(DOC_TEMPLATES))('flags the unedited %s template once', (name) => {
    const found = lint(DOC_TEMPLATES[name] as string);
    expect(found).toHaveLength(1);
    expect(found[0]?.code).toBe('W_TEMPLATE_ECHO');
    expect(found[0]?.level).toBe('warn');
    expect(found[0]?.value).toBe(name);
    expect(found[0]?.message).toMatch(/passages are example text from the `[a-z-]+` template, for example "/);
  });

  it('names the share and the first passage, on its line', () => {
    const [d] = lint(DOC_TEMPLATES['adr'] as string);
    expect(d?.message).toMatch(/^\d+ of \d+ passages are example text from the `adr` template/);
    expect(d?.line).toBeGreaterThan(0);
  });

  it('is silent for one borrowed sentence in an original doc', () => {
    const md =
      '```meta\ntitle: Refund ledger\n```\n\n' +
      'The refund worker reads settled charges from the ledger every minute and posts the reversal to the PSP.\n\n' +
      'A retry that lands after the charge succeeded bills the customer a second time.\n\n' +
      'Each refund row carries the operator who approved it and the ticket that asked for it.\n';
    expect(lint(md)).toEqual([]);
  });

  it('is silent for a doc marked `status: example`', () => {
    const adr = DOC_TEMPLATES['adr'] as string;
    const marked = adr.replace(/^(```meta\n)/, '$1status: example\n');
    expect(marked).not.toBe(adr);
    expect(lint(marked)).toEqual([]);
  });

  it('is silent once the example sentences are rewritten', () => {
    const rewritten = (DOC_TEMPLATES['runbook'] as string).replace(/[a-z]{5,}/g, (w) => w.split('').reverse().join(''));
    expect(lint(rewritten)).toEqual([]);
  });
});
