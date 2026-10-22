/**
 * `chiltepin new [name]` — one verb for "make something": full-document templates
 * (`chiltepin new adr`) and single-block scaffolds (`chiltepin new sequence`) resolved by
 * name; bare `chiltepin new` in a TTY opens an Ink picker with two sections — Doc
 * templates | Blocks (grouped by family).
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import React, { useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import {
  BLOCK_TEMPLATES,
  BLOCK_DESCRIPTIONS,
  BLOCK_FAMILIES,
  familyBlocks,
  type BlockFamily,
  type BlockType,
} from 'chiltepin-core';
import { DOC_TEMPLATES, DOC_TEMPLATE_INFO, isDocTemplate } from './docTemplates.js';
import { assertWritable } from '../io/write.js';

/**
 * Returns the template string for a block type. No scaffold `## <type>`
 * heading: the skill's authoring rule is that headings state what the reader
 * sees (never the block type), and the example block's own title already
 * names the section — a type heading would just near-duplicate it (the
 * renderer would suppress one of them anyway).
 */
export function templateFor(type: BlockType): string {
  return `\`\`\`meta\ntitle: New document\ntag: DRAFT\n\`\`\`\n\n${BLOCK_TEMPLATES[type]}`;
}

// Full-document templates (adr, design-doc, deck, …) live in chiltepin-core;
// re-exported here so `chiltepin new` has one import site.
export { DOC_TEMPLATES, DOC_TEMPLATE_INFO, isDocTemplate };

/**
 * Writes a new doc to `out` from the chosen doc-template or block-type name.
 * Returns the absolute path written.
 *
 * A template is a starting point, never a replacement: an existing file at
 * `out` is left alone and the call throws unless `force` is set.
 */
export async function writeNewDoc(opts: {
  cwd: string;
  type: string;
  out: string;
  force?: boolean;
}): Promise<string> {
  const outAbs = resolve(opts.cwd, opts.out);
  assertWritable(outAbs, opts.force === true ? { force: true } : {});
  await mkdir(dirname(outAbs), { recursive: true });
  const content = isDocTemplate(opts.type)
    ? (DOC_TEMPLATES[opts.type] as string)
    : templateFor(opts.type as BlockType);
  await writeFile(outAbs, content, 'utf8');
  return outAbs;
}

const DOCS_SECTION = '__docs__';

interface PickerProps {
  /** Called once with the picked doc-template or block-type name. */
  readonly onPick: (name: string) => void;
}

/**
 * Ink picker for bare `chiltepin new` — two sections: Doc templates (titles +
 * descriptions from {@link DOC_TEMPLATE_INFO}) | Blocks, grouped by family.
 * `q`/escape cancels; the caller decides what to do with the picked name.
 */
export function NewPickerApp({ onPick }: PickerProps): React.JSX.Element {
  const { exit } = useApp();
  const [section, setSection] = useState<'top' | typeof DOCS_SECTION | BlockFamily>('top');

  useInput((input, key) => {
    if (input === 'q' || key.escape) exit();
  });

  if (section === 'top') {
    const items = [
      {
        label: `Doc templates — a complete starting doc (${Object.keys(DOC_TEMPLATES).length})`,
        value: DOCS_SECTION,
      },
      ...BLOCK_FAMILIES.map((f) => ({
        label: `Blocks · ${f.label} — ${familyBlocks(f.id).length} scaffolds`,
        value: f.id as string,
      })),
    ];
    return (
      <Box flexDirection="column">
        <Text bold>
          What do you want to create? <Text dimColor>(↑↓ move · enter · q to quit)</Text>
        </Text>
        <SelectInput
          items={items}
          onSelect={(item) => setSection(item.value as typeof DOCS_SECTION | BlockFamily)}
        />
      </Box>
    );
  }

  const pick = (name: string): void => {
    onPick(name);
    exit();
  };

  if (section === DOCS_SECTION) {
    const names = Object.keys(DOC_TEMPLATES);
    const width = Math.max(...names.map((n) => (DOC_TEMPLATE_INFO[n]?.title ?? n).length)) + 1;
    const items = names.map((name) => {
      const info = DOC_TEMPLATE_INFO[name];
      return { label: `${(info?.title ?? name).padEnd(width)} ${info?.description ?? ''}`, value: name };
    });
    return (
      <Box flexDirection="column">
        <Text bold>
          Doc templates <Text dimColor>(↑↓ move · enter · q to quit)</Text>
        </Text>
        <SelectInput items={items} onSelect={(item) => pick(item.value)} />
      </Box>
    );
  }

  const blocks = familyBlocks(section);
  const width = Math.max(...blocks.map((t) => t.length)) + 1;
  const items = blocks.map((t) => ({
    label: `${t.padEnd(width)} ${BLOCK_DESCRIPTIONS[t]}`,
    value: t as string,
  }));
  return (
    <Box flexDirection="column">
      <Text bold>
        Blocks · {BLOCK_FAMILIES.find((f) => f.id === section)?.label ?? section}{' '}
        <Text dimColor>(↑↓ move · enter · q to quit)</Text>
      </Text>
      <SelectInput items={items} onSelect={(item) => pick(item.value)} />
    </Box>
  );
}
